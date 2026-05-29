import http from 'node:http';
import { mkdir, appendFile, readFile, writeFile } from 'node:fs/promises';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAtsStore } from './ats-store.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = join(__dirname, '..');

async function loadDotEnvFile(filePath) {
  try {
    const raw = await readFile(filePath, 'utf8');
    raw.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) return;
      const [key, ...valueParts] = trimmed.split('=');
      const name = key.trim();
      if (!name || process.env[name] !== undefined) return;
      let value = valueParts.join('=').trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[name] = value;
    });
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      console.warn(`Could not load ${filePath}:`, error instanceof Error ? error.message : error);
    }
  }
}

await loadDotEnvFile(join(PROJECT_DIR, '.env'));
await loadDotEnvFile(join(__dirname, '.env'));

const PORT = Number(process.env.PORT || process.env.AI_API_PORT || 8787);
const AUDIT_DIR = join(__dirname, 'audit');
const AUDIT_LOG = join(AUDIT_DIR, 'ai-audit.jsonl');
const DATA_DIR = join(__dirname, 'data');
const ATS_DB = join(DATA_DIR, 'ats-db.json');
const GITHUB_BACKUP_FILE = join(DATA_DIR, 'github-backup.json');
const OUTLOOK_OAUTH_STATES_FILE = join(DATA_DIR, 'outlook-oauth-states.json');
const OUTLOOK_OAUTH_TOKENS_FILE = join(DATA_DIR, 'outlook-oauth-tokens.json');
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
let githubBackupTimer = null;
let githubBackupQueue = Promise.resolve();
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
  outlookEmail: '',
  outlookConnected: false,
  emailProvider: 'Outlook',
  imapHost: 'outlook.office365.com',
  imapPort: '993',
  smtpHost: 'smtp.office365.com',
  smtpPort: '587',
  signatureText: '',
  signatureImageUrl: '',
  signatureTitle: '',
  signaturePhone: '',
  callingProvider: 'Manual Dialer',
  callingNumber: '',
  callingExtension: '',
  callingConnected: false,
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

function apiBaseUrl(request) {
  const forwardedProto = request.headers['x-forwarded-proto'];
  const forwardedHost = request.headers['x-forwarded-host'];
  const proto = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;
  const host = Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost;
  if (proto && host) return `${proto}://${host}`;
  return process.env.PUBLIC_API_ORIGIN || `http://localhost:${PORT}`;
}

function appOrigin(request) {
  const origin = request.headers.origin;
  if (typeof origin === 'string' && origin) return origin;
  return process.env.FRONTEND_ORIGIN || process.env.AI_CORS_ORIGIN || 'http://127.0.0.1:5173';
}

function html(response, status, body) {
  response.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(body);
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
  scheduleGithubBackup('ats-data-change');
}

async function readJsonFile(filePath, fallback) {
  try {
    const raw = await readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error?.code !== 'ENOENT') console.warn(`Could not read ${filePath}:`, error instanceof Error ? error.message : error);
    return fallback;
  }
}

async function writeJsonFile(filePath, payload) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function outlookConfig(request) {
  return {
    clientId: process.env.OUTLOOK_CLIENT_ID || process.env.MICROSOFT_CLIENT_ID || '',
    clientSecret: process.env.OUTLOOK_CLIENT_SECRET || process.env.MICROSOFT_CLIENT_SECRET || '',
    tenantId: process.env.OUTLOOK_TENANT_ID || process.env.MICROSOFT_TENANT_ID || 'common',
    redirectUri: process.env.OUTLOOK_REDIRECT_URI || `${apiBaseUrl(request)}/api/ats/email/outlook/callback`,
    scopes: (process.env.OUTLOOK_SCOPES || 'offline_access User.Read Mail.Send').trim(),
  };
}

function outlookConfigReady(config) {
  return Boolean(config.clientId && config.clientSecret && config.redirectUri);
}

function tokenSecret() {
  const configured = process.env.OUTLOOK_TOKEN_ENCRYPTION_KEY || process.env.ATS_TOKEN_ENCRYPTION_KEY || process.env.ATS_SECRET_KEY;
  if (configured) return configured;
  if (process.env.NODE_ENV === 'production') return '';
  return `eventus-local-dev-token-key:${PROJECT_DIR}`;
}

