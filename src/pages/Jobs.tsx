import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Bot, BriefcaseBusiness, ClipboardCopy, FileText, FileUp,
  History, ListFilter, MapPin, MessageSquarePlus, Pencil, Plus, Search,
  Sparkles, Upload, Wand2, X,
} from 'lucide-react';
import { clients as seedClients } from '@/lib/data';
import { ATS_RECORDS_UPDATED_EVENT, normalizeJobRecord } from '@/lib/atsLocalStore';
import { LOCAL_CLIENTS_KEY, LOCAL_JOBS_KEY, readLocalRows, saveRows } from '@/lib/atsApi';
import type { Client, Priority } from '@/lib/types';
import { cn } from '@/lib/utils';

type ClientType = 'Direct client' | 'Implementation partner' | 'State client' | 'Federal client';
type WorkMode = 'Remote' | 'Hybrid' | 'Onsite';
type EmploymentType = 'Contract' | 'C2C' | 'W2' | 'Full-time' | 'Part-time';
type JobWorkflowStatus = 'Open' | 'Hold' | 'Closed' | 'Filled' | 'Cancelled';
type JobAction =
  | { type: 'add' }
  | { type: 'edit'; job: JobRecord }
  | { type: 'upload'; job: JobRecord }
  | { type: 'parser'; job: JobRecord }
  | { type: 'skills'; job: JobRecord }
  | { type: 'keywords'; job: JobRecord }
  | { type: 'linkedin'; job: JobRecord }
  | { type: 'boards'; job: JobRecord }
  | { type: 'notes'; job: JobRecord }
  | null;

type JobRecord = {
  id: string;
  externalJobId?: string;
  jobTitle: string;
  clientId?: string;
  clientName: string;
  spocName: string;
  clientType: ClientType;
  location: string;
  workMode: WorkMode;
  employmentType: EmploymentType;
  duration: string;
  payRate: string;
  billRate: string;
  visaRestrictions: string[];
  experienceRequired: string;
  mandatorySkills: string;
  preferredSkills: string;
  certifications: string;
  educationRequirement: string;
  jobDescription: string;
  submissionDeadline: string;
  priorityLevel: Priority;
  assignedRecruiter: string;
  jobStatus: JobWorkflowStatus;
  openings: number;
  submissions: number;
  jdFile?: string;
  jdAttachment?: JobAttachment;
  aiSearchKeywords: string;
  linkedInBoolean: string;
  boardBoolean: string;
  notes: string[];
  history: string[];
};

type JobFormState = Omit<JobRecord, 'id' | 'submissions' | 'aiSearchKeywords' | 'linkedInBoolean' | 'boardBoolean' | 'notes' | 'history'> & {
  otherVisa: string;
  notes: string;
};

type JobAttachment = {
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
};

const clientTypes: ClientType[] = ['Direct client', 'Implementation partner', 'State client', 'Federal client'];
const workModes: WorkMode[] = ['Remote', 'Hybrid', 'Onsite'];
const employmentTypes: EmploymentType[] = ['Contract', 'C2C', 'W2', 'Full-time', 'Part-time'];
const jobStatuses: JobWorkflowStatus[] = ['Open', 'Hold', 'Closed', 'Filled', 'Cancelled'];
const priorities: Priority[] = ['Low', 'Medium', 'High', 'Critical'];
const recruiters = ['Sarah Chen', 'James Park', 'Maria Torres', 'All Team'];
const visaOptions = [
  'Any visa',
  'US Citizen',
  'Green Card',
  'H-1B',
  'H-4 EAD',
  'L-2 EAD',
  'GC EAD',
  'OPT',
  'CPT',
  'TN',
  'E-3',
  'No sponsorship',
  'Other',
];
const jdAcceptTypes = '.pdf,.doc,.docx,.txt,.rtf,.odt,.eml,.msg,.jpg,.jpeg,.png,.webp,.gif,.heic,.tif,.tiff,.zip,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,message/rfc822,image/*';

const statusColors: Record<JobWorkflowStatus, string> = {
  Open: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/20',
  Hold: 'bg-amber-500/20 text-amber-300 border-amber-500/20',
  Closed: 'bg-slate-500/20 text-slate-300 border-slate-500/20',
  Filled: 'bg-blue-500/20 text-blue-300 border-blue-500/20',
  Cancelled: 'bg-red-500/20 text-red-300 border-red-500/20',
};

const priorityColors: Record<Priority, string> = {
  Critical: 'text-red-300 bg-red-500/10 border-red-500/20',
  High: 'text-orange-300 bg-orange-500/10 border-orange-500/20',
  Medium: 'text-yellow-300 bg-yellow-500/10 border-yellow-500/20',
  Low: 'text-slate-300 bg-white/5 border-white/10',
};

