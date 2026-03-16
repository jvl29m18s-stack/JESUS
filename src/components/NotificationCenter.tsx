import React, { useState, useEffect } from 'react';
import { Bell, X, Check, Trash2, BookOpen, Calendar, Radio, MessageSquare, Info, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, Notification } from '../types';
import { subscribeToNotifications, markAsRead, markAllAsRead } from '../services/notificationService';
import { requestNotificationPermission } from '../services/fcmService';

interface NotificationCenterProps {
  userProfile: UserProfile;
}

export default function NotificationCenter({ userProfile }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToNotifications(userProfile, (data) => {
      setNotifications(data);
    });
    return () => unsubscribe();
  }, [userProfile.uid]);

  const unreadCount = notifications.filter(n => {
    if (n.userId === userProfile.uid) return !n.read;
    if (!userProfile.lastNotificationReadAt) return true;
    const lastRead = userProfile.lastNotificationReadAt.toDate ? userProfile.lastNotificationReadAt.toDate() : new Date(userProfile.lastNotificationReadAt);
    const createdAt = n.createdAt?.toDate ? n.createdAt.toDate() : new Date();
    return createdAt > lastRead;
  }).length;

  const handleEnablePush = async () => {
    const token = await requestNotificationPermission();
    if (token) {
      alert('Push notifications enabled successfully!');
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'Course': return <BookOpen size={18} className="text-blue-500" />;
      case 'Event': return <Calendar size={18} className="text-purple-500" />;
      case 'Live': return <Radio size={18} className="text-red-500" />;
      case 'Discussion': return <MessageSquare size={18} className="text-emerald-500" />;
      case 'Reward': return <ShieldCheck size={18} className="text-amber-500" />;
      case 'Upload': return <BookOpen size={18} className="text-indigo-500" />;
      case 'System': return <Info size={18} className="text-slate-500" />;
      default: return <Info size={18} className="text-slate-500" />;
    }
  };

  const isRead = (n: Notification) => {
    if (n.userId === userProfile.uid) return n.read;
    if (!userProfile.lastNotificationReadAt) return false;
    const lastRead = userProfile.lastNotificationReadAt.toDate ? userProfile.lastNotificationReadAt.toDate() : new Date(userProfile.lastNotificationReadAt);
    const createdAt = n.createdAt?.toDate ? n.createdAt.toDate() : new Date();
    return createdAt <= lastRead;
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
      >
        <Bell size={24} />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setIsOpen(false)} 
            />
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 mt-2 w-80 md:w-96 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden"
            >
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div>
                  <h3 className="font-bold text-slate-800">Notification Center</h3>
                  <p className="text-[10px] text-slate-500">Last 24 hours of updates</p>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={handleEnablePush}
                    className="text-[10px] font-bold text-slate-500 hover:text-indigo-600 flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-100 shadow-sm"
                    title="Enable Push Notifications"
                  >
                    <ShieldCheck size={12} />
                    Push
                  </button>
                  {unreadCount > 0 && (
                    <button 
                      onClick={() => markAllAsRead(userProfile.uid)}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-700"
                    >
                      Mark all as read
                    </button>
                  )}
                </div>
              </div>

              <div className="max-h-[450px] overflow-y-auto custom-scrollbar p-2 space-y-2 bg-slate-50/30">
                {notifications.length === 0 ? (
                  <div className="p-12 text-center">
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Bell size={20} className="text-slate-300" />
                    </div>
                    <p className="text-slate-400 italic text-sm">No updates in the last 24h</p>
                  </div>
                ) : (
                  notifications.map((n) => {
                    const read = isRead(n);
                    return (
                      <div 
                        key={n.id}
                        className={`p-4 bg-white rounded-xl border border-slate-100 flex gap-4 hover:shadow-md transition-all cursor-pointer border-l-4 ${
                          n.type === 'Reward' ? 'border-l-amber-500' : 
                          n.type === 'Live' ? 'border-l-red-500' : 
                          'border-l-[#d4af37]'
                        } ${!read ? 'ring-1 ring-indigo-100' : ''}`}
                        onClick={() => markAsRead(n.id)}
                      >
                        <div className="mt-1 shrink-0">
                          {getIcon(n.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start gap-2">
                            <h4 className={`text-sm font-bold truncate ${!read ? 'text-slate-900' : 'text-slate-600'}`}>
                              {n.title}
                            </h4>
                            {!read && <div className="w-2 h-2 bg-indigo-500 rounded-full mt-1.5 shrink-0" />}
                          </div>
                          <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">
                            {n.message}
                          </p>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-[10px] text-slate-400 font-medium">
                              {n.createdAt?.toDate ? new Date(n.createdAt.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                            </span>
                            {n.target && n.target !== 'all' && (
                              <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded uppercase tracking-wider font-bold">
                                {n.target}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
