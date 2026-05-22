import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import {
  Award, Bot, Briefcase, CalendarCheck, ClipboardCheck, Clock,
  FileClock, FileSearch, MapPin, Send, ShieldAlert, SquareCheck as CheckSquare,
  TrendingUp, UserCheck, UserRoundCheck, UserRoundX, Users,
  ArrowRight,
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import type { TooltipProps } from 'recharts';
import { ATS_RECORDS_UPDATED_EVENT } from '@/lib/atsLocalStore';
import {
  getAllCandidateDocuments,
  getAllCandidates,
  getAllInterviews,
  getAllJobs,
  getAllSubmissions,
  getAllTasks,
} from '@/lib/localRecords';
import { cn } from '@/lib/utils';

const statusColors: Record<string, string> = {
  'New': 'bg-blue-500/20 text-blue-400 border-blue-500/20',
  'Screening': 'bg-violet-500/20 text-violet-400 border-violet-500/20',
  'Interview': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/20',
  'Offer': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20',
  'Placed': 'bg-amber-500/20 text-amber-400 border-amber-500/20',
  'Rejected': 'bg-red-500/20 text-red-400 border-red-500/20',
  'On Hold': 'bg-slate-500/20 text-slate-400 border-slate-500/20',
  'Active': 'bg-emerald-500/20 text-emerald-400',
  'Critical': 'bg-red-500/20 text-red-400',
  'High': 'bg-orange-500/20 text-orange-400',
};

function weekLabel(dateText: string) {
  const date = dateText ? new Date(dateText) : new Date();
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return `${date.toLocaleString('en-US', { month: 'short' })} ${date.getDate()}`;
}

function monthLabel(dateText: string) {
  const date = dateText ? new Date(dateText) : new Date();
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString('en-US', { month: 'short' });
}

type DashboardMetric = {
  label: string;
  value: string | number;
  hint: string;
  icon: typeof Briefcase;
  color: string;
  glow: string;
  path: string;
};

function MetricCard({ metric, index, onClick }: { metric: DashboardMetric; index: number; onClick: () => void }) {
  const Icon = metric.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.4 }}
      onClick={onClick}
      className={cn(
        'relative overflow-hidden rounded-lg border border-white/5 bg-[#0d1729] p-4 group cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:border-white/10',
        `hover:shadow-lg ${metric.glow}`
      )}
    >
      <div className={cn('absolute top-0 right-0 w-20 h-20 rounded-bl-full opacity-10 bg-gradient-to-br', metric.color)} />
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center bg-gradient-to-br flex-shrink-0', metric.color)}>
          <Icon size={17} className="text-white" />
        </div>
        <ArrowRight size={13} className="text-slate-600 transition-colors group-hover:text-blue-300" />
      </div>
      <p className="text-2xl font-bold text-white">{metric.value}</p>
      <p className="text-xs font-medium text-slate-300 mt-1 leading-snug">{metric.label}</p>
      <p className="text-[11px] text-slate-600 mt-1">{metric.hint}</p>
    </motion.div>
  );
}

type ChartTooltipProps = TooltipProps<number, string>;

