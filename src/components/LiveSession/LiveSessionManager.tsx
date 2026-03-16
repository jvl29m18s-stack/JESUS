import React, { useState, useEffect } from 'react';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp, 
  deleteDoc, 
  doc, 
  setDoc,
  updateDoc 
} from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { UserProfile } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { Radio, Plus, X, Trash2, Play, Clock, Video, Users, Shield, Megaphone } from 'lucide-react';

interface LiveSessionManagerProps {
  userProfile: UserProfile;
}

export default function LiveSessionManager({ userProfile }: LiveSessionManagerProps) {
  const [isStarting, setIsStarting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentSession, setCurrentSession] = useState<any>(null);
  const [formData, setFormData] = useState({
    title: '',
    type: 'class' as 'class' | 'telecast',
    standard: 'All Standards'
  });

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'sessions', 'current_live'), (docSnap) => {
      if (docSnap.exists()) {
        setCurrentSession({ id: docSnap.id, ...docSnap.data() });
      } else {
        setCurrentSession(null);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleStartSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title) return;

    setLoading(true);
    try {
      const channelName = `room_${Math.random().toString(36).substring(7)}`;
      await setDoc(doc(db, 'sessions', 'current_live'), {
        title: formData.title,
        type: formData.type,
        standard: formData.standard,
        status: 'active',
        channelName,
        startedBy: auth.currentUser?.uid,
        startedByName: userProfile.displayName,
        startTime: serverTimestamp()
      });

      setIsStarting(false);
      setFormData({
        title: '',
        type: 'class',
        standard: 'All Standards'
      });
    } catch (error) {
      console.error("Error starting session:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEndSession = async () => {
    if (!window.confirm('Are you sure you want to end the current live session?')) return;
    try {
      await deleteDoc(doc(db, 'sessions', 'current_live'));
    } catch (error) {
      console.error("Error ending session:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Radio className="text-red-500" size={20} />
            Live Session Control
          </h2>
          <p className="text-sm text-slate-500">Manage real-time classes and telecasts</p>
        </div>
        {!currentSession && (
          <button 
            onClick={() => setIsStarting(true)}
            className="bg-red-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-red-700 transition-all shadow-lg shadow-red-100"
          >
            <Plus size={18} />
            Start New Session
          </button>
        )}
      </div>

      {currentSession ? (
        <div className="bg-white rounded-2xl p-6 border-2 border-red-500 shadow-xl shadow-red-50 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4">
            <div className="bg-red-500 text-white text-[10px] font-black px-2 py-1 rounded-full animate-pulse uppercase tracking-widest">
              LIVE NOW
            </div>
          </div>
          
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center text-red-500">
              {currentSession.type === 'class' ? <Users size={24} /> : <Megaphone size={24} />}
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-lg">{currentSession.title}</h3>
              <p className="text-sm text-slate-500 capitalize">{currentSession.type} • {currentSession.standard}</p>
            </div>
          </div>

          <div className="flex gap-3">
            <button 
              className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-200 transition-all"
              disabled
            >
              <Users size={18} />
              Monitoring...
            </button>
            <button 
              onClick={handleEndSession}
              className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-red-700 transition-all shadow-lg shadow-red-100"
            >
              <X size={18} />
              End Session
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 rounded-2xl p-12 border border-dashed border-slate-300 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm">
            <Radio size={32} className="text-slate-300" />
          </div>
          <h3 className="font-bold text-slate-700">No Active Session</h3>
          <p className="text-sm text-slate-400 max-w-xs mt-1">Start a live session to broadcast to all students and leaders.</p>
        </div>
      )}

      <AnimatePresence>
        {isStarting && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[32px] w-full max-w-md p-8 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-bold text-slate-800">Start Live Session</h2>
                <button onClick={() => setIsStarting(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleStartSession} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Session Title</label>
                  <input 
                    required
                    type="text"
                    placeholder="e.g. Morning Assembly or Math Class"
                    value={formData.title}
                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Type</label>
                    <select 
                      value={formData.type}
                      onChange={e => setFormData({ ...formData, type: e.target.value as any })}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-red-500 outline-none bg-white"
                    >
                      <option value="class">Live Class</option>
                      <option value="telecast">Telecast</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Target Audience</label>
                    <select 
                      value={formData.standard}
                      onChange={e => setFormData({ ...formData, standard: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-red-500 outline-none bg-white"
                    >
                      <option value="All Standards">All Standards</option>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(s => (
                        <option key={s} value={`Standard ${s}`}>Standard {s}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsStarting(false)}
                    className="flex-1 py-3 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all disabled:opacity-50 shadow-lg shadow-red-100"
                  >
                    {loading ? 'Starting...' : 'Go Live Now'}
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
