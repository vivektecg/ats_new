import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Briefcase, CreditCard, FileText, Globe,
  Mail, MapPin, Phone, Plus, ShieldCheck, Users,
} from 'lucide-react';
import { clients, jobs, submissions } from '@/lib/data';
import { LOCAL_CLIENTS_KEY, readLocalRows } from '@/lib/atsApi';
import { cn } from '@/lib/utils';
import type { Client } from '@/lib/types';

function loadLocalClients(): Client[] {
  return readLocalRows<Client>(LOCAL_CLIENTS_KEY);
}

const tierColors: Record<string, string> = {
  Platinum: 'text-cyan-400 bg-cyan-500/10 border border-cyan-500/20',
  Gold: 'text-amber-400 bg-amber-500/10 border border-amber-500/20',
  Silver: 'text-slate-300 bg-slate-500/10 border border-slate-500/20',
  Bronze: 'text-orange-400 bg-orange-500/10 border border-orange-500/20',
};

function clientInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.slice(0, 2).map(part => part[0]).join('') || 'CI').toUpperCase();
}

export default function ClientProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const localClients = loadLocalClients();
  const allClients = [
    ...clients,
    ...localClients.filter(localClient => !clients.some(clientItem => clientItem.id === localClient.id)),
  ];
  const client = allClients.find(c => c.id === id) ?? allClients[0];
  const clientJobs = jobs.filter(job => job.clientId === client.id);
  const clientSubs = submissions.filter(submission => submission.clientId === client.id);
  const placedSubs = clientSubs.filter(submission => submission.status === 'Placed' || submission.status === 'Offer Extended');

  return (
    <div className="p-6">
      <button onClick={() => navigate('/clients')} className="mb-5 flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-white">
        <ArrowLeft size={15} />
        Back to Clients
      </button>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="rounded-lg border border-white/5 bg-[#0d1729] p-6">
            <div className="mb-5 flex items-start gap-4">
              {client.logoUrl ? (
                <img src={client.logoUrl} alt={`${client.name} logo`} className="h-16 w-16 flex-shrink-0 rounded-2xl border border-white/10 bg-slate-900 object-contain p-1 shadow-lg shadow-blue-950/20" />
              ) : (
                <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-700 to-slate-600 text-xl font-bold text-white">
                  {clientInitials(client.name)}
                </div>
              )}
              <div className="min-w-0">
                <h1 className="text-lg font-bold text-white">{client.name}</h1>
                <p className="text-sm text-slate-400">{client.industry}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', tierColors[client.tier])}>{client.tier}</span>
                  <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-300">{client.clientType}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2.5">
              <Contact icon={<Globe size={13} />} value={client.website} />
              <Contact icon={<MapPin size={13} />} value={client.location} />
              <Contact icon={<Phone size={13} />} value={client.contactPhone} />
              <Contact icon={<Mail size={13} />} value={client.contactEmail} />
            </div>

            <div className="mt-5 border-t border-white/5 pt-4">
              <p className="mb-2 text-xs font-medium text-slate-500">Contact person</p>
              <p className="text-sm font-medium text-white">{client.contact}</p>
              <p className="text-xs text-slate-500">{client.contactTitle}</p>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2 border-t border-white/5 pt-4">
              <Metric label="Placements" value={client.totalPlacements} color="text-violet-400" />
              <Metric label="Active jobs" value={clientJobs.filter(job => job.status === 'Active').length} color="text-blue-400" />
              <Metric label="Submitted" value={clientSubs.length} color="text-emerald-400" />
            </div>

            <div className="mt-5 flex gap-2">
              <button onClick={() => navigate('/jobs')} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 py-2 text-xs text-white transition-colors hover:bg-blue-500">
                <Plus size={12} />
                Add Job
              </button>
              <button className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-white/5 py-2 text-xs text-slate-300 transition-colors hover:bg-white/10">
                Edit CRM
              </button>
            </div>
          </motion.div>

          <Section title="Client Validation">
            <div className="grid gap-3">
              <Info icon={<Globe size={14} />} label="Logo source" value={client.logoUrl ? 'Client logo saved with profile' : 'Generated initials logo'} />
              <Info icon={<Users size={14} />} label="Candidates submitted" value={`${clientSubs.length}`} />
              <Info icon={<ShieldCheck size={14} />} label="Offer / placed candidates" value={`${placedSubs.length}`} />
            </div>
          </Section>
        </aside>

        <main className="space-y-4">
          <Section title="Client Profile">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <Info label="Client name" value={client.name} />
              <Info label="Industry" value={client.industry} />
              <Info label="Client type" value={client.clientType} />
              <Info label="Contact person" value={client.contact} />
              <Info label="Email" value={client.contactEmail} />
              <Info label="Phone" value={client.contactPhone} />
              <Info label="Location" value={client.location} />
              <Info label="Recruiter owner" value={client.recruiter} />
              <Info label="CRM status" value={client.status} />
            </div>
          </Section>

          <Section title="Client Rules & Terms">
            <div className="grid gap-4 xl:grid-cols-2">
              <RuleCard icon={<FileText size={15} />} title="Contract terms" value={client.contractTerms} />
              <RuleCard icon={<CreditCard size={15} />} title="Payment terms" value={client.paymentTerms} />
              <RuleCard icon={<Briefcase size={15} />} title="Submission rules" value={client.submissionRules} />
              <RuleCard icon={<Users size={15} />} title="Interview process" value={client.interviewProcess} />
              <RuleCard icon={<ShieldCheck size={15} />} title="Background check rules" value={client.backgroundCheckRules} />
              <RuleCard icon={<ShieldCheck size={15} />} title="Visa restrictions" value={client.visaRestrictions} />
              <RuleCard icon={<CreditCard size={15} />} title="Rate cards" value={client.rateCards} />
              <RuleCard icon={<FileText size={15} />} title="Notes" value={client.notes} />
            </div>
          </Section>

          <div className="grid gap-4 xl:grid-cols-2">
            <Section title={`Jobs Linked to Client (${clientJobs.length})`}>
              {clientJobs.length === 0 ? (
                <p className="py-4 text-sm text-slate-600">No jobs for this client.</p>
              ) : (
                <div className="space-y-3">
                  {clientJobs.map(job => (
                    <button key={job.id} onClick={() => navigate(`/jobs/${job.id}`)} className="flex w-full items-center gap-3 rounded-lg border border-white/5 bg-white/[0.03] p-3 text-left transition-colors hover:bg-white/[0.06]">
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10">
                        <Briefcase size={14} className="text-blue-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-white">{job.title}</p>
                        <p className="text-xs text-slate-500">{job.location} · {job.type} · {job.priority}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-medium text-white">{job.salary}</p>
                        <p className="text-[10px] text-slate-600">{job.submissions} submitted</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </Section>

            <Section title={`Candidates Submitted (${clientSubs.length})`}>
              {clientSubs.length === 0 ? (
                <p className="py-4 text-sm text-slate-600">No submissions yet.</p>
              ) : (
                <div className="space-y-3">
                  {clientSubs.map(submission => (
                    <button key={submission.id} onClick={() => navigate(`/candidates/${submission.candidateId}`)} className="w-full rounded-lg border border-white/5 bg-white/[0.03] p-3 text-left transition-colors hover:bg-white/[0.06]">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-white">{submission.candidateName}</p>
                          <p className="text-xs text-slate-500">{submission.jobTitle} · {submission.submittedDate}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-semibold text-white">{submission.rate}</p>
                          <span className={cn('rounded-full px-2 py-0.5 text-[10px]', submission.status === 'Placed' ? 'bg-amber-500/10 text-amber-400' : 'bg-blue-500/10 text-blue-400')}>{submission.status}</span>
                        </div>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-slate-500">{submission.notes}</p>
                    </button>
                  ))}
                </div>
              )}
            </Section>
          </div>
        </main>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="rounded-lg border border-white/5 bg-[#0d1729] p-5">
      <h2 className="mb-4 text-sm font-semibold text-white">{title}</h2>
      {children}
    </motion.section>
  );
}

function Contact({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <div className="flex items-center gap-2.5 text-sm text-slate-400">
      <span className="text-slate-600">{icon}</span>
      <span className="min-w-0 truncate">{value}</span>
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="text-center">
      <p className={cn('text-lg font-bold', color)}>{value}</p>
      <p className="text-[10px] text-slate-600">{label}</p>
    </div>
  );
}

function Info({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.03] p-3">
      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-600">
        {icon && <span className="text-slate-500">{icon}</span>}
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-white">{value || 'Not specified'}</p>
    </div>
  );
}

function RuleCard({ icon, title, value }: { icon: React.ReactNode; title: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.03] p-4">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
        <span className="text-blue-300">{icon}</span>
        {title}
      </p>
      <p className="mt-3 text-sm leading-relaxed text-slate-300">{value}</p>
    </div>
  );
}
