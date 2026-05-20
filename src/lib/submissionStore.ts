import { resolveSession } from './auth';
import { LOCAL_SUBMISSIONS_KEY, loadBackendRows, readLocalRows, submitSubmissionRow } from './atsApi';
import { getAllSubmissions } from './localRecords';
import type { Candidate, Job, Submission } from './types';

type CreateSubmissionResult =
  | { ok: true; submission: Submission; rows: Submission[]; message: string }
  | { ok: false; duplicate?: Submission; message: string };

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

export function findCandidateJobSubmission(rows: Submission[], candidateId: string, jobId: string, excludeId?: string) {
  return rows.find(submission =>
    submission.candidateId === candidateId &&
    submission.jobId === jobId &&
    submission.id !== excludeId
  );
}

export function duplicateSubmissionMessage(duplicate: Submission) {
  const submittedAt = duplicate.submittedAt
    ? new Date(duplicate.submittedAt).toLocaleString()
    : duplicate.submittedDate;
  return `${duplicate.candidateName} was already submitted to ${duplicate.jobTitle} on ${submittedAt} by ${duplicate.recruiter}.`;
}

async function allKnownSubmissions() {
  const backendRows = await loadBackendRows('submissions');
  const localRows = readLocalRows<Submission>(LOCAL_SUBMISSIONS_KEY);
  const seedAndLocalRows = getAllSubmissions();
  const byId = new Map<string, Submission>();

  [...seedAndLocalRows, ...backendRows, ...localRows].forEach((row, index) => {
    byId.set(row.id || `submission-${index}`, row);
  });

  return Array.from(byId.values());
}

export async function createSubmissionRecord(draft: Submission): Promise<CreateSubmissionResult> {
  const knownRows = await allKnownSubmissions();
  const duplicate = findCandidateJobSubmission(knownRows, draft.candidateId, draft.jobId, draft.id);

  if (duplicate) {
    return {
      ok: false,
      duplicate,
      message: `Duplicate blocked: ${duplicateSubmissionMessage(duplicate)}`,
    };
  }

  const session = resolveSession();
  const now = new Date().toISOString();
  const submission: Submission = {
    ...draft,
    id: draft.id || `submission-${Date.now()}`,
    submittedDate: draft.submittedDate || todayDate(),
    submittedAt: draft.submittedAt || now,
    submittedByUserId: draft.submittedByUserId || session?.id,
    submittedByEmail: draft.submittedByEmail || session?.email,
    recruiter: draft.recruiter || session?.name || 'Recruiter',
    createdAt: draft.createdAt || now,
    updatedAt: now,
  };

  const response = await submitSubmissionRow(submission);
  if (!response.ok) {
    if (response.duplicate) {
      return {
        ok: false,
        duplicate: response.duplicate,
        message: `Duplicate blocked: ${duplicateSubmissionMessage(response.duplicate)}`,
      };
    }

    return {
      ok: false,
      message: response.message || 'Submission could not be saved to the ATS backend.',
    };
  }

  return {
    ok: true,
    submission: response.row ?? submission,
    rows: response.rows ?? [submission, ...readLocalRows<Submission>(LOCAL_SUBMISSIONS_KEY).filter(item => item.id !== submission.id)],
    message: `${submission.candidateName} submitted to ${submission.jobTitle}.`,
  };
}

export function buildCandidateJobSubmission(candidate: Candidate, job: Job, note = 'Submitted from candidate quick action.'): Submission {
  return {
    id: `submission-${Date.now()}-${candidate.id}-${job.id}`,
    candidateId: candidate.id,
    candidateName: candidate.name,
    jobId: job.id,
    jobTitle: job.title,
    clientId: job.clientId,
    clientName: job.client,
    status: 'Submitted',
    submittedDate: todayDate(),
    recruiter: candidate.recruiter,
    rate: candidate.salary,
    payRate: candidate.salary,
    billRate: job.salary,
    rtrStatus: 'Requested',
    resumeVersion: candidate.resume ?? `${candidate.name.replace(/\s+/g, '_')}_Resume.pdf`,
    clientFeedback: 'Awaiting client feedback.',
    interviewRounds: 'Not started',
    offerStatus: 'Not Started',
    joiningStatus: 'Not Started',
    notes: note,
  };
}

export async function createCandidateJobSubmission(candidate: Candidate, job: Job, note?: string) {
  return createSubmissionRecord(buildCandidateJobSubmission(candidate, job, note));
}
