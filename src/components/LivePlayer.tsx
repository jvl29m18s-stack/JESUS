import React, { useEffect, useRef, useState } from 'react';
import { 
  Radio, X, Mic, MicOff, Video, VideoOff, Users, MessageSquare, Send, 
  AlertCircle, Hand, Lock, Shield, User, Edit3, BarChart2, Eraser, 
  Square, Circle, Type, Trash2, Plus, ChevronRight, Monitor
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, LiveClass, RoomParticipant, LivePoll, WhiteboardAction } from '../types';
import { io, Socket } from 'socket.io-client';
import Peer from 'simple-peer';
import { db } from '../firebase';
import { doc, setDoc, onSnapshot, collection, deleteDoc, updateDoc, serverTimestamp, query, orderBy, addDoc } from 'firebase/firestore';

interface LivePlayerProps {
  userProfile: UserProfile;
  liveClass: LiveClass;
  onClose: () => void;
}

interface RemotePeer {
  id: string;
  peer: Peer.Instance;
  stream?: MediaStream;
}

export default function LivePlayer({ userProfile, liveClass, onClose }: LivePlayerProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const peersRef = useRef<Map<string, RemotePeer>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [messages, setMessages] = useState<{ user: string, text: string }[]>([]);
  const [remotePeers, setRemotePeers] = useState<string[]>([]); // User IDs of remote peers
  const [participantCount, setParticipantCount] = useState(1);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [handRaisedUsers, setHandRaisedUsers] = useState<Record<string, boolean>>({});
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [standardError, setStandardError] = useState<string | null>(null);
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const [activeSpeaker, setActiveSpeaker] = useState<string | null>(null);
  const [showAttendingList, setShowAttendingList] = useState(false);
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [showPolls, setShowPolls] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const [activePoll, setActivePoll] = useState<LivePoll | null>(null);
  const [polls, setPolls] = useState<LivePoll[]>([]);
  const isMounted = useRef(true);
  const participantDocCreated = useRef(false);

  const isAdmin = userProfile.role === 'Admin';
  const isLeader = userProfile.role === 'Leader';
  const canModerate = isAdmin || isLeader;

  useEffect(() => {
    // Check if student's standard matches class standard
    if (userProfile.role === 'Student' && liveClass.standard !== userProfile.standard) {
      setStandardError(`This class is for ${liveClass.standard}. Your standard is ${userProfile.standard || 'not set'}.`);
      return;
    }

    // Listen for class status changes (Admin ending class)
    const unsubscribeClass = onSnapshot(doc(db, 'live_classes', liveClass.id), (doc) => {
      if (!doc.exists()) {
        onClose();
        return;
      }
      const data = doc.data() as LiveClass;
      if (data.status === 'Ended') {
        onClose();
      }
    });

    // Listen for participants
    const unsubscribeParticipants = onSnapshot(
      query(collection(db, 'live_classes', liveClass.id, 'participants'), orderBy('joinedAt', 'asc')),
      (snapshot) => {
        const parts = snapshot.docs.map(doc => doc.data() as RoomParticipant);
        
        // Sort participants: Admins first, then Leaders, then Students
        parts.sort((a, b) => {
          const roleWeight = { 'Admin': 3, 'Leader': 2, 'Student': 1 };
          const weightA = roleWeight[a.role as keyof typeof roleWeight] || 0;
          const weightB = roleWeight[b.role as keyof typeof roleWeight] || 0;
          
          if (weightA !== weightB) {
            return weightB - weightA; // Higher weight first
          }
          return 0;
        });

        setParticipants(parts);
        setParticipantCount(parts.length);
      }
    );

    // Listen for polls
    const unsubscribePolls = onSnapshot(
      query(collection(db, 'live_classes', liveClass.id, 'polls'), orderBy('createdAt', 'desc')),
      (snapshot) => {
        const pollList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as LivePoll[];
        setPolls(pollList);
        const active = pollList.find(p => p.status === 'Active');
        setActivePoll(active || null);
      }
    );

    const init = async () => {
      try {
        setPermissionError(null);
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        } catch (err) {
          console.warn("Failed to get both video and audio, trying audio only...", err);
          try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setIsVideoOff(true);
          } catch (err2) {
            console.warn("Failed to get audio, trying video only...", err2);
            try {
              stream = await navigator.mediaDevices.getUserMedia({ video: true });
              setIsMuted(true);
            } catch (err3) {
              console.error("All media attempts failed:", err3);
              setPermissionError("Camera and Microphone access denied. Please enable permissions in your browser settings to participate in the live class.");
              if (userProfile.role === 'Student' || userProfile.role === 'Alumni') {
                stream = new MediaStream();
              } else {
                throw err3;
              }
            }
          }
        }
        
        if (!isMounted.current) return;
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Add to participants collection FIRST before setting up speaker detection
        await setDoc(doc(db, 'live_classes', liveClass.id, 'participants', userProfile.uid), {
          uid: userProfile.uid,
          displayName: userProfile.displayName,
          role: userProfile.role,
          houseTeam: userProfile.houseTeam || null,
          joinedAt: serverTimestamp(),
          isMuted: false,
          isVideoOff: stream.getVideoTracks().length === 0,
          isHandRaised: false,
          isSpeaking: false
        });
        participantDocCreated.current = true;

        // Setup Speaker Detection
        if (stream.getAudioTracks().length > 0) {
          setupSpeakerDetection(stream);
        }

        // Connect to signaling server
        socketRef.current = io();

        socketRef.current.on('connect', () => {
          socketRef.current?.emit('join-room', liveClass.id, userProfile.uid);
        });

        socketRef.current.on('user-connected', (userId: string) => {
          createPeer(userId, socketRef.current!, stream);
        });

        socketRef.current.on('signal', (data: { from: string, signal: any }) => {
          const remotePeer = peersRef.current.get(data.from);
          if (remotePeer) {
            remotePeer.peer.signal(data.signal);
          } else {
            addPeer(data.from, data.signal, socketRef.current!, stream);
          }
        });

        socketRef.current.on('user-disconnected', (userId: string) => {
          const remotePeer = peersRef.current.get(userId);
          if (remotePeer) {
            remotePeer.peer.destroy();
            peersRef.current.delete(userId);
            setRemotePeers(Array.from(peersRef.current.keys()));
          }
        });

        socketRef.current.on('mute-user', ({ userId, mute }: { userId: string, mute: boolean }) => {
          if (userId === userProfile.uid) {
            setIsMuted(mute);
            if (localStreamRef.current) {
              localStreamRef.current.getAudioTracks().forEach(track => track.enabled = !mute);
            }
            updateDoc(doc(db, 'live_classes', liveClass.id, 'participants', userProfile.uid), {
              isMuted: mute
            }).catch(console.error);
          }
        });

        socketRef.current.on('kick-user', ({ userId }: { userId: string }) => {
          if (userId === userProfile.uid) {
            onClose();
          }
        });

      } catch (error) {
        console.error("Error initializing live call:", error);
      }
    };

    const handleBeforeUnload = () => {
      if (participantDocCreated.current) {
        deleteDoc(doc(db, 'live_classes', liveClass.id, 'participants', userProfile.uid)).catch(console.error);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    init();

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      isMounted.current = false;
      stopCamera();
      socketRef.current?.disconnect();
      peersRef.current.forEach(p => p.peer.destroy());
      peersRef.current.clear();
      unsubscribeClass();
      unsubscribeParticipants();
      unsubscribePolls();
      if (participantDocCreated.current) {
        deleteDoc(doc(db, 'live_classes', liveClass.id, 'participants', userProfile.uid)).catch(console.error);
        participantDocCreated.current = false;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [liveClass.id, userProfile.uid]);

  const setupSpeakerDetection = (stream: MediaStream) => {
    try {
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 512;
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      let isCurrentlySpeaking = false;

      const checkVolume = () => {
        if (!analyserRef.current || !isMounted.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        const speaking = average > 30; // Threshold

        if (speaking !== isCurrentlySpeaking && participantDocCreated.current) {
          isCurrentlySpeaking = speaking;
          updateDoc(doc(db, 'live_classes', liveClass.id, 'participants', userProfile.uid), {
            isSpeaking: speaking
          }).catch(err => {
            if (err.code !== 'not-found') console.error(err);
          });
        }

        if (isMounted.current) {
          requestAnimationFrame(checkVolume);
        }
      };

      checkVolume();
    } catch (e) {
      console.error("Speaker detection error:", e);
    }
  };

  useEffect(() => {
    const speaker = participants.find(p => p.isSpeaking)?.uid || null;
    setActiveSpeaker(speaker);
  }, [participants]);

  const createPeer = (userId: string, socket: Socket, stream: MediaStream) => {
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream: stream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ]
      }
    });

    peer.on('signal', (signal) => {
      socket.emit('signal', {
        to: userId,
        from: userProfile.uid,
        signal: signal,
        roomId: liveClass.id
      });
    });

    peer.on('stream', (remoteStream) => {
      console.log('Received remote stream from:', userId);
      peersRef.current.set(userId, { id: userId, peer, stream: remoteStream });
      setRemotePeers(Array.from(peersRef.current.keys()));
      setParticipantCount(prev => prev + 1);
    });

    peersRef.current.set(userId, { id: userId, peer });
  };

  const addPeer = (userId: string, incomingSignal: any, socket: Socket, stream: MediaStream) => {
    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream: stream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' }
        ]
      }
    });

    peer.on('signal', (signal) => {
      socket.emit('signal', {
        to: userId,
        from: userProfile.uid,
        signal: signal,
        roomId: liveClass.id
      });
    });

    peer.on('stream', (remoteStream) => {
      console.log('Received remote stream from (addPeer):', userId);
      peersRef.current.set(userId, { id: userId, peer, stream: remoteStream });
      setRemotePeers(Array.from(peersRef.current.keys()));
      setParticipantCount(prev => prev + 1);
    });

    peer.signal(incomingSignal);
    peersRef.current.set(userId, { id: userId, peer });
  };

  const stopCamera = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
        if (participantDocCreated.current) {
          updateDoc(doc(db, 'live_classes', liveClass.id, 'participants', userProfile.uid), {
            isMuted: !audioTrack.enabled
          }).catch(err => {
            if (err.code !== 'not-found') console.error(err);
          });
        }
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
        if (participantDocCreated.current) {
          updateDoc(doc(db, 'live_classes', liveClass.id, 'participants', userProfile.uid), {
            isVideoOff: !videoTrack.enabled
          }).catch(err => {
            if (err.code !== 'not-found') console.error(err);
          });
        }
      }
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;
    // In a real app, we'd send this via socket.io to the room
    const msg = { user: userProfile.displayName, text: chatMessage };
    setMessages(prev => [...prev, msg]);
    socketRef.current?.emit('chat-message', { roomId: liveClass.id, ...msg });
    setChatMessage('');
  };

  // Listen for forceMute from admin
  useEffect(() => {
    if (!db || !liveClass.id || !userProfile.uid) return;

    const participantRef = doc(db, 'live_classes', liveClass.id, 'participants', userProfile.uid);
    const unsubscribe = onSnapshot(participantRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as RoomParticipant;
        if (data.forceMute && !isMuted) {
          // Admin forced mute
          if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
              audioTrack.enabled = false;
              setIsMuted(true);
              // Update Firestore to reflect the change and reset forceMute
              updateDoc(participantRef, {
                isMuted: true,
                forceMute: false
              }).catch(err => console.error("Error resetting forceMute:", err));
            }
          }
        }
      }
    });

    return () => unsubscribe();
  }, [db, liveClass.id, userProfile.uid, isMuted]);

  useEffect(() => {
    if (socketRef.current) {
      const handleMsg = (msg: { user: string, text: string }) => {
        setMessages(prev => [...prev, msg]);
      };
      
      const handleHandRaise = (data: { userId: string, isRaised: boolean }) => {
        setHandRaisedUsers(prev => ({ ...prev, [data.userId]: data.isRaised }));
      };

      socketRef.current.on('chat-message', handleMsg);
      socketRef.current.on('hand-raise', handleHandRaise);

      return () => {
        socketRef.current?.off('chat-message', handleMsg);
        socketRef.current?.off('hand-raise', handleHandRaise);
      };
    }
  }, [socketRef.current]);

  const toggleHandRaise = () => {
    const newState = !isHandRaised;
    setIsHandRaised(newState);
    socketRef.current?.emit('hand-raise', {
      roomId: liveClass.id,
      userId: userProfile.uid,
      isRaised: newState
    });
    if (participantDocCreated.current) {
      updateDoc(doc(db, 'live_classes', liveClass.id, 'participants', userProfile.uid), {
        isHandRaised: newState
      }).catch(err => {
        if (err.code !== 'not-found') console.error(err);
      });
    }
  };

  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = screenStream;
        setIsScreenSharing(true);

        // Replace track for all peers
        const videoTrack = screenStream.getVideoTracks()[0];
        peersRef.current.forEach(p => {
          const sender = p.peer.streams[0].getTracks().find(t => t.kind === 'video');
          if (sender) {
            p.peer.replaceTrack(sender, videoTrack, p.peer.streams[0]);
          }
        });

        // Update local preview
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

        videoTrack.onended = () => {
          stopScreenShare();
        };
      } catch (err) {
        console.error("Error sharing screen:", err);
      }
    } else {
      stopScreenShare();
    }
  };

  const stopScreenShare = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }
    setIsScreenSharing(false);

    // Restore camera track for all peers
    if (localStreamRef.current) {
      const cameraTrack = localStreamRef.current.getVideoTracks()[0];
      peersRef.current.forEach(p => {
        const sender = p.peer.streams[0].getTracks().find(t => t.kind === 'video');
        if (sender && cameraTrack) {
          p.peer.replaceTrack(sender, cameraTrack, p.peer.streams[0]);
        }
      });

      // Restore local preview
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
    }
  };

  const handleMuteUser = async (userId: string, mute: boolean) => {
    if (!socketRef.current || !canModerate) return;
    try {
      const participantRef = doc(db, 'live_classes', liveClass.id, 'participants', userId);
      await updateDoc(participantRef, {
        forceMute: mute,
        isMuted: mute
      });
      socketRef.current.emit('mute-user', { roomId: liveClass.id, userId, mute });
    } catch (error) {
      console.error('Error muting user:', error);
    }
  };

  const handleKickUser = (userId: string) => {
    if (!socketRef.current || !canModerate) return;
    socketRef.current.emit('kick-user', { roomId: liveClass.id, userId });
  };

  const endClass = async () => {
    if (!isAdmin) return;
    try {
      // Award points to all current participants
      const awardPromises = participants
        .filter(p => p.role === 'Student')
        .map(p => addDoc(collection(db, 'points'), {
          studentId: p.uid,
          studentName: p.displayName,
          points: 10,
          reason: `Attended Live Class: ${liveClass.title}`,
          category: 'Academic',
          timestamp: serverTimestamp(),
          house: p.houseTeam
        }));
      
      await Promise.all(awardPromises);

      await updateDoc(doc(db, 'live_classes', liveClass.id), {
        status: 'Ended'
      });
      onClose();
    } catch (e: any) {
      if (e.code === 'not-found') {
        console.warn("Class document already deleted or not found.");
        onClose();
      } else {
        console.error("Error ending class:", e);
      }
    }
  };

  const handleCreatePoll = async (question: string, options: string[]) => {
    if (!canModerate) return;
    try {
      await addDoc(collection(db, 'live_classes', liveClass.id, 'polls'), {
        question,
        options,
        votes: {},
        status: 'Active',
        createdAt: serverTimestamp()
      });
    } catch (e) {
      console.error("Error creating poll:", e);
    }
  };

  const handleVote = async (pollId: string, optionIndex: number) => {
    try {
      const poll = polls.find(p => p.id === pollId);
      if (!poll || poll.status === 'Closed') return;
      
      await updateDoc(doc(db, 'live_classes', liveClass.id, 'polls', pollId), {
        [`votes.${userProfile.uid}`]: optionIndex
      });
    } catch (e) {
      console.error("Error voting:", e);
    }
  };

  const handleClosePoll = async (pollId: string) => {
    if (!canModerate) return;
    try {
      await updateDoc(doc(db, 'live_classes', liveClass.id, 'polls', pollId), {
        status: 'Closed'
      });
    } catch (e) {
      console.error("Error closing poll:", e);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900 z-[60] flex flex-col md:flex-row overflow-hidden">
      {standardError ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-6">
            <Lock size={40} />
          </div>
          <h2 className="text-2xl font-bold text-white mb-4">Access Denied</h2>
          <p className="text-slate-400 max-w-md mb-8">{standardError}</p>
          <button 
            onClick={onClose}
            className="px-8 py-3 bg-white/10 text-white rounded-xl font-bold hover:bg-white/20 transition-all"
          >
            Go Back
          </button>
        </div>
      ) : (
        <>
          {/* Video Area */}
          <div className="flex-1 relative bg-slate-950 p-4 flex flex-col overflow-hidden">
            {permissionError && (
              <div className="absolute top-24 left-1/2 -translate-x-1/2 z-[70] w-full max-w-md">
                <div className="bg-red-500/90 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl border border-red-400/50 flex items-start gap-3">
                  <AlertCircle className="shrink-0 mt-0.5" size={20} />
                  <div>
                    <p className="text-sm font-bold mb-1">Permission Denied</p>
                    <p className="text-xs opacity-90 leading-relaxed">{permissionError}</p>
                  </div>
                  <button onClick={() => setPermissionError(null)} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
                    <X size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* Whiteboard Overlay */}
            <AnimatePresence>
              {showWhiteboard && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute inset-4 z-50 bg-white rounded-[32px] shadow-2xl overflow-hidden flex flex-col"
                >
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 text-indigo-600">
                        <Edit3 size={20} />
                        <span className="font-bold">Interactive Whiteboard</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => setShowWhiteboard(false)}
                      className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400"
                    >
                      <X size={20} />
                    </button>
                  </div>
                  <Whiteboard 
                    socket={socketRef.current} 
                    roomId={liveClass.id} 
                    canDraw={canModerate} 
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Poll Overlay */}
            <AnimatePresence>
              {activePoll && !showPolls && (
                <motion.div 
                  initial={{ y: 100, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 100, opacity: 0 }}
                  className="absolute bottom-32 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm"
                >
                  <div className="bg-white rounded-2xl p-6 shadow-2xl border border-indigo-100">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2 text-indigo-600">
                        <BarChart2 size={18} />
                        <span className="text-xs font-bold uppercase tracking-wider">Live Poll</span>
                      </div>
                      <button onClick={() => setActivePoll(null)} className="text-slate-400 hover:text-slate-600">
                        <X size={16} />
                      </button>
                    </div>
                    <h4 className="font-bold text-slate-800 mb-4">{activePoll.question}</h4>
                    <div className="space-y-2">
                      {activePoll.options.map((option, idx) => {
                        const hasVoted = activePoll.votes[userProfile.uid] === idx;
                        const totalVotes = Object.values(activePoll.votes).length;
                        const optionVotes = Object.values(activePoll.votes).filter(v => v === idx).length;
                        const percentage = totalVotes > 0 ? Math.round((optionVotes / totalVotes) * 100) : 0;

                        return (
                          <button
                            key={idx}
                            onClick={() => handleVote(activePoll.id, idx)}
                            disabled={activePoll.votes[userProfile.uid] !== undefined}
                            className={`w-full p-3 rounded-xl border transition-all relative overflow-hidden group ${
                              hasVoted 
                                ? 'border-indigo-600 bg-indigo-50' 
                                : 'border-slate-100 hover:border-indigo-200 bg-slate-50'
                            }`}
                          >
                            <div 
                              className="absolute inset-0 bg-indigo-100/50 transition-all duration-500" 
                              style={{ width: `${percentage}%` }}
                            />
                            <div className="relative flex justify-between items-center text-sm">
                              <span className={`font-medium ${hasVoted ? 'text-indigo-700' : 'text-slate-700'}`}>{option}</span>
                              <span className="text-xs font-bold text-slate-400">{percentage}%</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Dynamic Video Grid */}
            <div 
              className="grid gap-4 w-full h-full p-4 justify-center content-start overflow-y-auto custom-scrollbar"
              style={{
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))'
              }}
            >
              {participants.length === 1 && isAdmin && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="bg-black/40 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10 text-white/80 font-medium">
                    Waiting for students to join...
                  </div>
                </div>
              )}
              {participants.map(participant => {
                const isMe = participant.uid === userProfile.uid;
                const isUserSpeaking = activeSpeaker === participant.uid;
                const isUserHandRaised = participant.isHandRaised;
                const isUserVideoOff = participant.isVideoOff;
                
                const houseColorClass = participant.houseTeam === 'GOOD PIONEER' ? 'border-orange-500' :
                                        participant.houseTeam === 'GOOD PATRON' ? 'border-blue-500' :
                                        participant.houseTeam === 'GOOD SAVIOUR' ? 'border-emerald-500' :
                                        participant.houseTeam === 'GOOD SHEPHERD' ? 'border-purple-500' :
                                        'border-indigo-500/30';

                const houseBgClass = participant.houseTeam === 'GOOD PIONEER' ? 'bg-orange-500' :
                                     participant.houseTeam === 'GOOD PATRON' ? 'bg-blue-500' :
                                     participant.houseTeam === 'GOOD SAVIOUR' ? 'bg-emerald-500' :
                                     participant.houseTeam === 'GOOD SHEPHERD' ? 'bg-purple-500' :
                                     'bg-indigo-500';
                
                if (isMe) {
                  return (
                    <div key={participant.uid} className={`relative aspect-video bg-slate-900 rounded-[32px] overflow-hidden border-2 shadow-xl group transition-all duration-300 ${
                      isUserSpeaking ? 'border-emerald-500 ring-4 ring-emerald-500/20' : houseColorClass
                    }`}>
                      <video 
                        ref={localVideoRef} 
                        autoPlay 
                        muted 
                        playsInline
                        className={`w-full h-full object-cover ${isVideoOff ? 'hidden' : ''}`} 
                      />
                      {isVideoOff && (
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                          <div className="text-center">
                            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-2 border border-white/5">
                              <VideoOff size={24} className="text-slate-600" />
                            </div>
                            <p className="text-sm font-bold text-slate-400">Camera Off</p>
                          </div>
                        </div>
                      )}
                      <div className="absolute bottom-4 left-4 flex items-center gap-2">
                        <div className={`bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl text-white text-xs font-bold flex items-center gap-2 border border-white/10 ${houseColorClass.replace('border-', 'border-l-4 border-l-')}`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${isAdmin ? 'bg-red-500 animate-pulse' : houseBgClass}`} />
                          <span>{userProfile.displayName} (You) {isAdmin && "• Host"}</span>
                        </div>
                        {isHandRaised && (
                          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="bg-yellow-500 text-white p-1.5 rounded-lg shadow-lg">
                            <Hand size={14} className="fill-white" />
                          </motion.div>
                        )}
                      </div>
                    </div>
                  );
                }

                const remotePeer = peersRef.current.get(participant.uid);

                return (
                  <div key={participant.uid} className={`relative aspect-video bg-slate-900 rounded-[32px] overflow-hidden border-2 shadow-xl group transition-all duration-300 ${
                    isUserSpeaking ? 'border-emerald-500 ring-4 ring-emerald-500/20' : houseColorClass
                  }`}>
                    {isUserVideoOff || !remotePeer?.stream ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                        <div className="text-center">
                          <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-2 border border-white/5">
                            {isUserVideoOff ? <VideoOff size={24} className="text-slate-600" /> : <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />}
                          </div>
                          <p className="text-sm font-bold text-slate-400">
                            {isUserVideoOff ? 'Camera Off' : 'Connecting...'}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <VideoRenderer stream={remotePeer.stream} />
                    )}
                    <div className="absolute bottom-4 left-4 flex items-center gap-2">
                      <div className={`bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl text-white text-xs font-bold flex items-center gap-2 border border-white/10 ${houseColorClass.replace('border-', 'border-l-4 border-l-')}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${participant.role === 'Admin' ? 'bg-red-500' : houseBgClass}`} />
                        <span>{participant.displayName || 'Participant'}</span>
                      </div>
                      {isUserHandRaised && (
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="bg-yellow-500 text-white p-1.5 rounded-lg shadow-lg">
                          <Hand size={14} className="fill-white" />
                        </motion.div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

        {/* Overlay Controls */}
        <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-start pointer-events-none">
          <div className="flex items-center gap-3 pointer-events-auto">
            <div className="bg-red-500 text-white px-3 py-1 rounded-full text-[10px] font-black animate-pulse">LIVE</div>
            <div className="bg-black/40 backdrop-blur-md text-white px-4 py-2 rounded-xl border border-white/10">
              <h3 className="text-sm font-bold">{liveClass.title}</h3>
              <p className="text-[10px] text-white/60">{liveClass.subject} • {liveClass.teacherName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 pointer-events-auto">
            <button 
              onClick={() => setShowAttendingList(!showAttendingList)}
              className={`p-3 backdrop-blur-md text-white rounded-full transition-all border border-white/10 ${showAttendingList ? 'bg-indigo-600' : 'bg-white/10 hover:bg-white/20'}`}
            >
              <Users size={24} />
            </button>
            <button 
              onClick={onClose}
              className="p-3 bg-white/10 backdrop-blur-md text-white rounded-full hover:bg-white/20 transition-all border border-white/10"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Bottom Controls */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/40 backdrop-blur-xl p-4 rounded-3xl border border-white/10 pointer-events-auto">
          <button 
            onClick={toggleMute}
            className={`p-4 rounded-2xl transition-all ${isMuted ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
          >
            {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
          </button>
          <button 
            onClick={toggleVideo}
            className={`p-4 rounded-2xl transition-all ${isVideoOff ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
          >
            {isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
          </button>
          {canModerate && (
            <button 
              onClick={toggleScreenShare}
              className={`p-4 rounded-2xl transition-all ${isScreenSharing ? 'bg-indigo-600 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
              title="Share Screen"
            >
              <Monitor size={24} />
            </button>
          )}
          <button 
            onClick={() => setShowWhiteboard(!showWhiteboard)}
            className={`p-4 rounded-2xl transition-all ${showWhiteboard ? 'bg-indigo-600 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
            title="Interactive Whiteboard"
          >
            <Edit3 size={24} />
          </button>
          <button 
            onClick={() => setShowPolls(!showPolls)}
            className={`p-4 rounded-2xl transition-all ${showPolls ? 'bg-indigo-600 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
            title="Live Polls"
          >
            <BarChart2 size={24} />
          </button>
          {userProfile.role !== 'Alumni' && (
            <button 
              onClick={toggleHandRaise}
              className={`p-4 rounded-2xl transition-all ${isHandRaised ? 'bg-yellow-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
              title="Raise Hand"
            >
              <Hand size={24} className={isHandRaised ? 'fill-white' : ''} />
            </button>
          )}
          {isAdmin && (
            <button 
              onClick={endClass}
              className="px-6 py-4 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-900/20"
            >
              End Class
            </button>
          )}
          <div className="px-6 py-2 bg-white/10 rounded-2xl text-white text-sm font-bold flex items-center gap-2">
            <Users size={18} className="text-blue-400" />
            <span id="participant-count">{participantCount} Participants</span>
          </div>
        </div>
      </div>

      {/* Side Panels */}
      <AnimatePresence>
        {showPolls && (
          <motion.div 
            initial={{ x: 400 }}
            animate={{ x: 0 }}
            exit={{ x: 400 }}
            className="w-full md:w-80 bg-white flex flex-col shadow-2xl z-50"
          >
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <BarChart2 size={20} className="text-indigo-600" />
                <h3 className="font-bold text-slate-800">Live Polls</h3>
              </div>
              <button onClick={() => setShowPolls(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
              {canModerate && (
                <PollCreator onCreate={handleCreatePoll} />
              )}
              
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Recent Polls</h4>
                {polls.map(poll => (
                  <div key={poll.id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50 space-y-3">
                    <div className="flex justify-between items-start">
                      <h5 className="font-bold text-slate-800 text-sm">{poll.question}</h5>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        poll.status === 'Active' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-500'
                      }`}>
                        {poll.status}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {poll.options.map((opt, idx) => {
                        const totalVotes = Object.values(poll.votes).length;
                        const optionVotes = Object.values(poll.votes).filter(v => v === idx).length;
                        const percentage = totalVotes > 0 ? Math.round((optionVotes / totalVotes) * 100) : 0;
                        return (
                          <div key={idx} className="space-y-1">
                            <div className="flex justify-between text-[10px] font-medium">
                              <span className="text-slate-600">{opt}</span>
                              <span className="text-slate-400">{optionVotes} votes ({percentage}%)</span>
                            </div>
                            <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                              <div className="h-full bg-indigo-500" style={{ width: `${percentage}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {canModerate && poll.status === 'Active' && (
                      <button 
                        onClick={() => handleClosePoll(poll.id)}
                        className="w-full py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        Close Poll
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {showAttendingList && (
          <motion.div 
            initial={{ x: 400 }}
            animate={{ x: 0 }}
            exit={{ x: 400 }}
            className="w-full md:w-80 bg-white flex flex-col shadow-2xl z-50"
          >
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Users size={20} className="text-indigo-600" />
                <h3 className="font-bold text-slate-800">Attending</h3>
              </div>
              <button onClick={() => setShowAttendingList(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
              {participants.map((p) => (
                <div key={p.uid} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                      p.role === 'Admin' ? 'bg-red-500' : 
                      p.role === 'Leader' ? 'bg-blue-500' : 
                      'bg-slate-400'
                    }`}>
                      {p.displayName.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-slate-800">{p.displayName}</span>
                        {p.role === 'Admin' && <Shield size={12} className="text-red-500" />}
                        {p.role === 'Leader' && <Shield size={12} className="text-blue-500" />}
                      </div>
                      <p className={`text-[10px] uppercase font-bold tracking-wider ${
                        p.houseTeam === 'GOOD PIONEER' ? 'text-orange-500' :
                        p.houseTeam === 'GOOD PATRON' ? 'text-blue-500' :
                        p.houseTeam === 'GOOD SAVIOUR' ? 'text-emerald-500' :
                        p.houseTeam === 'GOOD SHEPHERD' ? 'text-purple-500' :
                        'text-slate-500'
                      }`}>
                        {p.houseTeam || 'No House'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.isHandRaised && <Hand size={14} className="text-yellow-500 fill-yellow-500" />}
                    {p.isVideoOff && <VideoOff size={14} className="text-slate-400" />}
                    {canModerate && p.uid !== userProfile.uid ? (
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => handleMuteUser(p.uid, !p.isMuted)}
                          className={`p-1.5 rounded-lg transition-all ${p.isMuted ? 'text-red-500 bg-red-50' : 'text-slate-400 hover:bg-slate-100'}`}
                          title={p.isMuted ? "Unmute User" : "Mute User"}
                        >
                          {p.isMuted ? <MicOff size={14} /> : <Mic size={14} />}
                        </button>
                        <button 
                          onClick={() => handleKickUser(p.uid)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          title="Kick User"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      p.isMuted ? <MicOff size={14} className="text-red-400" /> : <Mic size={14} className="text-emerald-400" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Sidebar */}
      <div className="w-full md:w-96 bg-white flex flex-col shadow-2xl">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3">
          <MessageSquare size={20} className="text-indigo-600" />
          <h3 className="font-bold text-slate-800">Live Chat</h3>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 italic text-sm">
              <MessageSquare size={32} className="mb-2 opacity-20" />
              Welcome to the live chat!
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className="space-y-1">
                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{m.user}</span>
                <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-2xl rounded-tl-none border border-slate-100">
                  {m.text}
                </p>
              </div>
            ))
          )}
        </div>

        <form onSubmit={handleSendMessage} className="p-6 border-t border-slate-100 flex gap-2">
          <input 
            type="text"
            placeholder="Type a message..."
            value={chatMessage}
            onChange={e => setChatMessage(e.target.value)}
            className="flex-1 px-4 py-3 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
          />
          <button 
            type="submit"
            className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
          >
            <Send size={20} />
          </button>
        </form>
      </div>
      </>
      )}
    </div>
  );
}

function VideoRenderer({ stream }: { stream?: MediaStream }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (ref.current && stream) {
      ref.current.srcObject = stream;
    }
  }, [stream]);

  if (!stream) {
    return (
      <div className="absolute inset-0 flex items-center justify-center text-white">
        <div className="text-center">
          <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-2">
            <VideoOff size={32} />
          </div>
          <p className="text-sm font-bold">Camera Off</p>
        </div>
      </div>
    );
  }

  return (
    <video 
      ref={ref} 
      autoPlay 
      playsInline
      className="w-full h-full object-cover" 
    />
  );
}

function Whiteboard({ socket, roomId, canDraw }: { socket: Socket | null, roomId: string, canDraw: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState('#4f46e5');
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
      }
    };

    resize();
    window.addEventListener('resize', resize);

    if (socket) {
      socket.on('whiteboard-draw', (data: any) => {
        const { x0, y0, x1, y1, color, width } = data;
        ctx.beginPath();
        ctx.moveTo(x0 * canvas.width, y0 * canvas.height);
        ctx.lineTo(x1 * canvas.width, y1 * canvas.height);
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.closePath();
      });

      socket.on('whiteboard-clear', () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      });
    }

    return () => {
      window.removeEventListener('resize', resize);
      socket?.off('whiteboard-draw');
      socket?.off('whiteboard-clear');
    };
  }, [socket]);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (!canDraw) return;
    setIsDrawing(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !canDraw || !canvasRef.current || !socket) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    // We need previous coordinates for smooth lines
    // For simplicity, we'll just draw points or small lines
    // In a real app, you'd store the last point in a ref
  };

  // Simplified drawing for the example
  const handleMove = (e: any) => {
    if (!isDrawing || !canDraw || !canvasRef.current || !socket) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    const x = (e.type.includes('touch') ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.type.includes('touch') ? e.touches[0].clientY : e.clientY) - rect.top;

    // Store last position in a ref to draw lines
    if ((canvas as any).lastX !== undefined) {
      const x0 = (canvas as any).lastX;
      const y0 = (canvas as any).lastY;
      
      ctx!.beginPath();
      ctx!.moveTo(x0, y0);
      ctx!.lineTo(x, y);
      ctx!.strokeStyle = tool === 'eraser' ? '#ffffff' : color;
      ctx!.lineWidth = tool === 'eraser' ? 20 : 3;
      ctx!.lineCap = 'round';
      ctx!.stroke();
      ctx!.closePath();

      socket.emit('whiteboard-draw', {
        roomId,
        drawData: {
          x0: x0 / canvas.width,
          y0: y0 / canvas.height,
          x1: x / canvas.width,
          y1: y / canvas.height,
          color: tool === 'eraser' ? '#ffffff' : color,
          width: tool === 'eraser' ? 20 : 3
        }
      });
    }

    (canvas as any).lastX = x;
    (canvas as any).lastY = y;
  };

  const handleEnd = () => {
    setIsDrawing(false);
    if (canvasRef.current) {
      (canvasRef.current as any).lastX = undefined;
      (canvasRef.current as any).lastY = undefined;
    }
  };

  const clear = () => {
    if (!canDraw || !canvasRef.current || !socket) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
    socket.emit('whiteboard-clear', { roomId });
  };

  return (
    <div className="flex-1 flex flex-col relative">
      <div className="flex-1 bg-white cursor-crosshair touch-none overflow-hidden">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onTouchStart={startDrawing}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
          className="w-full h-full"
        />
      </div>
      
      {canDraw && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-md border border-slate-200 p-2 rounded-2xl shadow-xl flex items-center gap-2">
          <button 
            onClick={() => setTool('pen')}
            className={`p-2 rounded-xl transition-all ${tool === 'pen' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-100'}`}
          >
            <Edit3 size={20} />
          </button>
          <button 
            onClick={() => setTool('eraser')}
            className={`p-2 rounded-xl transition-all ${tool === 'eraser' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-100'}`}
          >
            <Eraser size={20} />
          </button>
          <div className="w-px h-6 bg-slate-200 mx-1" />
          <div className="flex gap-1">
            {['#4f46e5', '#ef4444', '#10b981', '#f59e0b', '#000000'].map(c => (
              <button
                key={c}
                onClick={() => { setColor(c); setTool('pen'); }}
                className={`w-6 h-6 rounded-full border-2 transition-all ${color === c && tool === 'pen' ? 'border-slate-400 scale-110' : 'border-transparent'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="w-px h-6 bg-slate-200 mx-1" />
          <button 
            onClick={clear}
            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
            title="Clear Whiteboard"
          >
            <Trash2 size={20} />
          </button>
        </div>
      )}
    </div>
  );
}

function PollCreator({ onCreate }: { onCreate: (q: string, opts: string[]) => void }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || options.some(o => !o.trim())) return;
    onCreate(question, options);
    setQuestion('');
    setOptions(['', '']);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
      <div className="flex items-center gap-2 text-indigo-600 mb-2">
        <Plus size={16} />
        <span className="text-xs font-bold uppercase tracking-wider">Create New Poll</span>
      </div>
      <input
        type="text"
        placeholder="Ask a question..."
        value={question}
        onChange={e => setQuestion(e.target.value)}
        className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
      />
      <div className="space-y-2">
        {options.map((opt, idx) => (
          <input
            key={idx}
            type="text"
            placeholder={`Option ${idx + 1}`}
            value={opt}
            onChange={e => {
              const newOpts = [...options];
              newOpts[idx] = e.target.value;
              setOptions(newOpts);
            }}
            className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        ))}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setOptions([...options, ''])}
          disabled={options.length >= 4}
          className="flex-1 py-2 text-xs font-bold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50"
        >
          Add Option
        </button>
        <button
          type="submit"
          className="flex-1 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-all"
        >
          Launch Poll
        </button>
      </div>
    </form>
  );
}
