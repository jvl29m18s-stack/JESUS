import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Notification, UserProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, BookOpen, Calendar, Radio, MessageSquare, Info, X, Star } from 'lucide-react';

interface LiveToastContainerProps {
  userProfile: UserProfile;
}

interface ToastNotification extends Notification {
  visible: boolean;
}

export default function LiveToastContainer({ userProfile }: LiveToastContainerProps) {
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [lastProcessedTime, setLastProcessedTime] = useState<number>(Date.now());

  useEffect(() => {
    if (!userProfile.uid) return;

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Listen for new notifications in the last 24 hours
    const q = query(
      collection(db, 'notifications'),
      where('createdAt', '>=', twentyFourHoursAgo),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data() as Notification;
          
          // Filter logic: Show if target is 'all', or matches User's House/Standard, or is specifically for this User
          const isTargeted = data.userId === userProfile.uid || 
                             data.target === 'all' || 
                             data.target === userProfile.standard || 
                             data.target === userProfile.houseTeam;

          if (!isTargeted) return;

          const createdAt = data.createdAt as Timestamp;
          
          // Only show toast if it's new (created after component mounted or last processed)
          // and within the last 10 seconds to avoid stale toasts on reconnect
          const createdTime = createdAt?.toMillis() || Date.now();
          if (createdTime > lastProcessedTime && Date.now() - createdTime < 10000) {
            const newToast: ToastNotification = {
              id: change.doc.id,
              ...data,
              visible: true
            } as ToastNotification;

            setToasts(prev => [...prev, newToast]);
            
            // Auto remove after 6 seconds
            setTimeout(() => {
              removeToast(change.doc.id);
            }, 6000);
          }
        }
      });
      setLastProcessedTime(Date.now());
    });

    return () => unsubscribe();
  }, [userProfile.uid, userProfile.standard, userProfile.houseTeam]);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'Course': return <BookOpen size={20} className="text-blue-500" />;
      case 'Event': return <Calendar size={20} className="text-purple-500" />;
      case 'Live': return <Radio size={20} className="text-red-500" />;
      case 'Discussion': return <MessageSquare size={20} className="text-emerald-500" />;
      case 'Reward': return <Star size={20} className="text-amber-500 fill-amber-500" />;
      default: return <Bell size={20} className="text-indigo-500" />;
    }
  };

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-3 pointer-events-none w-full max-w-sm">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            layout
            initial={{ opacity: 0, x: 100, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.9 }}
            className="pointer-events-auto bg-white rounded-2xl shadow-2xl border-l-4 border-indigo-500 p-4 flex gap-4 items-start relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={() => removeToast(toast.id)}
                className="p-1 hover:bg-slate-100 rounded-full text-slate-400"
              >
                <X size={14} />
              </button>
            </div>

            <div className="shrink-0 w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center">
              {getIcon(toast.type)}
            </div>

            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-black text-slate-800 tracking-tight mb-0.5">{toast.title}</h4>
              <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{toast.message}</p>
              <div className="mt-2 h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: '100%' }}
                  animate={{ width: '0%' }}
                  transition={{ duration: 6, ease: 'linear' }}
                  className="h-full bg-indigo-500/30"
                />
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
