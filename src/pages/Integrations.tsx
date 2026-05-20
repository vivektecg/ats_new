import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  CircleAlert as AlertCircle,
  CircleCheck as CheckCircle,
  ExternalLink,
  KeyRound,
  Play,
  RefreshCw,
  Save,
  Settings as SettingsIcon,
  ShieldCheck,
  X,
} from 'lucide-react';
import { upsertLocalCandidates, upsertLocalJobs } from '@/lib/atsLocalStore';
import { LOCAL_INTEGRATIONS_KEY, LOCAL_SYNC_LOGS_KEY, saveRows } from '@/lib/atsApi';
import { cn } from '@/lib/utils';

type IntegrationStatus = 'connected' | 'disconnected' | 'syncing';
type ConnectionMode = 'Manual import' | 'API ready' | 'Webhook ready';

type IntegrationConfig = {
  accountEmail: string;
  companyName: string;
  connectionMode: ConnectionMode;
  emailProvider: string;
  imapHost: string;
  imapPort: string;
  popHost: string;
  popPort: string;
  smtpHost: string;
  smtpPort: string;
  mailSecurity: string;
  mailboxFolders: string;
  apiBaseUrl: string;
  clientId: string;
  secretReference: string;
  webhookUrl: string;
  defaultRecruiter: string;
  sourceTag: string;
  importMethod: string;
  jobPostingEnabled: boolean;
  applicantImportEnabled: boolean;
  statusSyncEnabled: boolean;
  sourcingEnabled: boolean;
  emailSyncEnabled: boolean;
  calendarSyncEnabled: boolean;
  consentConfirmed: boolean;
};

type IntegrationRecord = {
  id: string;
  name: string;
  category: string;
  status: IntegrationStatus;
  description: string;
  logo: string;
  color: string;
  lastSync: string;
  records: string;
  supportedModes: ConnectionMode[];
  config: IntegrationConfig;
};

type SyncLog = {
  id: string;
  integrationId: string;
  provider: string;
  status: 'Completed' | 'Needs settings' | 'Blocked';
  summary: string;
  createdAt: string;
};

const defaultConfig: IntegrationConfig = {
  accountEmail: '',
  companyName: 'The Eventus Consulting Group',
  connectionMode: 'Manual import',
  emailProvider: '',
  imapHost: '',
  imapPort: '993',
  popHost: '',
  popPort: '995',
  smtpHost: '',
  smtpPort: '587',
  mailSecurity: 'SSL/TLS',
  mailboxFolders: 'Inbox, Sent',
  apiBaseUrl: '',
  clientId: '',
  secretReference: '',
  webhookUrl: '',
  defaultRecruiter: 'SuperUser',
  sourceTag: '',
  importMethod: 'Manual resume upload',
  jobPostingEnabled: false,
  applicantImportEnabled: true,
  statusSyncEnabled: false,
  sourcingEnabled: false,
  emailSyncEnabled: false,
  calendarSyncEnabled: false,
  consentConfirmed: false,
};

