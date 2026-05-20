import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, Plus, Globe, Phone, Mail, TrendingUp, Briefcase, Users } from 'lucide-react';
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

const statusColors: Record<string, string> = {
  Active: 'text-emerald-400 bg-emerald-500/10',
  Prospect: 'text-blue-400 bg-blue-500/10',
  Inactive: 'text-slate-400 bg-white/5',
};

function clientInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.slice(0, 2).map(part => part[0]).join('') || 'CI').toUpperCase();
}

export default function Clients() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('All');
  const [localClients] = useState<Client[]>(loadLocalClients);
  const allClients = [
    ...clients,
    ...localClients.filter(localClient => !clients.some(client => client.id === localClient.id)),
  ];

  const filtered = allClients.filter(c => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.industry.toLowerCase().includes(search.toLowerCase()) ||
      c.clientType.toLowerCase().includes(search.toLowerCase()) ||
      c.contact.toLowerCase().includes(search.toLowerCase());
    const matchTier = tierFilter === 'All' || c.tier === tierFilter;
    return matchSearch && matchTier;
  });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Clients CRM</h1>
          <p className="text-sm text-slate-500 mt-0.5">{allClients.length} clients in your network</p>
        </div>
        <button onClick={() => navigate('/clients/new')} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors">
          <Plus size={15} />
          Add Client
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
        {[
          { label: 'Active clients', count: allClients.filter(c => c.status === 'Active').length, color: 'text-emerald-400', icon: TrendingUp },
          { label: 'Prospects', count: allClients.filter(c => c.status === 'Prospect').length, color: 'text-blue-400', icon: Globe },
          { label: 'Total placements', count: allClients.reduce((a, c) => a + c.totalPlacements, 0), color: 'text-violet-400', icon: Users },
          { label: 'Active jobs', count: jobs.filter(job => job.status === 'Active').length, color: 'text-cyan-400', icon: Briefcase },
          { label: 'Submitted candidates', count: submissions.length, color: 'text-amber-400', icon: Mail },
        ].map(s => (
          <div key={s.label} className="bg-[#0d1729] border border-white/5 rounded-xl p-4">
            <div className="flex items-center justify-between gap-3">
              <s.icon size={17} className={cn('opacity-80', s.color)} />
              <p className={cn('text-2xl font-bold', s.color)}>{s.count}</p>
            </div>
            <p className="text-xs text-slate-500 mt-2">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search clients, industries, types, contacts..."
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-all"
          />
        </div>
        {['All', 'Platinum', 'Gold', 'Silver', 'Bronze'].map(tier => (
          <button
            key={tier}
            onClick={() => setTierFilter(tier)}
            className={cn(
              'px-3 py-2 rounded-xl text-xs font-medium border transition-all',
              tierFilter === tier
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white/5 text-slate-400 border-white/10 hover:border-white/20'
            )}
          >
            {tier}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((client, i) => (
          <motion.div
            key={client.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            onClick={() => navigate(`/clients/${client.id}`)}
            className="bg-[#0d1729] border border-white/5 rounded-xl p-5 cursor-pointer hover:border-blue-500/20 hover:-translate-y-0.5 transition-all group"
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {client.logoUrl ? (
                  <img src={client.logoUrl} alt={`${client.name} logo`} className="h-10 w-10 flex-shrink-0 rounded-xl border border-white/10 bg-slate-900 object-contain p-1" />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-600 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                    {clientInitials(client.name)}
                  </div>
                )}
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-white group-hover:text-blue-400 transition-colors truncate">{client.name}</h3>
                  <p className="text-xs text-slate-500 truncate">{client.industry}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full', tierColors[client.tier])}>
                  {client.tier}
                </span>
                <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full', statusColors[client.status])}>
                  {client.status}
                </span>
              </div>
            </div>

	            <div className="space-y-1.5 text-xs text-slate-500 mb-3">
	              <div className="flex items-center gap-1.5"><Briefcase size={10} />{client.clientType}</div>
	              <div className="flex items-center gap-1.5"><Globe size={10} />{client.location}</div>
	              <div className="flex items-center gap-1.5"><Phone size={10} />{client.contact} · {client.contactTitle}</div>
	              <div className="flex items-center gap-1.5"><Mail size={10} className="flex-shrink-0" /><span className="truncate">{client.contactEmail}</span></div>
	            </div>

	            <div className="mb-3 rounded-lg border border-white/5 bg-white/[0.03] p-3">
	              <p className="text-[10px] uppercase tracking-wider text-slate-600">Payment / submission rules</p>
	              <p className="mt-1 line-clamp-2 text-xs text-slate-400">{client.paymentTerms}</p>
	            </div>

	            <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/5">
              <div className="text-center">
                <p className="text-sm font-bold text-white">{client.totalPlacements}</p>
                <p className="text-[10px] text-slate-600">Placements</p>
              </div>
	              <div className="text-center border-x border-white/5">
	                <p className="text-sm font-bold text-blue-400">{jobs.filter(job => job.clientId === client.id).length}</p>
	                <p className="text-[10px] text-slate-600">Active Jobs</p>
	              </div>
	              <div className="text-center">
	                <p className="text-sm font-bold text-emerald-400">{submissions.filter(submission => submission.clientId === client.id).length}</p>
	                <p className="text-[10px] text-slate-600">Submitted</p>
	              </div>
	            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
