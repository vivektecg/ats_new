import { useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Download,
  FileSignature,
  Eye,
  Play,
  Send,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { QuickActionModal, QuickIconButton } from '@/components/ats/QuickActionModal';
import { getAllCandidates, getAllJobs, getAllSubmissions } from '@/lib/localRecords';
import {
  createComplianceCase,
  createOnboardingCase,
  loadComplianceCases,
  loadOnboardingCases,
  progressForTasks,
  saveComplianceCases,
  saveOnboardingCases,
  type OnboardingCase,
  type TaskStatus,
} from '@/lib/onboardingStore';
import { cn } from '@/lib/utils';

const statusTone: Record<TaskStatus, string> = {
  Pending: 'border-slate-500/20 bg-slate-500/10 text-slate-300',
  'In Progress': 'border-blue-500/20 bg-blue-500/10 text-blue-300',
  Completed: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
  'Needs Review': 'border-amber-500/20 bg-amber-500/10 text-amber-300',
};

function todayLabel() {
  return new Date().toLocaleDateString();
}

export default function Onboarding() {
  const candidates = getAllCandidates();
  const jobs = getAllJobs();
  const [cases, setCases] = useState<OnboardingCase[]>(() => {
    const loadedCases = loadOnboardingCases();
    const offerSubmissions = getAllSubmissions().filter(submission =>
      submission.status === 'Offer Extended' ||
      submission.status === 'Placed' ||
      submission.offerStatus === 'Extended' ||
      submission.offerStatus === 'Accepted'
    );
    const offerCandidates = candidates.filter(candidate => candidate.status === 'Offer' || candidate.status === 'Placed');
    const generatedCases = [
      ...offerSubmissions.map(submission => createOnboardingCase(submission.candidateId, submission.jobId)),
      ...offerCandidates.map(candidate => createOnboardingCase(candidate.id, jobs[0]?.id)),
    ].filter(Boolean) as OnboardingCase[];
    const nextCases = [...loadedCases];
    generatedCases.forEach(item => {
      if (!nextCases.some(existing => existing.candidateId === item.candidateId && existing.jobId === item.jobId)) {
        nextCases.unshift({
          ...item,
          activity: [`Auto-created from Offer status on ${todayLabel()}.`, ...item.activity],
        });
      }
    });
    if (nextCases.length !== loadedCases.length) saveOnboardingCases(nextCases);
    return nextCases;
  });
  const [candidateId, setCandidateId] = useState(candidates[0]?.id ?? '');
  const [jobId, setJobId] = useState(jobs[0]?.id ?? '');
  const [selectedCaseId, setSelectedCaseId] = useState(cases[0]?.id ?? '');
  const [notice, setNotice] = useState('Onboarding workspace ready.');
  const [caseAction, setCaseAction] = useState<null | { type: 'details' | 'checklist' | 'esign' | 'packet' | 'version'; item: OnboardingCase }>(null);

  const selectedCase = cases.find(item => item.id === selectedCaseId) ?? cases[0];
  const overdueTasks = cases.flatMap(item => item.tasks).filter(task => task.status !== 'Completed' && new Date(task.dueDate) < new Date(new Date().toISOString().slice(0, 10)));
  const completedCases = cases.filter(item => item.status === 'Completed');
  const compliancePending = cases.filter(item => item.i9Status !== 'Verified' || item.eVerifyStatus === 'Pending' || item.backgroundStatus !== 'Verified');

  function persist(nextCases: OnboardingCase[], message: string) {
    setCases(nextCases);
    saveOnboardingCases(nextCases);
    setNotice(message);
  }

  function startOnboarding() {
    const existing = cases.find(item => item.candidateId === candidateId && item.jobId === jobId);
    if (existing) {
      setSelectedCaseId(existing.id);
      setNotice(`${existing.candidateName} already has onboarding for ${existing.jobTitle}.`);
      return;
    }
    const nextCase = createOnboardingCase(candidateId, jobId);
    if (!nextCase) {
      setNotice('Add at least one candidate and one job before starting onboarding.');
      return;
    }
    const complianceCase = createComplianceCase(nextCase.candidateId, nextCase.jobId);
    const nextCases = [nextCase, ...cases];
    setCases(nextCases);
    saveOnboardingCases(nextCases);
    if (complianceCase) saveComplianceCases([complianceCase, ...loadComplianceCases()]);
    setSelectedCaseId(nextCase.id);
    setNotice(`Onboarding and compliance case started for ${nextCase.candidateName}.`);
  }

  function updateCase(caseId: string, updater: (item: OnboardingCase) => OnboardingCase, message: string) {
    persist(cases.map(item => item.id === caseId ? updater(item) : item), message);
  }

  function updateTask(caseId: string, taskId: string, status: TaskStatus) {
    updateCase(caseId, item => {
      const tasks = item.tasks.map(task => task.id === taskId ? { ...task, status } : task);
      const progress = progressForTasks(tasks);
      return {
        ...item,
        tasks,
        status: progress === 100 ? 'Completed' : status === 'Needs Review' ? 'Blocked' : 'In Progress',
        i9Status: taskId.startsWith('i9') && status === 'Completed' ? 'Verified' : item.i9Status,
        eVerifyStatus: taskId === 'everify' && status === 'Completed' ? 'Verified' : item.eVerifyStatus,
        backgroundStatus: taskId === 'background' && status === 'Completed' ? 'Verified' : item.backgroundStatus,
        activity: [`${taskId} marked ${status} on ${todayLabel()}.`, ...item.activity],
        updatedAt: new Date().toISOString(),
      };
    }, `Task updated to ${status}.`);
  }

  function sendPacket(caseId: string) {
    updateCase(caseId, item => ({
      ...item,
      packetSentAt: new Date().toISOString(),
      activity: [`Onboarding packet sent to ${item.candidateName}.`, ...item.activity],
      updatedAt: new Date().toISOString(),
    }), 'Onboarding packet sent and timeline updated.');
  }

  function requestSignature(caseId: string) {
    updateCase(caseId, item => ({
      ...item,
      eSignatureStatus: 'Sent',
      tasks: item.tasks.map(task => task.id === 'offer-signature' ? { ...task, status: 'In Progress' } : task),
      activity: [`Offer/NDA e-signature requested on ${todayLabel()}.`, ...item.activity],
      updatedAt: new Date().toISOString(),
    }), 'E-signature request recorded.');
  }

  function attachTaskDocument(caseId: string, taskId: string, direction: 'Sent' | 'Received', fileName?: string) {
    updateCase(caseId, item => {
      const task = item.tasks.find(row => row.id === taskId);
      const resolvedFileName = fileName || `${item.candidateName.replace(/\s+/g, '_')}_${task?.category ?? 'Onboarding'}_${taskId}.pdf`;
      const document = {
        id: `onb-doc-${Date.now()}-${taskId}`,
        taskId,
        fileName: resolvedFileName,
        direction,
        uploadedAt: new Date().toISOString(),
        uploadedBy: direction === 'Sent' ? item.recruiter : item.candidateName,
        notes: `${direction} document for ${task?.title ?? taskId}.`,
      };
      return {
        ...item,
        tasks: item.tasks.map(row => row.id === taskId ? {
          ...row,
          status: direction === 'Received' ? 'Needs Review' : row.status === 'Pending' ? 'In Progress' : row.status,
          documents: [document, ...(row.documents ?? [])],
        } : row),
        activity: [`${direction} document ${resolvedFileName} recorded for ${task?.title ?? taskId}.`, ...item.activity],
        updatedAt: new Date().toISOString(),
      };
    }, `${direction} document recorded for onboarding task.`);
  }

  function exportCase(item: OnboardingCase) {
    const blob = new Blob([JSON.stringify(item, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `eventus-onboarding-${item.candidateId}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice(`Onboarding checklist exported for ${item.candidateName}.`);
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Onboarding</h1>
          <p className="mt-1 text-sm text-slate-500">Offer handoff, e-signatures, onboarding packet, I-9/E-Verify preparation, background checks, payroll, equipment, and first-day readiness.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-[220px_220px_auto]">
          <Select value={candidateId} onChange={setCandidateId} options={candidates.map(candidate => ({ value: candidate.id, label: candidate.name }))} />
          <Select value={jobId} onChange={setJobId} options={jobs.map(job => ({ value: job.id, label: `${job.title} - ${job.client}` }))} />
          <button onClick={startOnboarding} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500">
            <Play size={15} />
            Start Onboarding
          </button>
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm text-blue-100">{notice}</div>

      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-5">
        <Metric label="Active onboarding" value={cases.filter(item => item.status !== 'Completed').length} icon={<UserRound size={16} />} color="text-blue-400" />
        <Metric label="Completed" value={completedCases.length} icon={<CheckCircle2 size={16} />} color="text-emerald-400" />
        <Metric label="Compliance pending" value={compliancePending.length} icon={<ShieldCheck size={16} />} color="text-amber-400" />
        <Metric label="Overdue tasks" value={overdueTasks.length} icon={<CalendarDays size={16} />} color="text-red-400" />
        <Metric label="Packets sent" value={cases.filter(item => item.packetSentAt).length} icon={<Send size={16} />} color="text-violet-400" />
      </div>

      <div className="grid gap-5">
        <main className="space-y-5">
          <section className="rounded-lg border border-white/5 bg-[#0d1729]">
            <div className="border-b border-white/5 px-5 py-4">
              <h2 className="text-sm font-semibold text-white">Onboarding Cases</h2>
            </div>
            {cases.length ? cases.map(item => {
              const progress = progressForTasks(item.tasks);
              const active = selectedCase?.id === item.id;
              return (
                <div key={item.id} role="button" tabIndex={0} onClick={() => setSelectedCaseId(item.id)} className={cn('grid w-full gap-4 border-b border-white/5 px-5 py-4 text-left last:border-0 lg:grid-cols-[1.2fr_1fr_140px_110px_180px]', active ? 'bg-blue-500/10' : 'hover:bg-white/[0.03]')}>
                  <div>
                    <p className="text-sm font-semibold text-white">{item.candidateName}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.jobTitle} - {item.clientName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-300">{item.recruiter}</p>
                    <p className="mt-1 text-[11px] text-slate-600">Start date {item.startDate}</p>
                  </div>
                  <div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/5">
                      <div className="h-full rounded-full bg-blue-500" style={{ width: `${progress}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{progress}% complete</p>
                  </div>
                  <span className={cn('rounded-full border px-2 py-1 text-center text-xs', item.status === 'Completed' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : item.status === 'Blocked' ? 'border-amber-500/20 bg-amber-500/10 text-amber-300' : 'border-blue-500/20 bg-blue-500/10 text-blue-300')}>{item.status}</span>
                  <div className="flex items-center gap-1.5">
                    <QuickIconButton title="Case details" onClick={() => setCaseAction({ type: 'details', item })}><Eye size={14} /></QuickIconButton>
                    <QuickIconButton title="Checklist" onClick={() => setCaseAction({ type: 'checklist', item })}><ClipboardList size={14} /></QuickIconButton>
                    <QuickIconButton title="E-sign" onClick={() => setCaseAction({ type: 'esign', item })}><FileSignature size={14} /></QuickIconButton>
                    <QuickIconButton title="Packet" onClick={() => setCaseAction({ type: 'packet', item })}><Send size={14} /></QuickIconButton>
                    <QuickIconButton title="Version / export" onClick={() => setCaseAction({ type: 'version', item })}><Download size={14} /></QuickIconButton>
                  </div>
                </div>
              );
            }) : (
              <div className="p-10 text-center">
                <ClipboardList size={30} className="mx-auto mb-3 text-slate-700" />
                <p className="text-sm font-semibold text-white">No onboarding cases yet.</p>
                <p className="mt-1 text-xs text-slate-500">Select a candidate and job, then start onboarding.</p>
              </div>
            )}
          </section>

        </main>
      </div>

      {caseAction && (
        <QuickActionModal
          title={
            caseAction.type === 'details' ? 'Onboarding Case Details' :
              caseAction.type === 'checklist' ? 'Onboarding Checklist' :
                caseAction.type === 'esign' ? 'Send E-Sign Request' :
                  caseAction.type === 'packet' ? 'Send Onboarding Packet' : 'Export Case Version'
          }
          subtitle={`${caseAction.item.candidateName} - ${caseAction.item.jobTitle}`}
          onCancel={() => setCaseAction(null)}
          onSave={() => {
            if (caseAction.type === 'esign') requestSignature(caseAction.item.id);
            if (caseAction.type === 'packet') sendPacket(caseAction.item.id);
            if (caseAction.type === 'version') exportCase(caseAction.item);
            if (caseAction.type === 'details' || caseAction.type === 'checklist') setSelectedCaseId(caseAction.item.id);
            setCaseAction(null);
          }}
          saveLabel={caseAction.type === 'details' || caseAction.type === 'checklist' ? 'Open / Update' : 'Save / Update'}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <Mini label="Candidate" value={caseAction.item.candidateName} />
            <Mini label="Job" value={caseAction.item.jobTitle} />
            <Mini label="Client" value={caseAction.item.clientName} />
            <Mini label="Status" value={caseAction.item.status} />
            <Mini label="E-sign" value={caseAction.item.eSignatureStatus} />
            <Mini label="Progress" value={`${progressForTasks(caseAction.item.tasks)}%`} />
          </div>
          <div className="mt-4 rounded-lg border border-white/5 bg-white/[0.03] p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Action summary</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              {caseAction.type === 'checklist'
                ? `${caseAction.item.tasks.length} onboarding tasks are attached to this case.`
                : caseAction.item.activity[0] ?? 'No activity recorded yet.'}
            </p>
          </div>
          {caseAction.type === 'checklist' && (
            <div className="mt-4 max-h-[360px] space-y-3 overflow-y-auto pr-1">
              {caseAction.item.tasks.map(task => (
                <div key={task.id} className="rounded-lg border border-white/5 bg-white/[0.03] p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">{task.title}</p>
                      <p className="mt-1 text-xs text-slate-500">{task.category} - {task.owner} - due {task.dueDate}</p>
                    </div>
                    <span className={cn('w-fit rounded-full border px-2 py-0.5 text-[10px]', statusTone[task.status])}>{task.status}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(['Pending', 'In Progress', 'Completed', 'Needs Review'] as TaskStatus[]).map(status => (
                      <button key={status} onClick={() => updateTask(caseAction.item.id, task.id, status)} className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-[10px] text-slate-300 hover:bg-white/10">
                        {status}
                      </button>
                    ))}
                    <button onClick={() => attachTaskDocument(caseAction.item.id, task.id, 'Sent')} className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-[10px] text-slate-300 hover:bg-white/10">
                      Send Docs
                    </button>
                    <label className="cursor-pointer rounded-md border border-blue-500/30 bg-blue-500/10 px-2 py-1.5 text-[10px] text-blue-100 hover:bg-blue-500/15">
                      Upload Received
                      <input
                        type="file"
                        className="hidden"
                        onChange={event => {
                          const file = event.target.files?.[0];
                          if (file) attachTaskDocument(caseAction.item.id, task.id, 'Received', file.name);
                          event.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}
        </QuickActionModal>
      )}
    </div>
  );
}

function Metric({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-[#0d1729] p-4">
      <div className={cn('mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-white/5', color)}>{icon}</div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.03] p-3">
      <p className="text-[10px] uppercase tracking-wider text-slate-600">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function Select({ value, options, onChange }: { value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  return (
    <select value={value} onChange={event => onChange(event.target.value)} className="rounded-lg border border-white/10 bg-[#111b2d] px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500/60">
      {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  );
}
