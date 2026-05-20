import { FormEvent, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BadgeDollarSign, CalendarClock, CheckCircle2, CircleDollarSign,
  FileSignature, Plus, UserCheck, X,
} from 'lucide-react';
import { ATS_DATA_UPDATED_EVENT, LOCAL_CANDIDATES_KEY, readLocalRows, saveRows } from '@/lib/atsApi';
import { ATS_RECORDS_UPDATED_EVENT } from '@/lib/atsLocalStore';
import { getAllCandidateDocuments, getAllCandidates, getAllJobs, getAllSubmissions } from '@/lib/localRecords';
import { createComplianceCase, createOnboardingCase, loadComplianceCases, loadOnboardingCases, saveComplianceCases, saveOnboardingCases } from '@/lib/onboardingStore';
import { createSubmissionRecord, findCandidateJobSubmission } from '@/lib/submissionStore';
import type { Candidate, Submission } from '@/lib/types';
import { cn } from '@/lib/utils';

type OfferStatus = NonNullable<Submission['offerStatus']>;
type JoiningStatus = NonNullable<Submission['joiningStatus']>;
type OfferDisplayStatus = OfferStatus | 'Completed' | 'Placed';

type OfferFormState = {
  candidateId: string;
  jobId: string;
  payRate: string;
  billRate: string;
  offerStatus: OfferStatus;
  joiningStatus: JoiningStatus;
  startDate: string;
  documents: string;
  notes: string;
};

type CandidateStorageRow = Candidate & Record<string, unknown>;

const statusTone: Record<string, string> = {
  Discussion: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
  Extended: 'bg-violet-500/10 text-violet-300 border-violet-500/20',
  Completed: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  Accepted: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  Placed: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  Declined: 'bg-red-500/10 text-red-300 border-red-500/20',
};

