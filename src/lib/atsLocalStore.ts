import type { CandidateStatus, Priority } from './types';
import { LOCAL_CANDIDATES_KEY, LOCAL_JOBS_KEY, saveRows } from './atsApi';
import { currentOwnerName, resolveSession } from './auth';

export { LOCAL_CANDIDATES_KEY, LOCAL_JOBS_KEY } from './atsApi';
export const ATS_RECORDS_UPDATED_EVENT = 'eventus:ats-records-updated';
type ImportRecord = Record<string, unknown>;
type CandidateImportRecord = ReturnType<typeof normalizeCandidateRecord>;
type JobImportRecord = ReturnType<typeof normalizeJobRecord>;

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

function textValue(value: unknown, fallback = '') {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
}

function stringList(value: unknown) {
  return Array.isArray(value) ? value.map(item => textValue(item)).filter(Boolean) : [];
}

export function normalizeCandidateRecord(input: Partial<CandidateImportInput> & ImportRecord, index = 0) {
  const name = textValue(input.name ?? input.fullName, `Imported Candidate ${index + 1}`);
  const skills = skillList(input.skills);
  const createdAt = textValue(input.createdAt, today());
  const source = textValue(input.source, 'Import');
  const warning = input.warning ? `Import warning: ${textValue(input.warning)}` : '';
  const title = textValue(input.title ?? input.currentTitle, 'Imported Candidate');
  const session = resolveSession();
  const ownerName = textValue(input.recruiter ?? input.owner, session?.name ?? currentOwnerName());

  return {
    id: String(input.id ?? `c-import-${Date.now()}-${index}`),
    name,
    email: textValue(input.email),
    phone: textValue(input.phone),
    title,
    currentCompany: textValue(input.currentCompany, 'Not provided'),
    linkedin: textValue(input.linkedin ?? input.linkedinUrl),
    location: textValue(input.location, 'Location pending'),
    status: (input.status ?? 'New') as CandidateStatus,
    skills,
    experience: Number(input.experience ?? input.totalExperience) || 0,
    usExperience: Number(input.usExperience) || 0,
    relevantExperience: Number(input.relevantExperience) || 0,
    workAuthorization: textValue(input.workAuthorization, 'Needs confirmation'),
    visaStatus: textValue(input.visaStatus, 'Needs confirmation'),
    currentRate: textValue(input.currentRate, 'Needs confirmation'),
    expectedRate: textValue(input.expectedRate, 'Needs confirmation'),
    relocationPreference: textValue(input.relocationPreference, 'Needs confirmation'),
    passportNumber: textValue(input.passportNumber),
    salary: textValue(input.salary ?? input.expectedRate, 'Open'),
    availability: textValue(input.availability, 'Needs confirmation'),
    source,
    recruiter: ownerName,
    owner: ownerName,
    createdBy: textValue(input.createdBy, session?.name ?? ownerName),
    createdByUserId: textValue(input.createdByUserId, session?.id),
    createdByEmail: textValue(input.createdByEmail, session?.email),
    updatedBy: textValue(input.updatedBy, session?.name ?? ownerName),
    updatedByUserId: textValue(input.updatedByUserId, session?.id),
    updatedByEmail: textValue(input.updatedByEmail, session?.email),
    createdAt,
    updatedAt: textValue(input.updatedAt, today()),
    summary: textValue(input.summary, `${source} candidate imported into The Eventus Consulting Group ATS.${warning ? ` ${warning}` : ''}`),
    notes: stringList(input.notes).length ? stringList(input.notes) : [warning || `${source} import created this candidate.`],
    resumeFile: textValue(input.resumeFile ?? input.resume, `${name.replace(/\s+/g, '_')}_Resume.pdf`),
    resumeAttachment: input.resumeAttachment,
    supportingDocuments: stringList(input.supportingDocuments),
    supportingDocumentAttachments: Array.isArray(input.supportingDocumentAttachments) ? input.supportingDocumentAttachments : [],
    parsedResumeDetails: textValue(input.parsedResumeDetails, `${title}; source ${source}; ${skills.length ? `skills include ${skills.join(', ')}` : 'skills pending parser review'}.`),
    education: textValue(input.education, 'Needs confirmation'),
    certifications: textValue(input.certifications, 'Needs confirmation'),
    documentChecklist: stringList(input.documentChecklist).length ? stringList(input.documentChecklist) : ['Resume'],
    aiMatchScore: Number(input.aiMatchScore) || 0,
    matchedJobTitle: textValue(input.matchedJobTitle, 'Not matched yet'),
    rating: Number(input.rating) || 3,
    archived: Boolean(input.archived),
  };
}

