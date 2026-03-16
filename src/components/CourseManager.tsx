import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, where, onSnapshot, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Course, UserProfile, Assignment } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, BookOpen, Trash2, Edit3, List, Target, AlertCircle, CheckCircle2, Clock, Flag } from 'lucide-react';

interface CourseManagerProps {
  userProfile: UserProfile;
}

import { sendStandardNotification } from '../services/notificationService';

export default function CourseManager({ userProfile }: CourseManagerProps) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [selectedCourseForAssignments, setSelectedCourseForAssignments] = useState<Course | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isAddingAssignment, setIsAddingAssignment] = useState(false);
  const [loading, setLoading] = useState(true);

  // Assignment form state
  const [assignmentFormData, setAssignmentFormData] = useState({
    title: '',
    description: '',
    dueDate: '',
    points: 10,
    priority: 'Medium' as 'High' | 'Medium' | 'Low'
  });

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    subject: '',
    standard: '',
    prerequisites: '',
    learningObjectives: ''
  });

  useEffect(() => {
    const q = query(collection(db, 'courses'), where('teacherId', '==', userProfile.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const courseList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Course[];
      setCourses(courseList);
      setLoading(false);
    });

    const unsubscribeAssignments = onSnapshot(collection(db, 'assignments'), (snapshot) => {
      const assignmentList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Assignment[];
      setAssignments(assignmentList);
    });

    return () => {
      unsubscribe();
      unsubscribeAssignments();
    };
  }, [userProfile.uid]);

  const handleAddAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseForAssignments) return;

    try {
      await addDoc(collection(db, 'assignments'), {
        ...assignmentFormData,
        courseId: selectedCourseForAssignments.id,
        createdAt: serverTimestamp()
      });

      // Send notification to students of this standard
      await sendStandardNotification(`Standard ${selectedCourseForAssignments.standard}`, {
        title: 'New Assignment!',
        message: `A new assignment "${assignmentFormData.title}" has been posted for ${selectedCourseForAssignments.title}.`,
        type: 'Course'
      });

      setIsAddingAssignment(false);
      setAssignmentFormData({ title: '', description: '', dueDate: '', points: 10, priority: 'Medium' });
    } catch (error) {
      console.error("Error adding assignment:", error);
    }
  };

  const handleDeleteAssignment = async (id: string) => {
    if (window.confirm('Delete this assignment?')) {
      await deleteDoc(doc(db, 'assignments', id));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const courseData = {
        ...formData,
        prerequisites: formData.prerequisites.split(',').map(p => p.trim()).filter(p => p),
        learningObjectives: formData.learningObjectives.split(',').map(o => o.trim()).filter(o => o),
        teacherId: userProfile.uid,
        teacherName: userProfile.displayName,
        createdAt: serverTimestamp()
      };

      if (editingCourse) {
        await updateDoc(doc(db, 'courses', editingCourse.id), courseData);
      } else {
        await addDoc(collection(db, 'courses'), courseData);
        
        // Send notification to students of this standard
        await sendStandardNotification(`Standard ${formData.standard}`, {
          title: 'New Course Material',
          message: `New course "${formData.title}" has been added for ${formData.subject}.`,
          type: 'Course'
        });
      }

      setIsAdding(false);
      setEditingCourse(null);
      setFormData({ title: '', description: '', subject: '', standard: '', prerequisites: '', learningObjectives: '' });
    } catch (error) {
      console.error("Error saving course:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this course?')) {
      await deleteDoc(doc(db, 'courses', id));
    }
  };

  const startEdit = (course: Course) => {
    setEditingCourse(course);
    setFormData({
      title: course.title,
      description: course.description,
      subject: course.subject,
      standard: course.standard,
      prerequisites: course.prerequisites?.join(', ') || '',
      learningObjectives: course.learningObjectives?.join(', ') || ''
    });
    setIsAdding(true);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Course Management</h1>
          <p className="text-slate-500 text-sm">Create and manage your academic courses</p>
        </div>
        <button
          onClick={() => {
            setIsAdding(true);
            setEditingCourse(null);
            setFormData({ title: '', description: '', subject: '', standard: '', prerequisites: '', learningObjectives: '' });
          }}
          className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
        >
          <Plus size={20} />
          Create Course
        </button>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-xl flex flex-col max-h-[90vh]"
          >
            <div className="flex justify-between items-center mb-6 shrink-0">
              <h2 className="text-xl font-bold text-slate-800">{editingCourse ? 'Edit Course' : 'Create Course'}</h2>
              <button onClick={() => setIsAdding(false)} className="text-slate-400 hover:text-slate-600">
                <Plus size={24} className="rotate-45" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6 overflow-y-auto pr-2 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Course Title</label>
                  <input
                    required
                    value={formData.title}
                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                    className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-blue-500 transition-all"
                    placeholder="e.g. Advanced Mathematics"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Subject</label>
                  <input
                    required
                    value={formData.subject}
                    onChange={e => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-blue-500 transition-all"
                    placeholder="e.g. Mathematics"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Target Standard</label>
                  <select
                    required
                    value={formData.standard}
                    onChange={e => setFormData({ ...formData, standard: e.target.value })}
                    className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-blue-500 transition-all"
                  >
                    <option value="">Select Standard</option>
                    {[6, 7, 8, 9, 10, 11, 12].map(s => (
                      <option key={s} value={s.toString()}>Standard {s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Description</label>
                <textarea
                  required
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-blue-500 transition-all h-32"
                  placeholder="Detailed course description..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <List size={14} /> Prerequisites (comma separated)
                  </label>
                  <input
                    value={formData.prerequisites}
                    onChange={e => setFormData({ ...formData, prerequisites: e.target.value })}
                    className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-blue-500 transition-all"
                    placeholder="e.g. Basic Algebra, Geometry"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Target size={14} /> Learning Objectives (comma separated)
                  </label>
                  <input
                    value={formData.learningObjectives}
                    onChange={e => setFormData({ ...formData, learningObjectives: e.target.value })}
                    className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-blue-500 transition-all"
                    placeholder="e.g. Master Calculus, Understand Limits"
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-bold hover:bg-blue-700 transition-all"
                >
                  {editingCourse ? 'Update Course' : 'Create Course'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-8 py-4 rounded-2xl font-bold text-slate-500 hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {courses.map(course => (
          <motion.div
            key={course.id}
            layout
            className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden group"
          >
            <div className="p-8">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-500">
                  <BookOpen size={24} />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => startEdit(course)}
                    className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                  >
                    <Edit3 size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(course.id)}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">{course.title}</h3>
              <p className="text-slate-500 text-sm line-clamp-2 mb-4">{course.description}</p>
              
              <div className="flex flex-wrap gap-2 mb-6">
                <span className="px-3 py-1 bg-slate-50 text-slate-500 rounded-full text-[10px] font-bold uppercase tracking-wider">
                  {course.subject}
                </span>
                <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-bold uppercase tracking-wider">
                  Std {course.standard}
                </span>
              </div>

              {course.learningObjectives && course.learningObjectives.length > 0 && (
                <div className="space-y-2 mb-6">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Learning Objectives</h4>
                  <div className="space-y-1">
                    {course.learningObjectives.slice(0, 2).map((obj, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
                        <CheckCircle2 size={12} className="text-emerald-500" />
                        {obj}
                      </div>
                    ))}
                    {course.learningObjectives.length > 2 && (
                      <div className="text-[10px] text-slate-400 italic">+{course.learningObjectives.length - 2} more</div>
                    )}
                  </div>
                </div>
              )}

              <div className="pt-6 border-t border-slate-50 space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Assignments</h4>
                  <button 
                    onClick={() => {
                      setSelectedCourseForAssignments(course);
                      setIsAddingAssignment(true);
                    }}
                    className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <Plus size={10} /> Add New
                  </button>
                </div>
                
                <div className="space-y-2">
                  {assignments.filter(a => a.courseId === course.id).map(assignment => (
                    <div key={assignment.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl group/item">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${
                          assignment.priority === 'High' ? 'bg-red-500' :
                          assignment.priority === 'Medium' ? 'bg-amber-500' :
                          'bg-blue-500'
                        }`} />
                        <div>
                          <div className="text-xs font-bold text-slate-800">{assignment.title}</div>
                          <div className="text-[9px] text-slate-400 flex items-center gap-1">
                            <Clock size={8} /> {assignment.dueDate}
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleDeleteAssignment(assignment.id)}
                        className="p-1.5 text-slate-300 hover:text-red-500 opacity-0 group-hover/item:opacity-100 transition-all"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                  {assignments.filter(a => a.courseId === course.id).length === 0 && (
                    <div className="text-[10px] text-slate-400 italic text-center py-2">No assignments yet</div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Add Assignment Modal */}
      <AnimatePresence>
        {isAddingAssignment && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[32px] w-full max-w-md p-8 shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="flex justify-between items-center mb-6 shrink-0">
                <h2 className="text-xl font-bold text-slate-800">Add Assignment</h2>
                <button onClick={() => setIsAddingAssignment(false)} className="text-slate-400 hover:text-slate-600">
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>

              <form onSubmit={handleAddAssignment} className="space-y-4 overflow-y-auto pr-2 custom-scrollbar">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Title</label>
                  <input
                    required
                    value={assignmentFormData.title}
                    onChange={e => setAssignmentFormData({ ...assignmentFormData, title: e.target.value })}
                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm"
                    placeholder="e.g. Weekly Quiz 1"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Due Date</label>
                  <input
                    required
                    type="date"
                    value={assignmentFormData.dueDate}
                    onChange={e => setAssignmentFormData({ ...assignmentFormData, dueDate: e.target.value })}
                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Points</label>
                    <input
                      required
                      type="number"
                      value={assignmentFormData.points}
                      onChange={e => setAssignmentFormData({ ...assignmentFormData, points: parseInt(e.target.value) })}
                      className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Priority</label>
                    <select
                      value={assignmentFormData.priority}
                      onChange={e => setAssignmentFormData({ ...assignmentFormData, priority: e.target.value as any })}
                      className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm"
                    >
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Description</label>
                  <textarea
                    value={assignmentFormData.description}
                    onChange={e => setAssignmentFormData({ ...assignmentFormData, description: e.target.value })}
                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm h-24 resize-none"
                    placeholder="Assignment instructions..."
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                >
                  Create Assignment
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {courses.length === 0 && !loading && (
        <div className="text-center py-20 bg-slate-50 rounded-[32px] border-2 border-dashed border-slate-200">
          <BookOpen size={48} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-bold text-slate-800">No courses yet</h3>
          <p className="text-slate-500">Start by creating your first academic course</p>
        </div>
      )}
    </div>
  );
}