function encryptSecret(value) {
  const secret = tokenSecret();
  if (!secret) throw new Error('OUTLOOK_TOKEN_ENCRYPTION_KEY is required before saving Outlook OAuth tokens.');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', createHash('sha256').update(secret).digest(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return {
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    value: encrypted.toString('base64'),
  };
}

function decryptSecret(payload) {
  const secret = tokenSecret();
  if (!secret) throw new Error('OUTLOOK_TOKEN_ENCRYPTION_KEY is required before reading Outlook OAuth tokens.');
  const decipher = createDecipheriv(
    'aes-256-gcm',
    createHash('sha256').update(secret).digest(),
    Buffer.from(payload.iv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.value, 'base64')),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString('utf8'));
}

async function readOutlookStates() {
  const state = await readJsonFile(OUTLOOK_OAUTH_STATES_FILE, { rows: [] });
  return Array.isArray(state.rows) ? state.rows : [];
}

async function writeOutlookStates(rows) {
  await writeJsonFile(OUTLOOK_OAUTH_STATES_FILE, { rows });
}

async function readOutlookTokens() {
  const state = await readJsonFile(OUTLOOK_OAUTH_TOKENS_FILE, { rows: [] });
  return Array.isArray(state.rows) ? state.rows : [];
}

async function writeOutlookTokens(rows) {
  await writeJsonFile(OUTLOOK_OAUTH_TOKENS_FILE, { rows });
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
    outlookEmail: String(currentMetadata.outlookEmail || ''),
    outlookConnected: Boolean(currentMetadata.outlookConnected),
    emailProvider: ['Gmail', 'IMAP/SMTP'].includes(currentMetadata.emailProvider) ? currentMetadata.emailProvider : 'Outlook',
    imapHost: String(currentMetadata.imapHost || 'outlook.office365.com'),
    imapPort: String(currentMetadata.imapPort || '993'),
    smtpHost: String(currentMetadata.smtpHost || 'smtp.office365.com'),
    smtpPort: String(currentMetadata.smtpPort || '587'),
    signatureText: String(currentMetadata.signatureText || ''),
    signatureImageUrl: String(currentMetadata.signatureImageUrl || ''),
    signatureTitle: String(currentMetadata.signatureTitle || ''),
    signaturePhone: String(currentMetadata.signaturePhone || ''),
    callingProvider: ['Alliance SIP', 'Twilio', 'RingCentral', 'Vonage'].includes(currentMetadata.callingProvider) ? currentMetadata.callingProvider : 'Manual Dialer',
    callingNumber: String(currentMetadata.callingNumber || ''),
    callingExtension: String(currentMetadata.callingExtension || ''),
    callingConnected: Boolean(currentMetadata.callingConnected),
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
      outlookEmail: String(body?.superUser?.outlookEmail || ''),
      outlookConnected: Boolean(body?.superUser?.outlookConnected),
      emailProvider: ['Gmail', 'IMAP/SMTP'].includes(body?.superUser?.emailProvider) ? body.superUser.emailProvider : 'Outlook',
      imapHost: String(body?.superUser?.imapHost || 'outlook.office365.com'),
      imapPort: String(body?.superUser?.imapPort || '993'),
      smtpHost: String(body?.superUser?.smtpHost || 'smtp.office365.com'),
      smtpPort: String(body?.superUser?.smtpPort || '587'),
      signatureText: String(body?.superUser?.signatureText || ''),
      signatureImageUrl: String(body?.superUser?.signatureImageUrl || ''),
      signatureTitle: String(body?.superUser?.signatureTitle || ''),
      signaturePhone: String(body?.superUser?.signaturePhone || ''),
      callingProvider: ['Alliance SIP', 'Twilio', 'RingCentral', 'Vonage'].includes(body?.superUser?.callingProvider) ? body.superUser.callingProvider : 'Manual Dialer',
      callingNumber: String(body?.superUser?.callingNumber || ''),
      callingExtension: String(body?.superUser?.callingExtension || ''),
      callingConnected: Boolean(body?.superUser?.callingConnected),
      updatedAt: new Date().toISOString(),
    };

    await Promise.all([
      authStore.replaceCollection('authUsers', normalizeAuthRows(body.users)),
      authStore.replaceCollection('authMetadata', [superUser]),
      authStore.replaceCollection('passwordResetRequests', normalizeAuthRows(body.passwordResetRequests)),
      authStore.replaceCollection('passwordEmailOutbox', normalizeAuthRows(body.passwordEmailOutbox)),
    ]);
    scheduleGithubBackup('auth-state-change');

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