const CustomTooltip = ({ active, payload, label }: ChartTooltipProps) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0f172a] border border-white/10 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-slate-400 mb-1">{label}</p>
      <p className="text-white font-semibold">{payload[0].value} {payload[0].name}</p>
    </div>
  );
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [refreshKey, setRefreshKey] = useState(0);
  const [todayLabel] = useState(() => new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }));
  const candidates = useMemo(() => getAllCandidates(), [refreshKey]);
  const jobs = useMemo(() => getAllJobs(), [refreshKey]);
  const submissions = useMemo(() => getAllSubmissions(), [refreshKey]);
  const interviews = useMemo(() => getAllInterviews(), [refreshKey]);
  const tasks = useMemo(() => getAllTasks(), [refreshKey]);
  const candidateDocuments = useMemo(() => getAllCandidateDocuments(), [refreshKey]);

  useEffect(() => {
    const refresh = () => setRefreshKey(value => value + 1);
    window.addEventListener(ATS_RECORDS_UPDATED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(ATS_RECORDS_UPDATED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const totalJobs = jobs.length;
  const activeJobs = jobs.filter(job => job.status === 'Active').length;
  const closedJobs = jobs.filter(job => job.status === 'Filled' || job.status === 'Cancelled').length;
  const totalCandidates = candidates.length;
  const submittedCandidates = new Set(submissions.map(submission => submission.candidateId)).size;
  const interviewStageCandidates = candidates.filter(candidate => candidate.status === 'Interview').length;
  const selectedCandidates = candidates.filter(candidate => candidate.status === 'Placed').length;
  const rejectedCandidates = candidates.filter(candidate => candidate.status === 'Rejected').length;
  const offerStageCandidates = candidates.filter(candidate => candidate.status === 'Offer').length;
  const joiningStageCandidates = candidates.filter(candidate => candidate.status === 'Placed').length;
  const todaysFollowUps = tasks.filter(task => task.status !== 'Completed').length;
  const pendingClientSubmissions = submissions.filter(submission => submission.status === 'Submitted' || submission.status === 'Client Review').length;
  const pendingCandidateDocuments = candidateDocuments.filter(document => document.status === 'Missing' || document.status === 'Pending').length;
  const resumeValidationQueue = candidates.filter(candidate => !candidate.resume).length;
  const aiMatchScoreSummary = candidates.length
    ? Math.round(candidates.reduce((total, candidate) => total + candidate.rating * 20, 0) / candidates.length)
    : 0;

  const metrics: DashboardMetric[] = [
    { label: 'Total jobs', value: totalJobs, hint: 'All job records', icon: Briefcase, color: 'from-blue-600 to-blue-400', glow: 'shadow-blue-500/20', path: '/jobs' },
    { label: 'Active jobs', value: activeJobs, hint: 'Open for submissions', icon: TrendingUp, color: 'from-emerald-600 to-emerald-400', glow: 'shadow-emerald-500/20', path: '/jobs' },
    { label: 'Closed jobs', value: closedJobs, hint: 'Filled or cancelled', icon: ClipboardCheck, color: 'from-slate-600 to-slate-400', glow: 'shadow-slate-500/20', path: '/jobs' },
    { label: 'Total candidates', value: totalCandidates, hint: 'Candidate database', icon: Users, color: 'from-violet-600 to-violet-400', glow: 'shadow-violet-500/20', path: '/candidates' },
    { label: 'Submitted candidates', value: submittedCandidates, hint: 'Sent to clients', icon: Send, color: 'from-cyan-600 to-cyan-400', glow: 'shadow-cyan-500/20', path: '/submissions' },
    { label: 'Interview stage candidates', value: interviewStageCandidates, hint: 'Currently interviewing', icon: CalendarCheck, color: 'from-sky-600 to-sky-400', glow: 'shadow-sky-500/20', path: '/calendar' },
    { label: 'Selected candidates', value: selectedCandidates, hint: 'Placed selections', icon: UserRoundCheck, color: 'from-green-600 to-green-400', glow: 'shadow-green-500/20', path: '/candidates' },
    { label: 'Rejected candidates', value: rejectedCandidates, hint: 'Rejected pipeline', icon: UserRoundX, color: 'from-red-600 to-red-400', glow: 'shadow-red-500/20', path: '/candidates' },
    { label: 'Offer stage', value: offerStageCandidates, hint: 'Offers in motion', icon: Award, color: 'from-amber-600 to-amber-400', glow: 'shadow-amber-500/20', path: '/candidates' },
    { label: 'Joining stage', value: joiningStageCandidates, hint: 'Ready to join', icon: UserCheck, color: 'from-teal-600 to-teal-400', glow: 'shadow-teal-500/20', path: '/candidates' },
    { label: "Today's follow-ups", value: todaysFollowUps, hint: 'Open follow-up tasks', icon: CheckSquare, color: 'from-indigo-600 to-indigo-400', glow: 'shadow-indigo-500/20', path: '/tasks' },
    { label: 'Pending client submissions', value: pendingClientSubmissions, hint: 'Awaiting client action', icon: FileClock, color: 'from-orange-600 to-orange-400', glow: 'shadow-orange-500/20', path: '/submissions' },
    { label: 'Pending candidate documents', value: pendingCandidateDocuments, hint: 'Docs needing review', icon: ShieldAlert, color: 'from-rose-600 to-rose-400', glow: 'shadow-rose-500/20', path: '/documents' },
    { label: 'Resume validation queue', value: resumeValidationQueue, hint: 'Profiles needing resume check', icon: FileSearch, color: 'from-purple-600 to-purple-400', glow: 'shadow-purple-500/20', path: '/candidates' },
    { label: 'AI match score summary', value: `${aiMatchScoreSummary}%`, hint: 'Average match quality', icon: Bot, color: 'from-pink-600 to-pink-400', glow: 'shadow-pink-500/20', path: '/ai-assistant' },
  ];

  const pipelineData = [
    { stage: 'New', count: candidates.filter(candidate => candidate.status === 'New').length, fill: '#3b82f6' },
    { stage: 'Screening', count: candidates.filter(candidate => candidate.status === 'Screening').length, fill: '#8b5cf6' },
    { stage: 'Interview', count: candidates.filter(candidate => candidate.status === 'Interview').length, fill: '#06b6d4' },
    { stage: 'Offer', count: candidates.filter(candidate => candidate.status === 'Offer').length, fill: '#10b981' },
    { stage: 'Placed', count: candidates.filter(candidate => candidate.status === 'Placed').length, fill: '#f59e0b' },
  ];

  const weeklySubmissions = Object.values(submissions.reduce<Record<string, { week: string; submissions: number }>>((acc, submission) => {
    const label = weekLabel(submission.submittedDate);
    acc[label] = acc[label] ?? { week: label, submissions: 0 };
    acc[label].submissions += 1;
    return acc;
  }, {}));

  const monthlyPlacements = Object.values(submissions.filter(submission => submission.status === 'Placed').reduce<Record<string, { month: string; placements: number }>>((acc, submission) => {
    const label = monthLabel(submission.submittedDate);
    acc[label] = acc[label] ?? { month: label, placements: 0 };
    acc[label].placements += 1;
    return acc;
  }, {}));

  const recentCandidates = candidates.slice(0, 5);
  const hotJobs = jobs.filter(j => j.status === 'Active').slice(0, 4);
  const upcomingInterviews = interviews.filter(i => i.status === 'Scheduled').slice(0, 3);
  const followUpTasks = tasks.filter(t => t.status !== 'Completed').slice(0, 4);

  return (
    <div className="p-6 space-y-6">
      {/* Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">The Eventus Consulting Group Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">Home screen for jobs, candidates, submissions, compliance, and AI matching.</p>
        </div>
        <span className="text-xs text-slate-600 bg-white/5 border border-white/5 rounded-lg px-3 py-1.5">
          {todayLabel}
        </span>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 gap-3">
        {metrics.map((m, i) => (
          <MetricCard key={m.label} metric={m} index={i} onClick={() => navigate(m.path)} />
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Pipeline overview */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-[#0d1729] border border-white/5 rounded-xl p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Pipeline Overview</h3>
            <button onClick={() => navigate('/pipeline')} className="text-xs text-blue-400 hover:underline flex items-center gap-1">
              View <ArrowRight size={11} />
            </button>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={pipelineData} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="stage" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={24} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {pipelineData.map((entry) => (
                  <Cell key={entry.stage} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Submissions by week */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-[#0d1729] border border-white/5 rounded-xl p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Submissions by Week</h3>
            <button onClick={() => navigate('/submissions')} className="text-xs text-blue-400 hover:underline flex items-center gap-1">
              View <ArrowRight size={11} />
            </button>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={weeklySubmissions}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="week" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={24} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="submissions" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Placements by month */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-[#0d1729] border border-white/5 rounded-xl p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Placements by Month</h3>
            <button onClick={() => navigate('/reports')} className="text-xs text-blue-400 hover:underline flex items-center gap-1">
              View <ArrowRight size={11} />
            </button>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={monthlyPlacements} barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={24} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="placements" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Bottom grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Recent Candidates */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="bg-[#0d1729] border border-white/5 rounded-xl p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Recent Candidates</h3>
            <button onClick={() => navigate('/candidates')} className="text-xs text-blue-400 hover:underline flex items-center gap-1">All <ArrowRight size={11} /></button>
          </div>
          <div className="space-y-3">
            {recentCandidates.map(c => (
              <div
                key={c.id}
                onClick={() => navigate(`/candidates/${c.id}`)}
                className="flex items-center gap-3 cursor-pointer group"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                  {c.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white group-hover:text-blue-400 transition-colors truncate">{c.name}</p>
                  <p className="text-[11px] text-slate-500 truncate">{c.title}</p>
                </div>
                <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full border', statusColors[c.status])}>
                  {c.status}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Hot Jobs */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-[#0d1729] border border-white/5 rounded-xl p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Hot Jobs</h3>
            <button onClick={() => navigate('/jobs')} className="text-xs text-blue-400 hover:underline flex items-center gap-1">All <ArrowRight size={11} /></button>
          </div>
          <div className="space-y-3">
            {hotJobs.map(j => (
              <div
                key={j.id}
                onClick={() => navigate(`/jobs/${j.id}`)}
                className="cursor-pointer group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white group-hover:text-blue-400 transition-colors truncate">{j.title}</p>
                    <p className="text-[11px] text-slate-500 truncate">{j.client}</p>
                  </div>
                  <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', statusColors[j.priority])}>
                    {j.priority}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <MapPin size={10} className="text-slate-600" />
                  <span className="text-[10px] text-slate-600">{j.location}</span>
                  <span className="text-[10px] text-slate-600 ml-auto">{j.submissions} submitted</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Upcoming Interviews */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="bg-[#0d1729] border border-white/5 rounded-xl p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Upcoming Interviews</h3>
            <button onClick={() => navigate('/calendar')} className="text-xs text-blue-400 hover:underline flex items-center gap-1">All <ArrowRight size={11} /></button>
          </div>
          <div className="space-y-3">
            {upcomingInterviews.map(i => (
              <div key={i.id} className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center flex-shrink-0">
                  <CalendarCheck size={13} className="text-cyan-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white truncate">{i.candidateName}</p>
                  <p className="text-[11px] text-slate-500 truncate">{i.jobTitle}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <Clock size={9} className="text-slate-600" />
                    <span className="text-[10px] text-slate-600">{i.date} · {i.time}</span>
                  </div>
                </div>
                <span className="text-[10px] text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded-full h-fit flex-shrink-0">
                  {i.type}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Follow-up Tasks */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-[#0d1729] border border-white/5 rounded-xl p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Follow-up Tasks</h3>
            <button onClick={() => navigate('/tasks')} className="text-xs text-blue-400 hover:underline flex items-center gap-1">All <ArrowRight size={11} /></button>
          </div>
          <div className="space-y-3">
            {followUpTasks.map(t => (
              <div key={t.id} className="flex items-start gap-2.5">
                <div className={cn(
                  'w-2 h-2 rounded-full mt-1.5 flex-shrink-0',
                  t.priority === 'Critical' ? 'bg-red-500' :
                  t.priority === 'High' ? 'bg-orange-500' :
                  t.priority === 'Medium' ? 'bg-yellow-500' : 'bg-slate-500'
                )} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white leading-snug">{t.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Clock size={9} className="text-slate-600" />
                    <span className="text-[10px] text-slate-600">Due {t.dueDate}</span>
                    <span className="text-[10px] text-slate-600">· {t.assignee}</span>
                  </div>
                </div>
                <span className={cn(
                  'text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0',
                  t.status === 'In Progress' ? 'text-blue-400 bg-blue-500/10' : 'text-slate-400 bg-white/5'
                )}>
                  {t.status}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
