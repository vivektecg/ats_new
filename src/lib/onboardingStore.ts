import { getAllCandidates, getAllJobs } from './localRecords';
import { saveRows } from './atsApi';
import type { Candidate, Job } from './types';

export type TaskStatus = 'Pending' | 'In Progress' | 'Completed' | 'Needs Review';
export type OnboardingStatus = 'Not Started' | 'In Progress' | 'Blocked' | 'Completed';
export type ComplianceStatus = 'Pending' | 'Verified' | 'Needs Review' | 'Expired';

export type OnboardingTask = {
  id: string;
  title: string;
  owner: 'Candidate' | 'Recruiter' | 'HR' | 'Client' | 'Manager' | 'Payroll' | 'IT';
  category: 'Offer' | 'Documents' | 'Compliance' | 'Client' | 'Payroll' | 'IT' | 'Orientation';
  status: TaskStatus;
  dueDate: string;
  notes: string;
  documents?: OnboardingTaskDocument[];
};

export type OnboardingTaskDocument = {
  id: string;
  taskId: string;
  fileName: string;
  direction: 'Sent' | 'Received';
  uploadedAt: string;
  uploadedBy: string;
  notes?: string;
};

export type OnboardingCase = {
  id: string;
  candidateId: string;
  candidateName: string;
  jobId: string;
  jobTitle: string;
  clientName: string;
  recruiter: string;
  startDate: string;
  status: OnboardingStatus;
  packetSentAt?: string;
  eSignatureStatus: 'Not Sent' | 'Sent' | 'Signed';
  i9Status: ComplianceStatus;
  eVerifyStatus: ComplianceStatus | 'Not Required';
  backgroundStatus: ComplianceStatus;
  tasks: OnboardingTask[];
  activity: string[];
  createdAt: string;
  updatedAt: string;
};

export type ComplianceCheck = {
  id: string;
  label: string;
  category: 'I-9 / E-Verify' | 'Work Authorization' | 'Documents' | 'Background' | 'Privacy' | 'Client Rules' | 'Audit';
  status: ComplianceStatus;
  owner: 'Candidate' | 'Recruiter' | 'HR' | 'Client';
  dueDate: string;
  evidence: string;
  notes: string;
};

export type ComplianceCase = {
  id: string;
  candidateId: string;
  candidateName: string;
  jobId?: string;
  jobTitle?: string;
  clientName?: string;
  status: ComplianceStatus;
  riskLevel: 'Low' | 'Medium' | 'High';
  checks: ComplianceCheck[];
  activity: string[];
  createdAt: string;
  updatedAt: string;
};

export const LOCAL_ONBOARDING_KEY = 'eventus:test:onboarding-cases';
export const LOCAL_COMPLIANCE_CASES_KEY = 'eventus:test:compliance-cases';
export const ONBOARDING_UPDATED_EVENT = 'eventus:onboarding-updated';

