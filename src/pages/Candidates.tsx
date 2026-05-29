import { FormEvent, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Archive, BriefcaseBusiness, CalendarClock, CheckCircle2, ChevronRight, ClipboardList,
  FileText, FileUp, Filter, Mail, MessageSquarePlus, MoreHorizontal, Pencil, Phone, Plus,
  Search, Send, ShieldCheck, Sparkles, Target, Trash2, Upload, UserRound, X,
} from 'lucide-react';
import { getAllJobs, getAllSubmissions } from '@/lib/localRecords';
import { ATS_RECORDS_UPDATED_EVENT, LOCAL_CANDIDATES_KEY, normalizeCandidateRecord } from '@/lib/atsLocalStore';
import { saveRows, sendEmailRecord, uploadBackendFile } from '@/lib/atsApi';
import { currentOwnerName, getAtsOwnerNames, resolveSession } from '@/lib/auth';
import { formatCallDuration, openCandidateDialer, saveCandidateCallLog, type CallOutcome } from '@/lib/callLogs';
import { currentCallingSettings } from '@/lib/callingSettings';
import { currentEmailSettings, emailSignatureText } from '@/lib/emailSettings';
import { createCandidateJobSubmission, duplicateSubmissionMessage, findCandidateJobSubmission } from '@/lib/submissionStore';
import type { Candidate, CandidateStatus, EmailRecord } from '@/lib/types';
import { cn } from '@/lib/utils';

type CandidateRecord = Candidate & {
  currentCompany: string;
  usExperience: number;
  relevantExperience: number;
  workAuthorization: string;
  visaStatus: string;
  currentRate: string;
  expectedRate: string;
  relocationPreference: string;
  passportNumber: string;
  owner: string;
  notes: string[];
  resumeFile: string;
  resumeAttachment?: FileAttachment;
  supportingDocuments: string[];
  supportingDocumentAttachments?: FileAttachment[];
  parsedResumeDetails: string;
  education: string;
  certifications: string;
  documentChecklist: string[];
  aiMatchScore: number;
  matchedJobTitle: string;
  archived?: boolean;
  createdBy?: string;
  createdByUserId?: string;
  createdByEmail?: string;
  updatedBy?: string;
  updatedByUserId?: string;
  updatedByEmail?: string;
};

type FileAttachment = {
  id?: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
  storageProvider?: string;
  storagePath?: string;
  relativePath?: string;
  downloadUrl?: string;
  uploadedBy?: string;
};

type CandidateFormState = {
  fullName: string;
  email: string;
  phone: string;
  title: string;
  currentCompany: string;
  linkedinUrl: string;
  location: string;
  skills: string;
  experience: string;
  usExperience: string;
  relevantExperience: string;
  workAuthorization: string;
  visaStatus: string;
  currentRate: string;
  expectedRate: string;
  relocationPreference: string;
  passportNumber: string;
  availability: string;
  source: string;
  owner: string;
  status: CandidateStatus;
  parsedResumeDetails: string;
  education: string;
  certifications: string;
  documentChecklist: string;
  resumeFile: string;
  includeSupportingDocuments: boolean;
  supportingDocuments: string;
  notes: string;
};

type ActionMode =
  | { type: 'add' }
  | { type: 'edit'; candidate: CandidateRecord }
  | { type: 'status'; candidate: CandidateRecord }
  | { type: 'submit'; candidate: CandidateRecord }
  | { type: 'interview'; candidate: CandidateRecord }
  | { type: 'task'; candidate: CandidateRecord }
  | { type: 'call'; candidate: CandidateRecord }
  | { type: 'upload'; candidate: CandidateRecord }
  | { type: 'parse'; candidate: CandidateRecord }
  | { type: 'match'; candidate: CandidateRecord }
  | { type: 'note'; candidate: CandidateRecord }
  | { type: 'connect'; candidate: CandidateRecord }
  | { type: 'archive'; candidate: CandidateRecord }
  | { type: 'delete'; candidate: CandidateRecord }
  | null;

const statusColors: Record<CandidateStatus, string> = {
  New: 'bg-blue-500/20 text-blue-300 border-blue-500/20',
  Screening: 'bg-violet-500/20 text-violet-300 border-violet-500/20',
  Interview: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/20',
  Offer: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/20',
  Placed: 'bg-amber-500/20 text-amber-300 border-amber-500/20',
  Rejected: 'bg-red-500/20 text-red-300 border-red-500/20',
  'On Hold': 'bg-slate-500/20 text-slate-300 border-slate-500/20',
};

const allStatuses: CandidateStatus[] = ['New', 'Screening', 'Interview', 'Offer', 'Placed', 'Rejected', 'On Hold'];
const pipelineOrder: CandidateStatus[] = ['New', 'Screening', 'Interview', 'Offer', 'Placed'];
const sources = ['LinkedIn', 'Referral', 'Indeed', 'Job Board', 'Website', 'Upload', 'Direct Sourcing'];
const workAuthorizationOptions = ['US Citizen', 'USC', 'Green Card', 'H-1B', 'H4-EAD', 'OPT', 'CPT', 'GC-EAD', 'L2S', 'L-2 EAD', 'EAD', 'TN Visa', 'Other'];
const supportingDocumentOptions = ['Visa copy', 'DL copy', 'ID proof', 'Passport copy', 'EAD card', 'I-94', 'Education certificate', 'Certification'];
const candidateDocumentAcceptTypes = '.pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.heic,.txt,.rtf,.zip,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*';
const CANDIDATE_PAGE_SIZE = 100;

function isCitizenAuthorization(value: string) {
  return ['us citizen', 'usc'].includes(value.trim().toLowerCase());
}

function attachmentFromFile(file: File, stored?: Partial<FileAttachment>): FileAttachment {
  return {
    ...stored,
    fileName: file.name,
    fileType: file.type || 'application/octet-stream',
    fileSize: file.size,
    uploadedAt: stored?.uploadedAt || new Date().toISOString(),
  };
}

