import React, { useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  AuthError 
} from 'firebase/auth';
import { auth } from '../firebase';
import { LogIn, GraduationCap, AlertCircle, Mail, Lock as LockIcon, UserPlus, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { RecentAccount } from '../types';

export default function Login() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const recentAccounts: RecentAccount[] = JSON.parse(localStorage.getItem('recent_accounts') || '[]');

  const handleGoogleLogin = async (loginHint?: string) => {
    setError(null);
    setLoading(true);
    const provider = new GoogleAuthProvider();
    const params: any = {
      prompt: 'select_account'
    };
    if (loginHint) {
      params.login_hint = loginHint;
    }
    provider.setCustomParameters(params);
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      const authError = err as AuthError;
      console.error("Google login failed:", authError);
      if (authError.code === 'auth/popup-closed-by-user' || authError.code === 'auth/user-cancelled') {
        setError("Sign-in window was closed before completion.");
      } else if (authError.code === 'auth/popup-blocked') {
        setError("Sign-in popup was blocked by your browser. Please allow popups for this site (look for an icon in your address bar) and try again.");
      } else {
        setError("Google sign-in failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAccountClick = (account: RecentAccount) => {
    handleGoogleLogin(account.email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      const authError = err as AuthError;
      console.error("Auth failed:", authError);
      
      switch (authError.code) {
        case 'auth/invalid-email':
          setError("Invalid email address format.");
          break;
        case 'auth/user-not-found':
          setError("No account found with this email.");
          break;
        case 'auth/wrong-password':
          setError("Incorrect password.");
          break;
        case 'auth/email-already-in-use':
          if (isSignUp) {
            setIsSignUp(false);
            setError("Account already exists. Attempting to sign you in...");
            try {
              await signInWithEmailAndPassword(auth, email, password);
              return; // Success, the onAuthStateChanged will handle the rest
            } catch (signInErr) {
              setError("An account already exists with this email. Please sign in with your correct password.");
            }
          } else {
            setError("An account already exists with this email.");
          }
          break;
        case 'auth/weak-password':
          setError("Password should be at least 6 characters.");
          break;
        case 'auth/operation-not-allowed':
          setError("Email/Password sign-in is not enabled. Please enable it in the Firebase Console.");
          break;
        case 'auth/invalid-credential':
          setError("Invalid email or password. Please check your credentials.");
          break;
        default:
          setError("Authentication failed. Please check your credentials.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-[32px] p-8 shadow-sm border border-black/5"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-indigo-200">
            <GraduationCap className="text-white w-10 h-10" />
          </div>
          <h1 className="text-3xl font-serif font-medium text-[#1a1a1a] mb-2">Good Samaritan</h1>
          <p className="text-slate-500 text-center font-serif italic">
            {isSignUp ? "Create your account to get started." : "Please enter your credentials to access your dashboard."}
          </p>
        </div>

        {/* Family Switcher - Primary Focus */}
        {!isSignUp && recentAccounts.length > 0 && (
          <div className="mb-10 p-6 bg-slate-50/50 rounded-[32px] border border-slate-100">
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-2 mb-6">
                <Users size={16} className="text-indigo-500" />
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Family Switcher</h3>
              </div>
              
              <div className="flex items-center justify-center gap-6 w-full">
                {recentAccounts.map((account, index) => (
                  <React.Fragment key={account.uid}>
                    <button
                      onClick={() => handleAccountClick(account)}
                      className="flex flex-col items-center group relative"
                    >
                      <div className="w-24 h-24 rounded-full bg-white shadow-lg border-4 border-white mb-3 overflow-hidden flex items-center justify-center group-hover:scale-110 group-hover:border-indigo-500 transition-all duration-300 ring-1 ring-slate-100">
                        {account.photoURL ? (
                          <img src={account.photoURL} alt={account.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <span className="text-3xl font-bold text-indigo-600">{account.displayName.charAt(0)}</span>
                        )}
                        
                        {/* House Indicator Overlay */}
                        {account.houseTeam && (
                          <div className={`absolute bottom-1 right-1 w-5 h-5 rounded-full border-2 border-white shadow-sm ${
                            account.houseTeam === 'GOOD PIONEER' ? 'bg-blue-500' :
                            account.houseTeam === 'GOOD PATRON' ? 'bg-red-500' :
                            account.houseTeam === 'GOOD SAVIOUR' ? 'bg-yellow-500' :
                            'bg-green-500'
                          }`} />
                        )}
                      </div>
                      <span className="text-sm font-black text-slate-800 truncate max-w-[110px]">{account.displayName.split(' ')[0]}</span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        {account.standard ? `${account.standard} Std` : account.role}
                      </span>
                    </button>

                    {/* VS / OR Divider */}
                    {index === 0 && recentAccounts.length === 2 && (
                      <div className="flex flex-col items-center">
                        <div className="h-10 w-px bg-slate-200 mb-2" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white px-2 py-1 rounded-full border border-slate-100 shadow-sm">VS</span>
                        <div className="h-10 w-px bg-slate-200 mt-2" />
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </div>
              
              <div className="mt-8 flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                <div className="h-px w-8 bg-slate-200" />
                <span>One-Tap Switch</span>
                <div className="h-px w-8 bg-slate-200" />
              </div>
            </div>
          </div>
        )}

        {/* Use Another Account Label */}
        {recentAccounts.length > 0 && !isSignUp && (
          <div className="mb-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-100" />
            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Use Another Account</span>
            <div className="h-px flex-1 bg-slate-100" />
          </div>
        )}

        <AnimatePresence mode="wait">
          {error && (
            <motion.div 
              key="error-message"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-600 text-sm overflow-hidden"
            >
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p>{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-widest font-bold text-slate-400 ml-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                required
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-widest font-bold text-slate-400 ml-1">
              Password
            </label>
            <div className="relative">
              <LockIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                required
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-bold uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-lg shadow-indigo-200"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                {isSignUp ? <UserPlus size={20} /> : <LogIn size={20} />}
                {isSignUp ? "Create Account" : "Sign In"}
              </>
            )}
          </button>
        </form>

        <div className="relative py-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-100"></div>
          </div>
          <div className="relative flex justify-center text-[10px] font-black uppercase tracking-widest">
            <span className="bg-white px-4 text-slate-300">Or continue with</span>
          </div>
        </div>

        <button 
          type="button"
          onClick={() => handleGoogleLogin()}
          disabled={loading}
          className="w-full py-4 bg-white border-2 border-slate-100 text-slate-700 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-slate-50 hover:border-indigo-100 transition-all disabled:opacity-50 shadow-sm group"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
          ) : (
            <>
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5 group-hover:scale-110 transition-transform" referrerPolicy="no-referrer" />
              <span>{isSignUp ? "Sign up with Google" : "Sign in with Google"}</span>
            </>
          )}
        </button>

        <div className="mt-8 text-center space-y-4">
          <button 
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-sm text-indigo-600 font-bold hover:underline underline-offset-4"
          >
            {isSignUp ? "Already have an account? Sign In" : "Don't have an account? Create one"}
          </button>
          {!isSignUp && (
            <div>
              <a href="#" className="text-xs text-slate-400 hover:text-indigo-600 transition-colors font-medium">
                Forgot your password?
              </a>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
