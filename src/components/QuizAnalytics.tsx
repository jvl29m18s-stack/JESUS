import React, { useState, useEffect } from 'react';
import { PieChart as PieChartIcon, BarChart3, TrendingUp, Users, Award, Calendar, ChevronRight, ArrowUpRight, ArrowDownRight, Filter } from 'lucide-react';
import { collection, query, onSnapshot, getDocs, where } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, QuizResult } from '../types';
import { handleFirestoreError, OperationType } from '../firestoreErrorHandler';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

interface QuizAnalyticsProps {
  userProfile: UserProfile;
  selectedStandard: string | null;
  setSelectedStandard: (standard: string | null) => void;
}

const QuizAnalytics: React.FC<QuizAnalyticsProps> = ({ userProfile, selectedStandard, setSelectedStandard }) => {
  const [results, setResults] = useState<QuizResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const isAdmin = userProfile.role === 'Admin' || userProfile.role === 'Leader';
    const q = isAdmin 
      ? query(collection(db, 'quizResults'))
      : query(collection(db, 'quizResults'), where('studentId', '==', userProfile.uid));
      
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setResults(snapshot.docs.map(doc => doc.data() as QuizResult));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'quizResults');
      setLoading(false);
    });
    return () => unsubscribe();
  }, [userProfile]);

  const filteredResults = results.filter(r => {
    if (!selectedStandard || selectedStandard === 'All Standards') return true;
    return r.standard === selectedStandard;
  });

  const getPercentage = (r: QuizResult) => r.totalScore > 0 ? (r.score / r.totalScore) * 100 : 0;

  const performanceData = [
    { name: 'A (90-100)', value: filteredResults.filter(r => getPercentage(r) >= 90).length },
    { name: 'B (80-89)', value: filteredResults.filter(r => getPercentage(r) >= 80 && getPercentage(r) < 90).length },
    { name: 'C (70-79)', value: filteredResults.filter(r => getPercentage(r) >= 70 && getPercentage(r) < 80).length },
    { name: 'D (60-69)', value: filteredResults.filter(r => getPercentage(r) >= 60 && getPercentage(r) < 70).length },
    { name: 'F (<60)', value: filteredResults.filter(r => getPercentage(r) < 60).length },
  ].filter(d => d.value > 0);

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#6366f1'];

  const subjectData = filteredResults.reduce((acc: any[], curr) => {
    const existing = acc.find(a => a.subject === curr.subject);
    const percentage = getPercentage(curr);
    if (existing) {
      existing.totalPercentage += percentage;
      existing.count += 1;
      existing.avg = Math.round(existing.totalPercentage / existing.count);
    } else {
      acc.push({ subject: curr.subject, totalPercentage: percentage, count: 1, avg: Math.round(percentage) });
    }
    return acc;
  }, []);

  return (
    <div className="space-y-8">
      {userProfile.role !== 'Student' && (
        <div className="flex justify-end">
          {/* Global standard selector is used instead */}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Award size={20} />
            </div>
            <span className="flex items-center text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
              <ArrowUpRight size={12} /> 12%
            </span>
          </div>
          <h4 className="text-slate-500 text-xs uppercase tracking-widest font-bold mb-1">Total Quizzes</h4>
          <div className="text-3xl font-serif font-medium text-slate-800">{filteredResults.length}</div>
        </div>

        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <TrendingUp size={20} />
            </div>
            <span className="flex items-center text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
              <ArrowUpRight size={12} /> 5%
            </span>
          </div>
          <h4 className="text-slate-500 text-xs uppercase tracking-widest font-bold mb-1">Avg. Score</h4>
          <div className="text-3xl font-serif font-medium text-slate-800">
            {filteredResults.length > 0 ? Math.round(filteredResults.reduce((acc, curr) => acc + getPercentage(curr), 0) / filteredResults.length) : 0}%
          </div>
        </div>

        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600">
              <Users size={20} />
            </div>
            <span className="flex items-center text-xs font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded-full">
              <ArrowDownRight size={12} /> 2%
            </span>
          </div>
          <h4 className="text-slate-500 text-xs uppercase tracking-widest font-bold mb-1">Active Students</h4>
          <div className="text-3xl font-serif font-medium text-slate-800">
            {new Set(filteredResults.map(r => r.studentId)).size}
          </div>
        </div>

        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-600">
              <Calendar size={20} />
            </div>
          </div>
          <h4 className="text-slate-500 text-xs uppercase tracking-widest font-bold mb-1">Quizzes Today</h4>
          <div className="text-3xl font-serif font-medium text-slate-800">
            {filteredResults.filter(r => {
              if (!r.timestamp) return false;
              const date = (r.timestamp as any).toDate ? (r.timestamp as any).toDate() : new Date(r.timestamp as any);
              const today = new Date();
              return date.toDateString() === today.toDateString();
            }).length}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm">
          <h3 className="text-xl font-serif font-medium text-slate-800 mb-8 flex items-center gap-2">
            <PieChartIcon className="text-indigo-500" /> Grade Distribution
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <PieChart>
                <Pie
                  data={performanceData.length > 0 ? performanceData : [{ name: 'No Data', value: 1 }]}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {performanceData.length > 0 ? performanceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  )) : <Cell fill="#f1f5f9" />}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm">
          <h3 className="text-xl font-serif font-medium text-slate-800 mb-8 flex items-center gap-2">
            <BarChart3 className="text-indigo-500" /> Subject Performance
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart data={subjectData.length > 0 ? subjectData : [{ subject: 'No Data', avg: 0 }]}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="subject" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                  cursor={{fill: '#f8fafc'}}
                />
                <Bar dataKey="avg" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm">
        <h3 className="text-xl font-serif font-medium text-slate-800 mb-6 flex items-center gap-2">
          <Calendar className="text-indigo-500" /> Recent Quiz Activity
        </h3>
        <div className="space-y-4">
          {filteredResults.length === 0 ? (
            <div className="text-center py-12 text-slate-400 italic">No quiz activity found</div>
          ) : (
            filteredResults.slice(0, 5).map((r, i) => {
              const pct = getPercentage(r);
              return (
                <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-slate-100 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold ${
                      pct >= 80 ? 'bg-emerald-50 text-emerald-600' : 
                      pct >= 60 ? 'bg-blue-50 text-blue-600' : 
                      'bg-orange-50 text-orange-600'
                    }`}>
                      {pct}%
                    </div>
                    <div>
                      <div className="font-bold text-slate-800">{r.quizTitle}</div>
                      <div className="text-xs text-slate-500 flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-white rounded border border-slate-200 text-[10px] font-bold uppercase tracking-wider">
                          {r.subject}
                        </span>
                        <span>•</span>
                        <span>{r.timestamp ? (r.timestamp as any).toDate?.().toLocaleString() : 'Just now'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-slate-800">{r.score} / {r.totalScore}</div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Score</div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default QuizAnalytics;
