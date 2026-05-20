import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { canAccess, resolveSession, SectionKey } from '@/lib/auth';
import { BRAND_LOGO, BRAND_NAME, BRAND_TAGLINE } from '@/lib/brand';
import { LayoutDashboard, Users, Briefcase, Building2, Handshake, Send, Mail, FolderKanban, GitBranch, Calendar, SquareCheck as CheckSquare, Zap, ShieldCheck, ChartBar as BarChart3, Puzzle, Sparkles, ChevronLeft, ChevronRight, UserCog, BadgeDollarSign, UploadCloud, ClipboardCheck, UserCheck } from 'lucide-react';

const navItems: Array<{ label: string; icon: typeof LayoutDashboard; path: string; section: SectionKey }> = [
  { label: 'Dashboard',       icon: LayoutDashboard, path: '/dashboard',    section: 'dashboard' },
  { label: 'Candidates',      icon: Users,           path: '/candidates',   section: 'candidates' },
  { label: 'Jobs',            icon: Briefcase,       path: '/jobs',         section: 'jobs' },
  { label: 'Clients CRM',     icon: Building2,       path: '/clients',      section: 'clients' },
  { label: 'Vendors',         icon: Handshake,       path: '/vendors',      section: 'vendors' },
  { label: 'Submissions',     icon: Send,            path: '/submissions',  section: 'submissions' },
  { label: 'Offers',          icon: BadgeDollarSign, path: '/offers',       section: 'offers' },
  { label: 'Onboarding',      icon: ClipboardCheck,  path: '/onboarding',   section: 'onboarding' },
  { label: 'Bulk Import',     icon: UploadCloud,     path: '/imports',      section: 'imports' },
  { label: 'Email Center',    icon: Mail,            path: '/emails',       section: 'emails' },
  { label: 'Documents',       icon: FolderKanban,    path: '/documents',    section: 'documents' },
  { label: 'Pipeline',        icon: GitBranch,       path: '/pipeline',     section: 'pipeline' },
  { label: 'Calendar',        icon: Calendar,        path: '/calendar',     section: 'calendar' },
  { label: 'Tasks',           icon: CheckSquare,     path: '/tasks',        section: 'tasks' },
  { label: 'Automations',     icon: Zap,             path: '/automations',  section: 'automations' },
  { label: 'Compliance',      icon: UserCheck,       path: '/compliance-management', section: 'compliance-management' },
  { label: 'Audit Logs',      icon: ShieldCheck,     path: '/compliance',   section: 'compliance' },
  { label: 'Reports',         icon: BarChart3,       path: '/reports',      section: 'reports' },
  { label: 'Integrations',    icon: Puzzle,          path: '/integrations', section: 'integrations' },
  { label: 'AI Assistant',    icon: Sparkles,        path: '/ai-assistant', section: 'ai-assistant' },
  { label: 'User Management', icon: UserCog,         path: '/users',        section: 'users' },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const session = resolveSession();
  const visibleNavItems = navItems.filter(item => canAccess(session, item.section));

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 240 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      className="relative flex flex-col h-full bg-[#080d1a] border-r border-white/5 flex-shrink-0 overflow-hidden z-30"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/5">
        <div className="eventus-sidebar-logo flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center">
          <img src={BRAND_LOGO} alt={`${BRAND_NAME} logo`} className="h-full w-full rounded-xl object-cover" />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
            >
              <span className="block max-w-[150px] text-sm font-bold leading-tight text-white tracking-tight">{BRAND_NAME}</span>
              <p className="text-[10px] text-cyan-300/80 leading-none mt-1">{BRAND_TAGLINE}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 overflow-y-auto overflow-x-hidden">
        <ul className="space-y-0.5 px-2">
          {visibleNavItems.map(item => {
            const active = location.pathname.startsWith(item.path);
            return (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group relative overflow-hidden',
                    active
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-500/20'
                      : 'text-slate-400 hover:bg-white/5 hover:text-white border border-transparent'
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  {active && (
                    <motion.span
                      layoutId="sidebar-active"
                      className="absolute inset-0 bg-blue-600/10 rounded-lg"
                      transition={{ duration: 0.2 }}
                    />
                  )}
                  <item.icon
                    size={17}
                    className={cn(
                      'flex-shrink-0 relative z-10 transition-colors',
                      active ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300',
                      item.label === 'AI Assistant' && !active && 'text-violet-400 group-hover:text-violet-300'
                    )}
                  />
                  <AnimatePresence>
                    {!collapsed && (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.1 }}
                        className="relative z-10 whitespace-nowrap"
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Collapse button */}
      <div className="p-3 border-t border-white/5">
        <button
          onClick={() => setCollapsed(c => !c)}
          className={cn(
            'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-colors text-sm',
            collapsed && 'justify-center'
          )}
        >
          {collapsed ? <ChevronRight size={15} /> : <><ChevronLeft size={15} /><span>Collapse</span></>}
        </button>
      </div>
    </motion.aside>
  );
}
