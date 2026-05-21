import http from 'node:http';
import { mkdir, appendFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAtsStore } from './ats-store.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || process.env.AI_API_PORT || 8787);
const AUDIT_DIR = join(__dirname, 'audit');
const AUDIT_LOG = join(AUDIT_DIR, 'ai-audit.jsonl');
const DATA_DIR = join(__dirname, 'data');
const ATS_DB = join(DATA_DIR, 'ats-db.json');
const DIST_DIR = join(__dirname, '..', 'dist');
const ATS_COLLECTIONS = new Set([
  'candidates',
  'jobs',
  'clients',
  'vendors',
  'submissions',
  'interviews',
  'tasks',
  'candidateDocuments',
  'resumeVersions',
  'emailRecords',
  'emailIntegrations',
  'onboardingCases',
  'complianceCases',
  'callLogs',
  'automations',
  'integrations',
  'integrationSyncLogs',
]);
const AUTH_COLLECTIONS = new Set([
  'authUsers',
  'authMetadata',
  'passwordResetRequests',
  'passwordEmailOutbox',
]);
const atsStore = createAtsStore({
  collections: ATS_COLLECTIONS,
  dataDir: DATA_DIR,
  jsonFile: ATS_DB,
});
const authStore = createAtsStore({
  collections: AUTH_COLLECTIONS,
  dataDir: DATA_DIR,
  jsonFile: ATS_DB,
});
const ALLOWED_MODULES = new Set([
  'resume-parser',
  'jd-parser',
  'match-engine',
  'boolean-generator',
  'screening-questions',
  'resume-improvement',
  'client-submission',
  'recruiter-assistant',
]);
const rateLimit = new Map();
const DEFAULT_SUPERUSER = {
  id: 'superuser-profile',
  name: 'SuperUser',
  email: 'vivekk@theeventusconsultinggroup.com',
  passwordHash: Buffer.from('eventus:Manvikk1981@', 'utf8').toString('base64'),
  avatarUrl: '',
  phone: '',
  title: 'System Owner',
  updatedAt: '2026-05-21T00:00:00.000Z',
};

function json(response, status, body) {
  response.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': process.env.AI_CORS_ORIGIN || '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-RecruitIQ-Session, X-RecruitIQ-Request-Id, X-VRecruit-Session, X-VRecruit-Request-Id, X-Eventus-Session, X-Eventus-Request-Id',
    'Access-Control-Allow-Methods': 'POST, GET, PUT, PATCH, OPTIONS, DELETE',
  });
  response.end(JSON.stringify(body));
}

function pathnameFromUrl(url = '/') {
  return new URL(url, 'http://localhost').pathname;
}

function contentType(pathname) {
  switch (extname(pathname)) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.js':
      return 'application/javascript; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.ico':
      return 'image/x-icon';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.map':
      return 'application/json; charset=utf-8';
    default:
      return 'application/octet-stream';
  }
}

async function serveFrontendAsset(request, response) {
  const pathname = pathnameFromUrl(request.url);
  const requestedFile = pathname === '/' ? '/index.html' : pathname;
  const filePath = join(DIST_DIR, requestedFile.replace(/^\/+/, ''));

  try {
    const payload = await readFile(filePath);
    response.writeHead(200, {
      'Content-Type': contentType(filePath),
      'Cache-Control': requestedFile === '/index.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
    });
    response.end(payload);
    return true;
  } catch {
    if (extname(requestedFile)) return false;
  }

  try {
    const indexHtml = await readFile(join(DIST_DIR, 'index.html'));
    response.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache',
    });
    response.end(indexHtml);
    return true;
  } catch {
    return false;
  }
}

async function readAtsDb() {
  return atsStore.readDb();
}

async function writeAtsDb(db) {
  await atsStore.writeDb(db);
}

function normalizeAuthRows(rows) {
  return Array.isArray(rows) ? rows.filter(Boolean) : [];
}

