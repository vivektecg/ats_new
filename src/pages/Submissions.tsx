import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertTriangle, Briefcase, CheckCircle2, ClipboardCheck,
  Eye, FileText, MessageSquareText, Plus, Search, Send, UserRound, UserRoundCheck,
} from 'lucide-react';
import { QuickActionModal, QuickIconButton } from '@/components/ats/QuickActionModal';
import { submissions } from '@/lib/data';
import { LOCAL_CANDIDATES_KEY, LOCAL_SUBMISSIONS_KEY, readLocalRows, saveRows } from '@/lib/atsApi';
import { currentOwnerName } from '@/lib/auth';
import { ATS_RECORDS_UPDATED_EVENT } from '@/lib/atsLocalStore';
import { getAllCandidates, getAllClients, getAllJobs } from '@/lib/localRecords';
import { createComplianceCase, createOnboardingCase, loadComplianceCases, loadOnboardingCases, saveComplianceCases, saveOnboardingCases } from '@/lib/onboardingStore';
import { createSubmissionRecord, duplicateSubmissionMessage, findCandidateJobSubmission } from '@/lib/submissionStore';
import type { Candidate, Submission, SubmissionStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

interface SubmissionFormState {
  candidateId: string;
  jobId: string;
  clientId: string;
  recruiter: string;
  submittedDate: string;
  payRate: string;
  billRate: string;
  rtrStatus: NonNullable<Submission['rtrStatus']>;
  resumeVersion: string;
  clientFeedback: string;
  status: SubmissionStatus;
  interviewRounds: string;
  offerStatus: NonNullable<Submission['offerStatus']>;
  joiningStatus: NonNullable<Submission['joiningStatus']>;
  notes: string;
}

const statusColors: Record<SubmissionStatus, string> = {
  Submitted: 'text-blue-400 bg-blue-500/10 border border-blue-500/20',
  'Client Review': 'text-violet-400 bg-violet-500/10 border border-violet-500/20',
  'Interview Scheduled': 'text-cyan-400 bg-cyan-500/10 border border-cyan-500/20',
  'Offer Extended': 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20',
  Placed: 'text-amber-400 bg-amber-500/10 border border-amber-500/20',
  Rejected: 'text-red-400 bg-red-500/10 border border-red-500/20',
};

const statusFlow: SubmissionStatus[] = ['Submitted', 'Client Review', 'Interview Scheduled', 'Offer Extended', 'Placed'];
const SUBMISSION_PAGE_SIZE = 100;

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function loadLocalSubmissions(): Submission[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(LOCAL_SUBMISSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalSubmissions(nextSubmissions: Submission[]) {
  window.localStorage.setItem(LOCAL_SUBMISSIONS_KEY, JSON.stringify(nextSubmissions));
  saveRows('submissions', nextSubmissions);
}

function syncCandidatePlacementStatus(candidateId: string, status: SubmissionStatus) {
  if (status !== 'Offer Extended' && status !== 'Placed') return;
  const nextStatus: Candidate['status'] = status === 'Placed' ? 'Placed' : 'Offer';
  const rows = readLocalRows<Candidate>(LOCAL_CANDIDATES_KEY);
  const existing = rows.find(candidate => candidate.id === candidateId);
  const source = existing ?? getAllCandidates().find(candidate => candidate.id === candidateId);
  if (!source) return;
  const updatedCandidate = {
    ...source,
    status: nextStatus,
    availability: nextStatus === 'Placed' ? 'Placed' : source.availability,
    updatedAt: todayDate(),
  };
  const nextRows = existing
    ? rows.map(candidate => candidate.id === candidateId ? updatedCandidate : candidate)
    : [updatedCandidate, ...rows];
  saveRows('candidates', nextRows);
}

function enrichSubmission(submission: Submission): Submission {
  return {
    ...submission,
    payRate: submission.payRate ?? submission.rate,
    billRate: submission.billRate ?? deriveBillRate(submission.rate),
    rtrStatus: submission.rtrStatus ?? 'Received',
    resumeVersion: submission.resumeVersion ?? 'Resume v1',
    clientFeedback: submission.clientFeedback ?? submission.notes,
    interviewRounds: submission.interviewRounds ?? deriveInterviewRounds(submission.status),
    offerStatus: submission.offerStatus ?? deriveOfferStatus(submission.status),
    joiningStatus: submission.joiningStatus ?? deriveJoiningStatus(submission.status),
  };
}

function deriveBillRate(payRate: string) {
  if (payRate.includes('/hr')) return payRate.replace(/(\d+)/, value => `${Number(value) + 15}`);
  return payRate;
}

function deriveInterviewRounds(status: SubmissionStatus) {
  if (status === 'Interview Scheduled') return 'Round 1 scheduled';
  if (status === 'Offer Extended' || status === 'Placed') return 'Final round completed';
  if (status === 'Rejected') return 'Client review ended';
  return 'Not started';
}

function deriveOfferStatus(status: SubmissionStatus): NonNullable<Submission['offerStatus']> {
  if (status === 'Offer Extended') return 'Extended';
  if (status === 'Placed') return 'Accepted';
  return 'Not Started';
}

function deriveJoiningStatus(status: SubmissionStatus): NonNullable<Submission['joiningStatus']> {
  return status === 'Placed' ? 'Joined' : 'Not Started';
}

function createInitialForm(): SubmissionFormState {
  const availableCandidates = getAllCandidates();
  const availableJobs = getAllJobs();
  const job = availableJobs[0];
  const candidate = availableCandidates[0];

  return {
    candidateId: candidate?.id ?? '',
    jobId: job?.id ?? '',
    clientId: job?.clientId ?? '',
    recruiter: currentOwnerName(candidate?.recruiter ?? 'SuperUser'),
    submittedDate: todayDate(),
    payRate: candidate?.salary ?? '',
    billRate: job?.salary ?? '',
    rtrStatus: 'Requested',
    resumeVersion: 'Resume v1',
    clientFeedback: '',
    status: 'Submitted',
    interviewRounds: 'Not started',
    offerStatus: 'Not Started',
    joiningStatus: 'Not Started',
    notes: '',
  };
}

export default function Submissions() {
  const navigate = useNavigate();
  const availableCandidates = getAllCandidates();
  const availableJobs = getAllJobs();
  const availableClients = getAllClients();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<SubmissionStatus | 'All'>('All');
  const [localSubmissions, setLocalSubmissions] = useState<Submission[]>(loadLocalSubmissions);
  const [showForm, setShowForm] = useState(searchParams.get('add') === '1');
  const [form, setForm] = useState<SubmissionFormState>(createInitialForm);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState(submissions[0]?.id ?? '');
  const [page, setPage] = useState(1);
  const [duplicateWarning, setDuplicateWarning] = useState('');
  const [submissionAction, setSubmissionAction] = useState<null | {
    type: 'details' | 'client-review' | 'interview' | 'offer' | 'joined';
    submission: Submission;
  }>(null);

  useEffect(() => {
    function refreshRows(event: Event) {
      const detail = (event as CustomEvent).detail;
      if (!detail || detail.key === LOCAL_SUBMISSIONS_KEY) {
        setLocalSubmissions(loadLocalSubmissions());
      }
    }
    window.addEventListener(ATS_RECORDS_UPDATED_EVENT, refreshRows);
    window.addEventListener('storage', refreshRows);
    return () => {
      window.removeEventListener(ATS_RECORDS_UPDATED_EVENT, refreshRows);
      window.removeEventListener('storage', refreshRows);
    };
  }, []);

  const allSubmissions = [
    ...submissions,
    ...localSubmissions.filter(localSubmission => !submissions.some(submission => submission.id === localSubmission.id)),
  ].map(enrichSubmission);

  const selectedSubmission = allSubmissions.find(submission => submission.id === selectedSubmissionId) ?? allSubmissions[0];
  const submittedCandidates = new Set(allSubmissions.map(submission => submission.candidateId)).size;
  const pendingClientFeedback = allSubmissions.filter(submission => ['Submitted', 'Client Review'].includes(submission.status)).length;
  const rtrReceived = allSubmissions.filter(submission => submission.rtrStatus === 'Received').length;
  const offerPipeline = allSubmissions.filter(submission => submission.offerStatus !== 'Not Started').length;

  const filtered = allSubmissions.filter(s => {
    const matchSearch = !search ||
      s.candidateName.toLowerCase().includes(search.toLowerCase()) ||
      s.jobTitle.toLowerCase().includes(search.toLowerCase()) ||
      s.clientName.toLowerCase().includes(search.toLowerCase()) ||
      s.recruiter.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'All' || s.status === statusFilter;
    return matchSearch && matchStatus;
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / SUBMISSION_PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pagedSubmissions = filtered.slice((safePage - 1) * SUBMISSION_PAGE_SIZE, safePage * SUBMISSION_PAGE_SIZE);
  const rangeStart = filtered.length ? (safePage - 1) * SUBMISSION_PAGE_SIZE + 1 : 0;
  const rangeEnd = Math.min(safePage * SUBMISSION_PAGE_SIZE, filtered.length);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const updateForm = <K extends keyof SubmissionFormState>(key: K, value: SubmissionFormState[K]) => {
    setForm(current => ({ ...current, [key]: value }));
  };

  const updateCandidate = (candidateId: string) => {
    const candidate = availableCandidates.find(item => item.id === candidateId);
    if (!candidate) return;
    setForm(current => ({
      ...current,
      candidateId,
      recruiter: current.recruiter || currentOwnerName(candidate.recruiter),
      payRate: candidate.salary,
    }));
  };

  const updateJob = (jobId: string) => {
    const job = availableJobs.find(item => item.id === jobId);
    if (!job) return;
    setForm(current => ({
      ...current,
      jobId,
      clientId: job.clientId,
      billRate: job.salary,
    }));
  };

  const findDuplicate = (candidateId = form.candidateId, jobId = form.jobId) =>
    findCandidateJobSubmission(allSubmissions, candidateId, jobId);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const candidate = availableCandidates.find(item => item.id === form.candidateId);
    const job = availableJobs.find(item => item.id === form.jobId);
    if (!candidate || !job) {
      setDuplicateWarning('Create at least one candidate and one job before creating a submission.');
      return;
    }
    const client = availableClients.find(item => item.id === form.clientId) ?? availableClients.find(item => item.id === job.clientId);
    const duplicate = findDuplicate();

    if (duplicate) {
      setDuplicateWarning(`Duplicate blocked: ${duplicateSubmissionMessage(duplicate)}`);
      return;
    }

    const submission: Submission = enrichSubmission({
      id: `submission-local-${Date.now()}`,
      candidateId: candidate.id,
      candidateName: candidate.name,
      jobId: job.id,
      jobTitle: job.title,
      clientId: client?.id ?? job.clientId,
      clientName: client?.name ?? job.client,
      status: form.status,
      submittedDate: form.submittedDate,
      recruiter: form.recruiter,
      rate: form.payRate,
      payRate: form.payRate,
      billRate: form.billRate,
      rtrStatus: form.rtrStatus,
      resumeVersion: form.resumeVersion,
      clientFeedback: form.clientFeedback || 'Awaiting client feedback.',
      interviewRounds: form.interviewRounds,
      offerStatus: form.offerStatus,
      joiningStatus: form.joiningStatus,
      notes: form.notes || 'Submission created from ATS submission management.',
    });

    const result = await createSubmissionRecord(submission);
    if (!result.ok) {
      setDuplicateWarning(result.message);
      return;
    }

    setLocalSubmissions(result.rows);
    syncCandidatePlacementStatus(candidate.id, submission.status);
    setSelectedSubmissionId(result.submission.id);
    setDuplicateWarning('');
    setShowForm(false);
  };

  const applySubmissionUpdate = (source: Submission, changes: Partial<Submission>) => {
    const updated = enrichSubmission({ ...source, ...changes });
    const nextLocalSubmissions = [
      updated,
      ...localSubmissions.filter(submission => submission.id !== updated.id),
    ];
    saveLocalSubmissions(nextLocalSubmissions);
    syncCandidatePlacementStatus(updated.candidateId, updated.status);
    setLocalSubmissions(nextLocalSubmissions);
    setSelectedSubmissionId(updated.id);
    if (updated.status === 'Offer Extended' || updated.offerStatus === 'Extended' || updated.offerStatus === 'Accepted') {
      const existingCases = loadOnboardingCases();
      const alreadyStarted = existingCases.some(item => item.candidateId === updated.candidateId && item.jobId === updated.jobId);
      if (!alreadyStarted) {
        const nextCase = createOnboardingCase(updated.candidateId, updated.jobId);
        const complianceCase = createComplianceCase(updated.candidateId, updated.jobId);
        if (nextCase) saveOnboardingCases([nextCase, ...existingCases]);
        if (complianceCase) saveComplianceCases([complianceCase, ...loadComplianceCases()]);
      }
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Submission Management</h1>
          <p className="mt-1 text-sm text-slate-500">Track every candidate submission, client response, RTR, rates, interviews, offers, joining, and duplicate risk.</p>
        </div>
        <button onClick={() => setShowForm(current => !current)} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-500">
          <Plus size={15} />
          New Submission
        </button>
      </div>

      {(!availableCandidates.length || !availableJobs.length) && showForm && (
        <div className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Add at least one candidate and one job first. Submissions will use those local ATS records after they are saved.
        </div>
      )}

      <DuplicatePreventionNotice message={duplicateWarning} className="mb-5" />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Submitted candidates" value={submittedCandidates} icon={<UserRound size={16} />} color="text-blue-400" />
        <Stat label="Pending feedback" value={pendingClientFeedback} icon={<MessageSquareText size={16} />} color="text-violet-400" />
        <Stat label="RTR received" value={rtrReceived} icon={<ClipboardCheck size={16} />} color="text-emerald-400" />
        <Stat label="Offer pipeline" value={offerPipeline} icon={<CheckCircle2 size={16} />} color="text-amber-400" />
      </div>

      {showForm && (
        <motion.form initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} onSubmit={handleSubmit} className="mb-5 rounded-lg border border-white/5 bg-[#0d1729] p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-white">Create Client Submission</h2>
            <button type="submit" className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500">
              <Send size={14} />
              Submit to Client
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SelectField label="Candidate" value={form.candidateId} onChange={updateCandidate} options={availableCandidates.map(candidate => ({ value: candidate.id, label: candidate.name }))} />
            <SelectField label="Job" value={form.jobId} onChange={updateJob} options={availableJobs.map(job => ({ value: job.id, label: `${job.title} - ${job.client}` }))} />
            <SelectField label="Client" value={form.clientId} onChange={value => updateForm('clientId', value)} options={availableClients.map(client => ({ value: client.id, label: client.name }))} />
            <Field label="Submitted by" value={form.recruiter} onChange={value => updateForm('recruiter', value)} />
            <Field label="Submission date" type="date" value={form.submittedDate} onChange={value => updateForm('submittedDate', value)} />
            <Field label="Pay rate" value={form.payRate} onChange={value => updateForm('payRate', value)} />
            <Field label="Bill rate" value={form.billRate} onChange={value => updateForm('billRate', value)} />
            <SelectField label="RTR status" value={form.rtrStatus} onChange={value => updateForm('rtrStatus', value as SubmissionFormState['rtrStatus'])} options={['Not Requested', 'Requested', 'Received', 'Expired'].map(value => ({ value, label: value }))} />
            <Field label="Resume version" value={form.resumeVersion} onChange={value => updateForm('resumeVersion', value)} />
            <SelectField label="Status" value={form.status} onChange={value => updateForm('status', value as SubmissionStatus)} options={[...statusFlow, 'Rejected'].map(value => ({ value, label: value }))} />
            <Field label="Interview rounds" value={form.interviewRounds} onChange={value => updateForm('interviewRounds', value)} />
            <SelectField label="Offer status" value={form.offerStatus} onChange={value => updateForm('offerStatus', value as SubmissionFormState['offerStatus'])} options={['Not Started', 'Discussion', 'Extended', 'Accepted', 'Declined'].map(value => ({ value, label: value }))} />
            <SelectField label="Joining status" value={form.joiningStatus} onChange={value => updateForm('joiningStatus', value as SubmissionFormState['joiningStatus'])} options={['Not Started', 'Pending', 'Confirmed', 'Joined', 'Backed Out'].map(value => ({ value, label: value }))} />
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <TextArea label="Client feedback" value={form.clientFeedback} onChange={value => updateForm('clientFeedback', value)} />
            <TextArea label="Submission notes" value={form.notes} onChange={value => updateForm('notes', value)} />
          </div>
        </motion.form>
      )}

      <div className="mb-5 flex flex-wrap gap-3">
        <div className="relative min-w-48 max-w-sm flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search candidate, job, client, recruiter..."
            className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-9 pr-4 text-sm text-slate-300 outline-none placeholder-slate-600 focus:border-blue-500/50"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {(['All', ...statusFlow, 'Rejected'] as Array<SubmissionStatus | 'All'>).map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status === statusFilter ? 'All' : status)}
              className={cn('rounded-lg border px-3 py-2 text-xs font-medium transition-all',
                statusFilter === status ? 'border-blue-600 bg-blue-600 text-white' : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20')}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-white/5 bg-[#0d1729]">
        <div className="flex flex-col gap-2 border-b border-white/5 px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Submission Records</h2>
            <p className="mt-1 text-xs text-slate-500">Showing {rangeStart}-{rangeEnd} of {filtered.length}. Use the action icons to review or move each record forward.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(current => Math.max(1, current - 1))} disabled={safePage === 1} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10 disabled:opacity-40">Previous</button>
            <span className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-400">Page {safePage} / {pageCount}</span>
            <button onClick={() => setPage(current => Math.min(pageCount, current + 1))} disabled={safePage === pageCount} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10 disabled:opacity-40">Next</button>
          </div>
        </div>
        <div className="max-h-[65vh] space-y-2 overflow-auto p-3 [scrollbar-gutter:stable]">
          {pagedSubmissions.length ? pagedSubmissions.map(submission => (
            <div
              key={submission.id}
              className={cn(
                'grid gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 transition-colors xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1.2fr)_140px_150px_auto]',
                selectedSubmission?.id === submission.id && 'border-blue-500/30 bg-blue-500/10'
              )}
            >
              <div className="min-w-0">
                <button
                  onClick={() => navigate(`/candidates/${submission.candidateId}`)}
                  className="truncate text-left text-sm font-semibold text-white transition-colors hover:text-blue-400"
                >
                  {submission.candidateName}
                </button>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                  <span>{submission.recruiter}</span>
                  <span>{submission.submittedDate}</span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-slate-300">
                    {submission.rtrStatus}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-slate-300">
                    {submission.resumeVersion}
                  </span>
                </div>
              </div>

              <div className="min-w-0">
                <button
                  onClick={() => navigate(`/jobs/${submission.jobId}`)}
                  className="block truncate text-left text-sm text-slate-200 transition-colors hover:text-blue-400"
                >
                  {submission.jobTitle}
                </button>
                <button
                  onClick={() => navigate(`/clients/${submission.clientId}`)}
                  className="mt-1 block truncate text-left text-xs text-slate-500 transition-colors hover:text-blue-400"
                >
                  {submission.clientName}
                </button>
              </div>

              <div className="flex items-center xl:justify-center">
                <span className={cn('whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium', statusColors[submission.status])}>
                  {submission.status}
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs xl:justify-center">
                <div>
                  <p className="font-medium text-white">{submission.payRate ?? submission.rate}</p>
                  <p className="text-slate-500">{submission.billRate ?? 'Bill rate n/a'}</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 xl:justify-end">
                <QuickIconButton title="See submission details" onClick={() => { setSelectedSubmissionId(submission.id); setSubmissionAction({ type: 'details', submission }); }}>
                  <Eye size={14} />
                </QuickIconButton>
                <QuickIconButton title="Move to client review" onClick={() => setSubmissionAction({ type: 'client-review', submission })}>
                  <MessageSquareText size={14} />
                </QuickIconButton>
                <QuickIconButton title="Schedule interview status" onClick={() => setSubmissionAction({ type: 'interview', submission })}>
                  <ClipboardCheck size={14} />
                </QuickIconButton>
                <QuickIconButton title="Move to offer" onClick={() => setSubmissionAction({ type: 'offer', submission })}>
                  <CheckCircle2 size={14} />
                </QuickIconButton>
                <QuickIconButton title="Mark joined / placed" onClick={() => setSubmissionAction({ type: 'joined', submission })}>
                  <UserRoundCheck size={14} />
                </QuickIconButton>
              </div>
            </div>
          )) : (
            <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-10 text-center text-sm text-slate-500">
              No submission records match the current filters.
            </div>
          )}
        </div>
      </div>

      {submissionAction && (
        <QuickActionModal
          title={
            submissionAction.type === 'details' ? 'Submission Details' :
              submissionAction.type === 'client-review' ? 'Move to Client Review' :
                submissionAction.type === 'interview' ? 'Schedule Interview Status' :
                  submissionAction.type === 'offer' ? 'Move to Offer' : 'Mark Joined / Placed'
          }
          subtitle={`${submissionAction.submission.candidateName} - ${submissionAction.submission.jobTitle}`}
          onCancel={() => setSubmissionAction(null)}
          onSave={submissionAction.type === 'details' ? undefined : () => {
            const changes: Partial<Submission> =
              submissionAction.type === 'client-review'
                ? { status: 'Client Review', clientFeedback: 'Awaiting detailed client feedback.' }
                : submissionAction.type === 'interview'
                  ? { status: 'Interview Scheduled', interviewRounds: 'Round 1 scheduled' }
                  : submissionAction.type === 'offer'
                    ? { status: 'Offer Extended', offerStatus: 'Extended' }
                    : { status: 'Placed', offerStatus: 'Accepted', joiningStatus: 'Joined' };
            applySubmissionUpdate(submissionAction.submission, changes);
            setSubmissionAction(null);
          }}
          saveLabel="Save / Update"
        >
          <div className="grid gap-3 md:grid-cols-2">
            <MiniCard label="Candidate" value={submissionAction.submission.candidateName} />
            <MiniCard label="Job" value={submissionAction.submission.jobTitle} />
            <MiniCard label="Client" value={submissionAction.submission.clientName} />
            <MiniCard label="Current status" value={submissionAction.submission.status} />
            <MiniCard label="RTR status" value={submissionAction.submission.rtrStatus ?? 'Not specified'} />
            <MiniCard label="Resume version" value={submissionAction.submission.resumeVersion ?? 'Not specified'} />
          </div>
          {submissionAction.type === 'details' && (
            <>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <Info icon={<UserRound size={14} />} label="Candidate" value={submissionAction.submission.candidateName} />
                <Info icon={<Briefcase size={14} />} label="Job" value={submissionAction.submission.jobTitle} />
                <Info icon={<FileText size={14} />} label="Client" value={submissionAction.submission.clientName} />
                <Info icon={<Send size={14} />} label="Submitted by" value={submissionAction.submission.recruiter} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
                <MiniCard label="Pay rate" value={submissionAction.submission.payRate ?? submissionAction.submission.rate} />
                <MiniCard label="Bill rate" value={submissionAction.submission.billRate ?? 'Not specified'} />
                <MiniCard label="Interview rounds" value={submissionAction.submission.interviewRounds ?? 'Not started'} />
                <MiniCard label="Offer status" value={submissionAction.submission.offerStatus ?? 'Not Started'} />
                <MiniCard label="Joining status" value={submissionAction.submission.joiningStatus ?? 'Not Started'} />
                <MiniCard label="Submitted date" value={submissionAction.submission.submittedDate} />
              </div>
            </>
          )}
          <div className="mt-4 rounded-lg border border-white/5 bg-white/[0.03] p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Action details</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              {submissionAction.type === 'details'
                ? submissionAction.submission.notes
                : 'Click Save / Update to apply this action and persist the submission record to the ATS backend/database.'}
            </p>
          </div>
          {submissionAction.type === 'details' && (
            <div className="mt-4 rounded-lg border border-white/5 bg-white/[0.03] p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Client feedback</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">{submissionAction.submission.clientFeedback}</p>
            </div>
          )}
          {submissionAction.type === 'details' && (
            <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
              <ActionButton label="Client Review" onClick={() => setSubmissionAction({ type: 'client-review', submission: submissionAction.submission })} />
              <ActionButton label="Interview" onClick={() => setSubmissionAction({ type: 'interview', submission: submissionAction.submission })} />
              <ActionButton label="Offer" onClick={() => setSubmissionAction({ type: 'offer', submission: submissionAction.submission })} />
              <ActionButton label="Joined" onClick={() => setSubmissionAction({ type: 'joined', submission: submissionAction.submission })} />
            </div>
          )}
        </QuickActionModal>
      )}
    </div>
  );
}

function Stat({ label, value, icon, color }: { label: string; value: number; icon: ReactNode; color: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-[#0d1729] p-4">
      <div className="flex items-center justify-between gap-3">
        <span className={cn('opacity-80', color)}>{icon}</span>
        <p className={cn('text-2xl font-bold', color)}>{value}</p>
      </div>
      <p className="mt-2 text-xs text-slate-500">{label}</p>
    </div>
  );
}

function DuplicatePreventionNotice({ message, className }: { message?: string; className?: string }) {
  return (
    <section className={cn('rounded-lg border border-amber-500/20 bg-amber-500/10 p-4', className)}>
      <div className="flex items-start gap-3">
        <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-amber-300" />
        <div>
          <h2 className="text-sm font-semibold text-amber-100">Duplicate Prevention</h2>
          {message && <p className="mt-1 text-sm text-amber-100">{message}</p>}
          <p className="mt-2 text-sm leading-relaxed text-amber-100/80">
            New submissions are blocked when the same candidate is already submitted to the same job, regardless of which ATS user tries to submit.
          </p>
          <p className="mt-2 text-xs text-amber-200/70">
            The same candidate can still be submitted to other jobs, and every accepted submission stores submitter and timestamp metadata.
          </p>
        </div>
      </div>
    </section>
  );
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-500">{label}</span>
      <input
        type={type}
        value={value}
        onChange={event => onChange(event.target.value)}
        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-blue-500/50"
      />
    </label>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-500">{label}</span>
      <textarea
        rows={4}
        value={value}
        onChange={event => onChange(event.target.value)}
        className="w-full resize-y rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm leading-relaxed text-slate-200 outline-none focus:border-blue-500/50"
      />
    </label>
  );
}

function SelectField({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-500">{label}</span>
      <select
        value={value}
        onChange={event => onChange(event.target.value)}
        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-blue-500/50"
      >
        {options.map(option => (
          <option key={option.value} value={option.value} className="bg-[#0d1729] text-slate-200">
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Info({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2.5 text-sm">
      <span className="text-slate-600">{icon}</span>
      <span className="w-24 flex-shrink-0 text-xs text-slate-500">{label}</span>
      <span className="min-w-0 break-words text-slate-200">{value}</span>
    </div>
  );
}

function MiniCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.03] p-3">
      <p className="text-[10px] uppercase tracking-wider text-slate-600">{label}</p>
      <p className="mt-1 text-sm font-medium text-white">{value}</p>
    </div>
  );
}

function ActionButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white">
      {label}
    </button>
  );
}
