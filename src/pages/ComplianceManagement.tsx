import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Eye,
  FileWarning,
  RefreshCw,
  Send,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { QuickActionModal, QuickIconButton } from '@/components/ats/QuickActionModal';
import { getAllCandidates, getAllJobs } from '@/lib/localRecords';
import {
  createComplianceCase,
  loadComplianceCases,
  progressForChecks,
  saveComplianceCases,
  type ComplianceCase,
  type ComplianceStatus,
} from '@/lib/onboardingStore';
import { cn } from '@/lib/utils';

const statusTone: Record<ComplianceStatus, string> = {
  Pending: 'border-slate-500/20 bg-slate-500/10 text-slate-300',
  Verified: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
  'Needs Review': 'border-amber-500/20 bg-amber-500/10 text-amber-300',
  Expired: 'border-red-500/20 bg-red-500/10 text-red-300',
};

export default function ComplianceManagement() {
  const candidates = getAllCandidates();
  const jobs = getAllJobs();
  const [cases, setCases] = useState<ComplianceCase[]>(loadComplianceCases);
  const [candidateId, setCandidateId] = useState(candidates[0]?.id ?? '');
  const [jobId, setJobId] = useState(jobs[0]?.id ?? '');
  const [selectedCaseId, setSelectedCaseId] = useState(cases[0]?.id ?? '');
  const [notice, setNotice] = useState('Compliance workspace ready.');
  const [complianceAction, setComplianceAction] = useState<null | { type: 'details' | 'request' | 'export'; item: ComplianceCase }>(null);

  const selectedCase = cases.find(item => item.id === selectedCaseId) ?? cases[0];
  const verifiedChecks = cases.flatMap(item => item.checks).filter(check => check.status === 'Verified').length;
  const reviewChecks = cases.flatMap(item => item.checks).filter(check => check.status === 'Needs Review').length;
  const expiredChecks = cases.flatMap(item => item.checks).filter(check => check.status === 'Expired').length;
  const pendingChecks = cases.flatMap(item => item.checks).filter(check => check.status === 'Pending').length;

  const groupedChecks = useMemo(() => {
    if (!selectedCase) return [];
    return Object.entries(selectedCase.checks.reduce<Record<string, typeof selectedCase.checks>>((groups, check) => {
      groups[check.category] ??= [];
      groups[check.category].push(check);
      return groups;
    }, {}));
  }, [selectedCase]);

  function persist(nextCases: ComplianceCase[], message: string) {
    setCases(nextCases);
    saveComplianceCases(nextCases);
    setNotice(message);
  }

  function createCase() {
    const existing = cases.find(item => item.candidateId === candidateId && item.jobId === jobId);
    if (existing) {
      setSelectedCaseId(existing.id);
      setNotice(`${existing.candidateName} already has a compliance case for this job.`);
      return;
    }
    const nextCase = createComplianceCase(candidateId, jobId);
    if (!nextCase) {
      setNotice('Add candidates before creating compliance cases.');
      return;
    }
    persist([nextCase, ...cases], `Compliance case created for ${nextCase.candidateName}.`);
    setSelectedCaseId(nextCase.id);
  }

  function updateCheck(caseId: string, checkId: string, status: ComplianceStatus) {
    persist(cases.map(item => {
      if (item.id !== caseId) return item;
      const checks = item.checks.map(check => check.id === checkId ? { ...check, status } : check);
      const progress = progressForChecks(checks);
      const needsReview = checks.some(check => check.status === 'Needs Review' || check.status === 'Expired');
      return {
        ...item,
        checks,
        status: progress === 100 ? 'Verified' : needsReview ? 'Needs Review' : 'Pending',
        riskLevel: checks.some(check => check.status === 'Expired') ? 'High' : needsReview ? 'Medium' : 'Low',
        activity: [`${checkId} marked ${status} by recruiter.`, ...item.activity],
        updatedAt: new Date().toISOString(),
      };
    }), `Compliance check marked ${status}.`);
  }

  function requestDocuments(item: ComplianceCase) {
    persist(cases.map(row => row.id === item.id ? {
      ...row,
      activity: [`Missing compliance document request sent to ${row.candidateName}.`, ...row.activity],
      updatedAt: new Date().toISOString(),
    } : row), 'Missing document request recorded.');
  }

  function refreshFromAts() {
    const existingCandidateIds = new Set(cases.map(item => item.candidateId));
    const newCases = candidates
      .filter(candidate => !existingCandidateIds.has(candidate.id))
      .slice(0, 5)
      .map(candidate => createComplianceCase(candidate.id, jobId))
      .filter(Boolean) as ComplianceCase[];
    persist([...newCases, ...cases], `Compliance refreshed from ATS candidates: ${newCases.length} new cases created.`);
  }

  function exportCompliance(item: ComplianceCase) {
    const blob = new Blob([JSON.stringify(item, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `eventus-compliance-${item.candidateId}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice(`Compliance file exported for ${item.candidateName}.`);
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Compliance</h1>
          <p className="mt-1 text-sm text-slate-500">Candidate consent, RTR, I-9/E-Verify tracking, work authorization, background checks, privacy notices, document retention, and human decision evidence.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-[220px_220px_auto_auto]">
          <Select value={candidateId} onChange={setCandidateId} options={candidates.map(candidate => ({ value: candidate.id, label: candidate.name }))} />
          <Select value={jobId} onChange={setJobId} options={jobs.map(job => ({ value: job.id, label: `${job.title} - ${job.client}` }))} />
          <button onClick={createCase} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500">
            <ClipboardCheck size={15} />
            Create Case
          </button>
          <button onClick={refreshFromAts} className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/10">
            <RefreshCw size={15} />
            Refresh ATS
          </button>
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm text-blue-100">{notice}</div>

      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-5">
        <Metric label="Compliance cases" value={cases.length} icon={<ShieldCheck size={16} />} color="text-blue-400" />
        <Metric label="Verified checks" value={verifiedChecks} icon={<CheckCircle2 size={16} />} color="text-emerald-400" />
        <Metric label="Pending checks" value={pendingChecks} icon={<FileWarning size={16} />} color="text-slate-300" />
        <Metric label="Needs review" value={reviewChecks} icon={<AlertTriangle size={16} />} color="text-amber-400" />
        <Metric label="Expired" value={expiredChecks} icon={<AlertTriangle size={16} />} color="text-red-400" />
      </div>

      <div className="grid gap-5">
        <section className="rounded-lg border border-white/5 bg-[#0d1729]">
          <div className="border-b border-white/5 px-5 py-4">
            <h2 className="text-sm font-semibold text-white">Compliance Cases</h2>
          </div>
          {cases.length ? cases.map(item => {
            const progress = progressForChecks(item.checks);
            const active = selectedCase?.id === item.id;
            return (
              <div key={item.id} role="button" tabIndex={0} onClick={() => setSelectedCaseId(item.id)} className={cn('grid w-full gap-4 border-b border-white/5 p-4 text-left last:border-0 lg:grid-cols-[1fr_180px_120px_140px]', active ? 'bg-blue-500/10' : 'hover:bg-white/[0.03]')}>
                <div>
                  <p className="text-sm font-semibold text-white">{item.candidateName}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.jobTitle ?? 'General compliance'} - {item.clientName ?? 'No client'}</p>
                </div>
                <div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/5">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-slate-600">{progress}% verified - risk {item.riskLevel}</p>
                </div>
                <span className={cn('h-fit rounded-full border px-2 py-0.5 text-center text-[10px]', statusTone[item.status])}>{item.status}</span>
                <div className="flex items-center gap-1.5">
                  <QuickIconButton title="Case details" onClick={() => setComplianceAction({ type: 'details', item })}><Eye size={14} /></QuickIconButton>
                  <QuickIconButton title="Request documents" onClick={() => setComplianceAction({ type: 'request', item })}><Send size={14} /></QuickIconButton>
                  <QuickIconButton title="Export compliance" onClick={() => setComplianceAction({ type: 'export', item })}><Download size={14} /></QuickIconButton>
                </div>
              </div>
            );
          }) : (
            <div className="p-8 text-center text-xs text-slate-600">No compliance cases yet.</div>
          )}
        </section>

        <main className="space-y-5">
          {selectedCase ? (
            <>
              <section className="rounded-lg border border-white/5 bg-[#0d1729] p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-white">{selectedCase.candidateName}</h2>
                    <p className="mt-1 text-xs text-slate-500">{selectedCase.jobTitle ?? 'General compliance'} - {selectedCase.clientName ?? 'No client assigned'}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <QuickIconButton title="Request documents" onClick={() => setComplianceAction({ type: 'request', item: selectedCase })}><Send size={14} /></QuickIconButton>
                    <QuickIconButton title="Export compliance" onClick={() => setComplianceAction({ type: 'export', item: selectedCase })}><Download size={14} /></QuickIconButton>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <Mini label="Overall status" value={selectedCase.status} />
                  <Mini label="Risk level" value={selectedCase.riskLevel} />
                  <Mini label="Progress" value={`${progressForChecks(selectedCase.checks)}%`} />
                  <Mini label="Updated" value={new Date(selectedCase.updatedAt).toLocaleDateString()} />
                </div>
              </section>

              {groupedChecks.map(([category, checks]) => (
                <section key={category} className="rounded-lg border border-white/5 bg-[#0d1729] p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <UserCheck size={15} className="text-emerald-300" />
                    <h3 className="text-sm font-semibold text-white">{category}</h3>
                  </div>
                  <div className="grid gap-3">
                    {checks.map(check => (
                      <motion.div key={check.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-lg border border-white/5 bg-white/[0.03] p-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-white">{check.label}</p>
                              <span className={cn('rounded-full border px-2 py-0.5 text-[10px]', statusTone[check.status])}>{check.status}</span>
                            </div>
                            <p className="mt-1 text-xs text-slate-500">{check.owner} - due {check.dueDate}</p>
                            <p className="mt-2 text-xs text-slate-400">{check.evidence}</p>
                            <p className="mt-1 text-xs leading-relaxed text-slate-500">{check.notes}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:w-[360px]">
                            {(['Pending', 'Verified', 'Needs Review', 'Expired'] as ComplianceStatus[]).map(status => (
                              <button key={status} onClick={() => updateCheck(selectedCase.id, check.id, status)} className="rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-[10px] text-slate-300 hover:bg-white/10">
                                {status}
                              </button>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </section>
              ))}

              <section className="rounded-lg border border-white/5 bg-[#0d1729] p-5">
                <h3 className="mb-3 text-sm font-semibold text-white">Compliance Activity</h3>
                <div className="space-y-2">
                  {selectedCase.activity.map((item, index) => (
                    <p key={`${item}-${index}`} className="rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2 text-xs text-slate-400">{item}</p>
                  ))}
                </div>
              </section>
            </>
          ) : (
            <section className="rounded-lg border border-white/5 bg-[#0d1729] p-10 text-center">
              <ShieldCheck size={32} className="mx-auto mb-3 text-slate-700" />
              <p className="text-sm font-semibold text-white">Create or select a compliance case.</p>
            </section>
          )}
        </main>
      </div>

      {complianceAction && (
        <QuickActionModal
          title={
            complianceAction.type === 'details' ? 'Compliance Case Details' :
              complianceAction.type === 'request' ? 'Request Compliance Documents' : 'Export Compliance Case'
          }
          subtitle={`${complianceAction.item.candidateName} - ${complianceAction.item.jobTitle ?? 'General compliance'}`}
          onCancel={() => setComplianceAction(null)}
          onSave={() => {
            if (complianceAction.type === 'request') requestDocuments(complianceAction.item);
            if (complianceAction.type === 'export') exportCompliance(complianceAction.item);
            if (complianceAction.type === 'details') setSelectedCaseId(complianceAction.item.id);
            setComplianceAction(null);
          }}
          saveLabel={complianceAction.type === 'details' ? 'Open / Update' : 'Save / Update'}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <Mini label="Status" value={complianceAction.item.status} />
            <Mini label="Risk" value={complianceAction.item.riskLevel} />
            <Mini label="Progress" value={`${progressForChecks(complianceAction.item.checks)}%`} />
            <Mini label="Updated" value={new Date(complianceAction.item.updatedAt).toLocaleDateString()} />
          </div>
          <p className="mt-4 rounded-lg border border-white/5 bg-white/[0.03] p-4 text-sm text-slate-300">
            {complianceAction.item.activity[0] ?? 'No compliance activity recorded yet.'}
          </p>
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

function Select({ value, options, onChange }: { value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  return (
    <select value={value} onChange={event => onChange(event.target.value)} className="rounded-lg border border-white/10 bg-[#111b2d] px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500/60">
      {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.03] p-3">
      <p className="text-[10px] uppercase tracking-wider text-slate-600">{label}</p>
      <p className="mt-1 text-xs font-semibold text-white">{value}</p>
    </div>
  );
}
