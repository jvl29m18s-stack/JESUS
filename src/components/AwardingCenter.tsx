import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  where, 
  orderBy,
  doc,
  runTransaction,
  updateDoc,
  increment,
  serverTimestamp,
  addDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '../firestoreErrorHandler';
import { Search, X, Award, Shield, Users, CreditCard, AlertTriangle, ChevronRight, Info, Crown, Check, Ban } from 'lucide-react';
import { sendNotification } from '../services/notificationService';

interface AwardingCenterProps {
  userProfile: UserProfile;
}

const CARD_COLORS = [
  { name: 'White', color: '#ffffff', text: '#1e293b', border: '#e2e8f0', points: 1 },
  { name: 'Yellow', color: '#fef08a', text: '#854d0e', border: '#fde047', points: 2 },
  { name: 'Blue', color: '#bfdbfe', text: '#1e40af', border: '#93c5fd', points: 5 },
  { name: 'Green', color: '#bbf7d0', text: '#166534', border: '#86efac', points: 10 },
  { name: 'Pink', color: '#fbcfe8', text: '#9d174d', border: '#f9a8d4', points: 20 },
];

const HOUSE_CONFIG = {
  'GOOD PATRON': { color: '#ef4444', light: '#fef2f2', border: '#fee2e2', badge: 'Ruby' },
  'GOOD SHEPHERD': { color: '#10b981', light: '#f0fdf4', border: '#dcfce7', badge: 'Emerald' },
  'GOOD SAVIOUR': { color: '#f59e0b', light: '#fffbeb', border: '#fef3c7', badge: 'Amber' },
  'GOOD PIONEER': { color: '#3b82f6', light: '#eff6ff', border: '#dbeafe', badge: 'Sapphire' },
};