function todayDate(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function offerStatusFromCandidate(candidate: Candidate) {
  return candidate.status === 'Placed' ? 'Placed' : 'Extended';
}

function joiningStatusFromCandidate(candidate: Candidate) {
  return candidate.status === 'Placed' ? 'Joined' : 'Pending';
}

function hasVerifiedOfferLetter(candidateId: string) {
  return getAllCandidateDocuments().some(document =>
    document.candidateId === candidateId &&
    document.type === 'Offer letter' &&
    document.status === 'Verified'
  );
}

function createInitialForm(): OfferFormState {
  const candidates = getAllCandidates();
  const jobs = getAllJobs();
  const candidate = candidates.find(item => item.status === 'Offer') ?? candidates.find(item => item.status === 'Placed') ?? candidates[0];
  const job = jobs[0];

  return {
    candidateId: candidate?.id ?? '',
    jobId: job?.id ?? '',
    payRate: candidate?.salary ?? '',
    billRate: job?.salary ?? '',
    offerStatus: 'Extended',
    joiningStatus: 'Pending',
    startDate: todayDate(14),
    documents: 'Offer letter pending',
    notes: 'Offer created from offer management.',
  };
}

function deriveOfferRows() {
  const candidates = getAllCandidates();
  const jobs = getAllJobs();
  const submissions = getAllSubmissions();
  const rows = new Map<string, {
    id: string;
    candidateId: string;
    jobId?: string;
    candidate: string;
    job: string;
    client: string;
    recruiter: string;
    payRate: string;
    billRate: string;
    offerStatus: OfferDisplayStatus;
    joiningStatus: JoiningStatus;
    startDate: string;
    documents: string;
    notes: string;
  }>();

  submissions
    .filter(submission =>
      submission.status === 'Offer Extended' ||
      submission.status === 'Placed' ||
      submission.offerStatus === 'Discussion' ||
      submission.offerStatus === 'Extended' ||
      submission.offerStatus === 'Accepted' ||
      submission.offerStatus === 'Declined'
    )
    .forEach(submission => {
      const candidate = candidates.find(item => item.id === submission.candidateId);
      const job = jobs.find(item => item.id === submission.jobId);
      const offerDocumentCompleted = submission.offerDocumentStatus === 'Completed' || hasVerifiedOfferLetter(submission.candidateId);
      rows.set(`submission-${submission.id}`, {
        id: `offer-${submission.id}`,
        candidateId: submission.candidateId,
        jobId: submission.jobId,
        candidate: submission.candidateName,
        job: submission.jobTitle,
        client: submission.clientName,
        recruiter: submission.recruiter,
        payRate: submission.payRate ?? submission.rate,
        billRate: submission.billRate ?? job?.salary ?? 'Open',
        offerStatus: offerDocumentCompleted ? 'Completed' : submission.status === 'Placed' ? 'Placed' : submission.offerStatus ?? 'Extended',
        joiningStatus: submission.joiningStatus ?? (submission.status === 'Placed' ? 'Joined' : 'Pending'),
        startDate: submission.createdAt?.slice(0, 10) ?? todayDate(14),
        documents: offerDocumentCompleted ? 'Offer letter verified' : candidate?.status === 'Placed' ? 'Offer letter signed' : 'Offer letter pending',
        notes: submission.notes,
      });
    });

  candidates
    .filter(candidate => candidate.status === 'Offer' || candidate.status === 'Placed')
    .forEach(candidate => {
      if ([...rows.values()].some(row => row.candidateId === candidate.id)) return;
      rows.set(`candidate-${candidate.id}`, {
        id: `offer-candidate-${candidate.id}`,
        candidateId: candidate.id,
        candidate: candidate.name,
        job: 'Offer job pending',
        client: 'Client pending',
        recruiter: candidate.recruiter,
        payRate: candidate.salary,
        billRate: 'Open',
        offerStatus: hasVerifiedOfferLetter(candidate.id) ? 'Completed' : offerStatusFromCandidate(candidate),
        joiningStatus: joiningStatusFromCandidate(candidate),
        startDate: todayDate(14),
        documents: hasVerifiedOfferLetter(candidate.id) ? 'Offer letter verified' : 'Offer letter pending',
        notes: 'Candidate moved to Offer status. Create or link an offer record with New Offer.',
      });
    });

  return Array.from(rows.values());
}

function updateCandidateOfferStatus(candidateId: string, status: Candidate['status']) {
  const rows = readLocalRows<CandidateStorageRow>(LOCAL_CANDIDATES_KEY);
  const nextRows = rows.map(row => row.id === candidateId
    ? { ...row, status, updatedAt: todayDate() }
    : row
  );
  saveRows('candidates', nextRows as Candidate[]);
}

export default function Offers() {
  const [refreshKey, setRefreshKey] = useState(0);
  const availableCandidates = useMemo(() => getAllCandidates(), [refreshKey]);
  const availableJobs = useMemo(() => getAllJobs(), [refreshKey]);
  const [offerRows, setOfferRows] = useState(deriveOfferRows);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<OfferFormState>(createInitialForm);
  const [notice, setNotice] = useState('');

  const metrics = useMemo(() => [
    { label: 'Active offers', value: offerRows.length, icon: BadgeDollarSign, tone: 'text-violet-300 bg-violet-500/10' },
    { label: 'Offer extended', value: offerRows.filter(row => row.offerStatus === 'Extended').length, icon: FileSignature, tone: 'text-blue-300 bg-blue-500/10' },
    { label: 'Placed', value: offerRows.filter(row => row.offerStatus === 'Placed' || row.offerStatus === 'Accepted').length, icon: CheckCircle2, tone: 'text-emerald-300 bg-emerald-500/10' },
    { label: 'Joining pending', value: offerRows.filter(row => row.joiningStatus === 'Pending').length, icon: CalendarClock, tone: 'text-amber-300 bg-amber-500/10' },
  ], [offerRows]);

  useEffect(() => {
    const refresh = () => {
      setRefreshKey(value => value + 1);
      setOfferRows(deriveOfferRows());
    };
    window.addEventListener(ATS_DATA_UPDATED_EVENT, refresh);
    window.addEventListener(ATS_RECORDS_UPDATED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(ATS_DATA_UPDATED_EVENT, refresh);
      window.removeEventListener(ATS_RECORDS_UPDATED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  function updateForm<K extends keyof OfferFormState>(key: K, value: OfferFormState[K]) {
    setForm(current => ({ ...current, [key]: value }));
  }

  function syncCandidate(candidateId: string) {
    const candidate = availableCandidates.find(item => item.id === candidateId);
    updateForm('candidateId', candidateId);
    if (candidate) updateForm('payRate', candidate.salary);
  }

  function syncJob(jobId: string) {
    const job = availableJobs.find(item => item.id === jobId);
    updateForm('jobId', jobId);
    if (job) updateForm('billRate', job.salary);
  }

  async function handleOfferSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const candidate = availableCandidates.find(item => item.id === form.candidateId);
    const job = availableJobs.find(item => item.id === form.jobId);

    if (!candidate || !job) {
      setNotice('Select a candidate and job before creating an offer.');
      return;
    }

    const existing = findCandidateJobSubmission(getAllSubmissions(), candidate.id, job.id);
    const submission: Submission = {
      ...(existing ?? {}),
      id: existing?.id ?? `offer-${Date.now()}-${candidate.id}-${job.id}`,
      candidateId: candidate.id,
      candidateName: candidate.name,
      jobId: job.id,
      jobTitle: job.title,
      clientId: job.clientId,
      clientName: job.client,
      status: form.offerStatus === 'Accepted' ? 'Placed' : 'Offer Extended',
      submittedDate: existing?.submittedDate ?? todayDate(),
      recruiter: candidate.recruiter,
      rate: form.payRate,
      payRate: form.payRate,
      billRate: form.billRate,
      rtrStatus: existing?.rtrStatus ?? 'Received',
      resumeVersion: existing?.resumeVersion ?? candidate.resume ?? `${candidate.name.replace(/\s+/g, '_')}_Resume.pdf`,
      clientFeedback: existing?.clientFeedback ?? 'Offer in progress.',
      interviewRounds: existing?.interviewRounds ?? 'Final round completed',
      offerStatus: form.offerStatus,
      joiningStatus: form.joiningStatus,
      notes: form.notes || `Offer start date: ${form.startDate}. ${form.documents}`,
    };

    const result = existing
      ? await saveExistingOffer(submission)
      : await createSubmissionRecord(submission);

    if (!result.ok) {
      setNotice(result.message);
      return;
    }

    updateCandidateOfferStatus(candidate.id, form.offerStatus === 'Accepted' ? 'Placed' : 'Offer');
    ensureOfferOnboarding(candidate.id, job.id);
    setOfferRows(deriveOfferRows());
    setNotice(`${candidate.name} offer saved for ${job.title}.`);
    setShowForm(false);
  }

  async function saveExistingOffer(submission: Submission) {
    const rows = getAllSubmissions();
    const nextRows = [submission, ...rows.filter(row => row.id !== submission.id)];
    saveRows('submissions', nextRows);
    return { ok: true as const, submission, rows: nextRows, message: 'Offer updated.' };
  }

  function ensureOfferOnboarding(candidateId: string, jobId: string) {
    const existingCases = loadOnboardingCases();
    if (!existingCases.some(item => item.candidateId === candidateId && item.jobId === jobId)) {
      const onboardingCase = createOnboardingCase(candidateId, jobId);
      if (onboardingCase) saveOnboardingCases([onboardingCase, ...existingCases]);
    }

    const complianceCases = loadComplianceCases();
    if (!complianceCases.some(item => item.candidateId === candidateId && item.jobId === jobId)) {
      const complianceCase = createComplianceCase(candidateId, jobId);
      if (complianceCase) saveComplianceCases([complianceCase, ...complianceCases]);
    }
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
            <CircleDollarSign size={14} />
            Offer and placement desk
          </div>
          <h1 className="text-2xl font-bold text-white">Offers</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Track candidates moved to Offer status, offer letters, accepted offers, joining status, pay/bill rates, and placement handoff.
          </p>
        </div>
        <button onClick={() => { setForm(createInitialForm()); setShowForm(true); setNotice(''); }} className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500">
          <Plus size={15} />
          New Offer
        </button>
      </div>

      {notice && (
        <div className="mb-5 rounded-lg border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm text-blue-100">
          {notice}
        </div>
      )}

      <div className="mb-5 grid gap-4 md:grid-cols-4">
        {metrics.map(metric => (
          <div key={metric.label} className="rounded-lg border border-white/5 bg-[#0d1729] p-4">
            <div className={cn('mb-3 flex h-9 w-9 items-center justify-center rounded-lg', metric.tone)}>
              <metric.icon size={17} />
            </div>
            <p className="text-2xl font-bold text-white">{metric.value}</p>
            <p className="text-xs text-slate-500">{metric.label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-white/5 bg-[#0d1729]">
        <div className="grid grid-cols-[minmax(220px,1fr)_minmax(220px,1fr)_150px_140px_140px_minmax(220px,1fr)] gap-4 border-b border-white/5 px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          <span>Candidate</span>
          <span>Role / Client</span>
          <span>Offer status</span>
          <span>Pay rate</span>
          <span>Bill rate</span>
          <span>Joining and notes</span>
        </div>
        <div className="divide-y divide-white/5">
          {offerRows.map((row, index) => (
            <motion.div
              key={row.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              className="grid grid-cols-[minmax(220px,1fr)_minmax(220px,1fr)_150px_140px_140px_minmax(220px,1fr)] gap-4 px-4 py-4"
            >
              <div>
                <p className="font-semibold text-white">{row.candidate}</p>
                <p className="text-xs text-slate-500">{row.recruiter}</p>
              </div>
              <div>
                <p className="text-sm text-slate-200">{row.job}</p>
                <p className="text-xs text-slate-500">{row.client}</p>
              </div>
              <div>
                <span className={cn('inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold', statusTone[row.offerStatus] ?? statusTone.Extended)}>
                  {row.offerStatus}
                </span>
              </div>
              <p className="text-sm font-semibold text-white">{row.payRate}</p>
              <p className="text-sm font-semibold text-white">{row.billRate}</p>
              <div className="text-xs text-slate-500">
                <div className="mb-1 flex items-center gap-1.5 text-slate-300">
                  <UserCheck size={13} />
                  {row.joiningStatus} · {row.startDate}
                </div>
                <p>{row.documents}</p>
                <p className="mt-1 line-clamp-2">{row.notes}</p>
              </div>
            </motion.div>
          ))}
        </div>
        {!offerRows.length && (
          <div className="py-16 text-center text-slate-600">
            <FileSignature size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No offers yet. Move a candidate to Offer or use New Offer.</p>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
          <motion.form
            initial={{ opacity: 0, x: 32 }}
            animate={{ opacity: 1, x: 0 }}
            onSubmit={handleOfferSubmit}
            className="h-full w-full max-w-2xl overflow-y-auto border-l border-white/10 bg-[#08111f] shadow-2xl"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#08111f]/95 px-6 py-4 backdrop-blur">
              <h2 className="text-lg font-semibold text-white">Create New Offer</h2>
              <button type="button" aria-label="Close" onClick={() => setShowForm(false)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-5 p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField label="Candidate" value={form.candidateId} onChange={syncCandidate} options={availableCandidates.map(candidate => ({ value: candidate.id, label: `${candidate.name} · ${candidate.status}` }))} />
                <SelectField label="Job" value={form.jobId} onChange={syncJob} options={availableJobs.map(job => ({ value: job.id, label: `${job.title} · ${job.client}` }))} />
                <Field label="Pay rate" value={form.payRate} onChange={value => updateForm('payRate', value)} />
                <Field label="Bill rate" value={form.billRate} onChange={value => updateForm('billRate', value)} />
                <SelectField label="Offer status" value={form.offerStatus} onChange={value => updateForm('offerStatus', value as OfferStatus)} options={['Discussion', 'Extended', 'Accepted', 'Declined'].map(value => ({ value, label: value }))} />
                <SelectField label="Joining status" value={form.joiningStatus} onChange={value => updateForm('joiningStatus', value as JoiningStatus)} options={['Not Started', 'Pending', 'Confirmed', 'Joined', 'Backed Out'].map(value => ({ value, label: value }))} />
                <Field label="Start date" type="date" value={form.startDate} onChange={value => updateForm('startDate', value)} />
                <Field label="Documents" value={form.documents} onChange={value => updateForm('documents', value)} />
              </div>
              <TextArea label="Offer notes" value={form.notes} onChange={value => updateForm('notes', value)} />
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setShowForm(false)} className="rounded-lg bg-white/5 px-4 py-3 text-sm font-semibold text-slate-300 hover:bg-white/10">Cancel</button>
                <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500">
                  <FileSignature size={15} />
                  Save Offer
                </button>
              </div>
            </div>
          </motion.form>
        </div>
      )}
    </div>
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
