import React, { useState, useEffect, useRef } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, onSnapshot, setDoc, getDoc, updateDoc, serverTimestamp, getDocs, query, where, limit, collection, deleteDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserProfile, RecentAccount } from './types';
import { handleFirestoreError, OperationType } from './firestoreErrorHandler';
import Login from './components/Login';
import ProfileForm from './components/ProfileForm';
import StudentProgressTracker from './components/StudentProgressTracker';
import AdminDashboard from './components/AdminDashboard';
import AnnouncementManager from './components/AnnouncementManager';
import LiveClassManager from './components/LiveClassManager';
import AttendanceTracker from './components/AttendanceTracker';
import TestResultsManager from './components/TestResultsManager';
import QuizMonitor from './components/QuizMonitor';
import HousePointsDashboard from './components/HousePointsDashboard';
import StudentDashboard from './components/StudentDashboard';
import CourseManager from './components/CourseManager';
import AcademicManager from './components/AcademicManager';
import ReportManager from './components/ReportManager';
import AIStudentStory from './components/AIStudentStory';
import UserSettings from './components/Settings';
import CommunityDirectory from './components/CommunityDirectory';
import QuizAnalytics from './components/QuizAnalytics';
import StudentPointsManager from './components/StudentPointsManager';
import AwardingCenter from './components/AwardingCenter';
import AlumniDashboard from './components/AlumniDashboard';
import Leaderboard from './components/Leaderboard';
import EventManager from './components/EventManager';
import RewardHistory from './components/RewardHistory';
import ArchiveManager from './components/ArchiveManager';
import LegacyVault from './components/LegacyVault';
import HallOfFame from './components/HallOfFame';
import LeadershipLegacy from './components/LeadershipLegacy';
import CelebrationOverlay from './components/CelebrationOverlay';
import Portfolio from './components/Portfolio';
import { 
  LogOut, 
  GraduationCap, 
  LayoutDashboard, 
  Settings, 
  Calendar, 
  CheckCircle2, 
  BarChart3, 
  FileSpreadsheet, 
  BarChart, 
  PieChart, 
  CheckCircle, 
  Star, 
  Users, 
  FileText, 
  Sparkles,
  ChevronRight,
  BookOpen,
  ChevronDown,
  Home,
  Megaphone,
  Radio,
  TrendingUp,
  ShieldCheck,
  Shield,
  ClipboardList,
  UserCircle,
  ArrowUp,
  Menu,
  History as HistoryIcon,
  Archive,
  Trophy,
  X as CloseIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import NotificationCenter from './components/NotificationCenter';
import LiveToastContainer from './components/LiveToastContainer';
import LiveTelecastBanner from './components/LiveTelecastBanner';
import LiveTelecastPlayer from './components/LiveTelecastPlayer';
import LiveSessionBanner from './components/LiveSession/LiveSessionBanner';
import { UploadProvider } from './components/UploadContext';
import { UploadOverlay } from './components/UploadOverlay';
import { ConnectionStatus } from './components/ConnectionStatus';
import { LiveClass, LiveTelecast } from './types';
import { onForegroundMessage } from './services/fcmService';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [adminProfile, setAdminProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('Events');
  const [viewMode, setViewMode] = useState<'Student' | 'Leader'>('Student');
  const [selectedStandard, setSelectedStandard] = useState<string>('All Standards');
  const [isAcademicsOpen, setIsAcademicsOpen] = useState(false);
  const [standardCounts, setStandardCounts] = useState<Record<string, number>>({});
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [liveClasses, setLiveClasses] = useState<LiveClass[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTelecast, setActiveTelecast] = useState<LiveTelecast | null>(null);
  const mainContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mainContentRef.current) {
      mainContentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      setScrollProgress(0);
    }
  }, [activeTab, selectedStandard]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    const scrollTop = element.scrollTop;
    const scrollHeight = element.scrollHeight - element.clientHeight;
    
    if (scrollHeight > 0) {
      setScrollProgress((scrollTop / scrollHeight) * 100);
    }
    
    setShowScrollTop(scrollTop > 400);
  };

  const scrollToTop = () => {
    if (mainContentRef.current) {
      mainContentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;
    let unsubscribeStandards: (() => void) | undefined;
    let unsubscribeLive: (() => void) | undefined;
    let unsubscribeFCM: (() => void) | undefined;
    let unsubscribeAdmin: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      
      // Cleanup previous listeners
      if (unsubscribeProfile) unsubscribeProfile();
      if (unsubscribeStandards) unsubscribeStandards();
      if (unsubscribeLive) unsubscribeLive();
      if (unsubscribeFCM) unsubscribeFCM();
      if (unsubscribeAdmin) unsubscribeAdmin();

      if (firebaseUser) {
        // Real-time Admin Profile listener for Global Header
        const qAdmin = query(collection(db, 'users'), where('role', '==', 'Admin'), limit(1));
        unsubscribeAdmin = onSnapshot(qAdmin, (snap) => {
          if (!snap.empty) {
            setAdminProfile(snap.docs[0].data() as UserProfile);
          }
        }, (error) => {
          console.error("Admin profile listener error:", error);
          handleFirestoreError(error, OperationType.GET, 'users (Admin query)');
        });

        // Live classes listener
        const qLive = query(collection(db, 'live_classes'), where('status', '==', 'Live'));
        unsubscribeLive = onSnapshot(qLive, (snapshot) => {
          const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as LiveClass[];
          setLiveClasses(list);
        }, (error) => {
          console.error("Live classes listener error:", error);
          handleFirestoreError(error, OperationType.GET, 'live_classes');
        });

        unsubscribeProfile = onSnapshot(doc(db, 'users', firebaseUser.uid), async (docSnap) => {
          if (docSnap.exists()) {
            const profileData = docSnap.data() as UserProfile;
            
            // Kick logic: if user is deleted, force logout
            if (profileData.isDeleted) {
              signOut(auth);
              setProfile(null);
              setUser(null);
              return;
            }

            setProfile(profileData);
            
            // Save to recent accounts for Family Switcher
            const recentAccount: RecentAccount = {
              uid: profileData.uid,
              displayName: profileData.displayName,
              email: profileData.email,
              photoURL: profileData.photoURL,
              role: profileData.role,
              standard: profileData.standard,
              houseTeam: profileData.houseTeam
            };
            const savedAccounts = localStorage.getItem('recent_accounts');
            let accounts: RecentAccount[] = savedAccounts ? JSON.parse(savedAccounts) : [];
            accounts = [recentAccount, ...accounts.filter(a => a.uid !== recentAccount.uid)].slice(0, 2);
            localStorage.setItem('recent_accounts', JSON.stringify(accounts));

            if ((profileData.role === 'Student' || profileData.role === 'Leader') && profileData.standard) {
              setSelectedStandard(profileData.standard);
            }
          } else {
            // Check for pre-registered profile
            try {
              const tempId = `temp_${firebaseUser.email?.toLowerCase().trim()}`;
              const tempDoc = await getDoc(doc(db, 'users', tempId));
              
              if (tempDoc.exists()) {
                const tempData = tempDoc.data();
                const newProfile = {
                  ...tempData,
                  uid: firebaseUser.uid,
                  displayName: firebaseUser.displayName || tempData.displayName,
                  photoURL: firebaseUser.photoURL || tempData.photoURL,
                  updatedAt: serverTimestamp()
                };
                delete (newProfile as any).isPreRegistered;
                
                await setDoc(doc(db, 'users', firebaseUser.uid), newProfile);
                await deleteDoc(doc(db, 'users', tempId));
                // The snapshot listener will fire again for the new doc
              } else {
                setProfile(null);
              }
            } catch (error) {
              console.error("Error claiming profile:", error);
              setProfile(null);
            }
          }
          setLoading(false);
        }, (error) => {
          try {
            handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
          } catch (e) {
            console.error(e);
          } finally {
            setLoading(false);
          }
        });

        // Real-time listener for standard counts
        const qStudents = query(collection(db, 'users'), where('role', 'in', ['Student', 'Leader']));
        unsubscribeStandards = onSnapshot(qStudents, (snapshot) => {
          const counts: Record<string, number> = {};
          for (let i = 1; i <= 12; i++) counts[`std${i}`] = 0;
          
          snapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.standard) {
              const stdStr = String(data.standard);
              const stdNum = stdStr.replace('Standard ', '');
              counts[`std${stdNum}`] = (counts[`std${stdNum}`] || 0) + 1;
            }
          });
          setStandardCounts(counts);
        }, (error) => {
          try {
            handleFirestoreError(error, OperationType.GET, 'users');
          } catch (e) {
            console.error(e);
          }
        });

        // Initialize FCM foreground listener
        unsubscribeFCM = onForegroundMessage((payload) => {
          console.log('FCM Message in foreground:', payload);
        });
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
      if (unsubscribeStandards) unsubscribeStandards();
      if (unsubscribeLive) unsubscribeLive();
      if (unsubscribeFCM) unsubscribeFCM();
      if (unsubscribeAdmin) unsubscribeAdmin();
    };
  }, []);

  // Global Error and WebSocket Handling
  useEffect(() => {
    const handleGlobalError = (event: ErrorEvent) => {
      console.error('Global Runtime Error:', event.error);
      // Suppress Vite WebSocket noise if it leaks as a runtime error
      if (event.message?.includes('WebSocket')) {
        event.preventDefault();
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason?.toString() || '';
      
      // Suppress the expected Vite WebSocket error in this environment
      if (reason.includes('WebSocket closed without opened') || reason.includes('failed to connect to websocket')) {
        console.warn('Suppressed expected environment WebSocket error:', reason);
        event.preventDefault();
        return;
      }

      console.error('Unhandled Promise Rejection:', event.reason);
    };

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  const handleLogout = () => signOut(auth);

  useEffect(() => {
    if (!profile?.houseTeam) {
      document.body.className = '';
      return;
    }

    const houseClass = profile.houseTeam.toLowerCase().replace(' ', '-');
    document.body.className = `theme-${houseClass}`;

    return () => {
      document.body.className = '';
    };
  }, [profile?.houseTeam]);

  useEffect(() => {
    if (!profile?.uid) return;

    // Set online status
    const userRef = doc(db, 'users', profile.uid);
    setDoc(userRef, {
      isOnline: true,
      lastActive: serverTimestamp()
    }, { merge: true }).catch(err => console.error("Error setting online status:", err));

    const handleVisibilityChange = () => {
      setDoc(userRef, {
        isOnline: document.visibilityState === 'visible',
        lastActive: serverTimestamp()
      }, { merge: true }).catch(err => console.error("Error updating visibility:", err));
    };

    const handleBeforeUnload = () => {
      setDoc(userRef, {
        isOnline: false,
        lastActive: serverTimestamp()
      }, { merge: true }).catch(err => console.error("Error setting offline status:", err));
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      setDoc(userRef, {
        isOnline: false,
        lastActive: serverTimestamp()
      }, { merge: true }).catch(err => console.error("Error setting offline status on cleanup:", err));
    };
  }, [profile?.uid]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  if (!profile) {
    return <ProfileForm onComplete={setProfile} />;
  }

  const isAdmin = profile.role === 'Admin';
  const isLeader = profile.role === 'Leader';
  const isAlumni = profile.role === 'Alumni';

  const navItems: { icon: React.ReactNode; label: string; adminOnly?: boolean; leaderOnly?: boolean; studentOnly?: boolean; alumniOnly?: boolean; subItems?: string[] }[] = [
    { icon: <Home size={20} />, label: 'Dashboard' },
    { 
      icon: <BookOpen size={20} />, 
      label: 'Academics',
      subItems: Array.from({ length: 12 }, (_, i) => `Standard ${i + 1}`)
    },
    { icon: <Megaphone size={20} />, label: 'Create Announcement', adminOnly: true },
    { icon: <Megaphone size={20} />, label: 'Manage Announcements', adminOnly: true },
    { icon: <Radio size={20} />, label: 'Live Class' },
    { icon: <Calendar size={20} />, label: 'Events' },
    { icon: <CheckCircle2 size={20} />, label: 'Attendance', leaderOnly: true },
    { icon: <BarChart3 size={20} />, label: 'Progress Card', studentOnly: true },
    { icon: <ClipboardList size={20} />, label: 'Test Results', studentOnly: true },
    { icon: <BarChart size={20} />, label: 'Quiz Monitor', leaderOnly: true },
    { icon: <PieChart size={20} />, label: 'Quiz Analytics' },
    { icon: <ShieldCheck size={20} />, label: 'House Points' },
    { icon: <Shield size={20} />, label: 'Command Center', leaderOnly: true },
    { icon: <Trophy size={20} />, label: 'Rankings' },
    { icon: <Star size={20} />, label: 'Student Points', leaderOnly: true },
    { icon: <HistoryIcon size={20} />, label: 'Institutional History' },
    { icon: <Archive size={20} />, label: 'Annual Reset', adminOnly: true },
    { icon: <HistoryIcon size={20} />, label: 'Legacy Vault', studentOnly: true },
    { icon: <Trophy size={20} />, label: 'Hall of Fame' },
    { icon: <Shield size={20} />, label: 'Achievement Vault', studentOnly: true },
    { icon: <Users size={20} />, label: 'Community Directory' },
    { icon: <FileText size={20} />, label: 'Report Generation', leaderOnly: true },
    { icon: <Sparkles size={20} />, label: 'AI Student Story', studentOnly: true },
    { icon: <Settings size={20} />, label: 'Settings' },
  ];

  const filteredNavItems = navItems.filter(item => {
    if (item.adminOnly && profile.role !== 'Admin') return false;
    if (item.alumniOnly && profile.role !== 'Alumni') return false;
    
    if (isLeader) {
      if (viewMode === 'Student' && item.leaderOnly) return false;
      if (viewMode === 'Leader' && item.studentOnly) return false;
    } else if (profile.role === 'Student') {
      if (item.leaderOnly) return false;
    } else if (profile.role === 'Alumni') {
      if (item.leaderOnly || item.studentOnly || item.adminOnly) return false;
    }
    
    return true;
  }).map(item => {
    if (item.label === 'Academics' && profile.role === 'Student') {
      const { subItems, ...rest } = item;
      return rest;
    }
    return item;
  });

  const mobileNavItems = [
    { icon: <Home size={20} />, label: 'Dashboard' },
    { icon: <Calendar size={20} />, label: 'Events' },
    { icon: <Radio size={20} />, label: 'Live Class' },
    { icon: <BookOpen size={20} />, label: 'Academics' },
    ...(profile.role === 'Admin' || profile.role === 'Leader' 
      ? [{ icon: <CheckCircle2 size={20} />, label: 'Attendance' }] 
      : []),
    { icon: <Menu size={20} />, label: 'More' },
  ];

  return (
    <UploadProvider>
      <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row overflow-hidden">
        <ConnectionStatus />
        <UploadOverlay />
        <CelebrationOverlay />
        <LiveToastContainer userProfile={profile} />
        <LiveSessionBanner />
      
      <AnimatePresence>
        {activeTelecast && (
          <LiveTelecastPlayer 
            userProfile={profile}
            telecast={activeTelecast}
            onClose={() => setActiveTelecast(null)}
          />
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-w-0">
        <LiveTelecastBanner 
          userProfile={profile}
          onJoin={(telecast) => setActiveTelecast(telecast)}
        />

        {/* Global Header */}
        <header className="bg-white border-b border-slate-100 px-6 py-3 flex items-center justify-between sticky top-0 z-40 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center overflow-hidden border border-indigo-200">
                {adminProfile?.photoURL ? (
                  <img src={adminProfile.photoURL} alt="Admin" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <Shield className="text-indigo-600 w-4 h-4" />
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Principal Office</span>
                <span className="text-xs font-bold text-slate-700">{adminProfile?.displayName || 'School Admin'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600 font-bold overflow-hidden border border-blue-200">
                {profile.photoURL ? (
                  <img src={profile.photoURL} alt={profile.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  profile.displayName.charAt(0)
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{profile.role}</span>
                <span className="text-xs font-bold text-slate-700">{profile.displayName}</span>
              </div>
            </div>
            
            <button 
              onClick={handleLogout}
              className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all flex items-center gap-2"
              title="Logout"
            >
              <LogOut size={20} />
              <span className="text-xs font-bold uppercase tracking-widest hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>
        
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Sidebar - Desktop */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#1e293b] text-slate-300 flex flex-col shadow-2xl transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#3b82f6] rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <GraduationCap className="text-white w-6 h-6" />
            </div>
            <span className="font-bold text-xl text-white tracking-tight">Good Samaritan</span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2 hover:bg-slate-800 rounded-lg">
            <CloseIcon size={20} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 space-y-1 custom-scrollbar pb-20 md:pb-4">
          {filteredNavItems.map((item) => (
            <button
              key={item.label}
              onClick={() => {
                setActiveTab(item.label);
                if (profile?.role === 'Admin') {
                  setSelectedStandard('All Standards');
                } else if (profile?.standard) {
                  setSelectedStandard(profile.standard);
                } else {
                  setSelectedStandard('All Standards');
                }
                if (window.innerWidth < 768) setIsSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all group ${
                activeTab === item.label 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
                  : 'hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span className={`${activeTab === item.label ? 'text-white' : 'text-slate-400 group-hover:text-blue-400'}`}>
                {item.icon}
              </span>
              <span className="font-medium text-sm flex-1 text-left">{item.label}</span>
              {activeTab === item.label && <ChevronRight size={14} className="opacity-50" />}
            </button>
          ))}

          {/* Academics Section */}
          <div className="pt-4 pb-2">
            <button 
              onClick={() => setIsAcademicsOpen(!isAcademicsOpen)}
              className="w-full flex items-center justify-between px-4 py-3 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all group"
            >
              <div className="flex items-center gap-3">
                <BookOpen size={20} className="group-hover:text-blue-400" />
                <span className="font-medium text-sm">Academics</span>
                <span className="text-[10px] bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded ml-1">
                  {(Object.values(standardCounts) as number[]).reduce((a, b) => a + b, 0)}
                </span>
              </div>
              <ChevronDown size={16} className={`transition-transform duration-300 ${isAcademicsOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {isAcademicsOpen && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden space-y-1 mt-1"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((std) => (
                    <button
                      key={std}
                      onClick={() => {
                        setActiveTab('Academics');
                        setSelectedStandard(`Standard ${std}`);
                        if (window.innerWidth < 768) setIsSidebarOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-all group pl-11 ${
                        activeTab === 'Academics' && selectedStandard === `Standard ${std}`
                          ? 'bg-slate-800 text-white'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                      }`}
                    >
                      <span className="text-sm font-medium">Standard {std}</span>
                      <span className={`text-xs font-bold ${activeTab === 'Academics' && selectedStandard === std.toString() ? 'text-blue-400' : 'text-slate-600 group-hover:text-slate-400'}`}>
                        {standardCounts[`std${std}`] || 0}
                      </span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </nav>

        <div className="p-4 mt-auto border-t border-slate-800 hidden md:block">
          <div className="flex items-center gap-3 px-2 py-3 mb-2 rounded-xl bg-slate-800/50">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold overflow-hidden">
              {user.photoURL ? (
                <img src={user.photoURL} alt={profile.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                profile.displayName.charAt(0)
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold text-white truncate">{profile.displayName}</span>
              <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500">{profile.role}</span>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all group"
          >
            <LogOut size={20} className="group-hover:translate-x-1 transition-transform" />
            <span className="font-medium text-sm">Logout</span>
          </button>
        </div>
      </aside>

      {/* Overlay for mobile sidebar */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main 
        ref={mainContentRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto bg-slate-50 custom-scrollbar relative scroll-smooth h-screen mobile-touch-scroll"
      >
        {/* Mobile Header */}
        <header className="md:hidden sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-100 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <GraduationCap className="text-white w-5 h-5" />
            </div>
            <span className="font-bold text-slate-800">Good Samaritan</span>
          </div>
            <div className="flex items-center gap-3">
              {isLeader && (
                <div className="flex bg-slate-100 p-1 rounded-lg">
                  <button 
                    onClick={() => setViewMode('Student')}
                    className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all ${viewMode === 'Student' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
                  >
                    Student
                  </button>
                  <button 
                    onClick={() => setViewMode('Leader')}
                    className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all ${viewMode === 'Leader' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
                  >
                    Leader
                  </button>
                </div>
              )}
              {(isAdmin || isLeader) && (
              <select 
                value={selectedStandard || 'All Standards'}
                onChange={(e) => setSelectedStandard(e.target.value)}
                className="bg-slate-50 text-xs font-bold text-slate-700 outline-none cursor-pointer px-2 py-1 rounded-lg border border-slate-200"
              >
                <option value="All Standards">All</option>
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={`std-${i + 1}`} value={`Standard ${i + 1}`}>Std {i + 1}</option>
                ))}
              </select>
            )}
            <NotificationCenter userProfile={profile} />
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600">
              <Menu size={24} />
            </button>
          </div>
        </header>

        {/* Desktop Header */}
        <div className="hidden md:block">
          {/* Scroll Progress Bar */}
          <div className="fixed top-0 right-0 left-72 h-1 z-50 bg-slate-100">
            <motion.div 
              className="h-full bg-indigo-600"
              style={{ width: `${scrollProgress}%` }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            />
          </div>

          <header className="p-12 pb-0 flex items-end justify-between">
            <div>
              <h2 className="text-4xl font-serif font-medium text-[#1a1a1a] mb-2">
                Welcome back, {profile.displayName.split(' ')[0]}
              </h2>
              <p className="text-[#5A5A40]/60 font-serif italic text-lg">
                {activeTab === 'Events' ? "Here's what's happening today in your learning journey." : `Viewing ${activeTab} section.`}
              </p>
            </div>
            <div className="flex items-center gap-4">
              {/* Role Switcher for Leaders */}
              {isLeader && (
                <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
                  <button 
                    onClick={() => {
                      setViewMode('Student');
                      setActiveTab('Dashboard');
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      viewMode === 'Student' 
                        ? 'bg-white text-blue-600 shadow-md' 
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <UserCircle size={14} />
                    Student View
                  </button>
                  <button 
                    onClick={() => {
                      setViewMode('Leader');
                      setActiveTab('Dashboard');
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      viewMode === 'Leader' 
                        ? 'bg-white text-blue-600 shadow-md' 
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <Shield size={14} />
                    Leader View
                  </button>
                </div>
              )}

              {/* Standard Selector for Admin/Leader */}
              {(profile.role === 'Admin' || (profile.role === 'Leader' && viewMode === 'Leader')) && (
                <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Filter:</span>
                  <select
                    value={selectedStandard || 'All Standards'}
                    onChange={(e) => setSelectedStandard(e.target.value)}
                    disabled={profile.role === 'Leader'}
                    className="bg-transparent border-none outline-none text-sm font-bold text-slate-700 cursor-pointer disabled:opacity-50"
                  >
                    <option value="All Standards">All Standards</option>
                    {Array.from({ length: 12 }, (_, i) => (i + 1).toString()).map(s => (
                      <option key={s} value={`Standard ${s}`}>Standard {s}</option>
                    ))}
                  </select>
                </div>
              )}
              <AnimatePresence>
                {liveClasses.some(c => isAdmin || c.standard === profile.standard || c.standard === 'All Standards') && (
                  <motion.button
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    onClick={() => setActiveTab('Live Class')}
                    className="bg-red-500 text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 animate-pulse shadow-lg shadow-red-200"
                  >
                    <Radio size={16} />
                    Join Live Class
                  </motion.button>
                )}
              </AnimatePresence>
              <NotificationCenter userProfile={profile} />
              <div className="bg-white px-6 py-3 rounded-2xl shadow-sm border border-black/5 flex items-center gap-4">
                <div className="text-right">
                  <div className="text-xs uppercase tracking-widest font-bold text-[#5A5A40]/40">Current Role</div>
                  <div className="text-sm font-bold text-[#5A5A40]">{profile.role}</div>
                </div>
                <div className="w-px h-8 bg-black/5" />
                <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-600">
                  <Star size={20} />
                </div>
              </div>
            </div>
          </header>
        </div>

        <div className="p-4 md:p-12 pt-6 md:pt-12 pb-28 md:pb-12 max-w-7xl mx-auto">
          {/* Mobile Welcome */}
          <div className="md:hidden mb-6">
            <h2 className="text-2xl font-serif font-medium text-[#1a1a1a]">
              Hello, {profile.displayName.split(' ')[0]}
            </h2>
            <p className="text-slate-500 text-sm italic font-serif">
              {activeTab === 'Events' ? "Today's highlights" : `${activeTab}`}
            </p>
          </div>

          <AnimatePresence mode="wait">
            {showScrollTop && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={scrollToTop}
                className="fixed bottom-24 md:bottom-8 right-4 md:right-8 z-50 p-4 bg-indigo-600 text-white rounded-full shadow-2xl hover:bg-indigo-700 transition-all group"
              >
                <ArrowUp size={24} className="group-hover:-translate-y-1 transition-transform" />
              </motion.button>
            )}
          </AnimatePresence>

          {/* Scrolling Announcement Marquee */}
          <div className="mb-8 bg-indigo-600 text-white py-2 px-4 rounded-xl overflow-hidden relative shadow-lg shadow-indigo-200">
            <div className="flex items-center gap-4 whitespace-nowrap animate-marquee">
              <span className="font-bold flex items-center gap-2">
                <Megaphone size={16} />
                LATEST UPDATES:
              </span>
              <span>Welcome to Good Samaritan Education Platform! • New Live Classes scheduled for Standard 10 • House Points updated for the week • Stay tuned for the upcoming Annual Day celebrations! • </span>
              <span>Welcome to Good Samaritan Education Platform! • New Live Classes scheduled for Standard 10 • House Points updated for the week • Stay tuned for the upcoming Annual Day celebrations! • </span>
            </div>
          </div>

          {activeTab === 'Dashboard' ? (
            <>
              {isAdmin || (isLeader && viewMode === 'Leader') ? (
                <AdminDashboard 
                  standardCounts={standardCounts} 
                  selectedStandard={selectedStandard}
                  setSelectedStandard={setSelectedStandard}
                  userRole={profile.role}
                  userProfile={profile}
                />
              ) : isAlumni ? (
                <AlumniDashboard userProfile={profile} />
              ) : (
                <StudentDashboard 
                  userProfile={profile} 
                  onNavigate={setActiveTab} 
                  selectedStandard={selectedStandard}
                  setSelectedStandard={setSelectedStandard}
                />
              )}
            </>
          ) : activeTab === 'Events' ? (
            <EventManager userProfile={profile} selectedStandard={selectedStandard} setSelectedStandard={setSelectedStandard} />
          ) : activeTab === 'Academics' ? (
            <AcademicManager 
              userProfile={profile} 
              selectedStandard={selectedStandard}
              setSelectedStandard={setSelectedStandard}
            />
          ) : activeTab === 'Create Announcement' ? (
            <AnnouncementManager userProfile={profile} initialMode="create" selectedStandard={selectedStandard} setSelectedStandard={setSelectedStandard} />
          ) : activeTab === 'Manage Announcements' ? (
            <AnnouncementManager userProfile={profile} initialMode="manage" selectedStandard={selectedStandard} setSelectedStandard={setSelectedStandard} />
          ) : activeTab === 'Live Class' ? (
            <LiveClassManager userProfile={profile} selectedStandard={selectedStandard} setSelectedStandard={setSelectedStandard} />
          ) : activeTab === 'Attendance' ? (
            <AttendanceTracker userProfile={profile} selectedStandard={selectedStandard} setSelectedStandard={setSelectedStandard} />
          ) : activeTab === 'Progress Card' ? (
            <ReportManager userProfile={profile} initialMode="view" selectedStandard={selectedStandard} setSelectedStandard={setSelectedStandard} />
          ) : activeTab === 'Report Generation' ? (
            <ReportManager userProfile={profile} initialMode="generate" selectedStandard={selectedStandard} setSelectedStandard={setSelectedStandard} />
          ) : activeTab === 'Test Results' ? (
            <TestResultsManager userProfile={profile} selectedStandard={selectedStandard} setSelectedStandard={setSelectedStandard} />
          ) : activeTab === 'Quiz Monitor' ? (
            <QuizMonitor userProfile={profile} onNavigate={setActiveTab} selectedStandard={selectedStandard} setSelectedStandard={setSelectedStandard} />
          ) : activeTab === 'Quiz Analytics' ? (
            <QuizAnalytics 
              userProfile={profile} 
              selectedStandard={selectedStandard}
              setSelectedStandard={setSelectedStandard}
            />
          ) : activeTab === 'House Points' ? (
            <HousePointsDashboard userProfile={profile} selectedStandard={selectedStandard} setSelectedStandard={setSelectedStandard} />
          ) : activeTab === 'Student Points' ? (
            <StudentPointsManager userProfile={profile} selectedStandard={selectedStandard} setSelectedStandard={setSelectedStandard} />
          ) : activeTab === 'Rankings' ? (
            <Leaderboard userProfile={profile} />
          ) : activeTab === 'Command Center' ? (
            <AwardingCenter userProfile={profile} />
          ) : activeTab === 'Institutional History' ? (
            <LeadershipLegacy />
          ) : activeTab === 'Annual Reset' ? (
            <ArchiveManager userProfile={profile} />
          ) : activeTab === 'Legacy Vault' ? (
            <LegacyVault />
          ) : activeTab === 'Hall of Fame' ? (
            <HallOfFame />
          ) : activeTab === 'Achievement Vault' ? (
            <Portfolio userProfile={profile} />
          ) : activeTab === 'Community Directory' ? (
            <CommunityDirectory userProfile={profile} />
          ) : activeTab === 'AI Student Story' ? (
            <AIStudentStory userProfile={profile} />
          ) : activeTab === 'Settings' ? (
            <UserSettings userProfile={profile} />
          ) : (
            <div className="bg-white rounded-[32px] p-12 md:p-24 shadow-sm border border-black/5 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 md:w-24 md:h-24 bg-slate-100 rounded-[24px] md:rounded-[32px] flex items-center justify-center text-indigo-600 mb-6">
                {navItems.find(n => n.label === activeTab)?.icon}
              </div>
              <h3 className="text-xl md:text-2xl font-serif font-medium text-[#1a1a1a] mb-2">{activeTab}</h3>
              <p className="text-sm md:text-base text-[#5A5A40]/60 font-serif italic max-w-md">
                The {activeTab} module is currently being optimized for your real-time experience. Check back soon for live updates.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-2 py-2 flex items-center justify-around z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        {mobileNavItems.map((item) => (
          <button
            key={item.label}
            onClick={() => {
              if (item.label === 'More') {
                setIsSidebarOpen(true);
              } else {
                setActiveTab(item.label);
              }
            }}
            className={`flex flex-col items-center gap-1 px-3 py-1 rounded-xl transition-all ${
              activeTab === item.label && item.label !== 'More'
                ? 'text-blue-600'
                : 'text-slate-400'
            }`}
          >
            <div className={`p-1 rounded-lg ${activeTab === item.label && item.label !== 'More' ? 'bg-blue-50' : ''}`}>
              {item.icon}
            </div>
            <span className="text-[10px] font-bold uppercase tracking-tighter">{item.label}</span>
          </button>
        ))}
      </nav>
      </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
      </div>
    </UploadProvider>
  );
}

function DashboardCard({ title, value, subtitle }: { title: string, value: string, subtitle: string }) {
  return (
    <div className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-200/60 hover:shadow-md transition-shadow">
      <h4 className="text-xs uppercase tracking-widest font-bold text-slate-400 mb-4">{title}</h4>
      <div className="text-4xl font-serif font-medium text-[#1a1a1a] mb-2">{value}</div>
      <p className="text-sm text-[#5A5A40]/60 italic font-serif">{subtitle}</p>
    </div>
  );
}
