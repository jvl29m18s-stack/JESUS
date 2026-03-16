import React, { useState, useEffect } from 'react';
import { 
  collection, 
  getDocs, 
  query, 
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../firebase';
import { ArchiveBatch, HouseStats } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, History as HistoryIcon, Calendar, Award, ChevronRight, Search, Filter } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../firestoreErrorHandler';

const HOUSE_CONFIG = {
  'GOOD PIONEER': { color: '#3b82f6', icon: '🚀' },
  'GOOD PATRON': { color: '#ef4444', icon: '🛡️' },
  'GOOD SAVIOUR': { color: '#f59e0b', icon: '🌟' },
  'GOOD SHEPHERD': { color: '#10b981', icon: '🌿' }
};

export default function LegacyVault() {
  const [batches, setBatches] = useState<ArchiveBatch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<ArchiveBatch | null>(null);
  const [archivedStats, setArchivedStats] = useState<HouseStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'archives'), orderBy('archivedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const batchList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ArchiveBatch[];
      setBatches(batchList);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'archives');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!selectedBatch) {
      setArchivedStats([]);
      return;
    }

    setLoadingStats(true);
    const fetchArchivedStats = async () => {
      try {
        const statsSnap = await getDocs(collection(db, 'archives', selectedBatch.id, 'house_stats'));
        const statsList = statsSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as HouseStats[];
        setArchivedStats(statsList.sort((a, b) => b.totalPoints - a.totalPoints));
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, `archives/${selectedBatch.id}/house_stats`);
      } finally {
        setLoadingStats(false);
      }
    };

    fetchArchivedStats();
  }, [selectedBatch]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-12">
        <div>
          <h1 className="text-4xl font-black text-slate-800 flex items-center gap-3">
            <HistoryIcon className="text-amber-500" size={36} />
            Legacy Vault
          </h1>
          <p className="text-slate-500 font-medium mt-1">Preserving the achievements of every Good Samaritan batch.</p>
        </div>
        
        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border border-slate-100 shadow-sm">
          <Calendar size={18} className="text-slate-400" />
          <span className="text-sm font-bold text-slate-600">
            {batches.length} Archived Batches
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Batch List */}
        <div className="lg:col-span-1 space-y-4">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Select a Batch</h3>
          {batches.length === 0 ? (
            <div className="bg-slate-50 rounded-2xl p-8 text-center border border-dashed border-slate-200">
              <HistoryIcon size={32} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm text-slate-400 font-medium">No archived batches yet.</p>
            </div>
          ) : (
            batches.map((batch) => (
              <motion.button
                key={batch.id}
                whileHover={{ x: 4 }}
                onClick={() => setSelectedBatch(batch)}
                className={`w-full text-left p-6 rounded-3xl border transition-all relative overflow-hidden group ${
                  selectedBatch?.id === batch.id 
                    ? 'bg-slate-800 border-slate-800 text-white shadow-xl shadow-slate-200' 
                    : 'bg-white border-slate-100 text-slate-600 hover:border-amber-200'
                }`}
              >
                <div className="relative z-10">
                  <div className="text-xs font-black opacity-50 uppercase tracking-tighter mb-1">
                    {new Date(batch.archivedAt?.toDate()).getFullYear()} Legacy
                  </div>
                  <div className="text-xl font-black mb-2">{batch.yearLabel}</div>
                  <div className="flex items-center gap-2 text-sm font-bold opacity-80">
                    <Trophy size={14} className="text-amber-400" />
                    Winner: {batch.summary.winningHouse.split(' ')[1]}
                  </div>
                </div>
                <ChevronRight 
                  size={20} 
                  className={`absolute right-6 top-1/2 -translate-y-1/2 transition-all ${
                    selectedBatch?.id === batch.id ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'
                  }`} 
                />
              </motion.button>
            ))
          )}
        </div>

        {/* Batch Details */}
        <div className="lg:col-span-2">
          <AnimatePresence mode="wait">
            {!selectedBatch ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-slate-50 rounded-[40px] border-2 border-dashed border-slate-200 h-full min-h-[400px] flex flex-col items-center justify-center p-12 text-center"
              >
                <div className="w-20 h-20 bg-white rounded-3xl shadow-sm flex items-center justify-center text-slate-300 mb-6">
                  <Search size={40} />
                </div>
                <h3 className="text-xl font-bold text-slate-400">Select a batch to view its history</h3>
                <p className="text-slate-400 text-sm mt-2 max-w-xs">
                  Relive the competition, the points, and the glory of previous academic years.
                </p>
              </motion.div>
            ) : (
              <motion.div 
                key={selectedBatch.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                {/* Batch Header Card */}
                <div className="bg-white rounded-[40px] p-8 border border-slate-100 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-5">
                    <HistoryIcon size={180} />
                  </div>
                  <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-[10px] font-black uppercase tracking-wider">
                        Archived Batch
                      </span>
                      <span className="text-slate-300 text-xs font-medium">
                        Archived on {new Date(selectedBatch.archivedAt?.toDate()).toLocaleDateString()}
                      </span>
                    </div>
                    <h2 className="text-4xl font-black text-slate-800 mb-6">{selectedBatch.yearLabel}</h2>
                    
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-slate-50 rounded-3xl p-4">
                        <div className="text-[10px] font-black text-slate-400 uppercase mb-1">Total Points</div>
                        <div className="text-xl font-black text-slate-800">{selectedBatch.summary.totalPoints.toLocaleString()}</div>
                      </div>
                      <div className="bg-slate-50 rounded-3xl p-4">
                        <div className="text-[10px] font-black text-slate-400 uppercase mb-1">Total Cards</div>
                        <div className="text-xl font-black text-slate-800">{selectedBatch.summary.totalCards.toLocaleString()}</div>
                      </div>
                      <div className="bg-amber-50 rounded-3xl p-4 border border-amber-100">
                        <div className="text-[10px] font-black text-amber-600 uppercase mb-1">Winning House</div>
                        <div className="text-xl font-black text-amber-700">{selectedBatch.summary.winningHouse.split(' ')[1]}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Archived Leaderboard */}
                <div className="bg-white rounded-[40px] p-8 border border-slate-100 shadow-sm">
                  <h3 className="text-lg font-bold text-slate-800 mb-8 flex items-center gap-2">
                    <Trophy size={20} className="text-amber-500" />
                    Final Leaderboard
                  </h3>

                  {loadingStats ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="animate-spin text-amber-500" size={32} />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {archivedStats.map((house, idx) => (
                        <div 
                          key={house.id}
                          className="flex items-center gap-4 p-4 rounded-3xl bg-slate-50/50 border border-slate-100 hover:border-slate-200 transition-all"
                        >
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-black ${
                            idx === 0 ? 'bg-amber-100 text-amber-600' : 
                            idx === 1 ? 'bg-slate-200 text-slate-600' : 
                            idx === 2 ? 'bg-orange-100 text-orange-600' : 'bg-white text-slate-400'
                          }`}>
                            {idx + 1}
                          </div>
                          
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-lg font-black text-slate-800">{house.id.split(' ')[1]}</span>
                              <span className="text-2xl">{HOUSE_CONFIG[house.id as keyof typeof HOUSE_CONFIG]?.icon}</span>
                            </div>
                            <div className="flex gap-2 mt-1">
                              {['white', 'yellow', 'blue', 'green', 'pink'].map(color => (
                                <div 
                                  key={color}
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: color === 'white' ? '#e2e8f0' : color === 'yellow' ? '#fef08a' : color === 'blue' ? '#bfdbfe' : color === 'green' ? '#bbf7d0' : '#fbcfe8' }}
                                />
                              ))}
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-2xl font-black text-slate-800">{house.totalPoints.toLocaleString()}</div>
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Final Score</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-6 bg-blue-50 rounded-3xl border border-blue-100 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-blue-600 shadow-sm">
                    <Award size={24} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-blue-900">Legacy Badges Awarded</h4>
                    <p className="text-xs text-blue-700 opacity-80">
                      All students from this batch have received their legacy badges in their personal profiles.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function Loader2({ className, size }: { className?: string, size?: number }) {
  return <HistoryIcon className={className} size={size} />;
}
