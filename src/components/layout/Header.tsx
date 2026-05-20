import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Bell, Plus, ChevronDown, LogOut,
  Briefcase, Users, Building2, Handshake, Mail, CalendarClock, Send, FolderKanban, BadgeDollarSign,
  UserCog,
} from 'lucide-react';
import { canAccess, clearSession, resolveSession, SectionKey, SESSION_UPDATED_EVENT } from '@/lib/auth';
import { ATS_RECORDS_UPDATED_EVENT } from '@/lib/atsLocalStore';
import { BRAND_INITIALS } from '@/lib/brand';
import { getAllCandidates, getAllInterviews, getAllJobs, getAllSubmissions } from '@/lib/localRecords';

const routeLabels: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/candidates': 'Candidates',
  '/candidates/new': 'New Candidate',
  '/candidates/:id/resume-validation': 'Resume Validation',
  '/jobs': 'Jobs',
  '/jobs/new': 'New Job',
  '/jobs/:id/candidates': 'Job Candidates',
  '/clients': 'Clients CRM',
  '/vendors': 'Vendors',
  '/submissions': 'Submissions',
  '/interviews': 'Interviews',
  '/offers': 'Offers',
  '/onboarding': 'Onboarding',
  '/imports': 'Bulk Import',
  '/emails': 'Email Center',
  '/documents': 'Document Management',
  '/pipeline': 'Pipeline',
  '/calendar': 'Calendar',
  '/tasks': 'Tasks',
  '/automations': 'Automations',
  '/compliance-management': 'Compliance',
  '/compliance': 'Compliance / Audit Logs',
  '/reports': 'Reports',
  '/integrations': 'Integrations',
  '/ai-assistant': 'AI Assistant',
  '/ai/resume-match': 'AI Resume Match',
  '/ai/boolean-generator': 'AI Boolean Generator',
  '/users': 'User Management',
};

const addActions: Array<{ label: string; icon: typeof Users; path: string; section: SectionKey; color: string }> = [
  { label: 'Add Candidate',       icon: Users,         path: '/candidates/new',    section: 'candidates',  color: 'text-blue-400' },
  { label: 'Add Job',             icon: Briefcase,     path: '/jobs/new',          section: 'jobs',        color: 'text-cyan-400' },
  { label: 'Add Client',          icon: Building2,     path: '/clients/new',       section: 'clients',     color: 'text-emerald-400' },
  { label: 'Add Vendor',          icon: Handshake,     path: '/vendors?add=1',     section: 'vendors',     color: 'text-amber-400' },
  { label: 'Send Email',          icon: Mail,          path: '/emails',            section: 'emails',      color: 'text-violet-400' },
  { label: 'New Submission',      icon: Send,          path: '/submissions?add=1', section: 'submissions', color: 'text-blue-400' },
  { label: 'New Offer',           icon: BadgeDollarSign, path: '/offers',          section: 'offers',      color: 'text-emerald-400' },
  { label: 'Start Onboarding',     icon: BadgeDollarSign, path: '/onboarding',      section: 'onboarding',  color: 'text-blue-400' },
  { label: 'Upload Document',     icon: FolderKanban,  path: '/documents?add=1',   section: 'documents',   color: 'text-emerald-400' },
  { label: 'Schedule Interview',  icon: CalendarClock, path: '/calendar',          section: 'calendar',    color: 'text-cyan-400' },
];