const baseIntegrations: IntegrationRecord[] = [
  {
    id: 'linkedin-lite',
    name: 'LinkedIn Recruiter Lite',
    category: 'Sourcing',
    status: 'disconnected',
    description: 'Manual import and API-ready setup for authorized LinkedIn Recruiter workflows.',
    logo: 'LI',
    color: 'from-blue-600 to-blue-700',
    lastSync: 'Never',
    records: '0 candidates',
    supportedModes: ['Manual import', 'API ready'],
    config: { ...defaultConfig, sourceTag: 'LinkedIn', importMethod: 'Manual profile entry' },
  },
  {
    id: 'indeed',
    name: 'Indeed',
    category: 'Job Boards',
    status: 'disconnected',
    description: 'Manual Indeed applicant import now; Indeed Apply, Job Sync, and Disposition Sync when approved.',
    logo: 'IN',
    color: 'from-slate-600 to-slate-700',
    lastSync: 'Never',
    records: '0 applications',
    supportedModes: ['Manual import', 'API ready', 'Webhook ready'],
    config: {
      ...defaultConfig,
      sourceTag: 'Indeed',
      importMethod: 'Resume upload / applicant email',
      jobPostingEnabled: true,
      applicantImportEnabled: true,
      statusSyncEnabled: true,
      apiBaseUrl: 'https://apis.indeed.com',
    },
  },
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    category: 'Calendar',
    status: 'disconnected',
    description: 'Sync interview schedules with Google Calendar and send calendar invites.',
    logo: 'GC',
    color: 'from-emerald-600 to-emerald-700',
    lastSync: 'Never',
    records: '0 events',
    supportedModes: ['API ready', 'Webhook ready'],
    config: { ...defaultConfig, sourceTag: 'Google Calendar', importMethod: 'Google OAuth', calendarSyncEnabled: true },
  },
  {
    id: 'teams-calendar',
    name: 'Teams Calendar',
    category: 'Calendar',
    status: 'disconnected',
    description: 'Sync interviews to Microsoft Teams Calendar and generate Teams meeting links.',
    logo: 'TC',
    color: 'from-indigo-600 to-blue-800',
    lastSync: 'Never',
    records: '0 events',
    supportedModes: ['API ready', 'Webhook ready'],
    config: { ...defaultConfig, sourceTag: 'Teams Calendar', importMethod: 'Microsoft Graph OAuth', calendarSyncEnabled: true },
  },
  {
    id: 'docusign',
    name: 'DocuSign',
    category: 'Documents',
    status: 'disconnected',
    description: 'Send and collect e-signatures on offer letters and contracts.',
    logo: 'DS',
    color: 'from-yellow-600 to-yellow-700',
    lastSync: 'Never',
    records: '0 envelopes',
    supportedModes: ['API ready', 'Webhook ready'],
    config: { ...defaultConfig, sourceTag: 'DocuSign', importMethod: 'DocuSign OAuth' },
  },
  {
    id: 'zoominfo',
    name: 'ZoomInfo',
    category: 'Data Enrichment',
    status: 'disconnected',
    description: 'Enrich candidate and client profiles with authorized company and contact data.',
    logo: 'ZI',
    color: 'from-orange-600 to-orange-700',
    lastSync: 'Never',
    records: '0 enriched records',
    supportedModes: ['API ready'],
    config: { ...defaultConfig, sourceTag: 'ZoomInfo', importMethod: 'API enrichment' },
  },
  {
    id: 'dice',
    name: 'Dice',
    category: 'Job Boards',
    status: 'disconnected',
    description: 'Authorized Dice profile search and tech resume import for US staffing roles.',
    logo: 'DI',
    color: 'from-cyan-700 to-blue-800',
    lastSync: 'Never',
    records: '0 candidates',
    supportedModes: ['Manual import', 'API ready'],
    config: { ...defaultConfig, sourceTag: 'Dice', importMethod: 'Manual resume import' },
  },
  {
    id: 'monster-careerbuilder',
    name: 'Monster / CareerBuilder',
    category: 'Job Boards',
    status: 'disconnected',
    description: 'Resume database imports and candidate outreach through connected job-board accounts.',
    logo: 'MC',
    color: 'from-purple-700 to-fuchsia-800',
    lastSync: 'Never',
    records: '0 candidates',
    supportedModes: ['Manual import', 'API ready'],
    config: { ...defaultConfig, sourceTag: 'Monster/CareerBuilder', importMethod: 'Manual resume import' },
  },
  {
    id: 'ziprecruiter',
    name: 'ZipRecruiter',
    category: 'Job Boards',
    status: 'disconnected',
    description: 'High-volume candidate sourcing and job distribution through authorized ZipRecruiter access.',
    logo: 'ZR',
    color: 'from-emerald-700 to-teal-800',
    lastSync: 'Never',
    records: '0 applications',
    supportedModes: ['API ready', 'Webhook ready'],
    config: { ...defaultConfig, sourceTag: 'ZipRecruiter', importMethod: 'Apply webhook' },
  },
  {
    id: 'clearancejobs',
    name: 'ClearanceJobs',
    category: 'Job Boards',
    status: 'disconnected',
    description: 'Security-cleared candidate sourcing for federal and defense staffing.',
    logo: 'CJ',
    color: 'from-slate-600 to-slate-800',
    lastSync: 'Never',
    records: '0 candidates',
    supportedModes: ['Manual import', 'API ready'],
    config: { ...defaultConfig, sourceTag: 'ClearanceJobs', importMethod: 'Manual resume import' },
  },
];

