import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { HallOfFameEntry } from '../types';
import { motion } from 'motion/react';
import { Trophy, Sparkles, ChevronRight, Star } from 'lucide-react';

interface CurrentAchieversBannerProps {
  onViewHallOfFame?: () => void;
}

export default function CurrentAchieversBanner({ onViewHallOfFame }: CurrentAchieversBannerProps) {
  const [latestWinner, setLatestWinner] = useState<HallOfFameEntry | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'hall_of_fame'), orderBy('timestamp', 'desc'), limit(1));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setLatestWinner({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as HallOfFameEntry);
      }
    });

    return () => unsubscribe();
  }, []);

  if (!latestWinner) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8 relative group cursor-pointer"
      onClick={onViewHallOfFame}
    >
      <div className="absolute -inset-1 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 rounded-3xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
      <div className="relative bg-white rounded-3xl p-4 md:p-6 border border-amber-100 shadow-sm flex items-center justify-between overflow-hidden">
        <div className="flex items-center gap-4 md:gap-6">
          <div className="w-12 h-12 md:w-16 md:h-16 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500 shadow-inner group-hover:scale-110 transition-transform">
            <Trophy size={24} className="md:hidden" />
            <Trophy size={32} className="hidden md:block" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[10px] font-black uppercase tracking-widest">
                {latestWinner.type === 'Monthly' ? 'Monthly' : 'Annual'} Champion
              </span>
              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                {latestWinner.period}
              </span>
            </div>
            <div className="flex flex-col">
              <h3 className="text-lg md:text-2xl font-black text-slate-800 tracking-tight leading-tight">
                {latestWinner.winnerHouse}
              </h3>
              {latestWinner.studentOfMonth && (
                <div className="flex items-center gap-2 text-amber-600 font-bold text-xs md:text-sm">
                  <Star size={14} className="fill-amber-500" />
                  <span>{latestWinner.studentOfMonth}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:block text-right">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Winning Score</div>
            <div className="text-lg font-black text-amber-600">{latestWinner.totalPoints.toLocaleString()} pts</div>
          </div>
          <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-amber-500 group-hover:text-white transition-all">
            <ChevronRight size={20} />
          </div>
        </div>

        {/* Decorative Sparkles */}
        <div className="absolute top-0 right-1/4 opacity-20 pointer-events-none">
          <Sparkles size={40} className="text-amber-400 animate-pulse" />
        </div>
      </div>
    </motion.div>
  );
}
