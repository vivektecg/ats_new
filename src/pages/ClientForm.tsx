import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Building2, CreditCard, FileText, Image as ImageIcon,
  Mail, MapPin, Phone, Save, ShieldCheck, UserRound,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { upsertRow } from '@/lib/atsApi';
import type { Client } from '@/lib/types';

interface ClientFormState {
  name: string;
  logoUrl: string;
  industry: string;
  clientType: Client['clientType'];
  location: string;
  website: string;
  contact: string;
  contactTitle: string;
  contactEmail: string;
  contactPhone: string;
  contractTerms: string;
  paymentTerms: string;
  submissionRules: string;
  interviewProcess: string;
  backgroundCheckRules: string;
  visaRestrictions: string;
  rateCards: string;
  status: Client['status'];
  tier: Client['tier'];
  totalPlacements: string;
  activeJobs: string;
  recruiter: string;
  notes: string;
}

const initialForm: ClientFormState = {
  name: '',
  logoUrl: '',
  industry: '',
  clientType: 'Direct client',
  location: '',
  website: '',
  contact: '',
  contactTitle: '',
  contactEmail: '',
  contactPhone: '',
  contractTerms: '',
  paymentTerms: 'Net 45 from the date of invoice raised.',
  submissionRules: '',
  interviewProcess: '',
  backgroundCheckRules: '',
  visaRestrictions: '',
  rateCards: '',
  status: 'Prospect',
  tier: 'Silver',
  totalPlacements: '0',
  activeJobs: '0',
  recruiter: '',
  notes: '',
};

function clientInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'CI';
  return parts.slice(0, 2).map(part => part[0]).join('').toUpperCase();
}

