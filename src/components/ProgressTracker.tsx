import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, getDoc, setDoc, updateDoc, arrayUnion, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Course, UserProfile, Assignment, Progress } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Circle, BookOpen, Trophy, Clock, ChevronRight, BarChart2, Users, Search } from 'lucide-react';

interface ProgressTrackerProps {
  userProfile: UserProfile;
}

export default function ProgressTracker({ userProfile }: ProgressTrackerProps) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [allStudents, setAllStudents] = useState<UserProfile[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>(userProfile.uid);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const isAdmin = userProfile.role === 'Admin' || userProfile.role === 'Leader';

  useEffect(() => {
    // Fetch courses
    const qCourses = isAdmin 
      ? query(collection(db, 'courses'))
      : query(collection(db, 'courses'), where('standard', '==', userProfile.standard));
    
    const unsubscribeCourses = onSnapshot(qCourses, (snapshot) => {
      const courseList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Course[];
      setCourses(courseList);
    });

    // Fetch assignments
    const unsubscribeAssignments = onSnapshot(collection(db, 'assignments'), (snapshot) => {
      const assignmentList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Assignment[];
      setAssignments(assignmentList);
    });

    // Fetch progress for selected student
    const qProgress = query(collection(db, 'progress'), where('studentId', '==', selectedStudentId));
    const unsubscribeProgress = onSnapshot(qProgress, (snapshot) => {
      const progressList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Progress[];
      setProgress(progressList);
      setLoading(false);
    });

    // Fetch all students if admin
    let unsubscribeStudents = () => {};
    if (isAdmin) {
      const qStudents = query(collection(db, 'users'), where('role', 'in', ['Student', 'Leader']));
      unsubscribeStudents = onSnapshot(qStudents, (snapshot) => {
        const studentList = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })) as UserProfile[];
        setAllStudents(studentList);
      });
    }

    return () => {
      unsubscribeCourses();
      unsubscribeAssignments();
      unsubscribeProgress();
      unsubscribeStudents();
    };
  }, [userProfile.standard, selectedStudentId, isAdmin]);

  const toggleAssignment = async (courseId: string, assignmentId: string) => {
    // Only students can toggle their own assignments
    if (selectedStudentId !== userProfile.uid) return;

    const existingProgress = progress.find(p => p.courseId === courseId);
    
    try {
      if (existingProgress) {
        const isCompleted = existingProgress.completedAssignments.includes(assignmentId);
        const newCompleted = isCompleted 
          ? existingProgress.completedAssignments.filter(id => id !== assignmentId)
          : [...existingProgress.completedAssignments, assignmentId];
        
        await updateDoc(doc(db, 'progress', existingProgress.id), {
          completedAssignments: newCompleted,
          lastAccessed: new Date()
        });
      } else {
        const newProgressRef = doc(collection(db, 'progress'));
        await setDoc(newProgressRef, {
          studentId: userProfile.uid,
          courseId,
          completedAssignments: [assignmentId],
          lastAccessed: new Date()
        });
      }
    } catch (error) {
      console.error("Error updating progress:", error);
    }
  };

  const getCourseProgress = (courseId: string) => {
    const courseAssignments = assignments.filter(a => a.courseId === courseId);
    const courseProgress = progress.find(p => p.courseId === courseId);
    
    if (courseAssignments.length === 0) return 0;
    const completedCount = courseProgress?.completedAssignments.length || 0;
    return Math.round((completedCount / courseAssignments.length) * 100);
  };

  const filteredStudents = allStudents.filter(s => 
    s.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.standard?.includes(searchQuery)
  );

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Learning Progress</h1>
          <p className="text-slate-500 text-sm">
            {isAdmin ? "Monitor student course completion" : "Track your course completion and assignments"}
          </p>
        </div>
        
        {isAdmin && (
          <div className="relative w-full md:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search students..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-100 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {isAdmin && (
          <div className="lg:col-span-1 space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Users size={14} /> Students
            </h3>
            <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden max-h-[600px] overflow-y-auto custom-scrollbar">
              {filteredStudents.map(student => (
                <button
                  key={student.uid}
                  onClick={() => setSelectedStudentId(student.uid)}
                  className={`w-full flex items-center gap-3 p-4 transition-all border-b border-slate-50 last:border-0 ${
                    selectedStudentId === student.uid ? 'bg-blue-50 text-blue-600' : 'hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-white border border-slate-100 flex items-center justify-center font-bold text-xs">
                    {student.displayName.charAt(0)}
                  </div>
                  <div className="text-left min-w-0">
                    <div className="text-sm font-bold truncate">{student.displayName}</div>
                    <div className="text-[10px] opacity-60">Std {student.standard} • {student.houseTeam}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className={`${isAdmin ? 'lg:col-span-3' : 'lg:col-span-4'} space-y-8`}>
          {isAdmin && selectedStudentId !== userProfile.uid && (
            <div className="bg-blue-600 rounded-[32px] p-8 text-white shadow-xl shadow-blue-100">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center text-3xl font-black">
                  {allStudents.find(s => s.uid === selectedStudentId)?.displayName.charAt(0)}
                </div>
                <div>
                  <h2 className="text-2xl font-bold">{allStudents.find(s => s.uid === selectedStudentId)?.displayName}</h2>
                  <p className="opacity-80">Viewing progress for Standard {allStudents.find(s => s.uid === selectedStudentId)?.standard}</p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {courses.length === 0 ? (
              <div className="md:col-span-2 text-center py-20 bg-slate-50 rounded-[32px] border-2 border-dashed border-slate-200">
                <BookOpen size={48} className="mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-bold text-slate-800">No courses available</h3>
                <p className="text-slate-500">Courses for this standard will appear here</p>
              </div>
            ) : (
              courses.map(course => {
                const courseAssignments = assignments.filter(a => a.courseId === course.id);
                const courseProgress = progress.find(p => p.courseId === course.id);
                const percentage = getCourseProgress(course.id);

                return (
                  <motion.div
                    key={course.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden"
                  >
                    <div className="p-8 border-b border-slate-50">
                      <div className="flex justify-between items-start mb-6">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-500">
                            <BookOpen size={28} />
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-slate-800">{course.title}</h3>
                            <p className="text-slate-400 text-sm">{course.teacherName}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-black text-blue-600">{percentage}%</div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Complete</div>
                        </div>
                      </div>
                      
                      <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          className="h-full bg-blue-500 rounded-full"
                        />
                      </div>
                    </div>

                    <div className="p-8 space-y-4">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <BarChart2 size={14} /> Assignments ({courseAssignments.length})
                      </h4>
                      <div className="space-y-3">
                        {courseAssignments.map(assignment => {
                          const isCompleted = courseProgress?.completedAssignments.includes(assignment.id);
                          return (
                            <div
                              key={assignment.id}
                              className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                                selectedStudentId === userProfile.uid ? 'cursor-pointer' : 'cursor-default'
                              } ${
                                isCompleted ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100 hover:border-blue-200'
                              }`}
                              onClick={() => toggleAssignment(course.id, assignment.id)}
                            >
                              <div className="flex items-center gap-4">
                                {isCompleted ? (
                                  <CheckCircle2 className="text-emerald-500" size={20} />
                                ) : (
                                  <Circle className="text-slate-300" size={20} />
                                )}
                                <div>
                                  <div className={`text-sm font-bold ${isCompleted ? 'text-emerald-700 line-through' : 'text-slate-800'}`}>
                                    {assignment.title}
                                  </div>
                                  <div className="text-[10px] text-slate-400 flex items-center gap-2">
                                    <Clock size={10} /> Due: {assignment.dueDate}
                                    <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase ${
                                      assignment.priority === 'High' ? 'bg-red-100 text-red-600' :
                                      assignment.priority === 'Medium' ? 'bg-amber-100 text-amber-600' :
                                      'bg-blue-100 text-blue-600'
                                    }`}>
                                      {assignment.priority}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="text-xs font-bold text-slate-400">
                                {assignment.points} pts
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
