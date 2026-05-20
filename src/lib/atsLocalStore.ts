import type { CandidateStatus, Priority } from './types';
import { LOCAL_CANDIDATES_KEY, LOCAL_JOBS_KEY, saveRows } from './atsApi';

export { LOCAL_CANDIDATES_KEY, LOCAL_JOBS_KEY } from './atsApi';
export const ATS_RECORDS_UPDATED_EVENT = 'eventus:ats-records-updated';

export function notifyAtsRecordsUpdated(key: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ATS_RECORDS_UPDATED_EVENT, { detail: { key } }));
}

export type CandidateImportInput = {
  id?: string;
  name: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  title?: string;
  location?: string;
  skills?: string[] | string;
  source?: string;
  warning?: string;
  recruiter?: string;
  resumeFile?: string;
  resumeAttachment?: {
    fileName: string;
    fileType: string;
    fileSize: number;
    uploadedAt: string;
  };
};

export type JobImportInput = {
  id?: string;
  externalJobId?: string;
  jobTitle: string;
  clientName?: string;
  clientId?: string;
  spocName?: string;
  location?: string;
  mandatorySkills?: string;
  preferredSkills?: string;
  source?: string;
  priorityLevel?: Priority;
};

function today() {
  return new Date().toISOString().slice(0, 10);
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
  notifyAtsRecordsUpdated(key);
}

function skillList(skills: CandidateImportInput['skills']) {
  return Array.isArray(skills)
    ? skills
    : String(skills ?? '').split(',').map(skill => skill.trim()).filter(Boolean);
}

export function normalizeCandidateRecord(input: Partial<CandidateImportInput> & Record<string, any>, index = 0) {
  const name = input.name ?? input.fullName ?? `Imported Candidate ${index + 1}`;
  const skills = skillList(input.skills);
  const createdAt = input.createdAt ?? today();
  const source = input.source ?? 'Import';
  const warning = input.warning ? `Import warning: ${input.warning}` : '';
  const title = input.title ?? input.currentTitle ?? 'Imported Candidate';

  return {
    id: String(input.id ?? `c-import-${Date.now()}-${index}`),
    name,
    email: input.email ?? '',
    phone: input.phone ?? '',
    title,
    currentCompany: input.currentCompany ?? 'Not provided',
    linkedin: input.linkedin ?? input.linkedinUrl ?? '',
    location: input.location ?? 'Location pending',
    status: (input.status ?? 'New') as CandidateStatus,
    skills,
    experience: Number(input.experience ?? input.totalExperience) || 0,
    usExperience: Number(input.usExperience) || 0,
    relevantExperience: Number(input.relevantExperience) || 0,
    workAuthorization: input.workAuthorization ?? 'Needs confirmation',
    visaStatus: input.visaStatus ?? 'Needs confirmation',
    currentRate: input.currentRate ?? 'Needs confirmation',
    expectedRate: input.expectedRate ?? 'Needs confirmation',
    relocationPreference: input.relocationPreference ?? 'Needs confirmation',
    passportNumber: input.passportNumber ?? '',
    salary: input.salary ?? input.expectedRate ?? 'Open',
    availability: input.availability ?? 'Needs confirmation',
    source,
    recruiter: input.recruiter ?? input.owner ?? 'SuperUser',
    owner: input.owner ?? input.recruiter ?? 'SuperUser',
    createdAt,
    updatedAt: input.updatedAt ?? today(),
    summary: input.summary ?? `${source} candidate imported into The Eventus Consulting Group ATS.${warning ? ` ${warning}` : ''}`,
    notes: Array.isArray(input.notes) ? input.notes : [warning || `${source} import created this candidate.`],
    resumeFile: input.resumeFile ?? input.resume ?? `${name.replace(/\s+/g, '_')}_Resume.pdf`,
    resumeAttachment: input.resumeAttachment,
    supportingDocuments: Array.isArray(input.supportingDocuments) ? input.supportingDocuments : [],
    supportingDocumentAttachments: Array.isArray(input.supportingDocumentAttachments) ? input.supportingDocumentAttachments : [],
    parsedResumeDetails: input.parsedResumeDetails ?? `${title}; source ${source}; ${skills.length ? `skills include ${skills.join(', ')}` : 'skills pending parser review'}.`,
    education: input.education ?? 'Needs confirmation',
    certifications: input.certifications ?? 'Needs confirmation',
    documentChecklist: Array.isArray(input.documentChecklist) ? input.documentChecklist : ['Resume'],
    aiMatchScore: Number(input.aiMatchScore) || 0,
    matchedJobTitle: input.matchedJobTitle ?? 'Not matched yet',
    rating: Number(input.rating) || 3,
    archived: Boolean(input.archived),
  };
}

