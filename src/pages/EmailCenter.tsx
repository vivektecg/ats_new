import { useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { motion } from 'framer-motion';
import {
  Bot, CalendarClock, Eye, FileText, Inbox, Mail, MessageSquareText,
  RefreshCw, Send, ServerCog, Sparkles, UserCheck, Users,
} from 'lucide-react';
import { QuickActionModal, QuickIconButton } from '@/components/ats/QuickActionModal';
import { candidates, clients, emailHistory, emailTemplates, jobs, submissions } from '@/lib/data';
import {
  connectEmailIntegration,
  LOCAL_EMAIL_INTEGRATIONS_KEY,
  LOCAL_EMAILS_KEY,
  readLocalRows,
  sendEmailRecord,
  syncEmailInbox,
  type EmailIntegration,
} from '@/lib/atsApi';
import { getSession } from '@/lib/auth';
import { getAllCandidates, getAllClients, getAllJobs } from '@/lib/localRecords';
import { cn } from '@/lib/utils';
import type { Candidate, EmailRecord, EmailTemplateCategory, Job } from '@/lib/types';

interface EmailFormState {
  templateId: string;
  candidateId: string;
  jobId: string;
  to: string;
  cc: string;
  subject: string;
  body: string;
  resumeAttachment: string;
}

interface EmailIntegrationFormState {
  emailAddress: string;
  imapHost: string;
  imapPort: string;
  smtpHost: string;
  smtpPort: string;
}

const initialForm: EmailFormState = {
  templateId: emailTemplates[0]?.id ?? '',
  candidateId: candidates[0]?.id ?? '',
  jobId: jobs[0]?.id ?? '',
  to: candidates[0]?.email ?? '',
  cc: '',
  subject: '',
  body: '',
  resumeAttachment: '',
};

const quickActions: Array<{ label: string; category: EmailTemplateCategory; icon: ReactNode }> = [
  { label: 'Candidate outreach', category: 'Candidate outreach', icon: <Users size={14} /> },
  { label: 'Missing details email', category: 'Resume missing info request', icon: <FileText size={14} /> },
  { label: 'Client submission email', category: 'Client submission', icon: <Send size={14} /> },
  { label: 'Interview confirmation', category: 'Interview availability request', icon: <CalendarClock size={14} /> },
  { label: 'Follow-up email', category: 'Follow-up after interview', icon: <RefreshCw size={14} /> },
  { label: 'Offer discussion', category: 'Offer discussion', icon: <UserCheck size={14} /> },
  { label: 'Rejection email', category: 'Rejection message', icon: <MessageSquareText size={14} /> },
];

function loadLocalEmails(): EmailRecord[] {
  return readLocalRows<EmailRecord>(LOCAL_EMAILS_KEY);
}

function formatDateTime() {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date());
}

function getSubmittedJob(candidateId: string) {
  const submission = submissions.find(item => item.candidateId === candidateId);
  return submission ? jobs.find(job => job.id === submission.jobId) : undefined;
}

function replaceTokens(template: string, candidate: Candidate, job: Job) {
  const client = clients.find(clientItem => clientItem.id === job.clientId);
  const tokens: Record<string, string> = {
    '{{candidateName}}': candidate.name,
    '{{candidateTitle}}': candidate.title,
    '{{candidateSummary}}': candidate.summary,
    '{{candidateRate}}': candidate.salary,
    '{{candidateLocation}}': candidate.location,
    '{{availability}}': candidate.availability,
    '{{jobTitle}}': job.title,
    '{{jobLocation}}': job.location,
    '{{clientName}}': job.client,
    '{{clientContact}}': client?.contact ?? 'Client team',
    '{{recruiter}}': candidate.recruiter,
  };

  return Object.entries(tokens).reduce(
    (draft, [token, value]) => draft.split(token).join(value),
    template
  );
}

