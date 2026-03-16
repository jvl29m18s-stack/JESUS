import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  where, 
  doc,
  runTransaction,
  serverTimestamp,
  increment,
  limit
} from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '../firestoreErrorHandler';
import { Search, Award, Users, CreditCard, ChevronRight, Info, Heart, Star, Trophy, GraduationCap } from 'lucide-react';
import { sendNotification } from '../services/notificationService';
import PointsFeed from './PointsFeed';

interface AlumniDashboardProps {
  userProfile: UserProfile;
}

const ALUMNI_AWARDS = [
  { name: 'Mentorship Point', points: 5, icon: <Heart size={18} />, color: '#fdf2f8', text: '#9d174d', border: '#fbcfe8' },
  { name: 'Inspiration Point', points: 10, icon: <Star size={18} />, color: '#fefce8', text: '#854d0e', border: '#fef08a' },
  { name: 'Legacy Award', points: 20, icon: <Trophy size={18} />, color: '#f0fdf4', text: '#166534', border: '#bbf7d0' },
];

const DAILY_LIMIT = 50;

export default function AlumniDashboard({ userProfile }: AlumniDashboardProps) {
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<UserProfile | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [reason, setReason] = useState('');
  const [pointsGiftedToday, setPointsGiftedToday] = useState(0);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const alumniData = (userProfile as any).alumniData;
    if (alumniData?.lastGiftDate === today) {
      setPointsGiftedToday(alumniData.pointsGiftedToday || 0);
    } else {
      setPointsGiftedToday(0);
    }
  }, [userProfile]);

  useEffect(() => {
    // Alumni can only see Students (and maybe Leaders)
    const q = query(
      collection(db, 'users'), 
      where('role', 'in', ['Student', 'Leader']),
      limit(100)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      })) as UserProfile[];
      setStudents(list);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredStudents = students.filter(s => 
    s.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.houseTeam && s.houseTeam.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (s.standard && s.standard.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleAwardPoints = async (recipient: UserProfile, awardName: string, points: number) => {
    if (isProcessing) return;
    
    const today = new Date().toISOString().split('T')[0];
    if (pointsGiftedToday + points > DAILY_LIMIT) {
      alert(`Daily limit reached! You can only gift ${DAILY_LIMIT} points per day. Remaining: ${DAILY_LIMIT - pointsGiftedToday}`);
      return;
    }

    setIsProcessing(true);
    const recipientRef = doc(db, 'users', recipient.uid);
    const alumniRef = doc(db, 'users', userProfile.uid);
    const historyRef = collection(db, 'reward_history');
    const houseRef = doc(db, 'house_stats', recipient.houseTeam || 'Other');

    try {
      await runTransaction(db, async (transaction) => {
        // 1. Update Recipient
        transaction.update(recipientRef, {
          totalPoints: increment(points),
          'studentData.points': increment(points),
          updatedAt: serverTimestamp()
        });

        // 2. Update Alumni Daily Limit
        transaction.set(alumniRef, {
          alumniData: {
            pointsGiftedToday: pointsGiftedToday + points,
            lastGiftDate: today
          }
        }, { merge: true });

        // 3. Update House Stats
        transaction.set(houseRef, {
          totalPoints: increment(points),
          lastUpdated: serverTimestamp()
        }, { merge: true });

        // 4. Log to History (Points Feed)
        const historyDocRef = doc(collection(db, 'reward_history'));
        transaction.set(historyDocRef, {
          recipientId: recipient.uid,
          recipientName: recipient.displayName,
          recipientRole: recipient.role,
          senderId: userProfile.uid,
          senderName: "Alumnus: " + userProfile.displayName,
          senderRole: "Alumni",
          type: 'points',
          value: awardName,
          points: points,
          reason: reason || `Awarded ${awardName} for student performance`,
          timestamp: serverTimestamp()
        });
      });

      await sendNotification({
        userId: recipient.uid,
        title: `🎓 Alumni Award Received!`,
        message: `Alumnus ${userProfile.displayName} awarded you ${points} points for ${awardName}!`,
        type: 'Reward'
      });

      setReason('');
      setSelectedStudent(null);
    } catch (error) {
      console.error("Awarding failed: ", error);
      alert("Failed to award points. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Alumni Header */}
      <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-[40px] p-8 text-white relative overflow-hidden shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-indigo-500/20 rounded-xl">
                <GraduationCap className="text-indigo-400" size={24} />
              </div>
              <span className="text-indigo-400 font-bold tracking-widest text-xs uppercase">Alumni Mentorship Loop</span>
            </div>
            <h1 className="text-4xl font-black mb-2">Welcome back, {userProfile.displayName}</h1>
            <p className="text-slate-400">
              As an Alumnus, you have the power to inspire the next generation. Watch their progress and sponsor awards to motivate them.
            </p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/10 min-w-[200px]">
            <div className="text-xs font-bold text-indigo-300 uppercase tracking-widest mb-2">Daily Gift Limit</div>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-black text-white">{DAILY_LIMIT - pointsGiftedToday}</span>
              <span className="text-indigo-300 font-bold mb-1">pts left</span>
            </div>
            <div className="mt-4 h-2 bg-white/10 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-indigo-400"
                initial={{ width: 0 }}
                animate={{ width: `${(pointsGiftedToday / DAILY_LIMIT) * 100}%` }}
              />
            </div>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 blur-3xl -mr-32 -mt-32 rounded-full"></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Student List & Search */}
        <div className="lg:col-span-2 space-y-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text"
              placeholder="Search students by name, house, or standard..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-200 focus:border-indigo-500 outline-none bg-white shadow-sm transition-all"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <AnimatePresence mode="popLayout">
              {filteredStudents.map((student) => (
                <motion.div 
                  key={student.uid}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm hover:shadow-xl transition-all group cursor-pointer"
                  onClick={() => setSelectedStudent(student)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-lg">
                      {student.photoURL ? (
                        <img src={student.photoURL} alt="" className="w-full h-full rounded-2xl object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        student.displayName.charAt(0)
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-slate-800 truncate">{student.displayName}</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        {student.houseTeam} • {student.standard}
                      </p>
                    </div>
                    <ChevronRight size={18} className="text-slate-300 group-hover:text-indigo-500 transition-colors" />
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* Right: Real-time Points Feed */}
        <div className="space-y-6">
          <div className="bg-white rounded-[32px] p-6 shadow-sm border border-slate-100 h-full">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-amber-50 rounded-xl">
                <TrendingUp className="text-amber-600" size={20} />
              </div>
              <h3 className="font-bold text-slate-800">Live Points Feed</h3>
            </div>
            <PointsFeed />
          </div>
        </div>
      </div>

      {/* Award Modal */}
      <AnimatePresence>
        {selectedStudent && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="bg-white rounded-[40px] w-full max-w-xl overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-slate-100 flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-indigo-50 rounded-2xl">
                    <Award className="text-indigo-600" size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-800">Sponsor an Award</h2>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">For: {selectedStudent.displayName}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedStudent(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              <div className="p-8 space-y-8">
                <div className="space-y-3">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Info size={14} />
                    Mentorship Message
                  </label>
                  <textarea 
                    rows={2}
                    placeholder="Add a word of encouragement..."
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    className="w-full px-6 py-4 rounded-2xl border border-slate-200 focus:border-indigo-500 outline-none resize-none bg-slate-50"
                  />
                </div>

                <div className="space-y-4">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Select Alumni Award</label>
                  <div className="grid grid-cols-1 gap-3">
                    {ALUMNI_AWARDS.map(award => (
                      <button
                        key={award.name}
                        disabled={isProcessing || pointsGiftedToday + award.points > DAILY_LIMIT}
                        onClick={() => handleAwardPoints(selectedStudent, award.name, award.points)}
                        className="flex items-center justify-between p-5 rounded-2xl border-2 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                        style={{ backgroundColor: award.color, borderColor: award.border, color: award.text }}
                      >
                        <div className="flex items-center gap-4">
                          <div className="p-2 bg-white/50 rounded-lg">
                            {award.icon}
                          </div>
                          <div className="text-left">
                            <span className="font-black uppercase text-sm block">{award.name}</span>
                            <span className="text-[10px] font-bold opacity-70">Encourage the next generation</span>
                          </div>
                        </div>
                        <span className="font-black text-xl">+{award.points}</span>
                      </button>
                    ))}
                  </div>
                </div>
                
                {pointsGiftedToday >= DAILY_LIMIT && (
                  <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-center gap-3 text-amber-700 text-xs font-medium">
                    <Info size={16} />
                    You have reached your daily gift limit of {DAILY_LIMIT} points.
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TrendingUp({ size, className }: { size: number, className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
}

function X({ size, className }: { size: number, className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
