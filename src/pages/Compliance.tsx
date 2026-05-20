import { useState } from 'react';
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle, Bot, Briefcase, CheckCircle2, Clock, Database, Download,
  Eye, FileText, History, KeyRound, Lock, Search, Send, ShieldCheck, Trash2,
  UserRound,
} from 'lucide-react';
import { QuickActionModal, QuickIconButton } from '@/components/ats/QuickActionModal';
import {
  candidateDocuments, candidates, jobs, recruiters,
  resumeVersions, submissions, tasks,
} from '@/lib/data';
import { getAllCandidates, getAllJobs } from '@/lib/localRecords';
import { cn } from '@/lib/utils';

type AuditCategory =
  | 'User activity logs'
  | 'Candidate data access logs'
  | 'AI validation logs'
  | 'Score explanation logs'
  | 'Submission history'
  | 'Consent/RTR tracking';

interface AuditLog {
  id: string;
  category: AuditCategory;
  actor: string;
  role: string;
  entity: string;
  entityType: 'Candidate' | 'Recruiter' | 'Job' | 'Submission' | 'AI Validation' | 'Document';
  action: string;
  timestamp: string;
  outcome: 'Allowed' | 'Recorded' | 'Needs Review' | 'Blocked';
  explanation: string;
}

const categoryIcons: Record<AuditCategory, ReactNode> = {
  'User activity logs': <History size={14} />,
  'Candidate data access logs': <UserRound size={14} />,
  'AI validation logs': <Bot size={14} />,
  'Score explanation logs': <FileText size={14} />,
  'Submission history': <Send size={14} />,
  'Consent/RTR tracking': <ShieldCheck size={14} />,
};

const outcomeColors: Record<AuditLog['outcome'], string> = {
  Allowed: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  Recorded: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
  'Needs Review': 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  Blocked: 'bg-red-500/10 text-red-300 border-red-500/20',
};

function scoreForCandidate(index: number) {
  return [92, 86, 81, 74, 68, 89, 77, 63, 91, 84, 79, 58][index % 12];
}

function recommendationForScore(score: number) {
  if (score >= 90) return 'Strong Match';
  if (score >= 80) return 'Good Match';
  if (score >= 65) return 'Average Match';
  if (score >= 50) return 'Weak Match';
  return 'Not Recommended';
}

