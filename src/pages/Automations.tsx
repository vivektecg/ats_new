import { useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, Briefcase, CalendarClock, Clock, Eye, Mail, Play, Plus, Send, Trash2, Users } from 'lucide-react';
import { QuickActionModal, QuickIconButton } from '@/components/ats/QuickActionModal';
import { LOCAL_AUTOMATIONS_KEY, saveRows } from '@/lib/atsApi';
import { cn } from '@/lib/utils';

type AutomationCategory = 'Candidate' | 'Interview' | 'Submission' | 'Follow-up' | 'Jobs' | 'Reports' | 'RPO';
type AutomationRecord = {
  id: string;
  name: string;
  trigger: string;
  action: string;
  status: boolean;
  runs: number;
  category: AutomationCategory;
  lastRun: string;
};

const LOCAL_AUTOMATIONS_RESET_KEY = 'eventus:test:automations-reset-2026-05-16';
const categories: AutomationCategory[] = ['Candidate', 'Interview', 'Submission', 'Follow-up', 'Jobs', 'Reports', 'RPO'];
const aiTaskSuggestions = [
  { name: 'Missing Details Follow-up', trigger: 'Candidate profile missing phone, email, work authorization, rate, or availability', action: 'Create recruiter task and draft missing details email', category: 'Candidate' as const },
  { name: 'RTR Reminder', trigger: 'Candidate submitted without RTR received', action: 'Create RTR follow-up task', category: 'Submission' as const },
  { name: 'Interview No-show Follow-up', trigger: 'Interview marked No Show', action: 'Create same-day candidate/client follow-up task', category: 'Interview' as const },
  { name: 'High Priority Job TAT Alert', trigger: 'High priority job deadline within 24 hours', action: 'Notify assigned recruiter and create sourcing task', category: 'Jobs' as const },
  { name: 'RPO Weekly Delivery Digest', trigger: 'Every Friday 5 PM', action: 'Prepare RPO client delivery report', category: 'RPO' as const },
];

