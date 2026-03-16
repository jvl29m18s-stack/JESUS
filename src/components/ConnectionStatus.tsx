import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Wifi, WifiOff, AlertCircle, X } from 'lucide-react';

export const ConnectionStatus: React.FC = () => {
  const [error, setError] = useState<{ message: string; isRecoverable: boolean } | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    const handleFirestoreError = (e: any) => {
      const detail = e.detail;
      // Only show connection/transport related errors or critical permission errors
      if (!detail.isRecoverable || detail.error.includes('transport errored') || detail.error.includes('unavailable')) {
        setError({
          message: detail.userMessage,
          isRecoverable: detail.isRecoverable
        });
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('firestore-error-event', handleFirestoreError);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('firestore-error-event', handleFirestoreError);
    };
  }, []);

  return (
    <div className="fixed bottom-6 left-6 z-[100] flex flex-col gap-3 pointer-events-none">
      <AnimatePresence>
        {!isOnline && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-white/10 pointer-events-auto"
          >
            <div className="w-8 h-8 bg-amber-500 rounded-xl flex items-center justify-center">
              <WifiOff size={16} />
            </div>
            <div>
              <p className="text-xs font-bold">Offline Mode</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest">Check your connection</p>
            </div>
          </motion.div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className={`px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border pointer-events-auto ${
              error.isRecoverable ? 'bg-slate-900 text-white border-white/10' : 'bg-rose-500 text-white border-rose-400'
            }`}
          >
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
              error.isRecoverable ? 'bg-amber-500' : 'bg-white/20'
            }`}>
              <AlertCircle size={16} />
            </div>
            <div className="flex-1 pr-4">
              <p className="text-xs font-bold">{error.message}</p>
              <p className="text-[10px] opacity-70 uppercase tracking-widest">
                {error.isRecoverable ? 'Attempting to reconnect...' : 'Critical Error'}
              </p>
            </div>
            <button 
              onClick={() => setError(null)}
              className="p-1 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
