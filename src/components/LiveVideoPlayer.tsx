import React, { useState, useEffect, useRef } from 'react';
import { 
  Radio, 
  Users, 
  MessageSquare, 
  X,
  Send,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  Hand,
  Shield,
  Settings,
  MoreVertical
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp,
  doc,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, LiveClass, RoomParticipant } from '../types';

interface LiveVideoPlayerProps {
  userProfile: UserProfile;
  liveClass: LiveClass;
  onClose: () => void;
}

export default function LiveVideoPlayer({ userProfile, liveClass, onClose }: LiveVideoPlayerProps) {
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const [messages, setMessages] = useState<{ user: string, text: string, timestamp: any }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [volume, setVolume] = useState(1);
  const [showCaptions, setShowCaptions] = useState(true);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const isAdmin = userProfile.role === 'Admin' || userProfile.role === 'Leader';

  const isYouTube = liveClass.videoUrl?.includes('youtube.com') || liveClass.videoUrl?.includes('youtu.be');
  const getYouTubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  useEffect(() => {
    // Join class logic (add to participants)
    const joinClass = async () => {
      try {
        await updateDoc(doc(db, 'live_classes', liveClass.id!), {
          viewerCount: (liveClass.viewerCount || 0) + 1
        });
        
        // Add to participants subcollection
        await addDoc(collection(db, 'live_classes', liveClass.id!, 'participants'), {
          uid: userProfile.uid,
          displayName: userProfile.displayName,
          role: userProfile.role,
          joinedAt: serverTimestamp(),
          isMuted: false,
          isVideoOff: false,
          isHandRaised: false
        });
      } catch (error) {
        console.error("Error joining class:", error);
      }
    };

    joinClass();

    // Listen for participants
    const qParts = query(collection(db, 'live_classes', liveClass.id!, 'participants'), orderBy('joinedAt', 'asc'));
    const unsubscribeParts = onSnapshot(qParts, (snapshot) => {
      const parts = snapshot.docs.map(doc => ({ ...doc.data() })) as RoomParticipant[];
      setParticipants(parts);
    });

    // Listen for chat
    const qChat = query(collection(db, 'live_classes', liveClass.id!, 'chat'), orderBy('timestamp', 'asc'));
    const unsubscribeChat = onSnapshot(qChat, (snapshot) => {
      const msgs = snapshot.docs.map(doc => doc.data()) as any[];
      setMessages(msgs);
    });

    // Listen for class status
    const unsubscribeClass = onSnapshot(doc(db, 'live_classes', liveClass.id!), (doc) => {
      if (doc.exists() && doc.data().status === 'Ended') {
        onClose();
      }
    });

    return () => {
      unsubscribeParts();
      unsubscribeChat();
      unsubscribeClass();
    };
  }, [liveClass.id]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    try {
      await addDoc(collection(db, 'live_classes', liveClass.id!, 'chat'), {
        user: userProfile.displayName,
        text: chatInput,
        timestamp: serverTimestamp()
      });
      setChatInput('');
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const toggleHandRaise = async () => {
    setIsHandRaised(!isHandRaised);
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
    }
  };

  const toggleFullscreen = () => {
    const container = document.getElementById('video-container');
    if (container) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        container.requestFullscreen();
      }
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-950 z-[100] flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="h-16 bg-slate-900/50 backdrop-blur-md border-b border-white/10 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1 bg-rose-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest animate-pulse">
            <Radio size={12} fill="currentColor" />
            Live
          </div>
          <div className="h-4 w-px bg-white/10" />
          <div>
            <h2 className="text-sm font-bold text-white">{liveClass.title}</h2>
            <p className="text-[10px] text-slate-400 font-medium">{liveClass.subject} • {liveClass.teacherName}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 bg-white/5 rounded-lg border border-white/10 flex items-center gap-2 text-white text-xs font-bold">
            <Users size={14} className="text-indigo-400" />
            {participants.length} Attending
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 bg-white/5 text-white rounded-xl flex items-center justify-center hover:bg-rose-500/20 hover:text-rose-500 transition-all border border-white/10"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video Area */}
        <div className="flex-1 relative bg-black flex flex-col p-4">
          <div 
            id="video-container"
            className="flex-1 rounded-[32px] overflow-hidden bg-slate-900 relative group border border-white/5 shadow-2xl"
          >
            {isYouTube ? (
              <iframe
                src={`https://www.youtube.com/embed/${getYouTubeId(liveClass.videoUrl!)}?autoplay=1&mute=0&cc_load_policy=${showCaptions ? 1 : 0}`}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : liveClass.videoUrl ? (
              <div className="w-full h-full relative">
                <video 
                  ref={videoRef}
                  src={liveClass.videoUrl}
                  autoPlay
                  playsInline
                  className="w-full h-full object-contain"
                >
                  {liveClass.captionsUrl && (
                    <track 
                      kind="captions" 
                      src={liveClass.captionsUrl} 
                      srcLang="en" 
                      label="English" 
                      default={showCaptions} 
                    />
                  )}
                </video>

                {/* Custom Playback Controls for Direct Video */}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 px-6 py-3 bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl opacity-0 group-hover:opacity-100 transition-all duration-300">
                  <button 
                    onClick={togglePlay}
                    className="w-10 h-10 rounded-xl bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-all"
                  >
                    {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                  </button>
                  
                  <div className="flex items-center gap-2 group/vol">
                    <Volume2 size={16} className="text-slate-400" />
                    <input 
                      type="range" 
                      min="0" 
                      max="1" 
                      step="0.1" 
                      value={volume}
                      onChange={handleVolumeChange}
                      className="w-20 h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>

                  <div className="w-px h-6 bg-white/10 mx-1" />

                  <button 
                    onClick={() => setShowCaptions(!showCaptions)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${showCaptions ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-white/5 border-white/10 text-slate-400'}`}
                  >
                    CC
                  </button>

                  <button 
                    onClick={toggleFullscreen}
                    className="w-10 h-10 rounded-xl bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-all"
                  >
                    <Maximize size={20} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/5 animate-pulse">
                    <VideoIcon size={40} className="text-slate-600" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Connecting to Live Stream...</h3>
                  <p className="text-slate-500 text-sm">Please wait while we establish a secure connection</p>
                </div>
              </div>
            )}

            {/* Interaction Controls (Always visible on hover) */}
            <div className="absolute top-6 right-6 flex flex-col gap-3 opacity-0 group-hover:opacity-100 transition-all">
              <button 
                onClick={toggleHandRaise}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-xl ${isHandRaised ? 'bg-amber-500 text-white' : 'bg-black/40 backdrop-blur-md text-white border border-white/10 hover:bg-white/10'}`}
              >
                <Hand size={20} fill={isHandRaised ? 'currentColor' : 'none'} />
              </button>
              <button className="w-12 h-12 rounded-2xl bg-black/40 backdrop-blur-md text-white border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all shadow-xl">
                <Settings size={20} />
              </button>
            </div>

            {/* Admin Badge */}
            {isAdmin && (
              <div className="absolute top-6 left-6 px-4 py-2 bg-indigo-600/90 backdrop-blur-md text-white rounded-xl text-xs font-bold border border-indigo-400/50 flex items-center gap-2">
                <Shield size={14} />
                Moderator View
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <AnimatePresence>
          {showChat && (
            <motion.div 
              initial={{ x: 400 }}
              animate={{ x: 0 }}
              exit={{ x: 400 }}
              className="w-96 bg-slate-900 border-l border-white/10 flex flex-col shrink-0"
            >
              <div className="p-6 border-b border-white/10 flex items-center justify-between">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <MessageSquare size={20} className="text-indigo-400" />
                  Live Chat
                </h3>
                <button onClick={() => setShowChat(false)} className="text-slate-500 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                {messages.map((msg, idx) => (
                  <div key={idx} className="bg-white/5 rounded-2xl p-4 border border-white/5">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{msg.user}</span>
                    </div>
                    <p className="text-sm text-slate-200">{msg.text}</p>
                  </div>
                ))}
                {messages.length === 0 && (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-600">
                      <MessageSquare size={32} />
                    </div>
                    <p className="text-slate-500 text-sm">No messages yet. Start the conversation!</p>
                  </div>
                )}
              </div>

              <form onSubmit={handleSendMessage} className="p-6 border-t border-white/10 bg-black/20">
                <div className="relative">
                  <input 
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Type a message..."
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:border-indigo-500 outline-none transition-all pr-14"
                  />
                  <button 
                    type="submit"
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-indigo-500 text-white rounded-xl flex items-center justify-center hover:bg-indigo-600 transition-all"
                  >
                    <Send size={18} />
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer / Info Bar */}
      {!showChat && (
        <button 
          onClick={() => setShowChat(true)}
          className="fixed bottom-8 right-8 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-all z-[110]"
        >
          <MessageSquare size={24} />
        </button>
      )}
    </motion.div>
  );
}
