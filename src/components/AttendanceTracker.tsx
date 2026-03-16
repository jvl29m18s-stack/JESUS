import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, setDoc, doc, serverTimestamp, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, AttendanceRecord } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Check, X, Clock, Calendar, Search, Users, ChevronDown, AlertCircle, CheckCircle2 } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../firestoreErrorHandler';

interface AttendanceTrackerProps {
  userProfile: UserProfile;
  selectedStandard: string;
  setSelectedStandard: (standard: string) => void;
}

export default function AttendanceTracker({ userProfile, selectedStandard, setSelectedStandard }: AttendanceTrackerProps) {
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [attendance, setAttendance] = useState<Record<string, AttendanceRecord>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [localAttendance, setLocalAttendance] = useState<Record<string, 'Present' | 'Absent' | 'Late' | 'Excused'>>({});

  const today = new Date().toISOString().split('T')[0];
  const isAdmin = userProfile.role === 'Admin';
  const isLeader = userProfile.role === 'Leader';
  const canMark = isAdmin || isLeader;

  useEffect(() => {
    if (isLeader && userProfile.standard) {
      setSelectedStandard(userProfile.standard);
    }
  }, [isLeader, userProfile.standard]);

  useEffect(() => {
    // Fetch students and leaders based on role and standard
    let q;
    if (userProfile.role === 'Student') {
      q = query(collection(db, 'users'), where('uid', '==', userProfile.uid));
    } else if (userProfile.role === 'Admin') {
      // Admins see everyone or filtered by standard
      if (selectedStandard && selectedStandard !== 'All Standards') {
        q = query(collection(db, 'users'), where('standard', '==', selectedStandard));
      } else {
        q = collection(db, 'users');
      }
    } else {
      // Leaders see both Students and Leaders in their standard
      q = query(collection(db, 'users'), where('role', 'in', ['Student', 'Leader']), where('standard', '==', userProfile.standard));
    }

    const unsubscribeStudents = onSnapshot(q, (snapshot) => {
      const studentList = snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      })) as UserProfile[];
      setStudents(studentList);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    // Fetch attendance records
    let aq;
    if (userProfile.role === 'Student') {
      aq = query(collection(db, 'attendance'), where('studentId', '==', userProfile.uid));
    } else {
      aq = query(collection(db, 'attendance'), where('date', '==', today));
    }

    const unsubscribeAttendance = onSnapshot(aq, (snapshot) => {
      const records: Record<string, AttendanceRecord> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data() as AttendanceRecord;
        records[data.studentId] = { ...data, id: doc.id };
      });
      setAttendance(records);
      
      // Initialize local attendance for marking
      if (canMark) {
        const initialLocal: Record<string, 'Present' | 'Absent' | 'Late' | 'Excused'> = {};
        snapshot.docs.forEach(doc => {
          const data = doc.data() as AttendanceRecord;
          if (['Present', 'Absent', 'Late', 'Excused'].includes(data.status)) {
            initialLocal[data.studentId] = data.status as 'Present' | 'Absent' | 'Late' | 'Excused';
          }
        });
        setLocalAttendance(prev => ({ ...initialLocal, ...prev }));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'attendance');
    });

    return () => {
      unsubscribeStudents();
      unsubscribeAttendance();
    };
  }, [today, userProfile.uid, userProfile.role, canMark, selectedStandard]);

  const handleBulkSubmit = async () => {
    if (!canMark || submitting) return;
    setSubmitting(true);

    try {
      const batch = writeBatch(db);
      const filtered = students.filter(s => selectedStandard === 'All Standards' || s.standard === selectedStandard);
      
      for (const student of filtered) {
        const status = localAttendance[student.uid];
        if (!status) continue;

        const recordId = `${student.uid}_${today}`;
        const recordRef = doc(db, 'attendance', recordId);
        
        batch.set(recordRef, {
          studentId: student.uid,
          studentName: student.displayName,
          standard: student.standard || 'N/A',
          house: student.houseTeam || 'N/A',
          status,
          date: today,
          markedBy: userProfile.uid,
          markedByName: userProfile.displayName,
          updatedAt: serverTimestamp()
        });
      }

      await batch.commit();
      setSuccessMessage(`Attendance submitted for ${selectedStandard}`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'attendance');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredStudents = students.filter(s => {
    const matchesSearch = s.displayName.toLowerCase().includes(searchQuery.toLowerCase());
    const studentStd = s.standard?.startsWith('Standard ') ? s.standard : (s.standard ? `Standard ${s.standard}` : null);
    const matchesStandard = selectedStandard === 'All Standards' || studentStd === selectedStandard;
    return matchesSearch && matchesStandard;
  });

  const standards = ['All Standards', ...Array.from({ length: 12 }, (_, i) => `Standard ${i + 1}`)];

  if (userProfile.role === 'Student') {
    const myTodayRecord = attendance[userProfile.uid];
    return (
      <div className="space-y-6 max-w-4xl mx-auto px-4 md:px-0 pb-20 md:pb-0">
        <div className="bg-white rounded-[24px] md:rounded-[32px] p-6 md:p-8 border border-slate-100 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-800 mb-2">My Attendance</h1>
          <p className="text-slate-500 text-sm mb-8">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 bg-slate-50 rounded-2xl border border-slate-100 gap-4">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                myTodayRecord?.status === 'Present' ? 'bg-emerald-100 text-emerald-600' :
                myTodayRecord?.status === 'Absent' ? 'bg-red-100 text-red-600' :
                myTodayRecord?.status === 'Late' ? 'bg-amber-100 text-amber-600' :
                myTodayRecord?.status === 'Excused' ? 'bg-blue-100 text-blue-600' :
                'bg-slate-100 text-slate-400'
              }`}>
                {myTodayRecord?.status === 'Present' ? <CheckCircle2 size={24} /> :
                 myTodayRecord?.status === 'Absent' ? <X size={24} /> :
                 myTodayRecord?.status === 'Late' ? <Clock size={24} /> :
                 myTodayRecord?.status === 'Excused' ? <AlertCircle size={24} /> :
                 <Clock size={24} />}
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Today's Status</div>
                <div className="text-xl font-bold text-slate-800">
                  {myTodayRecord?.status || 'Not Marked Yet'}
                </div>
              </div>
            </div>
            {myTodayRecord && (
              <div className="sm:text-right">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Marked At</div>
                <div className="text-sm font-medium text-slate-600">
                  {myTodayRecord.updatedAt?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-[24px] md:rounded-[32px] p-6 md:p-8 border border-slate-100 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800 mb-6">Recent History</h2>
          <div className="space-y-3">
            {(Object.values(attendance) as AttendanceRecord[])
              .sort((a, b) => b.date.localeCompare(a.date))
              .slice(0, 10)
              .map(record => (
                <div key={record.id} className="flex items-center justify-between p-4 hover:bg-slate-50 rounded-xl transition-colors">
                  <div className="flex items-center gap-3">
                    <Calendar size={18} className="text-slate-400" />
                    <span className="font-medium text-slate-700">{record.date}</span>
                  </div>
                  <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                    record.status === 'Present' ? 'bg-emerald-100 text-emerald-600' :
                    record.status === 'Absent' ? 'bg-red-100 text-red-600' :
                    record.status === 'Late' ? 'bg-amber-100 text-amber-600' :
                    record.status === 'Excused' ? 'bg-blue-100 text-blue-600' :
                    'bg-slate-100 text-slate-400'
                  }`}>
                    {record.status}
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8 max-w-4xl mx-auto pb-20 md:pb-0">
      <div className="px-4 md:px-0">
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">Attendance</h1>
        <p className="text-slate-500 text-base md:text-lg">Manage and view student attendance records.</p>
      </div>

      <div className="bg-white rounded-[24px] md:rounded-[32px] p-4 md:p-8 border border-slate-100 shadow-sm mx-2 md:mx-0">
        <div className="mb-6 md:mb-8">
          <h2 className="text-xl md:text-2xl font-bold text-slate-800 mb-2">Mark Daily Attendance</h2>
          <p className="text-slate-500 text-sm md:text-base">Select a standard to view students and mark their attendance for today.</p>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Standard</label>
            <div className="relative">
              <select 
                value={selectedStandard || 'All Standards'}
                onChange={(e) => setSelectedStandard(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-emerald-500 outline-none bg-white appearance-none transition-all text-sm"
              >
                {standards.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={20} />
            </div>
          </div>

          <div className="border border-slate-100 rounded-2xl overflow-hidden overflow-x-auto no-scrollbar mobile-touch-scroll">
            <table className="w-full text-left border-collapse min-w-[500px]">
              <thead>
                <tr className="bg-slate-50/50 text-slate-400 text-[10px] font-bold uppercase tracking-widest border-b border-slate-100">
                  <th className="px-6 py-4">Roll No.</th>
                  <th className="px-6 py-4">User Name</th>
                  <th className="px-6 py-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center text-slate-400 italic">No users found for this standard</td>
                  </tr>
                ) : (
                  filteredStudents.map((student) => (
                    <tr key={student.uid} className="hover:bg-slate-50/30 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-slate-500">{student.rollNumber || 'N/A'}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            <div className="font-bold text-slate-800">{student.displayName}</div>
                            {student.isOnline && (
                              <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-2 h-2 bg-emerald-500 rounded-full shadow-sm shadow-emerald-500/50" title="Online" />
                            )}
                          </div>
                          {student.role === 'Leader' && (
                            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-600 text-[10px] font-bold rounded-full uppercase">Leader</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-4">
                          <label className="flex flex-col items-center gap-1 cursor-pointer group">
                            <input 
                              type="radio" 
                              name={`attendance-${student.uid}`}
                              checked={localAttendance[student.uid] === 'Present'}
                              onChange={() => setLocalAttendance(prev => ({ ...prev, [student.uid]: 'Present' }))}
                              className="hidden"
                            />
                            <div className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all ${
                              localAttendance[student.uid] === 'Present' ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-200 text-slate-300 group-hover:border-emerald-200'
                            }`}>
                              <Check size={16} />
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-wider">P</span>
                          </label>

                          <label className="flex flex-col items-center gap-1 cursor-pointer group">
                            <input 
                              type="radio" 
                              name={`attendance-${student.uid}`}
                              checked={localAttendance[student.uid] === 'Absent'}
                              onChange={() => setLocalAttendance(prev => ({ ...prev, [student.uid]: 'Absent' }))}
                              className="hidden"
                            />
                            <div className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all ${
                              localAttendance[student.uid] === 'Absent' ? 'border-red-500 bg-red-500 text-white' : 'border-slate-200 text-slate-300 group-hover:border-red-200'
                            }`}>
                              <X size={16} />
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-wider">A</span>
                          </label>

                          <label className="flex flex-col items-center gap-1 cursor-pointer group">
                            <input 
                              type="radio" 
                              name={`attendance-${student.uid}`}
                              checked={localAttendance[student.uid] === 'Late'}
                              onChange={() => setLocalAttendance(prev => ({ ...prev, [student.uid]: 'Late' }))}
                              className="hidden"
                            />
                            <div className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all ${
                              localAttendance[student.uid] === 'Late' ? 'border-amber-500 bg-amber-500 text-white' : 'border-slate-200 text-slate-300 group-hover:border-amber-200'
                            }`}>
                              <Clock size={16} />
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-wider">L</span>
                          </label>

                          <label className="flex flex-col items-center gap-1 cursor-pointer group">
                            <input 
                              type="radio" 
                              name={`attendance-${student.uid}`}
                              checked={localAttendance[student.uid] === 'Excused'}
                              onChange={() => setLocalAttendance(prev => ({ ...prev, [student.uid]: 'Excused' }))}
                              className="hidden"
                            />
                            <div className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all ${
                              localAttendance[student.uid] === 'Excused' ? 'border-blue-500 bg-blue-500 text-white' : 'border-slate-200 text-slate-300 group-hover:border-blue-200'
                            }`}>
                              <AlertCircle size={16} />
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-wider">E</span>
                          </label>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="pt-4">
            <button 
              onClick={handleBulkSubmit}
              disabled={submitting || filteredStudents.length === 0}
              className="w-full flex items-center justify-center gap-2 py-4 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 disabled:opacity-50 disabled:shadow-none"
            >
              {submitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Check size={20} />
                  <span>Submit Attendance for {selectedStandard}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {successMessage && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-6 py-3 rounded-2xl shadow-xl flex items-center gap-3 z-50"
          >
            <CheckCircle2 size={20} />
            <span className="font-bold">{successMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
