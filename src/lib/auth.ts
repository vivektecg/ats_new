export type UserRole = 'SuperUser' | 'User';

export type SectionKey =
  | 'dashboard'
  | 'candidates'
  | 'jobs'
  | 'clients'
  | 'vendors'
  | 'submissions'
  | 'offers'
  | 'onboarding'
  | 'imports'
  | 'emails'
  | 'documents'
  | 'pipeline'
  | 'calendar'
  | 'tasks'
  | 'automations'
  | 'compliance'
  | 'compliance-management'
  | 'reports'
  | 'integrations'
  | 'ai-assistant'
  | 'users';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  permissions: SectionKey[];
  createdAt: string;
  updatedAt?: string;
  passwordHash?: string;
  mustChangePassword?: boolean;
  passwordBlocked?: boolean;
  passwordBlockedAt?: string;
  passwordUpdatedAt?: string;
  lastPasswordResetEmailAt?: string;
  avatarUrl?: string;
}

export interface AuthSession {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  permissions: SectionKey[];
  loginAt: string;
  avatarUrl?: string;
}

export const SUPERUSER_ID = 'SuperUser';
const SESSION_KEY = 'eventus:test:auth-session';
const USERS_KEY = 'eventus:test:rbac-users';
const SUPERUSER_PASSWORD_HASH_KEY = 'eventus:test:superuser-password-hash';
const PASSWORD_RESET_REQUESTS_KEY = 'eventus:test:password-reset-requests';
const PASSWORD_EMAIL_OUTBOX_KEY = 'eventus:test:password-email-outbox';
export const SUPERUSER_PROFILE_KEY = 'eventus:test:superuser-profile';
export const SESSION_UPDATED_EVENT = 'eventus:session-updated';

export interface PasswordResetRequest {
  id: string;
  email: string;
  userId: string;
  role: UserRole;
  tokenHash: string;
  resetUrl: string;
  createdAt: string;
  expiresAt: string;
  requestedBy: string;
  usedAt?: string;
}

export interface PasswordEmailOutboxItem {
  id: string;
  to: string;
  subject: string;
  body: string;
  resetUrl: string;
  status: 'Queued';
  createdAt: string;
}

export const allSections: Array<{ key: SectionKey; label: string; path: string; sensitive?: boolean }> = [
  { key: 'dashboard', label: 'Dashboard', path: '/dashboard' },
  { key: 'candidates', label: 'Candidates', path: '/candidates', sensitive: true },
  { key: 'jobs', label: 'Jobs', path: '/jobs' },
  { key: 'clients', label: 'Clients CRM', path: '/clients', sensitive: true },
  { key: 'vendors', label: 'Vendors', path: '/vendors', sensitive: true },
  { key: 'submissions', label: 'Submissions', path: '/submissions', sensitive: true },
  { key: 'offers', label: 'Offers', path: '/offers', sensitive: true },
  { key: 'onboarding', label: 'Onboarding', path: '/onboarding', sensitive: true },
  { key: 'imports', label: 'Bulk Import', path: '/imports', sensitive: true },
  { key: 'emails', label: 'Email Center', path: '/emails', sensitive: true },
  { key: 'documents', label: 'Documents', path: '/documents', sensitive: true },
  { key: 'pipeline', label: 'Pipeline', path: '/pipeline' },
  { key: 'calendar', label: 'Calendar', path: '/calendar' },
  { key: 'calendar', label: 'Interviews', path: '/interviews' },
  { key: 'tasks', label: 'Tasks', path: '/tasks' },
  { key: 'automations', label: 'Automations', path: '/automations' },
  { key: 'compliance', label: 'Audit Logs', path: '/compliance', sensitive: true },
  { key: 'compliance-management', label: 'Compliance', path: '/compliance-management', sensitive: true },
  { key: 'reports', label: 'Reports', path: '/reports' },
  { key: 'integrations', label: 'Integrations', path: '/integrations' },
  { key: 'ai-assistant', label: 'AI Assistant', path: '/ai-assistant' },
  { key: 'ai-assistant', label: 'AI Tools', path: '/ai' },
  { key: 'users', label: 'User Management', path: '/users', sensitive: true },
];

export const defaultUserPermissions: SectionKey[] = [
  'dashboard',
  'candidates',
  'jobs',
  'submissions',
  'offers',
  'onboarding',
  'imports',
  'emails',
  'documents',
  'pipeline',
  'calendar',
  'tasks',
  'compliance-management',
  'reports',
  'ai-assistant',
];

export const superUserPermissions = allSections.map(section => section.key);

