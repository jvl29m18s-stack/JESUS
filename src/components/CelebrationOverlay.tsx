import React, { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Sparkles, X, Star } from 'lucide-react';

export default function CelebrationOverlay() {
  const [celebration, setCelebration] = useState<{ winnerHouse: string; studentName?: string; period: string; trigger: number } | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'announcements', 'global_celebration'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        // Only trigger if it's a recent trigger (within last 30 seconds to avoid old triggers on load)
        const isRecent = Date.now() - data.trigger < 30000;
        
        if (isRecent) {
          setCelebration({
            winnerHouse: data.winnerHouse,
            studentName: data.studentName,
            period: data.period,
            trigger: data.trigger
          });
          setShow(true);
          triggerConfetti();
          
          // Auto hide after 10 seconds
          setTimeout(() => setShow(false), 10000);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const triggerConfetti = () => {
    const duration = 7 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

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

  return (
    <AnimatePresence>
      {show && celebration && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 50 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 50 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none"
        >
          <div className="bg-white rounded-[40px] shadow-2xl border-4 border-amber-400 p-8 md:p-12 max-w-lg w-full text-center relative pointer-events-auto overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400" />
            
            <button 
              onClick={() => setShow(false)}
              className="absolute top-6 right-6 p-2 hover:bg-slate-100 rounded-full transition-colors"
            >
              <X size={20} className="text-slate-400" />
            </button>

            <motion.div
              animate={{ 
                rotate: [0, -10, 10, -10, 10, 0],
                scale: [1, 1.1, 1, 1.1, 1]
              }}
              transition={{ duration: 2, repeat: Infinity }}
              className="inline-block mb-6"
            >
              <div className="w-24 h-24 bg-amber-50 rounded-full flex items-center justify-center text-amber-500 shadow-inner">
                <Trophy size={48} />
              </div>
            </motion.div>

            <h2 className="text-sm font-black text-amber-600 uppercase tracking-[0.2em] mb-2">New Champion Crowned!</h2>
            <h3 className="text-4xl font-black text-slate-800 mb-2 tracking-tight">
              {celebration.winnerHouse}
            </h3>
            
            {celebration.studentName && (
              <div className="flex flex-col items-center gap-1 mb-4">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Student of the Month</div>
                <div className="text-xl font-black text-amber-600 flex items-center gap-2">
                  <Star size={16} className="fill-amber-500" />
                  {celebration.studentName}
                  <Star size={16} className="fill-amber-500" />
                </div>
              </div>
            )}
            
            <div className="flex items-center justify-center gap-2 text-slate-500 font-bold mb-8">
              <Sparkles size={18} className="text-amber-400" />
              {celebration.period} Winner
              <Sparkles size={18} className="text-amber-400" />
            </div>

            <p className="text-slate-400 text-sm italic mb-8">
              Congratulations to all members of {celebration.winnerHouse} for their outstanding performance and dedication!
            </p>

            <button
              onClick={() => setShow(false)}
              className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
            >
              Celebrate Glory
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
