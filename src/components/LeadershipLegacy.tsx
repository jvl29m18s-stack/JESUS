import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { LeadershipLegacyEntry } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Crown, Shield, History, Search, Filter } from 'lucide-react';

export default function LeadershipLegacy() {
  const [legacy, setLegacy] = useState<LeadershipLegacyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [yearFilter, setYearFilter] = useState('All');

  useEffect(() => {
    const q = query(collection(db, 'leadership_legacy'), orderBy('year', 'desc'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const entries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as LeadershipLegacyEntry[];
      setLegacy(entries);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const years = ['All', ...Array.from(new Set(legacy.map(e => e.year)))];

  const filteredLegacy = legacy.filter(entry => {
    const matchesSearch = entry.userName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         entry.houseTeam.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesYear = yearFilter === 'All' || entry.year === yearFilter;
    return matchesSearch && matchesYear;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center p-24">
        <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-[32px] p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-12 opacity-10">
          <History size={160} />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center">
              <Trophy size={24} />
            </div>
            <h2 className="text-3xl font-black tracking-tight">Election History</h2>
          </div>
          <p className="text-indigo-100 max-w-xl font-medium">
            A permanent archive of the students and leaders who have served our institution. Their legacy inspires the next generation.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text"
            placeholder="Search names or houses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-200 focus:border-indigo-500 outline-none bg-white shadow-sm"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-200 focus:border-indigo-500 outline-none bg-white shadow-sm appearance-none font-bold text-slate-700"
          >
            {years.map(year => (
              <option key={year} value={year}>{year === 'All' ? 'All Years' : `Batch ${year}`}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Legacy Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredLegacy.map((entry, index) => (
            <motion.div
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ delay: index * 0.05 }}
              key={entry.id}
              className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm hover:shadow-xl transition-all group"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center text-indigo-600 font-black text-2xl overflow-hidden border border-slate-100">
                  {entry.photoURL ? (
                    <img src={entry.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    entry.userName.charAt(0)
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-800">{entry.userName}</h3>
                    {entry.houseTitle === 'Captain' ? (
                      <Crown size={14} className="text-amber-500 fill-amber-500/20" />
                    ) : entry.houseTitle === 'Vice-Captain' ? (
                      <Shield size={14} className="text-indigo-500 fill-indigo-500/20" />
                    ) : null}
                  </div>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
                    {entry.houseTeam}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Year</span>
                  <span className="text-xs font-black text-indigo-600">{entry.year}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Role</span>
                  <span className="text-xs font-bold text-slate-700">
                    {entry.houseTitle !== 'None' ? `${entry.houseTitle} & ${entry.role}` : entry.role}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {filteredLegacy.length === 0 && (
        <div className="text-center py-24 bg-white rounded-[32px] border border-dashed border-slate-200">
          <History size={48} className="mx-auto text-slate-200 mb-4" />
          <h3 className="text-lg font-bold text-slate-400">No legacy records found</h3>
          <p className="text-sm text-slate-300">Try adjusting your search or filters</p>
        </div>
      )}
    </div>
  );
}
