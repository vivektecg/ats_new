import { resolveSession } from './auth';
import { LOCAL_CALL_LOGS_KEY, saveRows } from './atsApi';

export type CallOutcome = 'Initiated' | 'Completed' | 'No Answer' | 'Left Voicemail' | 'Busy' | 'Wrong Number';

export type CandidateCallLog = {
  id: string;
  candidateId: string;
  candidateName: string;
  phone: string;
  outcome: CallOutcome;
  startedAt: string;
  endedAt?: string;
  durationSeconds: number;
  notes: string;
  recruiterName: string;
  recruiterEmail: string;
  source: 'ATS Quick Call';
};

function readLogs(): CandidateCallLog[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_CALL_LOGS_KEY);
    const logs = raw ? JSON.parse(raw) : [];
    return Array.isArray(logs) ? logs : [];
  } catch {
    return [];
  }
}

export function getCandidateCallLogs(candidateId?: string) {
  const logs = readLogs();
  return candidateId ? logs.filter(log => log.candidateId === candidateId) : logs;
}

export function saveCandidateCallLog(log: Omit<CandidateCallLog, 'id' | 'recruiterName' | 'recruiterEmail' | 'source'>) {
  const session = resolveSession();
  const nextLog: CandidateCallLog = {
    ...log,
    id: `call-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    recruiterName: session?.name ?? 'Recruiter',
    recruiterEmail: session?.email ?? 'recruiter@eventus.local',
    source: 'ATS Quick Call',
  };
  const nextLogs = [nextLog, ...readLogs()].slice(0, 500);
  window.localStorage.setItem(LOCAL_CALL_LOGS_KEY, JSON.stringify(nextLogs));
  saveRows('callLogs', nextLogs);
  return nextLog;
}

export function openCandidateDialer(phone: string) {
  const trimmed = phone.trim();
  if (!trimmed) return false;
  window.location.href = `tel:${trimmed.replace(/[^\d+]/g, '')}`;
  return true;
}

export function formatCallDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (minutes === 0) return `${remainder}s`;
  return `${minutes}m ${String(remainder).padStart(2, '0')}s`;
}