function makeAuditLogs(): AuditLog[] {
  const userLogs = tasks.slice(0, 6).map((task, index): AuditLog => ({
    id: `user-${task.id}`,
    category: 'User activity logs',
    actor: task.assignee,
    role: task.assignee === 'All Team' ? 'Team' : index % 3 === 0 ? 'Admin' : 'Recruiter',
    entity: task.relatedTo ?? task.title,
    entityType: task.relatedType === 'Job' ? 'Job' : task.relatedType === 'Candidate' ? 'Candidate' : 'Recruiter',
    action: `${task.status}: ${task.title}`,
    timestamp: `${task.dueDate} 09:${String(index * 7).padStart(2, '0')} AM`,
    outcome: task.status === 'Overdue' ? 'Needs Review' : 'Recorded',
    explanation: task.description,
  }));

  const accessLogs = candidates.slice(0, 8).map((candidate, index): AuditLog => ({
    id: `access-${candidate.id}`,
    category: 'Candidate data access logs',
    actor: candidate.recruiter,
    role: 'Recruiter',
    entity: candidate.name,
    entityType: 'Candidate',
    action: index % 2 === 0 ? 'Viewed candidate profile and resume details' : 'Exported candidate summary for submission review',
    timestamp: `2026-05-${String(10 + index).padStart(2, '0')} ${9 + index}:15 AM`,
    outcome: 'Allowed',
    explanation: 'Access tied to active recruiting workflow and candidate ownership.',
  }));

  const aiLogs = candidates.slice(0, 8).map((candidate, index): AuditLog => {
    const job = jobs[index % jobs.length];
    const score = scoreForCandidate(index);
    return {
      id: `ai-${candidate.id}`,
      category: 'AI validation logs',
      actor: 'AI Matching Assistant',
      role: 'System',
      entity: `${candidate.name} -> ${job.title}`,
      entityType: 'AI Validation',
      action: `AI validation completed: ${recommendationForScore(score)} (${score}%)`,
      timestamp: `2026-05-${String(11 + index).padStart(2, '0')} ${10 + index}:30 AM`,
      outcome: score < 65 ? 'Needs Review' : 'Recorded',
      explanation: 'Human recruiter review required before submission or rejection.',
    };
  });

  const scoreLogs = candidates.slice(0, 8).map((candidate, index): AuditLog => {
    const job = jobs[index % jobs.length];
    return {
      id: `score-${candidate.id}`,
      category: 'Score explanation logs',
      actor: 'AI Matching Assistant',
      role: 'System',
      entity: `${candidate.name} score breakdown`,
      entityType: 'AI Validation',
      action: 'Stored score explanation and weighted factor breakdown',
      timestamp: `2026-05-${String(11 + index).padStart(2, '0')} ${11 + index}:05 AM`,
      outcome: 'Recorded',
      explanation: `JD version ${job.id}-v1 and resume evidence were used for skills, experience, domain, location, authorization, education, and certification scoring.`,
    };
  });

  const submissionLogs = submissions.map((submission): AuditLog => ({
    id: `sub-${submission.id}`,
    category: 'Submission history',
    actor: submission.recruiter,
    role: 'Recruiter',
    entity: `${submission.candidateName} -> ${submission.clientName}`,
    entityType: 'Submission',
    action: `${submission.status} for ${submission.jobTitle}`,
    timestamp: `${submission.submittedDate} 02:00 PM`,
    outcome: submission.status === 'Rejected' ? 'Needs Review' : 'Recorded',
    explanation: submission.notes,
  }));

  const consentLogs = candidateDocuments
    .filter(document => ['RTR', 'Signed agreement', 'Background check documents', 'Offer letter'].includes(document.type))
    .map((document): AuditLog => ({
      id: `consent-${document.id}`,
      category: 'Consent/RTR tracking',
      actor: document.verifiedBy ?? 'Recruiter',
      role: 'Recruiter',
      entity: document.candidateName,
      entityType: 'Document',
      action: `${document.type}: ${document.status}`,
      timestamp: `${document.uploadedAt ?? '2026-05-14'} 01:00 PM`,
      outcome: document.status === 'Verified' || document.status === 'Received' ? 'Recorded' : 'Needs Review',
      explanation: document.notes ?? `${document.type} consent record tracked for audit.`,
    }));

  return [...userLogs, ...accessLogs, ...aiLogs, ...scoreLogs, ...submissionLogs, ...consentLogs];
}

