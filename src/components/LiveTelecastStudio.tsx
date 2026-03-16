import React, { useState, useEffect, useRef } from 'react';
import { 
  Radio, 
  StopCircle, 
  Users, 
  MessageSquare, 
  Heart, 
  Clapperboard, 
  ThumbsUp, 
  Zap,
  X,
  Send,
  Camera,
  Mic,
  MicOff,
  VideoOff,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp, 
  onSnapshot, 
  query, 
  orderBy, 
  limit,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, LiveTelecast, LiveReaction, LiveChatMessage } from '../types';
import { handleFirestoreError, OperationType } from '../firestoreErrorHandler';

interface LiveTelecastStudioProps {
  userProfile: UserProfile;
  telecast: LiveTelecast;
  onClose: () => void;
}

export default function LiveTelecastStudio({ userProfile, telecast, onClose }: LiveTelecastStudioProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [messages, setMessages] = useState<LiveChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [reactions, setReactions] = useState<LiveReaction[]>([]);
  const [isEnding, setIsEnding] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 1280, height: 720 }, 
          audio: true 
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error("Error accessing camera:", error);
        alert("Could not access camera/microphone. Please check permissions.");
      }
    };

    startCamera();

    // Listen for chat messages
    const qChat = query(
      collection(db, 'live_telecasts', telecast.id, 'chat'),
      orderBy('timestamp', 'asc')
    );
    const unsubscribeChat = onSnapshot(qChat, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as LiveChatMessage[];
      setMessages(msgs);
    });

    // Listen for reactions
    const qReactions = query(
      collection(db, 'live_telecasts', telecast.id, 'reactions'),
      orderBy('timestamp', 'desc'),
      limit(20)
    );
    const unsubscribeReactions = onSnapshot(qReactions, (snapshot) => {
      const rects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as LiveReaction[];
      setReactions(rects);
    });

    // Listen for telecast updates (viewer count)
    const unsubscribeTelecast = onSnapshot(doc(db, 'live_telecasts', telecast.id), (doc) => {
      if (doc.exists()) {
        const data = doc.data() as LiveTelecast;
        setViewerCount(data.viewerCount || 0);
      }
    });

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      unsubscribeChat();
      unsubscribeReactions();
      unsubscribeTelecast();
    };
  }, [telecast.id]);

  const handleEndTelecast = async () => {
    if (!window.confirm("Are you sure you want to end this live telecast?")) return;
    
    setIsEnding(true);
    try {
      await updateDoc(doc(db, 'live_telecasts', telecast.id), {
        status: 'Ended',
        endedAt: serverTimestamp()
      });
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'live_telecasts');
      setIsEnding(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    try {
      await addDoc(collection(db, 'live_telecasts', telecast.id, 'chat'), {
        userId: userProfile.uid,
        userName: userProfile.displayName,
        text: chatInput,
        timestamp: serverTimestamp()
      });
      setChatInput('');
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const toggleMute = () => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950 z-[100] flex flex-col md:flex-row overflow-hidden">
      {/* Main Broadcast Area */}
      <div className="flex-1 relative flex flex-col">
        <div className="absolute top-6 left-6 z-10 flex items-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-full text-xs font-black uppercase tracking-widest animate-pulse">
            <Zap size={14} fill="currentColor" />
            Live Telecast
          </div>
          <div className="px-4 py-2 bg-black/40 backdrop-blur-md text-white rounded-full text-xs font-bold border border-white/10 flex items-center gap-2">
            <Users size={14} />
            {viewerCount} Viewers
          </div>
        </div>

        <div className="absolute top-6 right-6 z-10">
          <button 
            onClick={handleEndTelecast}
            disabled={isEnding}
            className="px-6 py-3 bg-white text-rose-600 rounded-2xl text-sm font-black hover:bg-rose-50 transition-all flex items-center gap-2 shadow-xl"
          >
            {isEnding ? <Loader2 className="animate-spin" size={18} /> : <StopCircle size={18} />}
            End Telecast
          </button>
        </div>

        {/* Video Preview */}
        <div className="flex-1 bg-slate-900 flex items-center justify-center relative overflow-hidden">
          <video 
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className={`w-full h-full object-cover ${isVideoOff ? 'hidden' : ''}`}
          />
          
          {isVideoOff && (
            <div className="text-center">
              <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/5">
                <VideoOff size={40} className="text-slate-600" />
              </div>
              <p className="text-xl font-bold text-slate-400">Camera is Off</p>
            </div>
          )}

          {/* Floating Reactions */}
          <div className="absolute bottom-24 right-8 flex flex-col-reverse gap-4 pointer-events-none">
            <AnimatePresence>
              {reactions.slice(0, 5).map((reaction, idx) => (
                <motion.div
                  key={reaction.id}
                  initial={{ opacity: 0, y: 20, scale: 0.5 }}
                  animate={{ opacity: 1, y: -100, scale: 1.5 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 2 }}
                  className="text-4xl"
                >
                  {reaction.type === 'heart' && '❤️'}
                  {reaction.type === 'clap' && '👏'}
                  {reaction.type === 'like' && '👍'}
                  {reaction.type === 'wow' && '😮'}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* Controls Bar */}
        <div className="h-24 bg-black/40 backdrop-blur-xl border-t border-white/10 flex items-center justify-center gap-6 shrink-0">
          <button 
            onClick={toggleMute}
            className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
              isMuted ? 'bg-rose-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
          </button>
          
          <button 
            onClick={toggleVideo}
            className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
              isVideoOff ? 'bg-rose-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            {isVideoOff ? <VideoOff size={24} /> : <Camera size={24} />}
          </button>
        </div>
      </div>

      {/* Sidebar: Chat & Stats */}
      <div className="w-full md:w-96 bg-slate-900 border-l border-white/10 flex flex-col">
        <div className="p-6 border-b border-white/10">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <MessageSquare size={20} className="text-emerald-400" />
            Live Chat
          </h3>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {messages.map((msg) => (
            <div key={msg.id} className="bg-white/5 rounded-2xl p-4 border border-white/5">
              <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">
                {msg.userName}
              </p>
              <p className="text-sm text-slate-200">{msg.text}</p>
            </div>
          ))}
          {messages.length === 0 && (
            <div className="text-center py-12">
              <p className="text-slate-500 text-sm italic">No messages yet. Chat will appear here.</p>
            </div>
          )}
        </div>

        <form onSubmit={handleSendMessage} className="p-6 border-t border-white/10 bg-black/20">
          <div className="relative">
            <input 
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Send a message..."
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:border-emerald-500 outline-none transition-all pr-14"
            />
            <button 
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center hover:bg-emerald-600 transition-all"
            >
              <Send size={18} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