function actorFromRequest(request) {
  const session = decodeSession(request.headers['x-recruitiq-session'] || request.headers['x-vrecruit-session'] || request.headers['x-eventus-session']);
  if (!session) return null;
  return {
    id: session.id || 'unknown-user',
    name: session.name || session.email || 'ATS User',
    email: session.email || '',
    role: session.role || 'User',
  };
}

async function resolveBackendUserName(userId, fallback = 'ATS User') {
  if (!userId) return fallback;
  const state = await ensureAuthState();
  if (userId === 'SuperUser') return state.superUser.name || fallback;
  const user = state.users.find(row => row.id === userId || row.email === userId);
  return user?.name || fallback;
}

function withUpdatedTimestamp(record, actor = null) {
  if (!record || typeof record !== 'object') return record;
  const now = new Date().toISOString();
  const actorPatch = actor ? {
    updatedBy: actor.name,
    updatedByUserId: actor.id,
    updatedByEmail: actor.email,
    createdBy: record.createdBy || actor.name,
    createdByUserId: record.createdByUserId || actor.id,
    createdByEmail: record.createdByEmail || actor.email,
  } : {};
  return {
    ...record,
    ...actorPatch,
    createdAt: record.createdAt || now,
    updatedAt: now,
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

function stampSubmission(row, actor = null) {
  const now = new Date().toISOString();
  return withUpdatedTimestamp({
    ...row,
    recruiter: row.recruiter || actor?.name || 'Recruiter',
    submittedByUserId: row.submittedByUserId || actor?.id,
    submittedByEmail: row.submittedByEmail || actor?.email,
    id: row.id || `submission-api-${Date.now()}`,
    submittedDate: row.submittedDate || now.slice(0, 10),
    submittedAt: row.submittedAt || now,
    createdAt: row.createdAt || now,
    updatedAt: now,
  }, actor);
}

async function handleAtsCollection(request, response) {
  const route = collectionFromUrl(request.url);
  if (!route) return json(response, 404, { error: 'ATS collection not found' });
  const actor = actorFromRequest(request);

  const db = await readAtsDb();
  const current = Array.isArray(db[route.collection]) ? db[route.collection] : [];

  if (request.method === 'GET') {
    return json(response, 200, { rows: current });
  }

  const body = JSON.parse(await readBody(request) || '{}');

  if (request.method === 'PUT') {
    const rows = Array.isArray(body.rows) ? body.rows.map(row => withUpdatedTimestamp(row, actor)) : [];
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
    const stampedRows = incoming.map(row => route.collection === 'submissions' ? stampSubmission(row, actor) : withUpdatedTimestamp(row, actor));
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
      ? stampSubmission({ ...current.find(row => row.id === route.id), ...body, id: route.id }, actor)
      : withUpdatedTimestamp({ ...current.find(row => row.id === route.id), ...body }, actor);

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
  const row = stampSubmission(body, actorFromRequest(request));
  const result = await atsStore.insertSubmission(row);

  if (result.duplicate) {
    return json(response, 409, {
      error: 'duplicate-submission',
      message: 'Candidate is already submitted to this job.',
      duplicate: result.duplicate,
      rows: result.rows,
    });
  }

  scheduleGithubBackup('submission-submit');
  return json(response, 200, { row: result.row, rows: result.rows });
}

async function handleOutlookStatus(request, response) {
  const url = new URL(request.url, 'http://localhost');
  const userId = url.searchParams.get('userId') || actorFromRequest(request)?.id || '';
  const rows = await readOutlookTokens();
  const token = rows.find(row => row.userId === userId);
  const config = outlookConfig(request);
  return json(response, 200, {
    configured: outlookConfigReady(config),
    connected: Boolean(token),
    userId,
    emailAddress: token?.emailAddress || '',
    connectedAt: token?.connectedAt || '',
    lastRefreshedAt: token?.lastRefreshedAt || '',
    redirectUri: config.redirectUri,
    missing: [
      !config.clientId ? 'OUTLOOK_CLIENT_ID' : '',
      !config.clientSecret ? 'OUTLOOK_CLIENT_SECRET' : '',
      !config.redirectUri ? 'OUTLOOK_REDIRECT_URI' : '',
      !tokenSecret() ? 'OUTLOOK_TOKEN_ENCRYPTION_KEY' : '',
    ].filter(Boolean),
  });
}

async function handleOutlookStart(request, response) {
  const actor = actorFromRequest(request);
  if (!actor || actor.role !== 'SuperUser') return json(response, 403, { ok: false, message: 'Only SuperUser can connect Outlook mailboxes.' });
  const body = request.method === 'POST' ? JSON.parse(await readBody(request) || '{}') : {};

  const config = outlookConfig(request);
  if (!outlookConfigReady(config)) {
    return json(response, 400, {
      ok: false,
      message: 'Outlook OAuth is not configured. Add OUTLOOK_CLIENT_ID, OUTLOOK_CLIENT_SECRET, and OUTLOOK_REDIRECT_URI to the backend environment.',
      redirectUri: config.redirectUri,
    });
  }
  if (!tokenSecret()) {
    return json(response, 400, {
      ok: false,
      message: 'OUTLOOK_TOKEN_ENCRYPTION_KEY is required before connecting Outlook in production.',
    });
  }

  const url = new URL(request.url, 'http://localhost');
  const userId = body.userId || url.searchParams.get('userId') || actor.id;
  const stateRows = await readOutlookStates();
  const state = randomBytes(24).toString('hex');
  const authUrl = new URL(`https://login.microsoftonline.com/${encodeURIComponent(config.tenantId)}/oauth2/v2.0/authorize`);
  authUrl.searchParams.set('client_id', config.clientId);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', config.redirectUri);
  authUrl.searchParams.set('response_mode', 'query');
  authUrl.searchParams.set('scope', config.scopes);
  authUrl.searchParams.set('state', state);
  const loginHint = body.loginHint || url.searchParams.get('loginHint') || '';
  if (loginHint) authUrl.searchParams.set('login_hint', loginHint);

  await writeOutlookStates([
    {
      state,
      userId,
      requestedBy: actor,
      loginHint,
      returnTo: body.returnTo || url.searchParams.get('returnTo') || `${appOrigin(request)}/users`,
      createdAt: new Date().toISOString(),
      expiresAt: Date.now() + 10 * 60 * 1000,
    },
    ...stateRows.filter(row => Number(row.expiresAt || 0) > Date.now()).slice(0, 20),
  ]);

  if (request.method === 'POST') {
    return json(response, 200, { ok: true, authorizationUrl: authUrl.toString(), redirectUri: config.redirectUri });
  }

  response.writeHead(302, { Location: authUrl.toString() });
  response.end();
}

async function handleOutlookCallback(request, response) {
  const url = new URL(request.url, 'http://localhost');
  const state = url.searchParams.get('state') || '';
  const code = url.searchParams.get('code') || '';
  const error = url.searchParams.get('error_description') || url.searchParams.get('error') || '';
  const states = await readOutlookStates();
  const savedState = states.find(row => row.state === state);
  await writeOutlookStates(states.filter(row => row.state !== state && Number(row.expiresAt || 0) > Date.now()));

  const finish = (title, message, ok = false, returnTo = `${appOrigin(request)}/users`) => html(response, ok ? 200 : 400, `<!doctype html>
<html><head><meta charset="utf-8"><title>${title}</title></head>
<body style="font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif; background:#0f172a; color:#e2e8f0; display:grid; min-height:100vh; place-items:center; margin:0;">
  <main style="max-width:520px; padding:28px; border:1px solid rgba(255,255,255,.12); border-radius:12px; background:#111827;">
    <h1 style="margin:0 0 12px; font-size:22px;">${title}</h1>
    <p style="line-height:1.55; color:#cbd5e1;">${message}</p>
    <a href="${returnTo}" style="display:inline-block; margin-top:16px; color:white; background:#2563eb; padding:10px 14px; border-radius:8px; text-decoration:none;">Back to ATS</a>
  </main>
</body></html>`);

  if (error) return finish('Outlook connection failed', error);
  if (!savedState || Number(savedState.expiresAt || 0) < Date.now()) return finish('Outlook connection expired', 'Please start the Outlook connection again from ATS User Management.');
  if (!code) return finish('Outlook connection failed', 'Microsoft did not return an authorization code.', false, savedState.returnTo);

  try {
    const tokenSet = await exchangeOutlookCode(request, code);
    const profile = await fetchMicrosoftProfile(tokenSet.access_token);
    const emailAddress = String(profile.mail || profile.userPrincipalName || savedState.loginHint || '').toLowerCase();
    if (!emailAddress) throw new Error('Microsoft account email was not returned.');
    const userName = profile.displayName || await resolveBackendUserName(savedState.userId, savedState.requestedBy?.name || 'ATS User');
    await saveOutlookToken({ userId: savedState.userId, userName, emailAddress, tokenSet });
    await upsertOutlookIntegration({ userId: savedState.userId, userName, emailAddress });
    await markAuthMailboxConnected({ userId: savedState.userId, emailAddress });
    return finish('Outlook connected', `${emailAddress} is connected. ATS can now send candidate emails through Microsoft Graph from this mailbox.`, true, savedState.returnTo);
  } catch (callbackError) {
    return finish('Outlook connection failed', callbackError instanceof Error ? callbackError.message : 'Could not complete Microsoft OAuth.', false, savedState.returnTo);
  }
}

function splitEmails(value) {
  return String(value || '')
    .split(/[;,]/)
    .map(item => item.trim())
    .filter(Boolean);
}

function graphRecipients(value) {
  return splitEmails(value).map(address => ({
    emailAddress: { address },
  }));
}

function cleanHtmlMessage(message) {
  return String(message || '').replace(/[<>&]/g, character => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
  })[character]);
}

async function upsertOutlookIntegration({ userId, userName, emailAddress, connectedAt = new Date().toISOString() }) {
  const db = await readAtsDb();
  const current = Array.isArray(db.emailIntegrations) ? db.emailIntegrations : [];
  const existing = current.find(item => item.userId === userId || item.emailAddress?.toLowerCase() === emailAddress.toLowerCase());
  const row = {
    id: existing?.id || `email-integration-${userId || 'user'}-${Date.now()}`,
    userId: userId || existing?.userId || 'unknown-user',
    userName: userName || existing?.userName || await resolveBackendUserName(userId, 'ATS User'),
    provider: 'Outlook',
    emailAddress,
    imapHost: existing?.imapHost || 'outlook.office365.com',
    imapPort: Number(existing?.imapPort) || 993,
    smtpHost: existing?.smtpHost || 'smtp.office365.com',
    smtpPort: Number(existing?.smtpPort) || 587,
    status: 'connected',
    connectedAt: existing?.connectedAt || connectedAt,
    lastSyncedAt: new Date().toISOString(),
    notes: 'Connected by Microsoft Graph OAuth. Tokens are stored in server/data/outlook-oauth-tokens.json and are not included in ATS GitHub backup.',
  };
  db.emailIntegrations = [row, ...current.filter(item => item.id !== row.id && item.userId !== row.userId)];
  await writeAtsDb(db);
  return row;
}

async function markAuthMailboxConnected({ userId, emailAddress }) {
  const state = await ensureAuthState();
  if (userId === 'SuperUser') {
    await authStore.replaceCollection('authMetadata', [{
      ...state.superUser,
      outlookEmail: emailAddress,
      outlookConnected: true,
      emailProvider: 'Outlook',
      updatedAt: new Date().toISOString(),
    }]);
    return;
  }

  await authStore.replaceCollection('authUsers', state.users.map(user => user.id === userId ? {
    ...user,
    outlookEmail: emailAddress,
    outlookConnected: true,
    emailProvider: 'Outlook',
    updatedAt: new Date().toISOString(),
  } : user));
}

async function fetchMicrosoftProfile(accessToken) {
  const response = await fetch('https://graph.microsoft.com/v1.0/me?$select=displayName,mail,userPrincipalName', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error?.message || `Microsoft profile lookup failed with ${response.status}`);
  return body;
}

async function saveOutlookToken({ userId, userName, emailAddress, tokenSet }) {
  const rows = await readOutlookTokens();
  const now = new Date().toISOString();
  const tokenPayload = {
    accessToken: tokenSet.access_token,
    refreshToken: tokenSet.refresh_token,
    scope: tokenSet.scope,
    tokenType: tokenSet.token_type,
    expiresAt: Date.now() + (Number(tokenSet.expires_in) || 3600) * 1000,
  };
  const row = {
    id: `outlook-token-${userId || emailAddress}`,
    userId,
    userName,
    emailAddress: emailAddress.toLowerCase(),
    provider: 'Outlook',
    connectedAt: rows.find(item => item.userId === userId)?.connectedAt || now,
    lastRefreshedAt: now,
    encryptedToken: encryptSecret(tokenPayload),
  };
  await writeOutlookTokens([row, ...rows.filter(item => item.id !== row.id && item.userId !== userId && item.emailAddress !== row.emailAddress)]);
  return row;
}

async function exchangeOutlookCode(request, code) {
  const config = outlookConfig(request);
  const tokenUrl = `https://login.microsoftonline.com/${encodeURIComponent(config.tenantId)}/oauth2/v2.0/token`;
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: config.redirectUri,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error_description || body?.error || `Microsoft token exchange failed with ${response.status}`);
  return body;
}

