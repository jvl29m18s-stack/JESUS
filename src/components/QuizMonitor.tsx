import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Quiz, UserProfile, QuizResult } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '../firestoreErrorHandler';
import { Layout, Trash2, Users, CheckCircle2, Clock, Plus, Play, ClipboardCheck, BookOpen, Eye, X, ShieldAlert, AlertTriangle, UserCheck } from 'lucide-react';
import QuizCreator from './QuizCreator';
import QuizPlayer from './QuizPlayer';

interface QuizMonitorProps {
  userProfile: UserProfile;
  onNavigate?: (tab: string) => void;
  selectedStandard: string;
  setSelectedStandard: (standard: string) => void;
}

export default function QuizMonitor({ userProfile, onNavigate, selectedStandard, setSelectedStandard }: QuizMonitorProps) {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [userResults, setUserResults] = useState<Record<string, QuizResult>>({});
  const [allResults, setAllResults] = useState<QuizResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreator, setShowCreator] = useState(false);
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [viewingResultsQuiz, setViewingResultsQuiz] = useState<Quiz | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const isAdmin = userProfile.role === 'Admin';
  const isLeader = userProfile.role === 'Leader';
  const canCreate = isAdmin || isLeader;

  useEffect(() => {
    // Fetch quizzes
    const q = query(collection(db, 'quizzes'), orderBy('createdAt', 'desc'));
    const unsubscribeQuizzes = onSnapshot(q, (snapshot) => {
      const quizList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Quiz[];
      setQuizzes(quizList);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'quizzes');
    });

    // Fetch user's results
    const rq = query(collection(db, 'quizResults'), where('studentId', '==', userProfile.uid));
    const unsubscribeResults = onSnapshot(rq, (snapshot) => {
      const results: Record<string, QuizResult> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data() as QuizResult;
        results[data.quizId] = { ...data, id: doc.id };
      });
      setUserResults(results);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'quizResults');
    });

    // Fetch all results for Admin/Leader
    let unsubscribeAllResults = () => {};
    if (canCreate) {
      const allRq = query(collection(db, 'quizResults'), orderBy('timestamp', 'desc'));
      unsubscribeAllResults = onSnapshot(allRq, (snapshot) => {
        setAllResults(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }) as QuizResult));
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'quizResults');
      });
    }

    return () => {
      unsubscribeQuizzes();
      unsubscribeResults();
      unsubscribeAllResults();
    };
  }, [userProfile.uid, canCreate]);

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'quizzes', id));
      setConfirmDeleteId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `quizzes/${id}`);
    }
  };

  const confirmDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setConfirmDeleteId(id);
  };

  const filteredQuizzes = quizzes.filter(q => {
    if (!canCreate) {
      return q.standard === userProfile.standard || q.standard === 'All';
    }
    if (isLeader && userProfile.standard) {
      return q.standard === userProfile.standard || q.standard === 'All';
    }
    if (selectedStandard === 'All Standards') return true;
    return q.standard === selectedStandard;
  });

  return (
    <div className="space-y-8 max-w-7xl mx-auto custom-scrollbar">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Quiz Hub</h1>
          <p className="text-slate-500 text-lg italic font-serif">Challenge yourself and track your progress.</p>
        </div>
        {canCreate && (
          <div className="flex items-center gap-4">
            <select
              value={selectedStandard || 'All Standards'}
              onChange={(e) => setSelectedStandard(e.target.value)}
              disabled={isLeader}
              className="px-4 py-3 rounded-2xl border border-slate-200 focus:border-indigo-500 outline-none bg-white appearance-none transition-all font-medium text-slate-700 disabled:opacity-50"
            >
              <option value="All Standards">All Standards</option>
              {Array.from({ length: 12 }, (_, i) => (i + 1).toString()).map(s => (
                <option key={s} value={`Standard ${s}`}>Standard {s}</option>
              ))}
            </select>
            <button 
              onClick={() => setShowCreator(true)}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all transform hover:-translate-y-1"
            >
              <Plus size={20} /> Post New Quiz
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredQuizzes.length === 0 ? (
          <div className="col-span-full py-24 text-center bg-white rounded-[32px] border-2 border-dashed border-slate-200">
            <BookOpen className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-800">No Quizzes Available</h3>
            <p className="text-slate-500">Check back later for new challenges!</p>
          </div>
        ) : (
          filteredQuizzes.map(q => {
            const result = userResults[q.id];
            const isCompleted = !!result;
            const quizParticipants = allResults.filter(r => r.quizId === q.id);

            return (
              <motion.div 
                key={q.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm hover:shadow-xl transition-all group relative ${
                  isCompleted ? 'opacity-80' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-6">
                  <div className="flex flex-col gap-2">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                      isCompleted ? 'bg-emerald-50 text-emerald-500' : 'bg-indigo-50 text-indigo-500'
                    }`}>
                      {isCompleted ? <ClipboardCheck size={28} /> : <Layout size={28} />}
                    </div>
                    {q.createdAt && (Date.now() - q.createdAt.toDate().getTime() < 3600000) && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-rose-500 animate-pulse uppercase tracking-widest">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        Live Now
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {canCreate && (
                      <button 
                        onClick={() => setViewingResultsQuiz(q)}
                        className="p-2 text-slate-300 hover:text-indigo-500 transition-colors"
                        title="View Results"
                      >
                        <Eye size={18} />
                      </button>
                    )}
                    {(isAdmin || q.authorId === userProfile.uid) && (
                      <button 
                        onClick={(e) => confirmDelete(e, q.id)}
                        className="p-2 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h3 className="text-xl font-bold text-slate-800 leading-tight mb-1">{q.title}</h3>
                    <div className="inline-block px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                      {q.subject}
                    </div>
                    <p className="text-slate-400 text-xs mt-2 font-medium">by {q.authorName}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-50">
                    <div className="flex items-center gap-2 text-slate-500">
                      <Users size={16} className="text-slate-300" />
                      <span className="text-xs font-bold">{q.questions?.length || 0} Questions</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-500">
                      <Clock size={16} className="text-slate-300" />
                      <span className="text-xs font-bold">{q.durationMinutes} mins</span>
                    </div>
                  </div>

                  {isCompleted ? (
                    <div className="flex items-center justify-between pt-4">
                      <div className="flex items-center gap-2 text-emerald-600">
                        <CheckCircle2 size={18} />
                        <span className="text-sm font-bold uppercase tracking-wider">Completed</span>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Score</div>
                        <div className="text-lg font-bold text-emerald-600">{result.score}/{result.totalScore}</div>
                      </div>
                    </div>
                  ) : (
                    <button 
                      onClick={() => setActiveQuiz(q)}
                      className="w-full mt-4 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-black transition-all flex items-center justify-center gap-2 group/btn"
                    >
                      <Play size={18} className="fill-current" />
                      Start Quiz
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Results Modal */}
      <AnimatePresence>
        {viewingResultsQuiz && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-[32px] w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col shadow-2xl"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">Quiz Results</h2>
                  <p className="text-slate-500 text-sm italic font-serif">{viewingResultsQuiz.title}</p>
                </div>
                <button onClick={() => setViewingResultsQuiz(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                  <X size={24} className="text-slate-400" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                <div className="space-y-4">
                  {allResults.filter(r => r.quizId === viewingResultsQuiz.id).length === 0 ? (
                    <div className="text-center py-12 text-slate-400 italic">No submissions yet</div>
                  ) : (
                    allResults.filter(r => r.quizId === viewingResultsQuiz.id).map((r, i) => (
                      <div key={r.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center font-bold text-indigo-600 border border-slate-100 relative">
                            {i + 1}
                            <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${
                              r.status === 'in-progress' ? 'bg-emerald-500' :
                              r.status === 'auto-submitted' ? 'bg-red-500' :
                              'bg-slate-300'
                            }`} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <div className="font-bold text-slate-800">{r.studentName}</div>
                              {r.status === 'auto-submitted' && (
                                <span className="flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-600 text-[8px] font-bold rounded-full uppercase tracking-widest">
                                  <ShieldAlert size={8} /> Auto-Submitted
                                </span>
                              )}
                              {r.status === 'in-progress' && (
                                <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[8px] font-bold rounded-full uppercase tracking-widest animate-pulse">
                                  <UserCheck size={8} /> Online
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold flex items-center gap-2">
                              {r.timestamp ? (r.timestamp as any).toDate?.().toLocaleString() : 'Just now'}
                              {r.cheatAttempts && r.cheatAttempts > 0 && (
                                <span className="text-amber-500 flex items-center gap-1">
                                  <AlertTriangle size={10} /> {r.cheatAttempts} Violations
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-lg font-bold ${r.status === 'in-progress' ? 'text-slate-400' : 'text-indigo-600'}`}>
                            {r.status === 'in-progress' ? '--' : `${r.score}/${r.totalScore}`}
                          </div>
                          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                            {r.status === 'in-progress' ? 'Active' : 'Score'}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmDeleteId && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-[32px] p-8 max-w-sm w-full text-center shadow-2xl"
            >
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Delete Quiz?</h3>
              <p className="text-slate-500 mb-8">This action cannot be undone. All results for this quiz will remain but the quiz itself will be removed.</p>
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
      </AnimatePresence>

      {/* Modals */}
      <AnimatePresence>
        {showCreator && (
          <QuizCreator 
            userProfile={userProfile} 
            onClose={() => setShowCreator(false)} 
          />
        )}
        {activeQuiz && (
          <QuizPlayer 
            quiz={activeQuiz} 
            userProfile={userProfile} 
            onClose={() => setActiveQuiz(null)} 
            onNavigate={onNavigate}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
