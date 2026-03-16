import React, { useState, useEffect } from 'react';
import { 
  Users, 
  GraduationCap, 
  Trophy, 
  Activity,
  AlertTriangle,
  Trash2,
  TrendingUp,
  Calendar,
  Circle,
  UserCheck,
  BookOpen,
  Layout,
  Megaphone,
  Eye,
  Star,
  Sparkles,
  Crown,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  onSnapshot,
  doc,
  deleteDoc,
  where,
  getCountFromServer,
  getDocs,
  addDoc,
  serverTimestamp,
  setDoc,
  writeBatch,
  increment
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { PointEntry, HouseStats, UserProfile, Announcement, HallOfFameEntry, ArchiveBatch } from '../types';
import CurrentAchieversBanner from './CurrentAchieversBanner';
import { handleFirestoreError, OperationType } from '../firestoreErrorHandler';
import { generateAndAwardLeaderCertificate } from '../services/certificateService';
import LiveSessionManager from './LiveSession/LiveSessionManager';
import { ShieldAlert, RefreshCw, X } from 'lucide-react';

interface AdminDashboardProps {
  standardCounts: Record<string, number>;
  selectedStandard: string | null;
  setSelectedStandard: (standard: string | null) => void;
  userRole: string;
  userProfile: UserProfile;
}

export default function AdminDashboard({ standardCounts, selectedStandard, setSelectedStandard, userRole, userProfile }: AdminDashboardProps) {
  const [pointsFeed, setPointsFeed] = useState<PointEntry[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<UserProfile[]>([]);
  const [recentAnnouncements, setRecentAnnouncements] = useState<Announcement[]>([]);
  const [stats, setStats] = useState({
    teachers: 0,
    classes: 0,
    courses: 0
  });
  const [houseStats, setHouseStats] = useState<HouseStats[]>([]);
  const [attendanceStats, setAttendanceStats] = useState<Record<string, number>>({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const executeAnnualReset = async () => {
    if (resetConfirmText !== `RESET ${new Date().getFullYear()}`) {
      alert("Incorrect verification phrase.");
      return;
    }

    setIsResetting(true);
    try {
      const batch = writeBatch(db);
      const now = new Date();
      const yearLabel = now.getFullYear().toString();
      const batchId = `Batch_${yearLabel}`;

      // 1. Get current house stats for summary
      const housesSnap = await getDocs(collection(db, 'house_stats'));
      const housesData = housesSnap.docs.map(d => ({ id: d.id, ...d.data() } as HouseStats));
      
      const totalPoints = housesData.reduce((acc, h) => acc + h.totalPoints, 0);
      const winningHouse = housesData.sort((a, b) => b.totalPoints - a.totalPoints)[0]?.id || 'None';
      const totalCards = housesData.reduce((acc, h) => {
        const counts = h.cardCounts || {};
        return acc + (counts.white || 0) + (counts.yellow || 0) + (counts.blue || 0) + (counts.green || 0) + (counts.pink || 0);
      }, 0);

      // 2. Create Archive Batch Entry
      const archiveBatchRef = doc(db, 'archive_batches', batchId);
      batch.set(archiveBatchRef, {
        id: batchId,
        yearLabel,
        archivedAt: serverTimestamp(),
        archivedBy: auth.currentUser?.uid || 'unknown',
        archivedByName: auth.currentUser?.displayName || 'Admin',
        summary: {
          totalPoints,
          winningHouse,
          totalCards
        }
      });

      // 3. Archive House Stats
      housesData.forEach(house => {
        const archiveHouseRef = doc(db, 'archived_house_stats', `${batchId}_${house.id}`);
        batch.set(archiveHouseRef, {
          ...house,
          batchId
        });

        // Reset current house stats
        const houseRef = doc(db, 'house_stats', house.id);
        batch.set(houseRef, {
          totalPoints: 0,
          cardCounts: {
            white: 0,
            yellow: 0,
            blue: 0,
            green: 0,
            pink: 0
          },
          lastUpdated: serverTimestamp()
        }, { merge: true });
      });

      // 4. Archive Student Stats (Legacy Badges)
      const studentsSnap = await getDocs(query(collection(db, 'users'), where('totalPoints', '>', 0)));
      studentsSnap.docs.forEach(studentDoc => {
        const student = studentDoc.data() as UserProfile;
        const studentRef = doc(db, 'users', studentDoc.id);
        
        const newBadge = {
          year: yearLabel,
          totalPoints: student.totalPoints || 0,
          cards: student.cards || {}
        };

        batch.update(studentRef, {
          totalPoints: 0,
          cards: {
            white: 0,
            yellow: 0,
            blue: 0,
            green: 0,
            pink: 0
          },
          legacyBadges: [...(student.legacyBadges || []), newBadge],
          updatedAt: serverTimestamp()
        });
      });

      // 5. Delete current points (limit to 500 for safety in one batch)
      const pointsSnap = await getDocs(query(collection(db, 'points'), limit(400)));
      pointsSnap.docs.forEach(pDoc => {
        batch.delete(pDoc.ref);
      });

      await batch.commit();

      // 6. Create Announcement
      await addDoc(collection(db, 'announcements'), {
        title: `🎊 Annual Reset Complete - Welcome to ${parseInt(yearLabel) + 1}!`,
        message: `The annual reset is finished. All points have been archived to the Legacy Vault. Good luck to all houses in the new session!`,
        type: 'Urgent',
        targetAudience: 'All Standards',
        status: 'Published',
        authorName: 'System',
        authorId: 'system',
        createdAt: serverTimestamp()
      });

      alert("Annual Reset Successful! Page will reload.");
      window.location.reload();
    } catch (error) {
      console.error("Reset failed:", error);
      handleFirestoreError(error, OperationType.WRITE, 'archive_batches');
      alert("Reset failed. Check console.");
    } finally {
      setIsResetting(false);
      setShowResetModal(false);
    }
  };

  const analyzeAndAwardPerformers = async (periodType: 'Monthly' | 'Yearly') => {
    setIsAnalyzing(true);
    try {
      // 1. ANALYZE BEST HOUSE
      const houseQuery = query(collection(db, "house_stats"), orderBy("totalPoints", "desc"), limit(1));
      const houseSnap = await getDocs(houseQuery);
      if (houseSnap.empty) throw new Error("No house stats found");
      const winningHouseDoc = houseSnap.docs[0];
      const winningHouseData = winningHouseDoc.data() as HouseStats;
      const winningHouseName = winningHouseDoc.id;

      // 2. ANALYZE STUDENT OF THE MONTH (Based on Points)
      // Note: In a real app, you might weigh grades and cards here
      const studentQuery = query(
        collection(db, "users"), 
        where("role", "in", ["Student", "Leader"]),
        orderBy("totalPoints", "desc"), 
        limit(1)
      );
      const studentSnap = await getDocs(studentQuery);
      if (studentSnap.empty) throw new Error("No student data found");
      const topStudent = studentSnap.docs[0].data() as UserProfile;

      const now = new Date();
      const period = periodType === 'Monthly' 
        ? now.toLocaleString('default', { month: 'long', year: 'numeric' })
        : now.getFullYear().toString();

      // 3. SAVE TO HALL OF FAME
      const entryData: Omit<HallOfFameEntry, 'id'> = {
        winnerHouse: winningHouseName,
        studentOfMonth: topStudent.displayName,
        studentId: topStudent.uid,
        period: period,
        type: periodType,
        totalPoints: winningHouseData.totalPoints,
        houseColor: HOUSE_COLORS[winningHouseName] || '#94a3b8',
        timestamp: serverTimestamp()
      };

      await addDoc(collection(db, "hall_of_fame"), entryData);

      // 4. TRIGGER GLOBAL CELEBRATION
      await setDoc(doc(db, 'announcements', 'global_celebration'), {
        winnerHouse: winningHouseName,
        studentName: topStudent.displayName,
        period: period,
        trigger: Date.now()
      });

      // 5. CREATE ANNOUNCEMENT
      await addDoc(collection(db, 'announcements'), {
        title: `🏆 ${period} Champions Announced!`,
        message: `Congratulations to ${winningHouseName} and ${topStudent.displayName} for being our top performers this ${periodType === 'Monthly' ? 'month' : 'year'}!`,
        type: 'Event',
        targetAudience: 'All Standards',
        status: 'Published',
        authorName: 'System Analysis',
        authorId: 'system',
        createdAt: serverTimestamp()
      });

      // 6. ANALYZE AND AWARD TOP LEADERS (NEW)
      if (periodType === 'Monthly') {
        const leaderQuery = query(
          collection(db, "users"),
          where("role", "==", "Leader"),
          orderBy("leaderData.leadershipImpactScore", "desc"),
          limit(3)
        );
        const leaderSnap = await getDocs(leaderQuery);
        
        for (const leaderDoc of leaderSnap.docs) {
          const leaderData = leaderDoc.data() as UserProfile;
          if (leaderData.leaderData?.leadershipImpactScore && leaderData.leaderData.leadershipImpactScore > 0) {
            await generateAndAwardLeaderCertificate(leaderData);
          }
        }
      }

      alert(`Analysis Complete! ${winningHouseName} and ${topStudent.displayName} are the winners! ${periodType === 'Monthly' ? 'Top Leaders have been awarded certificates.' : ''}`);
    } catch (error) {
      console.error("Analysis failed:", error);
      handleFirestoreError(error, OperationType.WRITE, 'hall_of_fame');
      alert("Analysis failed. Check console for details.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const totalStudents = selectedStandard && selectedStandard !== 'All Standards'
    ? (standardCounts[`std${selectedStandard.split(' ')[1]}`] || 0)
    : Object.values(standardCounts).reduce((a, b) => a + b, 0);

  const totalPoints = houseStats.reduce((acc, curr) => acc + curr.totalPoints, 0);

  const handleDeletePoint = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'points', id));
    } catch (e) {
      console.error("Failed to delete point entry:", e);
    }
  };

  useEffect(() => {
    // Live Points Feed and House Stats
    let pointsQuery = query(collection(db, 'points'), orderBy('timestamp', 'desc'));
    if (selectedStandard && selectedStandard !== 'All Standards') {
      pointsQuery = query(collection(db, 'points'), where('standard', '==', selectedStandard), orderBy('timestamp', 'desc'));
    }

    const unsubscribePoints = onSnapshot(pointsQuery, (snapshot) => {
      const entries = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PointEntry[];
      
      // Update feed (limit to 5)
      setPointsFeed(entries.slice(0, 5));
    });

    // House Stats Real-time
    const qStats = query(collection(db, 'house_stats'), orderBy('totalPoints', 'desc'));
    const unsubscribeStats = onSnapshot(qStats, (snapshot) => {
      const statsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as HouseStats[];
      setHouseStats(statsList);
    });

    // Live Attendance Stats for Today
    const todayStr = new Date().toISOString().split('T')[0];
    let attendanceQuery = query(collection(db, 'attendance'), where('date', '==', todayStr));
    if (selectedStandard && selectedStandard !== 'All Standards') {
      attendanceQuery = query(collection(db, 'attendance'), where('date', '==', todayStr), where('standard', '==', selectedStandard));
    }

    const unsubscribeAttendance = onSnapshot(attendanceQuery, (snapshot) => {
      const counts: Record<string, number> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        let std = data.standard; // e.g., "Standard 10" or "10"
        if (std && !std.startsWith('Standard ')) {
          std = `Standard ${std}`;
        }
        const status = data.status;
        if (std && (status === 'Present' || status === 'Late' || status === 'Excused')) {
          counts[std] = (counts[std] || 0) + 1;
        }
      });
      setAttendanceStats(counts);
    });

    // Online Users
    let onlineQuery = query(collection(db, 'users'), where('isOnline', '==', true));
    if (selectedStandard && selectedStandard !== 'All Standards') {
      onlineQuery = query(collection(db, 'users'), where('isOnline', '==', true), where('standard', '==', selectedStandard));
    }

    const unsubscribeOnline = onSnapshot(onlineQuery, (snapshot) => {
      const users = snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      })) as UserProfile[];
      setOnlineUsers(users);
    });

    // Recent Announcements
    let annQuery = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'), limit(3));
    if (selectedStandard && selectedStandard !== 'All Standards') {
      annQuery = query(collection(db, 'announcements'), where('targetAudience', 'in', ['All', selectedStandard]), orderBy('createdAt', 'desc'), limit(3));
    }

    const unsubscribeAnn = onSnapshot(annQuery, (snapshot) => {
      const anns = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Announcement[];
      setRecentAnnouncements(anns);
    });

    // Real-time Counts
    let teachersQuery = query(collection(db, 'users'), where('role', 'in', ['Admin', 'Leader']));
    let coursesQuery: any = collection(db, 'courses');
    let classesQuery: any = collection(db, 'live_classes');

    if (selectedStandard && selectedStandard !== 'All Standards') {
      coursesQuery = query(collection(db, 'courses'), where('standard', '==', selectedStandard));
      classesQuery = query(collection(db, 'live_classes'), where('standard', '==', selectedStandard));
    }

    const unsubscribeTeachers = onSnapshot(teachersQuery, (snap) => {
      setStats(prev => ({ ...prev, teachers: snap.size }));
    });
    const unsubscribeCourses = onSnapshot(coursesQuery, (snap) => {
      setStats(prev => ({ ...prev, courses: snap.size }));
    });
    const unsubscribeClasses = onSnapshot(classesQuery, (snap) => {
      setStats(prev => ({ ...prev, classes: snap.size }));
    });

    return () => {
      unsubscribePoints();
      unsubscribeStats();
      unsubscribeOnline();
      unsubscribeAnn();
      unsubscribeAttendance();
      unsubscribeTeachers();
      unsubscribeCourses();
      unsubscribeClasses();
    };
  }, [selectedStandard]);

  const today = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <CurrentAchieversBanner />
      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Admin Dashboard</h1>
          <p className="text-slate-500 text-sm">Real-time Overview</p>
        </div>
        <div className="text-slate-400 text-sm font-medium flex items-center gap-2">
          <Calendar size={16} />
          {today}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Total Students" 
          value={totalStudents.toLocaleString()} 
          subtitle="All Standards"
          icon={<Users className="text-blue-500" />}
          iconBg="bg-blue-50"
        />
        <StatCard 
          title="Total Teachers" 
          value={stats.teachers.toString()} 
          subtitle="Admin & Leaders"
          icon={<GraduationCap className="text-purple-500" />}
          iconBg="bg-purple-50"
        />
        <StatCard 
          title="Total Classes" 
          value={stats.classes.toString()} 
          subtitle="Live & Scheduled"
          icon={<Layout className="text-emerald-500" />}
          iconBg="bg-emerald-50"
        />
        <StatCard 
          title="Total Courses" 
          value={stats.courses.toString()} 
          subtitle="Academic Content"
          icon={<BookOpen className="text-orange-500" />}
          iconBg="bg-orange-50"
        />
      </div>

      {/* Analysis Engine Section */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
          <TrendingUp size={160} />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="max-w-xl">
            <div className="flex items-center gap-2 text-amber-400 font-black uppercase tracking-widest text-xs mb-4">
              <Sparkles size={16} />
              <span>Real-Time Analysis Engine</span>
            </div>
            <h2 className="text-3xl font-black mb-4 tracking-tight">One-Click Recognition</h2>
            <p className="text-slate-400 font-medium text-sm leading-relaxed">
              Our automated engine scans all student points, card distributions, and academic grades to determine the top performers. Awarding winners will trigger a school-wide celebration.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
            <button
              onClick={() => analyzeAndAwardPerformers('Monthly')}
              disabled={isAnalyzing}
              className="px-8 py-4 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isAnalyzing ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Trophy size={18} />}
              Award Best of Month
            </button>
            <button
              onClick={() => analyzeAndAwardPerformers('Yearly')}
              disabled={isAnalyzing}
              className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all backdrop-blur-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isAnalyzing ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Star size={18} />}
              Award Best of Year
            </button>
          </div>
        </div>
      </div>

      {/* Live Session Control */}
      <div className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-100">
        <LiveSessionManager userProfile={userProfile} />
      </div>

      {/* House Leadership Section for Leaders */}
      {userProfile.role === 'Leader' && userProfile.houseTitle !== 'None' && userProfile.leadershipStatus === 'verified' && (
        <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-[32px] p-8 text-white shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
            <Crown size={160} />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center">
                <Crown size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-black tracking-tight">House Leadership</h2>
                <p className="text-indigo-100 text-sm font-medium uppercase tracking-widest">
                  {userProfile.houseTitle} of {userProfile.houseTeam}
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/10">
                <h3 className="font-bold mb-2">Command Authority</h3>
                <p className="text-sm text-indigo-100 mb-4">
                  As a verified {userProfile.houseTitle}, you have been granted administrative tools to manage your house and award points.
                </p>
                <div className="flex items-center gap-2">
                  <div className="px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-[10px] font-bold uppercase tracking-widest border border-emerald-500/30">
                    Verified Status
                  </div>
                  <div className="px-3 py-1 bg-amber-500/20 text-amber-300 rounded-full text-[10px] font-bold uppercase tracking-widest border border-amber-500/30">
                    House Leader
                  </div>
                </div>
              </div>
              
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/10">
                <h3 className="font-bold mb-2">Institutional Legacy</h3>
                <p className="text-sm text-indigo-100 mb-4">
                  Your service has been recorded in the Institutional History. You are now part of the school's permanent archive.
                </p>
                <button 
                  onClick={() => window.dispatchEvent(new CustomEvent('changeTab', { detail: 'Institutional History' }))}
                  className="text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:gap-3 transition-all"
                >
                  View Legacy Vault <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Announcements */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2 text-orange-600 font-bold">
              <Megaphone size={20} />
              <span>Recent Announcements</span>
            </div>
            <button className="text-xs font-bold text-blue-600 hover:underline">View All</button>
          </div>
          <div className="space-y-4">
            {recentAnnouncements.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm italic">
                No recent announcements
              </div>
            ) : (
              recentAnnouncements.map((ann) => (
                <div key={ann.id} className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex justify-between items-center group">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`w-2 h-2 rounded-full ${ann.status === 'Published' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                      <h4 className="font-bold text-slate-800 text-sm truncate">{ann.title}</h4>
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-1">{ann.message}</p>
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-400 font-medium">
                      <span>To: {ann.targetAudience}</span>
                      <span>By: {ann.authorName}</span>
                    </div>
                  </div>
                  <button className="p-2 text-slate-300 hover:text-blue-500 transition-all">
                    <Eye size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Online Users List */}
        <div className="lg:col-span-1 bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col h-[400px]">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2 text-blue-600 font-bold">
              <Circle size={10} className="fill-blue-500 animate-pulse" />
              <span>Online Users</span>
            </div>
            <span className="text-[10px] text-slate-300 font-bold uppercase">{onlineUsers.length} Active</span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
            <AnimatePresence mode="popLayout">
              {onlineUsers.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm italic">
                  No users currently online
                </div>
              ) : (
                onlineUsers.map((u) => (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    key={u.uid} 
                    className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-blue-200 transition-all group"
                  >
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm overflow-hidden">
                      {u.photoURL ? (
                        <img src={u.photoURL} alt={u.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        u.displayName.charAt(0)
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-slate-800 truncate">{u.displayName}</div>
                      <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                        {u.role} {u.standard && `• Std ${u.standard}`}
                      </div>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Live Points Feed */}
        <div className="lg:col-span-1 bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col h-[500px]">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2 text-emerald-600 font-bold">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span>Live Points Feed</span>
            </div>
            <span className="text-[10px] text-slate-300 font-bold uppercase">Real-time</span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
            {pointsFeed.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm italic">
                No recent point entries
              </div>
            ) : (
              pointsFeed.map((entry) => (
                <div key={entry.id} className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100 relative group">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${entry.isAlert ? 'bg-red-50 text-red-500' : 'bg-purple-50 text-purple-500'}`}>
                      {entry.isAlert ? <AlertTriangle size={16} /> : <TrendingUp size={16} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800 text-sm truncate">{entry.studentName}</span>
                        <span className="text-emerald-500 font-bold text-sm">+{entry.points.toLocaleString()}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-1">{entry.reason}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[9px] text-slate-400">
                          {entry.timestamp?.toDate()?.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        </span>
                        <span className="text-[9px] px-2 py-0.5 bg-slate-200 text-slate-500 rounded-full font-bold">
                          {entry.house}
                        </span>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleDeletePoint(entry.id)}
                      className="text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* House Points */}
        <div className="lg:col-span-1 bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-8 text-amber-600 font-bold">
            <Trophy size={20} />
            <span>House Points</span>
          </div>
          <div className="space-y-8">
            {houseStats.map((house) => {
              const maxPoints = Math.max(...houseStats.map(h => h.totalPoints)) || 1;
              const percentage = (house.totalPoints / maxPoints) * 100;
              const houseColor = HOUSE_COLORS[house.id] || '#94a3b8';
              return (
                <div key={house.id} className="space-y-2">
                  <div className="flex justify-between items-end">
                    <span className="font-bold text-slate-800 text-sm" style={{ color: houseColor }}>{house.id}</span>
                    <span className="font-bold text-slate-900 text-lg">{house.totalPoints.toLocaleString()}</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: houseColor }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Today's Attendance Grid */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <div className="flex items-center gap-2 mb-6 text-blue-600 font-bold">
          <Calendar size={20} />
          <span>Attendance by Standard</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((std) => {
            const standardLabel = `Standard ${std}`;
            const total = standardCounts[`std${std}`] || 0;
            const present = attendanceStats[standardLabel] || 0;
            const percentage = total > 0 ? Math.round((present / total) * 100) : 0;
            
            return (
              <div key={std} className="bg-slate-50/50 rounded-xl p-4 border border-slate-100 flex flex-col items-center justify-center text-center">
                <span className="text-[10px] text-slate-400 font-bold uppercase mb-1">Std {std}</span>
                <span className={`text-xl font-bold ${percentage > 75 ? 'text-emerald-600' : percentage > 50 ? 'text-orange-500' : 'text-slate-800'}`}>
                  {percentage}%
                </span>
                <span className="text-[10px] text-slate-300 font-bold">{total} Students</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Danger Zone - Admin Only */}
      {userRole === 'Admin' && (
        <div className="bg-red-50 rounded-3xl p-8 border border-red-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
            <ShieldAlert size={160} className="text-red-600" />
          </div>
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="max-w-xl">
              <div className="flex items-center gap-2 text-red-600 font-black uppercase tracking-widest text-xs mb-4">
                <ShieldAlert size={16} />
                <span>Danger Zone</span>
              </div>
              <h2 className="text-3xl font-black text-slate-800 mb-4 tracking-tight">Annual Day Reset</h2>
              <p className="text-slate-500 font-medium text-sm leading-relaxed">
                This action will archive all current points and house statistics to the Legacy Vault, reset all leaderboards to zero, and clear the points feed. This is irreversible.
              </p>
            </div>
            <button
              onClick={() => setShowResetModal(true)}
              className="px-8 py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-lg shadow-red-600/20 flex items-center gap-2 whitespace-nowrap"
            >
              <RefreshCw size={18} />
              Run Annual Day Reset
            </button>
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      <AnimatePresence>
        {showResetModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl border border-red-100 relative"
            >
              <button 
                onClick={() => setShowResetModal(false)}
                className="absolute top-6 right-6 p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X size={20} className="text-slate-400" />
              </button>

              <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-red-500 mb-6">
                <ShieldAlert size={32} />
              </div>

              <h3 className="text-2xl font-black text-slate-800 mb-2">Are you absolutely sure?</h3>
              <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                This will wipe all current leaderboards and archive the data. To confirm, please type <span className="font-black text-red-600">RESET {new Date().getFullYear()}</span> below.
              </p>

              <input
                type="text"
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value)}
                placeholder={`Type RESET ${new Date().getFullYear()}`}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl mb-6 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
              />

              <div className="flex gap-3">
                <button
                  onClick={() => setShowResetModal(false)}
                  className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={executeAnnualReset}
                  disabled={isResetting || resetConfirmText !== `RESET ${new Date().getFullYear()}`}
                  className="flex-1 py-4 bg-red-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-red-700 transition-all disabled:opacity-50 shadow-lg shadow-red-600/20 flex items-center justify-center gap-2"
                >
                  {isResetting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <RefreshCw size={16} />}
                  Confirm Reset
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

const HOUSE_COLORS: Record<string, string> = {
  'GOOD PATRON': '#ef4444',
  'GOOD SHEPHERD': '#10b981',
  'GOOD SAVIOUR': '#f59e0b',
  'GOOD PIONEER': '#3b82f6'
};

function StatCard({ title, value, subtitle, subtitleColor = "text-slate-400", icon, iconBg }: any) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center justify-between">
      <div className="min-w-0">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 truncate">{title}</p>
        <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
        <p className={`text-[10px] font-bold ${subtitleColor} mt-1 truncate`}>{subtitle}</p>
      </div>
      <div className={`w-12 h-12 rounded-2xl ${iconBg} flex-shrink-0 flex items-center justify-center`}>
        {icon}
      </div>
    </div>
  );
}
