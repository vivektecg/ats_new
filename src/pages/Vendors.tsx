import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Briefcase, Building2, Check, CreditCard, DollarSign, FileText,
  Mail, Phone, Plus, Search, Send, Users,
} from 'lucide-react';
import { jobs, submissions, vendors } from '@/lib/data';
import { LOCAL_VENDORS_KEY, saveRows } from '@/lib/atsApi';
import { currentOwnerName } from '@/lib/auth';
import { cn } from '@/lib/utils';
import type { Vendor } from '@/lib/types';

interface VendorFormState {
  company: string;
  contact: string;
  email: string;
  phone: string;
  clientRepresented: string;
  submissionFormat: string;
  rateMargin: string;
  paymentTerms: string;
  agreementStatus: Vendor['agreementStatus'];
  notes: string;
  jobIds: string[];
  submissionIds: string[];
  recruiter: string;
}

const initialForm: VendorFormState = {
  company: '',
  contact: '',
  email: '',
  phone: '',
  clientRepresented: '',
  submissionFormat: '',
  rateMargin: '',
  paymentTerms: '',
  agreementStatus: 'Pending',
  notes: '',
  jobIds: [],
  submissionIds: [],
  recruiter: '',
};

const statusColors: Record<Vendor['agreementStatus'], string> = {
  Active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  Pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  Expired: 'bg-red-500/10 text-red-400 border-red-500/20',
  'On Hold': 'bg-slate-500/10 text-slate-300 border-slate-500/20',
};

