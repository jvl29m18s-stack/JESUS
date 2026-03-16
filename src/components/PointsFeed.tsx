import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import { db } from '../firebase';
import { RewardHistory } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Star, Trophy, CreditCard, Heart, GraduationCap, Shield, User } from 'lucide-react';

export default function PointsFeed() {
  const [feed, setFeed] = useState<RewardHistory[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, 'reward_history'),
      orderBy('timestamp', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as RewardHistory[];
      setFeed(items);
    });

    return () => unsubscribe();
  }, []);

  const getIcon = (role: string, type: string) => {
    if (role === 'Alumni') return <GraduationCap size={14} className="text-indigo-500" />;
    if (role === 'Admin') return <Shield size={14} className="text-rose-500" />;
    if (role === 'Leader') return <Star size={14} className="text-amber-500" />;
    return <User size={14} className="text-slate-400" />;
  };

  const getPrefix = (role: string) => {
    if (role === 'Alumni') return '🎓 Alumnus';
    if (role === 'Admin') return '👑 Admin';
    if (role === 'Leader') return '⭐ Leader';
    return '👤 User';
  };

  return (
    <div className="space-y-4 overflow-y-auto max-h-[600px] pr-2 custom-scrollbar">
      <AnimatePresence initial={false}>
        {feed.map((item) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex gap-3 items-start hover:bg-white hover:shadow-md transition-all group"
          >
            <div className="mt-1 p-2 bg-white rounded-xl shadow-sm group-hover:scale-110 transition-transform">
              {getIcon(item.senderRole, item.type)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {getPrefix(item.senderRole)}
                </span>
                <span className="text-[10px] text-slate-300">•</span>
                <span className="text-[10px] font-bold text-slate-400">
                  {item.timestamp?.toDate ? new Date(item.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                </span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">
                <span className="font-bold text-slate-900">{item.senderName.replace('Alumnus: ', '')}</span>
                {' awarded '}
                <span className="font-bold text-indigo-600">
                  {item.type === 'card' ? `${item.value} Card` : `${item.points} points`}
                </span>
                {' to '}
                <span className="font-bold text-slate-900">{item.recipientName}</span>
              </p>
              {item.reason && (
                <p className="text-[10px] text-slate-500 italic mt-1 line-clamp-1">
                  "{item.reason}"
                </p>
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
      
      {feed.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-slate-400 text-sm italic">No recent awards in the feed.</p>
        </div>
      )}
    </div>
  );
}