export default function Compliance() {
  const availableCandidates = getAllCandidates();
  const availableJobs = getAllJobs();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<AuditCategory | 'All'>('All');
  const [selectedCandidateId, setSelectedCandidateId] = useState(availableCandidates[0]?.id ?? '');
  const [privacyNoticeAcknowledged, setPrivacyNoticeAcknowledged] = useState(false);
  const [deletionNotice, setDeletionNotice] = useState('');
  const [auditAction, setAuditAction] = useState<AuditLog | null>(null);

  const auditLogs = makeAuditLogs();
  const selectedCandidate = availableCandidates.find(candidate => candidate.id === selectedCandidateId) ?? availableCandidates[0];
  const selectedResumeVersion = selectedCandidate ? resumeVersions.find(version => version.candidateId === selectedCandidate.id) : undefined;
  const selectedSubmission = selectedCandidate ? submissions.find(submission => submission.candidateId === selectedCandidate.id) : undefined;
  const selectedJob = availableJobs.find(job => job.id === selectedSubmission?.jobId) ?? availableJobs[0];
  const selectedIndex = selectedCandidate ? availableCandidates.findIndex(candidate => candidate.id === selectedCandidate.id) : 0;
  const selectedScore = scoreForCandidate(Math.max(0, selectedIndex));
  const selectedRecommendation = recommendationForScore(selectedScore);
  const filteredLogs = auditLogs.filter(log => {
    const term = search.toLowerCase();
    const matchesSearch = !term ||
      log.actor.toLowerCase().includes(term) ||
      log.entity.toLowerCase().includes(term) ||
      log.action.toLowerCase().includes(term) ||
      log.explanation.toLowerCase().includes(term);
    const matchesCategory = categoryFilter === 'All' || log.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const roleRows = [
    { role: 'Admin', permissions: 'Full audit access, data export, deletion approval, role management', users: 'Sarah Chen' },
    { role: 'Recruiter', permissions: 'Candidate/job/submission activity, AI explanations, own candidate exports', users: recruiters.filter(name => name !== 'All Team').join(', ') },
    { role: 'Viewer', permissions: 'Read-only reports and non-sensitive audit summaries', users: 'Alex Kim' },
    { role: 'System', permissions: 'AI validation logging only; cannot make final hiring decisions', users: 'AI Matching Assistant' },
  ];

  const scoreBreakdown = [
    { label: 'Mandatory skills', value: Math.min(100, selectedScore + 3), detail: 'Mapped against JD requirements and parsed resume evidence.' },
    { label: 'Preferred skills', value: Math.max(45, selectedScore - 8), detail: 'Secondary skills and adjacent tool experience.' },
    { label: 'Experience', value: Math.min(100, (selectedCandidate?.experience ?? 0) * 10), detail: `${selectedCandidate?.experience ?? 0} years total experience.` },
    { label: 'Domain / job fit', value: Math.max(55, selectedScore - 5), detail: `${selectedCandidate?.title ?? 'Candidate'} compared with ${selectedJob?.title ?? 'job requirement'}.` },
    { label: 'Location / availability', value: selectedCandidate?.availability === 'Immediately' ? 92 : 78, detail: `${selectedCandidate?.location ?? 'Location pending'}; ${selectedCandidate?.availability ?? 'Availability pending'}.` },
    { label: 'Education / certifications', value: 74, detail: 'Profile and document records checked where available.' },
  ];

  function exportCandidateData() {
    const payload = {
      exportedAt: new Date().toISOString(),
      privacyNoticeAcknowledged,
      candidate: selectedCandidate ?? null,
      resumeVersion: selectedResumeVersion ?? null,
      submission: selectedSubmission ?? null,
      job: selectedJob ?? null,
      scoreExplanation: selectedCandidate ? {
        overallScore: selectedScore,
        recommendation: selectedRecommendation,
        scoreBreakdown,
        humanDecisionRequired: true,
      } : null,
      auditLogs: filteredLogs,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `eventus-candidate-export-${selectedCandidate?.id ?? 'no-candidate'}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setDeletionNotice(`Candidate data export prepared for ${selectedCandidate?.name ?? 'selected candidate'}.`);
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Compliance / Audit Logs</h1>
          <p className="mt-1 text-sm text-slate-500">Transparent audit trail for candidate data, recruiter activity, submissions, consent, AI validation, and human decisions.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setDeletionNotice(`Deletion request queued for ${selectedCandidate?.name ?? 'selected candidate'}. Admin approval and retention review required.`)} className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-300 hover:bg-red-500/20">
            <Trash2 size={15} />
            Data deletion option
          </button>
          <button onClick={exportCandidateData} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-500">
            <Download size={15} />
            Export candidate data
          </button>
        </div>
      </div>

      {deletionNotice && (
        <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {deletionNotice}
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-6">
        <Stat label="User activity logs" value={auditLogs.filter(log => log.category === 'User activity logs').length} icon={<History size={16} />} color="text-blue-400" />
        <Stat label="Candidate data access logs" value={auditLogs.filter(log => log.category === 'Candidate data access logs').length} icon={<UserRound size={16} />} color="text-violet-400" />
        <Stat label="AI validation logs" value={auditLogs.filter(log => log.category === 'AI validation logs').length} icon={<Bot size={16} />} color="text-cyan-400" />
        <Stat label="Score explanation logs" value={auditLogs.filter(log => log.category === 'Score explanation logs').length} icon={<FileText size={16} />} color="text-emerald-400" />
        <Stat label="Submission history" value={auditLogs.filter(log => log.category === 'Submission history').length} icon={<Send size={16} />} color="text-amber-400" />
        <Stat label="Consent/RTR tracking" value={auditLogs.filter(log => log.category === 'Consent/RTR tracking').length} icon={<ShieldCheck size={16} />} color="text-red-400" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_440px]">
        <div className="space-y-5">
          <section className="rounded-lg border border-white/5 bg-[#0d1729] p-5">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white">Audit Log Stream</h2>
                <p className="mt-1 text-xs text-slate-500">Connected to candidates, recruiters, jobs, submissions, documents, and AI validation.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    value={search}
                    onChange={event => setSearch(event.target.value)}
                    placeholder="Search logs..."
                    className="w-64 rounded-lg border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-slate-300 outline-none placeholder:text-slate-600 focus:border-blue-500/50"
                  />
                </div>
                <select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value as AuditCategory | 'All')} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 outline-none focus:border-blue-500/50">
                  {(['All', 'User activity logs', 'Candidate data access logs', 'AI validation logs', 'Score explanation logs', 'Submission history', 'Consent/RTR tracking'] as const).map(category => (
                    <option key={category} value={category} className="bg-[#0d1729]">{category}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              {filteredLogs.map((log, index) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.015 }}
                  className="rounded-lg border border-white/5 bg-white/[0.03] p-4"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-300">
                          {categoryIcons[log.category]}
                          {log.category}
                        </span>
                        <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-medium', outcomeColors[log.outcome])}>{log.outcome}</span>
                        <span className="text-[10px] text-slate-600">{log.entityType}</span>
                      </div>
                      <p className="text-sm font-medium text-white">{log.action}</p>
                      <p className="mt-1 text-xs text-slate-500">{log.entity}</p>
                      <p className="mt-2 text-xs leading-relaxed text-slate-400">{log.explanation}</p>
                    </div>
                    <div className="flex-shrink-0 text-left text-xs text-slate-500 lg:text-right">
                      <p className="font-medium text-slate-300">{log.actor}</p>
                      <p>{log.role}</p>
                      <p className="mt-2">{log.timestamp}</p>
                      <div className="mt-3 flex justify-start lg:justify-end">
                        <QuickIconButton title="Open audit log" onClick={() => setAuditAction(log)}><Eye size={14} /></QuickIconButton>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-white/5 bg-[#0d1729] p-5">
            <div className="mb-4 flex items-center gap-2">
              <KeyRound size={15} className="text-amber-300" />
              <h2 className="text-sm font-semibold text-white">Role-based access</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {roleRows.map(row => (
                <div key={row.role} className="rounded-lg border border-white/5 bg-white/[0.03] p-4">
                  <p className="text-sm font-semibold text-white">{row.role}</p>
                  <p className="mt-2 text-xs leading-relaxed text-slate-400">{row.permissions}</p>
                  <p className="mt-3 text-[10px] uppercase tracking-wider text-slate-600">Users</p>
                  <p className="mt-1 text-xs text-slate-300">{row.users}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-lg border border-white/5 bg-[#0d1729] p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-white">AI Recommendation Explanation</h2>
              <select value={selectedCandidateId} onChange={event => setSelectedCandidateId(event.target.value)} className="max-w-48 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300 outline-none focus:border-blue-500/50">
                {availableCandidates.map(candidate => <option key={candidate.id} value={candidate.id} className="bg-[#0d1729]">{candidate.name}</option>)}
              </select>
            </div>

            <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-200">AI recommendation explanation</p>
              <p className="mt-2 text-lg font-bold text-white">{selectedRecommendation} - {selectedScore}%</p>
              <p className="mt-2 text-sm leading-relaxed text-blue-100/80">
                AI score is explainable and advisory only. It considers role requirements, resume evidence, experience, location, availability, authorization, education, and certifications.
              </p>
            </div>

            <div className="mt-4 grid gap-3">
              <AuditInfo icon={<CheckCircle2 size={14} />} label="Human recruiter final decision" value={selectedSubmission?.status === 'Rejected' ? 'Rejected by recruiter/client review' : selectedSubmission ? `Human decision: ${selectedSubmission.status}` : 'Pending human recruiter decision'} />
              <AuditInfo icon={<Clock size={14} />} label="Date/time of AI validation" value="May 14, 2026 10:30 AM" />
              <AuditInfo icon={<Briefcase size={14} />} label="JD version used" value={selectedJob ? `${selectedJob.id}-v1 - ${selectedJob.title}` : 'No job selected'} />
              <AuditInfo icon={<FileText size={14} />} label="Resume version used" value={selectedResumeVersion ? `${selectedResumeVersion.versionType} ${selectedResumeVersion.version}` : 'Resume v1'} />
            </div>

            <div className="mt-4 rounded-lg border border-white/5 bg-white/[0.03] p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Score breakdown</p>
              <div className="space-y-3">
                {scoreBreakdown.map(row => (
                  <div key={row.label}>
                    <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                      <span className="text-slate-300">{row.label}</span>
                      <span className="font-semibold text-white">{row.value}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/5">
                      <div className="h-full rounded-full bg-blue-500" style={{ width: `${row.value}%` }} />
                    </div>
                    <p className="mt-1 text-[10px] text-slate-600">{row.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-white/5 bg-[#0d1729] p-5">
            <div className="mb-4 flex items-center gap-2">
              <Database size={15} className="text-emerald-300" />
              <h2 className="text-sm font-semibold text-white">Candidate Privacy Controls</h2>
            </div>
            <div className="space-y-3">
              <button onClick={exportCandidateData} className="flex w-full items-center justify-between rounded-lg border border-white/5 bg-white/[0.03] px-4 py-3 text-left hover:bg-white/[0.06]">
                <span>
                  <span className="block text-sm font-medium text-white">Export candidate data</span>
                  <span className="text-xs text-slate-500">Download profile, documents, submissions, AI logs, and decisions.</span>
                </span>
                <Download size={15} className="text-blue-300" />
              </button>
              <button onClick={() => setDeletionNotice(`Deletion request queued for ${selectedCandidate?.name ?? 'selected candidate'}. Admin approval and legal hold review required.`)} className="flex w-full items-center justify-between rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-left hover:bg-red-500/20">
                <span>
                  <span className="block text-sm font-medium text-red-100">Data deletion option</span>
                  <span className="text-xs text-red-100/70">Creates a deletion request; does not silently erase audit evidence.</span>
                </span>
                <Trash2 size={15} className="text-red-300" />
              </button>
            </div>
          </section>

          <section className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-amber-300" />
              <div>
                <h2 className="text-sm font-semibold text-amber-100">Privacy notice</h2>
                <p className="mt-2 text-sm leading-relaxed text-amber-100/80">
                  AI screening is used for recruiter assistance only. The Eventus Consulting Group ATS stores score explanations, source versions, and human final decisions so candidate ranking does not become a black-box decision.
                </p>
                <label className="mt-4 flex cursor-pointer items-center gap-2 text-xs text-amber-100">
                  <input type="checkbox" checked={privacyNoticeAcknowledged} onChange={event => setPrivacyNoticeAcknowledged(event.target.checked)} className="h-3.5 w-3.5 rounded border-amber-300/30 bg-amber-500/10" />
                  Privacy notice acknowledged for audit review
                </label>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-white/5 bg-[#0d1729] p-5">
            <div className="mb-4 flex items-center gap-2">
              <Lock size={15} className="text-slate-300" />
              <h2 className="text-sm font-semibold text-white">Legal guardrails</h2>
            </div>
            <div className="space-y-2 text-sm text-slate-400">
              <p>AI recommendation cannot auto-reject candidates.</p>
              <p>Human recruiter final decision is required before client-facing action.</p>
              <p>Audit logs preserve JD version, resume version, validation time, and score breakdown.</p>
            </div>
          </section>
        </aside>
      </div>

      {auditAction && (
        <QuickActionModal
          title="Audit Log Details"
          subtitle={`${auditAction.entityType} - ${auditAction.entity}`}
          onCancel={() => setAuditAction(null)}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <AuditInfo icon={<History size={14} />} label="Category" value={auditAction.category} />
            <AuditInfo icon={<UserRound size={14} />} label="Actor" value={`${auditAction.actor} (${auditAction.role})`} />
            <AuditInfo icon={<Clock size={14} />} label="Timestamp" value={auditAction.timestamp} />
            <AuditInfo icon={<ShieldCheck size={14} />} label="Outcome" value={auditAction.outcome} />
          </div>
          <div className="mt-4 rounded-lg border border-white/5 bg-white/[0.03] p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Action</p>
            <p className="mt-2 text-sm text-slate-200">{auditAction.action}</p>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">{auditAction.explanation}</p>
          </div>
        </QuickActionModal>
      )}
    </div>
  );
}

function Stat({ label, value, icon, color }: { label: string; value: number; icon: ReactNode; color: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-[#0d1729] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className={cn('opacity-80', color)}>{icon}</span>
        <p className={cn('text-2xl font-bold', color)}>{value}</p>
      </div>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

function AuditInfo({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-white/5 bg-white/[0.03] p-3">
      <span className="mt-0.5 text-blue-300">{icon}</span>
      <span className="min-w-0">
        <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-600">{label}</span>
        <span className="mt-1 block text-sm text-slate-200">{value}</span>
      </span>
    </div>
  );
}
