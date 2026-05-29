import type { Candidate, CandidateDocument, Client, EmailRecord, Interview, ResumeVersion, Submission, Task, Vendor } from './types';
import type { ComplianceCase, OnboardingCase } from './onboardingStore';
import { getSession } from './auth';

export const LOCAL_CANDIDATES_KEY = 'eventus:test:candidates';
export const LOCAL_JOBS_KEY = 'eventus:test:jobs';
export const LOCAL_CLIENTS_KEY = 'eventus:test:clients';
export const LOCAL_SUBMISSIONS_KEY = 'eventus:test:submissions';
export const LOCAL_DOCUMENTS_KEY = 'eventus:test:candidate-documents';
export const LOCAL_RESUME_VERSIONS_KEY = 'eventus:test:resume-versions';
export const LOCAL_EMAILS_KEY = 'eventus:test:email-history';
export const LOCAL_EMAIL_INTEGRATIONS_KEY = 'eventus:test:email-integrations';
export const LOCAL_INTERVIEWS_KEY = 'eventus:test:interviews';
export const LOCAL_TASKS_KEY = 'eventus:test:tasks';
export const LOCAL_VENDORS_KEY = 'eventus:test:vendors';
export const LOCAL_CALL_LOGS_KEY = 'eventus:test:candidate-call-logs';
export const LOCAL_AUTOMATIONS_KEY = 'eventus:test:automations';
export const LOCAL_INTEGRATIONS_KEY = 'eventus:test:integrations';
export const LOCAL_SYNC_LOGS_KEY = 'eventus:test:integration-sync-logs';

export const ATS_DATA_UPDATED_EVENT = 'eventus:ats-data-updated';
const LEGACY_ATS_RECORDS_UPDATED_EVENT = 'eventus:ats-records-updated';

type AtsCollection =
  | 'candidates'
  | 'jobs'
  | 'clients'
  | 'vendors'
  | 'submissions'
  | 'interviews'
  | 'tasks'
  | 'candidateDocuments'
  | 'resumeVersions'
  | 'emailRecords'
  | 'emailIntegrations'
  | 'onboardingCases'
  | 'complianceCases'
  | 'callLogs'
  | 'automations'
  | 'integrations'
  | 'integrationSyncLogs'
  | 'fileUploads';

type RequestJsonResult<T> = {
  ok: boolean;
  status: number;
  data: T | null;
};

type AtsLooseRow = Record<string, unknown> & { id?: unknown };

type CollectionRows = {
  candidates: Candidate;
  jobs: AtsLooseRow;
  clients: Client;
  vendors: Vendor;
  submissions: Submission;
  interviews: Interview;
  tasks: Task;
  candidateDocuments: CandidateDocument;
  resumeVersions: ResumeVersion;
  emailRecords: EmailRecord;
  emailIntegrations: EmailIntegration;
  onboardingCases: OnboardingCase;
  complianceCases: ComplianceCase;
  callLogs: AtsLooseRow;
  automations: AtsLooseRow;
  integrations: AtsLooseRow;
  integrationSyncLogs: AtsLooseRow;
  fileUploads: AtsStoredFile;
};

export type AtsStoredFile = {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  candidateId?: string;
  candidateName?: string;
  documentType?: string;
  entityType?: string;
  storageProvider: string;
  storagePath?: string;
  relativePath?: string;
  downloadUrl: string;
  uploadedAt: string;
  uploadedBy?: string;
  uploadedByUserId?: string;
  uploadedByEmail?: string;
};

export type EmailIntegration = {
  id: string;
  userId: string;
  userName: string;
  provider: 'Outlook' | 'IMAP/SMTP' | 'Gmail' | 'Outlook / IMAP' | 'IMAP / SMTP';
  emailAddress: string;
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
  status: 'connected' | 'needs-settings' | 'disconnected';
  connectedAt: string;
  lastSyncedAt: string;
  notes?: string;
};

export type OutlookOAuthStatus = {
  configured: boolean;
  connected: boolean;
  userId: string;
  emailAddress: string;
  connectedAt: string;
  lastRefreshedAt: string;
  redirectUri: string;
  missing: string[];
};

const collectionKeys: Partial<Record<AtsCollection, string>> = {
  candidates: LOCAL_CANDIDATES_KEY,
  jobs: LOCAL_JOBS_KEY,
  clients: LOCAL_CLIENTS_KEY,
  vendors: LOCAL_VENDORS_KEY,
  submissions: LOCAL_SUBMISSIONS_KEY,
  interviews: LOCAL_INTERVIEWS_KEY,
  tasks: LOCAL_TASKS_KEY,
  candidateDocuments: LOCAL_DOCUMENTS_KEY,
  resumeVersions: LOCAL_RESUME_VERSIONS_KEY,
  emailRecords: LOCAL_EMAILS_KEY,
  emailIntegrations: LOCAL_EMAIL_INTEGRATIONS_KEY,
  onboardingCases: 'eventus:test:onboarding-cases',
  complianceCases: 'eventus:test:compliance-cases',
  callLogs: LOCAL_CALL_LOGS_KEY,
  automations: LOCAL_AUTOMATIONS_KEY,
  integrations: LOCAL_INTEGRATIONS_KEY,
  integrationSyncLogs: LOCAL_SYNC_LOGS_KEY,
};

