import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, Eye, MapPin, Star, MoveHorizontal as MoreHorizontal } from 'lucide-react';
import { QuickActionModal, QuickIconButton } from '@/components/ats/QuickActionModal';
import { LOCAL_CANDIDATES_KEY, readLocalRows, saveRows } from '@/lib/atsApi';
import { getAllCandidates } from '@/lib/localRecords';
import type { Candidate, CandidateStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

const columns: { id: CandidateStatus; label: string; color: string; bg: string }[] = [
  { id: 'Screening',  label: 'Submitted Applicants', color: 'text-violet-400',  bg: 'bg-violet-500/10 border-violet-500/20' },
  { id: 'Interview',  label: 'Interview',      color: 'text-cyan-400',    bg: 'bg-cyan-500/10 border-cyan-500/20' },
  { id: 'Offer',      label: 'Offer',          color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  { id: 'Placed',     label: 'Placed',         color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20' },
];

export default function Pipeline() {
  const navigate = useNavigate();
  const candidates = getAllCandidates();
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [cardPositions, setCardPositions] = useState<Record<string, CandidateStatus>>(
    Object.fromEntries(candidates.map(c => [c.id, c.status as CandidateStatus]))
  );
  const [pipelineAction, setPipelineAction] = useState<null | { candidate: Candidate; status: CandidateStatus }>(null);

  const getColumn = (status: CandidateStatus) =>
    candidates.filter(c => (cardPositions[c.id] ?? c.status) === status);

  function saveCandidateStage(candidate: Candidate, status: CandidateStatus) {
    setCardPositions(previous => ({ ...previous, [candidate.id]: status }));
    const rows = readLocalRows<Candidate>(LOCAL_CANDIDATES_KEY);
    const existing = rows.find(row => row.id === candidate.id);
    const updated = { ...candidate, ...existing, status, updatedAt: new Date().toISOString().slice(0, 10) };
    const nextRows = existing
      ? rows.map(row => row.id === candidate.id ? updated : row)
      : [updated, ...rows];
    saveRows('candidates', nextRows);
  }

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Pipeline Kanban</h1>
          <p className="text-sm text-slate-500 mt-0.5">Drag and drop candidates across stages</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="w-2 h-2 rounded-full bg-blue-500" />
          <span>{candidates.length} total candidates</span>
        </div>
      </div>

      <section className="mb-5 overflow-hidden rounded-xl border border-white/5 bg-[#0d1729]">
        <div className="border-b border-white/5 px-4 py-3">
          <h2 className="text-sm font-semibold text-white">Pipeline Candidate Rows</h2>
          <p className="mt-1 text-xs text-slate-500">Open details or move candidates across stages with quick action popups.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px]">
            <thead>
              <tr className="border-b border-white/5 text-left text-xs uppercase tracking-wider text-slate-500">
                {['Candidate', 'Role / Location', 'Skills', 'Current Stage', 'Rating', 'Actions'].map(header => (
                  <th key={header} className="px-4 py-3 font-medium">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {candidates.map(candidate => {
                const currentStatus = (cardPositions[candidate.id] ?? candidate.status) as CandidateStatus;
                return (
                  <tr key={candidate.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]">
                    <td className="px-4 py-3 text-sm font-semibold text-white">{candidate.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-300">{candidate.title}<p className="mt-1 text-xs text-slate-500">{candidate.location}</p></td>
                    <td className="px-4 py-3 text-xs text-slate-400">{candidate.skills.slice(0, 4).join(', ')}</td>
                    <td className="px-4 py-3"><span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-xs text-blue-300">{currentStatus}</span></td>
                    <td className="px-4 py-3 text-amber-300">{'★'.repeat(candidate.rating)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <QuickIconButton title="View candidate" onClick={() => navigate(`/candidates/${candidate.id}`)}><Eye size={14} /></QuickIconButton>
                        {columns.map(column => (
                          <QuickIconButton key={column.id} title={`Move to ${column.label}`} onClick={() => setPipelineAction({ candidate, status: column.id })}>
                            <CheckCircle2 size={14} />
                          </QuickIconButton>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex gap-4 overflow-x-auto pb-4 flex-1 min-h-0">
        {columns.map(col => {
          const colCandidates = getColumn(col.id);
          return (
            <div
              key={col.id}
              className={cn(
                'flex-shrink-0 w-64 flex flex-col rounded-xl border overflow-hidden transition-all',
                dragOver === col.id ? 'ring-2 ring-blue-500/50' : '',
                col.bg
              )}
              onDragOver={e => { e.preventDefault(); setDragOver(col.id); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={e => {
                const id = e.dataTransfer.getData('candidateId');
                if (id) setCardPositions(prev => ({ ...prev, [id]: col.id }));
                setDragOver(null);
              }}
            >
              <div className="px-4 py-3 flex items-center justify-between border-b border-white/5">
                <span className={cn('text-xs font-semibold', col.color)}>{col.label}</span>
                <span className={cn('text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center bg-black/20', col.color)}>
                  {colCandidates.length}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {colCandidates.map(c => (
                  <motion.div
                    key={c.id}
                    layout
                    draggable
                    onDragStartCapture={e => e.dataTransfer.setData('candidateId', c.id)}
                    onClick={() => navigate(`/candidates/${c.id}`)}
                    className="bg-[#0d1729] border border-white/5 rounded-xl p-3 cursor-pointer hover:border-white/10 transition-all group select-none"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                          {c.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white truncate group-hover:text-blue-400 transition-colors">{c.name}</p>
                          <p className="text-[10px] text-slate-500 truncate">{c.title}</p>
                        </div>
                      </div>
                      <button
                        onClick={e => e.stopPropagation()}
                        className="text-slate-600 hover:text-slate-300 transition-colors flex-shrink-0"
                      >
                        <MoreHorizontal size={13} />
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5 text-[10px] text-slate-600 mb-2">
                      <MapPin size={9} />
                      <span className="truncate">{c.location}</span>
                    </div>

                    <div className="flex flex-wrap gap-1 mb-2">
                      {c.skills.slice(0, 2).map(s => (
                        <span key={s} className="text-[9px] bg-white/5 border border-white/8 text-slate-500 px-1.5 py-0.5 rounded">
                          {s}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-0.5">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} size={8} className={i < c.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-700'} />
                        ))}
                      </div>
                      <span className="text-[10px] text-slate-500">{c.salary.split('–')[0]}</span>
                    </div>
                  </motion.div>
                ))}
                {colCandidates.length === 0 && (
                  <div className="py-8 text-center">
                    <p className="text-xs text-slate-700">Drop candidates here</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {pipelineAction && (
        <QuickActionModal
          title={`Move Candidate to ${pipelineAction.status}`}
          subtitle={`${pipelineAction.candidate.name} - ${pipelineAction.candidate.title}`}
          onCancel={() => setPipelineAction(null)}
          onSave={() => {
            saveCandidateStage(pipelineAction.candidate, pipelineAction.status);
            setPipelineAction(null);
          }}
        >
          <p className="text-sm leading-relaxed text-slate-300">
            This will update the candidate stage in Pipeline and persist the candidate status to the ATS backend/database.
          </p>
        </QuickActionModal>
      )}
    </div>
  );
}
