import { FormEvent, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Ban,
  Building2,
  Camera,
  CheckCircle,
  CreditCard,
  Image as ImageIcon,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  Mail,
  Pencil,
  Phone,
  Save,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  Trash2,
  UserPlus,
  Users,
  Wand2,
} from 'lucide-react';
import { QuickActionModal, QuickIconButton } from '@/components/ats/QuickActionModal';
import {
  allSections,
  AppUser,
  defaultUserPermissions,
  encodePassword,
  getSuperUserProfile,
  getUsers,
  requestPasswordReset,
  resolveSession,
  saveSession,
  saveSuperUserProfile,
  saveUsers,
  SectionKey,
  setSuperUserPassword,
  verifySuperUserPassword,
} from '@/lib/auth';
import { BRAND_LEGAL_NAME, BRAND_NAME } from '@/lib/brand';
import { cn } from '@/lib/utils';

const assignableSections = allSections.filter(section => section.key !== 'users');
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function makeUserId(email: string) {
  const slug = email.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return `user-${slug || Date.now()}`;
}

function initials(name: string) {
  return name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase() || 'EC';
}

function generateTemporaryPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const symbols = '!@#$%';
  const bytes = new Uint8Array(14);
  window.crypto?.getRandomValues?.(bytes);
  const body = Array.from(bytes, byte => alphabet[byte % alphabet.length]).join('');
  return `Ev${body}${symbols[bytes[0] % symbols.length]}${String(10 + (bytes[1] % 89))}`;
}

