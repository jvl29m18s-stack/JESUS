import React, { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { Video, Radio, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import VideoCall from './VideoCall';

const LiveSessionBanner: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [showCall, setShowCall] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'sessions', 'current_live'), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        if (data.status === 'active') {
          setSession(data);
        } else {
          setSession(null);
          setShowCall(false);
        }
      } else {
        setSession(null);
        setShowCall(false);
      }
    });

    return () => unsub();
  }, []);

  if (!session) return null;

  return (
    <>
      <AnimatePresence>
        {!showCall && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-4 left-4 right-4 z-50 bg-white border border-emerald-100 shadow-xl rounded-2xl p-4 flex items-center justify-between"
            id="live-notification"
          >
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                  {session.type === 'class' ? <Video size={24} /> : <Radio size={24} />}
                </div>
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 border-2 border-white rounded-full animate-pulse" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900" id="live-title">{session.title}</h3>
                <p className="text-sm text-slate-500">
                  {session.type === 'class' ? 'Live Class in Progress' : 'Live Telecast in Progress'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCall(true)}
                className="bg-emerald-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200"
                id="join-btn"
              >
                Join Now
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCall && (
          <VideoCall
            session={session}
            onClose={() => setShowCall(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default LiveSessionBanner;
