import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, Announcement, PointEntry, LiveClass, ReportCard, QuizResult } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { exportIndividualReport, saveToPortfolio } from '../services/reportService';
import { 
  Trophy, 
  Star, 
  Clock, 
  Megaphone, 
  Video, 
  CheckCircle2, 
  ArrowUpRight,
  TrendingUp,
  Award,
  Calendar,
  FileText,
  Sparkles,
  ChevronRight,
  CreditCard,
  X,
  Archive,
  History as HistoryIcon,
  Download,
  Crown,
  Shield
} from 'lucide-react';
import CurrentAchieversBanner from './CurrentAchieversBanner';

interface StudentDashboardProps {
  userProfile: UserProfile;
  onNavigate?: (tab: string) => void;
  selectedStandard: string | null;
  setSelectedStandard: (standard: string | null) => void;
}

export default function StudentDashboard({ userProfile, onNavigate, selectedStandard, setSelectedStandard }: StudentDashboardProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [points, setPoints] = useState<PointEntry[]>([]);
  const [liveClasses, setLiveClasses] = useState<LiveClass[]>([]);
  const [latestReport, setLatestReport] = useState<ReportCard | null>(null);
  const [quizHistory, setQuizHistory] = useState<QuizResult[]>([]);
  const [attendanceStats, setAttendanceStats] = useState({ present: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [newCardAwarded, setNewCardAwarded] = useState<string | null>(null);
  
  const prevCardsRef = useRef<Record<string, number>>(userProfile.studentData?.cards || userProfile.cards || {});

  useEffect(() => {
    // Listen to user profile for real-time card updates
    const unsubscribeUser = onSnapshot(doc(db, 'users', userProfile.uid), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as UserProfile;
        const currentCards = data.studentData?.cards || data.cards || {};
        const prevCards = prevCardsRef.current;

        // Check for new cards
        Object.entries(currentCards).forEach(([color, count]) => {
          if (count > (prevCards[color] || 0)) {
            handleCelebration(color);
          }
        });

        prevCardsRef.current = currentCards;
      }
    });

    // Announcements for selected standard or "All"
    const qAnn = query(
      collection(db, 'announcements'), 
      orderBy('createdAt', 'desc'),
      limit(10)
    );
    const unsubscribeAnn = onSnapshot(qAnn, (snapshot) => {
      const annList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Announcement[];
      const filtered = annList.filter(a => 
        a.targetAudience === 'All Standards' || 
        (selectedStandard ? a.targetAudience === selectedStandard : a.targetAudience === userProfile.standard)
      );
      setAnnouncements(filtered);
    });

    // Student's points
    const qPoints = query(
      collection(db, 'points'),
      where('studentId', '==', userProfile.uid),
      orderBy('timestamp', 'desc'),
      limit(10)
    );
    const unsubscribePoints = onSnapshot(qPoints, (snapshot) => {
      const pointList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as PointEntry[];
      setPoints(pointList);
    });

    // Live classes for selected standard
    const targetStandard = selectedStandard || userProfile.standard;
    let unsubscribeLive = () => {};
    if (targetStandard) {
      const qLive = query(
        collection(db, 'live_classes'),
        where('status', '==', 'Live'),
        where('standard', '==', targetStandard)
      );
      unsubscribeLive = onSnapshot(qLive, (snapshot) => {
        const liveList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as LiveClass[];
        setLiveClasses(liveList);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }

    // Fetch latest report card
    const qReport = query(
      collection(db, 'report_cards'),
      where('studentId', '==', userProfile.uid),
      orderBy('updatedAt', 'desc'),
      limit(1)
    );
    const unsubscribeReport = onSnapshot(qReport, (snapshot) => {
      if (!snapshot.empty) {
        setLatestReport(snapshot.docs[0].data() as ReportCard);
      }
    });

    // Fetch attendance for current month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    const qAtt = query(
      collection(db, 'attendance'),
      where('studentId', '==', userProfile.uid),
      where('date', '>=', startOfMonth.toISOString().split('T')[0])
    );
    const unsubscribeAtt = onSnapshot(qAtt, (snapshot) => {
      const records = snapshot.docs.map(doc => doc.data());
      const present = records.filter(r => r.status === 'Present' || r.status === 'Late' || r.status === 'Excused').length;
      setAttendanceStats({ present, total: records.length });
    });

    // Fetch Quiz History
    const qQuiz = query(
      collection(db, 'quizResults'),
      where('studentId', '==', userProfile.uid),
      orderBy('timestamp', 'desc')
    );
    const unsubscribeQuiz = onSnapshot(qQuiz, (snapshot) => {
      const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as QuizResult[];
      setQuizHistory(results);
    });

    return () => {
      unsubscribeUser();
      unsubscribeAnn();
      unsubscribePoints();
      unsubscribeLive();
      unsubscribeReport();
      unsubscribeAtt();
      unsubscribeQuiz();
    };
  }, [userProfile.uid, userProfile.standard, selectedStandard]);

  const handleCelebration = (color: string) => {
    setNewCardAwarded(color);
    
    // Trigger confetti
    const duration = 3 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
    }, 250);

    // Auto-hide after 5 seconds
    setTimeout(() => setNewCardAwarded(null), 5000);
  };

  const handleExportReport = async () => {
    setIsExporting(true);
    try {
      await exportIndividualReport(userProfile, quizHistory);
      
      const currentPoints = userProfile.studentData?.points ?? userProfile.totalPoints ?? 0;
      const currentCards = userProfile.studentData?.cards ?? userProfile.cards ?? {};

      // Save to portfolio as well
      await saveToPortfolio(
        userProfile.uid,
        `Self-Generated Report - ${new Date().toLocaleDateString()}`,
        'Progress Report',
        currentPoints,
        Object.entries(currentCards).filter(([_, count]) => (count as number) > 0).map(([color]) => color)
      );
    } catch (error) {
      console.error("Error exporting report:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const totalPoints = points.reduce((sum, p) => sum + p.points, 0);

  const getCardColorStyles = (color: string) => {
    switch(color.toLowerCase()) {
      case 'white': return { bg: 'bg-white', text: 'text-slate-800', border: 'border-slate-200' };
      case 'yellow': return { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' };
      case 'blue': return { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' };
      case 'green': return { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' };
      case 'pink': return { bg: 'bg-pink-100', text: 'text-pink-800', border: 'border-pink-200' };
      default: return { bg: 'bg-slate-100', text: 'text-slate-800', border: 'border-slate-200' };
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <CurrentAchieversBanner onViewHallOfFame={() => onNavigate?.('Hall of Fame')} />
      
      {/* Celebration Modal */}
      <AnimatePresence>
        {newCardAwarded && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.5, y: 100 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5, y: 100 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none"
          >
            <div className={`bg-white rounded-[40px] p-12 shadow-2xl border-4 flex flex-col items-center text-center max-w-sm pointer-events-auto ${getCardColorStyles(newCardAwarded).border}`}>
              <div className={`w-24 h-24 rounded-3xl mb-6 flex items-center justify-center shadow-lg ${getCardColorStyles(newCardAwarded).bg}`}>
                <Award size={48} className={getCardColorStyles(newCardAwarded).text} />
              </div>
              <h2 className="text-3xl font-black text-slate-800 mb-2">Congratulations!</h2>
              <p className="text-slate-500 mb-8">You've been awarded a <span className={`font-bold uppercase ${getCardColorStyles(newCardAwarded).text}`}>{newCardAwarded}</span> card for your outstanding contribution!</p>
              <button 
                onClick={() => setNewCardAwarded(null)}
                className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-bold hover:bg-slate-800 transition-all"
              >
                Awesome!
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Overview */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100">
            {userProfile.photoURL ? (
              <img src={userProfile.photoURL} alt="" className="w-full h-full rounded-2xl object-cover" referrerPolicy="no-referrer" />
            ) : (
              <span className="text-2xl font-black">{userProfile.displayName.charAt(0)}</span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-black text-slate-800">{userProfile.displayName}</h2>
              {userProfile.houseTitle && userProfile.leadershipStatus === 'verified' && (
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-sm ${
                  userProfile.houseTitle === 'Captain' 
                    ? 'bg-amber-100 text-amber-700 border-amber-200' 
                    : 'bg-indigo-100 text-indigo-700 border-indigo-200'
                }`}>
                  {userProfile.houseTitle === 'Captain' ? <Crown size={12} className="fill-amber-500/20" /> : <Shield size={12} className="fill-indigo-500/20" />}
                  {userProfile.houseTitle}
                </div>
              )}
            </div>
            <p className="text-sm text-slate-500 font-medium">{userProfile.standard} • {userProfile.houseTeam}</p>
          </div>
        </div>
        <button
          onClick={handleExportReport}
          disabled={isExporting}
          className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50"
        >
          {isExporting ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Download size={20} />
          )}
          Generate Progress Report
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500">
              <Star size={24} />
            </div>
            <div>
              <h4 className="text-xs uppercase tracking-widest font-bold text-slate-400">Your Points</h4>
              <div className="text-3xl font-black text-slate-800">{totalPoints}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-emerald-500 text-xs font-bold">
            <TrendingUp size={14} />
            <span>Top 10% in {userProfile.houseTeam}</span>
          </div>
        </div>

        <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-500">
              <Trophy size={24} />
            </div>
            <div>
              <h4 className="text-xs uppercase tracking-widest font-bold text-slate-400">House Rank</h4>
              <div className="text-3xl font-black text-slate-800">#4</div>
            </div>
          </div>
          <div className="text-slate-400 text-xs font-medium">
            {userProfile.houseTeam}
          </div>
        </div>

        <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-500">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <h4 className="text-xs uppercase tracking-widest font-bold text-slate-400">Attendance</h4>
              <div className="text-3xl font-black text-slate-800">
                {attendanceStats.total > 0 
                  ? Math.round((attendanceStats.present / attendanceStats.total) * 100) 
                  : 100}%
              </div>
            </div>
          </div>
          <div className="text-slate-400 text-xs font-medium">
            {attendanceStats.present} of {attendanceStats.total} days this month
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Announcements & Live Classes */}
        <div className="lg:col-span-2 space-y-8">
          {/* Live Classes Alert */}
          <AnimatePresence>
            {liveClasses.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-red-500 rounded-[32px] p-6 text-white shadow-xl shadow-red-100 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-6 opacity-10">
                  <Video size={80} />
                </div>
                <div className="relative z-10 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center">
                      <Video size={24} />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">Live Class in Progress</h3>
                      <p className="text-sm opacity-80">{liveClasses[0].title} • {liveClasses[0].teacherName}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => onNavigate?.('Live Class')}
                    className="bg-white text-red-500 px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-red-50 transition-all"
                  >
                    Join Now
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Academic Report Card Summary */}
          {latestReport && (
            <section>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Sparkles size={24} className="text-indigo-500" />
                  Academic Progress
                </h3>
                <button 
                  onClick={() => onNavigate?.('Progress Card')}
                  className="text-xs font-bold text-indigo-600 flex items-center gap-1 hover:underline"
                >
                  View Full Card <ChevronRight size={14} />
                </button>
              </div>
              <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform duration-500">
                  <Trophy size={120} />
                </div>
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Overall Performance</div>
                      <div className="text-4xl font-black text-slate-800">{latestReport.overallGrade}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">House Points</div>
                      <div className="text-2xl font-bold text-indigo-600">+{latestReport.housePerformance}%</div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    {Object.entries(latestReport.subjects).slice(0, 4).map(([name, data]) => (
                      <div key={name} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 truncate">{name}</div>
                        <div className="text-lg font-bold text-slate-800">{(data as any).grade}</div>
                      </div>
                    ))}
                  </div>

                  <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles size={14} className="text-indigo-500" />
                      <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">AI Insight</span>
                    </div>
                    <p className="text-sm text-indigo-900 leading-relaxed italic line-clamp-2">
                      "{latestReport.summary}"
                    </p>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Announcements */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Megaphone size={24} className="text-blue-500" />
                Announcements
              </h3>
            </div>
            <div className="space-y-4">
              {announcements.length === 0 ? (
                <div className="bg-white rounded-[32px] p-12 border border-slate-100 text-center text-slate-400 italic">
                  No recent announcements
                </div>
              ) : (
                announcements.map(ann => (
                  <div key={ann.id} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          ann.priority === 'High' ? 'bg-red-50 text-red-600' :
                          ann.priority === 'Medium' ? 'bg-amber-50 text-amber-600' :
                          'bg-blue-50 text-blue-600'
                        }`}>
                          {ann.priority}
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                          {ann.category}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {ann.createdAt?.toDate().toLocaleDateString()}
                      </span>
                    </div>
                    <h4 className="font-bold text-slate-800 mb-2">{ann.title}</h4>
                    <p className="text-sm text-slate-500 leading-relaxed">{ann.message}</p>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* Right Column: Points Feed & House Standings */}
        <div className="space-y-8">
          <section>
            <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
              <Award size={24} className="text-amber-500" />
              Recent Points
            </h3>
            <div className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm space-y-4">
              {points.length === 0 ? (
                <p className="text-slate-400 text-sm italic text-center py-8">No points earned yet</p>
              ) : (
                points.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-amber-500 shadow-sm">
                        <Star size={16} fill="currentColor" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800">{p.reason}</div>
                        <div className="text-[10px] text-slate-400">{p.timestamp?.toDate().toLocaleDateString()}</div>
                      </div>
                    </div>
                    <div className="text-sm font-black text-emerald-500">+{p.points}</div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section>
            <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
              <Clock size={24} className="text-slate-400" />
              Upcoming
            </h3>
            <div className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm space-y-4">
              <div className="flex items-center gap-4 p-4 border border-slate-50 rounded-2xl">
                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-500">
                  <Calendar size={20} />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-800">Weekly Quiz</div>
                  <div className="text-[10px] text-slate-400">Friday, 10:00 AM</div>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 border border-slate-50 rounded-2xl">
                <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-500">
                  <FileText size={20} />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-800">Unit Test - Math</div>
                  <div className="text-[10px] text-slate-400">Next Monday</div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Legacy Badges Section */}
      {userProfile.legacyBadges && userProfile.legacyBadges.length > 0 && (
        <section className="mt-12">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3">
              <HistoryIcon className="text-amber-500" size={32} />
              Legacy Hall of Fame
            </h3>
            <span className="px-4 py-1 bg-amber-50 text-amber-600 rounded-full text-xs font-black uppercase tracking-widest border border-amber-100">
              {userProfile.legacyBadges.length} Badges Earned
            </span>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {userProfile.legacyBadges.map((badge, idx) => (
              <motion.div 
                key={idx}
                whileHover={{ y: -8 }}
                className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
                  <Award size={80} />
                </div>
                <div className="relative z-10">
                  <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500 mb-4">
                    <Trophy size={24} />
                  </div>
                  <div className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">{badge.year}</div>
                  <div className="text-xl font-black text-slate-800 mb-4">Master Batch Achievement</div>
                  
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl">
                    <div className="text-xs font-bold text-slate-500">Final Points</div>
                    <div className="text-lg font-black text-amber-600">{badge.totalPoints}</div>
                  </div>

                  <div className="flex gap-1 mt-4">
                    {Object.entries(badge.cards).map(([color, count]) => (
                      count > 0 && (
                        <div 
                          key={color}
                          title={`${count} ${color} cards`}
                          className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black ${getCardColorStyles(color).bg} ${getCardColorStyles(color).text} border ${getCardColorStyles(color).border}`}
                        >
                          {count}
                        </div>
                      )
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
