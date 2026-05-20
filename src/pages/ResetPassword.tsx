import { FormEvent, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Eye, EyeOff, KeyRound, Lock, ShieldCheck } from 'lucide-react';
import { completePasswordReset } from '@/lib/auth';
import { BRAND_LOGO, BRAND_NAME, BRAND_TAGLINE } from '@/lib/brand';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const email = useMemo(() => searchParams.get('email') ?? '', [searchParams]);
  const token = useMemo(() => searchParams.get('token') ?? '', [searchParams]);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setNotice('');
    setError('');

    if (!email || !token) {
      setError('Missing reset email or token. Please request a fresh reset link.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    const result = completePasswordReset(email, token, password);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setNotice(result.message);
    window.setTimeout(() => navigate('/dashboard', { replace: true }), 700);
  };

  return (
    <div className="eventus-login-shell relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050816] p-6">
      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-[#0a1020]/90 p-6 shadow-2xl backdrop-blur-xl"
      >
        <div className="mb-6 flex items-center gap-3">
          <div className="eventus-sidebar-logo flex h-14 w-14 items-center justify-center rounded-2xl">
            <img src={BRAND_LOGO} alt={`${BRAND_NAME} logo`} className="h-full w-full rounded-2xl object-cover" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">{BRAND_NAME}</h1>
            <p className="text-xs font-bold text-cyan-300">{BRAND_TAGLINE}</p>
          </div>
        </div>

        <div className="mb-5 rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-3">
          <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-blue-100">
            <ShieldCheck size={16} />
            Create your new password
          </div>
          <p className="text-xs leading-relaxed text-blue-100/65">
            This link updates the ATS login for {email || 'the selected user'} and signs you in after success.
          </p>
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-400">New password</span>
            <div className="relative">
              <KeyRound size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={event => setPassword(event.target.value)}
                placeholder="Minimum 10 characters"
                className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-9 pr-10 text-sm text-white outline-none focus:border-blue-500/60"
              />
              <button type="button" onClick={() => setShowPassword(value => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-400">Confirm password</span>
            <div className="relative">
              <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={event => setConfirmPassword(event.target.value)}
                placeholder="Re-enter new password"
                className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-9 pr-4 text-sm text-white outline-none focus:border-blue-500/60"
              />
            </div>
          </label>
        </div>

        {error && <p className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>}
        {notice && <p className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">{notice}</p>}

        <button type="submit" className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-500">
          Update Password <ArrowRight size={15} />
        </button>
        <button type="button" onClick={() => navigate('/login')} className="mt-3 w-full rounded-xl border border-white/10 py-3 text-sm font-semibold text-slate-300 hover:bg-white/5">
          Back to login
        </button>
      </motion.form>
    </div>
  );
}
