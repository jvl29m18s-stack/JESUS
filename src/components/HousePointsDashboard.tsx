import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, limit, where, addDoc, serverTimestamp, doc, runTransaction, increment } from 'firebase/firestore';
import { db } from '../firebase';
import { PointEntry, UserProfile, HouseStats } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '../firestoreErrorHandler';
import { Trophy, TrendingUp, Users, Award, Filter, Plus, X, Star } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface HousePointsDashboardProps {
  userProfile: UserProfile;
  selectedStandard: string;
  setSelectedStandard: (standard: string) => void;
}

const HOUSE_CONFIG = {
  'GOOD PATRON': { color: '#ef4444', light: '#fef2f2', border: '#fee2e2' },
  'GOOD SHEPHERD': { color: '#10b981', light: '#f0fdf4', border: '#dcfce7' },
  'GOOD SAVIOUR': { color: '#f59e0b', light: '#fffbeb', border: '#fef3c7' },
  'GOOD PIONEER': { color: '#3b82f6', light: '#eff6ff', border: '#dbeafe' },
};

export default function HousePointsDashboard({ userProfile, selectedStandard, setSelectedStandard }: HousePointsDashboardProps) {
  const [houseStats, setHouseStats] = useState<HouseStats[]>([]);
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAwarding, setIsAwarding] = useState(false);
  const [awardTarget, setAwardTarget] = useState<'House' | 'Student'>('House');
  const [selectedHouseForAward, setSelectedHouseForAward] = useState<string>('GOOD PATRON');
  const [selectedStudentForAward, setSelectedStudentForAward] = useState<string>('');
  const [awardFormData, setAwardFormData] = useState({
    points: 10,
    category: 'Academic' as PointEntry['category'],
    reason: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAdmin = userProfile.role === 'Admin' || userProfile.role === 'Leader';

  useEffect(() => {
    const qStats = query(collection(db, 'house_stats'), orderBy('totalPoints', 'desc'));
    const unsubscribeStats = onSnapshot(qStats, (snapshot) => {
      const statsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as HouseStats[];
      setHouseStats(statsList);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'house_stats');
      setLoading(false);
    });

    const qStudents = query(collection(db, 'users'), where('role', 'in', ['Student', 'Leader']));
    const unsubscribeStudents = onSnapshot(qStudents, (snapshot) => {
      const studentList = snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      })) as UserProfile[];
      setStudents(studentList);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return () => {
      unsubscribeStats();
      unsubscribeStudents();
    };
  }, []);

  const leadingHouse = houseStats[0];
  const maxPoints = Math.max(...houseStats.map(h => h.totalPoints)) || 1;

  const handleAwardPoints = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const recipients = awardTarget === 'House' 
        ? students.filter(s => s.houseTeam === selectedHouseForAward)
        : students.filter(s => s.uid === selectedStudentForAward);

      if (recipients.length === 0) {
        alert("No recipients found.");
        setIsSubmitting(false);
        return;
      }

      await runTransaction(db, async (transaction) => {
        for (const recipient of recipients) {
          const newPointRef = doc(collection(db, 'points'));
          transaction.set(newPointRef, {
            studentId: recipient.uid,
            studentName: recipient.displayName,
            points: awardFormData.points,
            reason: awardFormData.reason,
            category: awardFormData.category,
            house: recipient.houseTeam || selectedHouseForAward,
            timestamp: serverTimestamp(),
            awardedBy: userProfile.uid,
            awardedByName: userProfile.displayName
          });

          const userRef = doc(db, 'users', recipient.uid);
          const userDoc = await transaction.get(userRef);
          const userData = userDoc.exists() ? userDoc.data() as UserProfile : null;
          
          transaction.set(userRef, {
            totalPoints: increment(awardFormData.points),
            studentData: {
              points: (userData?.studentData?.points || userData?.totalPoints || 0) + awardFormData.points,
              cards: userData?.studentData?.cards || userData?.cards || {}
            },
            updatedAt: serverTimestamp()
          }, { merge: true });

          const houseRef = doc(db, 'house_stats', recipient.houseTeam || selectedHouseForAward);
          transaction.set(houseRef, {
            totalPoints: increment(awardFormData.points),
            lastUpdated: serverTimestamp()
          }, { merge: true });
        }

        // Update sender if Leader
        if (userProfile.role === 'Leader') {
          const senderRef = doc(db, 'users', userProfile.uid);
          transaction.set(senderRef, {
            leaderData: {
              pointsDistributed: increment(awardFormData.points * recipients.length)
            }
          }, { merge: true });
        }
      });
      
      setIsAwarding(false);
      setAwardFormData({ points: 10, category: 'Academic', reason: '' });
      setSelectedStudentForAward('');
    } catch (error) {
      console.error("Error awarding points:", error);
      handleFirestoreError(error, OperationType.CREATE, 'points');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">House Points</h1>
          <p className="text-slate-500 text-sm">
            {selectedStandard === 'All Standards' ? 'All Standards' : selectedStandard}
          </p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          {isAdmin && (
            <button 
              onClick={() => setIsAwarding(true)}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
            >
              <Plus size={18} />
              Give Points
            </button>
          )}
          <div className="relative flex-1 md:flex-none">
            {/* Global standard selector is used instead */}
          </div>
        </div>
      </div>

      {/* Leading House Card */}
      {leadingHouse && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-[32px] p-8 text-white shadow-2xl"
          style={{ backgroundColor: HOUSE_CONFIG[leadingHouse.id as keyof typeof HOUSE_CONFIG].color }}
        >
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Trophy size={160} />
          </div>
          <div className="relative z-10 flex items-center gap-6">
            <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center">
              <Trophy size={40} />
            </div>
            <div>
              <div className="text-sm font-medium opacity-80 mb-1 uppercase tracking-wider">Leading House</div>
              <div className="text-5xl font-black mb-2">{leadingHouse.id.split(' ')[1]}</div>
              <div className="text-xl font-bold opacity-90">{leadingHouse.totalPoints.toLocaleString()} points</div>
            </div>
          </div>
        </motion.div>
      )}

      {/* House Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {houseStats.map((house, index) => (
          <div 
            key={house.id}
            className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm relative group"
            style={{ borderLeft: `8px solid ${HOUSE_CONFIG[house.id as keyof typeof HOUSE_CONFIG].color}` }}
          >
            <div className="absolute top-6 right-8 text-slate-100 font-black text-4xl group-hover:text-slate-200 transition-colors">
              #{index + 1}
            </div>
            <div className="flex items-center gap-3 mb-6">
              <Award size={24} style={{ color: HOUSE_CONFIG[house.id as keyof typeof HOUSE_CONFIG].color }} />
              <h3 className="text-xl font-bold text-slate-800">{house.id.split(' ')[1]}</h3>
              <span className="text-xs text-slate-400 font-medium">
                {students.filter(s => s.houseTeam === house.id).length} students
              </span>
            </div>
            <div className="text-4xl font-black text-slate-800 mb-4">
              {house.totalPoints.toLocaleString()}
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${(house.totalPoints / maxPoints) * 100}%` }}
                className="h-full rounded-full"
                style={{ backgroundColor: HOUSE_CONFIG[house.id as keyof typeof HOUSE_CONFIG].color }}
              />
            </div>
            <div className="flex justify-between items-center mt-4">
              <div className="flex gap-1">
                {['white', 'yellow', 'blue', 'green', 'pink'].map(color => (
                  <div 
                    key={color}
                    className="w-3 h-3 rounded-full border border-slate-200"
                    style={{ backgroundColor: color === 'white' ? '#fff' : color === 'yellow' ? '#fef08a' : color === 'blue' ? '#bfdbfe' : color === 'green' ? '#bbf7d0' : '#fbcfe8' }}
                    title={`${house.cardCounts?.[color as keyof typeof house.cardCounts] || 0} ${color} cards`}
                  />
                ))}
              </div>
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                {Math.round((house.totalPoints / maxPoints) * 100)}% of lead
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Chart Section */}
      <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm">
        <h3 className="text-lg font-bold text-slate-800 mb-8 flex items-center gap-2">
          <TrendingUp size={20} className="text-blue-500" />
          House Points Comparison
        </h3>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <BarChart data={houseStats} layout="vertical" margin={{ left: 40, right: 40 }}>
              <XAxis type="number" hide />
              <YAxis 
                dataKey="id" 
                type="category" 
                axisLine={false} 
                tickLine={false}
                tick={(props: any) => {
                  const { x, y, payload } = props;
                  return (
                    <text x={Number(x) - 10} y={Number(y) + 4} textAnchor="end" fill="#64748b" fontSize={12} fontWeight={600}>
                      {payload.value.split(' ')[1]}
                    </text>
                  );
                }}
              />
              <Tooltip 
                cursor={{ fill: 'transparent' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-white p-4 rounded-xl shadow-xl border border-slate-100">
                        <p className="text-sm font-bold text-slate-800">{payload[0].payload.id}</p>
                        <p className="text-xs text-slate-500">{payload[0].value.toLocaleString()} points</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="totalPoints" radius={[0, 8, 8, 0]} barSize={32}>
                {houseStats.map((entry) => (
                  <Cell key={entry.id} fill={HOUSE_CONFIG[entry.id as keyof typeof HOUSE_CONFIG].color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Students Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {houseStats.map(house => {
          const houseStudents = students
            .filter(s => s.houseTeam === house.id)
            .sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0))
            .slice(0, 3);

          return (
            <div key={house.id} className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm">
              <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: HOUSE_CONFIG[house.id as keyof typeof HOUSE_CONFIG].color }} />
                {house.id.split(' ')[1]} Top Students
              </h3>
              <div className="space-y-4">
                {houseStudents.length === 0 ? (
                  <p className="text-slate-400 text-sm italic">No points recorded yet</p>
                ) : (
                  houseStudents.map((student, idx) => (
                    <div key={student.uid} className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl">
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-full bg-white border border-slate-100 flex items-center justify-center text-xs font-bold text-slate-400">
                          {idx + 1}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-800">{student.displayName}</div>
                          <div className="text-[10px] text-slate-400 font-medium">Std {student.standard}</div>
                        </div>
                      </div>
                      <div className="text-sm font-black" style={{ color: HOUSE_CONFIG[house.id as keyof typeof HOUSE_CONFIG].color }}>
                        {(student.totalPoints || 0).toLocaleString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Give Points Modal */}
      <AnimatePresence>
        {isAwarding && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[32px] w-full max-w-lg p-8 shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-bold text-slate-800">Give Points</h2>
                <button onClick={() => setIsAwarding(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleAwardPoints} className="space-y-6">
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl mb-6">
                  <button
                    type="button"
                    onClick={() => setAwardTarget('House')}
                    className={`py-2 rounded-lg text-sm font-bold transition-all ${awardTarget === 'House' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Whole House
                  </button>
                  <button
                    type="button"
                    onClick={() => setAwardTarget('Student')}
                    className={`py-2 rounded-lg text-sm font-bold transition-all ${awardTarget === 'Student' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Individual
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Select House</label>
                  <select 
                    value={selectedHouseForAward}
                    onChange={(e) => setSelectedHouseForAward(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 outline-none bg-white"
                  >
                    {Object.keys(HOUSE_CONFIG).map(house => (
                      <option key={house} value={house}>{house}</option>
                    ))}
                  </select>
                </div>

                {awardTarget === 'Student' && (
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Select Student</label>
                    <select 
                      required
                      value={selectedStudentForAward}
                      onChange={(e) => setSelectedStudentForAward(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 outline-none bg-white"
                    >
                      <option value="">Choose a student...</option>
                      {students
                        .filter(s => s.houseTeam === selectedHouseForAward)
                        .sort((a, b) => a.displayName.localeCompare(b.displayName))
                        .map(student => (
                          <option key={student.uid} value={student.uid}>
                            {student.displayName} (Std {student.standard})
                          </option>
                        ))
                      }
                    </select>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Points</label>
                  <input 
                    type="number"
                    required
                    min="1"
                    value={awardFormData.points}
                    onChange={e => setAwardFormData({ ...awardFormData, points: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Category</label>
                  <select 
                    value={awardFormData.category}
                    onChange={e => setAwardFormData({ ...awardFormData, category: e.target.value as any })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 outline-none bg-white"
                  >
                    <option value="Academic">Academic</option>
                    <option value="Sports">Sports</option>
                    <option value="Behavior">Behavior</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Reason</label>
                  <textarea 
                    required
                    rows={3}
                    placeholder="Enter reason..."
                    value={awardFormData.reason}
                    onChange={e => setAwardFormData({ ...awardFormData, reason: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 outline-none resize-none"
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsAwarding(false)}
                    className="flex-1 py-3 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Awarding...' : 'Award Points'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