function formatFileSize(size: number) {
  if (!size) return 'Saved attachment';
  if (size < 1024) return `${size} B`;
  if (size < 1_048_576) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1_048_576).toFixed(1)} MB`;
}

type BooleanToken = {
  type: 'term' | 'operator' | 'open' | 'close';
  value: string;
};

function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9+#.\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function candidateSearchText(candidate: CandidateRecord) {
  return normalizeSearchText([
    candidate.name,
    candidate.title,
    candidate.currentCompany,
    candidate.location,
    candidate.email,
    candidate.phone,
    candidate.skills.join(' '),
    candidate.workAuthorization,
    candidate.visaStatus,
    candidate.currentRate,
    candidate.expectedRate,
    candidate.availability,
    candidate.source,
    candidate.owner,
    candidate.resumeFile,
    candidate.parsedResumeDetails,
    candidate.education,
    candidate.certifications,
    candidate.documentChecklist.join(' '),
    candidate.supportingDocuments.join(' '),
    candidate.notes.join(' '),
    candidate.matchedJobTitle,
  ].join(' '));
}

function tokenizeBooleanSearch(query: string): BooleanToken[] {
  const matches = query.match(/"[^"]+"|'[^']+'|\(|\)|\bAND\b|\bOR\b|\bNOT\b|[^\s()]+/gi) ?? [];
  const rawTokens = matches.map(match => {
    const upper = match.toUpperCase();
    if (upper === 'AND' || upper === 'OR' || upper === 'NOT') return { type: 'operator' as const, value: upper };
    if (match === '(') return { type: 'open' as const, value: match };
    if (match === ')') return { type: 'close' as const, value: match };
    return { type: 'term' as const, value: normalizeSearchText(match.replace(/^["']|["']$/g, '')) };
  }).filter(token => token.type !== 'term' || token.value);

  return rawTokens.reduce<BooleanToken[]>((tokens, token) => {
    const previous = tokens[tokens.length - 1];
    const needsImplicitAnd = previous &&
      (previous.type === 'term' || previous.type === 'close') &&
      (token.type === 'term' || token.type === 'open' || token.value === 'NOT');
    if (needsImplicitAnd) tokens.push({ type: 'operator', value: 'AND' });
    tokens.push(token);
    return tokens;
  }, []);
}

function booleanSearchMatches(text: string, query: string) {
  const tokens = tokenizeBooleanSearch(query);
  if (!tokens.length) return true;
  const precedence: Record<string, number> = { OR: 1, AND: 2, NOT: 3 };
  const output: BooleanToken[] = [];
  const operators: BooleanToken[] = [];

  tokens.forEach(token => {
    if (token.type === 'term') {
      output.push(token);
      return;
    }
    if (token.type === 'open') {
      operators.push(token);
      return;
    }
    if (token.type === 'close') {
      while (operators.length && operators[operators.length - 1].type !== 'open') {
        output.push(operators.pop() as BooleanToken);
      }
      operators.pop();
      return;
    }
    while (
      operators.length &&
      operators[operators.length - 1].type === 'operator' &&
      precedence[operators[operators.length - 1].value] >= precedence[token.value]
    ) {
      output.push(operators.pop() as BooleanToken);
    }
    operators.push(token);
  });

  while (operators.length) output.push(operators.pop() as BooleanToken);

  const stack: boolean[] = [];
  output.forEach(token => {
    if (token.type === 'term') {
      stack.push(text.includes(token.value));
      return;
    }
    if (token.value === 'NOT') {
      stack.push(!(stack.pop() ?? false));
      return;
    }
    const right = Boolean(stack.pop());
    const left = Boolean(stack.pop());
    stack.push(token.value === 'AND' ? left && right : left || right);
  });

  return stack.length ? Boolean(stack.pop()) : true;
}

function listSearchMatches(values: string[], query: string) {
  const terms = query.split(/[,\n]+/).map(term => normalizeSearchText(term)).filter(Boolean);
  if (!terms.length) return true;
  const text = normalizeSearchText(values.join(' '));
  return terms.every(term => text.includes(term));
}

function loadLocalCandidates() {
  try {
    const raw = window.localStorage.getItem(LOCAL_CANDIDATES_KEY);
    if (!raw) return [];
    const saved = JSON.parse(raw);
    return Array.isArray(saved) ? saved.map((candidate, index) => normalizeCandidateRecord(candidate, index)) as CandidateRecord[] : [];
  } catch {
    return [];
  }
}

function saveLocalCandidates(rows: CandidateRecord[]) {
  window.localStorage.setItem(LOCAL_CANDIDATES_KEY, JSON.stringify(rows));
  saveRows('candidates', rows);
}

const emptyForm: CandidateFormState = {
  fullName: '',
  email: '',
  phone: '',
  title: '',
  currentCompany: '',
  linkedinUrl: '',
  location: '',
  skills: '',
  experience: '',
  usExperience: '',
  relevantExperience: '',
  workAuthorization: 'US Citizen',
  visaStatus: 'No sponsorship needed',
  currentRate: '',
  expectedRate: '',
  relocationPreference: 'Open to relocate',
  passportNumber: '',
  availability: 'Immediately',
  source: 'LinkedIn',
  owner: 'SuperUser',
  status: 'New',
  parsedResumeDetails: '',
  education: '',
  certifications: '',
  documentChecklist: 'Resume, Work authorization',
  resumeFile: '',
  includeSupportingDocuments: false,
  supportingDocuments: '',
  notes: '',
};

function formFromCandidate(candidate: CandidateRecord): CandidateFormState {
  return {
    fullName: candidate.name,
    email: candidate.email,
    phone: candidate.phone,
    title: candidate.title,
    currentCompany: candidate.currentCompany,
    linkedinUrl: candidate.linkedin ?? '',
    location: candidate.location,
    skills: candidate.skills.join(', '),
    experience: String(candidate.experience),
    usExperience: String(candidate.usExperience),
    relevantExperience: String(candidate.relevantExperience),
    workAuthorization: candidate.workAuthorization,
    visaStatus: candidate.visaStatus,
    currentRate: candidate.currentRate,
    expectedRate: candidate.expectedRate,
    relocationPreference: candidate.relocationPreference,
    passportNumber: candidate.passportNumber,
    availability: candidate.availability,
    source: candidate.source,
    owner: candidate.owner,
    status: candidate.status,
    parsedResumeDetails: candidate.parsedResumeDetails,
    education: candidate.education,
    certifications: candidate.certifications,
    documentChecklist: candidate.documentChecklist.join(', '),
    resumeFile: candidate.resumeFile,
    includeSupportingDocuments: candidate.supportingDocuments.length > 0,
    supportingDocuments: candidate.supportingDocuments.join(', '),
    notes: candidate.notes.join('\n'),
  };
}

function candidateFromForm(form: CandidateFormState, id: string): CandidateRecord {
  const now = new Date().toISOString().slice(0, 10);
  const skills = form.skills.split(',').map(skill => skill.trim()).filter(Boolean);
  const session = resolveSession();

  return {
    id,
    name: form.fullName.trim(),
    email: form.email.trim(),
    phone: form.phone.trim(),
    title: form.title.trim(),
    currentCompany: form.currentCompany.trim(),
    linkedin: form.linkedinUrl.trim(),
    location: form.location.trim(),
    status: form.status,
    skills,
    experience: Number(form.experience) || 0,
    usExperience: Number(form.usExperience) || 0,
    relevantExperience: Number(form.relevantExperience) || Number(form.experience) || 0,
    workAuthorization: form.workAuthorization,
    visaStatus: form.visaStatus,
    currentRate: form.currentRate,
    expectedRate: form.expectedRate,
    relocationPreference: form.relocationPreference,
    passportNumber: isCitizenAuthorization(form.workAuthorization) ? '' : form.passportNumber.trim(),
    salary: form.expectedRate || form.currentRate || 'Open',
    availability: form.availability,
    source: form.source,
    recruiter: form.owner,
    owner: form.owner,
    createdBy: session?.name ?? form.owner,
    createdByUserId: session?.id,
    createdByEmail: session?.email,
    updatedBy: session?.name ?? form.owner,
    updatedByUserId: session?.id,
    updatedByEmail: session?.email,
    createdAt: now,
    updatedAt: now,
    summary: form.notes || `${form.fullName} is ready for recruiter review.`,
    notes: form.notes ? form.notes.split('\n').filter(Boolean) : [],
    parsedResumeDetails: form.parsedResumeDetails || `Parsed profile for ${form.fullName}: ${skills.slice(0, 4).join(', ')}.`,
    education: form.education,
    certifications: form.certifications,
    documentChecklist: form.documentChecklist.split(',').map(item => item.trim()).filter(Boolean),
    resumeFile: form.resumeFile.trim(),
    resumeAttachment: form.resumeFile.trim()
      ? {
          fileName: form.resumeFile.trim(),
          fileType: 'manual-entry',
          fileSize: 0,
          uploadedAt: new Date().toISOString(),
        }
      : undefined,
    supportingDocuments: form.includeSupportingDocuments
      ? form.supportingDocuments.split(',').map(item => item.trim()).filter(Boolean)
      : [],
    supportingDocumentAttachments: form.includeSupportingDocuments
      ? form.supportingDocuments.split(',').map(item => item.trim()).filter(Boolean).map(fileName => ({
          fileName,
          fileType: 'manual-entry',
          fileSize: 0,
          uploadedAt: new Date().toISOString(),
        }))
      : [],
    aiMatchScore: 82,
    matchedJobTitle: getAllJobs()[0]?.title ?? 'Open role',
    rating: 4,
    archived: false,
  };
}

export default function Candidates() {
  const navigate = useNavigate();
  const location = useLocation();
  const didHydrateCandidates = useRef(false);
  const [candidateRows, setCandidateRows] = useState<CandidateRecord[]>(loadLocalCandidates);
  const [search, setSearch] = useState('');
  const [skillSearch, setSkillSearch] = useState('');
  const [roleSearch, setRoleSearch] = useState('');
  const [booleanSearch, setBooleanSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CandidateStatus | 'All'>('All');
  const [view, setView] = useState<'active' | 'archived'>('active');
  const [page, setPage] = useState(1);
  const [action, setAction] = useState<ActionMode>(null);
  const [, setNotice] = useState('Candidates module is ready for updates.');
  const deferredSearch = useDeferredValue(search);
  const deferredSkillSearch = useDeferredValue(skillSearch);
  const deferredRoleSearch = useDeferredValue(roleSearch);
  const deferredBooleanSearch = useDeferredValue(booleanSearch);
  const ownerOptions = useMemo(() => getAtsOwnerNames(), []);
  const newCandidateForm = useMemo(() => ({ ...emptyForm, owner: currentOwnerName() }), []);

  useEffect(() => {
    if (location.pathname === '/candidates/new') {
      setAction({ type: 'add' });
    }
  }, [location.pathname]);

  useEffect(() => {
    if (!didHydrateCandidates.current) {
      didHydrateCandidates.current = true;
      return;
    }
    saveLocalCandidates(candidateRows);
  }, [candidateRows]);

  useEffect(() => {
    function refreshRows(event: Event) {
      const detail = (event as CustomEvent).detail;
      if (!detail || detail.key === LOCAL_CANDIDATES_KEY) {
        setCandidateRows(loadLocalCandidates());
      }
    }
    window.addEventListener(ATS_RECORDS_UPDATED_EVENT, refreshRows);
    return () => window.removeEventListener(ATS_RECORDS_UPDATED_EVENT, refreshRows);
  }, []);

  const activeRows = useMemo(() => candidateRows.filter(candidate => !candidate.archived), [candidateRows]);
  const archivedRows = useMemo(() => candidateRows.filter(candidate => candidate.archived), [candidateRows]);
  const scopedRows = useMemo(() => view === 'active' ? activeRows : archivedRows, [activeRows, archivedRows, view]);
  const searchableRows = useMemo(
    () => scopedRows.map(candidate => ({ candidate, text: candidateSearchText(candidate) })),
    [scopedRows]
  );

  const filtered = useMemo(() => {
    return searchableRows.filter(({ candidate, text: searchableText }) => {
      const query = normalizeSearchText(deferredSearch);
      const matchSearch = !query ||
        searchableText.includes(query);
      const matchSkills = listSearchMatches([candidate.skills.join(' '), candidate.parsedResumeDetails, candidate.certifications], deferredSkillSearch);
      const matchRole = listSearchMatches([candidate.title, candidate.matchedJobTitle, candidate.parsedResumeDetails], deferredRoleSearch);
      const matchBoolean = booleanSearchMatches(searchableText, deferredBooleanSearch);
      const matchStatus = statusFilter === 'All' || candidate.status === statusFilter;
      return matchSearch && matchSkills && matchRole && matchBoolean && matchStatus;
    }).map(row => row.candidate);
  }, [deferredBooleanSearch, deferredRoleSearch, deferredSearch, deferredSkillSearch, searchableRows, statusFilter]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / CANDIDATE_PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pagedCandidates = useMemo(
    () => filtered.slice((safePage - 1) * CANDIDATE_PAGE_SIZE, safePage * CANDIDATE_PAGE_SIZE),
    [filtered, safePage]
  );
  const rangeStart = filtered.length ? (safePage - 1) * CANDIDATE_PAGE_SIZE + 1 : 0;
  const rangeEnd = Math.min(safePage * CANDIDATE_PAGE_SIZE, filtered.length);

  useEffect(() => {
    setPage(1);
  }, [deferredBooleanSearch, deferredRoleSearch, deferredSearch, deferredSkillSearch, statusFilter, view]);

  function record(message: string) {
    setNotice(message);
  }

  function upsertCandidate(form: CandidateFormState, existing?: CandidateRecord) {
    if (existing) {
      setCandidateRows(rows => rows.map(candidate =>
        candidate.id === existing.id
          ? {
              ...candidateFromForm(form, existing.id),
              createdAt: existing.createdAt,
              rating: existing.rating,
              resumeFile: existing.resumeFile,
              supportingDocuments: form.includeSupportingDocuments
                ? form.supportingDocuments.split(',').map(item => item.trim()).filter(Boolean)
                : [],
              archived: existing.archived,
            }
          : candidate
      ));
      record(`${form.fullName} profile updated.`);
    } else {
      const next = candidateFromForm(form, `c${Date.now()}`);
      setCandidateRows(rows => [next, ...rows]);
      record(`${next.name} added to Candidates.`);
    }
    setAction(null);
  }

  function updateCandidate(id: string, update: Partial<CandidateRecord>, message: string) {
    setCandidateRows(rows => rows.map(candidate =>
      candidate.id === id
        ? { ...candidate, ...update, updatedAt: new Date().toISOString().slice(0, 10) }
        : candidate
    ));
    record(message);
  }

  function moveForward(candidate: CandidateRecord) {
    const currentIndex = pipelineOrder.indexOf(candidate.status);
    const nextStatus = currentIndex >= 0 && currentIndex < pipelineOrder.length - 1
      ? pipelineOrder[currentIndex + 1]
      : candidate.status;
    updateCandidate(candidate.id, { status: nextStatus }, `${candidate.name} moved forward to ${nextStatus}.`);
  }

  function completeCandidate(candidate: CandidateRecord) {
    updateCandidate(
      candidate.id,
      { status: 'Placed', availability: 'Placed', notes: [`Completed placement workflow for ${candidate.name}.`, ...candidate.notes] },
      `${candidate.name} completed and moved to Placed.`
    );
  }

  function parseResume(candidate: CandidateRecord) {
    const parsedResumeDetails = [
      `${candidate.name} resume parsed successfully.`,
      `Detected title: ${candidate.title}.`,
      `Relevant experience: ${candidate.relevantExperience} years.`,
      `Skills: ${candidate.skills.slice(0, 6).join(', ')}.`,
      `Education: ${candidate.education}.`,
      `Certifications: ${candidate.certifications}.`,
    ].join(' ');
    updateCandidate(candidate.id, { parsedResumeDetails }, `AI resume parsing completed for ${candidate.name}.`);
  }

  function matchCandidate(candidate: CandidateRecord) {
    const activeJobs = getAllJobs();
    const matchedJob = activeJobs.find(job => job.requirements.some(requirement =>
      candidate.skills.some(skill => requirement.toLowerCase().includes(skill.toLowerCase()) || skill.toLowerCase().includes(requirement.toLowerCase()))
    )) ?? activeJobs[0];
    const aiMatchScore = Math.min(98, 70 + candidate.skills.length * 4 + candidate.rating * 2);
    updateCandidate(
      candidate.id,
      { aiMatchScore, matchedJobTitle: matchedJob?.title ?? 'No active job selected' },
      `AI matched ${candidate.name} to ${matchedJob?.title ?? 'the current candidate pool'} at ${aiMatchScore}%.`
    );
  }

  function openUpload() {
    navigate('/imports?mode=excel');
  }

  function archiveCandidate(candidate: CandidateRecord) {
    updateCandidate(candidate.id, { archived: true }, `${candidate.name} archived.`);
    setAction(null);
  }

  function deleteCandidate(candidate: CandidateRecord) {
    setCandidateRows(rows => rows.filter(row => row.id !== candidate.id));
    record(`${candidate.name} deleted from Candidates.`);
    setAction(null);
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Candidates</h1>
          <p className="text-sm text-slate-500 mt-0.5">{activeRows.length} active candidates, {archivedRows.length} archived</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={openUpload}
            className="inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-sm font-medium px-3.5 py-2.5 rounded-lg transition-colors"
          >
            <Upload size={15} />
            Upload Excel
          </button>
          <button
            onClick={() => setAction({ type: 'add' })}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
          >
            <Plus size={15} />
            Add Candidate
          </button>
        </div>
      </div>

      <div className="min-w-0">
        <div className="space-y-5 min-w-0">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Active Candidates" value={activeRows.length} tone="blue" />
            <Metric label="Interviewing" value={activeRows.filter(candidate => candidate.status === 'Interview').length} tone="cyan" />
            <Metric label="Offer Stage" value={activeRows.filter(candidate => candidate.status === 'Offer').length} tone="emerald" />
            <Metric label="Archived" value={archivedRows.length} tone="slate" />
          </div>

          <div className="bg-[#0d1729] border border-white/5 rounded-lg p-4">
            <div className="space-y-3">
              <div className="grid gap-3 xl:grid-cols-[minmax(220px,1fr)_minmax(180px,0.75fr)_minmax(180px,0.75fr)]">
                <SearchField
                  value={search}
                  onChange={setSearch}
                  placeholder="Search all candidate fields..."
                />
                <SearchField
                  value={roleSearch}
                  onChange={setRoleSearch}
                  placeholder="Role / designation"
                />
                <SearchField
                  value={skillSearch}
                  onChange={setSkillSearch}
                  placeholder="Skills, comma separated"
                />
              </div>

              <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
                <div>
                  <div className="relative">
                    <Target size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      value={booleanSearch}
                      onChange={event => setBooleanSearch(event.target.value)}
                      placeholder='Boolean search: ("Java" OR "Python") AND "React" NOT "manager"'
                      className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-9 pr-4 text-sm text-slate-300 outline-none transition-all placeholder:text-slate-600 focus:border-blue-500/50"
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-600">Supports AND, OR, NOT, quoted phrases, and parentheses across role, designation, skills, resume text, notes, and profile fields.</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setView('active')}
                    className={cn('px-3 py-2 rounded-lg text-xs font-medium border transition-all', view === 'active' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white/5 text-slate-400 border-white/10 hover:border-white/20')}
                  >
                    Active
                  </button>
                  <button
                    onClick={() => setView('archived')}
                    className={cn('px-3 py-2 rounded-lg text-xs font-medium border transition-all', view === 'archived' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white/5 text-slate-400 border-white/10 hover:border-white/20')}
                  >
                    Archived
                  </button>
                  <div className="flex items-center gap-1 pl-1 text-xs text-slate-500">
                    <Filter size={13} />
                    Status
                  </div>
                  <select
                    value={statusFilter}
                    onChange={event => setStatusFilter(event.target.value as CandidateStatus | 'All')}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300 focus:border-blue-500/50 focus:outline-none"
                  >
                    <option value="All">All statuses</option>
                    {allStatuses.map(status => <option key={status} value={status}>{status}</option>)}
                  </select>
                  <button
                    onClick={() => {
                      setSearch('');
                      setSkillSearch('');
                      setRoleSearch('');
                      setBooleanSearch('');
                      setStatusFilter('All');
                    }}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-white/5 bg-[#0d1729]">
            <div className="flex flex-col gap-2 border-b border-white/5 px-4 py-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white">Candidate Records</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Showing {rangeStart}-{rangeEnd} of {filtered.length} matching candidates. Rendered in pages of {CANDIDATE_PAGE_SIZE} for large Excel imports.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(current => Math.max(1, current - 1))}
                  disabled={safePage === 1}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-400">
                  Page {safePage} / {pageCount}
                </span>
                <button
                  onClick={() => setPage(current => Math.min(pageCount, current + 1))}
                  disabled={safePage === pageCount}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
            <div className="max-h-[65vh] overflow-auto [scrollbar-gutter:stable]">
              <table className="w-full min-w-[1640px]">
                <thead>
                  <tr className="border-b border-white/5 bg-white/[0.02]">
                    <Th>Candidate</Th>
                    <Th>Contact</Th>
                    <Th>Company</Th>
                    <Th>Skills</Th>
                    <Th>Experience</Th>
                    <Th>Work Auth</Th>
                    <Th>Rate</Th>
                    <Th>Status</Th>
                    <Th>Owner</Th>
                    <Th>Resume</Th>
                    <Th>Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {pagedCandidates.map(candidate => (
                    <tr
                      key={candidate.id}
                      className="border-b border-white/5 transition-colors last:border-0 hover:bg-white/[0.03]"
                    >
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-violet-600 text-[10px] font-bold text-white">
                            {candidate.name.split(' ').map(part => part[0]).join('')}
                          </div>
                          <div className="min-w-0">
                            <button
                              onClick={() => navigate(`/candidates/${candidate.id}`)}
                              className="block truncate text-sm font-semibold text-white hover:text-blue-300 transition-colors"
                            >
                              {candidate.name}
                            </button>
                            <p className="text-xs text-slate-500 truncate">{candidate.title} · {candidate.location}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <p className="max-w-[180px] truncate text-xs text-slate-300">{candidate.email || 'Email pending'}</p>
                        <p className="text-[11px] text-slate-600">{candidate.phone || 'Phone pending'}</p>
                      </td>
                      <td className="px-3 py-2">
                        <p className="text-xs text-slate-300">{candidate.currentCompany}</p>
                        <p className="text-[11px] text-slate-600">{candidate.source}</p>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex max-w-[240px] flex-wrap gap-1">
                          {candidate.skills.slice(0, 3).map(skill => (
                            <span key={skill} className="rounded-md border border-blue-500/20 bg-blue-500/10 px-1.5 py-0.5 text-[10px] text-blue-200">
                              {skill}
                            </span>
                          ))}
                          {candidate.skills.length > 3 && (
                            <span className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400">
                              +{candidate.skills.length - 3}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <p className="text-xs text-slate-300">{candidate.experience}y total</p>
                        <p className="text-[11px] text-slate-600">{candidate.usExperience}y US</p>
                      </td>
                      <td className="px-3 py-2">
                        <p className="text-xs text-slate-300">{candidate.workAuthorization}</p>
                        <p className="text-[11px] text-slate-600">{candidate.visaStatus}</p>
                      </td>
                      <td className="px-3 py-2">
                        <p className="text-xs text-slate-300">{candidate.currentRate}</p>
                        <p className="text-[11px] text-slate-600">Exp. {candidate.expectedRate}</p>
                      </td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => setAction({ type: 'status', candidate })}
                          className={cn('inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border', statusColors[candidate.status])}
                        >
                          {candidate.status}
                          <ChevronRight size={12} />
                        </button>
                      </td>
                      <td className="px-3 py-2">
                        <p className="text-xs text-slate-300">{candidate.owner}</p>
                        <p className="text-[11px] text-slate-600">{candidate.availability}</p>
                      </td>
                      <td className="px-3 py-2">
                        <p className="max-w-[170px] truncate text-xs text-slate-300">{candidate.resumeFile || 'Resume pending'}</p>
                        <p className="text-[11px] text-slate-600">{candidate.documentChecklist.length} checklist items</p>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex max-w-[360px] flex-wrap gap-1">
                          <IconButton label="View Profile" onClick={() => navigate(`/candidates/${candidate.id}`)}><UserRound size={12} /></IconButton>
                          <IconButton label="Call Candidate" onClick={() => setAction({ type: 'call', candidate })}><Phone size={12} /></IconButton>
                          <IconButton label="Edit" onClick={() => setAction({ type: 'edit', candidate })}><Pencil size={12} /></IconButton>
                          <IconButton label="Move Forward" onClick={() => moveForward(candidate)}><ChevronRight size={12} /></IconButton>
                          <IconButton label="Status Change" onClick={() => setAction({ type: 'status', candidate })}><MoreHorizontal size={12} /></IconButton>
                          <IconButton label="Submit to Job" onClick={() => setAction({ type: 'submit', candidate })}><Send size={12} /></IconButton>
                          <IconButton label="Schedule Interview" onClick={() => setAction({ type: 'interview', candidate })}><CalendarClock size={12} /></IconButton>
                          <IconButton label="Create Task" onClick={() => setAction({ type: 'task', candidate })}><ClipboardList size={12} /></IconButton>
                          <IconButton label="Complete" onClick={() => completeCandidate(candidate)}><CheckCircle2 size={12} /></IconButton>
                          <IconButton label="Upload Resume" onClick={() => setAction({ type: 'upload', candidate })}><FileUp size={12} /></IconButton>
                          <IconButton label="AI Resume Parse" onClick={() => setAction({ type: 'parse', candidate })}><FileText size={12} /></IconButton>
                          <IconButton label="AI Match" onClick={() => setAction({ type: 'match', candidate })}><Target size={12} /></IconButton>
                          <IconButton label="Add Note" onClick={() => setAction({ type: 'note', candidate })}><MessageSquarePlus size={12} /></IconButton>
                          <IconButton label={view === 'archived' ? 'Restore' : 'Archive'} onClick={() => view === 'archived' ? updateCandidate(candidate.id, { archived: false }, `${candidate.name} restored.`) : setAction({ type: 'archive', candidate })}><Archive size={12} /></IconButton>
                          <IconButton label="Connect" onClick={() => setAction({ type: 'connect', candidate })}><Mail size={12} /></IconButton>
                          <IconButton label="Delete" destructive onClick={() => setAction({ type: 'delete', candidate })}><Trash2 size={12} /></IconButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filtered.length === 0 && (
              <div className="py-16 text-center text-slate-600">
                <UserRound size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">No candidates match the current view.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {action?.type === 'add' && (
        <CandidateFormPanel
          title="Add Candidate"
          initial={newCandidateForm}
          submitLabel="Add Candidate"
          ownerOptions={ownerOptions}
          onClose={() => setAction(null)}
          onSubmit={form => upsertCandidate(form)}
        />
      )}
      {action?.type === 'edit' && (
        <CandidateFormPanel
          title={`Edit ${action.candidate.name}`}
          initial={formFromCandidate(action.candidate)}
          submitLabel="Update Candidate"
          ownerOptions={ownerOptions}
          onClose={() => setAction(null)}
          onSubmit={form => upsertCandidate(form, action.candidate)}
        />
      )}
      {action?.type === 'status' && (
        <StatusPanel
          candidate={action.candidate}
          onClose={() => setAction(null)}
          onSubmit={(status, note) => {
            const notes = note ? [note, ...action.candidate.notes] : action.candidate.notes;
            updateCandidate(action.candidate.id, { status, notes }, `${action.candidate.name} status changed to ${status}.`);
            setAction(null);
          }}
        />
      )}
      {action?.type === 'submit' && (
        <SubmitPanel
          candidate={action.candidate}
          onClose={() => setAction(null)}
          onSubmit={async job => {
            const result = await createCandidateJobSubmission(action.candidate, job, 'Submitted from candidate quick action.');
            if (!result.ok) return result.message;
            updateCandidate(action.candidate.id, { status: 'Screening' }, `${action.candidate.name} submitted to ${job.title}.`);
            setAction(null);
            navigate('/submissions');
            return null;
          }}
        />
      )}
      {action?.type === 'interview' && (
        <InterviewPanel
          candidate={action.candidate}
          onClose={() => setAction(null)}
          onSubmit={details => {
            updateCandidate(action.candidate.id, { status: 'Interview' }, `${action.candidate.name} interview scheduled for ${details}.`);
            setAction(null);
          }}
        />
      )}
      {action?.type === 'task' && (
        <TaskPanel
          candidate={action.candidate}
          onClose={() => setAction(null)}
          onSubmit={(title, completed) => {
            record(`${completed ? 'Completed' : 'Created'} task for ${action.candidate.name}: ${title}.`);
            setAction(null);
          }}
        />
      )}
      {action?.type === 'upload' && (
        <UploadPanel
          candidate={action.candidate}
          onClose={() => setAction(null)}
          onSubmit={(fileName, supportingDocuments, resumeAttachment, supportingDocumentAttachments) => {
            updateCandidate(
              action.candidate.id,
              { resumeFile: fileName, resumeAttachment, supportingDocuments, supportingDocumentAttachments, documentChecklist: ['Resume', ...supportingDocuments] },
              `${fileName} uploaded for ${action.candidate.name}.`
            );
            setAction(null);
          }}
        />
      )}
      {action?.type === 'call' && (
        <CallPanel
          candidate={action.candidate}
          onClose={() => setAction(null)}
          onStarted={() => record(`Dialer opened for ${action.candidate.name} at ${action.candidate.phone}.`)}
          onSubmit={(outcome, durationSeconds, notes) => {
            const startedAt = new Date(Date.now() - durationSeconds * 1000).toISOString();
            const endedAt = new Date().toISOString();
            saveCandidateCallLog({
              candidateId: action.candidate.id,
              candidateName: action.candidate.name,
              phone: action.candidate.phone,
              outcome,
              startedAt,
              endedAt,
              durationSeconds,
              notes,
            });
            const note = `Call ${outcome.toLowerCase()} on ${new Date(endedAt).toLocaleString()} for ${formatCallDuration(durationSeconds)}.${notes ? ` ${notes}` : ''}`;
            updateCandidate(action.candidate.id, { notes: [note, ...action.candidate.notes] }, `${action.candidate.name} call logged: ${outcome}, ${formatCallDuration(durationSeconds)}.`);
            setAction(null);
          }}
        />
      )}
      {action?.type === 'parse' && (
        <AIResumeParsePanel
          candidate={action.candidate}
          onClose={() => setAction(null)}
          onSubmit={() => {
            parseResume(action.candidate);
            setAction(null);
          }}
        />
      )}
      {action?.type === 'match' && (
        <AIMatchPanel
          candidate={action.candidate}
          onClose={() => setAction(null)}
          onSubmit={() => {
            matchCandidate(action.candidate);
            setAction(null);
          }}
        />
      )}
      {action?.type === 'note' && (
        <NotePanel
          candidate={action.candidate}
          onClose={() => setAction(null)}
          onSubmit={note => {
            updateCandidate(action.candidate.id, { notes: [note, ...action.candidate.notes] }, `Note added for ${action.candidate.name}.`);
            setAction(null);
          }}
        />
      )}
      {action?.type === 'connect' && (
        <ConnectPanel
          candidate={action.candidate}
          onClose={() => setAction(null)}
          onRecord={method => record(`${method} prepared for ${action.candidate.name}.`)}
        />
      )}
      {action?.type === 'archive' && (
        <ConfirmPanel
          title="Archive Candidate"
          message={`${action.candidate.name} will move out of the active candidate list.`}
          confirmLabel="Archive"
          icon={<Archive size={18} />}
          onClose={() => setAction(null)}
          onConfirm={() => archiveCandidate(action.candidate)}
        />
      )}
      {action?.type === 'delete' && (
        <ConfirmPanel
          title="Delete Candidate"
          message={`Delete ${action.candidate.name}? This removes the row from the in-memory list.`}
          confirmLabel="Delete"
          destructive
          icon={<Trash2 size={18} />}
          onClose={() => setAction(null)}
          onConfirm={() => deleteCandidate(action.candidate)}
        />
      )}
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: 'blue' | 'cyan' | 'emerald' | 'slate' }) {
  const tones = {
    blue: 'from-blue-500/20 to-blue-500/5 text-blue-300',
    cyan: 'from-cyan-500/20 to-cyan-500/5 text-cyan-300',
    emerald: 'from-emerald-500/20 to-emerald-500/5 text-emerald-300',
    slate: 'from-slate-500/20 to-slate-500/5 text-slate-300',
  };
  return (
    <div className="rounded-lg border border-white/5 bg-[#0d1729] p-4">
      <div className={cn('w-9 h-9 rounded-lg bg-gradient-to-br flex items-center justify-center mb-3', tones[tone])}>
        <BriefcaseBusiness size={16} />
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

function SearchField({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <div className="relative min-w-0">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
      <input
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-9 pr-4 text-sm text-slate-300 outline-none transition-all placeholder:text-slate-600 focus:border-blue-500/50"
      />
    </div>
  );
}

function Th({ children }: { children: string }) {
  return <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">{children}</th>;
}

function IconButton({ children, label, onClick, destructive }: { children: React.ReactNode; label: string; onClick: () => void; destructive?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        'w-7 h-7 rounded-lg border flex items-center justify-center transition-colors',
        destructive
          ? 'bg-red-500/10 border-red-500/20 text-red-300 hover:bg-red-500/20'
          : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
      )}
    >
      {children}
    </button>
  );
}

function Panel({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, x: 32 }}
        animate={{ opacity: 1, x: 0 }}
        className="h-full w-full max-w-2xl overflow-y-auto border-l border-white/10 bg-[#08111f] shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#08111f]/95 px-6 py-4 backdrop-blur">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button aria-label="Close" onClick={onClose} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </motion.div>
    </div>
  );
}

function CandidateFormPanel({
  title,
  initial,
  submitLabel,
  ownerOptions,
  onClose,
  onSubmit,
}: {
  title: string;
  initial: CandidateFormState;
  submitLabel: string;
  ownerOptions: string[];
  onClose: () => void;
  onSubmit: (form: CandidateFormState) => void;
}) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const visibleOwnerOptions = useMemo(
    () => form.owner && !ownerOptions.includes(form.owner) ? [form.owner, ...ownerOptions] : ownerOptions,
    [form.owner, ownerOptions]
  );

  function update<K extends keyof CandidateFormState>(key: K, value: CandidateFormState[K]) {
    setForm(previous => ({ ...previous, [key]: value }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form.fullName.trim() || !form.email.trim() || !form.title.trim()) {
      setError('Full name, email, and current title are required.');
      return;
    }
    if (!form.resumeFile.trim()) {
      setError('Resume upload is required before saving a candidate.');
      return;
    }
    onSubmit(form);
  }

  return (
    <Panel title={title} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full Name" value={form.fullName} onChange={value => update('fullName', value)} />
          <Field label="Email" value={form.email} onChange={value => update('email', value)} />
          <Field label="Phone" value={form.phone} onChange={value => update('phone', value)} />
          <Field label="Current Title" value={form.title} onChange={value => update('title', value)} />
          <Field label="Current Company" value={form.currentCompany} onChange={value => update('currentCompany', value)} />
          <Field label="LinkedIn URL" value={form.linkedinUrl} onChange={value => update('linkedinUrl', value)} />
          <Field label="Location" value={form.location} onChange={value => update('location', value)} />
          <Field label="Skills" value={form.skills} onChange={value => update('skills', value)} />
          <Field label="Total Experience" value={form.experience} onChange={value => update('experience', value)} />
          <Field label="US Experience" value={form.usExperience} onChange={value => update('usExperience', value)} />
          <Field label="Relevant Experience" value={form.relevantExperience} onChange={value => update('relevantExperience', value)} />
          <SelectField label="Work Authorization" value={form.workAuthorization} options={workAuthorizationOptions} onChange={value => update('workAuthorization', value)} />
          <SelectField label="Visa Status" value={form.visaStatus} options={['No sponsorship needed', 'Transfer required', 'Extension pending', 'OPT/CPT', 'Not authorized']} onChange={value => update('visaStatus', value)} />
          <Field
            label="Passport Number"
            value={form.passportNumber}
            disabled={isCitizenAuthorization(form.workAuthorization)}
            placeholder={isCitizenAuthorization(form.workAuthorization) ? 'Disabled for USC / US Citizen' : 'Optional for visa holders'}
            onChange={value => update('passportNumber', value)}
          />
          <Field label="Current Rate" value={form.currentRate} onChange={value => update('currentRate', value)} />
          <Field label="Expected Rate" value={form.expectedRate} onChange={value => update('expectedRate', value)} />
          <SelectField label="Relocation Preference" value={form.relocationPreference} options={['Open to relocate', 'Remote only', 'Hybrid only', 'Local only', 'Not open to relocate']} onChange={value => update('relocationPreference', value)} />
          <SelectField label="Availability" value={form.availability} options={['Immediately', '1 week', '2 weeks', '3 weeks', '1 month', 'Placed']} onChange={value => update('availability', value)} />
          <SelectField label="Source" value={form.source} options={sources} onChange={value => update('source', value)} />
          <SelectField label="Owner" value={form.owner} options={visibleOwnerOptions} onChange={value => update('owner', value)} />
          <SelectField label="Status" value={form.status} options={allStatuses} onChange={value => update('status', value as CandidateStatus)} />
          <Field label="Education" value={form.education} onChange={value => update('education', value)} />
          <Field label="Certifications" value={form.certifications} onChange={value => update('certifications', value)} />
          <Field label="Document Checklist" value={form.documentChecklist} onChange={value => update('documentChecklist', value)} />
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">Candidate Documents</p>
              <p className="mt-1 text-xs text-slate-500">Resume upload is mandatory. Supporting documents are available only when checked.</p>
            </div>
            <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-300">Resume required</span>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-slate-400">Resume upload</p>
                <p className="mt-1 text-sm font-semibold text-white">{form.resumeFile || 'No resume selected'}</p>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10">
                <FileUp size={13} />
                Upload Resume
                <input
                  type="file"
                  accept={candidateDocumentAcceptTypes}
                  className="hidden"
                  onChange={event => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    update('resumeFile', file.name);
                    event.target.value = '';
                  }}
                />
              </label>
            </div>
            <Field label="Resume file name / storage path" value={form.resumeFile} placeholder="Candidate_Resume.pdf" onChange={value => update('resumeFile', value)} />
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={form.includeSupportingDocuments}
              onChange={event => update('includeSupportingDocuments', event.target.checked)}
              className="accent-blue-600"
            />
            Upload supporting documents
          </label>
          {form.includeSupportingDocuments && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {supportingDocumentOptions.map(document => (
                <button
                  type="button"
                  key={document}
                  onClick={() => {
                    const current = form.supportingDocuments.split(',').map(item => item.trim()).filter(Boolean);
                    const next = current.includes(document) ? current.filter(item => item !== document) : [...current, document];
                    update('supportingDocuments', next.join(', '));
                    update('documentChecklist', ['Resume', ...next].join(', '));
                  }}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-left text-xs transition-colors',
                    form.supportingDocuments.includes(document)
                      ? 'border-blue-500/40 bg-blue-500/10 text-blue-100'
                      : 'border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20'
                  )}
                >
                  {document}
                </button>
              ))}
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-blue-500/30 bg-blue-500/10 px-3 py-3 text-xs font-semibold text-blue-100 hover:bg-blue-500/15">
                <Upload size={14} />
                Upload supporting files
                <input
                  type="file"
                  multiple
                  accept={candidateDocumentAcceptTypes}
                  className="hidden"
                  onChange={event => {
                    const files = Array.from(event.target.files ?? []);
                    if (!files.length) return;
                    const current = form.supportingDocuments.split(',').map(item => item.trim()).filter(Boolean);
                    const next = [...new Set([...current, ...files.map(file => file.name)])];
                    update('supportingDocuments', next.join(', '));
                    update('documentChecklist', ['Resume', ...next].join(', '));
                    event.target.value = '';
                  }}
                />
              </label>
              <Field label="Supporting document files" value={form.supportingDocuments} placeholder="Visa_Copy.pdf, DL_Copy.pdf" onChange={value => update('supportingDocuments', value)} />
            </div>
          )}
        </div>
        <TextAreaField label="Parsed Resume Details" value={form.parsedResumeDetails} onChange={value => update('parsedResumeDetails', value)} />
        <TextAreaField label="Notes" value={form.notes} onChange={value => update('notes', value)} />
        {error && <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
        <PanelActions onClose={onClose} submitLabel={submitLabel} />
      </form>
    </Panel>
  );
}

function StatusPanel({ candidate, onClose, onSubmit }: { candidate: CandidateRecord; onClose: () => void; onSubmit: (status: CandidateStatus, note: string) => void }) {
  const [status, setStatus] = useState<CandidateStatus>(candidate.status);
  const [note, setNote] = useState('');
  return (
    <Panel title={`Update Status: ${candidate.name}`} onClose={onClose}>
      <div className="space-y-5">
        <SelectField label="Status" value={status} options={allStatuses} onChange={value => setStatus(value as CandidateStatus)} />
        <TextAreaField label="Status Note" value={note} onChange={setNote} />
        <button onClick={() => onSubmit(status, note)} className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500">
          <ShieldCheck size={16} />
          Update Status
        </button>
      </div>
    </Panel>
  );
}

function SubmitPanel({
  candidate,
  onClose,
  onSubmit,
}: {
  candidate: CandidateRecord;
  onClose: () => void;
  onSubmit: (job: ReturnType<typeof getAllJobs>[number]) => Promise<string | null>;
}) {
  const availableJobs = getAllJobs().filter(job => job.status === 'Active');
  const defaultJob = availableJobs.find(job =>
    job.id === candidate.matchedJobTitle ||
    job.externalJobId === candidate.matchedJobTitle ||
    job.title.toLowerCase() === candidate.matchedJobTitle.toLowerCase()
  ) ?? availableJobs[0];
  const [jobId, setJobId] = useState(defaultJob?.id ?? '');
  const [jobSearch, setJobSearch] = useState('');
  const [warning, setWarning] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const selectedJob = availableJobs.find(job => job.id === jobId);
  const filteredJobs = availableJobs.filter(job => {
    const search = jobSearch.toLowerCase().trim();
    if (!search) return true;
    return [
      job.id,
      job.externalJobId ?? '',
      job.title,
      job.client,
      job.location,
      job.recruiter,
    ].some(value => value.toLowerCase().includes(search));
  });
  const duplicate = selectedJob
    ? findCandidateJobSubmission(getAllSubmissions(), candidate.id, selectedJob.id)
    : undefined;

  async function handleSubmit() {
    if (!selectedJob || duplicate || isSubmitting) return;
    setIsSubmitting(true);
    const error = await onSubmit(selectedJob);
    if (error) {
      setWarning(error);
      setIsSubmitting(false);
    }
  }

  return (
    <Panel title={`Submit to Job: ${candidate.name}`} onClose={onClose}>
      <div className="space-y-5">
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-200">Selected job for submission</p>
          {selectedJob ? (
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-base font-semibold text-white">{selectedJob.title}</p>
                <p className="mt-1 text-xs text-blue-100/80">{selectedJob.client} · {selectedJob.location} · {selectedJob.salary}</p>
                <p className="mt-1 text-xs text-blue-100/70">Internal Job ID: {selectedJob.id}{selectedJob.externalJobId ? ` · External ID: ${selectedJob.externalJobId}` : ''}</p>
              </div>
              <span className="w-fit rounded-full border border-blue-300/20 bg-blue-300/10 px-2.5 py-1 text-xs font-semibold text-blue-100">Selected</span>
            </div>
          ) : (
            <p className="mt-2 text-sm text-blue-100/80">Select an open job below before submitting this candidate.</p>
          )}
        </div>

        <SelectField
          label="Job selector"
          value={jobId}
          options={availableJobs.map(job => ({ label: `${job.title} · ${job.client}${job.externalJobId ? ` · ${job.externalJobId}` : ''}`, value: job.id }))}
          onChange={value => {
            setJobId(value);
            setWarning('');
          }}
        />

        <SearchField
          value={jobSearch}
          onChange={setJobSearch}
          placeholder="Search open jobs by title, client, Job ID, external ID..."
        />

        <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
          {filteredJobs.map(job => {
            const isSelected = job.id === jobId;
            const jobDuplicate = findCandidateJobSubmission(getAllSubmissions(), candidate.id, job.id);

            return (
              <button
                key={job.id}
                type="button"
                onClick={() => {
                  setJobId(job.id);
                  setWarning('');
                }}
                className={cn(
                  'w-full rounded-lg border p-3 text-left transition-all',
                  isSelected
                    ? 'border-blue-500/60 bg-blue-500/15 shadow-[0_0_0_1px_rgba(59,130,246,0.25)]'
                    : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]'
                )}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{job.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{job.client} · {job.location} · SPOC: {job.spocName || 'Not assigned'}</p>
                    <p className="mt-1 text-[11px] text-slate-600">Internal Job ID: {job.id}{job.externalJobId ? ` · External ID: ${job.externalJobId}` : ''}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {isSelected && <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-semibold text-blue-200">Selected</span>}
                    {jobDuplicate && <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-200">Already submitted</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {!filteredJobs.length && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            No open jobs match that search. Try another title, client, or job ID.
          </div>
        )}

        {duplicate && (
          <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            Duplicate blocked: {duplicateSubmissionMessage(duplicate)}
          </p>
        )}
        {warning && (
          <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            {warning}
          </p>
        )}
        {!availableJobs.length && (
          <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">No active jobs found. Add an open job first.</p>
        )}
        <button disabled={!selectedJob || Boolean(duplicate) || isSubmitting} onClick={handleSubmit} className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50">
          <Send size={16} />
          {isSubmitting ? 'Submitting...' : selectedJob ? `Submit to Selected Job: ${selectedJob.id}` : 'Select a Job to Submit'}
        </button>
      </div>
    </Panel>
  );
}

function InterviewPanel({ candidate, onClose, onSubmit }: { candidate: CandidateRecord; onClose: () => void; onSubmit: (details: string) => void }) {
  const availableJobs = getAllJobs().filter(job => job.status === 'Active');
  const [jobId, setJobId] = useState(availableJobs[0]?.id ?? '');
  const selectedJob = availableJobs.find(job => job.id === jobId);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState('10:00');
  const [timeZone, setTimeZone] = useState('EST');
  const [candidateAvailability, setCandidateAvailability] = useState(candidate.availability || 'Needs confirmation');
  const [interviewAvailability, setInterviewAvailability] = useState('');
  const [type, setType] = useState('Video Call');
  const interviewer = selectedJob?.spocName || 'SPOC not assigned';
  return (
    <Panel title={`Schedule Interview: ${candidate.name}`} onClose={onClose}>
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Job" value={jobId} options={availableJobs.map(job => ({ label: `${job.title} · ${job.client}`, value: job.id }))} onChange={setJobId} />
          <Field label="Interviewer / SPOC" value={interviewer} onChange={() => undefined} disabled />
          <Field label="Date" type="date" value={date} onChange={setDate} />
          <Field label="Time" type="time" value={time} onChange={setTime} />
          <SelectField label="Time zone" value={timeZone} options={['IND', 'EST', 'CST', 'MST', 'PST', 'UTC', 'GMT'].map(zone => ({ label: zone, value: zone }))} onChange={setTimeZone} />
          <SelectField label="Interview Type" value={type} options={['Phone', 'Video', 'Video Call', 'On-site', 'Technical']} onChange={setType} />
          <Field label="Candidate availability" value={candidateAvailability} onChange={setCandidateAvailability} />
          <Field label="Interview availability" value={interviewAvailability} placeholder="Manual interviewer/client availability" onChange={setInterviewAvailability} />
        </div>
        <button disabled={!selectedJob} onClick={() => onSubmit(`${selectedJob?.title ?? 'selected job'} with ${interviewer} on ${date} at ${time} ${timeZone} (${type})`)} className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50">
          <CalendarClock size={16} />
          Schedule Interview
        </button>
      </div>
    </Panel>
  );
}

function TaskPanel({ candidate, onClose, onSubmit }: { candidate: CandidateRecord; onClose: () => void; onSubmit: (title: string, completed: boolean) => void }) {
  const [title, setTitle] = useState(`Follow up with ${candidate.name}`);
  const [dueDate, setDueDate] = useState('2025-01-05');
  return (
    <Panel title={`Create Task: ${candidate.name}`} onClose={onClose}>
      <div className="space-y-5">
        <Field label="Task" value={title} onChange={setTitle} />
        <Field label="Due Date" type="date" value={dueDate} onChange={setDueDate} />
        <div className="grid gap-3 sm:grid-cols-2">
          <button onClick={() => onSubmit(title, false)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500">
            <ClipboardList size={16} />
            Create Task
          </button>
          <button onClick={() => onSubmit(title, true)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500">
            <CheckCircle2 size={16} />
            Complete
          </button>
        </div>
      </div>
    </Panel>
  );
}

function UploadPanel({ candidate, onClose, onSubmit }: { candidate: CandidateRecord; onClose: () => void; onSubmit: (fileName: string, supportingDocuments: string[], resumeAttachment?: FileAttachment, supportingDocumentAttachments?: FileAttachment[]) => void }) {
  const [fileName, setFileName] = useState(candidate.resumeFile ?? `${candidate.name.replace(/\s+/g, '_')}_Resume.pdf`);
  const [includeSupportingDocuments, setIncludeSupportingDocuments] = useState(candidate.supportingDocuments.length > 0);
  const [supportingDocuments, setSupportingDocuments] = useState(candidate.supportingDocuments.join(', '));
  const [resumeAttachment, setResumeAttachment] = useState<FileAttachment | undefined>(candidate.resumeAttachment);
  const [supportingAttachments, setSupportingAttachments] = useState<FileAttachment[]>(candidate.supportingDocumentAttachments ?? []);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const supportingDocumentList = supportingDocuments.split(',').map(item => item.trim()).filter(Boolean);
  return (
    <Panel title={`Upload Resume: ${candidate.name}`} onClose={onClose}>
      <div className="space-y-5">
        <div className="rounded-lg border border-dashed border-white/15 bg-white/[0.03] p-8 text-center">
          <FileUp size={28} className="mx-auto mb-3 text-blue-300" />
          <p className="text-sm font-medium text-white">{resumeAttachment?.fileName ?? fileName}</p>
          <p className="mt-1 text-xs text-slate-500">{uploading ? 'Uploading to backend storage...' : 'PDF, DOC, DOCX, image, text, or ZIP'}</p>
          {resumeAttachment?.downloadUrl && <p className="mt-1 text-xs text-emerald-300">Stored in ATS backend file storage</p>}
        </div>
        {uploadError && <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">{uploadError}</p>}
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-white/10">
          <FileUp size={15} />
          Select Resume File
          <input
            type="file"
            accept={candidateDocumentAcceptTypes}
            className="hidden"
            onChange={async event => {
              const file = event.target.files?.[0];
              if (!file) return;
              setUploading(true);
              setUploadError('');
              try {
                const stored = await uploadBackendFile(file, {
                  candidateId: candidate.id,
                  candidateName: candidate.name,
                  documentType: 'Resume',
                  entityType: 'candidate-resume',
                });
                const next = attachmentFromFile(file, stored);
                setResumeAttachment(next);
                setFileName(next.fileName);
              } catch (error) {
                setUploadError(error instanceof Error ? error.message : 'Resume upload failed.');
              } finally {
                setUploading(false);
                event.target.value = '';
              }
            }}
          />
        </label>
        <Field label="Resume file name" value={fileName} onChange={setFileName} />
        <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-slate-300">
          <input type="checkbox" checked={includeSupportingDocuments} onChange={event => setIncludeSupportingDocuments(event.target.checked)} className="accent-blue-600" />
          Upload supporting documents
        </label>
        {includeSupportingDocuments && (
          <div className="grid gap-3 sm:grid-cols-2">
            {supportingDocumentOptions.map(document => (
              <button
                type="button"
                key={document}
                onClick={() => {
                  const next = supportingDocumentList.includes(document)
                    ? supportingDocumentList.filter(item => item !== document)
                    : [...supportingDocumentList, document];
                  setSupportingDocuments(next.join(', '));
                }}
                className={cn(
                  'rounded-lg border px-3 py-2 text-left text-xs transition-colors',
                  supportingDocumentList.includes(document)
                    ? 'border-blue-500/40 bg-blue-500/10 text-blue-100'
                    : 'border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20'
                )}
              >
                {document}
              </button>
            ))}
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-blue-500/30 bg-blue-500/10 px-3 py-3 text-xs font-semibold text-blue-100 hover:bg-blue-500/15">
              <Upload size={14} />
              Upload supporting files
              <input
                type="file"
                multiple
                accept={candidateDocumentAcceptTypes}
                className="hidden"
                onChange={async event => {
                  const files = Array.from(event.target.files ?? []);
                  if (!files.length) return;
                  setUploading(true);
                  setUploadError('');
                  try {
                    const uploaded = await Promise.all(files.map(async file => {
                      const stored = await uploadBackendFile(file, {
                        candidateId: candidate.id,
                        candidateName: candidate.name,
                        documentType: 'Supporting document',
                        entityType: 'candidate-document',
                      });
                      return attachmentFromFile(file, stored);
                    }));
                    const nextNames = [...new Set([...supportingDocumentList, ...uploaded.map(file => file.fileName)])];
                    setSupportingDocuments(nextNames.join(', '));
                    setSupportingAttachments(current => [...uploaded, ...current]);
                  } catch (error) {
                    setUploadError(error instanceof Error ? error.message : 'Supporting document upload failed.');
                  } finally {
                    setUploading(false);
                    event.target.value = '';
                  }
                }}
              />
            </label>
            <Field label="Supporting document files" value={supportingDocuments} onChange={setSupportingDocuments} />
            {supportingAttachments.length > 0 && (
              <div className="sm:col-span-2 space-y-2">
                {supportingAttachments.map(file => (
                  <p key={`${file.fileName}-${file.uploadedAt}`} className="rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2 text-xs text-slate-400">
                    {file.fileName} · {file.fileType} · {formatFileSize(file.fileSize)}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
        <button disabled={uploading} onClick={() => onSubmit(fileName, includeSupportingDocuments ? supportingDocumentList : [], resumeAttachment ?? { fileName, fileType: 'manual-entry', fileSize: 0, uploadedAt: new Date().toISOString() }, includeSupportingDocuments ? supportingAttachments : [])} className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60">
          <Upload size={16} />
          {uploading ? 'Uploading...' : 'Upload Documents'}
        </button>
      </div>
    </Panel>
  );
}

function AIResumeParsePanel({ candidate, onClose, onSubmit }: { candidate: CandidateRecord; onClose: () => void; onSubmit: () => void }) {
  return (
    <Panel title={`AI Resume Parse: ${candidate.name}`} onClose={onClose}>
      <div className="space-y-5">
        <div className="rounded-lg border border-white/10 bg-[#070d18] p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Parsed resume details</p>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">{candidate.parsedResumeDetails}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <InfoTile label="Education" value={candidate.education} />
          <InfoTile label="Certifications" value={candidate.certifications} />
          <InfoTile label="Relevant Exp." value={`${candidate.relevantExperience} years`} />
        </div>
        <button onClick={onSubmit} className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500">
          <Sparkles size={16} />
          Run AI Resume Parse
        </button>
      </div>
    </Panel>
  );
}

function AIMatchPanel({ candidate, onClose, onSubmit }: { candidate: CandidateRecord; onClose: () => void; onSubmit: () => void }) {
  return (
    <Panel title={`AI Candidate-Job Match: ${candidate.name}`} onClose={onClose}>
      <div className="space-y-5">
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">Best match</p>
          <p className="mt-2 text-lg font-bold text-white">{candidate.matchedJobTitle}</p>
          <p className="mt-1 text-sm text-emerald-200">{candidate.aiMatchScore}% contextual fit</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Match reasoning</p>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            Matching weighs skills, relevant experience, work authorization, availability, and parsed resume context instead of only keyword overlap.
          </p>
        </div>
        <button onClick={onSubmit} className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500">
          <Target size={16} />
          Run Candidate-Job Matching
        </button>
      </div>
    </Panel>
  );
}

function NotePanel({ candidate, onClose, onSubmit }: { candidate: CandidateRecord; onClose: () => void; onSubmit: (note: string) => void }) {
  const [note, setNote] = useState('');
  return (
    <Panel title={`Add Note: ${candidate.name}`} onClose={onClose}>
      <div className="space-y-5">
        <TextAreaField label="Note" value={note} onChange={setNote} />
        <button disabled={!note.trim()} onClick={() => onSubmit(note)} className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">
          <MessageSquarePlus size={16} />
          Add Note
        </button>
      </div>
    </Panel>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.03] p-3">
      <p className="text-[10px] uppercase tracking-wider text-slate-600">{label}</p>
      <p className="mt-1 text-xs font-medium text-white">{value || 'Not specified'}</p>
    </div>
  );
}

function ConnectPanel({ candidate, onClose, onRecord }: { candidate: CandidateRecord; onClose: () => void; onRecord: (method: string) => void }) {
  const [mode, setMode] = useState<'menu' | 'email'>('menu');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [message, setMessage] = useState('');
  const emailSettings = currentEmailSettings();
  const signatureLines = emailSignatureText(emailSettings);
  const fullBody = [body.trim(), signatureLines].filter(Boolean).join('\n\n');

  async function sendCandidateEmail(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    if (!candidate.email.trim()) {
      setMessage('Candidate email is missing.');
      return;
    }
    if (!emailSettings?.connected || !emailSettings.email) {
      setMessage('Mailbox provider is not connected for this user. SuperUser can configure it in User Management.');
      return;
    }
    if (!subject.trim() || !body.trim()) {
      setMessage('Subject and body are required.');
      return;
    }

    const record: EmailRecord = {
      id: `candidate-email-${Date.now()}`,
      candidateId: candidate.id,
      candidateName: candidate.name,
      type: 'Candidate outreach',
      to: candidate.email,
      cc: cc.trim(),
      subject: subject.trim(),
      body: fullBody,
      status: 'Sent',
      sentAt: new Date().toLocaleString(),
      sender: emailSettings.email,
      deliveryProvider: emailSettings.provider,
      deliveryStatus: 'Provider Pending',
      providerMessage: `${emailSettings.provider} delivery is configured for ${emailSettings.email}. Replies remain in the mailbox provider and are not imported into ATS.`,
    };

    await sendEmailRecord(record);
    onRecord('Email');
    setMessage(`Email saved in ATS for ${emailSettings.provider} delivery. Replies will remain in the mailbox provider and are not imported into ATS.`);
  }

  if (mode === 'email') {
    return (
      <Panel title={`Email: ${candidate.name}`} onClose={onClose}>
        <form onSubmit={sendCandidateEmail} className="space-y-4">
          {message && (
            <div className={cn('rounded-lg border px-3 py-2 text-xs', message.startsWith('Email saved') ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-amber-500/20 bg-amber-500/10 text-amber-200')}>
              {message}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoTile label="From mailbox" value={emailSettings?.email || 'Not connected'} />
            <InfoTile label="Delivery provider" value={emailSettings?.provider || 'Not configured'} />
          </div>
          <Field label="To" value={candidate.email} onChange={() => undefined} disabled />
          <Field label="CC" value={cc} onChange={setCc} placeholder="optional@email.com" />
          <Field label="Subject" value={subject} onChange={setSubject} placeholder="Manual subject" />
          <TextAreaField label="Body" value={body} onChange={setBody} />
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Auto signature</p>
            <p className="mt-2 whitespace-pre-line text-sm text-slate-300">{signatureLines || 'No signature configured for this user.'}</p>
            {emailSettings?.signatureImageUrl && <img src={emailSettings.signatureImageUrl} alt="Email signature" className="mt-3 max-h-16 rounded-lg border border-white/10 object-contain" />}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => setMode('menu')} className="rounded-lg bg-white/5 px-4 py-3 text-sm text-slate-300 hover:bg-white/10">Back</button>
            <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500">
              <Send size={15} />
              Send
            </button>
          </div>
        </form>
      </Panel>
    );
  }

  return (
    <Panel title={`Connect: ${candidate.name}`} onClose={onClose}>
      <div className="space-y-3">
        <ConnectAction icon={<Mail size={16} />} label="Email" value={candidate.email || 'Candidate email missing'} onClick={() => setMode('email')} />
        <ConnectAction icon={<Phone size={16} />} label="Call" value={candidate.phone} onClick={() => onRecord('Call')} />
        <ConnectAction icon={<MessageSquarePlus size={16} />} label="Log Outreach" value="Candidate outreach logged" onClick={() => onRecord('Outreach log')} />
      </div>
    </Panel>
  );
}

function CallPanel({
  candidate,
  onClose,
  onStarted,
  onSubmit,
}: {
  candidate: CandidateRecord;
  onClose: () => void;
  onStarted: () => void;
  onSubmit: (outcome: CallOutcome, durationSeconds: number, notes: string) => void;
}) {
  const [outcome, setOutcome] = useState<CallOutcome>('Completed');
  const [minutes, setMinutes] = useState('0');
  const [seconds, setSeconds] = useState('0');
  const [notes, setNotes] = useState('');
  const [started, setStarted] = useState(false);
  const callingSettings = currentCallingSettings();
  const durationSeconds = Math.max(0, (Number(minutes) || 0) * 60 + (Number(seconds) || 0));

  function startCall() {
    const opened = openCandidateDialer(candidate.phone);
    setStarted(true);
    saveCandidateCallLog({
      candidateId: candidate.id,
      candidateName: candidate.name,
      phone: candidate.phone,
      outcome: 'Initiated',
      startedAt: new Date().toISOString(),
      durationSeconds: 0,
      notes: opened ? 'ATS quick-call dialer opened.' : 'No phone number available to dial.',
    });
    onStarted();
  }

  return (
    <Panel title={`Call Candidate: ${candidate.name}`} onClose={onClose}>
      <div className="space-y-5">
        <div className="rounded-lg border border-white/5 bg-white/[0.03] p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Candidate phone</p>
          <p className="mt-1 text-lg font-semibold text-white">{candidate.phone || 'No phone number added'}</p>
          <div className="mt-3 grid gap-2 rounded-lg border border-white/5 bg-white/[0.03] p-3 text-xs sm:grid-cols-2">
            <InfoTile label="ATS calling number" value={callingSettings?.number || 'Not assigned'} />
            <InfoTile label="Calling provider" value={callingSettings?.provider || 'Not configured'} />
            {callingSettings?.extension && <InfoTile label="Extension / SIP user" value={callingSettings.extension} />}
            <InfoTile label="Connection" value={callingSettings?.connected ? 'Connected' : 'Needs setup'} />
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">This opens the device dialer now and logs the assigned ATS calling number. Full browser SIP/WebRTC calling can use these per-user numbers once the VoIP provider endpoint is connected.</p>
        </div>
        <button disabled={!candidate.phone} onClick={startCall} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50">
          <Phone size={16} />
          {started ? 'Open Dialer Again' : 'Start Call'}
        </button>
        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField label="Outcome" value={outcome} options={['Completed', 'No Answer', 'Left Voicemail', 'Busy', 'Wrong Number']} onChange={value => setOutcome(value as CallOutcome)} />
          <Field label="Duration minutes" type="number" value={minutes} onChange={setMinutes} />
          <Field label="Duration seconds" type="number" value={seconds} onChange={setSeconds} />
        </div>
        <Field label="Call notes" value={notes} placeholder="Screening notes, availability, rate, follow-up..." onChange={setNotes} />
        <button onClick={() => onSubmit(outcome, durationSeconds, notes)} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500">
          <CheckCircle2 size={16} />
          Save Call Timeline
        </button>
      </div>
    </Panel>
  );
}

function ConfirmPanel({
  title,
  message,
  confirmLabel,
  icon,
  destructive,
  onClose,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  icon: React.ReactNode;
  destructive?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md rounded-lg border border-white/10 bg-[#0d1729] p-6 shadow-2xl">
        <div className={cn('mb-4 flex h-10 w-10 items-center justify-center rounded-lg', destructive ? 'bg-red-500/15 text-red-300' : 'bg-blue-500/15 text-blue-300')}>
          {icon}
        </div>
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">{message}</p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button onClick={onClose} className="rounded-lg bg-white/5 px-4 py-2.5 text-center text-sm text-slate-300 hover:bg-white/10">Cancel</button>
          <button onClick={onConfirm} className={cn('rounded-lg px-4 py-2.5 text-center text-sm font-semibold text-white', destructive ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-600 hover:bg-blue-500')}>
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  disabled = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-400">{label}</span>
      <input
        type={type}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={event => onChange(event.target.value)}
        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition-all focus:border-blue-500/60 disabled:cursor-not-allowed disabled:opacity-50"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<string | { label: string; value: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-400">{label}</span>
      <select
        value={value}
        onChange={event => onChange(event.target.value)}
        className="w-full rounded-lg border border-white/10 bg-[#111b2d] px-3 py-2.5 text-sm text-white outline-none transition-all focus:border-blue-500/60"
      >
        {options.map(option => {
          const normalized = typeof option === 'string' ? { label: option, value: option } : option;
          return <option key={normalized.value} value={normalized.value}>{normalized.label}</option>;
        })}
      </select>
    </label>
  );
}

function TextAreaField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-400">{label}</span>
      <textarea
        value={value}
        onChange={event => onChange(event.target.value)}
        rows={4}
        className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition-all focus:border-blue-500/60"
      />
    </label>
  );
}

function PanelActions({ onClose, submitLabel }: { onClose: () => void; submitLabel: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <button type="button" onClick={onClose} className="rounded-lg bg-white/5 px-4 py-3 text-center text-sm text-slate-300 hover:bg-white/10">
        Cancel
      </button>
      <button type="submit" className="rounded-lg bg-blue-600 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-blue-500">
        {submitLabel}
      </button>
    </div>
  );
}

function ConnectAction({ icon, label, value, onClick }: { icon: React.ReactNode; label: string; value: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-4 text-left hover:bg-white/10">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/15 text-blue-300">{icon}</span>
      <span>
        <span className="block text-sm font-semibold text-white">{label}</span>
        <span className="block text-xs text-slate-500">{value}</span>
      </span>
    </button>
  );
}