async function refreshOutlookToken(request, tokenRow, tokenPayload) {
  const config = outlookConfig(request);
  const tokenUrl = `https://login.microsoftonline.com/${encodeURIComponent(config.tenantId)}/oauth2/v2.0/token`;
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: tokenPayload.refreshToken,
      grant_type: 'refresh_token',
      scope: config.scopes,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error_description || body?.error || `Microsoft refresh token failed with ${response.status}`);
  const merged = {
    accessToken: body.access_token,
    refreshToken: body.refresh_token || tokenPayload.refreshToken,
    scope: body.scope || tokenPayload.scope,
    tokenType: body.token_type || tokenPayload.tokenType,
    expiresAt: Date.now() + (Number(body.expires_in) || 3600) * 1000,
  };
  const rows = await readOutlookTokens();
  await writeOutlookTokens(rows.map(row => row.id === tokenRow.id ? {
    ...row,
    lastRefreshedAt: new Date().toISOString(),
    encryptedToken: encryptSecret(merged),
  } : row));
  return merged.accessToken;
}

async function accessTokenForOutlookSend(request, { actor, sender }) {
  const rows = await readOutlookTokens();
  const senderEmail = String(sender || '').toLowerCase();
  const tokenRow = rows.find(row => row.userId === actor?.id)
    || rows.find(row => senderEmail && row.emailAddress === senderEmail)
    || rows.find(row => row.userId === 'SuperUser');
  if (!tokenRow) throw new Error('No Outlook OAuth mailbox is connected for this ATS user.');
  const tokenPayload = decryptSecret(tokenRow.encryptedToken);
  if (tokenPayload.accessToken && Number(tokenPayload.expiresAt || 0) > Date.now() + 60_000) return tokenPayload.accessToken;
  return refreshOutlookToken(request, tokenRow, tokenPayload);
}

