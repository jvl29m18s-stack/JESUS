import React, { useState, useEffect, useRef } from 'react';
import { 
  Radio, 
  Users, 
  MessageSquare, 
  Heart, 
  Clapperboard, 
  ThumbsUp, 
  Zap,
  X,
  Send,
  Play,
  Volume2,
  VolumeX,
  Maximize,
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
  increment,
  runTransaction
} from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, LiveTelecast, LiveReaction, LiveChatMessage } from '../types';

interface LiveTelecastPlayerProps {
  userProfile: UserProfile;
  telecast: LiveTelecast;
  onClose: () => void;
}

export default function LiveTelecastPlayer({ userProfile, telecast, onClose }: LiveTelecastPlayerProps) {
  const [messages, setMessages] = useState<LiveChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [reactions, setReactions] = useState<LiveReaction[]>([]);
  const [viewerCount, setViewerCount] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showControls, setShowControls] = useState(true);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Increment viewer count when joining
    const telecastRef = doc(db, 'live_telecasts', telecast.id);
    updateDoc(telecastRef, {
      viewerCount: increment(1)
    }).catch(console.error);

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

    // Listen for telecast status (End session)
    const unsubscribeTelecast = onSnapshot(doc(db, 'live_telecasts', telecast.id), (doc) => {
      if (doc.exists()) {
        const data = doc.data() as LiveTelecast;
        setViewerCount(data.viewerCount || 0);
        if (data.status === 'Ended') {
          onClose();
        }
      } else {
        onClose();
      }
    });

    return () => {
      // Decrement viewer count when leaving
      updateDoc(telecastRef, {
        viewerCount: increment(-1)
      }).catch(console.error);
      
      unsubscribeChat();
      unsubscribeReactions();
      unsubscribeTelecast();
    };
  }, [telecast.id]);

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

  const handleSendReaction = async (type: LiveReaction['type']) => {
    try {
      await addDoc(collection(db, 'live_telecasts', telecast.id, 'reactions'), {
        type,
        userId: userProfile.uid,
        userName: userProfile.displayName,
        timestamp: serverTimestamp()
      });
    } catch (error) {
      console.error("Error sending reaction:", error);
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
  };

  const isYouTube = telecast.url.includes('youtube.com') || telecast.url.includes('youtu.be');
  const getYouTubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  return (
    <div className="fixed inset-0 bg-slate-950 z-[100] flex flex-col md:flex-row overflow-hidden" onMouseMove={handleMouseMove}>
      {/* Video Player Area */}
      <div className="flex-1 relative flex flex-col bg-black">
        <div className="absolute top-6 left-6 z-10 flex items-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-full text-xs font-black uppercase tracking-widest animate-pulse">
            <Zap size={14} fill="currentColor" />
            Live
          </div>
          <div className="px-4 py-2 bg-black/40 backdrop-blur-md text-white rounded-full text-xs font-bold border border-white/10 flex items-center gap-2">
            <Users size={14} />
            {viewerCount} Viewers
          </div>
        </div>

        <div className="absolute top-6 right-6 z-10">
          <button 
            onClick={onClose}
            className="w-12 h-12 bg-black/40 backdrop-blur-md text-white rounded-2xl flex items-center justify-center hover:bg-white/10 transition-all border border-white/10"
          >
            <X size={24} />
          </button>
        </div>

        {/* Video Content */}
        <div className="flex-1 flex items-center justify-center relative group">
          {isYouTube ? (
            <iframe
              src={`https://www.youtube.com/embed/${getYouTubeId(telecast.url)}?autoplay=1&mute=0`}
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <video 
              ref={videoRef}
              src={telecast.url}
              autoPlay
              playsInline
              className="w-full h-full object-contain"
            />
          )}

          {/* Floating Reactions Overlay */}
          <div className="absolute bottom-24 right-8 flex flex-col-reverse gap-4 pointer-events-none overflow-hidden h-96 w-32">
            <AnimatePresence>
              {reactions.map((reaction) => (
                <motion.div
                  key={reaction.id}
                  initial={{ opacity: 0, y: 0, x: Math.random() * 40 - 20, scale: 0.5 }}
                  animate={{ opacity: 1, y: -400, x: Math.random() * 100 - 50, scale: 2 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 3, ease: "easeOut" }}
                  className="text-4xl absolute bottom-0"
                >
                  {reaction.type === 'heart' && '❤️'}
                  {reaction.type === 'clap' && '👏'}
                  {reaction.type === 'like' && '👍'}
                  {reaction.type === 'wow' && '😮'}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Custom Controls (for non-youtube) */}
          {!isYouTube && (
            <AnimatePresence>
              {showControls && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-between px-8"
                >
                  <div className="flex items-center gap-6">
                    <button onClick={togglePlay} className="text-white hover:text-emerald-400 transition-colors">
                      {isPlaying ? <Volume2 size={24} /> : <Play size={24} />}
                    </button>
                    <button onClick={toggleMute} className="text-white hover:text-emerald-400 transition-colors">
                      {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
                    </button>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <button className="text-white hover:text-emerald-400 transition-colors">
                      <Maximize size={20} />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>

        {/* Reaction Buttons Bar */}
        <div className="h-20 bg-black/40 backdrop-blur-xl border-t border-white/10 flex items-center justify-center gap-4 shrink-0 px-4">
          <button 
            onClick={() => handleSendReaction('heart')}
            className="w-12 h-12 rounded-full bg-white/5 hover:bg-rose-500/20 text-rose-500 flex items-center justify-center transition-all border border-white/5 hover:scale-125 active:scale-95"
          >
            <Heart size={24} fill="currentColor" />
          </button>
          <button 
            onClick={() => handleSendReaction('clap')}
            className="w-12 h-12 rounded-full bg-white/5 hover:bg-orange-500/20 text-orange-500 flex items-center justify-center transition-all border border-white/5 hover:scale-125 active:scale-95"
          >
            <Clapperboard size={24} />
          </button>
          <button 
            onClick={() => handleSendReaction('like')}
            className="w-12 h-12 rounded-full bg-white/5 hover:bg-blue-500/20 text-blue-500 flex items-center justify-center transition-all border border-white/5 hover:scale-125 active:scale-95"
          >
            <ThumbsUp size={24} fill="currentColor" />
          </button>
          <button 
            onClick={() => handleSendReaction('wow')}
            className="w-12 h-12 rounded-full bg-white/5 hover:bg-purple-500/20 text-purple-500 flex items-center justify-center transition-all border border-white/5 hover:scale-125 active:scale-95"
          >
            😮
          </button>
        </div>
      </div>

      {/* Sidebar: Chat */}
      <div className="w-full md:w-96 bg-slate-900 border-l border-white/10 flex flex-col">
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <MessageSquare size={20} className="text-emerald-400" />
            Live Chat
          </h3>
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
            {messages.length} Messages
          </span>
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
              <p className="text-slate-500 text-sm italic">Be the first to say something!</p>
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
