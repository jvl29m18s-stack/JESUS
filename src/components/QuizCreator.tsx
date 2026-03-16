import React, { useState, useRef } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, QuizQuestion } from '../types';
import { Plus, Trash2, Save, X, HelpCircle, Sparkles, FileUp, Loader2, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { handleFirestoreError, OperationType } from '../firestoreErrorHandler';
import { GoogleGenAI, Type } from "@google/genai";
import { sendStandardNotification } from '../services/notificationService';

interface QuizCreatorProps {
  userProfile: UserProfile;
  onClose: () => void;
}

export default function QuizCreator({ userProfile, onClose }: QuizCreatorProps) {
  const [creationMode, setCreationMode] = useState<'manual' | 'ai'>('manual');
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [standard, setStandard] = useState(userProfile.standard || 'Standard 10');
  const [duration, setDuration] = useState(50);
  const [endTime, setEndTime] = useState('');
  const [difficulty, setDifficulty] = useState('Medium');
  const [numQuestions, setNumQuestions] = useState(5);
  const [questions, setQuestions] = useState<QuizQuestion[]>([
    { id: '1', text: '', options: ['', '', '', ''], correctAnswer: 0, marks: 1 }
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addQuestion = () => {
    setQuestions([...questions, {
      id: Math.random().toString(36).substr(2, 9),
      text: '',
      options: ['', '', '', ''],
      correctAnswer: 0,
      marks: 1
    }]);
  };

  const removeQuestion = (index: number) => {
    if (questions.length > 1) {
      setQuestions(questions.filter((_, i) => i !== index));
    }
  };

  const updateQuestion = (index: number, field: keyof QuizQuestion, value: any) => {
    const newQuestions = [...questions];
    newQuestions[index] = { ...newQuestions[index], [field]: value };
    setQuestions(newQuestions);
  };

  const updateOption = (qIndex: number, oIndex: number, value: string) => {
    const newQuestions = [...questions];
    newQuestions[qIndex].options[oIndex] = value;
    setQuestions(newQuestions);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const generateWithAI = async () => {
    if (!file || !title || !subject) {
      setError('Please provide a title, subject, and a file to generate the quiz.');
      return;
    }

    setGenerating(true);
    setError(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      
      // Read file as base64
      const reader = new FileReader();
      const fileDataPromise = new Promise<string>((resolve) => {
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.readAsDataURL(file);
      });

      const base64Data = await fileDataPromise;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: file.type,
                  data: base64Data,
                },
              },
              {
                text: `Generate a quiz with ${numQuestions} multiple-choice questions based on the attached file. 
                The subject is ${subject} and the title is ${title}. 
                The difficulty level should be ${difficulty}.
                Return the response as a JSON array of questions, where each question has:
                - text: the question text
                - options: an array of 4 strings
                - correctAnswer: the index (0-3) of the correct option
                - marks: 1`,
              },
            ],
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                text: { type: "STRING" },
                options: { 
                  type: "ARRAY", 
                  items: { type: "STRING" },
                  minItems: 4,
                  maxItems: 4
                },
                correctAnswer: { type: "INTEGER" },
                marks: { type: "INTEGER" }
              },
              required: ["text", "options", "correctAnswer", "marks"]
            }
          }
        }
      });

      const generatedQuestions = JSON.parse(response.text || "[]");
      if (generatedQuestions.length > 0) {
        setQuestions(generatedQuestions.map((q: any) => ({
          ...q,
          id: Math.random().toString(36).substr(2, 9)
        })));
        setCreationMode('manual'); // Switch to manual to review/edit
      } else {
        setError('Failed to generate questions. Please try again.');
      }
    } catch (error) {
      console.error("AI Generation Error:", error);
      setError('Error generating quiz with AI. Please check your file and try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !subject || questions.some(q => !q.text || q.options.some(o => !o))) {
      setError('Please fill in all fields and questions.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const endTimestamp = endTime ? new Date(endTime) : null;

      await addDoc(collection(db, 'quizzes'), {
        title,
        subject,
        standard,
        durationMinutes: duration,
        endTime: endTimestamp,
        questions,
        status: 'Active',
        participants: 0,
        authorId: userProfile.uid,
        authorName: userProfile.displayName,
        createdAt: serverTimestamp()
      });

      // Send notifications to students of the target standard
      if (standard === 'All') {
        // For 'All', we might want a different approach, but for now let's notify everyone
        // or just skip to avoid spam. The user specifically mentioned specific standards.
      } else {
        await sendStandardNotification(standard, {
          title: 'New Quiz Posted!',
          message: `A new ${subject} quiz "${title}" has been posted for Standard ${standard}.`,
          type: 'Class'
        });
      }

      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'quizzes');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-0 md:p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white md:rounded-[32px] w-full max-w-4xl h-full md:h-auto md:max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
      >
        <div className="p-4 md:p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Create New Quiz</h2>
            <p className="text-slate-500 text-sm italic font-serif">Design a challenge for your students</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X size={24} className="text-slate-400" />
          </button>
        </div>

        {error && (
          <div className="mx-8 mt-4 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm font-medium">
            <AlertCircle size={18} />
            <p>{error}</p>
            <button onClick={() => setError(null)} className="ml-auto p-1 hover:bg-red-100 rounded-full">
              <X size={14} />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 md:space-y-8 custom-scrollbar mobile-touch-scroll">
          <div className="space-y-4">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Creation Type</label>
            <select 
              value={creationMode}
              onChange={(e) => setCreationMode(e.target.value as 'manual' | 'ai')}
              className="w-full px-4 py-3 rounded-xl border-2 border-emerald-500 focus:border-emerald-600 outline-none bg-white appearance-none transition-all font-medium"
            >
              <option value="manual">Create Manually</option>
              <option value="ai">Generate with AI from File</option>
            </select>
          </div>

          {creationMode === 'ai' ? (
            <div className="space-y-6 bg-slate-50 p-8 rounded-[32px] border border-slate-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Quiz Title</label>
                  <input 
                    type="text" 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Unit 1 Test 2"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Subject</label>
                  <input 
                    type="text" 
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g., Data Structures"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Questions</label>
                  <input 
                    type="number" 
                    value={numQuestions}
                    onChange={(e) => setNumQuestions(parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Standard</label>
                  <select 
                    value={standard}
                    onChange={(e) => setStandard(e.target.value)}
                    disabled={userProfile.role === 'Leader'}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none bg-white appearance-none transition-all disabled:opacity-50"
                  >
                    <option value="All">All Standards</option>
                    {Array.from({ length: 12 }, (_, i) => (i + 1).toString()).map(s => (
                      <option key={s} value={`Standard ${s}`}>Standard {s}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Difficulty</label>
                  <select 
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none bg-white appearance-none transition-all"
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">File (PDF, Image, etc.)</label>
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-12 border-2 border-dashed border-slate-300 rounded-[24px] flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 transition-all group"
                >
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-500 transition-all">
                    <FileUp size={32} />
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-slate-700">{file ? file.name : 'Choose File'}</p>
                    <p className="text-xs text-slate-400 mt-1">{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'No file chosen'}</p>
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept="application/pdf,image/*"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-4 pt-4">
                <button 
                  onClick={() => setCreationMode('manual')}
                  className="px-6 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={generateWithAI}
                  disabled={generating || !file}
                  className="px-8 py-3 bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {generating ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      Generating Quiz...
                    </>
                  ) : (
                    <>
                      <Sparkles size={20} />
                      Generate Quiz
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Quiz Title</label>
                  <input 
                    type="text" 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Unit 1 Test 2"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none transition-all"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Subject</label>
                  <input 
                    type="text" 
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g., Data Structures"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none transition-all"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Standard</label>
                  <select 
                    value={standard}
                    onChange={(e) => setStandard(e.target.value)}
                    disabled={userProfile.role === 'Leader'}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none bg-white appearance-none transition-all disabled:opacity-50"
                  >
                    <option value="All">All Standards</option>
                    {Array.from({ length: 12 }, (_, i) => (i + 1).toString()).map(s => (
                      <option key={s} value={`Standard ${s}`}>Standard {s}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Duration (Minutes)</label>
                  <input 
                    type="number" 
                    value={duration}
                    onChange={(e) => setDuration(parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none transition-all"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">End Time (Auto-Submit)</label>
                  <input 
                    type="datetime-local" 
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none transition-all"
                    required
                  />
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <HelpCircle className="text-indigo-500" /> Questions ({questions.length})
                  </h3>
                  <button 
                    type="button"
                    onClick={addQuestion}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-bold text-sm hover:bg-indigo-100 transition-all"
                  >
                    <Plus size={18} /> Add Question
                  </button>
                </div>

                <div className="space-y-8">
                  {questions.map((q, qIndex) => (
                    <div key={q.id} className="p-6 bg-slate-50 rounded-[24px] border border-slate-100 relative group">
                      <button 
                        type="button"
                        onClick={() => removeQuestion(qIndex)}
                        className="absolute top-4 right-4 p-2 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={18} />
                      </button>

                      <div className="space-y-4">
                        <div className="flex gap-4">
                          <span className="w-8 h-8 rounded-lg bg-indigo-500 text-white flex items-center justify-center font-bold shrink-0">
                            {qIndex + 1}
                          </span>
                          <textarea 
                            value={q.text}
                            onChange={(e) => updateQuestion(qIndex, 'text', e.target.value)}
                            placeholder="Enter question text..."
                            className="w-full bg-transparent border-b-2 border-slate-200 focus:border-indigo-500 outline-none py-1 transition-all resize-none"
                            rows={2}
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-12">
                          {q.options.map((option, oIndex) => (
                            <div key={oIndex} className="flex items-center gap-3">
                              <input 
                                type="radio" 
                                name={`correct-${q.id}`}
                                checked={q.correctAnswer === oIndex}
                                onChange={() => updateQuestion(qIndex, 'correctAnswer', oIndex)}
                                className="w-4 h-4 text-indigo-600"
                              />
                              <input 
                                type="text" 
                                value={option}
                                onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                                placeholder={`Option ${oIndex + 1}`}
                                className="flex-1 bg-white px-4 py-2 rounded-lg border border-slate-200 focus:border-indigo-500 outline-none text-sm transition-all"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-4">
                <button 
                  onClick={onClose}
                  className="px-6 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {submitting ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Save size={20} />
                      Post Quiz
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}
