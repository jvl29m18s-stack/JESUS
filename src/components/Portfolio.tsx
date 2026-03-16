import React, { useState, useEffect } from 'react';
import { 
  Award, 
  FileText, 
  Calendar, 
  Download, 
  TrendingUp, 
  Star, 
  Shield, 
  Users,
  ChevronRight,
  Search,
  Filter
} from 'lucide-react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, PortfolioEntry } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '../firestoreErrorHandler';

interface PortfolioProps {
  userProfile: UserProfile;
}

const Portfolio: React.FC<PortfolioProps> = ({ userProfile }) => {
  const [entries, setEntries] = useState<PortfolioEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('All');

  useEffect(() => {
    const q = query(
      collection(db, 'portfolios'),
      where('userId', '==', userProfile.uid),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setEntries(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PortfolioEntry)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'portfolios');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userProfile.uid]);

  const filteredEntries = entries.filter(entry => 
    filterType === 'All' || entry.type === filterType
  );

  return (
    <div className="space-y-8 pb-12">
      {/* Header Section */}
      <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full -mr-32 -mt-32 opacity-50" />
        <div className="relative z-10">
          <h2 className="text-3xl font-serif font-medium text-[#1a1a1a] mb-2">My Achievement Vault</h2>
          <p className="text-[#5A5A40]/60 font-serif italic max-w-2xl">
            A comprehensive record of your growth, character, and leadership at Good Samaritan.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Portfolio List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                <Filter size={16} className="text-slate-400" />
                <select 
                  className="bg-transparent text-sm font-medium focus:outline-none"
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                >
                  <option value="All">All Achievements</option>
                  <option value="Progress Report">Progress Reports</option>
                  <option value="Quiz Award">Quiz Awards</option>
                  <option value="Leadership Milestone">Leadership</option>
                  <option value="Achievement">General</option>
                </select>
              </div>
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              {filteredEntries.length} Records Found
            </span>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 bg-white rounded-[32px] border border-slate-100">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
              <p className="text-slate-400 font-serif italic">Opening the vault...</p>
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="text-center py-24 bg-white rounded-[32px] border border-dashed border-slate-200">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Award className="w-10 h-10 text-slate-300" />
              </div>
              <h4 className="text-xl font-serif font-medium text-slate-800 mb-2">Your vault is currently empty</h4>
              <p className="text-slate-500 font-serif italic max-w-sm mx-auto">
                Keep participating in quizzes, earning cards, and leading your house to see your achievements appear here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              <AnimatePresence mode="popLayout">
                {filteredEntries.map((entry) => (
                  <motion.div
                    key={entry.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="group bg-white p-6 rounded-2xl border border-slate-100 hover:border-indigo-100 hover:shadow-md transition-all flex items-center gap-6"
                  >
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
                      entry.type === 'Progress Report' ? 'bg-indigo-50 text-indigo-600' :
                      entry.type === 'Quiz Award' ? 'bg-emerald-50 text-emerald-600' :
                      entry.type === 'Leadership Milestone' ? 'bg-amber-50 text-amber-600' :
                      'bg-rose-50 text-rose-600'
                    }`}>
                      {entry.type === 'Progress Report' ? <FileText size={28} /> :
                       entry.type === 'Quiz Award' ? <Star size={28} /> :
                       entry.type === 'Leadership Milestone' ? <Shield size={28} /> :
                       <Award size={28} />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          entry.type === 'Progress Report' ? 'bg-indigo-100 text-indigo-700' :
                          entry.type === 'Quiz Award' ? 'bg-emerald-100 text-emerald-700' :
                          entry.type === 'Leadership Milestone' ? 'bg-amber-100 text-amber-700' :
                          'bg-rose-100 text-rose-700'
                        }`}>
                          {entry.type}
                        </span>
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Calendar size={12} />
                          {entry.date}
                        </span>
                      </div>
                      <h4 className="text-lg font-bold text-slate-800 truncate group-hover:text-indigo-600 transition-colors">
                        {entry.title}
                      </h4>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                          <TrendingUp size={14} className="text-emerald-500" />
                          {entry.totalPointsAtTime} Points
                        </span>
                        {entry.badgesEarned && entry.badgesEarned.length > 0 && (
                          <div className="flex -space-x-1">
                            {entry.badgesEarned.slice(0, 3).map((badge, i) => (
                              <div key={i} className="w-5 h-5 rounded-full bg-slate-100 border border-white flex items-center justify-center text-[10px]" title={badge}>
                                🏅
                              </div>
                            ))}
                            {entry.badgesEarned.length > 3 && (
                              <div className="w-5 h-5 rounded-full bg-slate-50 border border-white flex items-center justify-center text-[8px] font-bold text-slate-400">
                                +{entry.badgesEarned.length - 3}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <button 
                      className="w-12 h-12 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all group/btn"
                      onClick={() => entry.downloadUrl && window.open(entry.downloadUrl, '_blank')}
                    >
                      <Download size={20} className="group-hover/btn:scale-110 transition-transform" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Sidebar Stats */}
        <div className="space-y-6">
          {/* Leadership Impact Section */}
          {(userProfile.role === 'Leader' || userProfile.role === 'Admin') && (
            <div className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50 rounded-full -mr-16 -mt-16 opacity-50" />
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600">
                    <Shield size={20} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800">Leadership Impact</h3>
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Points Distributed</p>
                    <div className="flex items-end gap-2">
                      <span className="text-2xl font-bold text-slate-800">1,240</span>
                      <span className="text-xs font-medium text-emerald-600 mb-1">+12% this month</span>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">House Contribution</p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: '65%' }} />
                      </div>
                      <span className="text-sm font-bold text-slate-800">65%</span>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Current House Rank</p>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 font-bold">
                        #2
                      </div>
                      <span className="text-sm font-medium text-slate-600">Good Pioneer House</span>
                    </div>
                  </div>
                </div>

                <button className="w-full mt-6 py-3 rounded-2xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2">
                  View Leadership History
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Quick Summary Card */}
          <div className="bg-indigo-600 rounded-[32px] p-6 text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />
            <div className="relative z-10">
              <h3 className="text-lg font-bold mb-4">Vault Summary</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-white/10">
                  <span className="text-sm text-white/60">Total Records</span>
                  <span className="font-bold">{entries.length}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/10">
                  <span className="text-sm text-white/60">Reports Issued</span>
                  <span className="font-bold">{entries.filter(e => e.type === 'Progress Report').length}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-white/60">Last Achievement</span>
                  <span className="font-bold text-xs">{entries[0]?.date || 'N/A'}</span>
                </div>
              </div>
              <div className="mt-8 p-4 bg-white/10 rounded-2xl backdrop-blur-sm">
                <p className="text-xs italic text-white/80">
                  "Excellence is not an act, but a habit."
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Portfolio;