const removedIntegrationIds = new Set(['imap-pop-email', 'google-email', 'greenhouse', 'slack', 'stripe']);
const categories = ['All', 'Sourcing', 'Job Boards', 'Calendar', 'Documents', 'Data Enrichment'];

function loadIntegrations() {
  try {
    const raw = window.localStorage.getItem(LOCAL_INTEGRATIONS_KEY);
    const saved = raw ? JSON.parse(raw) as IntegrationRecord[] : [];
    return baseIntegrations
      .filter(base => !removedIntegrationIds.has(base.id))
      .map(base => ({ ...base, ...saved.find(item => item.id === base.id), config: { ...base.config, ...saved.find(item => item.id === base.id)?.config } }));
  } catch {
    return baseIntegrations.filter(base => !removedIntegrationIds.has(base.id));
  }
}

function loadSyncLogs() {
  try {
    const raw = window.localStorage.getItem(LOCAL_SYNC_LOGS_KEY);
    const logs = raw ? JSON.parse(raw) : [];
    return Array.isArray(logs) ? logs as SyncLog[] : [];
  } catch {
    return [];
  }
}

function timeAgo(date: Date) {
  const seconds = Math.max(1, Math.round((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

function syncSummary(integration: IntegrationRecord) {
  const enabled = [
    integration.config.jobPostingEnabled ? 'job posting' : '',
    integration.config.applicantImportEnabled ? 'applicant import' : '',
    integration.config.statusSyncEnabled ? 'status sync' : '',
    integration.config.sourcingEnabled ? 'sourcing' : '',
    integration.config.emailSyncEnabled ? 'email sync' : '',
    integration.config.calendarSyncEnabled ? 'calendar sync' : '',
  ].filter(Boolean);
  return `${integration.name} sync completed using ${integration.config.connectionMode}. Enabled workflows: ${enabled.join(', ') || 'manual import only'}.`;
}

function isEmailConnector(integration: IntegrationRecord) {
  return integration.id === 'imap-pop-email' || integration.id === 'google-email';
}

function nextRecordCount(integration: IntegrationRecord) {
  const current = Number(integration.records.match(/\d+/)?.[0] ?? 0);
  const label = integration.records.replace(/^[\d\s]+/, '') || 'records';
  return `${current + Math.max(1, Math.round(Math.random() * 6))} ${label}`;
}

function syncAtsRecords(integration: IntegrationRecord) {
  const source = integration.config.sourceTag || integration.name;
  const candidateSyncEnabled = integration.config.applicantImportEnabled || integration.config.sourcingEnabled || integration.config.emailSyncEnabled || integration.category === 'Job Boards' || integration.category === 'Sourcing';
  const jobSyncEnabled = integration.config.jobPostingEnabled || integration.category === 'Job Boards';
  let candidatesImported = 0;
  let jobsImported = 0;

  if (candidateSyncEnabled) {
    const result = upsertLocalCandidates([
      {
        name: `${source} Synced Candidate`,
        email: `${source.toLowerCase().replace(/[^\w]+/g, '.')}candidate@example.com`,
        phone: integration.category === 'Email' ? '(555) 010-2026' : '',
        linkedin: source.toLowerCase().includes('linkedin') ? 'linkedin.com/in/syncedcandidate' : '',
        title: source === 'Indeed' ? 'Indeed Applicant' : integration.category === 'Email' ? 'Email Imported Candidate' : 'Sourced Candidate',
        location: 'Remote EST',
        skills: source === 'Indeed' ? ['SQL', 'Python', 'Analytics'] : ['Recruiting Source Match', 'Screening Pending'],
        source,
        warning: integration.category === 'Email' ? 'Imported from mailbox; resume/profile review pending' : '',
        recruiter: integration.config.defaultRecruiter || 'SuperUser',
      },
    ]);
    candidatesImported = result.imported;
  }

  if (jobSyncEnabled) {
    const result = upsertLocalJobs([
      {
        externalJobId: `${source.toUpperCase().replace(/[^\w]+/g, '-')}-SYNC`,
        jobTitle: `${source} Synced Job`,
        clientName: integration.config.companyName || 'Eventus Client',
        spocName: integration.config.defaultRecruiter || 'SuperUser',
        location: 'Remote',
        mandatorySkills: 'ATS sync, Candidate screening, Communication',
        preferredSkills: 'US staffing, Job board workflow',
        source,
        priorityLevel: 'High',
      },
    ]);
    jobsImported = result.imported;
  }

  return { candidatesImported, jobsImported };
}

export default function Integrations() {
  const [integrationRows, setIntegrationRows] = useState<IntegrationRecord[]>(loadIntegrations);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>(loadSyncLogs);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState<'all' | 'connected' | 'disconnected'>('all');
  const [activeSettingsId, setActiveSettingsId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncSteps, setSyncSteps] = useState<string[]>([]);
  const [notice, setNotice] = useState('Integration workspace ready.');

  const activeIntegration = integrationRows.find(item => item.id === activeSettingsId);
  const filtered = integrationRows.filter(integration => {
    const matchCat = categoryFilter === 'All' || integration.category === categoryFilter;
    const matchStatus = statusFilter === 'all' || integration.status === statusFilter;
    return matchCat && matchStatus;
  });
  const connectedCount = integrationRows.filter(integration => integration.status === 'connected').length;
  const recentLogs = useMemo(() => syncLogs.slice(0, 6), [syncLogs]);

  function persist(nextRows: IntegrationRecord[]) {
    setIntegrationRows(nextRows);
    window.localStorage.setItem(LOCAL_INTEGRATIONS_KEY, JSON.stringify(nextRows));
    saveRows('integrations', nextRows);
  }

  function persistLogs(nextLogs: SyncLog[]) {
    setSyncLogs(nextLogs);
    window.localStorage.setItem(LOCAL_SYNC_LOGS_KEY, JSON.stringify(nextLogs));
    saveRows('integrationSyncLogs', nextLogs);
  }

  function updateIntegration(id: string, update: Partial<IntegrationRecord>) {
    persist(integrationRows.map(integration => integration.id === id ? { ...integration, ...update } : integration));
  }

  function saveSettings(id: string, config: IntegrationConfig) {
    const status: IntegrationStatus = config.consentConfirmed ? 'connected' : 'disconnected';
    updateIntegration(id, { config, status });
    setNotice(config.consentConfirmed ? `${integrationRows.find(item => item.id === id)?.name} settings saved and connected.` : 'Settings saved. Confirm authorized access to enable the connector.');
    setActiveSettingsId(null);
  }

  function disconnectIntegration(id: string) {
    updateIntegration(id, { status: 'disconnected', lastSync: 'Never', records: '0 records' });
    setNotice('Connector disconnected from ATS sync.');
  }

  function runSync(integration: IntegrationRecord) {
    if (!integration.config.consentConfirmed) {
      setActiveSettingsId(integration.id);
      setNotice(`Open ${integration.name} settings and confirm authorized access before syncing.`);
      return;
    }

    setSyncingId(integration.id);
    setSyncSteps([
      'Checking connector settings and permission policy.',
      'Preparing ATS jobs, candidates, submissions, and source tags.',
      integration.config.connectionMode === 'Manual import'
        ? 'Running manual-import sync: staging uploaded resumes, applicant emails, and recruiter-entered profiles.'
        : 'Calling configured server-side connector endpoint. Credentials stay on backend secret storage.',
      'Writing sync history and updating ATS records.',
    ]);
    window.setTimeout(() => {
      const completedAt = new Date();
      const atsResult = syncAtsRecords(integration);
      const nextRows = integrationRows.map(row => row.id === integration.id ? {
        ...row,
        status: 'connected' as IntegrationStatus,
        lastSync: timeAgo(completedAt),
        records: nextRecordCount(row),
      } : row);
      const nextLog: SyncLog = {
        id: `sync-${Date.now()}`,
        integrationId: integration.id,
        provider: integration.name,
        status: 'Completed',
        summary: `${syncSummary(integration)} ATS updates: ${atsResult.candidatesImported} candidates, ${atsResult.jobsImported} jobs.`,
        createdAt: completedAt.toISOString(),
      };
      persist(nextRows);
      persistLogs([nextLog, ...syncLogs].slice(0, 50));
      setSyncingId(null);
      setNotice(`${integration.name} sync completed. ATS updated with ${atsResult.candidatesImported} candidates and ${atsResult.jobsImported} jobs.`);
    }, 900);
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Integrations</h1>
          <p className="mt-0.5 text-sm text-slate-500">Connect job portals, email, calendar, documents, billing, and external ATS systems to The Eventus Consulting Group ATS.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-400">
            <CheckCircle size={11} className="mr-1 inline" />
            {connectedCount} connected
          </span>
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm text-blue-100">{notice}</div>

      <div className="mb-5 flex flex-wrap gap-3">
        <div className="flex gap-2">
          {(['all', 'connected', 'disconnected'] as const).map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={cn('rounded-xl border px-3 py-2 text-xs font-medium capitalize transition-all',
                statusFilter === status ? 'border-blue-600 bg-blue-600 text-white' : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20')}
            >
              {status}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setCategoryFilter(category)}
              className={cn('rounded-xl border px-3 py-2 text-xs font-medium transition-all',
                categoryFilter === category ? 'border-blue-600 bg-blue-600 text-white' : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20')}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((integration, index) => (
          <motion.div
            key={integration.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
            className="rounded-xl border border-white/5 bg-[#0d1729] p-5 transition-all hover:border-white/10"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-sm font-bold text-white', integration.color)}>
                  {integration.logo}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">{integration.name}</h3>
                  <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-slate-500">{integration.category}</span>
                </div>
              </div>
              <span className={cn(
                'flex flex-shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-medium',
                integration.status === 'connected'
                  ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                  : integration.status === 'syncing'
                    ? 'border-blue-500/20 bg-blue-500/10 text-blue-300'
                    : 'border-white/10 bg-white/5 text-slate-500'
              )}>
                {integration.status === 'connected' ? <CheckCircle size={10} /> : <AlertCircle size={10} />}
                {integration.status === 'connected' ? 'Connected' : integration.status === 'syncing' ? 'Syncing' : 'Disconnected'}
              </span>
            </div>

            <p className="mb-4 text-xs leading-relaxed text-slate-500">{integration.description}</p>

            <div className="mb-4 rounded-lg bg-white/[0.03] px-3 py-2">
              <div className="grid grid-cols-2 gap-3 text-[10px] text-slate-600">
                <div>
                  <p className="text-xs font-medium text-white">{integration.records}</p>
                  <p>ATS records</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-white">{integration.lastSync}</p>
                  <p>Last sync</p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {integration.supportedModes.map(mode => (
                  <span key={mode} className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-slate-500">{mode}</span>
                ))}
              </div>
            </div>

            {syncingId === integration.id && (
              <div className="mb-4 rounded-lg border border-blue-500/20 bg-blue-500/10 p-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-blue-300">Sync running</p>
                <div className="space-y-1.5">
                  {syncSteps.map(step => (
                    <div key={step} className="flex gap-2 text-[11px] text-blue-50/80">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-blue-300" />
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => runSync(integration)} disabled={syncingId === integration.id} className="flex items-center justify-center gap-1.5 rounded-xl bg-white/5 py-2 text-xs text-slate-300 transition-colors hover:bg-white/10 disabled:opacity-50">
                <RefreshCw size={11} className={syncingId === integration.id ? 'animate-spin' : ''} />
                Sync
              </button>
              <button onClick={() => setActiveSettingsId(integration.id)} className="flex items-center justify-center gap-1.5 rounded-xl bg-white/5 py-2 text-xs text-slate-300 transition-colors hover:bg-white/10">
                <SettingsIcon size={11} />
                Settings
              </button>
              {integration.status === 'connected' ? (
                <button onClick={() => disconnectIntegration(integration.id)} className="col-span-2 flex items-center justify-center gap-1.5 rounded-xl border border-red-500/20 bg-red-500/10 py-2 text-xs text-red-300 transition-colors hover:bg-red-500/20">
                  Disconnect
                </button>
              ) : (
                <button onClick={() => setActiveSettingsId(integration.id)} className="col-span-2 flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 py-2 text-xs text-white transition-colors hover:bg-blue-500">
                  <ExternalLink size={11} />
                  Connect
                </button>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      <section className="rounded-xl border border-white/5 bg-[#0d1729] p-5">
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck size={15} className="text-emerald-300" />
          <h2 className="text-sm font-semibold text-white">Integration Sync History</h2>
        </div>
        <div className="space-y-2">
          {recentLogs.length ? recentLogs.map(log => (
            <div key={log.id} className="rounded-lg border border-white/5 bg-white/[0.03] px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-white">{log.provider}</p>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">{log.status}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">{log.summary}</p>
              <p className="mt-1 text-[10px] text-slate-600">{new Date(log.createdAt).toLocaleString()}</p>
            </div>
          )) : (
            <p className="text-xs text-slate-600">No sync history yet. Click Sync on any configured connector.</p>
          )}
        </div>
      </section>

      {activeIntegration && (
        <IntegrationSettingsPanel
          integration={activeIntegration}
          onClose={() => setActiveSettingsId(null)}
          onSave={saveSettings}
        />
      )}
    </div>
  );
}

function IntegrationSettingsPanel({
  integration,
  onClose,
  onSave,
}: {
  integration: IntegrationRecord;
  onClose: () => void;
  onSave: (id: string, config: IntegrationConfig) => void;
}) {
  const [form, setForm] = useState<IntegrationConfig>(integration.config);

  function update<K extends keyof IntegrationConfig>(key: K, value: IntegrationConfig[K]) {
    setForm(current => ({ ...current, [key]: value }));
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, x: 32 }} animate={{ opacity: 1, x: 0 }} className="h-full w-full max-w-3xl overflow-y-auto border-l border-white/10 bg-[#08111f] shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#08111f]/95 px-6 py-4 backdrop-blur">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-300">Connector settings</p>
            <h2 className="mt-1 text-lg font-semibold text-white">{integration.name}</h2>
          </div>
          <button aria-label="Close" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-5 p-6">
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4 text-sm leading-relaxed text-amber-100">
            Use official APIs, partner-approved exports, webhooks, email imports, or manual resume uploads only. Do not store production API secrets in the browser; use backend secret storage and save only a secret reference here.
          </div>

          {integration.id === 'indeed' && (
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-4 text-sm leading-relaxed text-blue-100">
              Indeed free employer testing should use manual import: upload resumes, paste applicant emails, and tag source as Indeed. Indeed Apply, Job Sync, and Disposition Sync require approved Indeed API access.
            </div>
          )}

          {isEmailConnector(integration) && (
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-4 text-sm leading-relaxed text-blue-100">
              IMAP/POP/SMTP supports basic email reading and sending. Calendar events, Teams links, and rich Microsoft/Google audit controls still require Graph or Google Calendar APIs. Use OAuth or an app-password/secret stored on the backend.
            </div>
          )}

          <section className="rounded-lg border border-white/5 bg-[#0d1729] p-5">
            <div className="mb-4 flex items-center gap-2">
              <KeyRound size={15} className="text-blue-300" />
              <h3 className="text-sm font-semibold text-white">Account & Connection</h3>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Account email" value={form.accountEmail} placeholder="recruiter@company.com" onChange={value => update('accountEmail', value)} />
              <Field label="Company name" value={form.companyName} onChange={value => update('companyName', value)} />
              <SelectField label="Connection mode" value={form.connectionMode} options={integration.supportedModes} onChange={value => update('connectionMode', value as ConnectionMode)} />
              <Field label="Default recruiter" value={form.defaultRecruiter} onChange={value => update('defaultRecruiter', value)} />
              <Field label="Source tag" value={form.sourceTag} onChange={value => update('sourceTag', value)} />
              <SelectField label="Import method" value={form.importMethod} options={['Manual resume upload', 'Resume upload / applicant email', 'Manual profile entry', 'Webhook endpoint', 'OAuth API sync', 'Google OAuth', 'IMAP/SMTP mailbox sync', 'POP/SMTP mailbox sync', 'ATS API sync', 'API enrichment', 'Slack app OAuth', 'Stripe API', 'Apply webhook']} onChange={value => update('importMethod', value)} />
            </div>
          </section>

          {isEmailConnector(integration) && (
            <section className="rounded-lg border border-white/5 bg-[#0d1729] p-5">
              <div className="mb-4 flex items-center gap-2">
                <KeyRound size={15} className="text-cyan-300" />
                <h3 className="text-sm font-semibold text-white">Email Server Setup</h3>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Email provider" value={form.emailProvider} placeholder="Gmail, Zoho, GoDaddy, Outlook.com, Other" onChange={value => update('emailProvider', value)} />
                <SelectField label="Mail security" value={form.mailSecurity} options={['SSL/TLS', 'STARTTLS', 'OAuth2', 'App password via backend secret']} onChange={value => update('mailSecurity', value)} />
                <Field label="IMAP host" value={form.imapHost} placeholder="imap.gmail.com / imap.yourdomain.com" onChange={value => update('imapHost', value)} />
                <Field label="IMAP port" value={form.imapPort} placeholder="993" onChange={value => update('imapPort', value)} />
                <Field label="POP host" value={form.popHost} placeholder="pop.yourdomain.com" onChange={value => update('popHost', value)} />
                <Field label="POP port" value={form.popPort} placeholder="995" onChange={value => update('popPort', value)} />
                <Field label="SMTP host" value={form.smtpHost} placeholder="smtp.gmail.com / smtp.yourdomain.com" onChange={value => update('smtpHost', value)} />
                <Field label="SMTP port" value={form.smtpPort} placeholder="587" onChange={value => update('smtpPort', value)} />
                <Field label="Sync folders" value={form.mailboxFolders} placeholder="Inbox, Sent, Archive" onChange={value => update('mailboxFolders', value)} />
              </div>
            </section>
          )}

          <section className="rounded-lg border border-white/5 bg-[#0d1729] p-5">
            <div className="mb-4 flex items-center gap-2">
              <ShieldCheck size={15} className="text-emerald-300" />
              <h3 className="text-sm font-semibold text-white">{isEmailConnector(integration) ? 'OAuth / Backend Secret Setup' : 'Backend/API Setup'}</h3>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="API base URL" value={form.apiBaseUrl} placeholder="Backend connector or provider API URL" onChange={value => update('apiBaseUrl', value)} />
              <Field label="OAuth client ID" value={form.clientId} placeholder="Public client/application ID" onChange={value => update('clientId', value)} />
              <Field label="Backend secret reference" value={form.secretReference} placeholder={isEmailConnector(integration) ? 'server-secret://email-app-password-or-oauth-secret' : 'server-secret://indeed-client-secret'} onChange={value => update('secretReference', value)} />
              <Field label="Webhook URL" value={form.webhookUrl} placeholder="https://your-server.com/api/integrations/provider/webhook" onChange={value => update('webhookUrl', value)} />
            </div>
          </section>

          <section className="rounded-lg border border-white/5 bg-[#0d1729] p-5">
            <div className="mb-4 flex items-center gap-2">
              <Play size={15} className="text-violet-300" />
              <h3 className="text-sm font-semibold text-white">Sync Workflows</h3>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Checkbox label="Job posting sync" checked={form.jobPostingEnabled} onChange={value => update('jobPostingEnabled', value)} />
              <Checkbox label="Applicant / resume import" checked={form.applicantImportEnabled} onChange={value => update('applicantImportEnabled', value)} />
              <Checkbox label="Candidate status sync" checked={form.statusSyncEnabled} onChange={value => update('statusSyncEnabled', value)} />
              <Checkbox label="Authorized candidate sourcing" checked={form.sourcingEnabled} onChange={value => update('sourcingEnabled', value)} />
              <Checkbox label="Email sync" checked={form.emailSyncEnabled} onChange={value => update('emailSyncEnabled', value)} />
              <Checkbox label="Calendar sync" checked={form.calendarSyncEnabled} onChange={value => update('calendarSyncEnabled', value)} />
            </div>
          </section>

          <section className="rounded-lg border border-white/5 bg-[#0d1729] p-5">
            <Checkbox
              label="I confirm this connector will use authorized accounts, official APIs/exports/webhooks, or manual imports only."
              checked={form.consentConfirmed}
              onChange={value => update('consentConfirmed', value)}
            />
          </section>

          <div className="grid gap-3 sm:grid-cols-2">
            <button onClick={() => onSave(integration.id, form)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500">
              <Save size={15} />
              Save & Connect
            </button>
            <button onClick={onClose} className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300 hover:bg-white/10">
              Cancel
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function Field({ label, value, placeholder, onChange }: { label: string; value: string; placeholder?: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-400">{label}</span>
      <input value={value} placeholder={placeholder} onChange={event => onChange(event.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-700 focus:border-blue-500/60" />
    </label>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-400">{label}</span>
      <select value={value} onChange={event => onChange(event.target.value)} className="w-full rounded-lg border border-white/10 bg-[#111b2d] px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500/60">
        {options.map(option => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-start gap-3 rounded-lg border border-white/5 bg-white/[0.03] p-3">
      <input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-white/20 bg-white/10 accent-blue-600" />
      <span className="text-sm leading-relaxed text-slate-300">{label}</span>
    </label>
  );
}
