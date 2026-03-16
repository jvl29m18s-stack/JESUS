import React, { useState, useEffect, useRef } from 'react';
import { doc, updateDoc, increment, addDoc, collection, serverTimestamp, onSnapshot, runTransaction, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, Quiz, QuizResult } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronLeft, ChevronRight, Clock, Send, AlertCircle, CheckCircle2, BarChart3, ShieldAlert, Lock, Loader2 } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../firestoreErrorHandler';
import { sendNotification } from '../services/notificationService';

interface QuizPlayerProps {
  quiz: Quiz;
  userProfile: UserProfile;
  onClose: () => void;
  onNavigate?: (tab: string) => void;
}

export default function QuizPlayer({ quiz, userProfile, onClose, onNavigate }: QuizPlayerProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>(new Array(quiz.questions.length).fill(-1));
  const [timeLeft, setTimeLeft] = useState(quiz.durationMinutes * 60);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [score, setScore] = useState(0);
  const [cheatAttempts, setCheatAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [lockReason, setLockReason] = useState('');
  const [hasAlreadyTaken, setHasAlreadyTaken] = useState(false);
  const [checkingAttempt, setCheckingAttempt] = useState(true);

  const quizResultIdRef = useRef<string | null>(null);

  // Check for existing attempt
  useEffect(() => {
    const checkAttempt = async () => {
      try {
        const q = query(
          collection(db, 'quizResults'),
          where('quizId', '==', quiz.id),
          where('studentId', '==', userProfile.uid)
        );
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const result = snapshot.docs[0].data() as QuizResult;
          if (result.status === 'submitted' || result.status === 'auto-submitted') {
            setHasAlreadyTaken(true);
          } else {
            // Resume if in-progress? For now, let's just lock it to single attempt
            setHasAlreadyTaken(true);
          }
        } else {
          // Create an "in-progress" record for proctoring
          const docRef = await addDoc(collection(db, 'quizResults'), {
            studentId: userProfile.uid,
            studentName: userProfile.displayName,
            standard: userProfile.standard || quiz.standard || 'Standard 10',
            quizId: quiz.id,
            quizTitle: quiz.title,
            subject: quiz.subject,
            score: 0,
            totalScore: quiz.questions.reduce((acc, q) => acc + q.marks, 0),
            answers: new Array(quiz.questions.length).fill(-1),
            status: 'in-progress',
            proctoringStatus: 'Online',
            cheatAttempts: 0,
            timestamp: serverTimestamp()
          });
          quizResultIdRef.current = docRef.id;
        }
      } catch (error) {
        console.error("Error checking attempt:", error);
      } finally {
        setCheckingAttempt(false);
      }
    };

    checkAttempt();
  }, [quiz.id, userProfile.uid]);

  // Security: Visibility and Blur Detection
  useEffect(() => {
    if (isCompleted || isLocked || hasAlreadyTaken) return;

    const handleSecurityViolation = async (reason: string) => {
      console.warn(`Security Violation: ${reason}`);
      setCheatAttempts(prev => {
        const newCount = prev + 1;
        // Auto-submit on first violation for "High Security"
        autoSubmitCheat(reason);
        return newCount;
      });
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleSecurityViolation("Tab switched or App minimized");
      }
    };

    const onBlur = () => {
      handleSecurityViolation("User left the app/window");
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onBlur);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onBlur);
    };
  }, [isCompleted, isLocked, hasAlreadyTaken]);

  // Real-time Global Timer Sync
  useEffect(() => {
    if (isCompleted || isLocked || hasAlreadyTaken) return;

    const quizRef = doc(db, "quizzes", quiz.id);
    const unsubscribe = onSnapshot(quizRef, (doc) => {
      if (!doc.exists()) return;
      const quizData = doc.data() as Quiz;
      if (!quizData.endTime) return;

      const endTimeMillis = quizData.endTime instanceof Timestamp 
        ? quizData.endTime.toMillis() 
        : new Date(quizData.endTime).getTime();
      
      const serverTime = Date.now();

      if (serverTime >= endTimeMillis) {
        autoSubmitCheat("Time Expired (Global)");
      }
    });

    return () => unsubscribe();
  }, [quiz.id, isCompleted, isLocked, hasAlreadyTaken]);

  const autoSubmitCheat = async (reason: string) => {
    if (isSubmitting || isCompleted || isLocked) return;
    setIsLocked(true);
    setLockReason(reason);
    await handleSubmit('auto-submitted', reason);
  };

  useEffect(() => {
    if (timeLeft <= 0) {
      handleSubmit('auto-submitted', 'Time Expired');
      return;
    }
    if (isLocked || isCompleted || hasAlreadyTaken) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, isLocked, isCompleted, hasAlreadyTaken]);

  const handleAnswerSelect = async (optionIndex: number) => {
    if (isLocked || isCompleted) return;
    const newAnswers = [...answers];
    newAnswers[currentQuestionIndex] = optionIndex;
    setAnswers(newAnswers);

    // Update in-progress result for proctoring
    if (quizResultIdRef.current) {
      try {
        await updateDoc(doc(db, 'quizResults', quizResultIdRef.current), {
          answers: newAnswers,
          updatedAt: serverTimestamp()
        });
      } catch (error) {
        console.error("Error updating in-progress result:", error);
      }
    }
  };

  const handleSubmit = async (status: 'submitted' | 'auto-submitted' = 'submitted', reason?: string) => {
    if (isSubmitting || isCompleted) return;
    setIsSubmitting(true);

    let finalScore = 0;
    quiz.questions.forEach((q, i) => {
      if (answers[i] === q.correctAnswer) {
        finalScore += q.marks;
      }
    });

    const totalPossibleScore = quiz.questions.reduce((acc, q) => acc + q.marks, 0);
    const percentage = totalPossibleScore > 0 ? (finalScore / totalPossibleScore) * 100 : 0;

    try {
      // Use transaction to award points and update stats
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', userProfile.uid);
        const houseRef = doc(db, 'house_stats', userProfile.houseTeam || 'GOOD PIONEER');
        
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) throw new Error("User not found");

        // Calculate points to award
        let pointsToAward = 0;
        let cardToAward: string | null = null;

        if (percentage >= 90) {
          pointsToAward = 50;
          cardToAward = 'pink'; // Achievement Card
        } else if (percentage >= 75) {
          pointsToAward = 20;
          cardToAward = 'green';
        }

        // Update user
        const updateData: any = {
          totalPoints: increment(pointsToAward),
          updatedAt: serverTimestamp()
        };
        if (cardToAward) {
          updateData[`cards.${cardToAward}`] = increment(1);
        }
        transaction.set(userRef, updateData, { merge: true });

        // Update house
        const houseUpdate: any = {
          totalPoints: increment(pointsToAward),
          lastUpdated: serverTimestamp()
        };
        
        if (cardToAward) {
          houseUpdate[`cardCounts.${cardToAward}`] = increment(1);
        }

        transaction.set(houseRef, houseUpdate, { merge: true });

        // Update/Create Quiz Result
        if (quizResultIdRef.current) {
          transaction.set(doc(db, 'quizResults', quizResultIdRef.current), {
            score: finalScore,
            status: status,
            proctoringStatus: status === 'auto-submitted' ? 'Auto-Submitted' : 'Online',
            cheatAttempts: reason ? increment(1) : cheatAttempts,
            timestamp: serverTimestamp()
          }, { merge: true });
        } else {
          // Fallback if ref is missing
          const newResultRef = doc(collection(db, 'quizResults'));
          transaction.set(newResultRef, {
            studentId: userProfile.uid,
            studentName: userProfile.displayName,
            standard: userProfile.standard || quiz.standard || 'Standard 10',
            quizId: quiz.id,
            quizTitle: quiz.title,
            subject: quiz.subject,
            score: finalScore,
            totalScore: totalPossibleScore,
            answers,
            status: status,
            proctoringStatus: status === 'auto-submitted' ? 'Auto-Submitted' : 'Online',
            cheatAttempts: reason ? 1 : 0,
            timestamp: serverTimestamp()
          });
        }

        // Add to reward history if points awarded
        if (pointsToAward > 0) {
          const historyRef = doc(collection(db, 'reward_history'));
          transaction.set(historyRef, {
            recipientId: userProfile.uid,
            recipientName: userProfile.displayName,
            senderId: 'SYSTEM',
            senderName: 'Quiz Engine',
            senderRole: 'System',
            type: cardToAward ? 'card' : 'points',
            value: cardToAward || `${pointsToAward} pts`,
            points: pointsToAward,
            reason: `High score (${Math.round(percentage)}%) in quiz: ${quiz.title}`,
            timestamp: serverTimestamp()
          });
        }
      });

      // Add to test_results for legacy vault
      const getGrade = (pct: number) => {
        if (pct >= 90) return 'A+';
        if (pct >= 80) return 'A';
        if (pct >= 70) return 'B';
        if (pct >= 60) return 'C';
        if (pct >= 50) return 'D';
        return 'F';
      };

      await addDoc(collection(db, 'test_results'), {
        studentId: userProfile.uid,
        studentName: userProfile.displayName,
        standard: userProfile.standard || quiz.standard || 'Standard 10',
        testName: quiz.title,
        subject: quiz.subject,
        score: finalScore,
        totalScore: totalPossibleScore,
        percentage: Math.round(percentage),
        grade: getGrade(percentage),
        date: new Date().toISOString().split('T')[0],
        createdAt: serverTimestamp()
      });

      // Update quiz participants count
      await updateDoc(doc(db, 'quizzes', quiz.id), {
        participants: increment(1)
      });

      // Notify user of points
      if (percentage >= 75) {
        await sendNotification({
          userId: userProfile.uid,
          title: 'Quiz Achievement!',
          message: `You scored ${Math.round(percentage)}% and earned ${percentage >= 90 ? '50' : '20'} points!`,
          type: 'Reward'
        });
      }

      setScore(finalScore);
      setIsCompleted(true);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'quizResults');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const currentQuestion = quiz.questions[currentQuestionIndex];
  const answeredCount = answers.filter(a => a !== -1).length;

  if (checkingAttempt) {
    return (
      <div className="fixed inset-0 bg-[#0f172a] z-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Verifying quiz session...</p>
        </div>
      </div>
    );
  }

  if (hasAlreadyTaken) {
    return (
      <div className="fixed inset-0 bg-[#0f172a] z-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-[#1e293b] rounded-[32px] p-12 text-center border border-white/10 shadow-2xl max-w-md w-full"
        >
          <div className="w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center text-amber-500 mx-auto mb-6">
            <Lock size={48} />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Quiz Locked</h2>
          <p className="text-slate-400 mb-8">You have already attempted this quiz. Multiple attempts are not allowed for high-security assessments.</p>
          <button 
            onClick={onClose}
            className="w-full py-4 bg-slate-700 text-white rounded-xl font-bold hover:bg-slate-600 transition-all"
          >
            Return to Dashboard
          </button>
        </motion.div>
      </div>
    );
  }

  if (isLocked) {
    return (
      <div className="fixed inset-0 bg-[#0f172a] z-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-[#1e293b] rounded-[32px] p-12 text-center border border-red-500/20 shadow-2xl max-w-md w-full"
        >
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center text-red-500 mx-auto mb-6">
            <ShieldAlert size={48} />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Quiz Terminated</h2>
          <p className="text-slate-400 mb-4">Your quiz was auto-submitted due to a security violation:</p>
          <div className="bg-red-500/10 text-red-400 p-4 rounded-xl text-sm font-bold mb-8">
            {lockReason}
          </div>
          <button 
            onClick={() => setIsCompleted(true)}
            className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all"
          >
            View Results
          </button>
        </motion.div>
      </div>
    );
  }

  if (isCompleted) {
    return (
      <div className="fixed inset-0 bg-[#0f172a] z-50 flex flex-col p-4 overflow-y-auto custom-scrollbar">
        <div className="max-w-4xl w-full mx-auto py-12">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#1e293b] rounded-[32px] p-12 text-center border border-white/10 shadow-2xl mb-8"
          >
            <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-500 mx-auto mb-6">
              <CheckCircle2 size={48} />
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">Quiz Completed!</h2>
            <p className="text-slate-400 mb-8">Great job! Your results have been submitted. Review your answers below.</p>
            
            <div className="bg-[#0f172a] rounded-2xl p-6 mb-8 inline-block px-12">
              <div className="text-slate-400 text-xs uppercase tracking-widest font-bold mb-1">Your Score</div>
              <div className="text-5xl font-bold text-white">
                {score} <span className="text-2xl text-slate-500">/ {quiz.questions.reduce((acc, q) => acc + q.marks, 0)}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button 
                onClick={onClose}
                className="w-full max-w-xs py-4 bg-slate-700 text-white rounded-xl font-bold hover:bg-slate-600 transition-all shadow-lg"
              >
                Back to Dashboard
              </button>
              {onNavigate && (
                <button 
                  onClick={() => {
                    onNavigate('Quiz Analytics');
                    onClose();
                  }}
                  className="w-full max-w-xs py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
                >
                  <BarChart3 size={20} />
                  View Analytics
                </button>
              )}
            </div>
          </motion.div>

          {/* Review Section */}
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-white px-4">Review Answers</h3>
            {quiz.questions.map((q, i) => {
              const userAnswer = answers[i];
              const isCorrect = userAnswer === q.correctAnswer;

              return (
                <div key={i} className={`bg-[#1e293b] rounded-3xl p-8 border ${isCorrect ? 'border-emerald-500/20' : 'border-red-500/20'}`}>
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <span className="text-slate-500 font-bold">Q{i + 1}</span>
                      <h4 className="text-lg font-bold text-white">{q.text}</h4>
                    </div>
                    {isCorrect ? (
                      <div className="flex items-center gap-2 text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                        <CheckCircle2 size={14} /> Correct
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-red-500 bg-red-500/10 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                        <X size={14} /> Incorrect
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {q.options.map((option, optIdx) => {
                      const isCorrectOption = optIdx === q.correctAnswer;
                      const isUserSelection = optIdx === userAnswer;

                      let styles = "bg-[#0f172a]/50 border-white/5 text-slate-400";
                      if (isCorrectOption) {
                        styles = "bg-emerald-500/10 border-emerald-500 text-emerald-500";
                      } else if (isUserSelection && !isCorrect) {
                        styles = "bg-red-500/10 border-red-500 text-red-500";
                      }

                      return (
                        <div key={optIdx} className={`p-4 rounded-2xl border-2 flex items-center gap-3 ${styles}`}>
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${
                            isCorrectOption ? 'border-emerald-500' : isUserSelection ? 'border-red-500' : 'border-slate-600'
                          }`}>
                            {(isCorrectOption || isUserSelection) && (
                              <div className={`w-2 h-2 rounded-full ${isCorrectOption ? 'bg-emerald-500' : 'bg-red-500'}`} />
                            )}
                          </div>
                          <span className="font-medium">{option}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#0f172a] z-50 flex flex-col text-white">
      {/* Header */}
      <header className="px-8 py-6 border-b border-white/5 flex justify-between items-center bg-[#1e293b]/50 backdrop-blur-md">
        <div>
          <h1 className="text-xl font-bold text-white">{quiz.title}</h1>
          <p className="text-slate-400 text-xs uppercase tracking-widest font-bold mt-1">{quiz.subject}</p>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-xl border border-white/10">
            <Clock size={18} className="text-indigo-400" />
            <span className={`font-mono font-bold ${timeLeft < 60 ? 'text-rose-500 animate-pulse' : 'text-white'}`}>
              {formatTime(timeLeft)}
            </span>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
            <X size={24} className="text-slate-400" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8 flex flex-col items-center custom-scrollbar">
        <div className="w-full max-w-3xl space-y-8">
          {/* Question Navigation */}
          <div className="flex flex-wrap gap-2 justify-center">
            {quiz.questions.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentQuestionIndex(index)}
                className={`w-10 h-10 rounded-xl font-bold text-sm transition-all border ${
                  currentQuestionIndex === index 
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-500/20' 
                    : answers[index] !== -1
                    ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30'
                    : 'bg-[#1e293b] text-slate-400 border-white/5 hover:border-white/20'
                }`}
              >
                Q{index + 1}
              </button>
            ))}
          </div>

          {/* Question Card */}
          <motion.div 
            key={currentQuestionIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-[#1e293b] rounded-[32px] p-10 border border-white/5 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-8">
              <span className="text-indigo-400 text-xs font-bold uppercase tracking-widest">
                Multiple Choice Question | {currentQuestion.marks} mark
              </span>
              <span className="text-slate-500 text-xs font-bold uppercase tracking-widest">
                Question {currentQuestionIndex + 1} of {quiz.questions.length}
              </span>
            </div>

            <h2 className="text-2xl font-bold text-white mb-10 leading-relaxed">
              Q{currentQuestionIndex + 1}. {currentQuestion.text}
            </h2>

            <div className="space-y-4">
              {currentQuestion.options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => handleAnswerSelect(index)}
                  className={`w-full p-6 rounded-2xl border-2 text-left transition-all flex items-center gap-4 group ${
                    answers[currentQuestionIndex] === index
                      ? 'bg-indigo-600/10 border-indigo-500 text-white'
                      : 'bg-[#0f172a]/50 border-white/5 text-slate-400 hover:border-white/20 hover:text-slate-200'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                    answers[currentQuestionIndex] === index
                      ? 'border-white bg-white'
                      : 'border-slate-600 group-hover:border-slate-400'
                  }`}>
                    {answers[currentQuestionIndex] === index && (
                      <div className="w-2 h-2 rounded-full bg-indigo-600" />
                    )}
                  </div>
                  <span className="font-medium text-lg">{option}</span>
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-8 py-6 border-t border-white/5 bg-[#1e293b]/50 backdrop-blur-md flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="text-slate-400 text-sm font-medium">
            Answered: <span className="text-indigo-400 font-bold">{answeredCount}/{quiz.questions.length}</span>
          </div>
          {answeredCount < quiz.questions.length && (
            <div className="flex items-center gap-2 text-amber-500 text-xs font-bold uppercase tracking-widest">
              <AlertCircle size={14} />
              Some questions left
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
            disabled={currentQuestionIndex === 0}
            className="px-6 py-3 rounded-xl border border-white/10 font-bold text-slate-400 hover:bg-white/5 disabled:opacity-30 transition-all flex items-center gap-2"
          >
            <ChevronLeft size={20} /> Previous
          </button>
          
          {currentQuestionIndex === quiz.questions.length - 1 ? (
            <button
              onClick={() => handleSubmit()}
              disabled={isSubmitting}
              className="px-10 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all flex items-center gap-2"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Send size={20} /> Submit Quiz
                </>
              )}
            </button>
          ) : (
            <button
              onClick={() => setCurrentQuestionIndex(prev => Math.min(quiz.questions.length - 1, prev + 1))}
              className="px-10 py-3 bg-white text-[#0f172a] rounded-xl font-bold hover:bg-slate-200 transition-all flex items-center gap-2"
            >
              Next <ChevronRight size={20} />
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
