import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  serverTimestamp, 
  deleteDoc, 
  doc,
  updateDoc,
  limit,
  where
} from 'firebase/firestore';
import { db } from '../firebase';
import { InstitutionEvent, LiveTelecast, UserProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '../firestoreErrorHandler';
import { 
  Video, 
  Play, 
  Plus, 
  Trash2, 
  Radio, 
  Bell, 
  Clock, 
  Tag, 
  ExternalLink,
  X,
  Upload,
  Tv,
  Filter,
  Download,
  Loader2
} from 'lucide-react';
import LivePlayer from './LivePlayer';
import LiveTelecastStudio from './LiveTelecastStudio';
import LiveTelecastPlayer from './LiveTelecastPlayer';
import { useUploads } from './UploadContext';
import { VideoMessageBubble } from './VideoMessageBubble';

interface EventManagerProps {
  userProfile: UserProfile;
  selectedStandard: string | null;
  setSelectedStandard: (standard: string | null) => void;
}

import { sendStandardNotification } from '../services/notificationService';

export default function EventManager({ userProfile, selectedStandard, setSelectedStandard }: EventManagerProps) {
  const [events, setEvents] = useState<InstitutionEvent[]>([]);
  const [liveTelecast, setLiveTelecast] = useState<LiveTelecast | null>(null);
  const [activeLiveTelecast, setActiveLiveTelecast] = useState<LiveTelecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showLiveModal, setShowLiveModal] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { startUpload } = useUploads();

  const isAdmin = userProfile.role === 'Admin';
  const isLeader = userProfile.role === 'Leader';

  useEffect(() => {
    const qEvents = query(collection(db, 'institution_events'), orderBy('createdAt', 'desc'));
    const unsubscribeEvents = onSnapshot(qEvents, (snapshot) => {
      const eventList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as InstitutionEvent[];
      
      setEvents(eventList);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'institution_events');
      setLoading(false);
    });

    const qLive = query(collection(db, 'live_telecasts'), where('status', '==', 'Live'), limit(1));
    const unsubscribeLive = onSnapshot(qLive, (snapshot) => {
      if (!snapshot.empty) {
        const liveData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as LiveTelecast;
        setLiveTelecast(liveData);
      } else {
        setLiveTelecast(null);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'live_telecasts');
    });

    return () => {
      unsubscribeEvents();
      unsubscribeLive();
    };
  }, []);

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const category = formData.get('category') as string;
    const thumbnailUrl = formData.get('thumbnailUrl') as string;
    const standard = formData.get('standard') as string;
    let videoUrl = formData.get('videoUrl') as string;

    if (selectedFile) {
      // Background upload
      startUpload(
        selectedFile,
        'event',
        {
          title,
          description,
          category,
          thumbnailUrl
        },
        userProfile,
        standard
      );

      // Send notification
      await sendStandardNotification(standard, {
        title: 'New Event Uploading',
        message: `A new event video "${title}" is being uploaded.`,
        type: 'Event'
      });

      setShowUploadModal(false);
      setSelectedFile(null);
    } else if (videoUrl) {
      try {
        setUploading(true);
        await addDoc(collection(db, 'institution_events'), {
          title,
          description,
          category,
          videoUrl,
          thumbnailUrl: thumbnailUrl || `https://picsum.photos/seed/${title}/800/450`,
          authorId: userProfile.uid,
          authorName: userProfile.displayName,
          standard,
          createdAt: serverTimestamp()
        });

        await sendStandardNotification(standard, {
          title: 'New Event Shared',
          message: `A new event video "${title}" has been shared.`,
          type: 'Event'
        });

        setShowUploadModal(false);
        setUploading(false);
      } catch (error) {
        console.error("Error sharing event:", error);
        setUploading(false);
        alert('Error sharing event. Please try again.');
      }
    } else {
      alert('Please provide a video URL or upload a file.');
    }
  };

  const handleStartLive = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const title = formData.get('title') as string;
    const url = formData.get('url') as string;
    const standard = formData.get('standard') as string;

    try {
      await addDoc(collection(db, 'live_telecasts'), {
        title,
        url,
        status: 'Live',
        startedAt: serverTimestamp(),
        startedBy: userProfile.displayName,
        standard
      });

      // Send notification
      await sendStandardNotification(standard, {
        title: 'Live Telecast Started!',
        message: `The live telecast "${title}" has started. Join now!`,
        type: 'Live'
      });

      setShowLiveModal(false);
    } catch (error) {
      console.error("Error starting live telecast:", error);
    }
  };

  const handleEndLive = async () => {
    if (!liveTelecast) return;
    try {
      await updateDoc(doc(db, 'live_telecasts', liveTelecast.id), {
        status: 'Ended'
      });
      setActiveLiveTelecast(null);
    } catch (error) {
      console.error("Error ending live telecast:", error);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this event?')) return;
    try {
      await deleteDoc(doc(db, 'institution_events', id));
    } catch (error) {
      console.error("Error deleting event:", error);
    }
  };

  const filteredEvents = events.filter(e => 
    selectedStandard === 'All Standards' || !e.standard || e.standard === 'All Standards' || e.standard === selectedStandard
  );

  const isLiveTelecastVisible = liveTelecast && (
    selectedStandard === 'All Standards' || !liveTelecast.standard || liveTelecast.standard === 'All Standards' || liveTelecast.standard === selectedStandard
  );

  return (
    <div className="space-y-8 max-w-7xl mx-auto p-4 md:p-8">
      <AnimatePresence>
        {activeLiveTelecast && (
          isAdmin || isLeader ? (
            <LiveTelecastStudio 
              userProfile={userProfile}
              telecast={activeLiveTelecast}
              onClose={() => handleEndLive()}
            />
          ) : (
            <LiveTelecastPlayer 
              userProfile={userProfile}
              telecast={activeLiveTelecast}
              onClose={() => setActiveLiveTelecast(null)}
            />
          )
        )}
      </AnimatePresence>

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-800 tracking-tight mb-2">Institution Events</h1>
          <p className="text-slate-500 max-w-md">
            Watch videos from annual days, sports days, seminars, and more.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {userProfile.role !== 'Student' && (
            <div className="relative">
              {/* Global standard selector is used instead */}
            </div>
          )}
          {isAdmin && (
            <>
              <button 
                onClick={() => setShowLiveModal(true)}
                className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm"
              >
                <Radio size={18} className="text-rose-500" />
                Start Live Telecast
              </button>
              <button 
                onClick={() => setShowUploadModal(true)}
                className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
              >
                <Plus size={18} />
                Upload Event Video
              </button>
            </>
          )}
        </div>
      </div>

      {/* Live Telecast Alert */}
      <AnimatePresence>
        {isLiveTelecastVisible && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-rose-50 border border-rose-100 rounded-[32px] p-6 flex flex-col md:flex-row items-center justify-between gap-6"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-rose-500 rounded-2xl flex items-center justify-center text-white animate-pulse">
                <Radio size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 bg-rose-500 text-white text-[10px] font-black rounded uppercase tracking-wider">Live Now</span>
                  <h3 className="font-bold text-slate-800">{liveTelecast.title}</h3>
                </div>
                <p className="text-xs text-slate-500">Started by {liveTelecast.startedBy}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setActiveLiveTelecast(liveTelecast)}
                className="px-6 py-3 bg-rose-500 text-white rounded-xl text-sm font-bold hover:bg-rose-600 transition-all flex items-center gap-2"
              >
                <Play size={16} />
                Join Telecast
              </button>
              {isAdmin && (
                <button 
                  onClick={handleEndLive}
                  className="px-6 py-3 bg-white border border-rose-200 text-rose-500 rounded-xl text-sm font-bold hover:bg-rose-50 transition-all"
                >
                  End Session
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notification Toast */}
      <AnimatePresence>
        {notification && (
          <motion.div 
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            className="fixed top-8 right-8 z-50 bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 border border-white/10"
          >
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center">
              <Bell size={20} />
            </div>
            <div>
              <p className="text-sm font-bold">{notification}</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest">Real-time update</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Events Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <AnimatePresence mode="popLayout">
          {filteredEvents.length === 0 ? (
            <div className="col-span-full py-24 text-center bg-slate-50 rounded-[40px] border border-dashed border-slate-200">
              <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center text-slate-300 mx-auto mb-6 shadow-sm">
                <Video size={40} />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">No events yet</h3>
              <p className="text-slate-500">Check back later for institution event highlights.</p>
            </div>
          ) : (
            filteredEvents.map((event) => (
              <motion.div
                key={event.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative group"
              >
                <VideoMessageBubble
                  title={event.title}
                  description={event.description}
                  url={event.videoUrl}
                  thumbnailUrl={event.thumbnailUrl}
                  authorName={event.authorName}
                  createdAt={event.createdAt}
                  status={event.status}
                  uploadProgress={event.uploadProgress}
                />
                {isAdmin && (
                  <button 
                    onClick={() => handleDeleteEvent(event.id)}
                    className="absolute top-2 right-2 p-2 bg-white/80 backdrop-blur-sm text-slate-400 hover:text-red-500 rounded-full shadow-sm transition-all opacity-0 group-hover:opacity-100 z-10"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Upload Modal */}
      <AnimatePresence>
        {showUploadModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-0 md:p-4">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="bg-white md:rounded-[40px] w-full max-w-lg p-6 md:p-10 shadow-2xl relative overflow-hidden flex flex-col h-full md:h-auto md:max-h-[90vh]"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-emerald-500" />
              <div className="flex justify-between items-center mb-6 md:mb-8 shrink-0">
                <div>
                  <h2 className="text-2xl font-black text-slate-800">Upload Event</h2>
                  <p className="text-sm text-slate-500">Share a new event highlight with everyone.</p>
                </div>
                <button onClick={() => setShowUploadModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleUpload} className="space-y-6 overflow-y-auto pr-2 custom-scrollbar">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Event Title</label>
                  <input 
                    name="title"
                    required
                    placeholder="e.g. Annual Day 2023 Highlights"
                    className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:border-emerald-500 outline-none transition-all bg-slate-50/50"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Category</label>
                    <select 
                      name="category"
                      className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:border-emerald-500 outline-none bg-slate-50/50"
                    >
                      <option>Annual Day</option>
                      <option>Sports Day</option>
                      <option>Seminar</option>
                      <option>Cultural Fest</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Standard</label>
                    <select 
                      name="standard"
                      className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:border-emerald-500 outline-none bg-slate-50/50"
                    >
                      <option value="All Standards">All Standards</option>
                      {Array.from({ length: 12 }, (_, i) => (
                        <option key={`std-${i + 1}`} value={`Standard ${i + 1}`}>Standard {i + 1}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Video File (Upload)</label>
                  <div className="relative">
                    <input 
                      type="file"
                      accept="video/*"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      className="hidden"
                      id="video-upload"
                    />
                    <label 
                      htmlFor="video-upload"
                      className="w-full px-5 py-4 rounded-2xl border-2 border-dashed border-slate-200 hover:border-emerald-500 cursor-pointer flex items-center justify-center gap-3 transition-all bg-slate-50/50"
                    >
                      <Upload size={20} className="text-slate-400" />
                      <span className="text-sm font-medium text-slate-600">
                        {selectedFile ? selectedFile.name : 'Choose video file or drag & drop'}
                      </span>
                    </label>
                  </div>
                </div>

                <div className="relative py-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-100"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-slate-400 font-bold tracking-widest">OR</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Video URL (External)</label>
                  <input 
                    name="videoUrl"
                    placeholder="YouTube/Drive Link"
                    className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:border-emerald-500 outline-none bg-slate-50/50"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Thumbnail URL (Optional)</label>
                  <input 
                    name="thumbnailUrl"
                    placeholder="Image URL"
                    className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:border-emerald-500 outline-none bg-slate-50/50"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Description</label>
                  <textarea 
                    name="description"
                    required
                    rows={3}
                    placeholder="Tell us about the event..."
                    className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:border-emerald-500 outline-none resize-none bg-slate-50/50"
                  />
                </div>

                <button 
                  type="submit"
                  disabled={uploading}
                  className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Uploading Video...
                    </>
                  ) : (
                    <>
                      <Upload size={18} />
                      Publish Event
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Live Modal */}
      <AnimatePresence>
        {showLiveModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-0 md:p-4">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="bg-white md:rounded-[40px] w-full max-w-lg p-6 md:p-10 shadow-2xl relative overflow-hidden flex flex-col h-full md:h-auto md:max-h-[90vh]"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-rose-500" />
              <div className="flex justify-between items-center mb-6 md:mb-8 shrink-0">
                <div>
                  <h2 className="text-2xl font-black text-slate-800">Start Live Telecast</h2>
                  <p className="text-sm text-slate-500">Broadcast a live event to all users.</p>
                </div>
                <button onClick={() => setShowLiveModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleStartLive} className="space-y-6 overflow-y-auto pr-2 custom-scrollbar">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Session Title</label>
                  <input 
                    name="title"
                    required
                    placeholder="e.g. Sports Day Live Stream"
                    className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:border-rose-500 outline-none transition-all bg-slate-50/50"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Stream URL</label>
                  <input 
                    name="url"
                    required
                    placeholder="YouTube Live / Zoom Link"
                    className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:border-rose-500 outline-none bg-slate-50/50"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Standard</label>
                  <select 
                    name="standard"
                    className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:border-rose-500 outline-none bg-slate-50/50"
                  >
                    <option value="All Standards">All Standards</option>
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={`std-${i + 1}`} value={`Standard ${i + 1}`}>Standard {i + 1}</option>
                    ))}
                  </select>
                </div>

                <button 
                  type="submit"
                  className="w-full py-4 bg-rose-500 text-white rounded-2xl font-bold hover:bg-rose-600 transition-all shadow-lg shadow-rose-200 flex items-center justify-center gap-2"
                >
                  <Tv size={18} />
                  Go Live Now
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
