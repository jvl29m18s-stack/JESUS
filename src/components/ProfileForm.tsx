import React, { useState, useRef } from 'react';
import { doc, setDoc, serverTimestamp, updateDoc, increment } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { signOut, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth, db, storage } from '../firebase';
import { UserProfile } from '../types';
import { motion } from 'motion/react';
import { User, Save, ChevronDown, Shield, Users, GraduationCap, UserCheck, Camera, AlertCircle, LogOut, ArrowLeft, Loader2, Lock as LockIcon, Crown } from 'lucide-react';

interface ProfileFormProps {
  onComplete: (profile: UserProfile) => void;
}

const ROLES = [
  { id: 'Admin', icon: <Shield size={18} /> },
  { id: 'Leader', icon: <UserCheck size={18} /> },
  { id: 'Student', icon: <GraduationCap size={18} /> },
  { id: 'Alumni', icon: <Users size={18} /> },
] as const;

const HOUSE_TEAMS = [
  { name: 'GOOD PIONEER', color: '#3b82f6' },
  { name: 'GOOD PATRON', color: '#ef4444' },
  { name: 'GOOD SAVIOUR', color: '#f59e0b' },
  { name: 'GOOD SHEPHERD', color: '#10b981' },
] as const;

const LEADER_POSITIONS = [
  'SECRETARY/ P.M',
  'SECRETARY / C.M',
  'EDUCATIONAL MINISTER',
  'FINANCE MINISTER',
  'DEFENCE MINISTER',
  'SPEAKER',
] as const;

