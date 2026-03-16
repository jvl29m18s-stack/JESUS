import React, { useState } from 'react';
import { 
  collection, 
  getDocs, 
  writeBatch, 
  doc, 
  serverTimestamp,
  query,
  where,
  addDoc,
  setDoc,
  orderBy,
  limit
} from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, HouseStats, ArchiveBatch, HallOfFameEntry } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Archive, AlertTriangle, CheckCircle2, Loader2, History, Calendar } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../firestoreErrorHandler';

interface ArchiveManagerProps {
  userProfile: UserProfile;
}

export default function ArchiveManager({ userProfile }: ArchiveManagerProps) {
  const [isArchiving, setIsArchiving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string>('');
  const [yearLabel, setYearLabel] = useState(`Batch_${new Date().getFullYear()}`);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [resetType, setResetType] = useState<'Monthly' | 'Yearly'>('Yearly');

  const startArchive = async () => {
    if (!yearLabel.trim()) return;
    
    setIsArchiving(true);
    setError(null);
    setSuccess(false);
    setProgress(0);
    setStatus('Initializing archive process...');

    try {
      // 1. Fetch current House Stats
      setStatus('Fetching house statistics...');
      const houseSnap = await getDocs(collection(db, 'house_stats'));
      const houses = houseSnap.docs.map(d => ({ id: d.id, ...d.data() } as HouseStats));
      
      if (houses.length === 0) {
        throw new Error('No house statistics found to archive.');
      }

      // Calculate summary
      const totalPoints = houses.reduce((sum, h) => sum + h.totalPoints, 0);
      const winningHouse = [...houses].sort((a, b) => b.totalPoints - a.totalPoints)[0]?.id || 'N/A';
      const totalCards = houses.reduce((sum, h) => {
        const counts = h.cardCounts || {};
        return sum + Object.values(counts).reduce((s, c) => s + (c || 0), 0);
      }, 0);

      const batchId = yearLabel.replace(/\s+/g, '_');
      const archiveBatchRef = doc(db, 'archives', batchId);

      const batch = writeBatch(db);

      // 2. Create Hall of Fame Entry
      setStatus('Recording winner in Hall of Fame...');
      const hallOfFameRef = doc(collection(db, 'hall_of_fame'));
      const hallOfFameData: Omit<HallOfFameEntry, 'id'> = {
        period: resetType === 'Yearly' ? yearLabel : `${new Date().toLocaleString('default', { month: 'long' })} ${new Date().getFullYear()}`,
        winnerHouse: winningHouse,
        totalPoints: houses.find(h => h.id === winningHouse)?.totalPoints || 0,
        houseColor: '#FFD700', // Gold for winner
        type: resetType,
        timestamp: serverTimestamp()
      };
      batch.set(hallOfFameRef, hallOfFameData);

      // 3. Create Archive Metadata (Only for Yearly)
      if (resetType === 'Yearly') {
        setStatus('Creating archive metadata...');
        const archiveMetadata: ArchiveBatch = {
          id: batchId,
          yearLabel,
          archivedAt: serverTimestamp(),
          archivedBy: userProfile.uid,
          archivedByName: userProfile.displayName,
          summary: {
            totalPoints,
            winningHouse,
            totalCards
          }
        };
        batch.set(archiveBatchRef, archiveMetadata);

        // 4. Copy House Stats to Archive
        setStatus('Archiving house stats...');
        houses.forEach(house => {
          const archivedHouseRef = doc(db, 'archives', batchId, 'house_stats', house.id);
          batch.set(archivedHouseRef, house);
        });
      }

      // 5. Reset Live House Stats
      setStatus('Resetting live house stats...');
      houses.forEach(house => {
        const liveHouseRef = doc(db, 'house_stats', house.id);
        batch.set(liveHouseRef, {
          totalPoints: 0,
          cardCounts: {
            white: 0,
            yellow: 0,
            blue: 0,
            green: 0,
            pink: 0
          },
          lastUpdated: serverTimestamp()
        }, { merge: true });
      });

      await batch.commit();
      setProgress(20);

      // 6. Trigger Global Celebration
      setStatus('Triggering global celebration...');
      try {
        await setDoc(doc(db, 'announcements', 'global_celebration'), {
          type: 'CELEBRATION',
          winnerHouse: winningHouse,
          period: resetType === 'Yearly' ? yearLabel : `${new Date().toLocaleString('default', { month: 'long' })} ${new Date().getFullYear()}`,
          trigger: Date.now()
        });
      } catch (celebrationErr) {
        console.error('Failed to trigger global celebration:', celebrationErr);
        // Don't fail the whole archive if just the confetti trigger fails
      }

      // 7. Reset Students
      setStatus('Fetching students for reset...');
      const studentsSnap = await getDocs(query(collection(db, 'users'), where('role', 'in', ['Student', 'Leader'])));
      const students = studentsSnap.docs;
      
      setStatus(`Resetting ${students.length} students...`);
      
      // Process students in chunks of 400 (Firestore batch limit is 500)
      const chunkSize = 400;
      for (let i = 0; i < students.length; i += chunkSize) {
        const chunk = students.slice(i, i + chunkSize);
        const studentBatch = writeBatch(db);
        
        chunk.forEach(studentDoc => {
          const data = studentDoc.data() as UserProfile;
          
          const updateData: any = {
            totalPoints: 0,
            cards: {
              white: 0,
              yellow: 0,
              blue: 0,
              green: 0,
              pink: 0
            },
            updatedAt: serverTimestamp()
          };

          if (resetType === 'Yearly') {
            const legacyBadge = {
              year: yearLabel,
              totalPoints: data.totalPoints || 0,
              cards: data.cards || {}
            };
            updateData.legacyBadges = [...(data.legacyBadges || []), legacyBadge];
            updateData.batchYear = (new Date().getFullYear() + 1).toString();
          }

          studentBatch.update(studentDoc.ref, updateData);
        });

        await studentBatch.commit();
        const currentProgress = 20 + Math.round(((i + chunk.length) / students.length) * 80);
        setProgress(currentProgress);
      }

      setSuccess(true);
      setStatus(`${resetType} Reset completed successfully!`);
    } catch (err: any) {
      console.error('Archive Error:', err);
      setError(err.message || 'An unexpected error occurred during archiving.');
      handleFirestoreError(err, OperationType.WRITE, 'archives');
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600">
            <Archive size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Reset Protocol</h2>
            <p className="text-slate-500 text-sm">Manage institutional cycles and recognize winners.</p>
          </div>
        </div>

        {!success ? (
          <div className="space-y-6">
            <div className="flex p-1 bg-slate-100 rounded-2xl mb-6">
              <button
                onClick={() => setResetType('Monthly')}
                className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
                  resetType === 'Monthly' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'
                }`}
              >
                Monthly Reset
              </button>
              <button
                onClick={() => setResetType('Yearly')}
                className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
                  resetType === 'Yearly' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-500'
                }`}
              >
                Annual Reset
              </button>
            </div>

            <div className={`p-6 rounded-2xl border ${
              resetType === 'Yearly' ? 'bg-amber-50 border-amber-100 text-amber-800' : 'bg-blue-50 border-blue-100 text-blue-800'
            }`}>
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-1 flex-shrink-0" size={20} />
                <div className="text-sm">
                  <p className="font-bold mb-1">Warning: This action is irreversible.</p>
                  <p className="opacity-80">
                    {resetType === 'Yearly' 
                      ? "This will archive all current house points and student card counts into the Legacy Vault. All active students will have their points reset to zero for the new academic year."
                      : "This will record the current winner in the Hall of Fame and reset all house and student points to zero for the new month."
                    }
                  </p>
                </div>
              </div>
            </div>

            {resetType === 'Yearly' && (
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                  Batch Label
                </label>
                <input 
                  type="text"
                  value={yearLabel}
                  onChange={(e) => setYearLabel(e.target.value)}
                  placeholder="e.g. Batch 2025"
                  disabled={isArchiving}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all outline-none"
                />
              </div>
            )}

            {isArchiving ? (
              <div className="space-y-4">
                <div className="flex justify-between items-end mb-1">
                  <span className="text-sm font-bold text-slate-600">{status}</span>
                  <span className="text-xs font-black text-amber-600">{progress}%</span>
                </div>
                <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    className={`h-full rounded-full ${resetType === 'Yearly' ? 'bg-amber-500' : 'bg-blue-500'}`}
                  />
                </div>
                <div className="flex items-center justify-center gap-2 text-slate-400 text-sm animate-pulse">
                  <Loader2 size={16} className="animate-spin" />
                  Processing thousands of records...
                </div>
              </div>
            ) : (
              <div className="flex gap-4">
                {!showConfirm ? (
                  <button 
                    onClick={() => setShowConfirm(true)}
                    className={`flex-1 text-white py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 ${
                      resetType === 'Yearly' ? 'bg-slate-800 hover:bg-slate-900' : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {resetType === 'Yearly' ? <Archive size={20} /> : <Calendar size={20} />}
                    Initiate {resetType} Reset
                  </button>
                ) : (
                  <>
                    <button 
                      onClick={() => setShowConfirm(false)}
                      className="flex-1 bg-slate-100 text-slate-600 py-4 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={startArchive}
                      className="flex-1 bg-red-600 text-white py-4 rounded-2xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200"
                    >
                      Confirm {resetType} Reset
                    </button>
                  </>
                )}
              </div>
            )}

            {error && (
              <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-100">
                {error}
              </div>
            )}
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-8"
          >
            <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 size={40} />
            </div>
            <h3 className="text-2xl font-bold text-slate-800 mb-2">
              {resetType === 'Yearly' ? 'Legacy Preserved!' : 'Monthly Winner Crowned!'}
            </h3>
            <p className="text-slate-500 mb-8 max-w-sm mx-auto">
              {resetType === 'Yearly' 
                ? `The ${yearLabel} has been successfully archived. All students can now view their legacy badges in their profiles.`
                : `The monthly winner has been recorded in the Hall of Fame. All points have been reset for the new month.`
              }
            </p>
            <button 
              onClick={() => setSuccess(false)}
              className="px-8 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
            >
              Done
            </button>
          </motion.div>
        )}
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
            <History size={20} />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase">Legacy Vault</div>
            <div className="text-sm font-bold text-slate-700">View Archived Years</div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-100 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
            <Trophy size={20} />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase">Hall of Fame</div>
            <div className="text-sm font-bold text-slate-700">Top Performers 2025</div>
          </div>
        </div>
      </div>
    </div>
  );
}