export default function AwardingCenter({ userProfile }: AwardingCenterProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'Student' | 'Leader' | 'Leadership Requests'>('Student');
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [reason, setReason] = useState('');

  const isAdmin = userProfile.role === 'Admin';
  const isLeader = userProfile.role === 'Leader';

  useEffect(() => {
    if (isLeader) {
      const checkActivityStreak = async () => {
        const today = new Date().toISOString().split('T')[0];
        const lastCheck = userProfile.leaderData?.lastCommandCenterCheck;
        
        if (lastCheck !== today) {
          const senderRef = doc(db, 'users', userProfile.uid);
          const currentStreak = (userProfile.leaderData?.activityStreak || 0) + 1;
          const currentPoints = (userProfile.leaderData?.pointsDistributed || 0) + 10; // 10 points for daily check
          const currentStudents = userProfile.leaderData?.distinctStudentsHelped || 0;
          
          // Recalculate impact score
          const newImpactScore = Math.round(currentPoints * (currentStudents * 0.5));

          try {
            await updateDoc(senderRef, {
              'leaderData.lastCommandCenterCheck': today,
              'leaderData.activityStreak': increment(1),
              'leaderData.pointsDistributed': increment(10),
              'leaderData.leadershipImpactScore': newImpactScore
            });
          } catch (error) {
            console.error("Error updating activity streak:", error);
          }
        }
      };
      checkActivityStreak();
    }
  }, [isLeader, userProfile.uid, userProfile.leaderData]);

  useEffect(() => {
    // Fetch both Students and Leaders
    const q = query(collection(db, 'users'), where('role', 'in', ['Student', 'Leader', 'Admin']));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const userList = snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      })) as UserProfile[];
      setUsers(userList);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredUsers = users.filter(u => {
    // Hierarchical filtering:
    // 1. Don't show self
    if (u.uid === userProfile.uid) return false;
    
    // 2. Leaders cannot see Admins in the list (cannot award them)
    if (isLeader && u.role === 'Admin') return false;

    const matchesSearch = u.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.houseTeam && u.houseTeam.toLowerCase().includes(searchQuery.toLowerCase()));
    
    if (roleFilter === 'Leadership Requests') {
      return matchesSearch && u.leadershipStatus === 'pending_verification';
    }

    const matchesRole = u.role === roleFilter;
    
    return matchesSearch && matchesRole;
  });

  const handleAwardCard = async (recipient: UserProfile, cardColor: string, points: number) => {
    if (isProcessing) return;
    
    // Security Check
    if (isLeader && recipient.role === 'Admin') {
      alert("Permission Denied: Leaders cannot award points to Admins.");
      return;
    }

    setIsProcessing(true);
    const recipientRef = doc(db, 'users', recipient.uid);
    const historyRef = collection(db, 'reward_history');
    const houseName = recipient.houseTeam || 'Other';
    const houseRef = doc(db, 'house_stats', houseName);

    try {
      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(recipientRef);
        if (!userDoc.exists()) throw new Error("User does not exist!");
        
        const userData = userDoc.data() as UserProfile;
        const currentCards = userData.studentData?.cards || userData.cards || {};
        const colorKey = cardColor.toLowerCase();
        
        // 1. Update Recipient
        transaction.set(recipientRef, {
          totalPoints: increment(points),
          [`cards.${colorKey}`]: (userData.cards?.[colorKey as keyof typeof userData.cards] || 0) + 1,
          // Support dual-role structure
          studentData: {
            points: (userData.studentData?.points || userData.totalPoints || 0) + points,
            cards: {
              ...currentCards,
              [colorKey]: (currentCards[colorKey as keyof typeof currentCards] || 0) + 1
            }
          },
          updatedAt: serverTimestamp()
        }, { merge: true });

        // 1b. Update Sender if Leader
        if (isLeader) {
          const senderRef = doc(db, 'users', userProfile.uid);
          const helpedStudentRef = doc(db, 'users', userProfile.uid, 'helped_students', recipient.uid);
          const helpedDoc = await transaction.get(helpedStudentRef);
          
          const isNewStudent = !helpedDoc.exists();
          const currentPoints = (userProfile.leaderData?.pointsDistributed || 0) + points;
          const currentStudents = (userProfile.leaderData?.distinctStudentsHelped || 0) + (isNewStudent ? 1 : 0);
          
          // Impact = points * (students * 0.5)
          const newImpactScore = Math.round(currentPoints * (currentStudents * 0.5));

          transaction.set(senderRef, {
            leaderData: {
              pointsDistributed: increment(points),
              distinctStudentsHelped: increment(isNewStudent ? 1 : 0),
              leadershipImpactScore: newImpactScore
            }
          }, { merge: true });

          if (isNewStudent) {
            transaction.set(helpedStudentRef, {
              timestamp: serverTimestamp()
            });
          }
        }

        // 2. Update House Stats
        transaction.set(houseRef, {
          [`cardCounts.${colorKey}`]: increment(1),
          totalPoints: increment(points),
          lastUpdated: serverTimestamp()
        }, { merge: true });

        // 3. Log to History
        transaction.set(doc(historyRef), {
          recipientId: recipient.uid,
          recipientName: recipient.displayName,
          recipientRole: recipient.role,
          senderId: userProfile.uid,
          senderName: userProfile.displayName,
          senderRole: userProfile.role,
          type: 'card',
          value: cardColor,
          points: points,
          reason: reason || `Awarded a ${cardColor} card`,
          timestamp: serverTimestamp()
        });
      });

      await sendNotification({
        userId: recipient.uid,
        title: `${cardColor} Card Awarded! 🏆`,
        message: `Congratulations! You have been awarded a ${cardColor} card by ${userProfile.displayName}. Reason: ${reason || 'Outstanding contribution'}`,
        type: 'Reward'
      });

      setReason('');
      setSelectedUser(null);
    } catch (error) {
      console.error("Awarding failed: ", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeductPoints = async (recipient: UserProfile) => {
    if (!isAdmin) return; // Only Admins can deduct
    if (isProcessing) return;

    setIsProcessing(true);
    const pointsToDeduct = 10; // Standard Red Card deduction
    const recipientRef = doc(db, 'users', recipient.uid);
    const historyRef = collection(db, 'reward_history');
    const houseName = recipient.houseTeam || 'Other';
    const houseRef = doc(db, 'house_stats', houseName);

    try {
      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(recipientRef);
        if (!userDoc.exists()) throw new Error("User does not exist!");
        
        const userData = userDoc.data() as UserProfile;
        const currentRedCards = userData.redCards || 0;

        // 1. Update Recipient
        transaction.set(recipientRef, {
          totalPoints: increment(-pointsToDeduct),
          redCards: currentRedCards + 1,
          updatedAt: serverTimestamp()
        }, { merge: true });

        // 2. Update House Stats
        transaction.set(houseRef, {
          redCardCount: increment(1),
          totalPoints: increment(-pointsToDeduct),
          lastUpdated: serverTimestamp()
        }, { merge: true });

        // 3. Log to History
        transaction.set(doc(historyRef), {
          recipientId: recipient.uid,
          recipientName: recipient.displayName,
          recipientRole: recipient.role,
          senderId: userProfile.uid,
          senderName: userProfile.displayName,
          senderRole: userProfile.role,
          type: 'deduction',
          value: 'Red Card',
          points: -pointsToDeduct,
          reason: reason || 'Rule violation (Red Card)',
          timestamp: serverTimestamp()
        });
      });

      await sendNotification({
        userId: recipient.uid,
        title: `Point Deduction: Red Card ⚠️`,
        message: `A Red Card has been issued by ${userProfile.displayName}. 10 points have been deducted. Reason: ${reason || 'Rule violation'}`,
        type: 'System'
      });

      setReason('');
      setSelectedUser(null);
    } catch (error) {
      console.error("Deduction failed: ", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApproveLeadership = async (user: UserProfile, status: 'verified' | 'rejected') => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        leadershipStatus: status,
        isLeadershipPublic: status === 'verified',
        houseTitle: status === 'rejected' ? 'None' : user.houseTitle,
        updatedAt: serverTimestamp()
      });

      if (status === 'verified') {
        await addDoc(collection(db, 'leadership_legacy'), {
          year: new Date().getFullYear().toString(),
          userId: user.uid,
          userName: user.displayName,
          role: user.role,
          houseTitle: user.houseTitle,
          houseTeam: user.houseTeam,
          photoURL: user.photoURL || null,
          timestamp: serverTimestamp()
        });
      }

      await sendNotification({
        userId: user.uid,
        title: status === 'verified' ? 'Leadership Approved! 👑' : 'Leadership Request Update',
        message: status === 'verified' 
          ? `Congratulations! Your request to be ${user.houseTitle} of ${user.houseTeam} has been verified by Admin.`
          : `Your request for ${user.houseTitle} has been declined. Contact Admin for details.`,
        type: 'System'
      });
    } catch (error) {
      console.error("Approval failed: ", error);
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="bg-slate-900 rounded-[40px] p-8 text-white relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-500/20 rounded-xl">
              <Shield className="text-blue-400" size={24} />
            </div>
            <span className="text-blue-400 font-bold tracking-widest text-xs uppercase">Institutional Control</span>
          </div>
          <h1 className="text-4xl font-black mb-2">Academic Command Center</h1>
          <p className="text-slate-400 max-w-xl">
            {isAdmin 
              ? "Full administrative access. You can award or deduct points from any Student or Leader." 
              : "Leader access. You can award points to Students and fellow Leaders."}
          </p>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 blur-3xl -mr-20 -mt-20 rounded-full"></div>
      </div>

      {/* Search & Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text"
            placeholder="Search by Name or House (e.g. Good Pioneer)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-200 focus:border-blue-500 outline-none bg-white shadow-sm"
          />
        </div>
        <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl">
          <button 
            onClick={() => setRoleFilter('Student')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${
              roleFilter === 'Student' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Users size={18} />
            Students
          </button>
          <button 
            onClick={() => setRoleFilter('Leader')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${
              roleFilter === 'Leader' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Shield size={18} />
            Leaders
          </button>
          {isAdmin && (
            <button 
              onClick={() => setRoleFilter('Leadership Requests')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${
                roleFilter === 'Leadership Requests' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Crown size={18} />
              Requests
            </button>
          )}
        </div>
      </div>

      {/* User Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredUsers.map((user) => {
            const houseInfo = HOUSE_CONFIG[user.houseTeam as keyof typeof HOUSE_CONFIG] || { color: '#64748b', light: '#f8fafc', border: '#f1f5f9', badge: 'Other' };
            
            return (
              <motion.div 
                key={user.uid}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm hover:shadow-xl transition-all group"
              >
                <div className="flex items-center gap-4 mb-6">
                  <div 
                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg transform group-hover:rotate-6 transition-transform"
                    style={{ backgroundColor: houseInfo.color }}
                  >
                    {user.displayName.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-800">{user.displayName}</h3>
                      {user.role === 'Leader' && <Shield size={14} className="text-blue-500" />}
                    </div>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                      {user.houseTeam} • {user.standard}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-black text-slate-800">{user.totalPoints || 0}</div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Points</div>
                  </div>
                </div>

                {roleFilter === 'Leadership Requests' ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                      <div className="flex items-center gap-2 text-amber-700 font-bold text-sm mb-1">
                        <Crown size={16} />
                        Requested: {user.houseTitle}
                      </div>
                      <p className="text-[10px] text-amber-600 font-medium italic">
                        Waiting for official verification to display badge.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        disabled={isProcessing}
                        onClick={() => handleApproveLeadership(user, 'verified')}
                        className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-500 text-white rounded-xl font-bold text-xs hover:bg-emerald-600 transition-all disabled:opacity-50"
                      >
                        <Check size={14} />
                        Approve
                      </button>
                      <button
                        disabled={isProcessing}
                        onClick={() => handleApproveLeadership(user, 'rejected')}
                        className="flex-1 flex items-center justify-center gap-2 py-3 bg-rose-500 text-white rounded-xl font-bold text-xs hover:bg-rose-600 transition-all disabled:opacity-50"
                      >
                        <Ban size={14} />
                        Decline
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-5 gap-2 mb-6">
                  {CARD_COLORS.map(card => (
                    <button
                      key={card.name}
                      onClick={() => {
                        setSelectedUser(user);
                        setReason('');
                      }}
                      className="flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all hover:scale-110 active:scale-95"
                      style={{ backgroundColor: card.color, borderColor: card.border, color: card.text }}
                      title={`Award ${card.name} Card (${card.points} pts)`}
                    >
                      <CreditCard size={18} />
                      <span className="text-[8px] font-black uppercase">{card.points}</span>
                    </button>
                  ))}
                </div>

                    <button 
                      onClick={() => {
                        setSelectedUser(user);
                        setReason('');
                      }}
                      className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-colors group/btn"
                    >
                      <span className="text-xs font-bold text-slate-600">Open Award Panel</span>
                      <ChevronRight size={16} className="text-slate-400 group-hover/btn:translate-x-1 transition-transform" />
                    </button>
                  </>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Award Modal */}
      <AnimatePresence>
        {selectedUser && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="bg-white rounded-[40px] w-full max-w-xl overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-slate-100 flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-50 rounded-2xl">
                    <Award className="text-blue-600" size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-800">Awarding Panel</h2>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Recipient: {selectedUser.displayName}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedUser(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              <div className="p-8 space-y-8">
                {/* Reason Input */}
                <div className="space-y-3">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Info size={14} />
                    Reason for Awarding
                  </label>
                  <textarea 
                    rows={2}
                    placeholder="Why are you awarding this card? (e.g. Excellent project work)"
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    className="w-full px-6 py-4 rounded-2xl border border-slate-200 focus:border-blue-500 outline-none resize-none bg-slate-50"
                  />
                </div>

                {/* Card Selection */}
                <div className="space-y-4">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Select Merit Card</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {CARD_COLORS.map(card => (
                      <button
                        key={card.name}
                        disabled={isProcessing}
                        onClick={() => handleAwardCard(selectedUser, card.name, card.points)}
                        className="flex items-center justify-between p-4 rounded-2xl border-2 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                        style={{ backgroundColor: card.color, borderColor: card.border, color: card.text }}
                      >
                        <div className="flex items-center gap-3">
                          <CreditCard size={20} />
                          <span className="font-black uppercase text-sm">{card.name} Card</span>
                        </div>
                        <span className="font-black text-lg">+{card.points}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Admin Only: Red Card */}
                {isAdmin && (
                  <div className="pt-4 border-t border-slate-100">
                    <button
                      disabled={isProcessing}
                      onClick={() => handleDeductPoints(selectedUser)}
                      className="w-full flex items-center justify-between p-4 bg-red-50 border-2 border-red-100 text-red-600 rounded-2xl hover:bg-red-100 transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <AlertTriangle size={20} className="group-hover:animate-pulse" />
                        <span className="font-black uppercase text-sm">Issue Red Card (Deduction)</span>
                      </div>
                      <span className="font-black text-lg">-10</span>
                    </button>
                    <p className="mt-2 text-[10px] text-center text-red-400 font-bold uppercase tracking-tighter">
                      Warning: Red cards deduct 10 points and log a disciplinary entry.
                    </p>
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