async function ensureAuthState() {
  const [users, metadataRows, passwordResetRequests, passwordEmailOutbox] = await Promise.all([
    authStore.readCollection('authUsers'),
    authStore.readCollection('authMetadata'),
    authStore.readCollection('passwordResetRequests'),
    authStore.readCollection('passwordEmailOutbox'),
  ]);

  const currentMetadata = normalizeAuthRows(metadataRows)[0] ?? {};
  const mergedMetadata = {
    ...DEFAULT_SUPERUSER,
    ...currentMetadata,
    id: 'superuser-profile',
    email: String(currentMetadata.email || DEFAULT_SUPERUSER.email).toLowerCase(),
    passwordHash: String(currentMetadata.passwordHash || DEFAULT_SUPERUSER.passwordHash),
    name: String(currentMetadata.name || DEFAULT_SUPERUSER.name),
    title: String(currentMetadata.title || DEFAULT_SUPERUSER.title),
    phone: String(currentMetadata.phone || ''),
    avatarUrl: String(currentMetadata.avatarUrl || ''),
    updatedAt: String(currentMetadata.updatedAt || new Date().toISOString()),
  };

  const metadataChanged = JSON.stringify(currentMetadata) !== JSON.stringify(mergedMetadata);
  if (metadataChanged) {
    await authStore.replaceCollection('authMetadata', [mergedMetadata]);
  }

  return {
    users: normalizeAuthRows(users),
    superUser: mergedMetadata,
    passwordResetRequests: normalizeAuthRows(passwordResetRequests),
    passwordEmailOutbox: normalizeAuthRows(passwordEmailOutbox),
  };
}

async function handleAuthState(request, response) {
  if (request.method === 'GET') {
    return json(response, 200, await ensureAuthState());
  }

  if (request.method === 'PUT') {
    const body = JSON.parse(await readBody(request) || '{}');
    const superUser = {
      ...DEFAULT_SUPERUSER,
      ...(body.superUser && typeof body.superUser === 'object' ? body.superUser : {}),
      id: 'superuser-profile',
      email: String(body?.superUser?.email || DEFAULT_SUPERUSER.email).toLowerCase(),
      passwordHash: String(body?.superUser?.passwordHash || DEFAULT_SUPERUSER.passwordHash),
      name: String(body?.superUser?.name || DEFAULT_SUPERUSER.name),
      title: String(body?.superUser?.title || DEFAULT_SUPERUSER.title),
      phone: String(body?.superUser?.phone || ''),
      avatarUrl: String(body?.superUser?.avatarUrl || ''),
      updatedAt: new Date().toISOString(),
    };

    await Promise.all([
      authStore.replaceCollection('authUsers', normalizeAuthRows(body.users)),
      authStore.replaceCollection('authMetadata', [superUser]),
      authStore.replaceCollection('passwordResetRequests', normalizeAuthRows(body.passwordResetRequests)),
      authStore.replaceCollection('passwordEmailOutbox', normalizeAuthRows(body.passwordEmailOutbox)),
    ]);

    return json(response, 200, await ensureAuthState());
  }

  return json(response, 405, { error: 'Method not allowed' });
}

function collectionFromUrl(url = '') {
  const pathname = new URL(url, 'http://localhost').pathname;
  const [, api, ats, collection, id] = pathname.split('/');
  if (api !== 'api' || ats !== 'ats' || !ATS_COLLECTIONS.has(collection)) return null;
  return { collection, id };
}

function withUpdatedTimestamp(record) {
  if (!record || typeof record !== 'object') return record;
  const now = new Date().toISOString();
  return {
    ...record,
    updatedAt: record.updatedAt || now,
    lastSyncedAt: now,
  };
}

function submissionIdentity(row) {
  return row?.candidateId && row?.jobId ? `${row.candidateId}::${row.jobId}` : '';
}

function findDuplicateSubmission(rows, row, excludeId) {
  const identity = submissionIdentity(row);
  if (!identity) return null;
  return rows.find(item => submissionIdentity(item) === identity && item.id !== excludeId) || null;
}

