import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  serverTimestamp, 
  where, 
  orderBy,
  doc,
  runTransaction,
  increment
} from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, PointEntry, RewardHistory } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '../firestoreErrorHandler';
import { Search, Plus, Minus, X, Star, Award, TrendingUp, Filter, CreditCard } from 'lucide-react';
import { sendNotification } from '../services/notificationService';

interface StudentPointsManagerProps {
  userProfile: UserProfile;
  selectedStandard: string;
  setSelectedStandard: (standard: string) => void;
}

const CARD_COLORS = [
  { name: 'White', color: '#ffffff', text: '#1e293b', border: '#e2e8f0' },
  { name: 'Yellow', color: '#fef08a', text: '#854d0e', border: '#fde047' },
  { name: 'Blue', color: '#bfdbfe', text: '#1e40af', border: '#93c5fd' },
  { name: 'Green', color: '#bbf7d0', text: '#166534', border: '#86efac' },
  { name: 'Pink', color: '#fbcfe8', text: '#9d174d', border: '#f9a8d4' },
];

const HOUSE_CONFIG = {
  'GOOD PATRON': { color: '#ef4444', light: '#fef2f2', border: '#fee2e2', badge: 'Ruby' },
  'GOOD SHEPHERD': { color: '#10b981', light: '#f0fdf4', border: '#dcfce7', badge: 'Emerald' },
  'GOOD SAVIOUR': { color: '#f59e0b', light: '#fffbeb', border: '#fef3c7', badge: 'Amber' },
  'GOOD PIONEER': { color: '#3b82f6', light: '#eff6ff', border: '#dbeafe', badge: 'Sapphire' },
};

const getCardWeight = (color: string) => {
  switch (color.toLowerCase()) {
    case 'white': return 1;
    case 'yellow': return 2;
    case 'blue': return 5;
    case 'green': return 10;
    case 'pink': return 20;
    default: return 0;
  }
};

