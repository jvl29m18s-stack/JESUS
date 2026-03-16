import React, { useEffect, useRef, useState } from 'react';
import { collection, addDoc, onSnapshot, query, where, deleteDoc, getDocs, doc } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import Peer from 'simple-peer';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Camera, RefreshCw, Users } from 'lucide-react';
import { motion } from 'motion/react';

interface VideoCallProps {
  session: any;
  onClose: () => void;
}

const VideoCall: React.FC<VideoCallProps> = ({ session, onClose }) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<any[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [participantsCount, setParticipantsCount] = useState(0);
  const [isHost, setIsHost] = useState(false);
  
  const userVideo = useRef<HTMLVideoElement>(null);
  const peersRef = useRef<any[]>([]);
  const socketId = auth.currentUser?.uid;

  useEffect(() => {
    setIsHost(session.startedBy === socketId);
  }, [session.startedBy, socketId]);

  useEffect(() => {
    const initMedia = async () => {
      try {
        // In telecast mode, non-hosts don't need to capture media initially
        const shouldCapture = session.type === 'class' || isHost;
        
        let currentStream: MediaStream | null = null;
        if (shouldCapture) {
          currentStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });
          setStream(currentStream);
          if (userVideo.current) {
            userVideo.current.srcObject = currentStream;
          }
        }

        // Signaling logic
        const signalingRef = collection(db, 'sessions', 'current_live', 'signaling');
        
        // Listen for incoming signals
        const q = query(signalingRef, where('to', '==', socketId));
        const unsub = onSnapshot(q, (snapshot) => {
          snapshot.docChanges().forEach(async (change) => {
            if (change.type === 'added') {
              const data = change.doc.data();
              const peerId = data.from;
              
              if (data.type === 'offer') {
                const peer = createPeer(peerId, socketId!, currentStream || new MediaStream(), false);
                peer.signal(JSON.parse(data.signal));
                peersRef.current.push({ peerId, peer });
                setPeers(prev => [...prev, { peerId, peer }]);
              } else if (data.type === 'answer') {
                const item = peersRef.current.find(p => p.peerId === peerId);
                if (item) {
                  item.peer.signal(JSON.parse(data.signal));
                }
              }
              // Delete the signal doc after processing
              await deleteDoc(change.doc.ref);
            }
          });
        });

        // If not host, connect to host
        if (!isHost) {
          const peer = createPeer(session.startedBy, socketId!, currentStream || new MediaStream(), true);
          peersRef.current.push({ peerId: session.startedBy, peer });
          setPeers(prev => [...prev, { peerId: session.startedBy, peer }]);
        }

        return () => {
          unsub();
          if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
          }
        };
      } catch (err) {
        console.error('Failed to get media stream', err);
      }
    };

    initMedia();
  }, [isHost, session.type]);

  const createPeer = (to: string, from: string, stream: MediaStream, initiator: boolean) => {
    const peer = new Peer({
      initiator,
      trickle: false,
      stream,
    });

    peer.on('signal', async (signal) => {
      await addDoc(collection(db, 'sessions', 'current_live', 'signaling'), {
        to,
        from,
        signal: JSON.stringify(signal),
        type: initiator ? 'offer' : 'answer',
        timestamp: new Date().toISOString(),
      });
    });

    return peer;
  };

  const toggleMute = () => {
    if (stream) {
      stream.getAudioTracks().forEach(track => (track.enabled = !track.enabled));
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (stream) {
      stream.getVideoTracks().forEach(track => (track.enabled = !track.enabled));
      setIsVideoOff(!isVideoOff);
    }
  };

  const switchCamera = async () => {
    if (stream) {
      const oldVideoTrack = stream.getVideoTracks()[0];
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: isFrontCamera ? 'environment' : 'user' },
        audio: true,
      });
      
      const newVideoTrack = newStream.getVideoTracks()[0];
      
      // Replace track for all peers
      peersRef.current.forEach(p => {
        p.peer.replaceTrack(oldVideoTrack, newVideoTrack, stream);
      });

      // Update local stream
      stream.removeTrack(oldVideoTrack);
      stream.addTrack(newVideoTrack);
      oldVideoTrack.stop();
      
      setStream(new MediaStream(stream.getTracks()));
      setIsFrontCamera(!isFrontCamera);
      
      if (userVideo.current) {
        userVideo.current.srcObject = stream;
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-slate-950 flex flex-col"
    >
      {/* Header */}
      <div className="p-4 flex items-center justify-between bg-gradient-to-b from-black/50 to-transparent">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <h2 className="text-white font-bold">{session.title}</h2>
        </div>
        <div className="flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full text-white text-sm">
          <Users size={16} />
          <span>{peers.length + 1}</span>
        </div>
      </div>

      {/* Video Grid */}
      <div className="flex-1 p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto">
        {/* Local Video */}
        <div className="relative aspect-video bg-slate-900 rounded-2xl overflow-hidden border border-white/10">
          <video
            ref={userVideo}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-4 left-4 bg-black/50 px-3 py-1 rounded-lg text-white text-sm">
            You (Me)
          </div>
          {isVideoOff && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
              <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center text-slate-500">
                <VideoOff size={40} />
              </div>
            </div>
          )}
        </div>

        {/* Remote Videos */}
        {peers.map((peerObj, index) => (
          <RemoteVideo key={peerObj.peerId} peer={peerObj.peer} />
        ))}
      </div>

      {/* Controls */}
      <div className="p-8 flex items-center justify-center gap-6 bg-gradient-to-t from-black/50 to-transparent">
        <button
          onClick={toggleMute}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
            isMuted ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'
          }`}
        >
          {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
        </button>

        <button
          onClick={toggleVideo}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
            isVideoOff ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'
          }`}
        >
          {isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
        </button>

        <button
          onClick={switchCamera}
          className="w-14 h-14 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
        >
          <RefreshCw size={24} />
        </button>

        <button
          onClick={onClose}
          className="w-14 h-14 rounded-full bg-red-600 text-white flex items-center justify-center hover:bg-red-700 transition-colors shadow-lg shadow-red-900/20"
        >
          <PhoneOff size={24} />
        </button>
      </div>
    </motion.div>
  );
};

const RemoteVideo = ({ peer }: { peer: any }) => {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    peer.on('stream', (stream: MediaStream) => {
      if (ref.current) {
        ref.current.srcObject = stream;
      }
    });
  }, [peer]);

  return (
    <div className="relative aspect-video bg-slate-900 rounded-2xl overflow-hidden border border-white/10">
      <video
        ref={ref}
        autoPlay
        playsInline
        className="w-full h-full object-cover"
      />
      <div className="absolute bottom-4 left-4 bg-black/50 px-3 py-1 rounded-lg text-white text-sm">
        Participant
      </div>
    </div>
  );
};

export default VideoCall;