function today(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

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

function writeArray<T>(key: string, rows: T[]) {
  window.localStorage.setItem(key, JSON.stringify(rows));
  window.dispatchEvent(new CustomEvent(ONBOARDING_UPDATED_EVENT, { detail: { key } }));
}

function defaultOnboardingTasks(_candidate: Candidate, job: Job): OnboardingTask[] {
  return [
    { id: 'offer-letter', title: 'Generate and send offer letter', owner: 'Recruiter', category: 'Offer', status: 'Pending', dueDate: today(), notes: `Use ${job.title} offer details.` },
    { id: 'offer-signature', title: 'Collect candidate e-signature', owner: 'Candidate', category: 'Offer', status: 'Pending', dueDate: today(1), notes: 'Offer, NDA, and consulting agreement if applicable.' },
    { id: 'onboarding-packet', title: 'Send onboarding packet', owner: 'HR', category: 'Documents', status: 'Pending', dueDate: today(1), notes: 'Welcome note, forms, handbook, payroll instructions.' },
    { id: 'resume-final', title: 'Lock client-submitted resume version', owner: 'Recruiter', category: 'Documents', status: 'Pending', dueDate: today(1), notes: 'Attach final submitted resume to candidate document record.' },
    { id: 'i9-section-1', title: 'I-9 Section 1 candidate completion', owner: 'Candidate', category: 'Compliance', status: 'Pending', dueDate: today(2), notes: 'Candidate completes employment eligibility information.' },
    { id: 'i9-section-2', title: 'I-9 Section 2 employer review', owner: 'HR', category: 'Compliance', status: 'Pending', dueDate: today(3), notes: 'Review original/authorized remote document evidence.' },
    { id: 'everify', title: 'E-Verify case preparation/status', owner: 'HR', category: 'Compliance', status: 'Pending', dueDate: today(3), notes: 'Use only when employer participates and candidate is eligible for the workflow.' },
    { id: 'background', title: 'Background check / client compliance', owner: 'Client', category: 'Client', status: 'Pending', dueDate: today(4), notes: 'Client-specific background, drug screen, or security requirements.' },
    { id: 'w4-direct-deposit', title: 'W-4 and direct deposit collection', owner: 'Payroll', category: 'Payroll', status: 'Pending', dueDate: today(4), notes: 'Payroll setup before start date.' },
    { id: 'equipment-access', title: 'Laptop, email, badge, system access', owner: 'IT', category: 'IT', status: 'Pending', dueDate: today(5), notes: 'Client/contractor access readiness.' },
    { id: 'orientation', title: 'First-day orientation and timesheet setup', owner: 'Manager', category: 'Orientation', status: 'Pending', dueDate: today(7), notes: 'Confirm reporting manager, time zone, and timesheet tool.' },
  ];
}

function defaultComplianceChecks(candidate: Candidate, job?: Job): ComplianceCheck[] {
  return [
    { id: 'consent-rtr', label: 'Consent / RTR tracking', category: 'Documents', status: 'Pending', owner: 'Recruiter', dueDate: today(), evidence: candidate.email || candidate.phone || 'Candidate contact pending', notes: 'Confirm representation authorization and submission consent.' },
    { id: 'work-auth', label: 'Work authorization / visa evidence', category: 'Work Authorization', status: 'Pending', owner: 'Recruiter', dueDate: today(1), evidence: candidate.passportNumber ? 'Passport number on profile' : 'Authorization details pending', notes: 'Collect visa, EAD, GC, passport, or USC confirmation as applicable.' },
    { id: 'i9-s1', label: 'I-9 Section 1', category: 'I-9 / E-Verify', status: 'Pending', owner: 'Candidate', dueDate: today(2), evidence: 'Candidate completion required', notes: 'Digital I-9 workflow placeholder.' },
    { id: 'i9-s2', label: 'I-9 Section 2 document review', category: 'I-9 / E-Verify', status: 'Pending', owner: 'HR', dueDate: today(3), evidence: 'Employer review required', notes: 'Review acceptable List A or List B/C documents.' },
    { id: 'everify', label: 'E-Verify status', category: 'I-9 / E-Verify', status: 'Pending', owner: 'HR', dueDate: today(3), evidence: 'Not submitted', notes: 'Manual status tracking until official provider/API is connected.' },
    { id: 'background', label: 'Background check / drug screen', category: 'Background', status: 'Pending', owner: 'Client', dueDate: today(4), evidence: job?.client ?? 'Client pending', notes: 'Track client-specific onboarding clearance.' },
    { id: 'client-docs', label: 'Client-required documents', category: 'Client Rules', status: 'Pending', owner: 'Recruiter', dueDate: today(4), evidence: job?.title ?? 'Job pending', notes: 'Signed agreement, references, education/certifications as required.' },
    { id: 'privacy', label: 'Privacy notice and data consent', category: 'Privacy', status: 'Pending', owner: 'Recruiter', dueDate: today(), evidence: 'Notice pending', notes: 'Candidate data use, retention, and deletion rights notice.' },
    { id: 'audit', label: 'Human decision and AI explanation retained', category: 'Audit', status: 'Pending', owner: 'Recruiter', dueDate: today(), evidence: 'Recruiter decision pending', notes: 'AI can recommend and flag gaps; recruiter makes final decision.' },
  ];
}

export function loadOnboardingCases() {
  return readArray<OnboardingCase>(LOCAL_ONBOARDING_KEY);
}

export function saveOnboardingCases(cases: OnboardingCase[]) {
  writeArray(LOCAL_ONBOARDING_KEY, cases);
  saveRows('onboardingCases', cases);
}

export function createOnboardingCase(candidateId: string, jobId?: string) {
  const candidates = getAllCandidates();
  const jobs = getAllJobs();
  const candidate = candidates.find(item => item.id === candidateId) ?? candidates[0];
  const job = jobs.find(item => item.id === jobId) ?? jobs[0];
  if (!candidate || !job) return undefined;
  const now = new Date().toISOString();
  return {
    id: `onb-${Date.now()}`,
    candidateId: candidate.id,
    candidateName: candidate.name,
    jobId: job.id,
    jobTitle: job.title,
    clientName: job.client,
    recruiter: candidate.recruiter,
    startDate: today(7),
    status: 'In Progress' as OnboardingStatus,
    eSignatureStatus: 'Not Sent' as const,
    i9Status: 'Pending' as ComplianceStatus,
    eVerifyStatus: 'Pending' as const,
    backgroundStatus: 'Pending' as ComplianceStatus,
    tasks: defaultOnboardingTasks(candidate, job),
    activity: [`Onboarding started for ${candidate.name} against ${job.title}.`],
    createdAt: now,
    updatedAt: now,
  } satisfies OnboardingCase;
}

export function loadComplianceCases() {
  return readArray<ComplianceCase>(LOCAL_COMPLIANCE_CASES_KEY);
}

export function saveComplianceCases(cases: ComplianceCase[]) {
  writeArray(LOCAL_COMPLIANCE_CASES_KEY, cases);
  saveRows('complianceCases', cases);
}

export function createComplianceCase(candidateId: string, jobId?: string) {
  const candidates = getAllCandidates();
  const jobs = getAllJobs();
  const candidate = candidates.find(item => item.id === candidateId) ?? candidates[0];
  const job = jobs.find(item => item.id === jobId);
  if (!candidate) return undefined;
  const now = new Date().toISOString();
  return {
    id: `comp-${Date.now()}`,
    candidateId: candidate.id,
    candidateName: candidate.name,
    jobId: job?.id,
    jobTitle: job?.title,
    clientName: job?.client,
    status: 'Pending' as ComplianceStatus,
    riskLevel: 'Medium' as const,
    checks: defaultComplianceChecks(candidate, job),
    activity: [`Compliance case created for ${candidate.name}.`],
    createdAt: now,
    updatedAt: now,
  } satisfies ComplianceCase;
}

export function progressForTasks(tasks: OnboardingTask[]) {
  if (!tasks.length) return 0;
  return Math.round((tasks.filter(task => task.status === 'Completed').length / tasks.length) * 100);
}

export function progressForChecks(checks: ComplianceCheck[]) {
  if (!checks.length) return 0;
  return Math.round((checks.filter(check => check.status === 'Verified').length / checks.length) * 100);
}