export default function StudentPointsManager({ userProfile, selectedStandard, setSelectedStandard }: StudentPointsManagerProps) {
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [points, setPoints] = useState<PointEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<UserProfile | null>(null);
  const [modalType, setModalType] = useState<'Award' | 'Deduct' | 'Card' | null>(null);
  const [formData, setFormData] = useState({
    points: 10,
    category: 'Academic' as PointEntry['category'],
    reason: ''
  });

  const canAward = ['Admin', 'Leader', 'Alumni'].includes(userProfile.role);

  useEffect(() => {
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

    const qPoints = query(collection(db, 'points'), orderBy('timestamp', 'desc'));
    const unsubscribePoints = onSnapshot(qPoints, (snapshot) => {
      const pointList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PointEntry[];
      setPoints(pointList);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'points');
      setLoading(false);
    });

    return () => {
      unsubscribeStudents();
      unsubscribePoints();
    };
  }, []);

  const getStudentPoints = (studentId: string) => {
    return points
      .filter(p => p.studentId === studentId)
      .reduce((sum, p) => sum + p.points, 0);
  };

  const filteredStudents = students.filter(s => {
    const matchesSearch = s.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.standard && s.standard.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStandard = selectedStandard === 'All Standards' || s.standard === selectedStandard;
    return matchesSearch && matchesStandard;
  });

  const handleAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !modalType || !userProfile) return;

    const pointsValue = modalType === 'Award' ? formData.points : -formData.points;
    const userRef = doc(db, 'users', selectedStudent.uid);
    const historyRef = collection(db, 'reward_history');

    try {
      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) throw new Error("User does not exist!");
        
        const userData = userDoc.data() as UserProfile;
        const currentPoints = userData.totalPoints || 0;

        // 1. Update the student's total points
        transaction.set(userRef, {
          totalPoints: currentPoints + pointsValue,
          updatedAt: serverTimestamp()
        }, { merge: true });

        // 2. Log the points entry (existing points collection for backward compatibility if needed, but we'll also log to history)
        const newPointRef = doc(collection(db, 'points'));
        transaction.set(newPointRef, {
          studentId: selectedStudent.uid,
          studentName: selectedStudent.displayName,
          points: pointsValue,
          reason: formData.reason,
          category: formData.category,
          house: selectedStudent.houseTeam || 'Other',
          timestamp: serverTimestamp(),
          awardedBy: userProfile.uid,
          awardedByName: userProfile.displayName
        });

        // 3. Add to the real-time institutional history collection
        transaction.set(doc(historyRef), {
          recipientId: selectedStudent.uid,
          recipientName: selectedStudent.displayName,
          senderId: userProfile.uid,
          senderName: userProfile.displayName,
          senderRole: userProfile.role,
          type: 'points',
          value: pointsValue.toString(),
          reason: formData.reason,
          timestamp: serverTimestamp()
        });

        // 4. Update House Stats
        const houseName = selectedStudent.houseTeam || 'Other';
        const houseRef = doc(db, 'house_stats', houseName);
        transaction.set(houseRef, {
          totalPoints: increment(pointsValue),
          lastUpdated: serverTimestamp()
        }, { merge: true });
      });

      // Send notification to student
      await sendNotification({
        userId: selectedStudent.uid,
        title: pointsValue > 0 ? 'Points Awarded! 🌟' : 'Points Deducted',
        message: pointsValue > 0 
          ? `You have been awarded ${pointsValue} points for ${formData.category}. Reason: ${formData.reason}`
          : `You have had ${Math.abs(pointsValue)} points deducted for ${formData.category}. Reason: ${formData.reason}`,
        type: 'Reward'
      });

      setSelectedStudent(null);
      setModalType(null);
      setFormData({ points: 10, category: 'Academic', reason: '' });
    } catch (error) {
      console.error("Error awarding points:", error);
    }
  };

  const handleAwardCard = async (cardColor: string) => {
    if (!selectedStudent || !userProfile) return;

    const userRef = doc(db, 'users', selectedStudent.uid);
    const historyRef = collection(db, 'reward_history');

    try {
      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) throw new Error("User does not exist!");
        
        const userData = userDoc.data() as UserProfile;
        const currentCards = userData.cards || {};
        const colorKey = cardColor.toLowerCase();
        
        // 1. Update the student's card count
        transaction.update(userRef, {
          [`cards.${colorKey}`]: (currentCards[colorKey as keyof typeof currentCards] || 0) + 1,
          updatedAt: serverTimestamp()
        });

        // 2. Add to the real-time history collection
        transaction.set(doc(historyRef), {
          recipientId: selectedStudent.uid,
          recipientName: selectedStudent.displayName,
          senderId: userProfile.uid,
          senderName: userProfile.displayName,
          senderRole: userProfile.role,
          type: 'card',
          value: cardColor,
          reason: formData.reason || `Awarded a ${cardColor} card`,
          timestamp: serverTimestamp()
        });

        // 3. Update House Stats
        const houseName = selectedStudent.houseTeam || 'Other';
        const houseRef = doc(db, 'house_stats', houseName);
        const weight = getCardWeight(cardColor);
        transaction.set(houseRef, {
          [`cardCounts.${colorKey}`]: increment(1),
          totalPoints: increment(weight),
          lastUpdated: serverTimestamp()
        }, { merge: true });
      });

      // Send notification to student
      await sendNotification({
        userId: selectedStudent.uid,
        title: `${cardColor} Card Awarded! 🏆`,
        message: `Congratulations! You have been awarded a ${cardColor} card. Reason: ${formData.reason || 'Outstanding performance'}`,
        type: 'Reward'
      });

      setSelectedStudent(null);
      setModalType(null);
      setFormData({ points: 10, category: 'Academic', reason: '' });
    } catch (error) {
      console.error("Transaction failed: ", error);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Student Points & Cards</h1>
          <p className="text-slate-500 text-sm">Award points or colored cards to students</p>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text"
            placeholder="Search students..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 outline-none"
          />
        </div>
      </div>

      {/* Student Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredStudents.map((student) => {
          const totalPoints = getStudentPoints(student.uid);
          const houseInfo = HOUSE_CONFIG[student.houseTeam as keyof typeof HOUSE_CONFIG] || { color: '#64748b', light: '#f8fafc', border: '#f1f5f9', badge: 'Other' };
          
          return (
            <motion.div 
              key={student.uid}
              layout
              className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm hover:shadow-md transition-all"
            >
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                  <div 
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
                    style={{ backgroundColor: houseInfo.color }}
                  >
                    {student.displayName.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">{student.displayName}</h3>
                    <p className="text-xs text-slate-400 font-medium">Std {student.standard}</p>
                  </div>
                </div>
                <span 
                  className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border"
                  style={{ 
                    color: houseInfo.color, 
                    backgroundColor: houseInfo.light,
                    borderColor: houseInfo.border
                  }}
                >
                  {houseInfo.badge}
                </span>
              </div>

              <div className="flex items-center justify-between mb-6 p-4 bg-slate-50 rounded-2xl">
                <div className="flex items-center gap-2 text-slate-400">
                  <Award size={18} />
                  <span className="text-xs font-bold uppercase tracking-widest">Total Points</span>
                </div>
                <div className="text-2xl font-black text-slate-800">
                  {totalPoints.toLocaleString()}
                </div>
              </div>

              {canAward && (
                <div className="grid grid-cols-3 gap-3">
                  <button 
                    onClick={() => {
                      setSelectedStudent(student);
                      setModalType('Award');
                    }}
                    className="flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all"
                  >
                    <Plus size={18} />
                    Award
                  </button>
                  <button 
                    onClick={() => {
                      setSelectedStudent(student);
                      setModalType('Card');
                    }}
                    className="flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all"
                  >
                    <CreditCard size={18} />
                    Card
                  </button>
                  <button 
                    onClick={() => {
                      setSelectedStudent(student);
                      setModalType('Deduct');
                    }}
                    className="flex items-center justify-center gap-2 py-3 border border-red-200 text-red-600 rounded-xl font-bold text-sm hover:bg-red-50 transition-all"
                  >
                    <Minus size={18} />
                    Deduct
                  </button>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Award/Deduct/Card Modal */}
      <AnimatePresence>
        {selectedStudent && modalType && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[32px] w-full max-w-lg p-8 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-bold text-slate-800">{modalType} {modalType === 'Card' ? 'Reward' : 'Points'}</h2>
                <button onClick={() => setSelectedStudent(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                  <X size={20} />
                </button>
              </div>

              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl mb-8">
                <div 
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
                  style={{ backgroundColor: (HOUSE_CONFIG[selectedStudent.houseTeam as keyof typeof HOUSE_CONFIG] || { color: '#64748b' }).color }}
                >
                  {selectedStudent.displayName.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">{selectedStudent.displayName}</h3>
                  <p className="text-xs text-slate-400 font-medium">
                    Std {selectedStudent.standard} • {HOUSE_CONFIG[selectedStudent.houseTeam as keyof typeof HOUSE_CONFIG]?.badge || 'Other'}
                  </p>
                </div>
              </div>

              {modalType === 'Card' ? (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Select Card Color</label>
                    <div className="grid grid-cols-5 gap-2">
                      {CARD_COLORS.map(card => (
                        <button
                          key={card.name}
                          onClick={() => handleAwardCard(card.name)}
                          className="flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all hover:scale-105"
                          style={{ backgroundColor: card.color, borderColor: card.border, color: card.text }}
                        >
                          <CreditCard size={24} />
                          <span className="text-[10px] font-black uppercase">{card.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Reason (Optional)</label>
                    <textarea 
                      rows={2}
                      placeholder="Enter reason..."
                      value={formData.reason}
                      onChange={e => setFormData({ ...formData, reason: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 outline-none resize-none"
                    />
                  </div>
                </div>
              ) : (
                <form onSubmit={handleAction} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Points</label>
                    <input 
                      type="number"
                      required
                      min="1"
                      value={formData.points}
                      onChange={e => setFormData({ ...formData, points: parseInt(e.target.value) || 0 })}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Category</label>
                    <select 
                      value={formData.category}
                      onChange={e => setFormData({ ...formData, category: e.target.value as any })}
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
                      value={formData.reason}
                      onChange={e => setFormData({ ...formData, reason: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 outline-none resize-none"
                    />
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button 
                      type="button"
                      onClick={() => setSelectedStudent(null)}
                      className="flex-1 py-3 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      className={`flex-1 py-3 text-white rounded-xl font-bold transition-all ${
                        modalType === 'Award' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
                      }`}
                    >
                      {modalType} Points
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
