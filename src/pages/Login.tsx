import { FormEvent, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Copyright,
  Eye,
  EyeOff,
  IdCard,
  KeyRound,
  Lock,
  Mail,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { BeamBackground } from '@/components/ui/beam-background';
import {
  allSections,
  canAccess,
  getSuperUserProfile,
  getUsers,
  makeSuperUserSession,
  requestPasswordReset,
  saveSession,
  sectionForPath,
  verifyPassword,
  verifySuperUserPassword,
} from '@/lib/auth';
import { BRAND_LEGAL_NAME, BRAND_LOGO, BRAND_NAME, BRAND_TAGLINE } from '@/lib/brand';
import { cn } from '@/lib/utils';

const clientLogo = (label: string, primary: string, secondary: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${primary}"/>
          <stop offset="100%" stop-color="${secondary}"/>
        </linearGradient>
      </defs>
      <rect width="96" height="96" rx="24" fill="#0f172a"/>
      <rect x="7" y="7" width="82" height="82" rx="21" fill="url(#g)" opacity="0.9"/>
      <path d="M22 58c15 14 38 14 52 0" stroke="#ffffff" stroke-width="7" stroke-linecap="round" opacity="0.38" fill="none"/>
      <circle cx="31" cy="34" r="8" fill="#ffffff" opacity="0.78"/>
      <circle cx="65" cy="34" r="8" fill="#ffffff" opacity="0.54"/>
      <text x="48" y="57" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" font-weight="800" fill="#ffffff">${label}</text>
    </svg>
  `)}`;

const aiGeneratedClients = [
  { name: 'AstraBridge Systems', logo: clientLogo('AB', '#22d3ee', '#2563eb') },
  { name: 'Nexora Talent Cloud', logo: clientLogo('NT', '#a78bfa', '#2563eb') },
  { name: 'BlueHarbor Federal', logo: clientLogo('BF', '#60a5fa', '#14b8a6') },
  { name: 'QuantumPath Staffing', logo: clientLogo('QP', '#34d399', '#0ea5e9') },
  { name: 'CivicCore Solutions', logo: clientLogo('CC', '#818cf8', '#06b6d4') },
  { name: 'BrightLayer Partners', logo: clientLogo('BL', '#f472b6', '#6366f1') },
  { name: 'VertexWorks Consulting', logo: clientLogo('VW', '#38bdf8', '#8b5cf6') },
];

type LoginMode = 'admin' | 'user';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';
  const [mode, setMode] = useState<LoginMode>('admin');
  const superUserProfile = getSuperUserProfile();
  const [adminEmail, setAdminEmail] = useState(superUserProfile.email);
  const [adminPassword, setAdminPassword] = useState('');
  const [userIdentifier, setUserIdentifier] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [resetNotice, setResetNotice] = useState('');
  const [resetLink, setResetLink] = useState('');

  const switchMode = (nextMode: LoginMode) => {
    setMode(nextMode);
    setError('');
    setResetNotice('');
    setResetLink('');
    setShowPass(false);
  };

  const sendPasswordReset = (targetEmail?: string, requestedBy = 'self-service') => {
    const email = (targetEmail || resetEmail || userIdentifier || superUserProfile.email).trim().toLowerCase();
    const result = requestPasswordReset(email, requestedBy);
    setResetNotice(result.message);
    setResetLink(result.resetUrl ?? '');
    if (!result.ok) setError(result.message);
    else setError('');
  };

  const finishLogin = async (targetPath: string) => {
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 450));
    setLoading(false);
    navigate(targetPath === '/login' ? '/dashboard' : targetPath, { replace: true });
  };

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    if (mode === 'admin') {
      const normalizedAdminEmail = adminEmail.trim().toLowerCase();
      if (normalizedAdminEmail !== superUserProfile.email.toLowerCase() || !verifySuperUserPassword(adminPassword)) {
        setError('Invalid SuperUser email or password.');
        return;
      }
      saveSession(makeSuperUserSession());
      await finishLogin(from);
      return;
    }

    const identifier = userIdentifier.trim().toLowerCase();
    const user = getUsers().find(
      savedUser => savedUser.email.toLowerCase() === identifier || savedUser.id.toLowerCase() === identifier
    );
    if (!user || !verifyPassword(user.passwordHash, userPassword)) {
      setError('Invalid user ID/email or password.');
      return;
    }
    if (!user.active) {
      setError('This user account is disabled. Contact SuperUser.');
      return;
    }
    if (user.passwordBlocked) {
      setError('This user password is blocked. Contact SuperUser for a new temporary password.');
      return;
    }
    if (user.mustChangePassword) {
      sendPasswordReset(user.email, 'temporary-password-login');
      setError('A password update is required. A reset link has been queued for this user email.');
      return;
    }

    const session = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
      loginAt: new Date().toISOString(),
      avatarUrl: user.avatarUrl,
    };
    saveSession(session);

    const requestedSection = sectionForPath(from);
    const fallbackPath = allSections.find(section => user.permissions.includes(section.key))?.path ?? '/dashboard';
    await finishLogin(canAccess(session, requestedSection) ? from : fallbackPath);
  };

  return (
    <div className="eventus-login-shell relative min-h-screen overflow-hidden flex bg-[#050816]">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-[#050816] items-center justify-center">
        <div className="login-spotlight" />
        <BeamBackground className="opacity-60" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(59,130,246,0.06)_1px,transparent_1px),linear-gradient(180deg,rgba(59,130,246,0.04)_1px,transparent_1px)] bg-[size:42px_42px] [mask-image:radial-gradient(circle_at_center,black,transparent_78%)]" />
        <motion.div
          className="absolute left-12 top-10 flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-200"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,0.8)]" />
          Secure ATS workspace online
        </motion.div>

        <div className="relative z-10 flex h-full w-full max-w-[460px] items-center justify-center px-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="relative w-full"
          >
            <div className="absolute -inset-6 rounded-[40px] border border-blue-400/10 bg-white/[0.015] login-depth-glow" />
            <div className="relative rounded-[32px] border border-white/10 bg-[#0a1020]/80 p-7 shadow-2xl backdrop-blur-xl">
              <div className="eventus-login-logo-stage mx-auto mb-8">
                <div className="login-logo-orbit login-logo-orbit-one" />
                <div className="login-logo-orbit login-logo-orbit-two" />
                <div className="login-logo-scan" />
                <div className="eventus-logo-core">
                  <img src={BRAND_LOGO} alt={`${BRAND_NAME} logo`} />
                </div>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.55 }}
                className="text-center"
              >
                <h1 className="eventus-login-title text-center text-4xl font-black leading-tight text-white">
                  <motion.span
                    className="login-wordmark"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1.05, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {BRAND_NAME}
                  </motion.span>
                </h1>
                <p className="mt-3 text-sm font-bold text-cyan-200">{BRAND_TAGLINE}</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7, duration: 0.7 }}
                className="gemini-login-panel mt-8"
              >
                <div className="gemini-aurora" />
                <div className="gemini-orb gemini-orb-one" />
                <div className="gemini-orb gemini-orb-two" />
                <div className="gemini-orb gemini-orb-three" />
                <div className="gemini-beam gemini-beam-one" />
                <div className="gemini-beam gemini-beam-two" />
                <div className="gemini-beam gemini-beam-three" />
                <div className="gemini-star-field" />
                <div className="relative z-10 flex h-full items-center justify-center">
                  <div className="gemini-center-mark">
                    <span className="gemini-ring" />
                    <span className="gemini-spark" />
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 xl:p-12 relative">
        <div className="absolute inset-0 bg-[#080d1a]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(59,130,246,0.18),transparent_44%)]" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-lg relative z-10"
        >
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="eventus-sidebar-logo w-11 h-11 rounded-xl flex items-center justify-center">
              <img src={BRAND_LOGO} alt={`${BRAND_NAME} logo`} className="h-full w-full rounded-xl object-cover" />
            </div>
            <span className="text-lg font-bold leading-tight text-white">{BRAND_NAME}</span>
          </div>

          <div className="mb-6">
            <div className="mb-4 flex items-center gap-3">
              <motion.div
                className="eventus-sidebar-logo flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg shadow-blue-950/50"
                animate={{ rotate: [0, 3, 0, -3, 0], scale: [1, 1.04, 1] }}
                transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
              >
                <img src={BRAND_LOGO} alt={`${BRAND_NAME} logo`} className="h-full w-full rounded-2xl object-cover" />
              </motion.div>
              <div>
                <h2 className="text-2xl font-black leading-tight text-white">
                  <motion.span
                    className="login-wordmark"
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.8, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {BRAND_NAME}
                  </motion.span>
                </h2>
                <p className="text-xs font-bold text-cyan-300">{BRAND_TAGLINE}</p>
              </div>
            </div>
            <p className="text-sm text-slate-500">Choose your access type to enter the staffing command center.</p>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-1">
            {[
              { key: 'admin' as const, label: 'Admin Login', icon: ShieldCheck },
              { key: 'user' as const, label: 'User Login', icon: UserRound },
            ].map(option => (
              <button
                key={option.key}
                type="button"
                onClick={() => switchMode(option.key)}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors',
                  mode === option.key ? 'bg-blue-600 text-white shadow-lg shadow-blue-950/40' : 'text-slate-400 hover:bg-white/5 hover:text-white'
                )}
              >
                <option.icon size={15} />
                {option.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {mode === 'admin' ? (
              <>
                <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-2.5">
                  <p className="text-xs font-semibold text-blue-200">
                    SuperUser administrator
                  </p>
                  <p className="mt-0.5 text-xs text-blue-100/60">
                    Only this role can create user credentials and manage protected ATS sections.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">SuperUser Email</label>
                  <div className="relative">
                    <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      inputMode="email"
                      autoComplete="username"
                      value={adminEmail}
                      onChange={event => setAdminEmail(event.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/60 focus:bg-white/8 transition-all"
                      placeholder={superUserProfile.email}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">SuperUser Password</label>
                  <div className="relative">
                    <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={adminPassword}
                      onChange={event => setAdminPassword(event.target.value)}
                      placeholder="Enter SuperUser password"
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-10 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/60 focus:bg-white/8 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(value => !value)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">User ID or Email</label>
                  <div className="relative">
                    <IdCard size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      autoComplete="username"
                      value={userIdentifier}
                      onChange={event => setUserIdentifier(event.target.value)}
                      placeholder="user-id or you@company.com"
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/60 focus:bg-white/8 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
                  <div className="relative">
                    <KeyRound size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={userPassword}
                      onChange={event => setUserPassword(event.target.value)}
                      placeholder="Enter your password"
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-10 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/60 focus:bg-white/8 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(value => !value)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              </>
            )}

            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-all text-sm mt-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>Sign In <ArrowRight size={15} /></>
              )}
            </button>
          </form>

          <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <p className="mb-2 text-xs font-semibold text-slate-300">Password reset by email</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                inputMode="email"
                value={resetEmail}
                onChange={event => setResetEmail(event.target.value)}
                placeholder={mode === 'admin' ? superUserProfile.email : 'user-id or user@company.com'}
                className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-blue-500/60"
              />
              <button
                type="button"
                onClick={() => sendPasswordReset()}
                className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-200 hover:bg-blue-500/20"
              >
                Email reset link
              </button>
            </div>
            {resetNotice && <p className="mt-2 text-xs text-emerald-300">{resetNotice}</p>}
            {resetLink && (
              <a href={resetLink} className="mt-2 block break-all text-[11px] text-cyan-300 hover:underline">
                Local preview reset link: {resetLink}
              </a>
            )}
          </div>

          <div className="mt-8 pt-6 border-t border-white/5 text-center">
            <p className="text-xs text-slate-600 leading-relaxed">
              This is a private, internal system for authorized {BRAND_NAME} users only.<br />
              Unauthorized access is strictly prohibited.
            </p>
            <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.035] p-4 text-left">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-cyan-400/25 bg-cyan-400/10 text-cyan-200 shadow-[0_0_24px_rgba(34,211,238,0.16)]">
                  <Copyright size={24} strokeWidth={1.8} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">Copyright Notice & Usage Advisory</p>
                  <p className="text-[11px] text-slate-500">© 2026 {BRAND_LEGAL_NAME} All Rights Reserved.</p>
                </div>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500">
                The content, design, functionality, and materials available within this application—including but not limited to
                text, graphics, logos, job postings, candidate data, software code, and proprietary workflows—are the intellectual
                property of {BRAND_LEGAL_NAME} and are protected by applicable copyright, trademark, and other intellectual property laws.
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#050816]/86 py-3 backdrop-blur-xl">
        <div className="login-client-marquee">
          <div className="login-client-track">
            {[...aiGeneratedClients, ...aiGeneratedClients].map((client, index) => (
              <div key={`${client.name}-${index}`} className="login-client-chip">
                <img src={client.logo} alt={`${client.name} generated logo`} />
                <span>{client.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
