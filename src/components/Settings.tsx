import React, { useState, useRef } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, auth } from '../firebase';
import { UserProfile } from '../types';
import { motion } from 'motion/react';
import { 
  User, 
  Camera, 
  Save, 
  Shield, 
  Lock, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  Info,
  Crown,
  ShieldAlert
} from 'lucide-react';

interface SettingsProps {
  userProfile: UserProfile;
}

export default function Settings({ userProfile }: SettingsProps) {
  const [displayName, setDisplayName] = useState(userProfile.displayName);
  const [bio, setBio] = useState(userProfile.bio || '');
  const [photoURL, setPhotoURL] = useState(userProfile.photoURL || '');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = userProfile.role === 'Admin';

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !auth.currentUser) return;

    setUploading(true);
    setError(null);

    try {
      const storageRef = ref(storage, `profiles/${auth.currentUser.uid}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      setPhotoURL(downloadURL);
      
      // Update Firestore immediately for photo
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        photoURL: downloadURL,
        updatedAt: serverTimestamp()
      });
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error("Error uploading photo:", err);
      setError("Failed to upload photo.");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        displayName,
        bio,
        updatedAt: serverTimestamp()
      });
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error("Error updating profile:", err);
      setError("Failed to update profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-serif font-medium text-[#1a1a1a] mb-2">Account Settings</h2>
        <p className="text-[#5A5A40]/60 font-serif italic">Manage your personal brand and account preferences.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile Card */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-[32px] p-8 shadow-sm border border-black/5 flex flex-col items-center text-center">
            <div className="relative mb-6">
              <div className="w-32 h-32 rounded-full bg-slate-100 border-4 border-white shadow-xl overflow-hidden group">
                {photoURL ? (
                  <img src={photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300">
                    <User size={64} />
                  </div>
                )}
                {uploading && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <Loader2 className="text-white animate-spin" size={32} />
                  </div>
                )}
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100"
                >
                  <Camera className="text-white" size={24} />
                </button>
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handlePhotoUpload} 
                className="hidden" 
                accept="image/*" 
              />
            </div>

            <h3 className="text-xl font-bold text-[#1a1a1a] mb-1">{userProfile.displayName}</h3>
            <div className="flex items-center gap-2 mb-4">
              <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-bold uppercase tracking-wider border border-indigo-100">
                {userProfile.role}
              </span>
              {userProfile.houseTeam && (
                <span className="px-3 py-1 bg-slate-50 text-slate-600 rounded-full text-[10px] font-bold uppercase tracking-wider border border-slate-100">
                  {userProfile.houseTeam}
                </span>
              )}
            </div>

            {userProfile.houseTitle && userProfile.houseTitle !== 'None' && (
              <div className={`flex items-center gap-2 px-4 py-2 rounded-xl mb-6 border ${
                userProfile.leadershipStatus === 'verified' 
                  ? 'bg-amber-50 border-amber-200 text-amber-700' 
                  : 'bg-slate-50 border-slate-200 text-slate-500'
              }`}>
                {userProfile.houseTitle === 'Captain' ? (
                  <Crown size={16} className={userProfile.leadershipStatus === 'verified' ? 'text-amber-500' : 'text-slate-400'} />
                ) : (
                  <Shield size={16} className={userProfile.leadershipStatus === 'verified' ? 'text-slate-400' : 'text-slate-400'} />
                )}
                <span className="text-xs font-bold uppercase tracking-wide">
                  {userProfile.houseTitle} {userProfile.leadershipStatus === 'pending_verification' && '(Pending)'}
                </span>
              </div>
            )}

            <div className="w-full pt-6 border-t border-slate-100 space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Points</span>
                <span className="font-bold text-indigo-600">{userProfile.totalPoints || 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Standard</span>
                <span className="font-bold text-slate-700">{userProfile.standard}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Edit Form */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-[32px] p-8 shadow-sm border border-black/5">
            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-[#1a1a1a]">Full Name</label>
                  <input 
                    type="text" 
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-[#1a1a1a]">Email Address</label>
                  <input 
                    type="email" 
                    value={userProfile.email}
                    disabled
                    className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-[#1a1a1a]">Bio</label>
                <textarea 
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={4}
                  placeholder="Tell the community about yourself..."
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all resize-none"
                />
              </div>

              <div className="pt-6 border-t border-slate-100">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h4 className="font-bold text-[#1a1a1a]">Locked Information</h4>
                    <p className="text-xs text-slate-400">These fields can only be modified by an Administrator.</p>
                  </div>
                  <Shield size={20} className="text-slate-300" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Role</div>
                      <div className="text-sm font-bold text-slate-600">{userProfile.role}</div>
                    </div>
                    <Lock size={14} className="text-slate-300" />
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">House</div>
                      <div className="text-sm font-bold text-slate-600">{userProfile.houseTeam || 'Not Assigned'}</div>
                    </div>
                    <Lock size={14} className="text-slate-300" />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 pt-4">
                <button 
                  type="submit"
                  disabled={loading}
                  className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-lg shadow-indigo-100"
                >
                  {loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                  Save Changes
                </button>

                {success && (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-2 text-emerald-600 font-bold text-sm"
                  >
                    <CheckCircle2 size={18} />
                    Profile Updated!
                  </motion.div>
                )}

                {error && (
                  <div className="flex items-center gap-2 text-rose-600 font-bold text-sm">
                    <AlertCircle size={18} />
                    {error}
                  </div>
                )}
              </div>
            </form>
          </div>

          <div className="mt-8 p-6 bg-indigo-50 rounded-[32px] border border-indigo-100 flex items-start gap-4">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-indigo-600 shrink-0 shadow-sm">
              <Info size={20} />
            </div>
            <div>
              <h4 className="font-bold text-indigo-900 text-sm mb-1">Real-Time Sync Active</h4>
              <p className="text-xs text-indigo-700 leading-relaxed">
                Your profile changes are synchronized across the entire platform in real-time. 
                Leaderboards, class lists, and point feeds will update instantly for all users.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