function generatedClientLogo(name: string) {
  const initials = clientInitials(name);
  return `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#2563eb"/>
          <stop offset="56%" stop-color="#7c3aed"/>
          <stop offset="100%" stop-color="#06b6d4"/>
        </linearGradient>
        <radialGradient id="shine" cx="28%" cy="18%" r="76%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.75"/>
          <stop offset="48%" stop-color="#ffffff" stop-opacity="0.08"/>
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="120" height="120" rx="30" fill="#050816"/>
      <rect x="10" y="10" width="100" height="100" rx="26" fill="url(#g)"/>
      <rect x="10" y="10" width="100" height="100" rx="26" fill="url(#shine)"/>
      <path d="M28 77c20 17 47 17 64 0" stroke="#ffffff" stroke-width="8" stroke-linecap="round" opacity="0.28" fill="none"/>
      <text x="60" y="71" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="34" font-weight="900" fill="#ffffff">${initials}</text>
    </svg>
  `)}`;
}

function saveLocalClient(client: Client) {
  upsertRow('clients', client);
}

export default function ClientForm() {
  const navigate = useNavigate();
  const [form, setForm] = useState<ClientFormState>(initialForm);
  const [error, setError] = useState('');

  const updateField = <K extends keyof ClientFormState>(key: K, value: ClientFormState[K]) => {
    setForm(current => ({ ...current, [key]: value }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.name.trim() || !form.industry.trim() || !form.contact.trim() || !form.contactEmail.trim()) {
      setError('Client name, industry, contact person, and email are required.');
      return;
    }

    const client: Client = {
      id: `cl-local-${Date.now()}`,
      name: form.name.trim(),
      logoUrl: form.logoUrl.trim() || generatedClientLogo(form.name),
      industry: form.industry.trim(),
      clientType: form.clientType,
      location: form.location.trim() || 'Not specified',
      website: form.website.trim() || 'Not specified',
      contact: form.contact.trim(),
      contactTitle: form.contactTitle.trim() || 'Not specified',
      contactEmail: form.contactEmail.trim(),
      contactPhone: form.contactPhone.trim() || 'Not specified',
      contractTerms: form.contractTerms.trim() || 'Not specified',
      paymentTerms: form.paymentTerms.trim() || 'Net 45 from the date of invoice raised.',
      submissionRules: form.submissionRules.trim() || 'Not specified',
      interviewProcess: form.interviewProcess.trim() || 'Not specified',
      backgroundCheckRules: form.backgroundCheckRules.trim() || 'Not specified',
      visaRestrictions: form.visaRestrictions.trim() || 'Not specified',
      rateCards: form.rateCards.trim() || 'Not specified',
      status: form.status,
      tier: form.tier,
      totalPlacements: Number(form.totalPlacements) || 0,
      activeJobs: Number(form.activeJobs) || 0,
      revenue: '$0',
      recruiter: form.recruiter.trim() || 'Unassigned',
      notes: form.notes.trim() || 'No notes added.',
      createdAt: new Date().toISOString().slice(0, 10),
    };

    saveLocalClient(client);
    navigate(`/clients/${client.id}`);
  };

  return (
    <div className="p-6">
      <button onClick={() => navigate('/clients')} className="mb-5 flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-white">
        <ArrowLeft size={15} />
        Back to Clients
      </button>

      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Add Client / Customer</h1>
          <p className="mt-1 text-sm text-slate-500">Create a CRM profile with intake rules, commercial terms, and staffing contacts.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate('/clients')} className="rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-white/10">
            Cancel
          </button>
          <button form="client-intake-form" type="submit" className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-500">
            <Save size={15} />
            Save Client
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <form id="client-intake-form" onSubmit={handleSubmit} className="space-y-4">
        <Section title="Company Profile" icon={<Building2 size={16} />}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Field label="Client name" value={form.name} onChange={value => updateField('name', value)} required />
            <LogoField
              label="Client logo URL"
              value={form.logoUrl}
              preview={form.logoUrl.trim() || generatedClientLogo(form.name)}
              onChange={value => updateField('logoUrl', value)}
            />
            <Field label="Industry" value={form.industry} onChange={value => updateField('industry', value)} required />
            <SelectField label="Client type" value={form.clientType} options={['Direct client', 'Implementation partner', 'State client', 'Federal client', 'Vendor', 'Prospect']} onChange={value => updateField('clientType', value as Client['clientType'])} />
            <Field label="Website" value={form.website} onChange={value => updateField('website', value)} />
            <Field label="Location" value={form.location} onChange={value => updateField('location', value)} icon={<MapPin size={13} />} />
            <Field label="Recruiter owner" value={form.recruiter} onChange={value => updateField('recruiter', value)} />
            <SelectField label="CRM status" value={form.status} options={['Active', 'Prospect', 'Inactive']} onChange={value => updateField('status', value as Client['status'])} />
            <SelectField label="Client tier" value={form.tier} options={['Platinum', 'Gold', 'Silver', 'Bronze']} onChange={value => updateField('tier', value as Client['tier'])} />
          </div>
        </Section>

        <Section title="Primary Contact" icon={<UserRound size={16} />}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Contact person" value={form.contact} onChange={value => updateField('contact', value)} required />
            <Field label="Contact title" value={form.contactTitle} onChange={value => updateField('contactTitle', value)} />
            <Field label="Email" type="email" value={form.contactEmail} onChange={value => updateField('contactEmail', value)} icon={<Mail size={13} />} required />
            <Field label="Phone" value={form.contactPhone} onChange={value => updateField('contactPhone', value)} icon={<Phone size={13} />} />
          </div>
        </Section>

        <Section title="Commercial Terms" icon={<CreditCard size={16} />}>
          <div className="grid gap-4 xl:grid-cols-2">
            <TextArea label="Contract terms" value={form.contractTerms} onChange={value => updateField('contractTerms', value)} />
            <TextArea label="Payment terms" value={form.paymentTerms} onChange={value => updateField('paymentTerms', value)} />
            <TextArea label="Rate cards" value={form.rateCards} onChange={value => updateField('rateCards', value)} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Total placements" type="number" value={form.totalPlacements} onChange={value => updateField('totalPlacements', value)} />
              <Field label="Active jobs" type="number" value={form.activeJobs} onChange={value => updateField('activeJobs', value)} />
            </div>
          </div>
        </Section>

        <Section title="Recruiting Rules" icon={<ShieldCheck size={16} />}>
          <div className="grid gap-4 xl:grid-cols-2">
            <TextArea label="Submission rules" value={form.submissionRules} onChange={value => updateField('submissionRules', value)} />
            <TextArea label="Interview process" value={form.interviewProcess} onChange={value => updateField('interviewProcess', value)} />
            <TextArea label="Background check rules" value={form.backgroundCheckRules} onChange={value => updateField('backgroundCheckRules', value)} />
            <TextArea label="Visa restrictions" value={form.visaRestrictions} onChange={value => updateField('visaRestrictions', value)} />
          </div>
        </Section>

        <Section title="Notes" icon={<FileText size={16} />}>
          <TextArea label="Client notes" value={form.notes} onChange={value => updateField('notes', value)} rows={5} />
        </Section>
      </form>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="rounded-lg border border-white/5 bg-[#0d1729] p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-blue-300">{icon}</span>
        <h2 className="text-sm font-semibold text-white">{title}</h2>
      </div>
      {children}
    </motion.section>
  );
}

function Field({ label, value, onChange, type = 'text', icon, required = false }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  icon?: ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-500">
        {icon && <span>{icon}</span>}
        {label}
        {required && <span className="text-red-400">*</span>}
      </span>
      <input
        type={type}
        value={value}
        onChange={event => onChange(event.target.value)}
        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-slate-200 outline-none transition-colors placeholder:text-slate-700 focus:border-blue-500/50"
      />
    </label>
  );
}

function LogoField({ label, value, preview, onChange }: {
  label: string;
  value: string;
  preview: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block md:col-span-2 xl:col-span-1">
      <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-500">
        <ImageIcon size={13} />
        {label}
      </span>
      <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-2.5">
        <img
          src={preview}
          alt="Client logo preview"
          className="h-12 w-12 flex-shrink-0 rounded-xl border border-white/10 bg-slate-900 object-contain p-1"
        />
        <div className="min-w-0 flex-1">
          <input
            value={value}
            onChange={event => onChange(event.target.value)}
            placeholder="Paste logo URL, or leave blank for generated logo"
            className="w-full rounded-lg border border-white/10 bg-[#0d1729] px-3 py-2.5 text-sm text-slate-200 outline-none transition-colors placeholder:text-slate-700 focus:border-blue-500/50"
          />
          <p className="mt-1 text-[11px] text-slate-600">Preview helps validate the client name/details before saving.</p>
        </div>
      </div>
    </label>
  );
}

function SelectField({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-500">{label}</span>
      <select
        value={value}
        onChange={event => onChange(event.target.value)}
        className={cn(
          'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-slate-200 outline-none transition-colors focus:border-blue-500/50',
          'appearance-none'
        )}
      >
        {options.map(option => (
          <option key={option} value={option} className="bg-[#0d1729] text-slate-200">
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextArea({ label, value, onChange, rows = 4 }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-500">{label}</span>
      <textarea
        rows={rows}
        value={value}
        onChange={event => onChange(event.target.value)}
        className="w-full resize-y rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm leading-relaxed text-slate-200 outline-none transition-colors placeholder:text-slate-700 focus:border-blue-500/50"
      />
    </label>
  );
}
