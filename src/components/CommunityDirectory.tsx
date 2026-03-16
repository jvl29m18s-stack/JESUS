import React, { useState, useEffect } from 'react';
import { Users, Search, Mail, Phone, MapPin, UserCircle, Filter, ChevronRight, Trash2, LayoutGrid, List, FileText, Download, ShieldCheck, Crown, Shield, UserPlus, X } from 'lucide-react';
import { collection, query, onSnapshot, orderBy, deleteDoc, doc, getDocs, where, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, QuizResult } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '../firestoreErrorHandler';
import { exportIndividualReport, saveToPortfolio } from '../services/reportService';

interface CommunityDirectoryProps {
  userProfile: UserProfile;
}

const CommunityDirectory: React.FC<CommunityDirectoryProps> = ({ userProfile }) => {
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('All');
  const [viewMode, setViewMode] = useState<'grid' | 'house'>('grid');
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('displayName', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMembers(snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as UserProfile)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleRemoveMember = async (member: UserProfile) => {
    const action = member.isDeleted ? 'reactivate' : 'deactivate';
    if (!window.confirm(`Are you sure you want to ${action} ${member.displayName}?`)) {
      return;
    }

    try {
      await updateDoc(doc(db, 'users', member.uid), {
        isDeleted: !member.isDeleted
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${member.uid}`);
    }
  };

  const filteredMembers = members.filter(member => {
    const matchesSearch = member.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         member.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'All' || member.role === filterRole;
    const matchesDeleted = userProfile.role === 'Admin' ? true : !member.isDeleted;
    return matchesSearch && matchesRole && matchesDeleted;
  });

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <h3 className="text-2xl font-serif font-medium text-[#1a1a1a] flex items-center gap-3">
              <Users className="text-indigo-500" /> Community Directory
            </h3>
            <p className="text-[#5A5A40]/60 font-serif italic">
              Connect with students, teachers, and administrators.
            </p>
          </div>

            <div className="flex flex-col sm:flex-row gap-4">
              {userProfile.role === 'Admin' && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20"
                >
                  <UserPlus size={18} />
                  <span>Add Member</span>
                </button>
              )}
              <div className="flex bg-slate-50 border border-slate-200 rounded-xl p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                title="Grid View"
              >
                <LayoutGrid size={18} />
              </button>
              <button
                onClick={() => setViewMode('house')}
                className={`p-2 rounded-lg transition-all ${viewMode === 'house' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                title="House View"
              >
                <List size={18} />
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Search members..."
                className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-full sm:w-64"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
              <Filter size={16} className="text-slate-400" />
              <select
                className="bg-transparent text-sm focus:outline-none"
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
              >
                <option value="All">All Roles</option>
                <option value="Admin">Admin</option>
                <option value="Leader">Leader</option>
                <option value="Student">Student</option>
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : viewMode === 'house' ? (
          <div className="space-y-12">
            {['GOOD PIONEER', 'GOOD PATRON', 'GOOD SAVIOUR', 'GOOD SHEPHERD'].map(house => {
              const houseMembers = filteredMembers.filter(m => m.houseTeam === house);
              const houseColors = {
                'GOOD PIONEER': 'bg-blue-500',
                'GOOD PATRON': 'bg-red-500',
                'GOOD SAVIOUR': 'bg-yellow-500',
                'GOOD SHEPHERD': 'bg-green-500'
              };
              
              return (
                <div key={house} className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className={`w-4 h-4 rounded-full ${houseColors[house as keyof typeof houseColors]}`} />
                    <h4 className="text-xl font-bold text-slate-800 tracking-tight uppercase">
                      {house} <span className="text-slate-400 font-medium ml-2">({houseMembers.length})</span>
                    </h4>
                    <div className="flex-1 h-px bg-slate-100" />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {houseMembers.map((member) => (
                      <MemberCard key={member.uid} member={member} userProfile={userProfile} handleRemoveMember={handleRemoveMember} />
                    ))}
                    {houseMembers.length === 0 && (
                      <div className="col-span-full py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        <p className="text-slate-400 italic">No members found in this house.</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence mode="popLayout">
              {filteredMembers.map((member) => (
                <MemberCard key={member.uid} member={member} userProfile={userProfile} handleRemoveMember={handleRemoveMember} />
              ))}
            </AnimatePresence>
          </div>
        )}

        {!loading && filteredMembers.length === 0 && (
          <div className="text-center py-24 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h4 className="text-xl font-serif font-medium text-slate-800 mb-2">No members found</h4>
            <p className="text-slate-500 font-serif italic">Try adjusting your search or filter criteria.</p>
          </div>
        )}
      </div>
      {/* Add Member Modal */}
      <AnimatePresence>
        {showAddModal && (
          <AddMemberModal 
            onClose={() => setShowAddModal(false)} 
            onSuccess={() => {
              setShowAddModal(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

interface AddMemberModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const AddMemberModal: React.FC<AddMemberModalProps> = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    role: 'Student' as UserProfile['role'],
    standard: '',
    houseTeam: '' as UserProfile['houseTeam'],
    gender: 'Sir' as UserProfile['gender']
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.displayName || !formData.email || !formData.role) return;

    setIsSubmitting(true);
    try {
      const tempId = `temp_${formData.email.toLowerCase().trim()}`;
      const newMember = {
        ...formData,
        email: formData.email.toLowerCase().trim(),
        uid: tempId,
        isPreRegistered: true,
        isDeleted: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        totalPoints: 0,
        cards: { white: 0, yellow: 0, blue: 0, green: 0, pink: 0 }
      };

      await setDoc(doc(db, 'users', tempId), newMember);
      onSuccess();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'users');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white rounded-[32px] w-full max-w-lg overflow-hidden shadow-2xl border border-slate-100"
      >
        <div className="p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-2xl font-serif font-medium text-slate-800">Add New Member</h3>
              <p className="text-slate-400 text-sm italic">Pre-register a student or staff member.</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
              <X size={20} className="text-slate-400" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                <input
                  required
                  type="text"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="e.g. John Doe"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                <input
                  required
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="e.g. john@example.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="Student">Student</option>
                  <option value="Leader">Leader</option>
                  <option value="Alumni">Alumni</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Gender</label>
                <select
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="Sir">Sir</option>
                  <option value="Madam">Madam</option>
                </select>
              </div>
            </div>

            {(formData.role === 'Student' || formData.role === 'Leader') && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Standard</label>
                  <select
                    required
                    value={formData.standard}
                    onChange={(e) => setFormData({ ...formData, standard: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="">Select Standard</option>
                    {[...Array(12)].map((_, i) => (
                      <option key={i + 1} value={`Standard ${i + 1}`}>Standard {i + 1}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">House Team</label>
                  <select
                    required
                    value={formData.houseTeam}
                    onChange={(e) => setFormData({ ...formData, houseTeam: e.target.value as any })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="">Select House</option>
                    <option value="GOOD PIONEER">GOOD PIONEER</option>
                    <option value="GOOD PATRON">GOOD PATRON</option>
                    <option value="GOOD SAVIOUR">GOOD SAVIOUR</option>
                    <option value="GOOD SHEPHERD">GOOD SHEPHERD</option>
                  </select>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-4 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <UserPlus size={16} />}
                Add Member
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
};

const MemberCard: React.FC<{
  member: UserProfile;
  userProfile: UserProfile;
  handleRemoveMember: (member: UserProfile) => void;
}> = ({ member, userProfile, handleRemoveMember }) => {
  const [isExporting, setIsExporting] = useState(false);

  const handleGenerateReport = async () => {
    setIsExporting(true);
    try {
      // Fetch quiz history for this member
      const q = query(
        collection(db, 'quizResults'),
        where('studentId', '==', member.uid),
        orderBy('timestamp', 'desc')
      );
      const snap = await getDocs(q);
      const quizHistory = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as QuizResult[];
      
      const currentPoints = member.studentData?.points ?? member.totalPoints ?? 0;
      const currentCards = member.studentData?.cards ?? member.cards ?? {};
      
      await exportIndividualReport(member, quizHistory);

      // Save to member's portfolio
      await saveToPortfolio(
        member.uid,
        `Progress Report - ${new Date().toLocaleDateString()}`,
        'Progress Report',
        currentPoints,
        Object.entries(currentCards).filter(([_, count]) => (count as number) > 0).map(([color]) => color)
      );
    } catch (error) {
      console.error("Error generating report:", error);
      alert("Failed to generate report. Check console.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="bg-white border border-slate-100 rounded-2xl p-6 hover:shadow-md transition-all group relative overflow-hidden"
    >
      <div className="flex items-start gap-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors overflow-hidden">
            {member.photoURL ? (
              <img src={member.photoURL} alt={member.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <UserCircle size={40} />
            )}
          </div>
          <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${member.isOnline ? 'bg-emerald-500' : 'bg-slate-300'}`}>
            {member.isOnline && <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-75" />}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-bold text-slate-800 truncate">{member.displayName}</h4>
            {member.houseTitle && member.leadershipStatus === 'verified' && (
              <div className="flex items-center" title={member.houseTitle}>
                {member.houseTitle === 'Captain' ? (
                  <Crown size={14} className="text-amber-500 fill-amber-500/20" />
                ) : (
                  <Shield size={14} className="text-indigo-500 fill-indigo-500/20" />
                )}
              </div>
            )}
            {member.isOnline && !member.isDeleted && <span className="text-[10px] font-bold text-emerald-600 uppercase">Online</span>}
            {member.isDeleted && <span className="text-[10px] font-bold text-red-600 uppercase">Deactivated</span>}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${
              member.role === 'Admin' ? 'bg-rose-50 text-rose-600' :
              member.role === 'Leader' ? 'bg-amber-50 text-amber-600' :
              'bg-indigo-50 text-indigo-600'
            }`}>
              {member.role}
            </span>
            {member.standard && (
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                {member.standard}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <Mail size={16} className="text-slate-300" />
          <span className="truncate">{member.email}</span>
        </div>
        {member.houseTeam && (
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <MapPin size={16} className="text-slate-300" />
            <span>{member.houseTeam} House</span>
          </div>
        )}
      </div>

      <div className="mt-6 flex gap-2">
        {(userProfile.role === 'Admin' || userProfile.role === 'Leader') && (member.role === 'Student' || member.role === 'Leader') && (
          <button 
            onClick={handleGenerateReport}
            disabled={isExporting}
            className="flex-1 py-2 rounded-xl border border-indigo-100 text-sm font-bold text-indigo-600 hover:bg-indigo-50 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isExporting ? (
              <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Download size={16} />
            )}
            Report
          </button>
        )}
        <button className="flex-1 py-2 rounded-xl border border-slate-100 text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-all flex items-center justify-center gap-2 group/btn">
          Profile
          <ChevronRight size={16} className="group-hover/btn:translate-x-1 transition-transform" />
        </button>
        {userProfile.role === 'Admin' && member.uid !== userProfile.uid && (
          <button 
            onClick={() => handleRemoveMember(member)}
            className={`p-2 rounded-xl border transition-all ${member.isDeleted ? 'border-emerald-100 text-emerald-500 hover:bg-emerald-50' : 'border-red-100 text-red-500 hover:bg-red-50'}`}
            title={member.isDeleted ? "Restore Member" : "Deactivate Member"}
          >
            {member.isDeleted ? <ShieldCheck size={18} /> : <Trash2 size={18} />}
          </button>
        )}
      </div>
    </motion.div>
  );
};

export default CommunityDirectory;
