import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot 
} from 'firebase/firestore';
import { db } from '../firebase';
import { HallOfFameEntry } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Award, Medal, Star, Calendar, History, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';
import { handleFirestoreError, OperationType } from '../firestoreErrorHandler';

const HOUSE_CONFIG = {
  'GOOD PIONEER': { color: '#3b82f6', icon: '🚀', glow: 'shadow-blue-200' },
  'GOOD PATRON': { color: '#ef4444', icon: '🛡️', glow: 'shadow-red-200' },
  'GOOD SAVIOUR': { color: '#f59e0b', icon: '🌟', glow: 'shadow-amber-200' },
  'GOOD SHEPHERD': { color: '#10b981', icon: '🌿', glow: 'shadow-emerald-200' }
};

export default function HallOfFame() {
  const [entries, setEntries] = useState<HallOfFameEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'hall_of_fame'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as HallOfFameEntry[];
      
      // If a new entry was added, trigger confetti
      if (entries.length > 0 && list.length > entries.length) {
        triggerCelebration();
      }
      
      setEntries(list);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'hall_of_fame');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [entries.length]);

  const triggerCelebration = () => {
    const duration = 5 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
    }, 250);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div>
      </div>
    );
  }

  const yearlyWinners = entries.filter(e => e.type === 'Yearly');
  const monthlyWinners = entries.filter(e => e.type === 'Monthly');

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="text-center mb-16">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="inline-block p-4 bg-amber-50 rounded-3xl mb-6"
        >
          <Trophy className="text-amber-500 w-12 h-12" />
        </motion.div>
        <h1 className="text-5xl font-black text-slate-800 mb-4 tracking-tight">Hall of Fame</h1>
        <p className="text-slate-500 text-lg max-w-2xl mx-auto font-medium">
          Celebrating the legendary houses that have etched their names in the history of Good Samaritan.
        </p>
      </div>

      {/* Yearly Winners - Featured Section */}
      {yearlyWinners.length > 0 && (
        <section className="mb-20">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center text-white">
              <History size={20} />
            </div>
            <h2 className="text-2xl font-black text-slate-800">Houses of the Year</h2>
          </div>
          
          <div className="grid grid-cols-1 gap-8">
            {yearlyWinners.map((winner, idx) => (
              <motion.div
                key={winner.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="relative group"
              >
                <div className="absolute -inset-1 bg-gradient-to-r from-amber-400 to-yellow-400 rounded-[40px] blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                <div className="relative bg-white rounded-[40px] p-8 md:p-12 border border-amber-100 shadow-xl flex flex-col md:flex-row items-center gap-8 overflow-hidden">
                  <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
                    <Trophy size={240} />
                  </div>
                  
                  <div className="w-32 h-32 md:w-48 md:h-48 bg-amber-50 rounded-[40px] flex items-center justify-center text-6xl md:text-8xl shadow-inner relative">
                    <div className="absolute -top-4 -right-4 bg-amber-500 text-white p-3 rounded-2xl shadow-lg">
                      <Trophy size={24} />
                    </div>
                    {HOUSE_CONFIG[winner.winnerHouse as keyof typeof HOUSE_CONFIG]?.icon || '🏆'}
                  </div>

                  <div className="flex-1 text-center md:text-left">
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-4">
                      <span className="px-4 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-black uppercase tracking-widest">
                        Annual Champion
                      </span>
                      <span className="text-slate-400 font-bold flex items-center gap-1">
                        <Calendar size={14} />
                        {winner.period}
                      </span>
                    </div>
                    <h3 className="text-4xl md:text-6xl font-black text-slate-800 mb-4">{winner.winnerHouse}</h3>
                    {winner.studentOfMonth && (
                      <div className="flex items-center gap-3 mb-6 p-4 bg-amber-50 rounded-2xl border border-amber-100 inline-flex">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-amber-500 shadow-sm">
                          <Star size={20} className="fill-amber-500" />
                        </div>
                        <div>
                          <div className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Student of the Year</div>
                          <div className="text-lg font-black text-slate-800">{winner.studentOfMonth}</div>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-center md:justify-start gap-8">
                      <div>
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Points</div>
                        <div className="text-3xl font-black text-amber-600">{winner.totalPoints.toLocaleString()}</div>
                      </div>
                      <div className="w-px h-12 bg-slate-100" />
                      <div>
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</div>
                        <div className="text-xl font-bold text-slate-700 flex items-center gap-2">
                          <Sparkles size={18} className="text-amber-400" />
                          Legendary
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Monthly Winners - Grid Section */}
      <section>
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white">
            <Award size={20} />
          </div>
          <h2 className="text-2xl font-black text-slate-800">Monthly Champions</h2>
        </div>

        {monthlyWinners.length === 0 ? (
          <div className="bg-slate-50 rounded-[40px] border-2 border-dashed border-slate-200 p-12 text-center">
            <Medal size={48} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-400 font-bold">The first monthly champion is yet to be crowned.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {monthlyWinners.map((winner, idx) => (
              <motion.div
                key={winner.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.05 }}
                whileHover={{ y: -8 }}
                className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm hover:shadow-xl transition-all group"
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                    {HOUSE_CONFIG[winner.winnerHouse as keyof typeof HOUSE_CONFIG]?.icon || '🏅'}
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Points</div>
                    <div className="text-xl font-black text-slate-800">{winner.totalPoints.toLocaleString()}</div>
                  </div>
                </div>

                <div className="mb-6">
                  <div className="text-xs font-bold text-blue-500 mb-1">{winner.period}</div>
                  <h4 className="text-2xl font-black text-slate-800">{winner.winnerHouse.split(' ')[1]}</h4>
                </div>

                {winner.studentOfMonth && (
                  <div className="flex items-center gap-3 mb-6 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-amber-500 shadow-sm">
                      <Star size={16} className="fill-amber-500" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Student of the Month</div>
                      <div className="text-sm font-black text-slate-800 truncate">{winner.studentOfMonth}</div>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-6 border-t border-slate-50">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Monthly Winner</span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* Hall of Fame Footer */}
      <div className="mt-20 p-12 bg-slate-900 rounded-[40px] text-center text-white relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
          <div className="absolute top-10 left-10"><Star size={24} /></div>
          <div className="absolute bottom-10 right-10"><Star size={32} /></div>
          <div className="absolute top-1/2 left-1/4"><Star size={16} /></div>
        </div>
        <div className="relative z-10">
          <h3 className="text-3xl font-black mb-4">Will your house be next?</h3>
          <p className="text-slate-400 max-w-md mx-auto mb-8">
            Every point counts towards your house's legacy. Keep striving for excellence and lead your team to glory.
          </p>
          <div className="flex justify-center gap-4">
            {Object.values(HOUSE_CONFIG).map((h, i) => (
              <div key={i} className="text-3xl animate-bounce" style={{ animationDelay: `${i * 0.2}s` }}>
                {h.icon}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
