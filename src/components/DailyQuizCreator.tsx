import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile } from '../types';
import { motion } from 'motion/react';
import { X, Save, Plus, Trash2 } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../firestoreErrorHandler';
import { sendStandardNotification } from '../services/notificationService';

interface DailyQuizCreatorProps {
  userProfile: UserProfile;
  standard: string;
  onClose: () => void;
}

export default function DailyQuizCreator({ userProfile, standard, onClose }: DailyQuizCreatorProps) {
  const [formData, setFormData] = useState({
    question: '',
    options: ['', '', '', ''],
    correctAnswer: 0,
    subject: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const subjects = [
    'Mathematics', 'Science', 'English', 'Hindi', 'Social Studies', 
    'Computer Science', 'Physics', 'Chemistry', 'Biology'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.question || formData.options.some(o => !o) || !formData.subject) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'dailyQuizzes'), {
        ...formData,
        standard,
        authorId: userProfile.uid,
        authorName: userProfile.displayName,
        createdAt: serverTimestamp()
      });

      // Send notification to students of this standard
      await sendStandardNotification(standard, {
        title: 'New Daily Quiz!',
        message: `A new daily quiz for ${formData.subject} is now available.`,
        type: 'Class'
      });

      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'dailyQuizzes');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-[32px] w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        <div className="flex justify-between items-center p-8 border-b border-slate-50 shrink-0">
          <h2 className="text-2xl font-bold text-slate-800">Create Daily Quiz</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Subject *</label>
            <select 
              required
              value={formData.subject}
              onChange={e => setFormData({ ...formData, subject: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none"
            >
              <option value="">Select Subject</option>
              {subjects.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Question *</label>
            <textarea 
              required
              rows={3}
              placeholder="Enter the question..."
              value={formData.question}
              onChange={e => setFormData({ ...formData, question: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none resize-none"
            />
          </div>

          <div className="space-y-4">
            <label className="text-sm font-bold text-slate-700">Options (Select the correct one) *</label>
            {formData.options.map((option, index) => (
              <div key={index} className="flex items-center gap-4">
                <input 
                  type="radio"
                  name="correctAnswer"
                  checked={formData.correctAnswer === index}
                  onChange={() => setFormData({ ...formData, correctAnswer: index })}
                  className="w-5 h-5 text-indigo-600"
                />
                <input 
                  required
                  type="text"
                  placeholder={`Option ${String.fromCharCode(65 + index)}`}
                  value={option}
                  onChange={e => {
                    const newOptions = [...formData.options];
                    newOptions[index] = e.target.value;
                    setFormData({ ...formData, options: newOptions });
                  }}
                  className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none"
                />
              </div>
            ))}
          </div>

          <div className="flex gap-4 pt-4">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 py-4 border border-slate-200 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Save size={20} />
                  <span>Post Daily Quiz</span>
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
