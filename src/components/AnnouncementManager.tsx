import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Eye, 
  Edit2, 
  Trash2, 
  ChevronDown, 
  Calendar,
  X,
  Check,
  AlertCircle,
  Clock,
  Send,
  FileText,
  Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp,
  getDocs,
  where
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Announcement, UserProfile } from '../types';
import { sendStandardNotification, sendBulkNotification, sendNotification } from '../services/notificationService';

interface AnnouncementManagerProps {
  userProfile: UserProfile;
  initialMode?: 'create' | 'manage';
  selectedStandard: string | null;
  setSelectedStandard: (standard: string | null) => void;
}

export default function AnnouncementManager({ userProfile, initialMode = 'manage', selectedStandard, setSelectedStandard }: AnnouncementManagerProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [viewMode, setViewMode] = useState<'create' | 'manage'>(initialMode);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'All' | 'Published' | 'Draft'>('All');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  // Form State
  const [title, setTitle] = useState('');
  const [type, setType] = useState<Announcement['type']>('General');
  const [targetAudience, setTargetAudience] = useState('All Standards');
  const [message, setMessage] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setViewMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Announcement[];
      setAnnouncements(data);
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (status: 'Published' | 'Draft') => {
    if (!title || !message) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'announcements'), {
        title,
        type,
        targetAudience,
        message,
        expiryDate,
        status,
        authorName: userProfile.displayName,
        authorId: userProfile.uid,
        createdAt: serverTimestamp(),
        priority: type === 'Urgent' ? 'High' : type === 'Event' ? 'Medium' : 'Low',
        category: type
      });

      // Send notifications if published
      if (status === 'Published') {
        const notificationData = {
          title: `New Announcement: ${title}`,
          message: message.substring(0, 100) + (message.length > 100 ? '...' : ''),
          type: (type === 'Academic' ? 'Course' : type === 'Event' ? 'Event' : 'General') as any,
        };

        if (targetAudience === 'All Standards') {
          await sendNotification({
            ...notificationData,
            target: 'all'
          });
        } else {
          await sendStandardNotification(targetAudience, notificationData);
        }
      }

      setViewMode('manage');
      resetForm();
    } catch (e) {
      console.error("Error adding announcement:", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteDoc(doc(db, 'announcements', deleteId));
      setDeleteId(null);
    } catch (e) {
      console.error("Error deleting announcement:", e);
    }
  };

  const resetForm = () => {
    setTitle('');
    setType('General');
    setTargetAudience('All Standards');
    setMessage('');
    setExpiryDate('');
  };

  const filteredAnnouncements = announcements.filter(a => {
    const matchesSearch = a.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         a.message.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filter === 'All' || a.status === filter;
    const matchesStandard = !selectedStandard || selectedStandard === 'All Standards' || a.targetAudience === 'All Standards' || a.targetAudience === selectedStandard;
    return matchesSearch && matchesFilter && matchesStandard;
  });

  const formatDate = (ts: any) => {
    if (!ts) return 'N/A';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Manage Announcements</h1>
          <p className="text-slate-500 text-sm">{announcements.length} total announcements</p>
        </div>
        <button 
          onClick={() => setViewMode('create')}
          className="bg-orange-600 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-orange-700 transition-all"
        >
          <Plus size={20} />
          <span>New</span>
        </button>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text"
            placeholder="Search announcements..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 rounded-lg border border-slate-200 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all"
          />
        </div>
        <div className="flex bg-slate-100 p-1 rounded-lg w-full md:w-auto">
          {(['All', 'Published', 'Draft'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-6 py-1.5 rounded-md text-sm font-medium transition-all ${
                filter === f ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Announcements List */}
      <div className="space-y-4">
        {filteredAnnouncements.map((a) => (
          <motion.div 
            layout
            key={a.id}
            className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 group relative overflow-hidden"
          >
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />
            <div className="flex justify-between items-start">
              <div className="space-y-3 flex-1">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-bold text-slate-800">{a.title}</h3>
                  <span className={`px-3 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    a.type === 'General' ? 'bg-blue-50 text-blue-600' :
                    a.type === 'Academic' ? 'bg-purple-50 text-purple-600' :
                    a.type === 'Event' ? 'bg-emerald-50 text-emerald-600' :
                    'bg-red-50 text-red-600'
                  }`}>
                    {a.type}
                  </span>
                  {a.status === 'Draft' && (
                    <span className="px-3 py-0.5 bg-slate-50 text-slate-400 border border-slate-100 rounded-full text-[10px] font-bold uppercase">
                      Draft
                    </span>
                  )}
                </div>
                <p className="text-slate-500 text-sm leading-relaxed">{a.message}</p>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-2 text-[11px] text-slate-400">
                  <span>To: {a.targetAudience}</span>
                  <span>Created: {formatDate(a.createdAt)}</span>
                  {a.expiryDate && <span>Expires: {a.expiryDate}</span>}
                  <span>By: {a.authorName}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button className="p-2 text-slate-300 hover:text-slate-500 transition-all">
                  <Eye size={18} />
                </button>
                <button className="p-2 text-slate-300 hover:text-slate-500 transition-all">
                  <Edit2 size={18} />
                </button>
                <button 
                  onClick={() => setDeleteId(a.id)}
                  className="p-2 text-slate-300 hover:text-red-500 transition-all"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Create Modal */}
      <AnimatePresence>
        {viewMode === 'create' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setViewMode('manage')}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[32px] p-8 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="flex justify-between items-center mb-8 shrink-0">
                <h2 className="text-2xl font-bold text-slate-800">Create Announcement</h2>
                <button onClick={() => setViewMode('manage')} className="p-2 hover:bg-slate-100 rounded-full transition-all">
                  <X size={24} className="text-slate-400" />
                </button>
              </div>

              <div className="space-y-6 overflow-y-auto pr-2 custom-scrollbar">
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-slate-700">Announcement Title *</label>
                  <input 
                    type="text" 
                    placeholder="e.g. School Annual Day Celebration"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-slate-700">Announcement Type</label>
                    <div className="relative">
                      <select 
                        value={type}
                        onChange={(e) => setType(e.target.value as any)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all appearance-none bg-white"
                      >
                        <option value="General">General</option>
                        <option value="Academic">Academic</option>
                        <option value="Event">Event</option>
                        <option value="Urgent">Urgent</option>
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-slate-700">Target Audience</label>
                    <div className="relative">
                      <select 
                        value={targetAudience}
                        onChange={(e) => setTargetAudience(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all appearance-none bg-white"
                      >
                        <option value="All Standards">All Standards</option>
                        {Array.from({ length: 12 }, (_, i) => (i + 1).toString()).map(s => (
                          <option key={s} value={s}>Standard {s}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-slate-700">Message *</label>
                  <textarea 
                    placeholder="Write your announcement message here..."
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all resize-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-slate-700">Expiry Date (optional)</label>
                  <div className="relative">
                    <input 
                      type="date" 
                      value={expiryDate}
                      onChange={(e) => setExpiryDate(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    onClick={() => handleSubmit('Draft')}
                    disabled={isSubmitting}
                    className="flex-1 py-4 bg-slate-100 text-slate-700 rounded-2xl font-bold hover:bg-slate-200 transition-all disabled:opacity-50"
                  >
                    Save as Draft
                  </button>
                  <button 
                    onClick={() => handleSubmit('Published')}
                    disabled={isSubmitting}
                    className="flex-1 py-4 bg-[#ef4444] text-white rounded-2xl font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-100 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Send size={18} />
                        <span>Publish Now</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation */}
      <AnimatePresence>
        {deleteId && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteId(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl"
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center text-red-500">
                  <AlertCircle size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-800">Delete Announcement?</h3>
                <p className="text-slate-500">This action cannot be undone. The announcement will be permanently deleted.</p>
                <div className="flex gap-3 w-full pt-4">
                  <button 
                    onClick={() => setDeleteId(null)}
                    className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleDelete}
                    className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-100"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