const emptyJobForm: JobFormState = {
  externalJobId: '',
  jobTitle: '',
  clientId: '',
  clientName: '',
  spocName: '',
  clientType: 'Direct client',
  location: '',
  workMode: 'Remote',
  employmentType: 'Contract',
  duration: '',
  payRate: '',
  billRate: '',
  visaRestrictions: ['Any visa'],
  otherVisa: '',
  experienceRequired: '',
  mandatorySkills: '',
  preferredSkills: '',
  certifications: '',
  educationRequirement: '',
  jobDescription: '',
  submissionDeadline: '',
  priorityLevel: 'Medium',
  assignedRecruiter: 'Sarah Chen',
  jobStatus: 'Open',
  openings: 1,
  jdFile: '',
  jdAttachment: undefined,
  notes: '',
};

function loadLocalClients(): Client[] {
  return readLocalRows<Client>(LOCAL_CLIENTS_KEY);
}

function loadAllClients() {
  const localClients = loadLocalClients();
  return [
    ...seedClients,
    ...localClients.filter(localClient => !seedClients.some(client => client.id === localClient.id)),
  ];
}

function toJobClientType(clientType: Client['clientType']): ClientType {
  if (clientType === 'State client' || clientType === 'Federal client' || clientType === 'Implementation partner') return clientType;
  if (clientType === 'Vendor') return 'Implementation partner';
  return 'Direct client';
}

function attachmentFromFile(file: File): JobAttachment {
  return {
    fileName: file.name,
    fileType: file.type || 'application/octet-stream',
    fileSize: file.size,
    uploadedAt: new Date().toISOString(),
  };
}

