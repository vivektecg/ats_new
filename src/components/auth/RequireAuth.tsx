import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LockKeyhole } from 'lucide-react';
import { canAccess, resolveSession, sectionForPath } from '@/lib/auth';

export function RequireAuth() {
  const location = useLocation();
  const navigate = useNavigate();
  const session = resolveSession();

  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  const section = sectionForPath(location.pathname);
  if (!canAccess(session, section)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050816] p-6">
        <div className="max-w-md rounded-lg border border-red-500/20 bg-[#0d1729] p-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10 text-red-300">
            <LockKeyhole size={22} />
          </div>
          <h1 className="text-lg font-bold text-white">Access Restricted</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            Your user role does not have permission to open this ATS section. Contact SuperUser to request access.
          </p>
          <button onClick={() => navigate('/dashboard')} className="mt-5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
