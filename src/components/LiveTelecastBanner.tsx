import React, { useState, useEffect } from 'react';
import { Radio, Zap, ChevronRight, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { LiveTelecast, UserProfile } from '../types';

interface LiveTelecastBannerProps {
  userProfile: UserProfile;
  onJoin: (telecast: LiveTelecast) => void;
}

export default function LiveTelecastBanner({ userProfile, onJoin }: LiveTelecastBannerProps) {
  const [activeTelecast, setActiveTelecast] = useState<LiveTelecast | null>(null);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'live_telecasts'),
      where('status', '==', 'Live'),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const data = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as LiveTelecast;
        
        // Check if telecast is for all or user's standard
        const isTargeted = !data.standard || data.standard === 'All Standards' || data.standard === userProfile.standard;
        
        if (isTargeted) {
          setActiveTelecast(data);
          setIsVisible(true);
        } else {
          setActiveTelecast(null);
        }
      } else {
        setActiveTelecast(null);
      }
    });

    return () => unsubscribe();
  }, [userProfile.standard]);

  if (!activeTelecast || !isVisible) return null;

  return (
    <motion.div 
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      className="bg-rose-600 text-white relative overflow-hidden shrink-0"
    >
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 overflow-hidden">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center animate-pulse shrink-0">
            <Radio size={20} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="px-1.5 py-0.5 bg-white text-rose-600 text-[8px] font-black rounded uppercase tracking-wider shrink-0">Live Now</span>
              <h4 className="font-bold text-sm truncate">{activeTelecast.title}</h4>
            </div>
            <p className="text-[10px] text-white/70 truncate">Broadcasting from the Institution Command Center</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button 
            onClick={() => onJoin(activeTelecast)}
            className="px-4 py-2 bg-white text-rose-600 rounded-xl text-xs font-black hover:bg-rose-50 transition-all flex items-center gap-2 shadow-lg"
          >
            Join Telecast
            <ChevronRight size={14} />
          </button>
          <button 
            onClick={() => setIsVisible(false)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>
      
      {/* Animated background element */}
      <motion.div 
        animate={{ x: ['-100%', '100%'] }}
        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        className="absolute bottom-0 left-0 h-0.5 w-full bg-gradient-to-r from-transparent via-white/40 to-transparent"
      />
    </motion.div>
  );
}
