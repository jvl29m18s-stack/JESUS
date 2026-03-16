import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Crown, Star, Users, TrendingUp, Activity, Award, Shield, Target } from 'lucide-react';

interface LeaderboardProps {
  userProfile: UserProfile;
}

export default function Leaderboard({ userProfile }: LeaderboardProps) {
  const [activeTab, setActiveTab] = useState<'Academic' | 'Leadership'>('Academic');
  const [academicLeaders, setAcademicLeaders] = useState<UserProfile[]>([]);
  const [leadershipLeaders, setLeadershipLeaders] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = userProfile.role === 'Admin';
  const isLeader = userProfile.role === 'Leader';

  useEffect(() => {
    setLoading(true);
    
    // Academic Leaderboard (Students)
    const academicQuery = query(
      collection(db, "users"),
      where("role", "in", ["Student", "Leader"]),
      orderBy("totalPoints", "desc"),
      limit(20)
    );

    const unsubscribeAcademic = onSnapshot(academicQuery, (snapshot) => {
      const leaders = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })) as UserProfile[];
      setAcademicLeaders(leaders);
    });

    // Leadership Leaderboard (Leaders only)
    const leadershipQuery = query(
      collection(db, "users"),
      where("role", "==", "Leader"),
      orderBy("leaderData.leadershipImpactScore", "desc"),
      limit(20)
    );

    const unsubscribeLeadership = onSnapshot(leadershipQuery, (snapshot) => {
      const leaders = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })) as UserProfile[];
      setLeadershipLeaders(leaders);
      setLoading(false);
    });

    return () => {
      unsubscribeAcademic();
      unsubscribeLeadership();
    };
  }, []);

  const renderElite3 = (leaders: UserProfile[], type: 'Academic' | 'Leadership') => {
    const elite = leaders.slice(0, 3);
    // Reorder for visual: [2, 1, 3]
    const displayElite = [elite[1], elite[0], elite[2]].filter(Boolean);

    return (
      <div className="flex justify-center items-end gap-4 mb-12 mt-8">
        {displayElite.map((leader, index) => {
          const isFirst = leader.uid === elite[0]?.uid;
          const isSecond = leader.uid === elite[1]?.uid;
          const isThird = leader.uid === elite[2]?.uid;

          return (
            <motion.div
              key={leader.uid}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`flex flex-col items-center ${isFirst ? 'z-10' : ''}`}
            >
              <div className="relative mb-4">
                <div className={`
                  relative rounded-full p-1
                  ${isFirst ? 'w-24 h-24 bg-gradient-to-tr from-yellow-400 to-yellow-200 shadow-lg shadow-yellow-200/50' : 
                    isSecond ? 'w-20 h-20 bg-gradient-to-tr from-slate-300 to-slate-100 shadow-lg shadow-slate-200/50' : 
                    'w-16 h-16 bg-gradient-to-tr from-amber-600 to-amber-400 shadow-lg shadow-amber-200/50'}
                `}>
                  <div className="w-full h-full rounded-full bg-white overflow-hidden">
                    {leader.photoURL ? (
                      <img src={leader.photoURL} alt={leader.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400 font-bold text-xl">
                        {leader.displayName.charAt(0)}
                      </div>
                    )}
                  </div>
                </div>
                {isFirst && (
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-yellow-500">
                    <Crown size={32} fill="currentColor" />
                  </div>
                )}
                <div className={`
                  absolute -bottom-2 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full flex items-center justify-center font-bold text-white shadow-md
                  ${isFirst ? 'bg-yellow-500' : isSecond ? 'bg-slate-400' : 'bg-amber-600'}
                `}>
                  {isFirst ? '1' : isSecond ? '2' : '3'}
                </div>
              </div>
              <div className="text-center">
                <div className="font-bold text-slate-800 truncate max-w-[120px]">{leader.displayName}</div>
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  {type === 'Academic' ? `${leader.totalPoints || 0} pts` : `${leader.leaderData?.leadershipImpactScore || 0} Impact`}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Rankings</h1>
          <p className="text-slate-500">Celebrating excellence in academics and leadership.</p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-2xl self-start">
          <button
            onClick={() => setActiveTab('Academic')}
            className={`px-6 py-2 rounded-xl font-bold text-sm transition-all ${
              activeTab === 'Academic' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Academic Rank
          </button>
          {(isAdmin || isLeader) && (
            <button
              onClick={() => setActiveTab('Leadership')}
              className={`px-6 py-2 rounded-xl font-bold text-sm transition-all ${
                activeTab === 'Leadership' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Leadership Rank
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-[40px] p-8 md:p-12 border border-slate-100 shadow-sm">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
            <p className="text-slate-400 font-medium italic">Calculating ranks...</p>
          </div>
        ) : (
          <>
            {activeTab === 'Academic' ? (
              academicLeaders.length > 0 ? (
                <>
                  {renderElite3(academicLeaders, 'Academic')}
                  <div className="space-y-3">
                    {academicLeaders.slice(3).map((leader, index) => (
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        key={leader.uid}
                        className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                          leader.uid === userProfile.uid ? 'bg-indigo-50 border-indigo-100' : 'bg-slate-50 border-slate-100 hover:border-slate-200'
                        }`}
                      >
                        <div className="w-8 text-center font-bold text-slate-400">#{index + 4}</div>
                        <div className="w-10 h-10 rounded-full bg-white overflow-hidden border border-slate-200">
                          {leader.photoURL ? (
                            <img src={leader.photoURL} alt={leader.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-300 font-bold">
                              {leader.displayName.charAt(0)}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-slate-800 truncate flex items-center gap-2">
                            {leader.displayName}
                            {leader.houseTitle && leader.leadershipStatus === 'verified' && (
                              <div className="flex items-center" title={leader.houseTitle}>
                                {leader.houseTitle === 'Captain' ? (
                                  <Crown size={12} className="text-amber-500 fill-amber-500/20" />
                                ) : (
                                  <Shield size={12} className="text-indigo-500 fill-indigo-500/20" />
                                )}
                              </div>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">
                            {leader.standard} • {leader.houseTeam}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-indigo-600">{leader.totalPoints || 0}</div>
                          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Points</div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-20">
                  <Trophy size={48} className="mx-auto text-slate-200 mb-4" />
                  <p className="text-slate-400">No academic rankings available yet.</p>
                </div>
              )
            ) : (
              leadershipLeaders.length > 0 ? (
                <>
                  {renderElite3(leadershipLeaders, 'Leadership')}
                  <div className="space-y-3">
                    {leadershipLeaders.slice(3).map((leader, index) => (
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        key={leader.uid}
                        className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                          leader.uid === userProfile.uid ? 'bg-indigo-50 border-indigo-100' : 'bg-slate-50 border-slate-100 hover:border-slate-200'
                        }`}
                      >
                        <div className="w-8 text-center font-bold text-slate-400">#{index + 4}</div>
                        <div className="relative">
                          <div className="w-10 h-10 rounded-full bg-white overflow-hidden border border-slate-200">
                            {leader.photoURL ? (
                              <img src={leader.photoURL} alt={leader.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-300 font-bold">
                                {leader.displayName.charAt(0)}
                              </div>
                            )}
                          </div>
                          {leader.isOnline && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full shadow-sm" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-slate-800 truncate flex items-center gap-2">
                            {leader.displayName}
                            {leader.leaderPosition && (
                              <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold uppercase">
                                {leader.leaderPosition}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 mt-1">
                            <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                              <Star size={10} className="text-amber-400" />
                              {leader.leaderData?.pointsDistributed || 0} Given
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                              <Users size={10} className="text-blue-400" />
                              {leader.leaderData?.distinctStudentsHelped || 0} Peers
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                              <Activity size={10} className="text-emerald-400" />
                              {leader.leaderData?.activityStreak || 0} Streak
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-indigo-600">{leader.leaderData?.leadershipImpactScore || 0}</div>
                          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Impact</div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-20">
                  <Shield size={48} className="mx-auto text-slate-200 mb-4" />
                  <p className="text-slate-400">No leadership rankings available yet.</p>
                </div>
              )
            )}
          </>
        )}
      </div>

      {activeTab === 'Leadership' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
              <Award size={24} />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Peer Recognition</div>
              <div className="text-sm text-slate-600 font-medium">Award cards to earn impact points.</div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
              <TrendingUp size={24} />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">House Growth</div>
              <div className="text-sm text-slate-600 font-medium">Help your house climb the rankings.</div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600">
              <Activity size={24} />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Activity Streak</div>
              <div className="text-sm text-slate-600 font-medium">Check the Command Center daily.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
