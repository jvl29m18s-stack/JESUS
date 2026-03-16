import React from 'react';
import { useUploads } from './UploadContext';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle, AlertCircle, Loader2, Video } from 'lucide-react';

export const UploadOverlay: React.FC = () => {
  const { activeUploads, removeUpload } = useUploads();

  if (activeUploads.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-80 pointer-events-none">
      <AnimatePresence>
        {activeUploads.map((upload) => (
          <motion.div
            key={upload.id}
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="bg-white border border-slate-200 shadow-2xl rounded-2xl p-4 pointer-events-auto overflow-hidden relative"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 shrink-0">
                <Video size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">{upload.fileName}</p>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
                  {upload.status === 'uploading' ? `Uploading ${Math.round(upload.progress)}%` : upload.status}
                </p>
              </div>
              <button 
                onClick={() => removeUpload(upload.id)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="relative h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <motion.div 
                className={`absolute top-0 left-0 h-full rounded-full ${
                  upload.status === 'error' ? 'bg-red-500' : 'bg-emerald-500'
                }`}
                initial={{ width: 0 }}
                animate={{ width: `${upload.progress}%` }}
                transition={{ type: 'spring', bounce: 0, duration: 0.5 }}
              />
            </div>

            {upload.status === 'completed' && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-2 flex items-center gap-1.5 text-emerald-600 text-xs font-bold"
              >
                <CheckCircle size={14} />
                <span>Upload Complete!</span>
              </motion.div>
            )}

            {upload.status === 'error' && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-2 flex items-center gap-1.5 text-red-600 text-xs font-bold"
              >
                <AlertCircle size={14} />
                <span>Upload Failed</span>
              </motion.div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
