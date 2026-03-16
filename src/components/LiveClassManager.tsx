import React, { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { LiveClass, UserProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Radio, Plus, X, Trash2, Play, Clock, Filter, Video } from 'lucide-react';
import LiveVideoPlayer from './LiveVideoPlayer';

interface LiveClassManagerProps {
  userProfile: UserProfile;
  selectedStandard: string;
  setSelectedStandard: (standard: string) => void;
}

import { sendStandardNotification } from '../services/notificationService';

export default function LiveClassManager({ userProfile, selectedStandard, setSelectedStandard }: LiveClassManagerProps) {
  const [classes, setClasses] = useState<LiveClass[]>([]);
  const [isScheduling, setIsScheduling] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeLiveClass, setActiveLiveClass] = useState<LiveClass | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    standard: '',
    subject: '',
    teacherName: userProfile.displayName || '',
    videoUrl: '',
    captionsUrl: ''
  });

  const canManage = userProfile.role === 'Admin' || userProfile.role === 'Leader';

  useEffect(() => {
    const q = query(collection(db, 'live_classes'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const classList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as LiveClass[];
      setClasses(classList);
    });
    return () => unsubscribe();
  }, []);

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.standard || !formData.subject) return;

    setLoading(true);
    try {
      await addDoc(collection(db, 'live_classes'), {
        ...formData,
        status: 'Scheduled',
        createdAt: serverTimestamp()
      });

      // Send notification for scheduled class
      await sendStandardNotification(`Standard ${formData.standard}`, {
        title: 'New Live Class Scheduled',
        message: `A new live class "${formData.title}" for ${formData.subject} has been scheduled.`,
        type: 'Live'
      });

      setIsScheduling(false);
      setFormData({
        title: '',
        standard: '',
        subject: '',
        teacherName: userProfile.displayName || '',
        videoUrl: '',
        captionsUrl: ''
      });
    } catch (error) {
      console.error("Error scheduling class:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleGoLive = async (classId: string) => {
    try {
      const classToLive = classes.find(c => c.id === classId);
      if (!classToLive) return;

      await updateDoc(doc(db, 'live_classes', classId), {
        status: 'Live'
      });

      setActiveLiveClass(classToLive);

      await sendStandardNotification(`Standard ${classToLive.standard}`, {
        title: 'Class is Live!',
        message: `The live class "${classToLive.title}" for ${classToLive.subject} is now live. Join now!`,
        type: 'Live'
      });
    } catch (error) {
      console.error("Error going live:", error);
    }
  };

  const handleEndClass = async (classId: string) => {
    try {
      await updateDoc(doc(db, 'live_classes', classId), {
        status: 'Ended'
      });
      setActiveLiveClass(null);
    } catch (error: any) {
      if (error.code === 'not-found') {
        console.warn("Class document already deleted or not found.");
        setActiveLiveClass(null);
      } else {
        console.error("Error ending class:", error);
      }
    }
  };

  const handleDelete = async (classId: string) => {
    if (!window.confirm('Are you sure you want to delete this class?')) return;
    try {
      await deleteDoc(doc(db, 'live_classes', classId));
    } catch (error) {
      console.error("Error deleting class:", error);
    }
  };

  const subjects = [
    'Mathematics', 'Science', 'English', 'Hindi', 'Social Studies', 
    'Computer Science', 'Physics', 'Chemistry', 'Biology'
  ];

  const filteredClasses = classes.filter(c => 
    selectedStandard === 'All Standards' || c.standard === selectedStandard
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <AnimatePresence>
        {activeLiveClass && (
          <LiveVideoPlayer 
            userProfile={userProfile} 
            liveClass={activeLiveClass} 
            onClose={() => canManage ? handleEndClass(activeLiveClass.id!) : setActiveLiveClass(null)} 
          />
        )}
      </AnimatePresence>

      <div className="flex justify-between items-center">
        <div>
          <div className="flex items-center gap-2 text-orange-600 mb-1">
            <Radio size={24} />
            <h1 className="text-2xl font-bold text-slate-800">Live Class</h1>
          </div>
          <p className="text-slate-500 text-sm">
            {filteredClasses.filter(c => c.status === 'Live').length} live classes
          </p>
        </div>
        <div className="flex items-center gap-4">
          {userProfile.role !== 'Student' && (
            <div className="relative">
              {/* Global standard selector is used instead */}
            </div>
          )}
          {canManage && (
            <button 
              onClick={() => setIsScheduling(true)}
              className="bg-orange-600 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-orange-700 transition-all shadow-lg shadow-orange-100"
            >
              <Plus size={20} />
              <span>Schedule Class</span>
            </button>
          )}
        </div>
      </div>

      {filteredClasses.length === 0 ? (
        <div className="bg-white rounded-[32px] p-12 border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
            <Radio size={40} className="text-slate-300" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">No Classes Yet</h2>
          <p className="text-slate-500 max-w-md mb-8">
            Schedule a class and go live with a single click
          </p>
          {canManage && (
            <button 
              onClick={() => setIsScheduling(true)}
              className="bg-orange-600 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-orange-700 transition-all"
            >
              <Plus size={20} />
              <span>Schedule First Class</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {filteredClasses.filter(c => c.status === 'Live').length > 0 && (
            <section>
              <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                Live Now
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredClasses.filter(c => c.status === 'Live').map(c => (
                  <motion.div 
                    key={c.id}
                    layoutId={c.id}
                    className="bg-white rounded-2xl p-6 border-2 border-red-500 shadow-xl shadow-red-50/50 relative overflow-hidden group"
                  >
                    <div className="absolute top-0 right-0 p-4">
                      <div className="bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-full animate-pulse">
                        LIVE
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center text-orange-500">
                        <Radio size={24} />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800">{c.title}</h3>
                        <p className="text-sm text-slate-500">{c.subject}</p>
                      </div>
                    </div>
                    <div className="space-y-2 mb-6">
                      <p className="text-xs text-slate-400 font-medium">Standard {c.standard} • {c.teacherName}</p>
                    </div>
                    <button 
                      onClick={() => setActiveLiveClass(c)}
                      className="w-full py-3 bg-red-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-red-700 transition-all shadow-lg shadow-red-100"
                    >
                      <Play size={18} fill="currentColor" />
                      Join Class
                    </button>
                  </motion.div>
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="text-lg font-bold text-slate-800 mb-4">Scheduled Classes</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredClasses.filter(c => c.status === 'Scheduled').map(c => (
                <motion.div 
                  key={c.id}
                  layoutId={c.id}
                  className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm relative group"
                >
                  {canManage && (
                    <button 
                      onClick={() => handleDelete(c.id)}
                      className="absolute top-4 right-4 p-2 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400">
                      <Radio size={24} />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800">{c.title}</h3>
                      <p className="text-sm text-slate-500">{c.subject}</p>
                    </div>
                  </div>
                  <div className="space-y-2 mb-6">
                    <p className="text-xs text-slate-400 font-medium">Standard {c.standard} • {c.teacherName}</p>
                  </div>
                  {c.status === 'Live' ? (
                    <button 
                      onClick={() => setActiveLiveClass(c)}
                      className="w-full py-3 bg-red-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-red-700 transition-all shadow-lg shadow-red-100"
                    >
                      <Play size={18} />
                      Join Class
                    </button>
                  ) : (
                    canManage && (
                      <button 
                        onClick={() => handleGoLive(c.id!)}
                        className="w-full py-3 bg-orange-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-orange-700 transition-all"
                      >
                        <Radio size={18} />
                        Go Live Now
                      </button>
                    )
                  )}
                </motion.div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* Schedule Modal */}
      <AnimatePresence>
        {isScheduling && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[32px] w-full max-w-lg p-8 shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="flex justify-between items-center mb-8 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center text-orange-500">
                    <Radio size={20} />
                  </div>
                  <h2 className="text-xl font-bold text-slate-800">Schedule a Live Class</h2>
                </div>
                <button onClick={() => setIsScheduling(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSchedule} className="space-y-6 overflow-y-auto pr-2 custom-scrollbar">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Class Title *</label>
                  <input 
                    required
                    type="text"
                    placeholder="e.g. Algebra - Chapter 5"
                    value={formData.title}
                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Standard *</label>
                    <select 
                      required
                      value={formData.standard}
                      onChange={e => setFormData({ ...formData, standard: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-orange-500 outline-none appearance-none bg-white"
                    >
                      <option value="">Select</option>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(s => (
                        <option key={s} value={`Standard ${s}`}>Standard {s}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Subject *</label>
                    <select 
                      required
                      value={formData.subject}
                      onChange={e => setFormData({ ...formData, subject: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-orange-500 outline-none appearance-none bg-white"
                    >
                      <option value="">Select</option>
                      {subjects.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Teacher Name *</label>
                  <input 
                    required
                    type="text"
                    placeholder="e.g. Mr. Ramesh"
                    value={formData.teacherName}
                    onChange={e => setFormData({ ...formData, teacherName: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Video URL (Direct or YouTube)</label>
                  <input 
                    type="url"
                    placeholder="https://youtube.com/watch?v=... or https://example.com/video.mp4"
                    value={formData.videoUrl}
                    onChange={e => setFormData({ ...formData, videoUrl: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Captions URL (.vtt)</label>
                  <input 
                    type="url"
                    placeholder="https://example.com/captions.vtt"
                    value={formData.captionsUrl}
                    onChange={e => setFormData({ ...formData, captionsUrl: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all"
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsScheduling(false)}
                    className="flex-1 py-3 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-3 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-all disabled:opacity-50"
                  >
                    {loading ? 'Scheduling...' : 'Schedule Class'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