export default function ProfileForm({ onComplete }: ProfileFormProps) {
  const [displayName, setDisplayName] = useState(auth.currentUser?.displayName || '');
  const [role, setRole] = useState<UserProfile['role']>('Student');
  const [gender, setGender] = useState<'Sir' | 'Madam' | undefined>();
  const [rollNumber, setRollNumber] = useState('');
  const [standard, setStandard] = useState('');
  const [houseTeam, setHouseTeam] = useState<UserProfile['houseTeam'] | ''>('');
  const [houseTitle, setHouseTitle] = useState<UserProfile['houseTitle']>('None');
  const [leaderPosition, setLeaderPosition] = useState<UserProfile['leaderPosition'] | ''>('');
  const [bio, setBio] = useState('');
  const [photoURL, setPhotoURL] = useState(auth.currentUser?.photoURL || '');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    } catch (err: any) {
      console.error("Error uploading photo:", err);
      setError("Failed to upload photo. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleSwitchAccount = async () => {
    if (window.confirm("Do you want to use a different Google Account?")) {
      try {
        await signOut(auth);
        // The App component will handle redirecting to Login
      } catch (err) {
        console.error("Error signing out:", err);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    setLoading(true);
    setError(null);
    
    // Construct profile object without undefined values
    const profile: any = {
      uid: auth.currentUser.uid,
      displayName,
      email: auth.currentUser.email || '',
      role,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (gender) profile.gender = gender;
    if (rollNumber) profile.rollNumber = rollNumber;
    if (standard) profile.standard = `Standard ${standard}`;
    if (houseTeam) {
      profile.houseTeam = houseTeam;
      if (houseTitle && houseTitle !== 'None') {
        profile.houseTitle = houseTitle;
        profile.leadershipStatus = 'pending_verification';
      } else {
        profile.houseTitle = 'None';
      }
    }
    if (leaderPosition) profile.leaderPosition = leaderPosition;
    if (bio) profile.bio = bio;
    if (photoURL) profile.photoURL = photoURL;

    try {
      await setDoc(doc(db, 'users', auth.currentUser.uid), profile);
      
      onComplete(profile as UserProfile);
    } catch (err: any) {
      console.error("Error saving profile:", err);
      setError(err.message || "Failed to save profile. Please check your permissions and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 overflow-y-auto mobile-touch-scroll">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-[32px] p-6 md:p-8 shadow-sm border border-black/5 my-8"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-[#10b981] rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-emerald-100 relative group">
            <GraduationCap className="text-white w-10 h-10" />
            <button 
              onClick={handleSwitchAccount}
              className="absolute -top-2 -left-2 w-8 h-8 bg-white rounded-full shadow-md flex items-center justify-center text-slate-400 hover:text-rose-500 transition-colors border border-slate-100"
              title="Switch Account"
            >
              <ArrowLeft size={16} />
            </button>
          </div>
          <h1 className="text-3xl font-bold text-[#1a1a1a] mb-1">Good Samaritan</h1>
          <h2 className="text-2xl font-bold text-[#1a1a1a] mt-4">Complete Your Profile</h2>
          <p className="text-slate-500 text-center mt-2">
            Please provide a few more details to get started.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-600 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {/* Profile Photo Upload */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center mb-4 border border-slate-200 relative overflow-hidden group">
            {photoURL ? (
              <img src={photoURL} alt="Profile" className="w-full h-full rounded-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <User size={48} className="text-slate-400" />
            )}
            {uploading && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <Loader2 className="text-white animate-spin" size={24} />
              </div>
            )}
          </div>
          <input 
            type="file"
            ref={fileInputRef}
            onChange={handlePhotoUpload}
            accept="image/*"
            className="hidden"
          />
          <button 
            type="button" 
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
          >
            <Camera size={16} />
            {photoURL ? "Change Photo" : "Upload Profile Photo"}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Role Selection (Keep it for flexibility, but styled subtly) */}
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-[#1a1a1a]">Role</label>
            <div className="relative">
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserProfile['role'])}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all appearance-none bg-white text-slate-700"
              >
                {ROLES.map((r) => (
                  <option key={r.id} value={r.id}>{r.id}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-bold text-[#1a1a1a]">Full Name</label>
            <input 
              required
              type="text" 
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={role === 'Leader' ? "Enter leader name" : "Your full name"}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all text-slate-700"
            />
          </div>

          {(role === 'Student' || role === 'Leader') && (
            <>
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-[#1a1a1a]">Gender</label>
                <div className="flex gap-6 mt-1">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input 
                      type="radio" 
                      name="gender" 
                      value="Sir" 
                      checked={gender === 'Sir'}
                      onChange={() => setGender('Sir')}
                      className="w-5 h-5 accent-emerald-600"
                    />
                    <span className="text-slate-700 font-medium">Sir</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input 
                      type="radio" 
                      name="gender" 
                      value="Madam" 
                      checked={gender === 'Madam'}
                      onChange={() => setGender('Madam')}
                      className="w-5 h-5 accent-emerald-600"
                    />
                    <span className="text-slate-700 font-medium">Madam</span>
                  </label>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-bold text-[#1a1a1a]">Roll/Reg Number</label>
                <input 
                  required
                  type="text" 
                  value={rollNumber}
                  onChange={(e) => setRollNumber(e.target.value)}
                  placeholder={role === 'Leader' ? "leader Roll/ Reg No" : "Your institution ID"}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all text-slate-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-[#1a1a1a]">Standard</label>
                  <div className="relative">
                    <select
                      required
                      value={standard}
                      onChange={(e) => setStandard(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all appearance-none bg-white text-slate-700"
                    >
                      <option value="">Select</option>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(s => (
                        <option key={s} value={s}>Standard {s}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-[#1a1a1a]">House Team</label>
                  <div className="relative">
                    <select
                      required
                      value={houseTeam}
                      onChange={(e) => setHouseTeam(e.target.value as any)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all appearance-none bg-white text-slate-700"
                    >
                      <option value="">Select House Team</option>
                      {HOUSE_TEAMS.map(team => (
                        <option key={team.name} value={team.name}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                  </div>
                </div>
              </div>

              {houseTeam && role === 'Student' && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-100"
                >
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Crown size={14} className="text-amber-500" />
                    House Leadership Title
                  </label>
                  <div className="flex p-1 bg-white rounded-xl border border-slate-200">
                    {['None', 'Captain', 'Vice-Captain'].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setHouseTitle(t as any)}
                        className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${
                          houseTitle === t 
                            ? 'bg-slate-900 text-white shadow-lg' 
                            : 'text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  {houseTitle !== 'None' && (
                    <div className="flex items-center gap-2 px-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                      <p className="text-[10px] text-amber-600 font-bold uppercase tracking-tight">
                        Verification Required: Admin will review your request.
                      </p>
                    </div>
                  )}
                </motion.div>
              )}

              {role === 'Leader' && (
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-[#1a1a1a]">Leader Role</label>
                  <div className="relative">
                    <select
                      required
                      value={leaderPosition}
                      onChange={(e) => setLeaderPosition(e.target.value as any)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all appearance-none bg-white text-slate-700"
                    >
                      <option value="">Select your leader role</option>
                      {LEADER_POSITIONS.map(pos => (
                        <option key={pos} value={pos}>
                          {pos}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                  </div>
                </div>
              )}
            </>
          )}

          {(role !== 'Student' && role !== 'Leader') && (
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-[#1a1a1a]">Bio</label>
              <textarea 
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell us about yourself..."
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all resize-none text-slate-700"
              />
            </div>
          )}

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-[#10b981] text-white rounded-xl font-bold text-lg flex items-center justify-center gap-3 hover:bg-[#059669] transition-all disabled:opacity-50 shadow-lg shadow-emerald-100 mt-4"
          >
            {loading ? (
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              "Save and Continue"
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