function apiRoot() {
  return (import.meta.env.VITE_ATS_API_URL || '/api/ats').replace(/\/$/, '');
}

function sessionHeaders() {
  const session = getSession();
  if (!session) return {};
  try {
    const headers: Record<string, string> = {
      'X-Eventus-Session': window.btoa(unescape(encodeURIComponent(JSON.stringify(session)))),
    };
    if (session.sessionToken) {
      headers['X-Eventus-Auth'] = session.sessionToken;
      headers.Authorization = `Bearer ${session.sessionToken}`;
    }
    return headers;
  } catch {
    return {};
  }
}

function requestHeaders(init?: RequestInit) {
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');
  Object.entries(sessionHeaders()).forEach(([key, value]) => headers.set(key, value));
  return headers;
}

export function shouldUseDemoData() {
  if (import.meta.env.VITE_ENABLE_DEMO_DATA === 'true') return true;
  if (import.meta.env.VITE_ENABLE_DEMO_DATA === 'false') return false;
  return !import.meta.env.PROD;
}

function dispatchUpdate(collection: AtsCollection) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ATS_DATA_UPDATED_EVENT, { detail: { collection } }));
  const key = collectionKeys[collection];
  if (key) {
    window.dispatchEvent(new CustomEvent(LEGACY_ATS_RECORDS_UPDATED_EVENT, { detail: { key } }));
  }
}

export function readLocalRows<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeLocalRows<T>(key: string, rows: T[], collection?: AtsCollection) {
  window.localStorage.setItem(key, JSON.stringify(rows));
  if (collection) dispatchUpdate(collection);
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T | null> {
  const result = await requestJsonResult<T>(path, init);
  return result.data;
}

async function requestJsonResult<T>(path: string, init?: RequestInit): Promise<RequestJsonResult<T>> {
  try {
    const response = await fetch(`${apiRoot()}${path}`, {
      ...init,
      headers: requestHeaders(init),
    });
    const body = await response.json().catch(() => null) as T | null;
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        data: body,
      };
    }
    return {
      ok: true,
      status: response.status,
      data: body,
    };
  } catch {
    return {
      ok: false,
      status: 0,
      data: null,
    };
  }
}

export async function loadBackendRows<C extends AtsCollection>(collection: C) {
  const result = await loadBackendRowsResult(collection);
  return result.rows;
}

export async function loadBackendRowsResult<C extends AtsCollection>(collection: C) {
  const result = await requestJsonResult<{ rows: Array<CollectionRows[C]> }>(`/${collection}`);
  return {
    ok: result.ok,
    status: result.status,
    rows: result.data?.rows ?? [],
  };
}

export async function replaceBackendRows<C extends AtsCollection>(collection: C, rows: Array<CollectionRows[C]>) {
  await requestJson(`/${collection}`, {
    method: 'PUT',
    body: JSON.stringify({ rows }),
  });
}

export function saveRows<C extends AtsCollection>(collection: C, rows: Array<CollectionRows[C]>) {
  const key = collectionKeys[collection];
  if (key) writeLocalRows(key, rows, collection);
  void replaceBackendRows(collection, rows).catch(error => {
    console.error(`Failed to persist ${collection} rows to the ATS backend.`, error);
  });
}

export function upsertRow<C extends AtsCollection>(collection: C, row: CollectionRows[C]) {
  const key = collectionKeys[collection];
  const current = key ? readLocalRows<CollectionRows[C]>(key) : [];
  const next = [row, ...current.filter(item => item.id !== row.id)];
  if (key) writeLocalRows(key, next, collection);
  void requestJson<{ rows: Array<CollectionRows[C]> }>(`/${collection}`, {
    method: 'POST',
    body: JSON.stringify(row),
  }).then(body => {
    if (body?.rows && key) {
      writeLocalRows(key, body.rows as Array<CollectionRows[C]>, collection);
    }
  }).catch(error => {
    console.error(`Failed to upsert ${collection} row in the ATS backend.`, error);
  });
  return next;
}