function loadAutomations(): AutomationRecord[] {
  try {
    if (!window.localStorage.getItem(LOCAL_AUTOMATIONS_RESET_KEY)) {
      window.localStorage.removeItem(LOCAL_AUTOMATIONS_KEY);
      window.localStorage.setItem(LOCAL_AUTOMATIONS_RESET_KEY, 'true');
      return [];
    }
    const raw = window.localStorage.getItem(LOCAL_AUTOMATIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAutomations(records: AutomationRecord[]) {
  window.localStorage.setItem(LOCAL_AUTOMATIONS_KEY, JSON.stringify(records));
  saveRows('automations', records.map(record => ({ ...record })) as Array<Record<string, unknown> & { id: string }>);
}

function iconFor(category: AutomationCategory) {
  if (category === 'Candidate') return Users;
  if (category === 'Interview') return Bell;
  if (category === 'Submission') return Send;
  if (category === 'Jobs') return Briefcase;
  if (category === 'Reports' || category === 'RPO') return Mail;
  return Clock;
}

export default function Automations() {
  const [automations, setAutomations] = useState<AutomationRecord[]>(loadAutomations);
  const [showCreate, setShowCreate] = useState(false);
  const [automationAction, setAutomationAction] = useState<null | { type: 'details' | 'run' | 'delete'; automation: AutomationRecord }>(null);
  const [form, setForm] = useState({
    name: '',
    trigger: '',
    action: '',
    category: 'Candidate' as AutomationCategory,
    status: true,
  });

  function persist(next: AutomationRecord[]) {
    setAutomations(next);
    saveAutomations(next);
  }

  function createAutomation() {
    if (!form.name.trim() || !form.trigger.trim() || !form.action.trim()) return;
    persist([
      {
        id: `auto-local-${Date.now()}`,
        name: form.name.trim(),
        trigger: form.trigger.trim(),
        action: form.action.trim(),
        category: form.category,
        status: form.status,
        runs: 0,
        lastRun: 'Not run yet',
      },
      ...automations,
    ]);
    setForm({ name: '', trigger: '', action: '', category: 'Candidate', status: true });
    setShowCreate(false);
  }

  function addSuggestion(suggestion: typeof aiTaskSuggestions[number]) {
    setForm({
      name: suggestion.name,
      trigger: suggestion.trigger,
      action: suggestion.action,
      category: suggestion.category,
      status: true,
    });
    setShowCreate(true);
  }

  function runAutomation(automation: AutomationRecord) {
    persist(automations.map(item => item.id === automation.id ? {
      ...item,
      runs: item.runs + 1,
      lastRun: new Date().toLocaleString(),
    } : item));
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Automations</h1>
          <p className="mt-0.5 text-sm text-slate-500">Create manual testing automations for recruiting, staffing, and RPO workflows.</p>
        </div>
        <button onClick={() => setShowCreate(current => !current)} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-500">
          <Plus size={15} />
          Create Automation
        </button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Total', value: automations.length, color: 'text-white' },
          { label: 'Active', value: automations.filter(item => item.status).length, color: 'text-emerald-400' },
          { label: 'Total Runs', value: automations.reduce((sum, item) => sum + item.runs, 0), color: 'text-blue-400' },
          { label: 'Paused', value: automations.filter(item => !item.status).length, color: 'text-slate-400' },
        ].map(stat => (
          <div key={stat.label} className="rounded-lg border border-white/5 bg-[#0d1729] p-4 text-center">
            <p className={cn('text-2xl font-bold', stat.color)}>{stat.value}</p>
            <p className="mt-0.5 text-xs text-slate-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {showCreate && (
        <section className="mb-5 rounded-lg border border-white/5 bg-[#0d1729] p-5">
          <div className="mb-4 flex items-center gap-2">
            <CalendarClock size={16} className="text-blue-300" />
            <h2 className="text-sm font-semibold text-white">Create Automation Task</h2>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Field label="Automation name" value={form.name} onChange={value => setForm(current => ({ ...current, name: value }))} />
            <Select label="Category" value={form.category} options={categories} onChange={value => setForm(current => ({ ...current, category: value as AutomationCategory }))} />
            <Field label="When / trigger" value={form.trigger} onChange={value => setForm(current => ({ ...current, trigger: value }))} />
            <Field label="Then / action" value={form.action} onChange={value => setForm(current => ({ ...current, action: value }))} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={createAutomation} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500">Save Automation</button>
            <button onClick={() => setShowCreate(false)} className="rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/10">Cancel</button>
          </div>
        </section>
      )}

      <section className="mb-5 rounded-lg border border-violet-500/20 bg-violet-500/10 p-5">
        <h2 className="mb-3 text-sm font-semibold text-violet-100">AI suggested staffing automation tasks</h2>
        <div className="grid gap-2 lg:grid-cols-2">
          {aiTaskSuggestions.map(suggestion => (
            <button key={suggestion.name} onClick={() => addSuggestion(suggestion)} className="rounded-lg border border-white/10 bg-white/[0.04] p-3 text-left hover:bg-white/[0.07]">
              <p className="text-sm font-semibold text-white">{suggestion.name}</p>
              <p className="mt-1 text-xs text-slate-400">{suggestion.trigger}</p>
            </button>
          ))}
        </div>
      </section>

      <div className="space-y-3">
        {automations.length === 0 && (
          <div className="rounded-lg border border-white/5 bg-[#0d1729] p-10 text-center">
            <p className="text-sm font-semibold text-white">No automation test data yet.</p>
            <p className="mt-1 text-xs text-slate-500">Create one manually or use an AI suggested task above.</p>
          </div>
        )}
        {automations.map((automation, index) => {
          const Icon = iconFor(automation.category);
          return (
            <motion.div
              key={automation.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              className={cn('flex items-center gap-4 rounded-lg border border-white/5 bg-[#0d1729] p-5', !automation.status && 'opacity-60')}
            >
              <div className={cn('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border', automation.status ? 'border-blue-500/20 bg-blue-500/15 text-blue-300' : 'border-white/5 bg-white/5 text-slate-500')}>
                <Icon size={17} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">{automation.name}</p>
                <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                  <span className="rounded-full bg-white/5 px-2 py-0.5">When: {automation.trigger}</span>
                  <span className="rounded-full bg-white/5 px-2 py-0.5">Then: {automation.action}</span>
                </div>
              </div>
              <span className="hidden rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-slate-500 sm:inline">{automation.category}</span>
              <div className="flex items-center gap-1.5">
                <QuickIconButton title="Automation details" onClick={() => setAutomationAction({ type: 'details', automation })}><Eye size={14} /></QuickIconButton>
                <QuickIconButton title="Run automation" onClick={() => setAutomationAction({ type: 'run', automation })}><Play size={14} /></QuickIconButton>
                <QuickIconButton title="Delete automation" onClick={() => setAutomationAction({ type: 'delete', automation })}><Trash2 size={14} /></QuickIconButton>
              </div>
              <button onClick={() => persist(automations.map(item => item.id === automation.id ? { ...item, status: !item.status } : item))} className={cn('relative h-5 w-10 flex-shrink-0 rounded-full transition-all', automation.status ? 'bg-blue-600' : 'bg-white/10')}>
                <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all', automation.status ? 'left-5' : 'left-0.5')} />
              </button>
            </motion.div>
          );
        })}
      </div>

      {automationAction && (
        <QuickActionModal
          title={automationAction.type === 'details' ? 'Automation Details' : automationAction.type === 'run' ? 'Run Automation' : 'Delete Automation'}
          subtitle={`${automationAction.automation.name} - ${automationAction.automation.category}`}
          onCancel={() => setAutomationAction(null)}
          onSave={automationAction.type === 'details' ? undefined : () => {
            if (automationAction.type === 'run') runAutomation(automationAction.automation);
            if (automationAction.type === 'delete') persist(automations.filter(item => item.id !== automationAction.automation.id));
            setAutomationAction(null);
          }}
          saveLabel={automationAction.type === 'delete' ? 'Delete' : 'Save / Update'}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <Info label="Trigger" value={automationAction.automation.trigger} />
            <Info label="Action" value={automationAction.automation.action} />
            <Info label="Runs" value={String(automationAction.automation.runs)} />
            <Info label="Last run" value={automationAction.automation.lastRun} />
          </div>
        </QuickActionModal>
      )}
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
      <span className="mb-1.5 block text-xs font-medium text-slate-400">{label}</span>
      <input value={value} onChange={event => onChange(event.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500/60" />
    </label>
  );
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-400">{label}</span>
      <select value={value} onChange={event => onChange(event.target.value)} className="w-full rounded-lg border border-white/10 bg-[#111b2d] px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500/60">
        {options.map(option => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}
