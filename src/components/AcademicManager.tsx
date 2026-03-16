import React, { useState, useEffect } from 'react';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  serverTimestamp, 
  deleteDoc, 
  doc 
} from 'firebase/firestore';
import { db, storage } from '../firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { AcademicContent, UserProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '../firestoreErrorHandler';
import { 
  Video, 
  FileText, 
  HelpCircle, 
  Plus, 
  Trash2, 
  ExternalLink, 
  Upload,
  X,
  ChevronDown,
  Play,
  Download,
  Users,
  MessageSquare,
  Send
} from 'lucide-react';

import DailyQuizPlayer from './DailyQuizPlayer';
import DailyQuizCreator from './DailyQuizCreator';
import { DailyQuiz, DiscussionMessage } from '../types';
import { sendStandardNotification } from '../services/notificationService';
import { useUploads } from './UploadContext';
import { VideoMessageBubble } from './VideoMessageBubble';

interface AcademicManagerProps {
  userProfile: UserProfile;
  selectedStandard: string;
  setSelectedStandard: (standard: string) => void;
}

export default function AcademicManager({ userProfile, selectedStandard, setSelectedStandard }: AcademicManagerProps) {
  const [activeTab, setActiveTab] = useState<'Video' | 'Notes' | 'Quiz' | 'Students' | 'Discussion'>('Video');
  const [content, setContent] = useState<AcademicContent[]>([]);
  const [dailyQuizzes, setDailyQuizzes] = useState<DailyQuiz[]>([]);
  const [messages, setMessages] = useState<DiscussionMessage[]>([]);
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [showDailyQuizCreator, setShowDailyQuizCreator] = useState(false);
  const { startUpload } = useUploads();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'Video' as 'Video' | 'Notes' | 'Quiz',
    url: '',
    subject: ''
  });

  const isAdmin = userProfile.role === 'Admin' || userProfile.role === 'Leader';

  const tabs = [
    { id: 'Video', label: 'Class Videos', icon: <Video size={18} /> },
    { id: 'Notes', label: 'Notes', icon: <FileText size={18} /> },
    { id: 'Quiz', label: 'Daily Quizzes', icon: <HelpCircle size={18} /> },
    { id: 'Students', label: 'Students', icon: <Users size={18} /> },
    { id: 'Discussion', label: 'Discussion', icon: <MessageSquare size={18} /> },
  ];

  useEffect(() => {
    const q = query(
      collection(db, 'academic_content'),
      where('standard', '==', selectedStandard),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AcademicContent[];
      setContent(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'academic_content');
    });

    // Fetch daily quizzes
    const dq = query(
      collection(db, 'dailyQuizzes'),
      where('standard', '==', selectedStandard),
      orderBy('createdAt', 'desc')
    );
    const unsubscribeDQ = onSnapshot(dq, (snapshot) => {
      setDailyQuizzes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as DailyQuiz));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'dailyQuizzes');
    });

    // Fetch discussion messages
    const mq = query(
      collection(db, 'discussions'),
      where('standard', '==', selectedStandard),
      orderBy('createdAt', 'asc')
    );
    const unsubscribeMQ = onSnapshot(mq, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as DiscussionMessage));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'discussions');
    });

    // Fetch students for this standard
    const sq = query(
      collection(db, 'users'),
      where('standard', '==', selectedStandard),
      where('role', 'in', ['Student', 'Leader'])
    );
    const unsubscribeSQ = onSnapshot(sq, (snapshot) => {
      setStudents(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }) as UserProfile));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return () => {
      unsubscribe();
      unsubscribeDQ();
      unsubscribeMQ();
      unsubscribeSQ();
    };
  }, [selectedStandard]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      await addDoc(collection(db, 'discussions'), {
        standard: selectedStandard,
        userId: userProfile.uid,
        userName: userProfile.displayName,
        userPhoto: userProfile.photoURL,
        text: newMessage,
        createdAt: serverTimestamp()
      });

      // Notify others in the standard
      await sendStandardNotification(selectedStandard, {
        title: 'New Discussion Message',
        message: `${userProfile.displayName} posted in the class discussion.`,
        type: 'Discussion'
      });

      setNewMessage('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'discussions');
    }
  };

  const isImage = (url: string | undefined) => {
    if (!url) return false;
    return url.match(/\.(jpeg|jpg|gif|png|webp)$/) != null || url.includes('image');
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === 'Quiz') {
      setShowDailyQuizCreator(true);
      return;
    }
    if (!formData.title || !formData.subject) return;

    if (selectedFile) {
      // Background upload
      startUpload(
        selectedFile, 
        'academic', 
        { 
          title: formData.title, 
          description: formData.description, 
          type: formData.type, 
          subject: formData.subject 
        }, 
        userProfile, 
        selectedStandard
      );
      
      // Notify students (optimistically or we can wait, but background upload is better)
      await sendStandardNotification(selectedStandard, {
        title: `New ${formData.type} Uploading`,
        message: `A new ${formData.type.toLowerCase()} "${formData.title}" is being uploaded for ${formData.subject}.`,
        type: 'Class'
      });

      setIsUploading(false);
      setFormData({
        title: '',
        description: '',
        type: 'Video',
        url: '',
        subject: ''
      });
      setSelectedFile(null);
    } else if (formData.url) {
      setLoading(true);
      try {
        await addDoc(collection(db, 'academic_content'), {
          ...formData,
          standard: selectedStandard,
          authorId: userProfile.uid,
          authorName: userProfile.displayName,
          createdAt: serverTimestamp()
        });

        await sendStandardNotification(selectedStandard, {
          title: `New ${formData.type} Shared`,
          message: `A new ${formData.type.toLowerCase()} "${formData.title}" has been shared for ${formData.subject}.`,
          type: 'Class'
        });

        setIsUploading(false);
        setFormData({
          title: '',
          description: '',
          type: 'Video',
          url: '',
          subject: ''
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'academic_content');
      } finally {
        setLoading(false);
      }
    } else {
      alert("Please provide a URL or upload a file.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this content?')) return;
    try {
      await deleteDoc(doc(db, 'academic_content', id));
    } catch (error) {
      console.error("Error deleting content:", error);
    }
  };

  const handleDeleteDailyQuiz = async (id: string) => {
    if (!window.confirm('Delete this daily quiz?')) return;
    try {
      await deleteDoc(doc(db, 'dailyQuizzes', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `dailyQuizzes/${id}`);
    }
  };

  const filteredContent = content.filter(c => c.type === activeTab);

  if (!selectedStandard || selectedStandard === 'All Standards') {
    return (
      <div className="bg-white rounded-[32px] p-12 border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center max-w-7xl mx-auto">
        <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-6">
          <Users size={40} className="text-emerald-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Select a Standard</h2>
        <p className="text-slate-500 max-w-md mb-8">
          Please select a specific standard from the top menu to view academic content, students, and discussions.
        </p>
      </div>
    );
  }

  if (activeTab === 'Students') {
    const houses: ('GOOD PIONEER' | 'GOOD PATRON' | 'GOOD SAVIOUR' | 'GOOD SHEPHERD')[] = [
      'GOOD PIONEER', 'GOOD PATRON', 'GOOD SAVIOUR', 'GOOD SHEPHERD'
    ];
    const houseColors = {
      'GOOD PIONEER': 'bg-blue-500',
      'GOOD PATRON': 'bg-red-500',
      'GOOD SAVIOUR': 'bg-yellow-500',
      'GOOD SHEPHERD': 'bg-green-500'
    };

    return (
      <div className="space-y-6 max-w-7xl mx-auto custom-scrollbar">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Academics - {selectedStandard}</h1>
            <p className="text-slate-500 text-sm">Access videos, notes, and quizzes for this standard.</p>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            {isAdmin && (
              <button 
                onClick={() => setIsUploading(true)}
                className="flex-1 md:flex-none px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
              >
                <Upload size={18} />
                <span>Upload Content</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex border-b border-slate-200 overflow-x-auto no-scrollbar mobile-touch-scroll">
          <div className="flex min-w-max">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition-all relative ${
                  activeTab === tab.id ? 'text-slate-800' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {tab.icon}
                {tab.label}
                {activeTab === tab.id && (
                  <motion.div 
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-800" 
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-8">
          {houses.map(house => {
            const houseStudents = students.filter(s => s.houseTeam === house);
            return (
              <div key={house} className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${houseColors[house]}`} />
                  <h3 className="text-lg font-bold text-slate-800 uppercase tracking-wider">
                    {house} ({houseStudents.length} students)
                  </h3>
                </div>
                
                <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-100">
                        <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Name</th>
                        <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">ID</th>
                        <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {houseStudents.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-6 py-8 text-center text-slate-400 italic text-sm">
                            No students in this house for this standard.
                          </td>
                        </tr>
                      ) : (
                        houseStudents.map(student => (
                          <tr key={student.uid} className="hover:bg-slate-50/30 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-slate-800">{student.displayName}</span>
                                {student.role === 'Leader' && (
                                  <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded-full uppercase">Leader</span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-sm text-slate-500 font-medium">{student.rollNumber || 'N/A'}</span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <div className="relative flex h-2 w-2">
                                  {student.isOnline && (
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                  )}
                                  <div className={`relative inline-flex rounded-full h-2 w-2 ${student.isOnline ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                </div>
                                <span className={`text-xs font-bold ${student.isOnline ? 'text-emerald-600' : 'text-slate-400'}`}>
                                  {student.isOnline ? 'Online Now' : 'Offline'}
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const subjects = [
    'Mathematics', 'Science', 'English', 'Hindi', 'Social Studies', 
    'Computer Science', 'Physics', 'Chemistry', 'Biology'
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto custom-scrollbar">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Academics - {selectedStandard}</h1>
          <p className="text-slate-500 text-sm">Access videos, notes, and quizzes for this standard.</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          {isAdmin && (
            <button 
              onClick={() => {
                if (activeTab === 'Quiz') {
                  setShowDailyQuizCreator(true);
                } else {
                  setIsUploading(true);
                }
              }}
              className="flex-1 md:flex-none px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
            >
              <Upload size={18} />
              <span>{activeTab === 'Quiz' ? 'Create Daily Quiz' : 'Upload Content'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 overflow-x-auto no-scrollbar mobile-touch-scroll">
        <div className="flex min-w-max">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition-all relative ${
                activeTab === tab.id ? 'text-slate-800' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {tab.icon}
              {tab.label}
              {activeTab === tab.id && (
                <motion.div 
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-800" 
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content Grid */}
      {activeTab === 'Quiz' ? (
        <div className="space-y-8">
          {dailyQuizzes.length === 0 ? (
            <div className="py-20 text-center bg-white rounded-3xl border border-slate-100">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <HelpCircle size={32} className="text-slate-300" />
              </div>
              <p className="text-slate-400 italic">No daily quizzes available yet.</p>
            </div>
          ) : (
            dailyQuizzes.map(quiz => (
              <div key={quiz.id} className="relative group">
                <DailyQuizPlayer quiz={quiz} userProfile={userProfile} />
                {isAdmin && (
                  <button 
                    onClick={() => handleDeleteDailyQuiz(quiz.id)}
                    className="absolute top-6 right-16 p-2 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={20} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredContent.length === 0 ? (
              <div className="col-span-full py-20 text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  {activeTab === 'Video' ? <Video size={32} className="text-slate-300" /> :
                   activeTab === 'Notes' ? <FileText size={32} className="text-slate-300" /> :
                   <HelpCircle size={32} className="text-slate-300" />}
                </div>
                <p className="text-slate-400 italic">No {activeTab.toLowerCase()} content available yet.</p>
              </div>
            ) : (
              filteredContent.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="relative group"
                >
                  {item.type === 'Video' ? (
                    <div className="relative">
                      <VideoMessageBubble
                        title={item.title}
                        description={item.description}
                        url={item.url || ''}
                        subject={item.subject}
                        authorName={item.authorName}
                        createdAt={item.createdAt}
                        status={item.status}
                        uploadProgress={item.uploadProgress}
                      />
                      {isAdmin && (
                        <button 
                          onClick={() => handleDelete(item.id)}
                          className="absolute top-2 right-2 p-2 bg-white/80 backdrop-blur-sm text-slate-400 hover:text-red-500 rounded-full shadow-sm transition-all opacity-0 group-hover:opacity-100 z-10"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all">
                      <div className="flex justify-between items-start mb-4">
                        <div className={`p-3 rounded-xl ${
                          item.type === 'Notes' ? 'bg-emerald-50 text-emerald-600' :
                          'bg-purple-50 text-purple-600'
                        }`}>
                          {item.type === 'Notes' ? <FileText size={20} /> : <HelpCircle size={20} />}
                        </div>
                        {isAdmin && (
                          <button 
                            onClick={() => handleDelete(item.id)}
                            className="p-2 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                      
                      {item.type === 'Notes' && isImage(item.url) && (
                        <div className="mb-4 rounded-xl overflow-hidden bg-slate-50 border border-slate-100 aspect-video">
                          <img 
                            src={item.url} 
                            alt={item.title}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}

                      <div className="mb-4">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{item.subject}</span>
                        <h3 className="font-bold text-slate-800 mt-1">{item.title}</h3>
                        <p className="text-sm text-slate-500 line-clamp-2 mt-1">{item.description}</p>
                      </div>
                      <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                        <span className="text-[10px] text-slate-400 font-medium">By {item.authorName}</span>
                        {item.url && (
                          <div className="flex items-center gap-3">
                            {item.type === 'Notes' ? (
                              <a 
                                href={item.url} 
                                download
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-emerald-600 hover:text-emerald-700 font-bold text-xs flex items-center gap-1 bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors"
                              >
                                <Download size={14} /> Download File
                              </a>
                            ) : (
                              <a 
                                href={item.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-purple-600 hover:text-purple-700 font-bold text-xs flex items-center gap-1"
                              >
                                <ExternalLink size={14} /> Take Quiz
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      )}

      {activeTab === 'Discussion' && (
        <div className="bg-white rounded-[32px] p-4 md:p-8 border border-slate-100 shadow-sm flex flex-col h-[500px] md:h-[600px]">
          <div className="flex-1 overflow-y-auto space-y-6 mb-6 pr-2 md:pr-4 custom-scrollbar mobile-touch-scroll">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 italic">
                <MessageSquare size={48} className="mb-4 opacity-20" />
                <p>No messages yet. Start the discussion!</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className={`flex gap-4 ${msg.userId === userProfile.uid ? 'flex-row-reverse' : ''}`}>
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex-shrink-0 overflow-hidden border border-slate-200">
                    {msg.userPhoto ? (
                      <img src={msg.userPhoto} alt={msg.userName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold">
                        {msg.userName.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className={`max-w-[70%] space-y-1 ${msg.userId === userProfile.uid ? 'items-end' : ''}`}>
                    <div className="flex items-center gap-2 px-1">
                      <span className="text-xs font-bold text-slate-800">{msg.userName}</span>
                      <span className="text-[10px] text-slate-400">
                        {msg.createdAt?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className={`p-4 rounded-2xl text-sm ${
                      msg.userId === userProfile.uid 
                        ? 'bg-indigo-600 text-white rounded-tr-none' 
                        : 'bg-slate-50 text-slate-700 border border-slate-100 rounded-tl-none'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleSendMessage} className="flex gap-3">
            <input 
              type="text"
              placeholder="Type your message..."
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              className="flex-1 px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
            />
            <button 
              type="submit"
              disabled={!newMessage.trim()}
              className="px-6 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 disabled:shadow-none flex items-center gap-2"
            >
              <Send size={20} />
              <span>Send</span>
            </button>
          </form>
        </div>
      )}

      {/* Daily Quiz Creator Modal */}
      <AnimatePresence>
        {showDailyQuizCreator && (
          <DailyQuizCreator 
            userProfile={userProfile}
            standard={selectedStandard}
            onClose={() => setShowDailyQuizCreator(false)}
          />
        )}
      </AnimatePresence>

      {/* Upload Modal */}
      <AnimatePresence>
        {isUploading && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-0 md:p-4">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="bg-white md:rounded-[32px] w-full max-w-lg p-6 md:p-8 shadow-2xl flex flex-col h-full md:h-auto md:max-h-[90vh]"
            >
              <div className="flex justify-between items-center mb-6 md:mb-8 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                    <Upload size={20} />
                  </div>
                  <h2 className="text-xl font-bold text-slate-800">Upload Academic Content</h2>
                </div>
                <button onClick={() => setIsUploading(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleUpload} className="space-y-6 overflow-y-auto pr-2 custom-scrollbar">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Content Title *</label>
                  <input 
                    required
                    type="text"
                    placeholder="e.g. Introduction to Fractions"
                    value={formData.title}
                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Content Type *</label>
                    <div className="relative">
                      <select 
                        required
                        value={formData.type}
                        onChange={e => setFormData({ ...formData, type: e.target.value as any })}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-emerald-500 outline-none appearance-none bg-white"
                      >
                        <option value="Video">Video</option>
                        <option value="Notes">Notes</option>
                        <option value="Quiz">Quiz</option>
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Subject *</label>
                    <div className="relative">
                      <select 
                        required
                        value={formData.subject}
                        onChange={e => setFormData({ ...formData, subject: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-emerald-500 outline-none appearance-none bg-white"
                      >
                        <option value="">Select</option>
                        {subjects.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Description</label>
                  <textarea 
                    placeholder="Briefly describe the content..."
                    rows={3}
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Upload File (PDF, Photos, etc.)</label>
                  <div className="relative">
                    <input 
                      type="file"
                      accept="image/*,application/pdf,.doc,.docx,.ppt,.pptx"
                      onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                      className="hidden"
                      id="file-upload"
                      disabled={loading}
                    />
                    <label 
                      htmlFor="file-upload"
                      className={`w-full px-4 py-3 rounded-xl border-2 border-dashed border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/30 cursor-pointer transition-all flex items-center justify-center gap-2 text-slate-500 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <Upload size={18} />
                      <span className="text-sm font-medium">
                        {selectedFile ? selectedFile.name : 'Select PDF or Photo from device'}
                      </span>
                    </label>
                  </div>
                  {uploadProgress > 0 && uploadProgress < 100 && (
                    <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
                      <div 
                        className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300" 
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  )}
                  <p className="text-[10px] text-slate-400 italic">Supports PDF, Screenshots, Photos. Max 50MB.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Or Paste URL</label>
                  <input 
                    type="url"
                    placeholder="https://example.com/file.pdf"
                    value={formData.url}
                    onChange={e => setFormData({ ...formData, url: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsUploading(false)}
                    className="flex-1 py-3 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Upload size={18} />
                        <span>Upload</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