function dedupeSubmissionRows(rows) {
  const seen = new Set();
  return rows.filter(row => {
    const identity = submissionIdentity(row);
    if (!identity) return true;
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

function stampSubmission(row) {
  const now = new Date().toISOString();
  return withUpdatedTimestamp({
    ...row,
    id: row.id || `submission-api-${Date.now()}`,
    submittedDate: row.submittedDate || now.slice(0, 10),
    submittedAt: row.submittedAt || now,
    createdAt: row.createdAt || now,
    updatedAt: now,
  });
}

async function handleAtsCollection(request, response) {
  const route = collectionFromUrl(request.url);
  if (!route) return json(response, 404, { error: 'ATS collection not found' });

  const db = await readAtsDb();
  const current = Array.isArray(db[route.collection]) ? db[route.collection] : [];

  if (request.method === 'GET') {
    return json(response, 200, { rows: current });
  }

  const body = JSON.parse(await readBody(request) || '{}');

  if (request.method === 'PUT') {
    const rows = Array.isArray(body.rows) ? body.rows.map(withUpdatedTimestamp) : [];
    db[route.collection] = route.collection === 'submissions' ? dedupeSubmissionRows(rows) : rows;
    await writeAtsDb(db);
    return json(response, 200, { rows: db[route.collection] });
  }

  if (request.method === 'POST') {
    const incoming = Array.isArray(body.rows)
      ? body.rows
      : Array.isArray(body)
        ? body
        : [body];
    const next = [...current];
    const stampedRows = incoming.map(row => route.collection === 'submissions' ? stampSubmission(row) : withUpdatedTimestamp(row));
    const seenSubmissions = new Set();
    const duplicate = route.collection === 'submissions'
      ? stampedRows.find(row => {
          const identity = submissionIdentity(row);
          const alreadyInBatch = identity && seenSubmissions.has(identity);
          if (identity) seenSubmissions.add(identity);
          return alreadyInBatch || findDuplicateSubmission(next, row, row.id);
        })
      : null;

    if (duplicate) {
      const existing = findDuplicateSubmission(next, duplicate, duplicate.id);
      return json(response, 409, {
        error: 'duplicate-submission',
        message: 'Candidate is already submitted to this job.',
        duplicate: existing,
        rows: current,
      });
    }

    stampedRows.forEach(row => {
      const index = row?.id ? next.findIndex(item => item.id === row.id) : -1;
      if (index >= 0) {
        next[index] = { ...next[index], ...row };
      } else {
        next.unshift(row);
      }
    });
    db[route.collection] = next;
    await writeAtsDb(db);
    return json(response, 200, { rows: next });
  }

  if (request.method === 'PATCH' && route.id) {
    const proposed = route.collection === 'submissions'
      ? stampSubmission({ ...current.find(row => row.id === route.id), ...body, id: route.id })
      : withUpdatedTimestamp({ ...current.find(row => row.id === route.id), ...body });

    if (route.collection === 'submissions') {
      const duplicate = findDuplicateSubmission(current, proposed, route.id);
      if (duplicate) {
        return json(response, 409, {
          error: 'duplicate-submission',
          message: 'Candidate is already submitted to this job.',
          duplicate,
          rows: current,
        });
      }
    }

    const next = current.map(row => row.id === route.id ? proposed : row);
    db[route.collection] = next;
    await writeAtsDb(db);
    return json(response, 200, { rows: next, row: next.find(row => row.id === route.id) });
  }

  return json(response, 405, { error: 'Method not allowed' });
}

async function handleSubmissionSubmit(request, response) {
  const body = JSON.parse(await readBody(request) || '{}');
  const row = stampSubmission(body);
  const result = await atsStore.insertSubmission(row);

  if (result.duplicate) {
    return json(response, 409, {
      error: 'duplicate-submission',
      message: 'Candidate is already submitted to this job.',
      duplicate: result.duplicate,
      rows: result.rows,
    });
  }

  return json(response, 200, { row: result.row, rows: result.rows });
}

async function handleEmailConnect(request, response) {
  const body = JSON.parse(await readBody(request) || '{}');
  const db = await readAtsDb();
  const current = Array.isArray(db.emailIntegrations) ? db.emailIntegrations : [];
  const now = new Date().toISOString();
  const row = {
    id: body.id || `email-integration-${body.userId || 'user'}-${Date.now()}`,
    userId: body.userId || 'unknown-user',
    userName: body.userName || 'ATS User',
    provider: body.provider || 'Outlook / IMAP',
    emailAddress: body.emailAddress,
    imapHost: body.imapHost || 'outlook.office365.com',
    imapPort: Number(body.imapPort) || 993,
    smtpHost: body.smtpHost || 'smtp.office365.com',
    smtpPort: Number(body.smtpPort) || 587,
    status: body.emailAddress ? 'connected' : 'needs-settings',
    connectedAt: now,
    lastSyncedAt: now,
    notes: 'Credentials are represented as connection metadata in this local ATS backend. Use a secure vault in production.',
  };
  db.emailIntegrations = [row, ...current.filter(item => item.userId !== row.userId)];
  await writeAtsDb(db);
  return json(response, 200, { row, rows: db.emailIntegrations });
}

async function handleEmailSend(request, response) {
  const body = JSON.parse(await readBody(request) || '{}');
  const db = await readAtsDb();
  const current = Array.isArray(db.emailRecords) ? db.emailRecords : [];
  const now = new Date().toISOString();
  const row = withUpdatedTimestamp({
    ...body,
    id: body.id || `email-api-${Date.now()}`,
    status: 'Sent',
    sentAt: body.sentAt || new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date()),
    serverTimestamp: now,
  });
  db.emailRecords = [row, ...current.filter(item => item.id !== row.id)];
  await writeAtsDb(db);
  return json(response, 200, { row, rows: db.emailRecords });
}

async function handleEmailSync(request, response) {
  const body = request.method === 'POST' ? JSON.parse(await readBody(request) || '{}') : {};
  const db = await readAtsDb();
  const integrations = Array.isArray(db.emailIntegrations) ? db.emailIntegrations : [];
  const integration = integrations.find(item => item.userId === body.userId) || integrations[0];
  const now = new Date().toISOString();
  const candidateName = body.candidateName || 'Candidate';
  const candidateEmail = body.candidateEmail || integration?.emailAddress || 'candidate@example.com';
  const row = withUpdatedTimestamp({
    id: `email-sync-${Date.now()}`,
    candidateId: body.candidateId,
    candidateName,
    jobId: body.jobId,
    jobTitle: body.jobTitle,
    clientId: body.clientId,
    clientName: body.clientName,
    type: 'Follow-up email',
    to: integration?.emailAddress || 'recruiter@eventus.local',
    subject: `Inbound reply from ${candidateName}`,
    body: `Synced mailbox activity from ${candidateEmail}. Replace this local sync placeholder with live IMAP message body in production.`,
    status: 'Sent',
    sentAt: new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date()),
    sender: candidateEmail,
    direction: 'Inbound',
    serverTimestamp: now,
  });
  db.emailRecords = [row, ...(Array.isArray(db.emailRecords) ? db.emailRecords : [])];
  db.emailIntegrations = integrations.map(item => item.id === integration?.id ? { ...item, lastSyncedAt: now } : item);
  await writeAtsDb(db);
  return json(response, 200, { row, rows: db.emailRecords });
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', chunk => {
      body += chunk;
      if (body.length > 1_000_000) {
        request.destroy();
        reject(new Error('Request body too large'));
      }
    });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}