export function normalizeJobRecord(input: Partial<JobImportInput> & Record<string, any>, index = 0) {
  const title = input.jobTitle ?? input.title ?? `Imported Job ${index + 1}`;
  const mandatorySkills = input.mandatorySkills ?? (Array.isArray(input.requirements) ? input.requirements.slice(0, 3).join(', ') : '');
  const preferredSkills = input.preferredSkills ?? (Array.isArray(input.requirements) ? input.requirements.slice(3).join(', ') : '');
  const source = input.source ?? 'Integration';
  return {
    id: String(input.id ?? `job-import-${Date.now()}-${index}`),
    externalJobId: input.externalJobId ?? `${source.toUpperCase().replace(/[^\w]+/g, '-')}-${Date.now()}`,
    jobTitle: title,
    clientId: input.clientId ?? '',
    clientName: input.clientName ?? input.client ?? `${source} Client`,
    spocName: input.spocName ?? 'SPOC pending',
    clientType: input.clientType ?? 'Direct client',
    location: input.location ?? 'Remote',
    workMode: input.workMode ?? 'Remote',
    employmentType: input.employmentType ?? 'Contract',
    duration: input.duration ?? '6+ months',
    payRate: input.payRate ?? 'Open',
    billRate: input.billRate ?? 'Open',
    visaRestrictions: Array.isArray(input.visaRestrictions) ? input.visaRestrictions : ['Any visa'],
    experienceRequired: input.experienceRequired ?? 'Needs confirmation',
    mandatorySkills,
    preferredSkills,
    certifications: input.certifications ?? 'As required by client',
    educationRequirement: input.educationRequirement ?? 'Bachelor degree or equivalent experience',
    jobDescription: input.jobDescription ?? input.description ?? `${title} imported from ${source}.`,
    submissionDeadline: input.submissionDeadline ?? today(),
    priorityLevel: input.priorityLevel ?? 'Medium',
    assignedRecruiter: input.assignedRecruiter ?? input.recruiter ?? 'SuperUser',
    jobStatus: input.jobStatus ?? 'Open',
    openings: Number(input.openings) || 1,
    submissions: Number(input.submissions) || 0,
    jdFile: input.jdFile ?? '',
    jdAttachment: input.jdAttachment,
    aiSearchKeywords: input.aiSearchKeywords ?? [title, mandatorySkills, preferredSkills].filter(Boolean).join(', '),
    linkedInBoolean: input.linkedInBoolean ?? `("${title}") AND (${mandatorySkills.split(',').map(skill => `"${skill.trim()}"`).filter(Boolean).join(' OR ') || '"skills pending"'})`,
    boardBoolean: input.boardBoolean ?? `("${title}") AND (${mandatorySkills.split(',').map(skill => `"${skill.trim()}"`).filter(Boolean).join(' OR ') || '"skills pending"'})`,
    notes: Array.isArray(input.notes) ? input.notes : [`${source} sync created this job.`],
    history: Array.isArray(input.history) ? input.history : [`Imported from ${source} on ${today()}.`],
  };
}

export function upsertLocalCandidates(inputs: CandidateImportInput[]) {
  const current = readArray<Record<string, any>>(LOCAL_CANDIDATES_KEY).map(normalizeCandidateRecord);
  let imported = 0;
  const next = [...current];

  inputs.forEach((input, index) => {
    const candidate = normalizeCandidateRecord(input, index);
    const existingIndex = next.findIndex(row =>
      (candidate.email && row.email && row.email.toLowerCase() === candidate.email.toLowerCase()) ||
      (candidate.phone && row.phone && row.phone.replace(/\D/g, '') === candidate.phone.replace(/\D/g, '')) ||
      row.id === candidate.id
    );
    if (existingIndex >= 0) {
      next[existingIndex] = { ...next[existingIndex], ...candidate, id: next[existingIndex].id, notes: [...candidate.notes, ...next[existingIndex].notes] };
    } else {
      next.unshift(candidate);
      imported += 1;
    }
  });

  writeArray(LOCAL_CANDIDATES_KEY, next);
  saveRows('candidates', next);
  return { imported, total: next.length };
}

export function upsertLocalJobs(inputs: JobImportInput[]) {
  const current = readArray<Record<string, any>>(LOCAL_JOBS_KEY).map(normalizeJobRecord);
  let imported = 0;
  const next = [...current];

  inputs.forEach((input, index) => {
    const job = normalizeJobRecord(input, index);
    const existingIndex = next.findIndex(row =>
      (job.externalJobId && row.externalJobId === job.externalJobId) ||
      (row.jobTitle.toLowerCase() === job.jobTitle.toLowerCase() && row.clientName.toLowerCase() === job.clientName.toLowerCase()) ||
      row.id === job.id
    );
    if (existingIndex >= 0) {
      next[existingIndex] = { ...next[existingIndex], ...job, id: next[existingIndex].id, history: [...job.history, ...next[existingIndex].history] };
    } else {
      next.unshift(job);
      imported += 1;
    }
  });

  writeArray(LOCAL_JOBS_KEY, next);
  saveRows('jobs', next);
  return { imported, total: next.length };
}