export function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [sessionVersion, setSessionVersion] = useState(0);
  const [recordsVersion, setRecordsVersion] = useState(0);
  const session = useMemo(() => resolveSession(), [location.pathname, sessionVersion]);

  useEffect(() => {
    const refreshSession = () => setSessionVersion(version => version + 1);
    window.addEventListener(SESSION_UPDATED_EVENT, refreshSession);
    window.addEventListener('storage', refreshSession);
    return () => {
      window.removeEventListener(SESSION_UPDATED_EVENT, refreshSession);
      window.removeEventListener('storage', refreshSession);
    };
  }, []);

  useEffect(() => {
    const refreshRecords = () => setRecordsVersion(version => version + 1);
    window.addEventListener(ATS_RECORDS_UPDATED_EVENT, refreshRecords);
    window.addEventListener('storage', refreshRecords);
    return () => {
      window.removeEventListener(ATS_RECORDS_UPDATED_EVENT, refreshRecords);
      window.removeEventListener('storage', refreshRecords);
    };
  }, []);

  const notifications = useMemo(() => {
    const recentCandidates = getAllCandidates().slice(0, 2).map((candidate, index) => ({
      id: `candidate-${candidate.id}`,
      text: `Candidate added: ${candidate.name}`,
      time: index === 0 ? 'latest' : 'recent',
    }));
    const urgentJobs = getAllJobs()
      .filter(job => job.priority === 'High' || job.priority === 'Critical')
      .slice(0, 2)
      .map(job => ({ id: `job-${job.id}`, text: `Priority job open: ${job.title}`, time: job.closeDate || 'deadline pending' }));
    const activeSubmissions = getAllSubmissions()
      .filter(submission => submission.status === 'Submitted' || submission.status === 'Client Review')
      .slice(0, 2)
      .map(submission => ({ id: `submission-${submission.id}`, text: `Client submission pending: ${submission.candidateName}`, time: submission.submittedDate }));
    const scheduledInterviews = getAllInterviews()
      .filter(interview => interview.status === 'Scheduled')
      .slice(0, 2)
      .map(interview => ({ id: `interview-${interview.id}`, text: `Interview scheduled: ${interview.candidateName}`, time: `${interview.date} ${interview.time}` }));

    return [...recentCandidates, ...urgentJobs, ...activeSubmissions, ...scheduledInterviews].slice(0, 6);
  }, [recordsVersion]);

  const pageLabel = Object.entries(routeLabels)
    .sort(([first], [second]) => second.length - first.length)
    .find(([key]) => {
      if (key.includes(':id')) {
        const pattern = new RegExp(`^${key.replace(':id', '[^/]+')}`);
        return pattern.test(location.pathname);
      }
      return location.pathname.startsWith(key);
    })?.[1] ?? '';
  const visibleAddActions = addActions.filter(action => canAccess(session, action.section));
  const initials = session?.name
    .split(/\s+/)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || BRAND_INITIALS;

  const signOut = () => {
    clearSession();
    setShowUserMenu(false);
    navigate('/login', { replace: true });
  };

  return (
    <header className="h-14 bg-[#080d1a]/90 backdrop-blur-xl border-b border-white/5 flex items-center gap-4 px-4 flex-shrink-0 relative z-20">
      {/* Page title */}
      <span className="text-sm font-semibold text-slate-300 hidden sm:block w-28 flex-shrink-0">
        {pageLabel}
      </span>

      {/* Search */}
      <div className="flex-1 max-w-md relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search candidates, jobs, clients..."
          className="w-full bg-white/5 border border-white/8 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:bg-white/8 transition-all"
        />
      </div>

      <div className="flex items-center gap-2 ml-auto">
        {/* Add button */}
        <div className="relative">
          <button
            onClick={() => { setShowAddMenu(v => !v); setShowNotifications(false); setShowUserMenu(false); }}
            disabled={visibleAddActions.length === 0}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus size={14} />
            <span className="hidden sm:inline">Add</span>
            <ChevronDown size={12} />
          </button>
          <AnimatePresence>
            {showAddMenu && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.95 }}
                transition={{ duration: 0.12 }}
                className="absolute right-0 mt-2 w-44 bg-[#0f172a] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50"
              >
                {visibleAddActions.map(action => (
                  <button
                    key={action.label}
                    onClick={() => { navigate(action.path); setShowAddMenu(false); }}
                    className="flex items-center gap-2.5 w-full px-4 py-3 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
                  >
                    <action.icon size={14} className={action.color} />
                    {action.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => { setShowNotifications(v => !v); setShowAddMenu(false); setShowUserMenu(false); }}
            className="relative w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <Bell size={16} />
            {notifications.length > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-500 border border-[#080d1a]" />}
          </button>
          <AnimatePresence>
            {showNotifications && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.95 }}
                transition={{ duration: 0.12 }}
                className="absolute right-0 mt-2 w-80 bg-[#0f172a] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50"
              >
                <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">Notifications</span>
                  <span className="text-xs text-blue-400 cursor-pointer hover:underline">Mark all read</span>
                </div>
                {notifications.length ? (
                  notifications.map(n => (
                    <div key={n.id} className="px-4 py-3 hover:bg-white/5 cursor-pointer border-b border-white/5 last:border-0">
                      <p className="text-sm text-slate-300 leading-snug">{n.text}</p>
                      <p className="text-xs text-slate-600 mt-1">{n.time}</p>
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-6 text-sm text-slate-500">No ATS notifications yet. New candidate, job, submission, and interview activity will appear here.</div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => { setShowUserMenu(v => !v); setShowAddMenu(false); setShowNotifications(false); }}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
          >
            {session?.avatarUrl ? (
              <img src={session.avatarUrl} alt={`${session.name} profile`} className="h-7 w-7 rounded-full border border-white/10 object-cover" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-xs font-bold text-white">
                {initials}
              </div>
            )}
            <span className="text-sm text-slate-300 hidden sm:block">{session?.name ?? 'Eventus User'}</span>
            <ChevronDown size={12} className="text-slate-500 hidden sm:block" />
          </button>
          <AnimatePresence>
            {showUserMenu && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.95 }}
                transition={{ duration: 0.12 }}
                className="absolute right-0 mt-2 w-52 bg-[#0f172a] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50"
              >
                <div className="px-4 py-3 border-b border-white/5">
                  <p className="text-sm font-semibold text-white">{session?.name ?? 'Eventus User'}</p>
                  <p className="text-xs text-slate-500">{session?.email ?? 'session@eventus.local'}</p>
                  <span className="mt-2 inline-flex rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-300">
                    {session?.role ?? 'User'}
                  </span>
                </div>
                {canAccess(session, 'users') && (
                  <button
                    onClick={() => { navigate('/users'); setShowUserMenu(false); }}
                    className="flex items-center gap-2.5 w-full px-4 py-3 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
                  >
                    <UserCog size={14} />User Management
                  </button>
                )}
                <div className="border-t border-white/5">
                  <button
                    onClick={signOut}
                    className="flex items-center gap-2.5 w-full px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                  >
                    <LogOut size={14} />Sign Out
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Click outside overlay */}
      {(showNotifications || showUserMenu || showAddMenu) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => { setShowNotifications(false); setShowUserMenu(false); setShowAddMenu(false); }}
        />
      )}
    </header>
  );
}