function formatFileSize(size: number) {
  if (!size) return 'Saved attachment';
  if (size < 1024) return `${size} B`;
  if (size < 1_048_576) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1_048_576).toFixed(1)} MB`;
}

function loadLocalJobs() {
  try {
    const raw = window.localStorage.getItem(LOCAL_JOBS_KEY);
    if (!raw) return [];
    const saved = JSON.parse(raw);
    return Array.isArray(saved) ? saved.map((job, index) => normalizeJobRecord(job, index)) as JobRecord[] : [];
  } catch {
    return [];
  }
}

function saveLocalJobs(rows: JobRecord[]) {
  window.localStorage.setItem(LOCAL_JOBS_KEY, JSON.stringify(rows));
  saveRows('jobs', rows);
}

function formFromJob(job: JobRecord): JobFormState {
  const knownVisas = job.visaRestrictions.filter(visa => visaOptions.includes(visa));
  const otherVisa = job.visaRestrictions.find(visa => !visaOptions.includes(visa)) ?? '';

  return {
    jobTitle: job.jobTitle,
    externalJobId: job.externalJobId ?? '',
    clientId: job.clientId ?? '',
    clientName: job.clientName,
    spocName: job.spocName,
    clientType: job.clientType,
    location: job.location,
    workMode: job.workMode,
    employmentType: job.employmentType,
    duration: job.duration,
    payRate: job.payRate,
    billRate: job.billRate,
    visaRestrictions: knownVisas.length ? knownVisas : ['Other'],
    otherVisa,
    experienceRequired: job.experienceRequired,
    mandatorySkills: job.mandatorySkills,
    preferredSkills: job.preferredSkills,
    certifications: job.certifications,
    educationRequirement: job.educationRequirement,
    jobDescription: job.jobDescription,
    submissionDeadline: job.submissionDeadline,
    priorityLevel: job.priorityLevel,
    assignedRecruiter: job.assignedRecruiter,
    jobStatus: job.jobStatus,
    openings: job.openings,
    jdFile: job.jdFile ?? '',
    jdAttachment: job.jdAttachment,
    notes: job.notes.join('\n'),
  };
}

function jobFromForm(form: JobFormState, id: string, previous?: JobRecord): JobRecord {
  const visas = form.visaRestrictions.includes('Other') && form.otherVisa.trim()
    ? [...form.visaRestrictions.filter(visa => visa !== 'Other'), form.otherVisa.trim()]
    : form.visaRestrictions;

  return {
    id,
    externalJobId: form.externalJobId?.trim() || undefined,
    jobTitle: form.jobTitle.trim(),
    clientId: form.clientId || previous?.clientId,
    clientName: form.clientName.trim(),
    spocName: form.spocName.trim(),
    clientType: form.clientType,
    location: form.location.trim(),
    workMode: form.workMode,
    employmentType: form.employmentType,
    duration: form.duration,
    payRate: form.payRate,
    billRate: form.billRate,
    visaRestrictions: visas.length ? visas : ['Any visa'],
    experienceRequired: form.experienceRequired,
    mandatorySkills: form.mandatorySkills,
    preferredSkills: form.preferredSkills,
    certifications: form.certifications,
    educationRequirement: form.educationRequirement,
    jobDescription: form.jobDescription,
    submissionDeadline: form.submissionDeadline,
    priorityLevel: form.priorityLevel,
    assignedRecruiter: form.assignedRecruiter,
    jobStatus: form.jobStatus,
    openings: Number(form.openings) || 1,
    submissions: previous?.submissions ?? 0,
    jdFile: form.jdAttachment?.fileName || form.jdFile || previous?.jdFile,
    jdAttachment: form.jdAttachment ?? previous?.jdAttachment,
    aiSearchKeywords: buildKeywords(form.mandatorySkills, form.preferredSkills, form.jobTitle),
    linkedInBoolean: buildBoolean(form.mandatorySkills, form.jobTitle, 'linkedin'),
    boardBoolean: buildBoolean(form.mandatorySkills, form.jobTitle, 'boards'),
    notes: form.notes ? form.notes.split('\n').filter(Boolean) : previous?.notes ?? [],
    history: previous?.history ?? [`${form.assignedRecruiter} created job order.`],
  };
}

function splitSkills(value: string) {
  return value.split(',').map(skill => skill.trim()).filter(Boolean);
}

function buildKeywords(mandatorySkills: string, preferredSkills: string, title: string) {
  return [...new Set([...splitSkills(title), ...splitSkills(mandatorySkills), ...splitSkills(preferredSkills)])].slice(0, 12).join(', ');
}

function buildBoolean(skills: string, title: string, channel: 'linkedin' | 'boards') {
  const skillTerms = splitSkills(skills).slice(0, 5).map(skill => `"${skill}"`).join(' AND ');
  const titleTerms = title.split(/[/-]/).map(part => part.trim()).filter(Boolean).slice(0, 2).map(part => `"${part}"`).join(' OR ');
  if (channel === 'linkedin') return `(${titleTerms || `"${title}"`}) AND (${skillTerms || '"recruiting"'})`;
  return `(${titleTerms || `"${title}"`}) AND (${skillTerms || '"candidate"'}) AND (resume OR CV)`;
}

function tatDays(deadline: string) {
  const due = new Date(`${deadline}T00:00:00`);
  if (Number.isNaN(due.getTime())) return 'Date needed';
  const days = Math.ceil((due.getTime() - new Date().setHours(0, 0, 0, 0)) / 86_400_000);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Due today';
  return `${days}d left`;
}

export default function Jobs() {
  const location = useLocation();
  const [jobRows, setJobRows] = useState<JobRecord[]>(loadLocalJobs);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<JobWorkflowStatus | 'All'>('All');
  const [action, setAction] = useState<JobAction>(null);
  const [notice, setNotice] = useState('Jobs module is ready for job-order updates.');
  const [clientOptions, setClientOptions] = useState<Client[]>(loadAllClients);

  useEffect(() => {
    if (location.pathname === '/jobs/new') {
      setAction({ type: 'add' });
    }
  }, [location.pathname]);

  useEffect(() => {
    saveLocalJobs(jobRows);
  }, [jobRows]);

  useEffect(() => {
    function refreshRows(event: Event) {
      const detail = (event as CustomEvent).detail;
      if (!detail || detail.key === LOCAL_JOBS_KEY) {
        setJobRows(loadLocalJobs());
      }
    }
    window.addEventListener(ATS_RECORDS_UPDATED_EVENT, refreshRows);
    return () => window.removeEventListener(ATS_RECORDS_UPDATED_EVENT, refreshRows);
  }, []);

  useEffect(() => {
    const refreshClients = () => setClientOptions(loadAllClients());
    window.addEventListener('storage', refreshClients);
    return () => window.removeEventListener('storage', refreshClients);
  }, []);

  const filtered = useMemo(() => {
    const query = search.toLowerCase();
    return jobRows.filter(job => {
      const matchesSearch = !query ||
        job.jobTitle.toLowerCase().includes(query) ||
        job.clientName.toLowerCase().includes(query) ||
        job.mandatorySkills.toLowerCase().includes(query) ||
        job.location.toLowerCase().includes(query);
      const matchesStatus = statusFilter === 'All' || job.jobStatus === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [jobRows, search, statusFilter]);
  const highPriorityJobs = useMemo(
    () => jobRows
      .filter(job => ['High', 'Critical'].includes(job.priorityLevel) && job.jobStatus === 'Open')
      .sort((first, second) => new Date(first.submissionDeadline).getTime() - new Date(second.submissionDeadline).getTime()),
    [jobRows]
  );

  function record(message: string) {
    setNotice(message);
  }

  function upsertJob(form: JobFormState, existing?: JobRecord) {
    if (existing) {
      const updated = jobFromForm(form, existing.id, existing);
      setJobRows(rows => rows.map(job => job.id === existing.id
        ? { ...updated, history: [`${form.assignedRecruiter} updated job order.`, ...existing.history] }
        : job
      ));
      record(`${form.jobTitle} updated.`);
    } else {
      const next = jobFromForm(form, `j${Date.now()}`);
      setJobRows(rows => [next, ...rows]);
      record(`${next.jobTitle} added.`);
    }
    setAction(null);
  }

  function updateJob(id: string, update: Partial<JobRecord>, message: string) {
    setJobRows(rows => rows.map(job => job.id === id
      ? { ...job, ...update, history: [message, ...job.history] }
      : job
    ));
    record(message);
  }

  function duplicateJob(job: JobRecord) {
    const duplicate = {
      ...job,
      id: `j${Date.now()}`,
      jobTitle: `${job.jobTitle} Copy`,
      jobStatus: 'Open' as JobWorkflowStatus,
      submissions: 0,
      history: [`Duplicated from ${job.jobTitle}.`],
    };
    setJobRows(rows => [duplicate, ...rows]);
    record(`${job.jobTitle} duplicated.`);
  }

  function runParser(job: JobRecord) {
    updateJob(job.id, {
      mandatorySkills: job.mandatorySkills || 'React, TypeScript, REST APIs',
      preferredSkills: job.preferredSkills || 'AWS, PostgreSQL, Agile',
      experienceRequired: job.experienceRequired || '5+ years',
      educationRequirement: job.educationRequirement || 'Bachelor degree or equivalent experience',
    }, `AI JD parser refreshed ${job.jobTitle}.`);
  }

  function extractSkills(job: JobRecord) {
    const keywords = buildKeywords(job.mandatorySkills, job.preferredSkills, job.jobTitle);
    updateJob(job.id, { aiSearchKeywords: keywords }, `AI skill extraction completed for ${job.jobTitle}.`);
  }

  function generateKeywords(job: JobRecord) {
    const aiSearchKeywords = buildKeywords(job.mandatorySkills, job.preferredSkills, `${job.jobTitle}, ${job.clientType}, ${job.workMode}`);
    updateJob(job.id, { aiSearchKeywords }, `AI search keywords generated for ${job.jobTitle}.`);
  }

  function generateLinkedIn(job: JobRecord) {
    updateJob(job.id, { linkedInBoolean: buildBoolean(job.mandatorySkills, job.jobTitle, 'linkedin') }, `LinkedIn Boolean generated for ${job.jobTitle}.`);
  }

  function generateBoards(job: JobRecord) {
    updateJob(job.id, { boardBoolean: buildBoolean(job.mandatorySkills, job.jobTitle, 'boards') }, `Dice/Monster/CareerBuilder Boolean generated for ${job.jobTitle}.`);
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Jobs</h1>
          <p className="text-sm text-slate-500 mt-0.5">{jobRows.length} job orders with AI sourcing tools</p>
        </div>
        <button
          onClick={() => setAction({ type: 'add' })}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
        >
          <Plus size={15} />
          Add Job
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Total Jobs" value={jobRows.length} tone="blue" />
        <Metric label="Open" value={jobRows.filter(job => job.jobStatus === 'Open').length} tone="emerald" />
        <Metric label="Hold" value={jobRows.filter(job => job.jobStatus === 'Hold').length} tone="amber" />
        <Metric label="Filled" value={jobRows.filter(job => job.jobStatus === 'Filled').length} tone="violet" />
        <Metric label="Submissions" value={jobRows.reduce((sum, job) => sum + job.submissions, 0)} tone="cyan" />
      </div>

      <div className="rounded-lg border border-white/5 bg-[#0d1729] p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative max-w-xl flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search job title, client, skills, location..."
              className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-9 pr-4 text-sm text-slate-300 outline-none transition-all placeholder:text-slate-600 focus:border-blue-500/50"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ListFilter size={14} className="text-slate-500" />
            {(['All', ...jobStatuses] as const).map(status => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={cn(
                  'rounded-lg border px-3 py-2 text-xs font-medium transition-all',
                  statusFilter === status
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20'
                )}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-5">
        <div className="space-y-4 min-w-0">
          {filtered.map((job, index) => (
            <motion.div
              key={job.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              className="rounded-lg border border-white/5 bg-[#0d1729] p-5 transition-all hover:border-blue-500/20"
            >
              <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-start 2xl:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold text-white">{job.jobTitle}</h2>
                    <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-medium', statusColors[job.jobStatus])}>{job.jobStatus}</span>
                    <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-medium', priorityColors[job.priorityLevel])}>{job.priorityLevel}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{job.clientName} · {job.clientType}</p>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-500">
                    {job.externalJobId && <span>Job ID {job.externalJobId}</span>}
                    <span className="inline-flex items-center gap-1"><MapPin size={11} />{job.location}</span>
                    <span>{job.workMode}</span>
                    <span>{job.employmentType}</span>
                    <span>{job.duration}</span>
                    <span>Deadline {job.submissionDeadline}</span>
                    <span className={cn('font-semibold', ['High', 'Critical'].includes(job.priorityLevel) ? 'text-amber-300' : 'text-slate-500')}>TAT {tatDays(job.submissionDeadline)}</span>
                    <span>{job.assignedRecruiter}</span>
                    <span>SPOC {job.spocName || 'Not assigned'}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 2xl:w-[420px]">
                  <Mini label="Pay" value={job.payRate} />
                  <Mini label="Bill" value={job.billRate} />
                  <Mini label="Exp." value={job.experienceRequired} />
                  <Mini label="Openings" value={String(job.openings)} />
                </div>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                <Info label="Visa restrictions" value={job.visaRestrictions.join(', ')} />
                <Info label="Mandatory skills" value={job.mandatorySkills} />
                <Info label="Preferred skills" value={job.preferredSkills} />
                <Info label="Certifications" value={job.certifications} />
                <Info label="Education" value={job.educationRequirement} />
                <Info label="JD upload" value={job.jdFile ?? 'No JD uploaded'} />
              </div>

              <div className="mt-4 rounded-lg border border-white/5 bg-white/[0.03] p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Job Description</p>
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-400">{job.jobDescription}</p>
              </div>

              <div className="mt-4 grid gap-3 xl:grid-cols-3">
                <Output label="AI search keywords" value={job.aiSearchKeywords} />
                <Output label="LinkedIn Boolean" value={job.linkedInBoolean} />
                <Output label="Dice / Monster / CareerBuilder Boolean" value={job.boardBoolean} />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <ActionButton label="Edit" icon={<Pencil size={13} />} onClick={() => setAction({ type: 'edit', job })} />
                <ActionButton label="JD Upload" icon={<FileUp size={13} />} onClick={() => setAction({ type: 'upload', job })} />
                <ActionButton label="AI JD Parser" icon={<Bot size={13} />} onClick={() => setAction({ type: 'parser', job })} />
                <ActionButton label="AI Skill Extraction" icon={<Wand2 size={13} />} onClick={() => setAction({ type: 'skills', job })} />
                <ActionButton label="AI Search Keywords" icon={<Sparkles size={13} />} onClick={() => setAction({ type: 'keywords', job })} />
                <ActionButton label="LinkedIn Boolean" icon={<FileText size={13} />} onClick={() => setAction({ type: 'linkedin', job })} />
                <ActionButton label="Dice/Monster/CareerBuilder Boolean" icon={<Search size={13} />} onClick={() => setAction({ type: 'boards', job })} />
                <ActionButton label="Duplicate Job" icon={<ClipboardCopy size={13} />} onClick={() => duplicateJob(job)} />
                <ActionButton label="Notes / History" icon={<History size={13} />} onClick={() => setAction({ type: 'notes', job })} />
              </div>
            </motion.div>
          ))}
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border border-white/5 bg-[#0d1729] p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Quick action status</p>
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-3">
              <p className="text-sm text-blue-100">{notice}</p>
            </div>
          </div>
          <div className="rounded-lg border border-white/5 bg-[#0d1729] p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Required Coverage</p>
            <div className="mb-4 space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-300">High Priority TAT</p>
              {highPriorityJobs.length ? highPriorityJobs.map(job => (
                <div key={job.id} className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
                  <p className="text-xs font-semibold text-amber-50">{job.jobTitle}</p>
                  <p className="mt-1 text-[11px] text-amber-100/70">{job.clientName} · Submit by {job.submissionDeadline}</p>
                  <p className="mt-1 text-[11px] font-semibold text-amber-200">TAT: {tatDays(job.submissionDeadline)}</p>
                </div>
              )) : (
                <p className="text-xs text-slate-600">No open high priority jobs.</p>
              )}
            </div>
            <div className="space-y-2 text-xs text-slate-400">
              {['High priority TAT/date coverage', 'Full job fields', 'All visa options + Other', 'JD upload', 'AI parser', 'AI skill extraction', 'Boolean generators', 'Duplicate jobs', 'Notes/history'].map(item => (
                <div key={item} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {action?.type === 'add' && (
        <JobFormPanel title="Add Job" initial={emptyJobForm} submitLabel="Add Job" onClose={() => setAction(null)} onSubmit={form => upsertJob(form)} clients={clientOptions} />
      )}
      {action?.type === 'edit' && (
        <JobFormPanel title={`Edit ${action.job.jobTitle}`} initial={formFromJob(action.job)} submitLabel="Update Job" onClose={() => setAction(null)} onSubmit={form => upsertJob(form, action.job)} clients={clientOptions} />
      )}
      {action?.type === 'upload' && (
        <UploadPanel job={action.job} onClose={() => setAction(null)} onSubmit={file => {
          updateJob(action.job.id, { jdFile: file.fileName, jdAttachment: file }, `${file.fileName} uploaded for ${action.job.jobTitle}.`);
          setAction(null);
        }} />
      )}
      {action?.type === 'parser' && (
        <GeneratorPanel title="AI JD Parser" job={action.job} value={action.job.jobDescription} buttonLabel="Run Parser" onClose={() => setAction(null)} onSubmit={() => { runParser(action.job); setAction(null); }} />
      )}
      {action?.type === 'skills' && (
        <GeneratorPanel title="AI Skill Extraction" job={action.job} value={action.job.mandatorySkills} buttonLabel="Extract Skills" onClose={() => setAction(null)} onSubmit={() => { extractSkills(action.job); setAction(null); }} />
      )}
      {action?.type === 'keywords' && (
        <GeneratorPanel title="AI Search Keywords Generator" job={action.job} value={action.job.aiSearchKeywords} buttonLabel="Generate Keywords" onClose={() => setAction(null)} onSubmit={() => { generateKeywords(action.job); setAction(null); }} />
      )}
      {action?.type === 'linkedin' && (
        <GeneratorPanel title="LinkedIn Boolean Generator" job={action.job} value={action.job.linkedInBoolean} buttonLabel="Generate LinkedIn Boolean" onClose={() => setAction(null)} onSubmit={() => { generateLinkedIn(action.job); setAction(null); }} />
      )}
      {action?.type === 'boards' && (
        <GeneratorPanel title="Dice / Monster / CareerBuilder Boolean Generator" job={action.job} value={action.job.boardBoolean} buttonLabel="Generate Board Boolean" onClose={() => setAction(null)} onSubmit={() => { generateBoards(action.job); setAction(null); }} />
      )}
      {action?.type === 'notes' && (
        <NotesPanel job={action.job} onClose={() => setAction(null)} onSubmit={note => {
          updateJob(action.job.id, { notes: [note, ...action.job.notes] }, `Note added to ${action.job.jobTitle}.`);
          setAction(null);
        }} />
      )}
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: 'blue' | 'emerald' | 'amber' | 'violet' | 'cyan' }) {
  const tones = {
    blue: 'text-blue-300 bg-blue-500/15',
    emerald: 'text-emerald-300 bg-emerald-500/15',
    amber: 'text-amber-300 bg-amber-500/15',
    violet: 'text-violet-300 bg-violet-500/15',
    cyan: 'text-cyan-300 bg-cyan-500/15',
  };
  return (
    <div className="rounded-lg border border-white/5 bg-[#0d1729] p-4">
      <div className={cn('mb-3 flex h-9 w-9 items-center justify-center rounded-lg', tones[tone])}>
        <BriefcaseBusiness size={16} />
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.03] p-3">
      <p className="text-[10px] uppercase tracking-wider text-slate-600">{label}</p>
      <p className="mt-1 truncate text-xs font-semibold text-white">{value}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-slate-600">{label}</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-300">{value || 'Not specified'}</p>
    </div>
  );
}

function Output({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-[#070d18] p-3">
      <p className="text-[10px] uppercase tracking-wider text-slate-600">{label}</p>
      <p className="mt-2 line-clamp-3 font-mono text-[11px] leading-relaxed text-slate-300">{value}</p>
    </div>
  );
}

function ActionButton({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      title={label}
      aria-label={label}
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
    >
      {icon}
      <span className="sr-only">{label}</span>
    </button>
  );
}

function Panel({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, x: 32 }} animate={{ opacity: 1, x: 0 }} className="h-full w-full max-w-3xl overflow-y-auto border-l border-white/10 bg-[#08111f] shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#08111f]/95 px-6 py-4 backdrop-blur">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button aria-label="Close" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white">
            <X size={16} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </motion.div>
    </div>
  );
}

function JobFormPanel({
  title,
  initial,
  submitLabel,
  onClose,
  onSubmit,
  clients,
}: {
  title: string;
  initial: JobFormState;
  submitLabel: string;
  onClose: () => void;
  onSubmit: (form: JobFormState) => void;
  clients: Client[];
}) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const hasOtherVisa = form.visaRestrictions.includes('Other');
  const selectedClient = clients.find(client => client.id === form.clientId);

  function update<K extends keyof JobFormState>(key: K, value: JobFormState[K]) {
    setForm(previous => ({ ...previous, [key]: value }));
  }

  function toggleVisa(visa: string) {
    setForm(previous => {
      const exists = previous.visaRestrictions.includes(visa);
      const next = exists
        ? previous.visaRestrictions.filter(item => item !== visa)
        : [...previous.visaRestrictions.filter(item => item !== 'Any visa'), visa];
      return { ...previous, visaRestrictions: visa === 'Any visa' ? ['Any visa'] : next };
    });
  }

  function selectClient(clientId: string) {
    const client = clients.find(item => item.id === clientId);
    if (!client) {
      setForm(previous => ({ ...previous, clientId: '', clientName: '' }));
      return;
    }

    setForm(previous => ({
      ...previous,
      clientId: client.id,
      clientName: client.name,
      clientType: toJobClientType(client.clientType),
      visaRestrictions: client.visaRestrictions && client.visaRestrictions !== 'Not specified'
        ? [client.visaRestrictions]
        : previous.visaRestrictions,
      notes: previous.notes || `Client terms: ${client.paymentTerms}. Submission rules: ${client.submissionRules}.`,
    }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form.jobTitle.trim() || !form.clientName.trim() || !form.jobDescription.trim()) {
      setError('Job title, client name, and job description are required.');
      return;
    }
    onSubmit(form);
  }

  return (
    <Panel title={title} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Job title" value={form.jobTitle} onChange={value => update('jobTitle', value)} />
          <Field label="Job ID (optional)" value={form.externalJobId ?? ''} placeholder="Client/internal job ID" onChange={value => update('externalJobId', value)} />
          <SelectField
            label="Client name"
            value={form.clientId || form.clientName}
            options={[
              { label: clients.length ? 'Select client from CRM' : 'No CRM clients yet - add a client first', value: '' },
              ...clients.map(client => ({ label: `${client.name} - ${client.clientType}`, value: client.id })),
            ]}
            onChange={selectClient}
          />
          <SelectField label="Client type" value={form.clientType} options={clientTypes} onChange={value => update('clientType', value as ClientType)} />
          <Field label="SPOC Name" value={form.spocName} placeholder="Client/interviewer SPOC name" onChange={value => update('spocName', value)} />
          <Field label="Job location" value={form.location} placeholder="Manual job work location, not client CRM office" onChange={value => update('location', value)} />
          <SelectField label="Remote / Hybrid / Onsite" value={form.workMode} options={workModes} onChange={value => update('workMode', value as WorkMode)} />
          <SelectField label="Employment type" value={form.employmentType} options={employmentTypes} onChange={value => update('employmentType', value as EmploymentType)} />
          <Field label="Duration" value={form.duration} onChange={value => update('duration', value)} />
          <Field label="Pay rate" value={form.payRate} onChange={value => update('payRate', value)} />
          <Field label="Bill rate" value={form.billRate} onChange={value => update('billRate', value)} />
          <Field label="Experience required" value={form.experienceRequired} onChange={value => update('experienceRequired', value)} />
          <Field label="Mandatory skills" value={form.mandatorySkills} onChange={value => update('mandatorySkills', value)} />
          <Field label="Preferred skills" value={form.preferredSkills} onChange={value => update('preferredSkills', value)} />
          <Field label="Certifications" value={form.certifications} onChange={value => update('certifications', value)} />
          <Field label="Education requirement" value={form.educationRequirement} onChange={value => update('educationRequirement', value)} />
          <Field label="Submission deadline" type="date" value={form.submissionDeadline} onChange={value => update('submissionDeadline', value)} />
          <SelectField label="Priority level" value={form.priorityLevel} options={priorities} onChange={value => update('priorityLevel', value as Priority)} />
          <SelectField label="Assigned recruiter" value={form.assignedRecruiter} options={recruiters} onChange={value => update('assignedRecruiter', value)} />
          <SelectField label="Job status" value={form.jobStatus} options={jobStatuses} onChange={value => update('jobStatus', value as JobWorkflowStatus)} />
          <Field label="Openings" value={String(form.openings)} onChange={value => update('openings', Number(value) || 1)} />
          <FileUploadField
            label="JD attachment"
            attachment={form.jdAttachment}
            fallbackFileName={form.jdFile}
            onFile={file => update('jdAttachment', attachmentFromFile(file))}
            onManualName={value => update('jdFile', value)}
          />
        </div>

        {selectedClient && (
          <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-300">Client CRM details connected</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Info label="Contact" value={`${selectedClient.contact} · ${selectedClient.contactEmail}`} />
              <Info label="Payment terms" value={selectedClient.paymentTerms} />
              <Info label="Submission rules" value={selectedClient.submissionRules} />
              <Info label="Visa restrictions" value={selectedClient.visaRestrictions} />
            </div>
          </div>
        )}

        <div>
          <p className="mb-2 text-xs font-medium text-slate-400">Visa restrictions</p>
          <div className="flex flex-wrap gap-2">
            {visaOptions.map(visa => (
              <button
                key={visa}
                type="button"
                onClick={() => toggleVisa(visa)}
                className={cn(
                  'rounded-lg border px-3 py-2 text-xs transition-colors',
                  form.visaRestrictions.includes(visa)
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10'
                )}
              >
                {visa}
              </button>
            ))}
          </div>
          {hasOtherVisa && (
            <div className="mt-3">
              <Field label="Other visa option" value={form.otherVisa} onChange={value => update('otherVisa', value)} />
            </div>
          )}
        </div>

        <TextAreaField label="Job description" value={form.jobDescription} onChange={value => update('jobDescription', value)} rows={6} />
        <TextAreaField label="Job notes" value={form.notes} onChange={value => update('notes', value)} rows={3} />
        {error && <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={onClose} className="rounded-lg bg-white/5 px-4 py-3 text-center text-sm text-slate-300 hover:bg-white/10">Cancel</button>
          <button type="submit" className="rounded-lg bg-blue-600 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-blue-500">{submitLabel}</button>
        </div>
      </form>
    </Panel>
  );
}

function UploadPanel({ job, onClose, onSubmit }: { job: JobRecord; onClose: () => void; onSubmit: (file: JobAttachment) => void }) {
  const [fileName, setFileName] = useState(job.jdFile ?? `${job.jobTitle.replace(/[^\w]+/g, '_')}_JD.pdf`);
  const [attachment, setAttachment] = useState<JobAttachment | undefined>(job.jdAttachment);
  return (
    <Panel title={`JD Upload: ${job.jobTitle}`} onClose={onClose}>
      <div className="space-y-5">
        <div className="rounded-lg border border-dashed border-white/15 bg-white/[0.03] p-8 text-center">
          <Upload size={28} className="mx-auto mb-3 text-blue-300" />
          <p className="text-sm font-medium text-white">{attachment?.fileName ?? fileName}</p>
          <p className="mt-1 text-xs text-slate-500">Outlook email, Word, PDF, image, text, ZIP, or other JD attachment</p>
        </div>
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-white/10">
          <FileUp size={15} />
          Select JD Attachment
          <input
            type="file"
            accept={jdAcceptTypes}
            className="hidden"
            onChange={event => {
              const file = event.target.files?.[0];
              if (!file) return;
              const next = attachmentFromFile(file);
              setAttachment(next);
              setFileName(next.fileName);
              event.target.value = '';
            }}
          />
        </label>
        <Field label="JD file name" value={fileName} onChange={setFileName} />
        <button
          onClick={() => onSubmit(attachment ?? { fileName, fileType: 'manual-entry', fileSize: 0, uploadedAt: new Date().toISOString() })}
          className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500"
        >
          Upload JD
        </button>
      </div>
    </Panel>
  );
}

function GeneratorPanel({ title, job, value, buttonLabel, onClose, onSubmit }: { title: string; job: JobRecord; value: string; buttonLabel: string; onClose: () => void; onSubmit: () => void }) {
  return (
    <Panel title={`${title}: ${job.jobTitle}`} onClose={onClose}>
      <div className="space-y-5">
        <div className="rounded-lg border border-white/10 bg-[#070d18] p-4">
          <p className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-slate-300">{value || 'No generated output yet.'}</p>
        </div>
        <button onClick={onSubmit} className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500">
          <Sparkles size={15} />
          {buttonLabel}
        </button>
      </div>
    </Panel>
  );
}

function NotesPanel({ job, onClose, onSubmit }: { job: JobRecord; onClose: () => void; onSubmit: (note: string) => void }) {
  const [note, setNote] = useState('');
  return (
    <Panel title={`Job Notes / History: ${job.jobTitle}`} onClose={onClose}>
      <div className="space-y-5">
        <TextAreaField label="Add note" value={note} onChange={setNote} rows={3} />
        <button disabled={!note.trim()} onClick={() => onSubmit(note)} className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">
          <MessageSquarePlus size={15} />
          Add Note
        </button>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Notes</p>
            <div className="space-y-2">
              {job.notes.map(item => <p key={item} className="rounded-lg border border-white/5 bg-white/[0.03] p-3 text-xs text-slate-400">{item}</p>)}
            </div>
          </div>
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">History</p>
            <div className="space-y-2">
              {job.history.map(item => <p key={item} className="rounded-lg border border-white/5 bg-white/[0.03] p-3 text-xs text-slate-400">{item}</p>)}
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function FileUploadField({
  label,
  attachment,
  fallbackFileName,
  onFile,
  onManualName,
}: {
  label: string;
  attachment?: JobAttachment;
  fallbackFileName?: string;
  onFile: (file: File) => void;
  onManualName: (value: string) => void;
}) {
  const shownName = attachment?.fileName ?? fallbackFileName ?? '';

  return (
    <div className="sm:col-span-2 rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400">{label}</p>
          <p className="mt-1 text-sm font-semibold text-white">{shownName || 'No JD attachment selected'}</p>
          {attachment && (
            <p className="mt-1 text-xs text-slate-500">{attachment.fileType || 'Unknown type'} · {formatFileSize(attachment.fileSize)}</p>
          )}
        </div>
        <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10">
          <FileUp size={14} />
          Upload JD
          <input
            type="file"
            accept={jdAcceptTypes}
            className="hidden"
            onChange={event => {
              const file = event.target.files?.[0];
              if (!file) return;
              onFile(file);
              event.target.value = '';
            }}
          />
        </label>
      </div>
      <Field label="JD file name / email subject" value={shownName} placeholder="JD email, Word, PDF, image, or other file" onChange={onManualName} />
      <p className="mt-2 text-[11px] text-slate-500">Supported for local testing: Outlook email (.eml/.msg), Word, PDF, images, text, ZIP, and other JD files.</p>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-400">{label}</span>
      <input type={type} value={value} placeholder={placeholder} onChange={event => onChange(event.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition-all focus:border-blue-500/60" />
    </label>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: Array<string | { label: string; value: string }>; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-400">{label}</span>
      <select value={value} onChange={event => onChange(event.target.value)} className="w-full rounded-lg border border-white/10 bg-[#111b2d] px-3 py-2.5 text-sm text-white outline-none transition-all focus:border-blue-500/60">
        {options.map(option => {
          const normalized = typeof option === 'string' ? { label: option, value: option } : option;
          return <option key={normalized.value} value={normalized.value}>{normalized.label}</option>;
        })}
      </select>
    </label>
  );
}

function TextAreaField({ label, value, onChange, rows }: { label: string; value: string; onChange: (value: string) => void; rows: number }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-400">{label}</span>
      <textarea value={value} onChange={event => onChange(event.target.value)} rows={rows} className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none transition-all focus:border-blue-500/60" />
    </label>
  );
}
