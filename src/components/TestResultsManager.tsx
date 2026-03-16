import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, where } from 'firebase/firestore';
import { db } from '../firebase';
import { TestResult, UserProfile } from '../types';
import { motion } from 'motion/react';
import { handleFirestoreError, OperationType } from '../firestoreErrorHandler';
import { FileText, Download, Search, Filter, Plus, Trash2 } from 'lucide-react';

interface TestResultsManagerProps {
  userProfile: UserProfile;
  selectedStandard: string;
  setSelectedStandard: (standard: string) => void;
}

export default function TestResultsManager({ userProfile, selectedStandard, setSelectedStandard }: TestResultsManagerProps) {
  const [results, setResults] = useState<TestResult[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('All Subjects');
  const [loading, setLoading] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const isAdmin = userProfile.role === 'Admin';
  const isLeader = userProfile.role === 'Leader';

  useEffect(() => {
    setLoading(true);
    
    // Query for test_results
    let testQuery = query(collection(db, 'test_results'), orderBy('createdAt', 'desc'));
    if (userProfile.role === 'Student') {
      testQuery = query(collection(db, 'test_results'), where('studentId', '==', userProfile.uid), orderBy('createdAt', 'desc'));
    } else if (isLeader && userProfile.standard) {
      testQuery = query(collection(db, 'test_results'), where('standard', '==', userProfile.standard), orderBy('createdAt', 'desc'));
    } else if (isAdmin && selectedStandard && selectedStandard !== 'All Standards') {
      testQuery = query(collection(db, 'test_results'), where('standard', '==', selectedStandard), orderBy('createdAt', 'desc'));
    }

    // Query for quizResults
    let quizQuery = query(collection(db, 'quizResults'), orderBy('timestamp', 'desc'));
    if (userProfile.role === 'Student') {
      quizQuery = query(collection(db, 'quizResults'), where('studentId', '==', userProfile.uid), orderBy('timestamp', 'desc'));
    } else if (isLeader && userProfile.standard) {
      quizQuery = query(collection(db, 'quizResults'), where('standard', '==', userProfile.standard), orderBy('timestamp', 'desc'));
    } else if (isAdmin && selectedStandard && selectedStandard !== 'All Standards') {
      quizQuery = query(collection(db, 'quizResults'), where('standard', '==', selectedStandard), orderBy('timestamp', 'desc'));
    }

    const unsubscribeTest = onSnapshot(testQuery, (snapshot) => {
      const testList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        type: 'Test'
      })) as any[];
      
      updateMergedResults(testList, 'test');
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'test_results');
    });

    const unsubscribeQuiz = onSnapshot(quizQuery, (snapshot) => {
      const quizList = snapshot.docs.map(doc => {
        const data = doc.data();
        const percentage = data.totalScore > 0 ? Math.round((data.score / data.totalScore) * 100) : 0;
        
        const getGrade = (pct: number) => {
          if (pct >= 90) return 'A+';
          if (pct >= 80) return 'A';
          if (pct >= 70) return 'B';
          if (pct >= 60) return 'C';
          if (pct >= 50) return 'D';
          return 'F';
        };

        return {
          id: doc.id,
          studentId: data.studentId,
          studentName: data.studentName,
          standard: data.standard || 'N/A',
          testName: data.quizTitle || 'Quiz',
          subject: data.subject || 'General',
          score: data.score,
          totalScore: data.totalScore,
          percentage: percentage,
          grade: getGrade(percentage),
          date: data.timestamp ? (data.timestamp as any).toDate?.().toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          createdAt: data.timestamp,
          type: 'Quiz'
        };
      }) as any[];
      
      updateMergedResults(quizList, 'quiz');
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'quizResults');
    });

    const resultsMap = { test: [] as any[], quiz: [] as any[] };
    
    function updateMergedResults(newList: any[], source: 'test' | 'quiz') {
      resultsMap[source] = newList;
      const merged = [...resultsMap.test, ...resultsMap.quiz].sort((a, b) => {
        const timeA = a.createdAt?.toDate?.()?.getTime() || 0;
        const timeB = b.createdAt?.toDate?.()?.getTime() || 0;
        return timeB - timeA;
      });
      setResults(merged);
      setLoading(false);
    }

    return () => {
      unsubscribeTest();
      unsubscribeQuiz();
    };
  }, [isLeader, userProfile.standard, userProfile.role, userProfile.uid, selectedStandard]);

  const subjects = [
    'Mathematics', 'Science', 'English', 'Hindi', 'Social Studies', 
    'Computer Science', 'Physics', 'Chemistry', 'Biology'
  ];

  const filteredResults = results.filter(r => {
    const matchesSearch = r.studentName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         r.testName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSubject = selectedSubject === 'All Subjects' || r.subject === selectedSubject;
    const matchesStandard = selectedStandard === 'All Standards' || r.standard === selectedStandard;
    return matchesSearch && matchesSubject && matchesStandard;
  });

  const handleExport = () => {
    const csv = [
      ['Student', 'Standard', 'Test Name', 'Subject', 'Score', 'Percentage', 'Grade', 'Date'],
      ...filteredResults.map(r => [
        r.studentName,
        r.standard,
        r.testName,
        r.subject,
        `${r.score}/${r.totalScore}`,
        `${r.percentage}%`,
        r.grade,
        r.date
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `test_results_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'test_results', id));
      setConfirmDeleteId(null);
    } catch (error) {
      console.error("Error deleting result:", error);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Test Results</h1>
          <p className="text-slate-500 text-sm">{results.length} results</p>
        </div>
        <button 
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all"
        >
          <Download size={18} />
          <span>Export</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text"
            placeholder="Search by student or test name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 outline-none"
          />
        </div>
        {isAdmin && (
          <div className="relative">
            {/* Global standard selector is used instead */}
          </div>
        )}
        <div className="relative">
          <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <select 
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 outline-none bg-white min-w-[180px] appearance-none"
          >
            <option value="All Subjects">All Subjects</option>
            {subjects.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden overflow-x-auto no-scrollbar mobile-touch-scroll">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-100">
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Student</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Type</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Test Name</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Subject</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Score</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Percentage</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Grade</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date</th>
              {isAdmin && <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredResults.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 8 : 7} className="px-6 py-12 text-center text-slate-400 italic">
                  No test results found
                </td>
              </tr>
            ) : (
              filteredResults.map((result) => (
                <tr key={result.id} className="hover:bg-slate-50/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center text-xs font-bold border border-orange-100">
                        {result.studentName.charAt(0)}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-800">{result.studentName}</div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Std {result.standard}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      (result as any).type === 'Quiz' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'bg-amber-50 text-amber-600 border border-amber-100'
                    }`}>
                      {(result as any).type || 'Test'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-slate-800">{result.testName}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 bg-slate-50 text-slate-600 rounded-lg text-[10px] font-bold border border-slate-100">
                      {result.subject}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="text-sm font-medium text-slate-600">{result.score}/{result.totalScore}</div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className={`text-sm font-bold ${
                      result.percentage >= 80 ? 'text-emerald-500' : 
                      result.percentage >= 60 ? 'text-blue-500' : 
                      'text-orange-500'
                    }`}>
                      {result.percentage}%
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      result.grade.startsWith('A') ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                      result.grade.startsWith('B') ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                      'bg-orange-50 text-orange-600 border border-orange-100'
                    }`}>
                      {result.grade}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs text-slate-400">{result.date}</div>
                  </td>
                  {isAdmin && (
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => setConfirmDeleteId(result.id)}
                        className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Confirmation Modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[32px] p-8 max-w-sm w-full text-center shadow-2xl"
          >
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trash2 size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Delete Result?</h3>
            <p className="text-slate-500 mb-8">This action cannot be undone. The test result will be permanently removed.</p>
            <div className="flex gap-4">
              <button 
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={() => handleDelete(confirmDeleteId)}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-200"
              >
                Delete
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