function readImageFile(file: File, onLoad: (dataUrl: string) => void, onError: (message: string) => void) {
  if (!file.type.startsWith('image/')) {
    onError('Please upload an image file for the profile picture.');
    return;
  }
  if (file.size > 5_000_000) {
    onError('Profile picture must be under 5 MB.');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => onLoad(String(reader.result));
  reader.onerror = () => onError('Could not read the selected image.');
  reader.readAsDataURL(file);
}

function loadSuperUserProfile(session: ReturnType<typeof resolveSession>) {
  const saved = getSuperUserProfile();
  return {
    name: saved.name ?? session?.name ?? 'SuperUser',
    email: saved.email ?? session?.email ?? 'vivekk@theeventusconsultinggroup.com',
    phone: saved.phone ?? '',
    title: saved.title ?? 'System Owner',
    avatarUrl: saved.avatarUrl ?? session?.avatarUrl ?? '',
  };
}

export default function UserManagement() {
  const session = resolveSession();
  const [users, setUsers] = useState<AppUser[]>(() => getUsers());
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [activeAdminPanel, setActiveAdminPanel] = useState<'accounts' | 'profile' | 'security' | 'company'>('accounts');
  const [selectedPassword, setSelectedPassword] = useState('');
  const [selectedEdit, setSelectedEdit] = useState({ name: '', email: '', active: true });
  const [superProfile, setSuperProfile] = useState(() => loadSuperUserProfile(session));
  const [superPassword, setSuperPassword] = useState({ current: '', next: '', confirm: '' });
  const [userAction, setUserAction] = useState<null | { type: 'create' | 'edit' | 'security' | 'superuser' | 'delete'; user?: AppUser }>(null);
  const [latestResetLink, setLatestResetLink] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    avatarUrl: '',
    active: true,
    permissions: defaultUserPermissions,
  });

  const selectedUser = useMemo(
    () => users.find(user => user.id === selectedUserId) ?? users[0],
    [selectedUserId, users]
  );

  const activeUsers = users.filter(user => user.active).length;
  const sensitiveSections = allSections.filter(section => section.sensitive && section.key !== 'users');

  function saveSuperProfile() {
    const nextProfile = saveSuperUserProfile(superProfile);
    setSuperProfile({
      name: nextProfile.name,
      email: nextProfile.email,
      phone: nextProfile.phone ?? '',
      title: nextProfile.title ?? 'System Owner',
      avatarUrl: nextProfile.avatarUrl ?? '',
    });
    if (session) {
      saveSession({
        ...session,
        name: nextProfile.name,
        email: nextProfile.email,
        avatarUrl: nextProfile.avatarUrl || undefined,
      });
    }
    setMessage('SuperUser profile updated.');
    setError('');
  }

  function updateSuperUserPassword() {
    setMessage('');
    setError('');
    if (!verifySuperUserPassword(superPassword.current)) {
      setError('Current SuperUser password is incorrect.');
      return;
    }
    if (superPassword.next.length < 10) {
      setError('New SuperUser password must be at least 10 characters.');
      return;
    }
    if (superPassword.next !== superPassword.confirm) {
      setError('New password and confirmation do not match.');
      return;
    }
    setSuperUserPassword(superPassword.next);
    setSuperPassword({ current: '', next: '', confirm: '' });
    setMessage('SuperUser password updated.');
  }

  function emailSuperUserReset() {
    const reset = requestPasswordReset(superProfile.email, session?.email ?? 'SuperUser');
    setLatestResetLink(reset.resetUrl ?? '');
    setMessage(reset.ok ? 'SuperUser reset link queued.' : '');
    setError(reset.ok ? '' : reset.message);
  }

  useEffect(() => {
    if (!selectedUser) return;
    setSelectedEdit({ name: selectedUser.name, email: selectedUser.email, active: selectedUser.active });
  }, [selectedUser]);

  const updateUsers = (nextUsers: AppUser[], successMessage: string) => {
    setUsers(nextUsers);
    saveUsers(nextUsers);
    setMessage(successMessage);
    setLatestResetLink('');
    setError('');
  };

  const toggleFormPermission = (section: SectionKey) => {
    setForm(current => ({
      ...current,
      permissions: current.permissions.includes(section)
        ? current.permissions.filter(item => item !== section)
        : [...current.permissions, section],
    }));
  };

  const toggleUserPermission = (userId: string, section: SectionKey) => {
    const nextUsers = users.map(user => {
      if (user.id !== userId) return user;
      const permissions = user.permissions.includes(section)
        ? user.permissions.filter(item => item !== section)
        : [...user.permissions, section];
      return { ...user, permissions };
    });
    updateUsers(nextUsers, 'User section access updated.');
  };

  const toggleUserStatus = (userId: string) => {
    const now = new Date().toISOString();
    const nextUsers = users.map(user => user.id === userId ? { ...user, active: !user.active, updatedAt: now } : user);
    updateUsers(nextUsers, 'User login status updated.');
  };

  const togglePasswordBlock = (userId: string) => {
    const now = new Date().toISOString();
    const target = users.find(user => user.id === userId);
    const nextUsers = users.map(user => user.id === userId ? {
      ...user,
      passwordBlocked: !user.passwordBlocked,
      passwordBlockedAt: !user.passwordBlocked ? now : undefined,
      updatedAt: now,
    } : user);
    updateUsers(nextUsers, target?.passwordBlocked ? 'User password/login unblocked.' : 'User password/login blocked.');
  };

  const deleteUser = (userId: string) => {
    const target = users.find(user => user.id === userId);
    const nextUsers = users.filter(user => user.id !== userId);
    setSelectedUserId(nextUsers[0]?.id ?? '');
    updateUsers(nextUsers, `${target?.name ?? 'User'} deleted from ATS access.`);
  };

  const saveSelectedUserDetails = () => {
    if (!selectedUser) return;
    const email = selectedEdit.email.trim().toLowerCase();
    if (!selectedEdit.name.trim() || !email) {
      setError('Name and email are required.');
      return;
    }
    if (!emailPattern.test(email)) {
      setError('Enter a valid user email address.');
      return;
    }
    if (users.some(user => user.id !== selectedUser.id && user.email.toLowerCase() === email)) {
      setError('Another user already has this email.');
      return;
    }
    const now = new Date().toISOString();
    updateUsers(users.map(user => user.id === selectedUser.id ? {
      ...user,
      name: selectedEdit.name.trim(),
      email,
      active: selectedEdit.active,
      updatedAt: now,
    } : user), 'User details updated.');
  };

  const resetPassword = (userId: string, password: string) => {
    if (!password.trim()) {
      setError('Enter a temporary password before resetting.');
      return;
    }
    const now = new Date().toISOString();
    const target = users.find(user => user.id === userId);
    const nextUsers = users.map(user => user.id === userId ? {
      ...user,
      passwordHash: encodePassword(password),
      mustChangePassword: true,
      passwordBlocked: false,
      passwordBlockedAt: undefined,
      passwordUpdatedAt: now,
      updatedAt: now,
    } : user);
    setUsers(nextUsers);
    saveUsers(nextUsers);
    if (target) {
      const reset = requestPasswordReset(target.email, session?.email ?? 'SuperUser');
      setUsers(getUsers());
      setLatestResetLink(reset.resetUrl ?? '');
      setMessage(reset.ok ? 'Temporary password saved and password reset email link queued.' : reset.message);
      setError(reset.ok ? '' : reset.message);
      setSelectedPassword('');
      return;
    }
    setMessage('Temporary password saved for this user.');
    setError('');
  };

  const updateUserAvatar = (userId: string, avatarUrl: string) => {
    const nextUsers = users.map(user => user.id === userId ? { ...user, avatarUrl } : user);
    updateUsers(nextUsers, 'User profile picture saved.');
  };

  const handleCreateUser = (event: FormEvent) => {
    event.preventDefault();
    setMessage('');
    setError('');

    const email = form.email.trim().toLowerCase();
    if (!form.name.trim() || !email || !form.password.trim()) {
      setError('Name, email, and password are required to create a user.');
      return;
    }
    if (!emailPattern.test(email)) {
      setError('Enter a valid user email address.');
      return;
    }
    if (users.some(user => user.email.toLowerCase() === email)) {
      setError('A user with this email already exists.');
      return;
    }
    if (!form.permissions.includes('dashboard')) {
      setError('Every user must keep Dashboard access enabled.');
      return;
    }

    const user: AppUser = {
      id: makeUserId(email),
      name: form.name.trim(),
      email,
      role: 'User',
      active: form.active,
      permissions: form.permissions,
      createdAt: new Date().toISOString(),
      passwordHash: encodePassword(form.password),
      mustChangePassword: true,
      passwordBlocked: false,
      passwordUpdatedAt: new Date().toISOString(),
      avatarUrl: form.avatarUrl || undefined,
    };

    const nextUsers = [user, ...users];
    setUsers(nextUsers);
    saveUsers(nextUsers);
    const reset = requestPasswordReset(email, session?.email ?? 'SuperUser');
    setUsers(getUsers());
    setLatestResetLink(reset.resetUrl ?? '');
    setSelectedUserId(user.id);
    setForm({ name: '', email: '', password: '', avatarUrl: '', active: true, permissions: defaultUserPermissions });
    setMessage('New user login created. Temporary password saved and reset email link queued.');
  };

  if (session?.role !== 'SuperUser') {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="max-w-md rounded-lg border border-red-500/20 bg-[#0d1729] p-6 text-center">
          <LockKeyhole className="mx-auto mb-3 text-red-300" size={28} />
          <h1 className="text-lg font-bold text-white">SuperUser Only</h1>
          <p className="mt-2 text-sm text-slate-400">User management and section-level access controls are restricted.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"
      >
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-300">
            <ShieldCheck size={14} />
            SuperUser access control
          </div>
          <h1 className="text-2xl font-bold text-white">User Management</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Create user credentials, disable accounts, and control which ATS sections regular users can open.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            ['Total Users', users.length],
            ['Active Users', activeUsers],
            ['Controlled Sections', assignableSections.length],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3">
              <p className="text-lg font-bold text-white">{value}</p>
              <p className="text-[11px] uppercase tracking-wider text-slate-500">{label}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {(message || error) && (
        <div className={cn(
          'rounded-lg border px-4 py-3 text-sm',
          error ? 'border-red-500/20 bg-red-500/10 text-red-300' : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
        )}>
          {error || message}
          {latestResetLink && (
            <a href={latestResetLink} className="mt-2 block break-all text-xs text-cyan-200 hover:underline">
              Local preview reset link: {latestResetLink}
            </a>
          )}
        </div>
      )}

      <div className="grid gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-2 md:grid-cols-4">
        {[
          { id: 'accounts' as const, label: 'User Accounts', icon: Users },
          { id: 'profile' as const, label: 'SuperUser Profile', icon: Camera },
          { id: 'security' as const, label: 'Security', icon: ShieldCheck },
          { id: 'company' as const, label: 'Company & Billing', icon: Building2 },
        ].map(item => (
          <button
            key={item.id}
            onClick={() => setActiveAdminPanel(item.id)}
            className={cn(
              'flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors',
              activeAdminPanel === item.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'
            )}
          >
            <item.icon size={14} />
            {item.label}
          </button>
        ))}
      </div>

      {activeAdminPanel === 'profile' && (
        <div className="rounded-lg border border-white/10 bg-[#0d1729] p-5">
          <div className="mb-5 flex items-center gap-4">
            {superProfile.avatarUrl ? (
              <img src={superProfile.avatarUrl} alt="SuperUser profile" className="h-16 w-16 rounded-2xl border border-white/10 object-cover" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 text-lg font-black text-white">
                {initials(superProfile.name)}
              </div>
            )}
            <div>
              <h2 className="font-semibold text-white">SuperUser Profile</h2>
              <p className="text-xs text-slate-500">Profile settings moved here from the removed Settings page.</p>
              <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/10">
                <ImageIcon size={13} />
                Change Profile Picture
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={event => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    readImageFile(file, avatarUrl => setSuperProfile(current => ({ ...current, avatarUrl })), setError);
                    event.target.value = '';
                  }}
                />
              </label>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <LabeledInput label="Full name" value={superProfile.name} onChange={value => setSuperProfile(current => ({ ...current, name: value }))} />
            <LabeledInput label="Title / Role" value={superProfile.title} onChange={value => setSuperProfile(current => ({ ...current, title: value }))} />
            <LabeledInput label="Email" value={superProfile.email} onChange={value => setSuperProfile(current => ({ ...current, email: value }))} icon={<Mail size={13} />} />
            <LabeledInput label="Phone" value={superProfile.phone} onChange={value => setSuperProfile(current => ({ ...current, phone: value }))} icon={<Phone size={13} />} />
          </div>
          <button onClick={saveSuperProfile} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500">
            <Save size={14} />
            Save SuperUser Profile
          </button>
        </div>
      )}

      {activeAdminPanel === 'security' && (
        <div className="rounded-lg border border-white/10 bg-[#0d1729] p-5">
          <h2 className="mb-2 font-semibold text-white">Security & Password Administration</h2>
          <p className="mb-5 text-xs text-slate-500">SuperUser can change its own password, email itself a reset link, and administer user passwords from User Accounts.</p>
          <div className="grid gap-3 md:grid-cols-3">
            <PasswordInput label="Current SuperUser password" value={superPassword.current} show={showPassword} onChange={value => setSuperPassword(current => ({ ...current, current: value }))} />
            <PasswordInput label="New password" value={superPassword.next} show={showPassword} onChange={value => setSuperPassword(current => ({ ...current, next: value }))} />
            <PasswordInput label="Confirm password" value={superPassword.confirm} show={showPassword} onChange={value => setSuperPassword(current => ({ ...current, confirm: value }))} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={() => setShowPassword(current => !current)} className="rounded-lg border border-white/10 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/5">
              {showPassword ? 'Hide passwords' : 'Show passwords'}
            </button>
            <button onClick={updateSuperUserPassword} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500">
              Update SuperUser Password
            </button>
            <button onClick={emailSuperUserReset} className="rounded-lg border border-white/10 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/5">
              Email SuperUser Reset Link
            </button>
          </div>
        </div>
      )}

      {activeAdminPanel === 'company' && (
        <div className="rounded-lg border border-white/10 bg-[#0d1729] p-5">
          <div className="mb-5 flex items-center gap-3">
            <CreditCard size={18} className="text-blue-300" />
            <div>
              <h2 className="font-semibold text-white">Company & Billing Settings</h2>
              <p className="text-xs text-slate-500">Company settings moved here from the removed Settings page.</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Info label="Company name" value={BRAND_LEGAL_NAME} />
            <Info label="Business type" value="US staffing, consulting, ATS operations" />
            <Info label="Product workspace" value={BRAND_NAME} />
            <Info label="Payment terms" value="Net 45 from the date of invoice raised" />
            <Info label="Billing contact" value="billing@eventusconsulting.group" />
            <Info label="Backend security" value="Server-side RBAC, password hashes, MFA, and audit logging required for VPS." />
          </div>
        </div>
      )}

      {activeAdminPanel === 'accounts' && <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <form onSubmit={handleCreateUser} className="rounded-lg border border-white/10 bg-[#0d1729] p-5">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-300">
              <UserPlus size={20} />
            </div>
            <div>
              <h2 className="font-semibold text-white">Create New User</h2>
              <p className="text-xs text-slate-500">Visible only to SuperUser.</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
              <div className="mb-3 flex items-center gap-3">
                {form.avatarUrl ? (
                  <img src={form.avatarUrl} alt="New user profile preview" className="h-14 w-14 rounded-xl border border-white/10 object-cover" />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 text-sm font-bold text-white">
                    {initials(form.name)}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">User profile picture</p>
                  <p className="text-xs text-slate-500">Upload JPG, PNG, or WebP under 5 MB.</p>
                </div>
              </div>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/10">
                <ImageIcon size={14} />
                Upload User Picture
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={event => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    readImageFile(
                      file,
                      avatarUrl => {
                        setForm(current => ({ ...current, avatarUrl }));
                        setError('');
                      },
                      setError
                    );
                    event.target.value = '';
                  }}
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-400">Full Name</span>
              <input
                value={form.name}
                onChange={event => setForm(current => ({ ...current, name: event.target.value }))}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500/60"
                placeholder="Recruiter name"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-400">Login Email</span>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                <input
                  type="text"
                  inputMode="email"
                  autoComplete="username"
                  value={form.email}
                  onChange={event => setForm(current => ({ ...current, email: event.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-9 pr-3 text-sm text-white outline-none focus:border-blue-500/60"
                  placeholder="user@company.com"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-400">Temporary Password</span>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={event => setForm(current => ({ ...current, password: event.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-9 pr-10 text-sm text-white outline-none focus:border-blue-500/60"
                  placeholder="Set a temporary password"
                />
                <button type="button" onClick={() => setShowPassword(current => !current)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setForm(current => ({ ...current, password: generateTemporaryPassword() }))}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-white/5"
              >
                <Wand2 size={12} />
                Generate secure temp password
              </button>
            </label>

            <button
              type="button"
              onClick={() => setForm(current => ({ ...current, active: !current.active }))}
              className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-slate-300 hover:bg-white/[0.06]"
            >
              <span>Account status</span>
              <span className={cn('flex items-center gap-2 font-medium', form.active ? 'text-emerald-300' : 'text-slate-500')}>
                {form.active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                {form.active ? 'Active' : 'Disabled'}
              </span>
            </button>
          </div>

          <div className="mt-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Initial Section Access</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {assignableSections.map(section => {
                const checked = form.permissions.includes(section.key);
                return (
                  <button
                    key={section.key}
                    type="button"
                    onClick={() => toggleFormPermission(section.key)}
                    className={cn(
                      'flex items-center justify-between rounded-lg border px-3 py-2 text-left text-xs transition-colors',
                      checked ? 'border-blue-500/30 bg-blue-500/10 text-blue-200' : 'border-white/10 bg-white/[0.02] text-slate-500 hover:text-slate-300'
                    )}
                  >
                    <span>{section.label}</span>
                    {checked && <CheckCircle size={13} />}
                  </button>
                );
              })}
            </div>
          </div>

          <button type="submit" className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500">
            <UserPlus size={15} />
            Create Login
          </button>
        </form>

        <div className="space-y-6">
          <div className="rounded-lg border border-white/10 bg-[#0d1729]">
            <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
              <div>
                <h2 className="font-semibold text-white">Existing Users</h2>
                <p className="text-xs text-slate-500">Disable users and review their current ATS access.</p>
              </div>
              <Users className="text-slate-500" size={20} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-white/5 text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-3">User</th>
                    <th className="px-5 py-3">Role</th>
                    <th className="px-5 py-3">Sections</th>
                    <th className="px-5 py-3">Created</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-white/5 bg-blue-500/[0.04]">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        {superProfile.avatarUrl ? (
                          <img src={superProfile.avatarUrl} alt="SuperUser profile" className="h-9 w-9 rounded-full border border-white/10 object-cover" />
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-violet-600 text-xs font-bold text-white">{initials(superProfile.name)}</div>
                        )}
                        <div>
                          <p className="font-medium text-white">{superProfile.name}</p>
                          <p className="text-xs text-slate-500">{superProfile.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-blue-200">SuperUser</td>
                    <td className="px-5 py-4 text-slate-300">{allSections.length} enabled</td>
                    <td className="px-5 py-4 text-slate-500">System owner</td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-1.5">
                        <QuickIconButton title="SuperUser profile" onClick={() => setUserAction({ type: 'superuser' })}><ShieldCheck size={14} /></QuickIconButton>
                        <QuickIconButton title="Security" onClick={() => { setActiveAdminPanel('security'); setUserAction({ type: 'security' }); }}><KeyRound size={14} /></QuickIconButton>
                        <QuickIconButton title="Create new user" onClick={() => { setActiveAdminPanel('accounts'); setUserAction({ type: 'create' }); }}><UserPlus size={14} /></QuickIconButton>
                      </div>
                    </td>
                  </tr>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-sm text-slate-500">
                        No regular users yet. Create a login on the left.
                      </td>
                    </tr>
                  ) : users.map(user => (
                    <tr
                      key={user.id}
                      onClick={() => setSelectedUserId(user.id)}
                      className={cn('cursor-pointer border-b border-white/5 transition-colors hover:bg-white/[0.03]', selectedUser?.id === user.id && 'bg-blue-500/5')}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          {user.avatarUrl ? (
                            <img src={user.avatarUrl} alt={`${user.name} profile`} className="h-9 w-9 rounded-full border border-white/10 object-cover" />
                          ) : (
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-violet-600 text-xs font-bold text-white">
                              {initials(user.name)}
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-white">{user.name}</p>
                            <p className="text-xs text-slate-500">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-300">{user.role}</td>
                      <td className="px-5 py-4 text-slate-300">
                        {user.permissions.length} enabled
                        {user.mustChangePassword && <span className="ml-2 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">Reset required</span>}
                        {user.passwordBlocked && <span className="ml-2 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-300">Password blocked</span>}
                      </td>
                      <td className="px-5 py-4 text-slate-500">{new Date(user.createdAt).toLocaleDateString()}</td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-1.5">
                          <QuickIconButton title="Edit user" onClick={() => { setSelectedUserId(user.id); setUserAction({ type: 'edit', user }); }}><Pencil size={14} /></QuickIconButton>
                          <QuickIconButton title={user.active ? 'Disable user' : 'Enable user'} onClick={() => toggleUserStatus(user.id)}>{user.active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}</QuickIconButton>
                          <QuickIconButton title="Security" onClick={() => { setSelectedUserId(user.id); setUserAction({ type: 'security', user }); }}><KeyRound size={14} /></QuickIconButton>
                          <QuickIconButton title="Delete user" onClick={() => { setSelectedUserId(user.id); setUserAction({ type: 'delete', user }); }}><Trash2 size={14} /></QuickIconButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {selectedUser && (
            <div className="rounded-lg border border-white/10 bg-[#0d1729] p-5">
              <div className="mb-5 rounded-lg border border-white/10 bg-white/[0.03] p-4">
                <div className="mb-4 flex items-center gap-2">
                  <Pencil size={15} className="text-blue-300" />
                  <h2 className="text-sm font-semibold text-white">Edit User Details</h2>
                </div>
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-slate-400">Full name</span>
                    <input
                      value={selectedEdit.name}
                      onChange={event => setSelectedEdit(current => ({ ...current, name: event.target.value }))}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500/60"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-slate-400">Email</span>
                    <input
                      value={selectedEdit.email}
                      onChange={event => setSelectedEdit(current => ({ ...current, email: event.target.value }))}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500/60"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setSelectedEdit(current => ({ ...current, active: !current.active }))}
                    className={cn('self-end rounded-lg border px-3 py-2.5 text-xs font-semibold', selectedEdit.active ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-red-500/20 bg-red-500/10 text-red-300')}
                  >
                    {selectedEdit.active ? 'Active' : 'Disabled'}
                  </button>
                </div>
                <button onClick={saveSelectedUserDetails} className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500">
                  Save User Details
                </button>
              </div>

              <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-start gap-3">
                  {selectedUser.avatarUrl ? (
                    <img src={selectedUser.avatarUrl} alt={`${selectedUser.name} profile`} className="h-12 w-12 rounded-xl border border-white/10 object-cover" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 text-sm font-bold text-white">
                      {initials(selectedUser.name)}
                    </div>
                  )}
                  <div>
                    <h2 className="font-semibold text-white">Section Permissions for {selectedUser.name}</h2>
                    <p className="mt-1 text-xs text-slate-500">
                      Turn off sections like Clients CRM, Vendors, Submissions, Documents, and Audit Logs to protect client and candidate data.
                    </p>
                    <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/10">
                      <ImageIcon size={13} />
                      Change User Picture
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={event => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          readImageFile(file, avatarUrl => updateUserAvatar(selectedUser.id, avatarUrl), setError);
                          event.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                </div>
                <div className="w-full max-w-sm space-y-2">
                  <button
                    type="button"
                    onClick={() => setSelectedPassword(generateTemporaryPassword())}
                    className="w-full rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/5"
                  >
                    Generate secure temp password
                  </button>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={13} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={selectedPassword}
                      onChange={event => setSelectedPassword(event.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-8 pr-3 text-xs text-white outline-none focus:border-blue-500/60"
                      placeholder="New temporary password"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => resetPassword(selectedUser.id, selectedPassword)}
                    className="w-full rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/5"
                  >
                    Save temp password & email reset link
                  </button>
                  <button
                    type="button"
                    onClick={() => togglePasswordBlock(selectedUser.id)}
                    className={cn(
                      'flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium',
                      selectedUser.passwordBlocked ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-red-500/20 bg-red-500/10 text-red-300'
                    )}
                  >
                    <Ban size={13} />
                    {selectedUser.passwordBlocked ? 'Unblock Password/Login' : 'Block Password/Login'}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteUser(selectedUser.id)}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/20 px-3 py-2 text-xs font-medium text-red-300 hover:bg-red-500/10"
                  >
                    <Trash2 size={13} />
                    Delete User
                  </button>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {assignableSections.map(section => {
                  const checked = selectedUser.permissions.includes(section.key);
                  return (
                    <button
                      key={section.key}
                      type="button"
                      disabled={section.key === 'dashboard'}
                      onClick={() => toggleUserPermission(selectedUser.id, section.key)}
                      className={cn(
                        'flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-70',
                        checked ? 'border-blue-500/30 bg-blue-500/10 text-blue-200' : 'border-white/10 bg-white/[0.02] text-slate-500 hover:text-slate-300'
                      )}
                    >
                      <span className="flex items-center gap-2">
                        {section.label}
                        {section.sensitive && <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">Sensitive</span>}
                      </span>
                      {checked && <CheckCircle size={14} />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4">
            <div className="flex items-start gap-3">
              <LockKeyhole className="mt-0.5 text-amber-300" size={18} />
              <div>
                <h3 className="text-sm font-semibold text-amber-100">Security Implementation Note</h3>
                <p className="mt-1 text-xs leading-relaxed text-amber-100/70">
                  This screen establishes the ATS role model and admin workflow in the React app. Production security should enforce the same permissions on the backend with hashed passwords, MFA, rate limiting, secure sessions, and audit logging.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {sensitiveSections.map(section => (
                    <span key={section.key} className="rounded-full border border-amber-500/20 px-2 py-1 text-[11px] text-amber-100/80">
                      {section.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>}

      {userAction && (
        <QuickActionModal
          title={
            userAction.type === 'create' ? 'Create New User' :
              userAction.type === 'superuser' ? 'SuperUser Details' :
                userAction.type === 'security' ? 'Security Settings' :
                  userAction.type === 'delete' ? 'Delete User' : 'Edit User'
          }
          subtitle={userAction.user ? `${userAction.user.name} - ${userAction.user.email}` : `${superProfile.name} - ${superProfile.email}`}
          onCancel={() => setUserAction(null)}
          onSave={() => {
            if (userAction.type === 'create') setActiveAdminPanel('accounts');
            if (userAction.type === 'edit' && userAction.user) setSelectedUserId(userAction.user.id);
            if (userAction.type === 'security') setActiveAdminPanel('security');
            if (userAction.type === 'superuser') setActiveAdminPanel('profile');
            if (userAction.type === 'delete' && userAction.user) deleteUser(userAction.user.id);
            setUserAction(null);
          }}
          saveLabel={userAction.type === 'delete' ? 'Delete' : 'Open / Update'}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <Info label="Role" value={userAction.user?.role ?? 'SuperUser'} />
            <Info label="Status" value={userAction.user ? (userAction.user.active ? 'Active' : 'Disabled') : 'Active'} />
            <Info label="Permissions" value={String(userAction.user?.permissions.length ?? allSections.length)} />
            <Info label="Security" value={userAction.user?.passwordBlocked ? 'Password blocked' : 'Password active'} />
          </div>
        </QuickActionModal>
      )}
    </div>
  );
}

function LabeledInput({ label, value, onChange, icon }: { label: string; value: string; onChange: (value: string) => void; icon?: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-400">{icon}{label}</span>
      <input value={value} onChange={event => onChange(event.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500/60" />
    </label>
  );
}

function PasswordInput({ label, value, show, onChange }: { label: string; value: string; show: boolean; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-400">{label}</span>
      <input type={show ? 'text' : 'password'} value={value} onChange={event => onChange(event.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500/60" />
    </label>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.03] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-sm text-white">{value}</p>
    </div>
  );
}
