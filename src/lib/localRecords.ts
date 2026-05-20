import { candidateDocuments, candidates, clients, interviews, jobs, submissions, tasks } from './data';
import { LOCAL_CANDIDATES_KEY, LOCAL_JOBS_KEY } from './atsLocalStore';
import { LOCAL_CLIENTS_KEY, LOCAL_DOCUMENTS_KEY, LOCAL_INTERVIEWS_KEY, LOCAL_SUBMISSIONS_KEY, LOCAL_TASKS_KEY, shouldUseDemoData } from './atsApi';
import type { Candidate, CandidateDocument, CandidateStatus, Client, Interview, Job, JobStatus, Priority, Submission, Task } from './types';

type LooseRecord = Record<string, unknown>;

function readArray<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function text(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return fallback;
}

function numberValue(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function listValue(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(item => text(item).trim()).filter(Boolean);
  return text(value).split(',').map(skill => skill.trim()).filter(Boolean);
}

function candidateStatus(value: unknown): CandidateStatus {
  const allowed: CandidateStatus[] = ['New', 'Screening', 'Interview', 'Offer', 'Placed', 'Rejected', 'On Hold'];
  const status = text(value);
  return allowed.includes(status as CandidateStatus) ? status as CandidateStatus : 'New';
}

function jobStatus(value: unknown): JobStatus {
  if (value === 'Open') return 'Active';
  if (value === 'Hold') return 'On Hold';
  const allowed: JobStatus[] = ['Active', 'On Hold', 'Filled', 'Cancelled'];
  const status = text(value);
  return allowed.includes(status as JobStatus) ? status as JobStatus : 'Active';
}

function priority(value: unknown): Priority {
  const allowed: Priority[] = ['Low', 'Medium', 'High', 'Critical'];
  const level = text(value);
  return allowed.includes(level as Priority) ? level as Priority : 'Medium';
}

function firstNote(value: unknown): string | undefined {
  return Array.isArray(value) ? text(value[0]) : undefined;
}

function mergeSeedRows<T extends { id: string }>(seedRows: T[], storedRows: T[]) {
  if (!shouldUseDemoData()) return storedRows;
  return [
    ...seedRows,
    ...storedRows.filter(local => !seedRows.some(seed => seed.id === local.id)),
  ];
}

function toCandidate(record: LooseRecord): Candidate {
  return {
    id: String(record.id),
    name: text(record.name ?? record.fullName, 'Unnamed Candidate'),
    email: text(record.email),
    phone: text(record.phone),
    title: text(record.title ?? record.currentTitle),
    location: text(record.location),
    status: candidateStatus(record.status),
    skills: listValue(record.skills),
    experience: numberValue(record.experience ?? record.totalExperience),
    salary: text(record.salary ?? record.expectedRate ?? record.currentRate, 'Open'),
    availability: text(record.availability, 'Needs confirmation'),
    source: text(record.source, 'Manual'),
    recruiter: text(record.recruiter ?? record.owner, 'SuperUser'),
    createdAt: text(record.createdAt, new Date().toISOString().slice(0, 10)),
    updatedAt: text(record.updatedAt, new Date().toISOString().slice(0, 10)),
    summary: text(record.summary, firstNote(record.notes) ?? 'Manual candidate record.'),
    linkedin: text(record.linkedin ?? record.linkedinUrl) || undefined,
    resume: text(record.resume ?? record.resumeFile) || undefined,
    passportNumber: text(record.passportNumber) || undefined,
    rating: numberValue(record.rating, 4),
  };
}

function toJob(record: LooseRecord): Job {
  const requirements = [
    ...text(record.mandatorySkills).split(','),
    ...text(record.preferredSkills).split(','),
  ].map(skill => skill.trim()).filter(Boolean);

  return {
    id: String(record.id),
    externalJobId: text(record.externalJobId) || undefined,
    title: text(record.jobTitle ?? record.title, 'Untitled Job'),
    client: text(record.clientName ?? record.client, 'Client'),
    clientId: text(record.clientId),
    spocName: text(record.spocName) || undefined,
    location: text(record.location),
    type: text(record.employmentType ?? record.type, 'Contract'),
    status: jobStatus(record.jobStatus ?? record.status),
    priority: priority(record.priorityLevel ?? record.priority),
    salary: text(record.billRate ?? record.payRate ?? record.salary, 'Open'),
    openings: numberValue(record.openings, 1),
    filled: numberValue(record.filled),
    recruiter: text(record.assignedRecruiter ?? record.recruiter, 'SuperUser'),
    description: text(record.jobDescription ?? record.description),
    requirements,
    postedDate: text(record.postedDate, new Date().toISOString().slice(0, 10)),
    closeDate: text(record.submissionDeadline ?? record.closeDate),
    submissions: numberValue(record.submissions),
    department: text(record.department, 'Recruiting'),
  };
}

export function getAllCandidates(): Candidate[] {
  const localCandidates = readArray<LooseRecord>(LOCAL_CANDIDATES_KEY).map(toCandidate);
  return mergeSeedRows(candidates, localCandidates);
}

export function getAllJobs(): Job[] {
  const localJobs = readArray<LooseRecord>(LOCAL_JOBS_KEY).map(toJob);
  return mergeSeedRows(jobs, localJobs);
}

export function getAllClients(): Client[] {
  const localClients = readArray<Client>(LOCAL_CLIENTS_KEY);
  return mergeSeedRows(clients, localClients);
}

export function getAllSubmissions(): Submission[] {
  const localSubmissions = readArray<Submission>(LOCAL_SUBMISSIONS_KEY);
  return mergeSeedRows(submissions, localSubmissions);
}

export function getAllInterviews(): Interview[] {
  const localInterviews = readArray<Interview>(LOCAL_INTERVIEWS_KEY);
  return mergeSeedRows(interviews, localInterviews);
}

export function getAllCandidateDocuments(): CandidateDocument[] {
  const localDocuments = readArray<CandidateDocument>(LOCAL_DOCUMENTS_KEY);
  return mergeSeedRows(candidateDocuments, localDocuments);
}

export function getAllTasks(): Task[] {
  const localTasks = readArray<Task>(LOCAL_TASKS_KEY);
  return mergeSeedRows(tasks, localTasks);
}