export async function submitSubmissionRow(row: Submission) {
  try {
    const response = await fetch(`${apiRoot()}/submissions/submit`, {
      method: 'POST',
      headers: requestHeaders(),
      body: JSON.stringify(row),
    });
    const body = await response.json().catch(() => null) as {
      row?: Submission;
      rows?: Submission[];
      duplicate?: Submission;
      error?: string;
      message?: string;
    } | null;

    if (body?.rows) writeLocalRows(LOCAL_SUBMISSIONS_KEY, body.rows, 'submissions');

    return {
      ok: response.ok,
      status: response.status,
      row: body?.row,
      rows: body?.rows,
      duplicate: body?.duplicate,
      error: body?.error,
      message: body?.message,
    };
  } catch {
    return {
      ok: false,
      status: 0,
      error: 'network-error',
      message: 'Submission API is unavailable. Start the ATS backend and try again.',
    };
  }
}

export async function hydrateAtsCollections() {
  if (typeof window === 'undefined') return;

  await Promise.allSettled(
    (Object.entries(collectionKeys) as Array<[AtsCollection, string]>).map(async ([collection, key]) => {
      const result = await loadBackendRowsResult(collection);
      if (!result.ok) return;

      const localRows = readLocalRows<CollectionRows[typeof collection]>(key);
      if (JSON.stringify(localRows) !== JSON.stringify(result.rows)) {
        writeLocalRows(key, result.rows, collection);
      }
    }),
  );
}

export async function connectEmailIntegration(input: Omit<EmailIntegration, 'id' | 'status' | 'connectedAt' | 'lastSyncedAt'>) {
  const body = await requestJson<{ row: EmailIntegration; rows: EmailIntegration[] }>('/email/connect', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!body?.row) {
    const now = new Date().toISOString();
    const fallback: EmailIntegration = {
      ...input,
      id: `email-integration-${input.userId}-${Date.now()}`,
      status: input.emailAddress ? 'connected' : 'needs-settings',
      connectedAt: now,
      lastSyncedAt: now,
    };
    const rows = [fallback, ...readLocalRows<EmailIntegration>(LOCAL_EMAIL_INTEGRATIONS_KEY).filter(item => item.userId !== fallback.userId)];
    writeLocalRows(LOCAL_EMAIL_INTEGRATIONS_KEY, rows, 'emailIntegrations');
    return fallback;
  }
  writeLocalRows(LOCAL_EMAIL_INTEGRATIONS_KEY, body.rows, 'emailIntegrations');
  return body.row;
}

export async function outlookOAuthStatus(userId: string) {
  return requestJsonResult<OutlookOAuthStatus>(`/email/outlook/status?userId=${encodeURIComponent(userId)}`);
}

export async function startOutlookOAuth(input: { userId: string; loginHint?: string; returnTo?: string }) {
  return requestJsonResult<{ ok: boolean; authorizationUrl?: string; redirectUri?: string; message?: string }>('/email/outlook/start', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function runGithubBackup() {
  return requestJsonResult<{
    ok: boolean;
    localOnly?: boolean;
    localPath?: string;
    githubPath?: string;
    githubUrl?: string;
    totalRecords?: number;
    atsCounts?: Record<string, number>;
    authCounts?: Record<string, number>;
    message: string;
  }>('/github/backup', {
    method: 'POST',
    body: JSON.stringify({ requestedAt: new Date().toISOString() }),
  });
}

export async function sendEmailRecord(record: EmailRecord) {
  const body = await requestJson<{ row: EmailRecord; rows: EmailRecord[] }>('/email/send', {
    method: 'POST',
    body: JSON.stringify(record),
  });
  const next = body?.rows ?? [record, ...readLocalRows<EmailRecord>(LOCAL_EMAILS_KEY).filter(item => item.id !== record.id)];
  writeLocalRows(LOCAL_EMAILS_KEY, next, 'emailRecords');
  return body?.row ?? record;
}

export async function syncEmailInbox(context: Partial<EmailRecord> & { userId?: string; candidateEmail?: string }) {
  const body = await requestJson<{ row: EmailRecord; rows: EmailRecord[] }>('/email/sync', {
    method: 'POST',
    body: JSON.stringify(context),
  });
  if (body?.rows) {
    writeLocalRows(LOCAL_EMAILS_KEY, body.rows, 'emailRecords');
  }
  return body?.row;
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Could not read file.'));
    reader.readAsDataURL(file);
  });
}

export async function uploadBackendFile(file: File, context: { candidateId?: string; candidateName?: string; documentType?: string; entityType?: string } = {}) {
  const dataUrl = await fileToDataUrl(file);
  const result = await requestJsonResult<{ ok: boolean; file?: AtsStoredFile; message?: string }>('/files', {
    method: 'POST',
    body: JSON.stringify({
      ...context,
      fileName: file.name,
      fileType: file.type || 'application/octet-stream',
      fileSize: file.size,
      dataUrl,
    }),
  });
  if (!result.ok || !result.data?.file) {
    throw new Error(result.data?.message || 'File upload failed.');
  }
  return result.data.file;
}