async function sendOutlookGraphMail(request, emailRecord, actor) {
  const accessToken = await accessTokenForOutlookSend(request, { actor, sender: emailRecord.sender });
  const response = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        subject: emailRecord.subject || 'ATS message',
        body: {
          contentType: 'Text',
          content: cleanHtmlMessage(emailRecord.body || ''),
        },
        toRecipients: graphRecipients(emailRecord.to),
        ccRecipients: graphRecipients(emailRecord.cc),
      },
      saveToSentItems: true,
    }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error?.message || `Microsoft Graph sendMail failed with ${response.status}`);
  }
}

async function handleEmailConnect(request, response) {
  const body = JSON.parse(await readBody(request) || '{}');
  const db = await readAtsDb();
  const current = Array.isArray(db.emailIntegrations) ? db.emailIntegrations : [];
  const now = new Date().toISOString();
  const row = {
    id: body.id || `email-integration-${body.userId || 'user'}-${Date.now()}`,
    userId: body.userId || 'unknown-user',
    userName: body.userName || await resolveBackendUserName(body.userId, 'ATS User'),
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
  const actor = actorFromRequest(request);
  const db = await readAtsDb();
  const current = Array.isArray(db.emailRecords) ? db.emailRecords : [];
  const now = new Date().toISOString();
  let deliveryStatus = body.deliveryStatus || 'Provider Pending';
  let providerMessage = body.providerMessage || 'ATS stored the outbound email request.';
  const deliveryProvider = body.deliveryProvider || body.provider || 'Configured mailbox';

  if (String(deliveryProvider).toLowerCase().includes('outlook') || String(body.provider || '').toLowerCase().includes('outlook')) {
    try {
      await sendOutlookGraphMail(request, body, actor);
      deliveryStatus = 'Sent';
      providerMessage = 'Email sent through Microsoft Graph Outlook sendMail. Replies remain in the Outlook mailbox.';
    } catch (error) {
      deliveryStatus = 'Failed';
      providerMessage = error instanceof Error ? error.message : 'Microsoft Graph Outlook delivery failed.';
    }
  }

  const row = withUpdatedTimestamp({
    ...body,
    id: body.id || `email-api-${Date.now()}`,
    status: deliveryStatus === 'Failed' ? 'Draft' : 'Sent',
    deliveryStatus,
    deliveryProvider,
    providerMessage,
    sentAt: body.sentAt || new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date()),
    serverTimestamp: now,
  }, actor);
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

function githubBackupConfig() {
  return {
    repo: process.env.GITHUB_BACKUP_REPO || '',
    token: process.env.GITHUB_BACKUP_TOKEN || process.env.GITHUB_TOKEN || '',
    branch: process.env.GITHUB_BACKUP_BRANCH || 'main',
    path: process.env.GITHUB_BACKUP_PATH || 'ats-backups/latest-ats-backup.json',
    auto: String(process.env.GITHUB_BACKUP_AUTO ?? 'true').toLowerCase() !== 'false',
    debounceMs: Number(process.env.GITHUB_BACKUP_DEBOUNCE_MS || 2500),
  };
}

function queueGithubBackup(task) {
  const next = githubBackupQueue.then(task, task);
  githubBackupQueue = next.catch(() => {});
  return next;
}

function scheduleGithubBackup(trigger) {
  const config = githubBackupConfig();
  if (!config.auto || !config.repo || !config.token) return;
  if (githubBackupTimer) clearTimeout(githubBackupTimer);
  githubBackupTimer = setTimeout(() => {
    githubBackupTimer = null;
    void queueGithubBackup(async () => {
      try {
        const result = await runGithubBackup({
          id: 'system-auto-backup',
          name: 'ATS Auto Backup',
          email: '',
          role: 'SuperUser',
        }, trigger);
        console.log(`GitHub ATS auto backup completed: ${result.totalRecords} records (${trigger})`);
      } catch (error) {
        console.warn('GitHub ATS auto backup failed:', error instanceof Error ? error.message : error);
      }
    });
  }, Math.max(500, config.debounceMs));
}

async function putGithubFile({ repo, token, branch, path, content, message }) {
  const apiPath = encodeURIComponent(path).replace(/%2F/g, '/');
  const url = `https://api.github.com/repos/${repo}/contents/${apiPath}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'User-Agent': 'eventus-ats-backup',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  const existing = await fetch(`${url}?ref=${encodeURIComponent(branch)}`, { headers }).then(async githubResponse => {
    if (githubResponse.status === 404) return null;
    if (!githubResponse.ok) throw new Error(`GitHub lookup failed with ${githubResponse.status}`);
    return githubResponse.json();
  });
  const githubResponse = await fetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      message,
      branch,
      content: Buffer.from(content, 'utf8').toString('base64'),
      sha: existing?.sha,
    }),
  });
  const body = await githubResponse.json().catch(() => ({}));
  if (!githubResponse.ok) {
    throw new Error(body?.message || `GitHub update failed with ${githubResponse.status}`);
  }
  return body;
}

async function runGithubBackup(actor, trigger = 'manual-button') {
  const [atsData, authData] = await Promise.all([readAtsDb(), ensureAuthState()]);
  const atsCounts = Object.fromEntries(
    Array.from(ATS_COLLECTIONS)
      .map(collection => [collection, Array.isArray(atsData[collection]) ? atsData[collection].length : 0])
  );
  const authCounts = {
    users: Array.isArray(authData.users) ? authData.users.length : 0,
    superUserProfiles: authData.superUser ? 1 : 0,
    passwordResetRequests: Array.isArray(authData.passwordResetRequests) ? authData.passwordResetRequests.length : 0,
    passwordEmailOutbox: Array.isArray(authData.passwordEmailOutbox) ? authData.passwordEmailOutbox.length : 0,
  };
  const totalRecords = [
    ...Object.values(atsCounts),
    ...Object.values(authCounts),
  ].reduce((sum, value) => sum + Number(value || 0), 0);

  const backup = {
    backupVersion: 1,
    generatedAt: new Date().toISOString(),
    generatedBy: actor,
    trigger,
    storage: atsStore.mode,
    summary: {
      totalRecords,
      atsCounts,
      authCounts,
    },
    atsData,
    authData,
    attachmentNote: 'This backup includes all ATS JSON records and stored data URLs. Browser-only uploads saved only as metadata do not contain original binary file bytes.',
  };
  const content = `${JSON.stringify(backup, null, 2)}\n`;
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(GITHUB_BACKUP_FILE, content);

  const config = githubBackupConfig();
  if (!config.repo || !config.token) {
    return {
      ok: true,
      localOnly: true,
      localPath: GITHUB_BACKUP_FILE,
      totalRecords,
      atsCounts,
      authCounts,
      message: 'ATS backup saved locally. GitHub repo/token settings are not configured yet, so no remote copy was pushed.',
    };
  }

  const result = await putGithubFile({
    ...config,
    content,
    message: `ATS backup ${backup.generatedAt}`,
  });
  return {
    ok: true,
    localOnly: false,
    localPath: GITHUB_BACKUP_FILE,
    githubPath: config.path,
    githubUrl: result?.content?.html_url,
    totalRecords,
    atsCounts,
    authCounts,
    message: 'ATS backup saved locally and pushed to GitHub.',
  };
}

async function handleGithubBackup(request, response) {
  const actor = actorFromRequest(request);
  if (!actor || actor.role !== 'SuperUser') {
    return json(response, 403, { ok: false, message: 'Only SuperUser can run GitHub backups.' });
  }

  try {
    return json(response, 200, await queueGithubBackup(() => runGithubBackup(actor, 'manual-button')));
  } catch (error) {
    const [atsData, authData] = await Promise.all([readAtsDb(), ensureAuthState()]);
    const atsCounts = Object.fromEntries(
      Array.from(ATS_COLLECTIONS)
        .map(collection => [collection, Array.isArray(atsData[collection]) ? atsData[collection].length : 0])
    );
    const authCounts = {
      users: Array.isArray(authData.users) ? authData.users.length : 0,
      superUserProfiles: authData.superUser ? 1 : 0,
      passwordResetRequests: Array.isArray(authData.passwordResetRequests) ? authData.passwordResetRequests.length : 0,
      passwordEmailOutbox: Array.isArray(authData.passwordEmailOutbox) ? authData.passwordEmailOutbox.length : 0,
    };
    return json(response, 502, {
      ok: false,
      localOnly: true,
      localPath: GITHUB_BACKUP_FILE,
      totalRecords: [...Object.values(atsCounts), ...Object.values(authCounts)].reduce((sum, value) => sum + Number(value || 0), 0),
      atsCounts,
      authCounts,
      message: error instanceof Error ? error.message : 'GitHub backup failed.',
    });
  }
}

const server = http.createServer(async (request, response) => {
  if (request.method === 'OPTIONS') return json(response, 204, {});
  const pathname = pathnameFromUrl(request.url);
  if (request.method === 'GET' && pathname === '/healthz') return json(response, 200, { ok: true, storage: atsStore.mode });
  if (pathname === '/api/auth/state' && (request.method === 'GET' || request.method === 'PUT')) return handleAuthState(request, response);
  if (pathname === '/api/ats/github/backup' && request.method === 'POST') return handleGithubBackup(request, response);
  if (request.method === 'POST' && pathname === '/api/ai/run') return handleAI(request, response);
  if (request.method === 'GET' && pathname === '/api/ai/audit') return handleAudit(request, response);
  if (pathname === '/api/ats/submissions/submit' && request.method === 'POST') return handleSubmissionSubmit(request, response);
  if (pathname === '/api/ats/email/connect' && request.method === 'POST') return handleEmailConnect(request, response);
  if (pathname === '/api/ats/email/outlook/status' && request.method === 'GET') return handleOutlookStatus(request, response);
  if (pathname === '/api/ats/email/outlook/start' && (request.method === 'GET' || request.method === 'POST')) return handleOutlookStart(request, response);
  if (pathname === '/api/ats/email/outlook/callback' && request.method === 'GET') return handleOutlookCallback(request, response);
  if (pathname === '/api/ats/email/send' && request.method === 'POST') return handleEmailSend(request, response);
  if (pathname === '/api/ats/email/sync' && (request.method === 'POST' || request.method === 'GET')) return handleEmailSync(request, response);
  if (collectionFromUrl(request.url)) return handleAtsCollection(request, response);
  if (await serveFrontendAsset(request, response)) return;
  return json(response, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`RecruitIQ AI API listening on http://localhost:${PORT} using ${atsStore.mode} storage`);
});
