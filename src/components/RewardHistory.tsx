import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { RewardHistory as RewardHistoryType } from '../types';
import { History, Award, Star, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function RewardHistory() {
  const [history, setHistory] = useState<RewardHistoryType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'reward_history'),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const historyData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as RewardHistoryType[];
      setHistory(historyData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const getBadgeClass = (item: RewardHistoryType) => {
    if (item.type === 'points') return 'badge-points-prestigious';
    switch (item.value.toLowerCase()) {
      case 'white': return 'badge-white-prestigious';
      case 'yellow': return 'badge-yellow-prestigious';
      case 'blue': return 'badge-blue-prestigious';
      case 'green': return 'badge-green-prestigious';
      case 'pink': return 'badge-pink-prestigious';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
            <History size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Institutional History</h2>
            <p className="text-sm text-slate-500">Real-time record of cards and points awarded</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4" id="history-list">
        <AnimatePresence mode="popLayout">
          {history.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-12 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200"
            >
              <Award size={48} className="mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">No rewards have been recorded yet.</p>
            </motion.div>
          ) : (
            history.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="history-item-prestigious"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-indigo-50 text-indigo-600">
                    {item.type === 'card' ? <Award size={20} /> : <Star size={20} />}
                  </div>
                  <div>
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-800">{item.recipientName}</span>
                      <span className="text-xs text-slate-500">
                        Awarded by {item.senderName} ({item.senderRole})
                      </span>
                      {item.reason && (
                        <span className="text-[10px] italic text-slate-400 mt-1">
                          "{item.reason}"
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col items-end gap-2">
                  <div className={`badge-prestigious ${getBadgeClass(item)}`}>
                    {item.type === 'card' ? `${item.value} Card` : `${item.value} Points`}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-slate-400">
                    <Clock size={10} />
                    <span>{item.timestamp?.toDate().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