function decodeSession(headerValue) {
  if (!headerValue) return null;
  try {
    return JSON.parse(Buffer.from(headerValue, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

function hasAIAccess(session) {
  return Boolean(
    session &&
    (session.role === 'SuperUser' || Array.isArray(session.permissions) && session.permissions.includes('ai-assistant'))
  );
}

function checkRateLimit(sessionId) {
  const now = Date.now();
  const windowMs = 60_000;
  const maxRequests = Number(process.env.AI_RATE_LIMIT_PER_MINUTE || 30);
  const current = rateLimit.get(sessionId) || [];
  const recent = current.filter(timestamp => now - timestamp < windowMs);
  recent.push(now);
  rateLimit.set(sessionId, recent);
  return recent.length <= maxRequests;
}

function redact(value) {
  return JSON.stringify(value)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email-redacted]')
    .replace(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, '[phone-redacted]');
}

function promptHash(prompt) {
  return createHash('sha256').update(prompt || '').digest('hex').slice(0, 16);
}

async function audit(entry) {
  await mkdir(AUDIT_DIR, { recursive: true });
  await appendFile(AUDIT_LOG, `${JSON.stringify({ timestamp: new Date().toISOString(), ...entry })}\n`);
}

function buildSystemPrompt(moduleName) {
  return [
    'You are RecruitIQ ATS AI. Return concise, recruiter-ready output only.',
    'Never make final hiring decisions. Keep humans in control.',
    'Do not automatically reject candidates, advance candidates, or change candidate status. AI can recommend, score, summarize, and flag gaps, but final decision must always be made by a human recruiter.',
    'Explain score factors and missing data. Do not infer protected-class attributes.',
    `Current module: ${moduleName}.`,
  ].join('\n');
}

function asksForAutomatedCandidateDecision(value) {
  const text = JSON.stringify(value || {}).toLowerCase();
  return [
    /auto(?:matically)?\s+reject/,
    /reject\s+candidate\s+automatically/,
    /change\s+(?:the\s+)?candidate\s+status/,
    /set\s+(?:the\s+)?candidate\s+status/,
    /auto(?:matically)?\s+advance/,
    /make\s+(?:the\s+)?final\s+(?:hiring\s+)?decision/,
  ].some(pattern => pattern.test(text));
}

function deterministicOutput(request) {
  return [
    `Secure AI gateway accepted module: ${request.module}.`,
    'Provider is not configured, so this is a safe deterministic response.',
    'Production mode should set LLM_API_URL, LLM_API_KEY, and LLM_MODEL on the server only.',
    'Audit log, permission check, rate limit, and prompt redaction pipeline completed.',
  ].join('\n');
}

async function callLLM(request) {
  const apiUrl = process.env.LLM_API_URL;
  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL;

  if (!apiUrl || !apiKey || !model) {
    return { provider: 'mock', output: deterministicOutput(request) };
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: buildSystemPrompt(request.module) },
        {
          role: 'user',
          content: [
            `Prompt: ${request.prompt}`,
            `Candidate ID: ${request.candidateId || 'none'}`,
            `Job ID: ${request.jobId || 'none'}`,
            `Context: ${redact(request.context)}`,
          ].join('\n\n'),
        },
      ],
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    throw new Error(`Provider failed with ${response.status}`);
  }

  const body = await response.json();
  const output = body?.choices?.[0]?.message?.content || body?.output_text || JSON.stringify(body);
  return { provider: 'server', output };
}

async function handleAI(request, response) {
  const requestId = request.headers['x-recruitiq-request-id'] || request.headers['x-vrecruit-request-id'] || request.headers['x-eventus-request-id'] || `ai-${Date.now()}`;
  const session = decodeSession(request.headers['x-recruitiq-session'] || request.headers['x-vrecruit-session'] || request.headers['x-eventus-session']);
  const actor = session?.email || 'anonymous';

  if (!hasAIAccess(session)) {
    await audit({ requestId, actor, status: 'blocked', reason: 'Missing ai-assistant permission' });
    return json(response, 403, {
      requestId,
      provider: 'server',
      output: '',
      audit: { status: 'blocked', explanation: 'User does not have AI Assistant permission.' },
    });
  }

  if (!checkRateLimit(session.id || actor)) {
    await audit({ requestId, actor, status: 'blocked', reason: 'Rate limit exceeded' });
    return json(response, 429, {
      requestId,
      provider: 'server',
      output: '',
      audit: { status: 'blocked', explanation: 'AI rate limit exceeded. Try again later.' },
    });
  }

  const body = JSON.parse(await readBody(request) || '{}');
  if (!ALLOWED_MODULES.has(body.module)) {
    await audit({ requestId, actor, status: 'blocked', reason: 'Invalid AI module', module: body.module });
    return json(response, 400, {
      requestId,
      provider: 'server',
      output: '',
      audit: { status: 'blocked', explanation: 'Invalid AI module requested.' },
    });
  }

  if (asksForAutomatedCandidateDecision(body.prompt)) {
    await audit({ requestId, actor, status: 'blocked', reason: 'Automated candidate decision request', module: body.module });
    return json(response, 422, {
      requestId,
      provider: 'server',
      output: '',
      audit: {
        status: 'blocked',
        explanation: 'AI may recommend, score, summarize, and flag gaps, but final candidate decisions and status changes require a human recruiter.',
      },
    });
  }

  await audit({
    requestId,
    actor,
    role: session.role,
    module: body.module,
    candidateId: body.candidateId,
    jobId: body.jobId,
    status: 'requested',
    promptHash: promptHash(body.prompt),
  });

  try {
    const result = await callLLM(body);
    await audit({
      requestId,
      actor,
      module: body.module,
      candidateId: body.candidateId,
      jobId: body.jobId,
      status: 'approved',
      provider: result.provider,
    });
    return json(response, 200, {
      requestId,
      provider: result.provider,
      output: result.output,
      audit: { status: 'approved', explanation: 'AI request completed through protected gateway.' },
    });
  } catch (error) {
    await audit({
      requestId,
      actor,
      module: body.module,
      status: 'failed',
      reason: error instanceof Error ? error.message : 'Unknown provider failure',
    });
    return json(response, 502, {
      requestId,
      provider: 'server',
      output: '',
      audit: { status: 'failed', explanation: 'LLM provider failed. Check server logs.' },
    });
  }
}

async function handleAudit(_request, response) {
  try {
    const raw = await readFile(AUDIT_LOG, 'utf8');
    const rows = raw.trim().split('\n').filter(Boolean).slice(-100).map(line => JSON.parse(line));
    return json(response, 200, { rows });
  } catch {
    return json(response, 200, { rows: [] });
  }
}

const server = http.createServer(async (request, response) => {
  if (request.method === 'OPTIONS') return json(response, 204, {});
  const pathname = pathnameFromUrl(request.url);
  if (request.method === 'GET' && pathname === '/healthz') return json(response, 200, { ok: true, storage: atsStore.mode });
  if (pathname === '/api/auth/state' && (request.method === 'GET' || request.method === 'PUT')) return handleAuthState(request, response);
  if (request.method === 'POST' && pathname === '/api/ai/run') return handleAI(request, response);
  if (request.method === 'GET' && pathname === '/api/ai/audit') return handleAudit(request, response);
  if (pathname === '/api/ats/submissions/submit' && request.method === 'POST') return handleSubmissionSubmit(request, response);
  if (pathname === '/api/ats/email/connect' && request.method === 'POST') return handleEmailConnect(request, response);
  if (pathname === '/api/ats/email/send' && request.method === 'POST') return handleEmailSend(request, response);
  if (pathname === '/api/ats/email/sync' && (request.method === 'POST' || request.method === 'GET')) return handleEmailSync(request, response);
  if (collectionFromUrl(request.url)) return handleAtsCollection(request, response);
  if (await serveFrontendAsset(request, response)) return;
  return json(response, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`RecruitIQ AI API listening on http://localhost:${PORT} using ${atsStore.mode} storage`);
});