function loadLocalVendors(): Vendor[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(LOCAL_VENDORS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalVendors(nextVendors: Vendor[]) {
  window.localStorage.setItem(LOCAL_VENDORS_KEY, JSON.stringify(nextVendors));
  saveRows('vendors', nextVendors);
}

export default function Vendors() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(searchParams.get('add') === '1');
  const [error, setError] = useState('');
  const [form, setForm] = useState<VendorFormState>(initialForm);
  const [localVendors, setLocalVendors] = useState<Vendor[]>(loadLocalVendors);
  const [selectedVendorId, setSelectedVendorId] = useState(vendors[0]?.id ?? '');

  const allVendors = [
    ...vendors,
    ...localVendors.filter(localVendor => !vendors.some(vendor => vendor.id === localVendor.id)),
  ];

  const filteredVendors = allVendors.filter(vendor => {
    const term = search.toLowerCase();
    return !term ||
      vendor.company.toLowerCase().includes(term) ||
      vendor.contact.toLowerCase().includes(term) ||
      vendor.clientRepresented.toLowerCase().includes(term) ||
      vendor.agreementStatus.toLowerCase().includes(term);
  });

  const selectedVendor = allVendors.find(vendor => vendor.id === selectedVendorId) ?? filteredVendors[0] ?? allVendors[0];
  const activeVendors = allVendors.filter(vendor => vendor.agreementStatus === 'Active').length;
  const pendingAgreements = allVendors.filter(vendor => vendor.agreementStatus === 'Pending').length;
  const totalVendorJobs = allVendors.reduce((total, vendor) => total + vendor.jobIds.length, 0);
  const totalVendorSubmissions = allVendors.reduce((total, vendor) => total + vendor.submissionIds.length, 0);

  const updateField = <K extends keyof VendorFormState>(key: K, value: VendorFormState[K]) => {
    setForm(current => ({ ...current, [key]: value }));
  };

  const toggleArrayValue = (key: 'jobIds' | 'submissionIds', value: string) => {
    setForm(current => ({
      ...current,
      [key]: current[key].includes(value)
        ? current[key].filter(item => item !== value)
        : [...current[key], value],
    }));
  };

  const handleSaveVendor = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.company.trim() || !form.contact.trim() || !form.email.trim()) {
      setError('Vendor company, contact, and email are required.');
      return;
    }

    const vendor: Vendor = {
      id: `v-local-${Date.now()}`,
      company: form.company.trim(),
      contact: form.contact.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || 'Not specified',
      clientRepresented: form.clientRepresented.trim() || 'Not specified',
      submissionFormat: form.submissionFormat.trim() || 'Not specified',
      rateMargin: form.rateMargin.trim() || 'Not specified',
      paymentTerms: form.paymentTerms.trim() || 'Not specified',
      agreementStatus: form.agreementStatus,
      notes: form.notes.trim() || 'No notes added.',
      jobIds: form.jobIds,
      submissionIds: form.submissionIds,
      recruiter: form.recruiter.trim() || currentOwnerName(),
      createdAt: new Date().toISOString().slice(0, 10),
    };

    const nextLocalVendors = [vendor, ...localVendors];
    saveLocalVendors(nextLocalVendors);
    setLocalVendors(nextLocalVendors);
    setSelectedVendorId(vendor.id);
    setForm(initialForm);
    setError('');
    setShowForm(false);
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Vendor / Implementation Partners</h1>
          <p className="mt-1 text-sm text-slate-500">Track vendor companies, agreements, rate margins, represented clients, jobs, and submissions.</p>
        </div>
        <button onClick={() => setShowForm(current => !current)} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-500">
          <Plus size={15} />
          Add Vendor
        </button>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Active vendors" value={activeVendors} icon={<Building2 size={16} />} color="text-emerald-400" />
        <Stat label="Pending agreements" value={pendingAgreements} icon={<FileText size={16} />} color="text-amber-400" />
        <Stat label="Jobs received" value={totalVendorJobs} icon={<Briefcase size={16} />} color="text-blue-400" />
        <Stat label="Submitted to vendors" value={totalVendorSubmissions} icon={<Send size={16} />} color="text-violet-400" />
      </div>

      {showForm && (
        <motion.form
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleSaveVendor}
          className="mb-5 rounded-lg border border-white/5 bg-[#0d1729] p-5"
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-white">Vendor Intake</h2>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/10">
                Cancel
              </button>
              <button type="submit" className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-500">
                <Check size={13} />
                Save Vendor
              </button>
            </div>
          </div>

          {error && <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Vendor company" value={form.company} onChange={value => updateField('company', value)} required />
            <Field label="Vendor contact" value={form.contact} onChange={value => updateField('contact', value)} required />
            <Field label="Email" type="email" value={form.email} onChange={value => updateField('email', value)} required />
            <Field label="Phone" value={form.phone} onChange={value => updateField('phone', value)} />
            <Field label="Client represented" value={form.clientRepresented} onChange={value => updateField('clientRepresented', value)} />
            <Field label="Rate margin" value={form.rateMargin} onChange={value => updateField('rateMargin', value)} />
            <Field label="Payment terms" value={form.paymentTerms} onChange={value => updateField('paymentTerms', value)} />
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-500">Agreement status</span>
              <select value={form.agreementStatus} onChange={event => updateField('agreementStatus', event.target.value as Vendor['agreementStatus'])} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-blue-500/50">
                {['Active', 'Pending', 'Expired', 'On Hold'].map(status => <option key={status} value={status} className="bg-[#0d1729]">{status}</option>)}
              </select>
            </label>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            <TextArea label="Submission format" value={form.submissionFormat} onChange={value => updateField('submissionFormat', value)} />
            <TextArea label="Notes" value={form.notes} onChange={value => updateField('notes', value)} />
            <Field label="Recruiter owner" value={form.recruiter} onChange={value => updateField('recruiter', value)} />
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <Checklist title="Jobs received from vendor" items={jobs.map(job => ({ id: job.id, label: `${job.title} - ${job.client}` }))} selected={form.jobIds} onToggle={value => toggleArrayValue('jobIds', value)} />
            <Checklist title="Candidates submitted to vendor" items={submissions.map(submission => ({ id: submission.id, label: `${submission.candidateName} - ${submission.jobTitle}` }))} selected={form.submissionIds} onToggle={value => toggleArrayValue('submissionIds', value)} />
          </div>
        </motion.form>
      )}

      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="space-y-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search vendors, clients, contacts..."
              className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-9 pr-4 text-sm text-slate-300 outline-none placeholder:text-slate-600 focus:border-blue-500/50"
            />
          </div>

          {filteredVendors.map((vendor, index) => (
            <motion.button
              key={vendor.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              onClick={() => setSelectedVendorId(vendor.id)}
              className={cn(
                'w-full rounded-lg border p-4 text-left transition-all',
                selectedVendor?.id === vendor.id
                  ? 'border-blue-500/30 bg-blue-500/10'
                  : 'border-white/5 bg-[#0d1729] hover:border-white/10 hover:bg-white/[0.04]'
              )}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{vendor.company}</p>
                  <p className="mt-1 truncate text-xs text-slate-500">{vendor.clientRepresented}</p>
                </div>
                <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-medium', statusColors[vendor.agreementStatus])}>
                  {vendor.agreementStatus}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 border-t border-white/5 pt-3 text-xs">
                <Metric label="Jobs" value={vendor.jobIds.length} />
                <Metric label="Submissions" value={vendor.submissionIds.length} />
              </div>
            </motion.button>
          ))}

          {filteredVendors.length === 0 && (
            <div className="rounded-lg border border-white/5 bg-[#0d1729] p-5 text-sm text-slate-500">No vendors match your search.</div>
          )}
        </aside>

        {selectedVendor && (
          <main className="space-y-4">
            <section className="rounded-lg border border-white/5 bg-[#0d1729] p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-sm font-bold text-emerald-300">
                    {selectedVendor.company.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">{selectedVendor.company}</h2>
                    <p className="mt-1 text-sm text-slate-500">{selectedVendor.clientRepresented}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className={cn('rounded-full border px-2 py-0.5 text-xs font-medium', statusColors[selectedVendor.agreementStatus])}>{selectedVendor.agreementStatus}</span>
                      <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-300">{selectedVendor.recruiter}</span>
                    </div>
                  </div>
                </div>
                <div className="grid gap-2 text-sm text-slate-400">
                  <InfoLine icon={<Users size={14} />} value={selectedVendor.contact} />
                  <InfoLine icon={<Mail size={14} />} value={selectedVendor.email} />
                  <InfoLine icon={<Phone size={14} />} value={selectedVendor.phone} />
                </div>
              </div>
            </section>

            <div className="grid gap-4 xl:grid-cols-2">
              <RuleCard icon={<FileText size={15} />} title="Submission format" value={selectedVendor.submissionFormat} />
              <RuleCard icon={<DollarSign size={15} />} title="Rate margin" value={selectedVendor.rateMargin} />
              <RuleCard icon={<CreditCard size={15} />} title="Payment terms" value={selectedVendor.paymentTerms} />
              <RuleCard icon={<FileText size={15} />} title="Notes" value={selectedVendor.notes} />
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <section className="rounded-lg border border-white/5 bg-[#0d1729] p-5">
                <h3 className="mb-4 text-sm font-semibold text-white">Jobs Received From Vendor ({selectedVendor.jobIds.length})</h3>
                <div className="space-y-3">
                  {selectedVendor.jobIds.length === 0 ? (
                    <p className="py-3 text-sm text-slate-600">No jobs linked to this vendor.</p>
                  ) : selectedVendor.jobIds.map(jobId => {
                    const job = jobs.find(jobItem => jobItem.id === jobId);
                    if (!job) return null;
                    return (
                      <button key={job.id} onClick={() => navigate(`/jobs/${job.id}`)} className="flex w-full items-center gap-3 rounded-lg border border-white/5 bg-white/[0.03] p-3 text-left hover:bg-white/[0.06]">
                        <Briefcase size={15} className="text-blue-400" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-white">{job.title}</p>
                          <p className="text-xs text-slate-500">{job.client} - {job.location}</p>
                        </div>
                        <span className="text-xs text-slate-500">{job.priority}</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-lg border border-white/5 bg-[#0d1729] p-5">
                <h3 className="mb-4 text-sm font-semibold text-white">Candidates Submitted To Vendor ({selectedVendor.submissionIds.length})</h3>
                <div className="space-y-3">
                  {selectedVendor.submissionIds.length === 0 ? (
                    <p className="py-3 text-sm text-slate-600">No candidates submitted to this vendor yet.</p>
                  ) : selectedVendor.submissionIds.map(submissionId => {
                    const submission = submissions.find(submissionItem => submissionItem.id === submissionId);
                    if (!submission) return null;
                    return (
                      <button key={submission.id} onClick={() => navigate(`/candidates/${submission.candidateId}`)} className="w-full rounded-lg border border-white/5 bg-white/[0.03] p-3 text-left hover:bg-white/[0.06]">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-white">{submission.candidateName}</p>
                            <p className="text-xs text-slate-500">{submission.jobTitle} - {submission.submittedDate}</p>
                          </div>
                          <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-300">{submission.status}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>
          </main>
        )}
      </div>
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

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-sm font-bold text-white">{value}</p>
      <p className="text-[10px] text-slate-600">{label}</p>
    </div>
  );
}

function InfoLine({ icon, value }: { icon: ReactNode; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-slate-600">{icon}</span>
      <span>{value}</span>
    </div>
  );
}

function RuleCard({ icon, title, value }: { icon: ReactNode; title: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-[#0d1729] p-4">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
        <span className="text-blue-300">{icon}</span>
        {title}
      </p>
      <p className="mt-3 text-sm leading-relaxed text-slate-300">{value}</p>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', required = false }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1 text-xs font-medium text-slate-500">
        {label}
        {required && <span className="text-red-400">*</span>}
      </span>
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

function Checklist({ title, items, selected, onToggle }: {
  title: string;
  items: Array<{ id: string; label: string }>;
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.03] p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</p>
      <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
        {items.map(item => (
          <label key={item.id} className="flex cursor-pointer items-start gap-2 rounded-lg border border-white/5 bg-[#0d1729] p-2.5 text-xs text-slate-300 hover:bg-white/[0.04]">
            <input
              type="checkbox"
              checked={selected.includes(item.id)}
              onChange={() => onToggle(item.id)}
              className="mt-0.5 h-3.5 w-3.5 rounded border-white/20 bg-white/5"
            />
            <span>{item.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