export function getSession(): AuthSession | null {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function notifySessionUpdated() {
  window.dispatchEvent(new CustomEvent(SESSION_UPDATED_EVENT));
}

export function saveSession(session: AuthSession, shouldNotify = true) {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  if (shouldNotify) notifySessionUpdated();
}

export function clearSession() {
  window.localStorage.removeItem(SESSION_KEY);
  notifySessionUpdated();
}

export function getUsers(): AppUser[] {
  try {
    const raw = window.localStorage.getItem(USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveUsers(users: AppUser[]) {
  window.localStorage.setItem(USERS_KEY, JSON.stringify(users));
  notifySessionUpdated();
}

export function encodePassword(password: string) {
  return window.btoa(unescape(encodeURIComponent(`eventus:${password}`)));
}

export function verifyPassword(passwordHash: string | undefined, password: string) {
  return Boolean(passwordHash) && passwordHash === encodePassword(password);
}

function readArray<T>(key: string): T[] {
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
}

function randomToken() {
  const bytes = new Uint8Array(24);
  window.crypto?.getRandomValues?.(bytes);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('') || `${Date.now()}-${Math.random()}`;
}

function superUserEmail() {
  try {
    const profile = JSON.parse(window.localStorage.getItem(SUPERUSER_PROFILE_KEY) || '{}');
    return String(profile.email || 'superuser@eventus.local').toLowerCase();
  } catch {
    return 'superuser@eventus.local';
  }
}

export function getSuperUserPasswordHash() {
  return window.localStorage.getItem(SUPERUSER_PASSWORD_HASH_KEY);
}

export function hasBootstrappedSuperUser() {
  return Boolean(getSuperUserPasswordHash());
}

export function setSuperUserPassword(password: string) {
  window.localStorage.setItem(SUPERUSER_PASSWORD_HASH_KEY, encodePassword(password));
  notifySessionUpdated();
}

export function verifySuperUserPassword(password: string) {
  return Boolean(getSuperUserPasswordHash()) && getSuperUserPasswordHash() === encodePassword(password);
}

export function bootstrapSuperUser(input: { password: string; name?: string; email?: string }) {
  const now = new Date().toISOString();
  setSuperUserPassword(input.password);
  const profile = {
    name: input.name?.trim() || 'SuperUser',
    email: input.email?.trim().toLowerCase() || 'superuser@eventus.local',
    updatedAt: now,
  };
  window.localStorage.setItem(SUPERUSER_PROFILE_KEY, JSON.stringify(profile));
  const session = makeSuperUserSession();
  saveSession(session);
  return session;
}

export function getPasswordResetRequests() {
  return readArray<PasswordResetRequest>(PASSWORD_RESET_REQUESTS_KEY);
}

export function getPasswordEmailOutbox() {
  return readArray<PasswordEmailOutboxItem>(PASSWORD_EMAIL_OUTBOX_KEY);
}

function savePasswordResetRequests(rows: PasswordResetRequest[]) {
  writeArray(PASSWORD_RESET_REQUESTS_KEY, rows);
}

function savePasswordEmailOutbox(rows: PasswordEmailOutboxItem[]) {
  writeArray(PASSWORD_EMAIL_OUTBOX_KEY, rows);
}

function findIdentityByEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === superUserEmail() || normalized === 'superuser@eventus.local') {
    return {
      userId: SUPERUSER_ID,
      role: 'SuperUser' as const,
      name: 'SuperUser',
      email: superUserEmail(),
      active: true,
    };
  }
  const user = getUsers().find(savedUser => savedUser.email.toLowerCase() === normalized);
  return user ? {
    userId: user.id,
    role: user.role,
    name: user.name,
    email: user.email.toLowerCase(),
    active: user.active,
    passwordBlocked: user.passwordBlocked,
  } : null;
}

export function requestPasswordReset(email: string, requestedBy = 'self-service') {
  const identity = findIdentityByEmail(email);
  if (!identity) {
    return { ok: false, message: 'No active ATS login was found for this email address.' };
  }
  if (!identity.active) {
    return { ok: false, message: 'This user is disabled. Contact SuperUser.' };
  }
  if ('passwordBlocked' in identity && identity.passwordBlocked) {
    return { ok: false, message: 'This user password is blocked by SuperUser.' };
  }

  const token = randomToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 60 * 1000).toISOString();
  const resetUrl = `${window.location.origin}/reset-password?email=${encodeURIComponent(identity.email)}&token=${encodeURIComponent(token)}`;
  const request: PasswordResetRequest = {
    id: `reset-${Date.now()}`,
    email: identity.email,
    userId: identity.userId,
    role: identity.role,
    tokenHash: encodePassword(token),
    resetUrl,
    createdAt: now.toISOString(),
    expiresAt,
    requestedBy,
  };
  const outboxItem: PasswordEmailOutboxItem = {
    id: `password-email-${Date.now()}`,
    to: identity.email,
    subject: 'The Eventus Consulting Group ATS password reset link',
    body: `Hello ${identity.name}, use this secure link to update your ATS password. The link expires in 30 minutes: ${resetUrl}`,
    resetUrl,
    status: 'Queued',
    createdAt: now.toISOString(),
  };

  savePasswordResetRequests([request, ...getPasswordResetRequests().filter(item => !(item.email === identity.email && !item.usedAt))].slice(0, 100));
  savePasswordEmailOutbox([outboxItem, ...getPasswordEmailOutbox()].slice(0, 100));

  if (identity.role === 'User') {
    saveUsers(getUsers().map(user => user.id === identity.userId ? {
      ...user,
      lastPasswordResetEmailAt: now.toISOString(),
      updatedAt: now.toISOString(),
    } : user));
  }

  return { ok: true, message: 'Password reset email queued.', resetUrl, expiresAt };
}

export function completePasswordReset(email: string, token: string, newPassword: string) {
  const normalized = email.trim().toLowerCase();
  const now = new Date();
  const requests = getPasswordResetRequests();
  const request = requests.find(item =>
    item.email.toLowerCase() === normalized &&
    item.tokenHash === encodePassword(token) &&
    !item.usedAt
  );

  if (!request) {
    return { ok: false, message: 'This password reset link is invalid or already used.' };
  }
  if (new Date(request.expiresAt).getTime() < now.getTime()) {
    return { ok: false, message: 'This password reset link has expired. Request a new link.' };
  }
  if (newPassword.length < 10) {
    return { ok: false, message: 'Password must be at least 10 characters.' };
  }

  if (request.role === 'SuperUser') {
    setSuperUserPassword(newPassword);
  } else {
    const users = getUsers();
    const user = users.find(row => row.id === request.userId && row.email.toLowerCase() === normalized);
    if (!user || !user.active || user.passwordBlocked) {
      return { ok: false, message: 'This user is disabled, password-blocked, or no longer exists.' };
    }
    saveUsers(users.map(row => row.id === request.userId ? {
      ...row,
      passwordHash: encodePassword(newPassword),
      mustChangePassword: false,
      passwordUpdatedAt: now.toISOString(),
      updatedAt: now.toISOString(),
    } : row));
  }

  savePasswordResetRequests(requests.map(item => item.id === request.id ? { ...item, usedAt: now.toISOString() } : item));

  const session = request.role === 'SuperUser'
    ? makeSuperUserSession()
    : (() => {
        const user = getUsers().find(row => row.id === request.userId);
        return user ? {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          permissions: user.permissions,
          loginAt: now.toISOString(),
          avatarUrl: user.avatarUrl,
        } : null;
      })();

  if (session) saveSession(session);
  return { ok: true, message: 'Password updated. You are signed in now.' };
}

export function resolveSession(): AuthSession | null {
  const session = getSession();
  if (!session) return null;
  if (session.role === 'SuperUser') return session;

  const user = getUsers().find(savedUser => savedUser.id === session.id && savedUser.email === session.email);
  if (!user || !user.active || user.passwordBlocked) {
    clearSession();
    return null;
  }

  const currentSession: AuthSession = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    permissions: user.permissions,
    loginAt: session.loginAt,
    avatarUrl: user.avatarUrl,
  };
  saveSession(currentSession, false);
  return currentSession;
}

export function canAccess(session: AuthSession | null, section: SectionKey) {
  if (!session) return false;
  if (session.role === 'SuperUser') return true;
  if (section === 'users' || section === 'compliance') return false;
  return session.permissions.includes(section);
}

export function sectionForPath(pathname: string): SectionKey {
  const match = allSections
    .filter(section => pathname === section.path || pathname.startsWith(`${section.path}/`))
    .sort((a, b) => b.path.length - a.path.length)[0];
  return match?.key ?? 'dashboard';
}

export function makeSuperUserSession(): AuthSession {
  let savedProfile: Partial<AuthSession> = {};
  try {
    savedProfile = JSON.parse(window.localStorage.getItem(SUPERUSER_PROFILE_KEY) || '{}');
  } catch {
    savedProfile = {};
  }

  return {
    id: SUPERUSER_ID,
    name: savedProfile.name ?? 'SuperUser',
    email: savedProfile.email ?? 'superuser@eventus.local',
    role: 'SuperUser',
    permissions: superUserPermissions,
    loginAt: new Date().toISOString(),
    avatarUrl: savedProfile.avatarUrl,
  };
}