export function normalizeJobRecord(input: Partial<JobImportInput> & ImportRecord, index = 0) {
  const title = textValue(input.jobTitle ?? input.title, `Imported Job ${index + 1}`);
  const requirements = stringList(input.requirements);
  const mandatorySkills = textValue(input.mandatorySkills, requirements.slice(0, 3).join(', '));
  const preferredSkills = textValue(input.preferredSkills, requirements.slice(3).join(', '));
  const source = textValue(input.source, 'Integration');
  const session = resolveSession();
  const ownerName = textValue(input.assignedRecruiter ?? input.recruiter, session?.name ?? currentOwnerName());
  return {
    id: String(input.id ?? `job-import-${Date.now()}-${index}`),
    externalJobId: textValue(input.externalJobId, `${source.toUpperCase().replace(/[^\w]+/g, '-')}-${Date.now()}`),
    jobTitle: title,
    clientId: textValue(input.clientId),
    clientName: textValue(input.clientName ?? input.client, `${source} Client`),
    spocName: textValue(input.spocName, 'SPOC pending'),
    clientType: textValue(input.clientType, 'Direct client'),
    location: textValue(input.location, 'Remote'),
    workMode: textValue(input.workMode, 'Remote'),
    employmentType: textValue(input.employmentType, 'Contract'),
    duration: textValue(input.duration, '6+ months'),
    payRate: textValue(input.payRate, 'Open'),
    billRate: textValue(input.billRate, 'Open'),
    visaRestrictions: stringList(input.visaRestrictions).length ? stringList(input.visaRestrictions) : ['Any visa'],
    experienceRequired: textValue(input.experienceRequired, 'Needs confirmation'),
    mandatorySkills,
    preferredSkills,
    certifications: textValue(input.certifications, 'As required by client'),
    educationRequirement: textValue(input.educationRequirement, 'Bachelor degree or equivalent experience'),
    jobDescription: textValue(input.jobDescription ?? input.description, `${title} imported from ${source}.`),
    submissionDeadline: textValue(input.submissionDeadline, today()),
    priorityLevel: (input.priorityLevel ?? 'Medium') as Priority,
    assignedRecruiter: ownerName,
    recruiter: ownerName,
    createdBy: textValue(input.createdBy, session?.name ?? ownerName),
    createdByUserId: textValue(input.createdByUserId, session?.id),
    createdByEmail: textValue(input.createdByEmail, session?.email),
    updatedBy: textValue(input.updatedBy, session?.name ?? ownerName),
    updatedByUserId: textValue(input.updatedByUserId, session?.id),
    updatedByEmail: textValue(input.updatedByEmail, session?.email),
    jobStatus: textValue(input.jobStatus, 'Open'),
    openings: Number(input.openings) || 1,
    submissions: Number(input.submissions) || 0,
    jdFile: textValue(input.jdFile),
    jdAttachment: input.jdAttachment,
    aiSearchKeywords: textValue(input.aiSearchKeywords, [title, mandatorySkills, preferredSkills].filter(Boolean).join(', ')),
    linkedInBoolean: textValue(input.linkedInBoolean, `("${title}") AND (${mandatorySkills.split(',').map(skill => `"${skill.trim()}"`).filter(Boolean).join(' OR ') || '"skills pending"'})`),
    boardBoolean: textValue(input.boardBoolean, `("${title}") AND (${mandatorySkills.split(',').map(skill => `"${skill.trim()}"`).filter(Boolean).join(' OR ') || '"skills pending"'})`),
    notes: stringList(input.notes).length ? stringList(input.notes) : [`${source} sync created this job.`],
    history: stringList(input.history).length ? stringList(input.history) : [`Imported from ${source} on ${today()}.`],
  };
}

export function upsertLocalCandidates(inputs: CandidateImportInput[]) {
  const current: CandidateImportRecord[] = readArray<ImportRecord>(LOCAL_CANDIDATES_KEY).map(normalizeCandidateRecord);
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
  const current: JobImportRecord[] = readArray<ImportRecord>(LOCAL_JOBS_KEY).map(normalizeJobRecord);
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
