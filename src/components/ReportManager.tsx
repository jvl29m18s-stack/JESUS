import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  setDoc, 
  updateDoc, 
  serverTimestamp,
  getDocs,
  orderBy,
  limit
} from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, ReportCard, PointEntry, TestResult, AttendanceRecord, Quiz } from '../types';
import { saveToPortfolio } from '../services/reportService';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  Search, 
  Users, 
  ChevronDown, 
  Sparkles, 
  Edit3, 
  Save, 
  ArrowLeft, 
  Mic, 
  CheckCircle2, 
  AlertCircle,
  BarChart3,
  BookOpen,
  Trophy,
  Calendar,
  Star
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

interface ReportManagerProps {
  userProfile: UserProfile;
  initialMode?: 'view' | 'generate';
  selectedStandard: string;
  setSelectedStandard: (standard: string) => void;
}

export default function ReportManager({ userProfile, initialMode = 'view', selectedStandard, setSelectedStandard }: ReportManagerProps) {
  const [mode, setMode] = useState<'view' | 'generate' | 'edit'>(initialMode);
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<UserProfile | null>(null);
  const [reportCard, setReportCard] = useState<Partial<ReportCard> | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [performanceData, setPerformanceData] = useState<{
    starPoints: number;
    avgScore: number;
    attendanceRate: number;
    quizCount: number;
    loading: boolean;
  }>({
    starPoints: 0,
    avgScore: 0,
    attendanceRate: 0,
    quizCount: 0,
    loading: false
  });
  const [filters, setFilters] = useState({
    house: 'All Houses'
  });

  const isAdmin = userProfile.role === 'Admin' || userProfile.role === 'Leader';

  useEffect(() => {
    if (!isAdmin) {
      setSelectedStudent(userProfile);
      return;
    }

    let q;
    if (selectedStandard && selectedStandard !== 'All Standards') {
      q = query(collection(db, 'users'), where('role', 'in', ['Student', 'Leader']), where('standard', '==', selectedStandard));
    } else {
      q = query(collection(db, 'users'), where('role', 'in', ['Student', 'Leader']));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })) as UserProfile[];
      setStudents(data);
    });

    return () => unsubscribe();
  }, [isAdmin, selectedStandard]);

  useEffect(() => {
    if (!selectedStudent) return;

    const q = query(
      collection(db, 'report_cards'),
      where('studentId', '==', selectedStudent.uid),
      orderBy('updatedAt', 'desc'),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setReportCard(snapshot.docs[0].data() as ReportCard);
      } else {
        setReportCard(null);
      }
    });

    return () => unsubscribe();
  }, [selectedStudent]);

  useEffect(() => {
    if (!selectedStudent || mode !== 'generate') return;

    const fetchPerformance = () => {
      setPerformanceData(prev => ({ ...prev, loading: true }));
      
      const pointsQ = query(collection(db, 'points'), where('studentId', '==', selectedStudent.uid));
      const testsQ = query(collection(db, 'test_results'), where('studentId', '==', selectedStudent.uid));
      const attendanceQ = query(collection(db, 'attendance'), where('studentId', '==', selectedStudent.uid));
      const quizzesQ = query(collection(db, 'quiz_results'), where('studentId', '==', selectedStudent.uid));

      const unsubPoints = onSnapshot(pointsQ, (snap) => {
        const totalPoints = snap.docs.reduce((acc, d) => acc + (d.data().points || 0), 0);
        setPerformanceData(prev => ({ ...prev, starPoints: totalPoints }));
      });

      const unsubTests = onSnapshot(testsQ, (snap) => {
        const avgScore = snap.docs.length > 0 
          ? snap.docs.reduce((acc, d) => acc + (d.data().percentage || 0), 0) / snap.docs.length 
          : 0;
        setPerformanceData(prev => ({ ...prev, avgScore }));
      });

      const unsubAttendance = onSnapshot(attendanceQ, (snap) => {
        const attendanceRate = snap.docs.length > 0 
          ? (snap.docs.filter(d => d.data().status === 'Present').length / snap.docs.length) * 100 
          : 0;
        setPerformanceData(prev => ({ ...prev, attendanceRate }));
      });

      const unsubQuizzes = onSnapshot(quizzesQ, (snap) => {
        setPerformanceData(prev => ({ ...prev, quizCount: snap.docs.length, loading: false }));
      });

      return () => {
        unsubPoints();
        unsubTests();
        unsubAttendance();
        unsubQuizzes();
      };
    };

    const cleanup = fetchPerformance();
    return cleanup;
  }, [selectedStudent, mode]);

  const handleGenerateWithAI = async () => {
    if (!selectedStudent) return;
    setGenerating(true);

    try {
      // Use current performance data instead of re-fetching
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Generate a student report summary and recommendations based on the following data:
          Student: ${selectedStudent.displayName}
          Standard: ${selectedStudent.standard}
          House: ${selectedStudent.houseTeam}
          Total Star Points: ${performanceData.starPoints}
          Average Test Score: ${performanceData.avgScore.toFixed(1)}%
          Attendance Rate: ${performanceData.attendanceRate.toFixed(1)}%
          
          Provide the response in JSON format with "summary", "remarks", and "recommendations" (array of strings) fields.`,
        config: { responseMimeType: "application/json" }
      });

      const result = JSON.parse(response.text);
      
      setReportCard({
        ...reportCard,
        studentId: selectedStudent.uid,
        studentName: selectedStudent.displayName,
        standard: selectedStudent.standard || '',
        house: selectedStudent.houseTeam || '',
        summary: result.summary,
        remarks: result.remarks,
        recommendations: result.recommendations,
        subjects: reportCard?.subjects || {
          Tamil: { marks: 75, grade: 'C' },
          English: { marks: 75, grade: 'C' },
          Maths: { marks: 75, grade: 'C' },
          Science: { marks: 75, grade: 'C' },
          SocialScience: { marks: 75, grade: 'C' }
        },
        skills: reportCard?.skills || {
          listening: 'C',
          reading: 'C',
          speaking: 'C',
          writing: 'C'
        },
        attendance: {
          present: Math.round((performanceData.attendanceRate / 100) * 200), // Estimate based on rate
          absent: Math.round(((100 - performanceData.attendanceRate) / 100) * 200),
          participation: 'Good'
        },
        overallGrade: 'C',
        housePerformance: 50
      });
      setMode('edit');
    } catch (error) {
      console.error("AI Generation error:", error);
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!selectedStudent || !reportCard) return;
    setLoading(true);

    try {
      const cardId = reportCard.id || `${selectedStudent.uid}_${new Date().getFullYear()}`;
      await setDoc(doc(db, 'report_cards', cardId), {
        ...reportCard,
        id: cardId,
        studentId: selectedStudent.uid,
        studentName: selectedStudent.displayName,
        standard: selectedStudent.standard || '',
        house: selectedStudent.houseTeam || '',
        updatedAt: serverTimestamp(),
        createdAt: reportCard.createdAt || serverTimestamp()
      });

      // Save to student's portfolio
      await saveToPortfolio(
        selectedStudent.uid,
        `Academic Report - ${new Date().getFullYear()}`,
        'Progress Report',
        selectedStudent.totalPoints || 0,
        [], // Could extract badges if needed
        selectedStudent.role === 'Leader' ? {
          pointsDistributed: 0, // Would need to fetch these
          houseRankAtTime: 0
        } : undefined
      );

      setMode('view');
    } catch (error) {
      console.error("Save error:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = students.filter(s => {
    const stdMatch = !selectedStandard || selectedStandard === 'All Standards' || s.standard === selectedStandard;
    const houseMatch = filters.house === 'All Houses' || s.houseTeam === filters.house.toUpperCase();
    return stdMatch && houseMatch;
  });

  const standards = ['All Standards', ...Array.from({ length: 12 }, (_, i) => `Standard ${i + 1}`)];
  const houses = ['All Houses', 'GOOD PIONEER', 'GOOD PATRON', 'GOOD SAVIOUR', 'GOOD SHEPHERD'];

  if (mode === 'view') {
    return (
      <div className="space-y-8 max-w-7xl mx-auto">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Student Progress Cards</h1>
            <p className="text-slate-500">View detailed progress cards for students.</p>
          </div>
          {isAdmin && (
            <button 
              onClick={() => setMode('generate')}
              className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
            >
              <Sparkles size={20} />
              <span>Generate New Report</span>
            </button>
          )}
        </div>

        {isAdmin && (
          <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Filter by Standard</label>
              <div className="relative">
                <select 
                  value={selectedStandard || 'All Standards'}
                  onChange={e => setSelectedStandard(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none appearance-none bg-white font-medium"
                >
                  {standards.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Filter by House</label>
              <div className="relative">
                <select 
                  value={filters.house}
                  onChange={e => setFilters({ ...filters, house: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none appearance-none bg-white font-medium"
                >
                  {houses.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Select Student</label>
              <div className="relative">
                <select 
                  value={selectedStudent?.uid || ''}
                  onChange={e => setSelectedStudent(students.find(s => s.uid === e.target.value) || null)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none appearance-none bg-white font-medium"
                >
                  <option value="">Select a student...</option>
                  {filteredStudents.map(s => <option key={s.uid} value={s.uid}>{s.displayName}</option>)}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
              </div>
            </div>
            <button 
              disabled={!selectedStudent || !reportCard}
              onClick={() => setMode('edit')}
              className="px-6 py-3 bg-emerald-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-600 transition-all disabled:opacity-50"
            >
              <Edit3 size={18} />
              <span>Edit Card</span>
            </button>
          </div>
        )}

        {!selectedStudent ? (
          <div className="bg-white rounded-[32px] p-20 text-center border border-slate-100 shadow-sm">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users size={32} className="text-slate-300" />
            </div>
            <h3 className="text-xl font-bold text-slate-800">Select a Student</h3>
            <p className="text-slate-400">Please use the filters above to select a student to see their progress card.</p>
          </div>
        ) : !reportCard ? (
          <div className="bg-white rounded-[32px] p-20 text-center border border-slate-100 shadow-sm">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText size={32} className="text-slate-300" />
            </div>
            <h3 className="text-xl font-bold text-slate-800">No Report Card Found</h3>
            <p className="text-slate-400 mb-6">This student doesn't have a report card for the current term yet.</p>
            {isAdmin && (
              <button 
                onClick={() => setMode('generate')}
                className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all"
              >
                Create One Now
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Report Card View */}
            <div className="lg:col-span-2 space-y-8">
              <div className="bg-white rounded-[40px] p-10 border border-slate-100 shadow-sm space-y-10">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-6">
                    <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center text-3xl font-black text-indigo-600">
                      {selectedStudent.displayName.charAt(0)}
                    </div>
                    <div>
                      <h2 className="text-3xl font-bold text-slate-800">{selectedStudent.displayName}</h2>
                      <p className="text-slate-500 font-medium tracking-wide uppercase text-xs mt-1">
                        Standard {selectedStudent.standard} • {selectedStudent.houseTeam}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-5xl font-black text-indigo-600">{reportCard.overallGrade}</div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Overall Grade</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
                  {Object.entries(reportCard.subjects || {}).map(([name, data]: [string, any]) => (
                    <div key={name} className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{name}</div>
                      <div className="flex items-end justify-between">
                        <div className="text-2xl font-bold text-slate-800">{data.marks}</div>
                        <div className="text-xl font-black text-indigo-600">{data.grade}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <Star size={18} className="text-amber-500" /> Skill Grades
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      {Object.entries(reportCard.skills || {}).map(([skill, grade]) => (
                        <div key={skill} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                          <span className="text-xs font-medium text-slate-500 capitalize">{skill}</span>
                          <span className="font-bold text-indigo-600">{grade as string}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <Calendar size={18} className="text-blue-500" /> Attendance
                    </h4>
                    <div className="p-6 bg-slate-50 rounded-3xl space-y-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Days Present</span>
                        <span className="font-bold text-emerald-600">{reportCard.attendance?.present}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Days Absent</span>
                        <span className="font-bold text-red-500">{reportCard.attendance?.absent}</span>
                      </div>
                      <div className="pt-2 border-t border-slate-200 text-xs italic text-slate-400">
                        "{reportCard.attendance?.participation}"
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-8">
              <div className="bg-white rounded-[40px] p-8 border border-slate-100 shadow-sm space-y-6">
                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Sparkles size={18} className="text-indigo-500" /> AI Summary
                </h4>
                <p className="text-sm text-slate-600 leading-relaxed italic">
                  "{reportCard.summary}"
                </p>
                <div className="pt-4 border-t border-slate-50">
                  <h5 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Teacher Remarks</h5>
                  <p className="text-sm text-slate-800 font-medium">
                    {reportCard.remarks}
                  </p>
                </div>
              </div>

              <div className="bg-indigo-600 rounded-[40px] p-8 text-white shadow-xl shadow-indigo-100 space-y-6">
                <h4 className="text-sm font-bold flex items-center gap-2">
                  <CheckCircle2 size={18} /> Recommendations
                </h4>
                <ul className="space-y-3">
                  {(reportCard.recommendations || []).map((rec, i) => (
                    <li key={i} className="flex gap-3 text-sm opacity-90 leading-snug">
                      <div className="w-1.5 h-1.5 rounded-full bg-white mt-1.5 shrink-0" />
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (mode === 'generate') {
    return (
      <div className="space-y-8 max-w-4xl mx-auto">
        <button onClick={() => setMode('view')} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 font-bold transition-colors">
          <ArrowLeft size={18} /> Back to Dashboard
        </button>

        <div className="bg-white rounded-[40px] p-10 border border-slate-100 shadow-sm space-y-10">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Report Generation</h1>
            <p className="text-slate-500">Use AI to compile various reports and analyses.</p>
          </div>

          <div className="space-y-8">
            <div className="p-8 bg-slate-50 rounded-[32px] border border-slate-100 space-y-6">
              <h3 className="text-lg font-bold text-slate-800">Generator Controls</h3>
              <p className="text-sm text-slate-500">Select a student and their data to generate a progress card.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Filter by Standard</label>
                  <select 
                    value={selectedStandard || 'All Standards'}
                    onChange={e => setSelectedStandard(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none bg-white font-medium"
                  >
                    {standards.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Filter by House</label>
                  <select 
                    value={filters.house}
                    onChange={e => setFilters({ ...filters, house: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none bg-white font-medium"
                  >
                    {houses.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Student</label>
                <select 
                  value={selectedStudent?.uid || ''}
                  onChange={e => setSelectedStudent(students.find(s => s.uid === e.target.value) || null)}
                  className="w-full px-4 py-3 rounded-xl border-2 border-emerald-500 focus:border-emerald-600 outline-none bg-white font-medium"
                >
                  <option value="">Select a student...</option>
                  {filteredStudents.map(s => <option key={s.uid} value={s.uid}>{s.displayName} ({s.rollNumber || 'No ID'})</option>)}
                </select>
              </div>

              {selectedStudent && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-6 bg-white rounded-2xl border border-slate-200 space-y-4"
                >
                  <div className="flex items-center gap-2 text-slate-800 font-bold">
                    <AlertCircle size={18} className="text-indigo-500" /> Performance Data
                  </div>
                  <p className="text-xs text-slate-500">The following data will be used for generation:</p>
                  <ul className="text-sm text-slate-600 space-y-1 ml-4 list-disc">
                    <li>Standard: {selectedStudent.standard}</li>
                    <li>House: {selectedStudent.houseTeam}</li>
                    <li>Star Points: {performanceData.loading ? '...' : performanceData.starPoints}</li>
                    <li>Grades: {performanceData.loading ? '...' : `${performanceData.avgScore.toFixed(1)}%`}</li>
                    <li>Attendance: {performanceData.loading ? '...' : `${performanceData.attendanceRate.toFixed(1)}%`}</li>
                    <li>Daily Quizzes: {performanceData.loading ? '...' : performanceData.quizCount}</li>
                  </ul>
                </motion.div>
              )}
            </div>

            <div className="flex gap-4">
              <button 
                onClick={handleGenerateWithAI}
                disabled={!selectedStudent || generating}
                className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50"
              >
                {generating ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Sparkles size={20} />
                    <span>Generate with AI</span>
                  </>
                )}
              </button>
              <button 
                onClick={() => {
                  setReportCard({
                    studentId: selectedStudent?.uid,
                    studentName: selectedStudent?.displayName,
                    subjects: {
                      Tamil: { marks: 75, grade: 'C' },
                      English: { marks: 75, grade: 'C' },
                      Maths: { marks: 75, grade: 'C' },
                      Science: { marks: 75, grade: 'C' },
                      SocialScience: { marks: 75, grade: 'C' }
                    },
                    skills: { listening: 'C', reading: 'C', speaking: 'C', writing: 'C' },
                    attendance: { present: 0, absent: 0, participation: '' },
                    overallGrade: 'C',
                    housePerformance: 50
                  });
                  setMode('edit');
                }}
                disabled={!selectedStudent}
                className="flex-1 py-4 bg-white border border-slate-200 text-slate-700 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-50 transition-all disabled:opacity-50"
              >
                <Edit3 size={20} />
                <span>Create Manually</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'edit' && reportCard) {
    return (
      <div className="space-y-8 max-w-5xl mx-auto pb-20">
        <div className="flex justify-between items-center">
          <button onClick={() => setMode('generate')} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 font-bold transition-colors">
            <ArrowLeft size={18} /> Back
          </button>
          <h2 className="text-2xl font-bold text-slate-800">Editing Report: {selectedStudent?.displayName}</h2>
        </div>

        <div className="space-y-8">
          {/* Overall Grade */}
          <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm space-y-4">
            <label className="text-sm font-bold text-slate-800">Overall Grade</label>
            <select 
              value={reportCard.overallGrade || ''}
              onChange={e => setReportCard({ ...reportCard, overallGrade: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none bg-white font-medium"
            >
              {['A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'E'].map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          {/* Subjects */}
          <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm space-y-6">
            <h3 className="text-lg font-bold text-slate-800">Subject Grades & Marks</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {Object.entries(reportCard.subjects || {}).map(([name, data]: [string, any]) => (
                <div key={name} className="space-y-3">
                  <label className="text-sm font-bold text-slate-700 capitalize">{name}</label>
                  <div className="flex gap-4">
                    <input 
                      type="number"
                      value={data.marks}
                      onChange={e => setReportCard({
                        ...reportCard,
                        subjects: {
                          ...reportCard.subjects,
                          [name]: { ...data, marks: parseInt(e.target.value) || 0 }
                        }
                      })}
                      className="w-24 px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none"
                    />
                    <select 
                      value={data.grade || ''}
                      onChange={e => setReportCard({
                        ...reportCard,
                        subjects: {
                          ...reportCard.subjects,
                          [name]: { ...data, grade: e.target.value }
                        }
                      })}
                      className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none bg-white"
                    >
                      {['A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'E'].map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Skills & Attendance */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm space-y-6">
              <h3 className="text-lg font-bold text-slate-800">Skill Grades</h3>
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(reportCard.skills || {}).map(([skill, grade]) => (
                  <div key={skill} className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest capitalize">{skill}</label>
                    <select 
                      value={(grade as string) || ''}
                      onChange={e => setReportCard({
                        ...reportCard,
                        skills: { ...reportCard.skills, [skill]: e.target.value }
                      })}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none bg-white text-sm"
                    >
                      {['A', 'B', 'C', 'D'].map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm space-y-6">
              <h3 className="text-lg font-bold text-slate-800">Attendance</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Days Present</label>
                  <input 
                    type="number"
                    value={reportCard.attendance?.present}
                    onChange={e => setReportCard({
                      ...reportCard,
                      attendance: { ...reportCard.attendance, present: parseInt(e.target.value) || 0 }
                    })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Days Absent</label>
                  <input 
                    type="number"
                    value={reportCard.attendance?.absent}
                    onChange={e => setReportCard({
                      ...reportCard,
                      attendance: { ...reportCard.attendance, absent: parseInt(e.target.value) || 0 }
                    })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Participation Summary</label>
                <div className="relative">
                  <input 
                    type="text"
                    value={reportCard.attendance?.participation}
                    onChange={e => setReportCard({
                      ...reportCard,
                      attendance: { ...reportCard.attendance, participation: e.target.value }
                    })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none pr-12"
                  />
                  <Mic className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                </div>
              </div>
            </div>
          </div>

          {/* House Performance & Summary */}
          <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm space-y-8">
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-800">House Performance</h3>
              <div className="flex items-center gap-4">
                <span className="text-sm font-bold text-slate-700">Performance Level: {reportCard.housePerformance}%</span>
                <input 
                  type="range"
                  min="0"
                  max="100"
                  value={reportCard.housePerformance}
                  onChange={e => setReportCard({ ...reportCard, housePerformance: parseInt(e.target.value) || 0 })}
                  className="flex-1 h-2 bg-slate-100 rounded-full appearance-none cursor-pointer accent-emerald-500"
                />
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-800">Overall Summary</label>
                <div className="relative">
                  <textarea 
                    value={reportCard.summary}
                    onChange={e => setReportCard({ ...reportCard, summary: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none resize-none pr-12"
                  />
                  <Mic className="absolute right-4 top-4 text-slate-400" size={18} />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-800">Teacher Remarks</label>
                <div className="relative">
                  <textarea 
                    value={reportCard.remarks}
                    onChange={e => setReportCard({ ...reportCard, remarks: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none resize-none pr-12"
                  />
                  <Mic className="absolute right-4 top-4 text-slate-400" size={18} />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-800">Recommendations</label>
                <div className="relative">
                  <textarea 
                    value={(reportCard.recommendations || []).join('\n')}
                    onChange={e => setReportCard({ ...reportCard, recommendations: e.target.value.split('\n') })}
                    placeholder="One recommendation per line"
                    rows={4}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none resize-none pr-12"
                  />
                  <Mic className="absolute right-4 top-4 text-slate-400" size={18} />
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <button 
              onClick={() => setMode('view')}
              className="flex-1 py-4 border border-slate-200 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave}
              disabled={loading}
              className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Save size={20} />
                  <span>Save & Upload</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