export default function EmailCenter() {
  const session = getSession();
  const [form, setForm] = useState<EmailFormState>(() => {
    const availableCandidates = getAllCandidates();
    const availableJobs = getAllJobs();
    const defaultCandidate = availableCandidates[0];
    const defaultJob = defaultCandidate ? getSubmittedJob(defaultCandidate.id) ?? availableJobs[0] : availableJobs[0];
    const defaultTemplate = emailTemplates[0];

    return {
      ...initialForm,
      candidateId: defaultCandidate?.id ?? '',
      jobId: defaultJob?.id ?? '',
      to: defaultCandidate?.email ?? '',
      subject: defaultCandidate && defaultJob ? replaceTokens(defaultTemplate.subject, defaultCandidate, defaultJob) : '',
      body: defaultCandidate && defaultJob ? replaceTokens(defaultTemplate.body, defaultCandidate, defaultJob) : '',
      resumeAttachment: defaultCandidate?.resume ?? (defaultCandidate ? `${defaultCandidate.name.replace(/\s+/g, '_')}_Resume.pdf` : ''),
    };
  });
  const [localEmails, setLocalEmails] = useState<EmailRecord[]>(loadLocalEmails);
  const [integrations, setIntegrations] = useState<EmailIntegration[]>(() => readLocalRows<EmailIntegration>(LOCAL_EMAIL_INTEGRATIONS_KEY));
  const [integrationForm, setIntegrationForm] = useState<EmailIntegrationFormState>(() => {
    const existing = readLocalRows<EmailIntegration>(LOCAL_EMAIL_INTEGRATIONS_KEY).find(item => item.userId === (session?.id ?? 'local-user'));
    return {
      emailAddress: existing?.emailAddress ?? session?.email ?? '',
      imapHost: existing?.imapHost ?? 'outlook.office365.com',
      imapPort: String(existing?.imapPort ?? 993),
      smtpHost: existing?.smtpHost ?? 'smtp.office365.com',
      smtpPort: String(existing?.smtpPort ?? 587),
    };
  });
  const [notice, setNotice] = useState('');
  const [emailAction, setEmailAction] = useState<null | { type: 'compose' | 'history' | 'template'; candidate: Candidate; category?: EmailTemplateCategory }>(null);
  const availableCandidates = getAllCandidates();
  const availableJobs = getAllJobs();
  const availableClients = getAllClients();

  const allEmails = useMemo(() => [...localEmails, ...emailHistory], [localEmails]);
  const selectedCandidate = availableCandidates.find(candidate => candidate.id === form.candidateId) ?? availableCandidates[0];
  const selectedJob = availableJobs.find(job => job.id === form.jobId) ?? availableJobs[0];
  const selectedTemplate = emailTemplates.find(template => template.id === form.templateId) ?? emailTemplates[0];
  const selectedClient = selectedJob ? availableClients.find(client => client.id === selectedJob.clientId) : undefined;
  const currentIntegration = integrations.find(item => item.userId === (session?.id ?? 'local-user'));


  const updateField = <K extends keyof EmailFormState>(key: K, value: EmailFormState[K]) => {
    setForm(current => ({ ...current, [key]: value }));
  };

  const applyTemplate = (templateId: string, candidateId = form.candidateId, jobId = form.jobId) => {
    const template = emailTemplates.find(item => item.id === templateId) ?? emailTemplates[0];
    const candidate = availableCandidates.find(item => item.id === candidateId);
    const job = availableJobs.find(item => item.id === jobId) ?? (candidate ? getSubmittedJob(candidate.id) : undefined) ?? availableJobs[0];
    if (!candidate || !job) {
      setNotice('Add a candidate and job before drafting email templates.');
      return;
    }
    const client = availableClients.find(clientItem => clientItem.id === job.clientId);
    const to = template.category === 'Client submission' ? client?.contactEmail ?? candidate.email : candidate.email;

    setForm(current => ({
      ...current,
      templateId: template.id,
      candidateId: candidate.id,
      jobId: job.id,
      to,
      subject: replaceTokens(template.subject, candidate, job),
      body: replaceTokens(template.body, candidate, job),
      resumeAttachment: template.category === 'Client submission' ? `${candidate.name.replace(/\s+/g, '_')}_Resume.pdf` : current.resumeAttachment,
    }));
    setNotice(`AI draft loaded: ${template.name}`);
  };

  const applyQuickAction = (category: EmailTemplateCategory) => {
    const template = emailTemplates.find(item => item.category === category) ?? emailTemplates[0];
    applyTemplate(template.id);
  };

  const applyCandidateTemplate = (candidate: Candidate, category: EmailTemplateCategory) => {
    const template = emailTemplates.find(item => item.category === category) ?? emailTemplates[0];
    const job = getSubmittedJob(candidate.id) ?? selectedJob ?? availableJobs[0];
    applyTemplate(template.id, candidate.id, job?.id);
  };

  const handleCandidateChange = (candidateId: string) => {
    const nextJob = getSubmittedJob(candidateId) ?? selectedJob;
    const candidate = availableCandidates.find(item => item.id === candidateId);
    if (!candidate || !nextJob) return;
    setForm(current => ({ ...current, candidateId, jobId: nextJob.id, to: candidate.email }));
    applyTemplate(form.templateId, candidateId, nextJob.id);
  };

  const updateIntegrationField = <K extends keyof EmailIntegrationFormState>(key: K, value: EmailIntegrationFormState[K]) => {
    setIntegrationForm(current => ({ ...current, [key]: value }));
  };

  const handleConnectEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!integrationForm.emailAddress.trim()) {
      setNotice('Business email address is required before connecting Outlook / IMAP.');
      return;
    }
    const row = await connectEmailIntegration({
      userId: session?.id ?? 'local-user',
      userName: session?.name ?? 'Local ATS User',
      provider: 'Outlook / IMAP',
      emailAddress: integrationForm.emailAddress.trim(),
      imapHost: integrationForm.imapHost.trim() || 'outlook.office365.com',
      imapPort: Number(integrationForm.imapPort) || 993,
      smtpHost: integrationForm.smtpHost.trim() || 'smtp.office365.com',
      smtpPort: Number(integrationForm.smtpPort) || 587,
    });
    setIntegrations(readLocalRows<EmailIntegration>(LOCAL_EMAIL_INTEGRATIONS_KEY));
    setNotice(`${row.emailAddress} connected for ${row.userName}.`);
  };

  const handleSyncInbox = async () => {
    if (!currentIntegration) {
      setNotice('Connect Outlook / IMAP before syncing inbound email.');
      return;
    }
    const row = await syncEmailInbox({
      userId: currentIntegration.userId,
      candidateId: selectedCandidate?.id,
      candidateName: selectedCandidate?.name,
      candidateEmail: selectedCandidate?.email,
      jobId: selectedJob?.id,
      jobTitle: selectedJob?.title,
      clientId: selectedClient?.id,
      clientName: selectedClient?.name ?? selectedJob?.client,
    });
    setLocalEmails(loadLocalEmails());
    setIntegrations(readLocalRows<EmailIntegration>(LOCAL_EMAIL_INTEGRATIONS_KEY));
    setNotice(row ? `Inbox activity synced for ${row.candidateName}.` : 'Inbox sync did not return new messages.');
  };

  const handleSend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedCandidate || !selectedJob || !selectedTemplate) {
      setNotice('Add a candidate and job before sending emails.');
      return;
    }

    if (!form.to.trim() || !form.subject.trim() || !form.body.trim()) {
      setNotice('To, subject, and message body are required before sending.');
      return;
    }
    if (selectedTemplate.category === 'Client submission' && !form.resumeAttachment.trim()) {
      setNotice('Client submission email requires a resume attachment.');
      return;
    }

    const record: EmailRecord = {
      id: `email-local-${Date.now()}`,
      candidateId: selectedCandidate.id,
      candidateName: selectedCandidate.name,
      jobId: selectedJob.id,
      jobTitle: selectedJob.title,
      clientId: selectedClient?.id,
      clientName: selectedClient?.name ?? selectedJob.client,
      type: selectedTemplate.category,
      to: form.to.trim(),
      cc: form.cc.trim() || undefined,
      subject: form.subject.trim(),
      body: form.body.trim(),
      status: 'Sent',
      sentAt: formatDateTime(),
      sender: selectedCandidate.recruiter,
    };

    await sendEmailRecord({ ...record, sender: currentIntegration?.emailAddress ?? record.sender });
    setLocalEmails(loadLocalEmails());
    setNotice(`Email sent and saved under ${selectedCandidate.name}'s history.`);
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Email Center</h1>
          <p className="mt-1 text-sm text-slate-500">Send ATS emails, use AI templates, and track candidate email history.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <IntegrationCard label={currentIntegration?.emailAddress ?? 'Outlook / IMAP'} status={currentIntegration?.status ?? 'not connected'} />
          <button onClick={handleSyncInbox} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/10">
            <RefreshCw size={13} />
            Sync Inbox
          </button>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Sent emails" value={allEmails.filter(email => email.status === 'Sent').length} icon={<Send size={16} />} color="text-blue-400" />
        <Stat label="Templates" value={emailTemplates.length} icon={<Sparkles size={16} />} color="text-violet-400" />
        <Stat label="Candidates with history" value={new Set(allEmails.map(email => email.candidateId).filter(Boolean)).size} icon={<Users size={16} />} color="text-emerald-400" />
        <Stat label="Connected mailboxes" value={integrations.filter(item => item.status === 'connected').length} icon={<Inbox size={16} />} color="text-amber-400" />
      </div>

      {notice && (
        <div className="mb-4 rounded-lg border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm text-blue-200">
          {notice}
        </div>
      )}

      <section className="mb-5 overflow-hidden rounded-lg border border-white/5 bg-[#0d1729]">
        <div className="border-b border-white/5 px-4 py-3">
          <h2 className="text-sm font-semibold text-white">Candidate Email Rows</h2>
          <p className="mt-1 text-xs text-slate-500">Compose, view template history, sync, and send row-level ATS email actions.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px]">
            <thead>
              <tr className="border-b border-white/5 text-left text-xs uppercase tracking-wider text-slate-500">
                {['Candidate', 'Role / Email', 'Submitted job', 'Email history', 'Last email', 'Actions'].map(header => (
                  <th key={header} className="px-4 py-3 font-medium">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {availableCandidates.map(candidate => {
                const job = getSubmittedJob(candidate.id) ?? availableJobs[0];
                const history = allEmails.filter(email => email.candidateId === candidate.id);
                return (
                  <tr key={candidate.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]">
                    <td className="px-4 py-3 text-sm font-semibold text-white">{candidate.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-300">
                      {candidate.title}
                      <p className="mt-1 text-xs text-slate-500">{candidate.email}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400">{job?.title ?? 'No submitted job'}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-blue-300">{history.length}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{history[0]?.sentAt ?? 'No email yet'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <QuickIconButton title="Compose email" onClick={() => setEmailAction({ type: 'compose', candidate, category: 'Candidate outreach' })}><Mail size={14} /></QuickIconButton>
                        <QuickIconButton title="Client submission template" onClick={() => setEmailAction({ type: 'template', candidate, category: 'Client submission' })}><Send size={14} /></QuickIconButton>
                        <QuickIconButton title="Template history" onClick={() => setEmailAction({ type: 'history', candidate })}><Eye size={14} /></QuickIconButton>
                        <QuickIconButton title="Follow-up template" onClick={() => setEmailAction({ type: 'template', candidate, category: 'Follow-up after interview' })}><RefreshCw size={14} /></QuickIconButton>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-5">
        <div className="space-y-4">
          <motion.form initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} onSubmit={handleConnectEmail} className="rounded-lg border border-white/5 bg-[#0d1729] p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ServerCog size={16} className="text-cyan-300" />
                <h2 className="text-sm font-semibold text-white">User Mailbox Integration</h2>
              </div>
              <button type="submit" className="flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-cyan-500">
                <Mail size={14} />
                Connect
              </button>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <Field label="Business email" value={integrationForm.emailAddress} onChange={value => updateIntegrationField('emailAddress', value)} />
              <Field label="IMAP host" value={integrationForm.imapHost} onChange={value => updateIntegrationField('imapHost', value)} />
              <Field label="IMAP port" value={integrationForm.imapPort} onChange={value => updateIntegrationField('imapPort', value)} />
              <Field label="SMTP host" value={integrationForm.smtpHost} onChange={value => updateIntegrationField('smtpHost', value)} />
              <Field label="SMTP port" value={integrationForm.smtpPort} onChange={value => updateIntegrationField('smtpPort', value)} />
            </div>
            {currentIntegration && (
              <p className="mt-3 text-xs text-slate-500">Last synced {new Date(currentIntegration.lastSyncedAt).toLocaleString()}.</p>
            )}
          </motion.form>

          <section className="rounded-lg border border-white/5 bg-[#0d1729] p-5">
            <div className="mb-4 flex items-center gap-2">
              <Bot size={16} className="text-violet-300" />
              <h2 className="text-sm font-semibold text-white">AI Email Templates</h2>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {quickActions.map(action => (
                <button
                  key={action.label}
                  onClick={() => applyQuickAction(action.category)}
                  className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2.5 text-left text-xs font-medium text-slate-300 transition-colors hover:border-blue-500/30 hover:bg-blue-500/10 hover:text-white"
                >
                  <span className="text-blue-300">{action.icon}</span>
                  {action.label}
                </button>
              ))}
            </div>
          </section>

          <motion.form initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} onSubmit={handleSend} className="rounded-lg border border-white/5 bg-[#0d1729] p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Mail size={16} className="text-blue-300" />
                <h2 className="text-sm font-semibold text-white">Compose Email</h2>
              </div>
              <button type="submit" className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500">
                <Send size={14} />
                Send Email
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <SelectField label="Template" value={form.templateId} onChange={value => applyTemplate(value)} options={emailTemplates.map(template => ({ value: template.id, label: template.name }))} />
              <SelectField label="Candidate" value={form.candidateId} onChange={handleCandidateChange} options={availableCandidates.map(candidate => ({ value: candidate.id, label: candidate.name }))} />
              <SelectField label="Related job" value={form.jobId} onChange={value => { updateField('jobId', value); applyTemplate(form.templateId, form.candidateId, value); }} options={availableJobs.map(job => ({ value: job.id, label: `${job.title} - ${job.client}` }))} />
              <Field label="To" value={form.to} onChange={value => updateField('to', value)} />
              <Field label="Cc" value={form.cc} onChange={value => updateField('cc', value)} />
              <Field label="Subject" value={form.subject} onChange={value => updateField('subject', value)} />
              {selectedTemplate.category === 'Client submission' && (
                <Field label="Resume attachment" value={form.resumeAttachment} onChange={value => updateField('resumeAttachment', value)} />
              )}
            </div>

            <label className="mt-4 block">
              <span className="mb-1.5 block text-xs font-medium text-slate-500">Message body</span>
              <textarea
                rows={13}
                value={form.body}
                onChange={event => updateField('body', event.target.value)}
                className="w-full resize-y rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-sm leading-relaxed text-slate-200 outline-none focus:border-blue-500/50"
              />
            </label>
          </motion.form>
        </div>
      </div>

      {emailAction && (
        <QuickActionModal
          title={emailAction.type === 'history' ? 'Template / Email History' : 'Prepare Email'}
          subtitle={`${emailAction.candidate.name} - ${emailAction.candidate.email}`}
          onCancel={() => setEmailAction(null)}
          onSave={() => {
            if (emailAction.type !== 'history') applyCandidateTemplate(emailAction.candidate, emailAction.category ?? 'Candidate outreach');
            setEmailAction(null);
          }}
          saveLabel={emailAction.type === 'history' ? 'Close' : 'Save / Update Draft'}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <Info label="Candidate" value={emailAction.candidate.name} />
            <Info label="Email" value={emailAction.candidate.email} />
            <Info label="Role" value={emailAction.candidate.title} />
            <Info label="Template" value={emailAction.category ?? 'History'} />
          </div>
          <div className="mt-4 rounded-lg border border-white/5 bg-white/[0.03] p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Recent records</p>
            <div className="mt-2 space-y-2">
              {allEmails.filter(email => email.candidateId === emailAction.candidate.id).slice(0, 4).map(email => (
                <p key={email.id} className="text-sm text-slate-300">{email.type} - {email.subject}</p>
              ))}
              {!allEmails.some(email => email.candidateId === emailAction.candidate.id) && <p className="text-sm text-slate-500">No email history yet.</p>}
            </div>
          </div>
        </QuickActionModal>
      )}
    </div>
  );
}

function IntegrationCard({ label, status }: { label: string; status: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
      <p className="text-xs font-medium text-slate-300">{label}</p>
      <p className="mt-0.5 text-[10px] text-amber-400">{status}</p>
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.03] p-3">
      <p className="text-[10px] uppercase tracking-wider text-slate-600">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-500">{label}</span>
      <input
        value={value}
        onChange={event => onChange(event.target.value)}
        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-blue-500/50"
      />
    </label>
  );
}

function SelectField({ label, value, options, onChange, compact = false }: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  compact?: boolean;
}) {
  return (
    <label className={compact ? 'block min-w-44' : 'block'}>
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
