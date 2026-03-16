import React, { useState, useEffect } from 'react';
import { doc, setDoc, serverTimestamp, onSnapshot, collection, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { DailyQuiz, UserProfile, DailyQuizResult } from '../types';
import { saveToPortfolio } from '../services/reportService';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, XCircle, AlertCircle, Pencil } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../firestoreErrorHandler';

interface DailyQuizPlayerProps {
  quiz: DailyQuiz;
  userProfile: UserProfile;
}

export default function DailyQuizPlayer({ quiz, userProfile }: DailyQuizPlayerProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [result, setResult] = useState<DailyQuizResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  useEffect(() => {
    // Check if user already answered this quiz
    const q = query(
      collection(db, 'dailyQuizResults'),
      where('quizId', '==', quiz.id),
      where('studentId', '==', userProfile.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setResult(snapshot.docs[0].data() as DailyQuizResult);
        setShowFeedback(true);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'dailyQuizResults');
    });

    return () => unsubscribe();
  }, [quiz.id, userProfile.uid]);

  const handleSubmit = async () => {
    if (selectedAnswer === null || isSubmitting || result) return;

    setIsSubmitting(true);
    const isCorrect = selectedAnswer === quiz.correctAnswer;

    try {
      const resultData: Omit<DailyQuizResult, 'id'> = {
        quizId: quiz.id,
        studentId: userProfile.uid,
        studentName: userProfile.displayName,
        selectedAnswer,
        isCorrect,
        timestamp: serverTimestamp()
      };

      await setDoc(doc(collection(db, 'dailyQuizResults')), resultData);

      if (isCorrect) {
        await saveToPortfolio(
          userProfile.uid,
          `Quiz Achievement: ${quiz.question.substring(0, 30)}...`,
          'Quiz Award',
          userProfile.totalPoints || 0,
          ['Quiz Master']
        );
      }

      setShowFeedback(true);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'dailyQuizResults');
    } finally {
      setIsSubmitting(false);
    }
  };

  const optionLabels = ['A', 'B', 'C', 'D'];

  return (
    <div className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-100 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
            <Pencil size={20} />
          </div>
          <h2 className="text-xl font-bold text-slate-800">Question of the day</h2>
        </div>
        <AlertCircle className="text-slate-300" size={24} />
      </div>

      <div className="mb-10">
        <p className="text-lg text-slate-700 leading-relaxed font-medium">
          {quiz.question}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
        {quiz.options.map((option, index) => {
          const isSelected = selectedAnswer === index;
          const isCorrect = index === quiz.correctAnswer;
          const isUserSelection = result?.selectedAnswer === index;
          
          let stateStyles = "border-slate-100 bg-white hover:border-indigo-200";
          if (showFeedback) {
            if (isCorrect) {
              stateStyles = "border-emerald-500 bg-emerald-50 text-emerald-700";
            } else if (isUserSelection && !isCorrect) {
              stateStyles = "border-red-500 bg-red-50 text-red-700";
            } else {
              stateStyles = "border-slate-100 bg-slate-50 opacity-50";
            }
          } else if (isSelected) {
            stateStyles = "border-indigo-500 bg-indigo-50 text-indigo-700";
          }

          return (
            <button
              key={index}
              disabled={showFeedback}
              onClick={() => setSelectedAnswer(index)}
              className={`flex items-center rounded-2xl border-2 transition-all p-1 overflow-hidden group ${stateStyles}`}
            >
              <div className={`w-12 h-12 flex items-center justify-center font-bold text-lg border-r-2 ${
                showFeedback ? (isCorrect ? 'border-emerald-200 bg-emerald-100' : 'border-red-200 bg-red-100') : 'border-slate-100 bg-slate-50 group-hover:bg-indigo-100 group-hover:border-indigo-200'
              }`}>
                {optionLabels[index]}
              </div>
              <div className="flex-1 px-6 py-3 text-left font-bold">
                {option}
              </div>
              <AnimatePresence>
                {showFeedback && isUserSelection && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="pr-4"
                  >
                    {isCorrect ? (
                      <CheckCircle2 className="text-emerald-500" size={24} />
                    ) : (
                      <XCircle className="text-red-500" size={24} />
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          );
        })}
      </div>

      {!showFeedback ? (
        <button
          onClick={handleSubmit}
          disabled={selectedAnswer === null || isSubmitting}
          className="w-full py-4 bg-slate-200 text-slate-400 rounded-2xl font-bold text-lg transition-all hover:bg-indigo-600 hover:text-white disabled:cursor-not-allowed disabled:hover:bg-slate-200 disabled:hover:text-slate-400"
        >
          {isSubmitting ? (
            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
          ) : (
            'Submit'
          )}
        </button>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-2xl text-center font-bold ${
            result?.isCorrect ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {result?.isCorrect ? 'Correct! Well done.' : `Incorrect. The correct answer was ${optionLabels[quiz.correctAnswer]}.`}
        </motion.div>
      )}
    </div>
  );
}
