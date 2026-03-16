import React, { useState, useEffect } from 'react';
import { Sparkles, User, Brain, BookOpen, TrendingUp, Loader2, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, getDocs, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, Progress, Course } from '../types';
import { GoogleGenAI } from "@google/genai";

interface AIStudentStoryProps {
  userProfile: UserProfile;
}

const AIStudentStory: React.FC<AIStudentStoryProps> = ({ userProfile }) => {
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<UserProfile | null>(
    userProfile.role === 'Student' ? userProfile : null
  );
  const [loading, setLoading] = useState(false);
  const [story, setStory] = useState<string | null>(null);
  const [studentProgress, setStudentProgress] = useState<Progress[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (userProfile.role === 'Admin' || userProfile.role === 'Leader') {
      const q = query(collection(db, 'users'), where('role', '==', 'Student'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const studentList = snapshot.docs.map(doc => ({ ...doc.data() } as unknown as UserProfile));
        setStudents(studentList);
      });
      return () => unsubscribe();
    }
  }, [userProfile]);

  useEffect(() => {
    if (selectedStudent) {
      const q = query(collection(db, 'progress'), where('studentId', '==', selectedStudent.uid));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setStudentProgress(snapshot.docs.map(doc => doc.data() as Progress));
      });
      return () => unsubscribe();
    }
  }, [selectedStudent]);

  useEffect(() => {
    const q = query(collection(db, 'courses'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCourses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course)));
    });
    return () => unsubscribe();
  }, []);

  const generateStory = async () => {
    if (!selectedStudent) return;
    
    setGenerating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const progressDetails = studentProgress.map(p => {
        const course = courses.find(c => c.id === p.courseId);
        return `${course?.title || 'Unknown Course'}: ${p.completionPercentage}% complete (${p.completedAssignments.length} assignments done)`;
      }).join('\n');

      const prompt = `
        You are an inspiring educational mentor. Write a short, encouraging "Student Growth Story" (about 150-200 words) for a student named ${selectedStudent.displayName}.
        
        Current Progress Data:
        ${progressDetails || 'No progress data available yet.'}
        
        The story should:
        1. Be written in a warm, narrative style.
        2. Highlight their achievements based on the data.
        3. If progress is low, focus on potential and the journey ahead.
        4. Use metaphors related to growth, light, or discovery.
        5. End with a powerful motivational quote.
        
        Format the output with a title and the story body.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      setStory(response.text || "Unable to generate story at this time.");
    } catch (error) {
      console.error("Error generating story:", error);
      setStory("An error occurred while generating the student story. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-2xl font-serif font-medium text-[#1a1a1a] flex items-center gap-3">
              <Sparkles className="text-indigo-500" /> AI Student Story
            </h3>
            <p className="text-[#5A5A40]/60 font-serif italic">
              Generating personalized growth narratives powered by AI.
            </p>
          </div>
          
          {(userProfile.role === 'Admin' || userProfile.role === 'Leader') && (
            <div className="flex items-center gap-4">
              <select 
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                value={selectedStudent?.uid || ''}
                onChange={(e) => setSelectedStudent(students.find(s => s.uid === e.target.value) || null)}
              >
                <option value="">Select a Student</option>
                {students.map(student => (
                  <option key={student.uid} value={student.uid}>{student.displayName}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {!selectedStudent ? (
          <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <User className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 font-serif italic">Please select a student to generate their story.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-indigo-50 rounded-2xl p-6 border border-indigo-100">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-indigo-600 shadow-sm">
                    <Brain size={24} />
                  </div>
                  <div>
                    <h4 className="font-bold text-indigo-900">{selectedStudent.displayName}</h4>
                    <p className="text-xs text-indigo-700 uppercase tracking-wider font-bold">{selectedStudent.standard}</p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-indigo-700/60">Courses Enrolled</span>
                    <span className="font-bold text-indigo-900">{studentProgress.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-indigo-700/60">Avg. Completion</span>
                    <span className="font-bold text-indigo-900">
                      {studentProgress.length > 0 
                        ? Math.round(studentProgress.reduce((acc, curr) => acc + curr.completionPercentage, 0) / studentProgress.length)
                        : 0}%
                    </span>
                  </div>
                </div>

                <button
                  onClick={generateStory}
                  disabled={generating}
                  className="w-full mt-6 bg-indigo-600 text-white rounded-xl py-3 font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {generating ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      Generating...
                    </>
                  ) : (
                    <>
                      <RefreshCw size={20} />
                      {story ? 'Regenerate Story' : 'Generate Story'}
                    </>
                  )}
                </button>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <BookOpen size={18} className="text-slate-400" /> Recent Progress
                </h4>
                <div className="space-y-4">
                  {studentProgress.slice(0, 3).map((p, idx) => {
                    const course = courses.find(c => c.id === p.courseId);
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-xs font-bold">
                          <span className="text-slate-600 truncate max-w-[120px]">{course?.title || 'Course'}</span>
                          <span className="text-indigo-600">{p.completionPercentage}%</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                            style={{ width: `${p.completionPercentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  {studentProgress.length === 0 && (
                    <p className="text-xs text-slate-400 italic">No progress data recorded yet.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="lg:col-span-2">
              <AnimatePresence mode="wait">
                {generating ? (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="h-full flex flex-col items-center justify-center text-center p-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200"
                  >
                    <div className="relative mb-6">
                      <Sparkles className="w-12 h-12 text-indigo-500 animate-pulse" />
                      <div className="absolute -top-2 -right-2">
                        <div className="w-4 h-4 bg-indigo-400 rounded-full animate-ping" />
                      </div>
                    </div>
                    <h4 className="text-xl font-serif font-medium text-slate-800 mb-2">Crafting the Narrative</h4>
                    <p className="text-slate-500 font-serif italic max-w-xs">
                      Our AI is analyzing {selectedStudent.displayName}'s journey to create a unique story of growth...
                    </p>
                  </motion.div>
                ) : story ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="h-full bg-white rounded-2xl p-8 border border-indigo-100 shadow-sm relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                      <Sparkles size={120} />
                    </div>
                    
                    <div className="relative z-10">
                      <div className="flex items-center gap-2 text-indigo-500 mb-6">
                        <TrendingUp size={20} />
                        <span className="text-xs uppercase tracking-widest font-bold">Growth Narrative</span>
                      </div>
                      
                      <div className="prose prose-indigo max-w-none">
                        <div className="whitespace-pre-wrap font-serif text-lg leading-relaxed text-slate-700 italic">
                          {story}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <Sparkles className="w-12 h-12 text-slate-300 mb-4" />
                    <h4 className="text-xl font-serif font-medium text-slate-400 mb-2">Ready to Discover</h4>
                    <p className="text-slate-400 font-serif italic max-w-xs">
                      Click "Generate Story" to see {selectedStudent.displayName}'s progress transformed into an inspiring narrative.
                    </p>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIStudentStory;
