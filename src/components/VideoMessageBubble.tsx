import React, { useState } from 'react';
import { Play, Download, Clock, Video, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';

interface VideoMessageBubbleProps {
  title: string;
  description?: string;
  url: string;
  thumbnailUrl?: string;
  subject?: string;
  authorName?: string;
  createdAt?: any;
  status?: 'uploading' | 'ready' | 'error';
  uploadProgress?: number;
}

export const VideoMessageBubble: React.FC<VideoMessageBubbleProps> = ({
  title,
  description,
  url,
  thumbnailUrl,
  subject,
  authorName,
  createdAt,
  status,
  uploadProgress = 0
}) => {
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (status === 'uploading') return;
    setIsDownloaded(true);
    window.open(url, '_blank');
  };

  return (
    <motion.div 
      className={`group relative bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 ${status === 'uploading' ? 'opacity-80' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Thumbnail Area */}
      <div className="relative aspect-video bg-slate-900 overflow-hidden">
        <img 
          src={thumbnailUrl || `https://picsum.photos/seed/${title}/800/450`} 
          alt={title}
          className={`w-full h-full object-cover transition-transform duration-500 ${isHovered && status !== 'uploading' ? 'scale-110 blur-[2px]' : 'scale-100'}`}
          referrerPolicy="no-referrer"
        />
        
        {/* Overlay */}
        <div className={`absolute inset-0 bg-black/20 flex items-center justify-center transition-opacity duration-300 ${isHovered && status !== 'uploading' ? 'opacity-100' : 'opacity-0'}`}>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => window.open(url, '_blank')}
            className="w-16 h-16 bg-white/20 backdrop-blur-md border border-white/30 rounded-full flex items-center justify-center text-white shadow-2xl"
          >
            <Play size={32} fill="currentColor" />
          </motion.button>
        </div>

        {/* Uploading Overlay */}
        {status === 'uploading' && (
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-center p-6">
            <div className="w-12 h-12 border-4 border-white/20 border-t-emerald-500 rounded-full animate-spin mb-4" />
            <div className="w-full max-w-[120px] bg-white/20 h-1.5 rounded-full overflow-hidden">
              <motion.div 
                className="bg-emerald-500 h-full"
                initial={{ width: 0 }}
                animate={{ width: `${uploadProgress}%` }}
              />
            </div>
            <span className="text-[10px] font-black text-white uppercase tracking-widest mt-2">
              Uploading {Math.round(uploadProgress)}%
            </span>
          </div>
        )}

        {/* Duration Badge (Mock) */}
        {status !== 'uploading' && (
          <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1">
            <Clock size={10} />
            <span>12:45</span>
          </div>
        )} {/* Subject Tag */}
        {subject && (
          <div className="absolute top-3 left-3 bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider">
            {subject}
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="p-4">
        <div className="flex justify-between items-start gap-2 mb-1">
          <h3 className="font-bold text-slate-900 line-clamp-1 flex-1">{title}</h3>
          <button 
            onClick={handleDownload}
            className={`shrink-0 transition-colors ${isDownloaded ? 'text-emerald-500' : 'text-slate-400 hover:text-emerald-500'}`}
          >
            {isDownloaded ? <CheckCircle2 size={20} /> : <Download size={20} />}
          </button>
        </div>
        
        {description && (
          <p className="text-xs text-slate-500 line-clamp-2 mb-3 leading-relaxed">
            {description}
          </p>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-slate-500">
              <Video size={12} />
            </div>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight">
              {authorName || 'Instructor'}
            </span>
          </div>
          <span className="text-[10px] font-medium text-slate-400">
            {createdAt?.toDate ? createdAt.toDate().toLocaleDateString() : 'Recently'}
          </span>
        </div>
      </div>
    </motion.div>
  );
};
