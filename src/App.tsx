import './App.css';
import { Suspense, lazy, useEffect, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { hydrateAtsCollections } from '@/lib/atsApi';

const Login = lazy(() => import('@/pages/Login'));
const ResetPassword = lazy(() => import('@/pages/ResetPassword'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Candidates = lazy(() => import('@/pages/Candidates'));
const CandidateProfile = lazy(() => import('@/pages/CandidateProfile'));
const Jobs = lazy(() => import('@/pages/Jobs'));
const JobDetail = lazy(() => import('@/pages/JobDetail'));
const JobCandidates = lazy(() => import('@/pages/JobCandidates'));
const Clients = lazy(() => import('@/pages/Clients'));
const ClientForm = lazy(() => import('@/pages/ClientForm'));
const ClientProfile = lazy(() => import('@/pages/ClientProfile'));
const Vendors = lazy(() => import('@/pages/Vendors'));
const Submissions = lazy(() => import('@/pages/Submissions'));
const Offers = lazy(() => import('@/pages/Offers'));
const Onboarding = lazy(() => import('@/pages/Onboarding'));
const BulkImport = lazy(() => import('@/pages/BulkImport'));
const EmailCenter = lazy(() => import('@/pages/EmailCenter'));
const Documents = lazy(() => import('@/pages/Documents'));
const Pipeline = lazy(() => import('@/pages/Pipeline'));
const Calendar = lazy(() => import('@/pages/Calendar'));
const Tasks = lazy(() => import('@/pages/Tasks'));
const Automations = lazy(() => import('@/pages/Automations'));
const Compliance = lazy(() => import('@/pages/Compliance'));
const ComplianceManagement = lazy(() => import('@/pages/ComplianceManagement'));
const Reports = lazy(() => import('@/pages/Reports'));
const Integrations = lazy(() => import('@/pages/Integrations'));
const AIAssistant = lazy(() => import('@/pages/AIAssistant'));
const UserManagement = lazy(() => import('@/pages/UserManagement'));

function RouteLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050816] px-6">
      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-slate-300 shadow-2xl">
        <Loader2 size={16} className="animate-spin text-blue-400" />
        <span>Loading ATS section...</span>
      </div>
    </div>
  );
}

function withSuspense(element: ReactNode) {
  return <Suspense fallback={<RouteLoader />}>{element}</Suspense>;
}

export default function App() {
  useEffect(() => {
    void hydrateAtsCollections();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={withSuspense(<Login />)} />
        <Route path="/reset-password" element={withSuspense(<ResetPassword />)} />
        <Route element={<RequireAuth />}>
          <Route path="/" element={withSuspense(<Layout />)}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={withSuspense(<Dashboard />)} />
            <Route path="candidates" element={withSuspense(<Candidates />)} />
            <Route path="candidates/new" element={withSuspense(<Candidates />)} />
            <Route path="candidates/:id/resume-validation" element={withSuspense(<CandidateProfile />)} />
            <Route path="candidates/:id" element={withSuspense(<CandidateProfile />)} />
            <Route path="jobs" element={withSuspense(<Jobs />)} />
            <Route path="jobs/new" element={withSuspense(<Jobs />)} />
            <Route path="jobs/:id/candidates" element={withSuspense(<JobCandidates />)} />
            <Route path="jobs/:id" element={withSuspense(<JobDetail />)} />
            <Route path="clients" element={withSuspense(<Clients />)} />
            <Route path="clients/new" element={withSuspense(<ClientForm />)} />
            <Route path="clients/:id" element={withSuspense(<ClientProfile />)} />
            <Route path="vendors" element={withSuspense(<Vendors />)} />
            <Route path="submissions" element={withSuspense(<Submissions />)} />
            <Route path="offers" element={withSuspense(<Offers />)} />
            <Route path="onboarding" element={withSuspense(<Onboarding />)} />
            <Route path="imports" element={withSuspense(<BulkImport />)} />
            <Route path="emails" element={withSuspense(<EmailCenter />)} />
            <Route path="documents" element={withSuspense(<Documents />)} />
            <Route path="pipeline" element={withSuspense(<Pipeline />)} />
            <Route path="calendar" element={withSuspense(<Calendar />)} />
            <Route path="interviews" element={withSuspense(<Calendar />)} />
            <Route path="tasks" element={withSuspense(<Tasks />)} />
            <Route path="automations" element={withSuspense(<Automations />)} />
            <Route path="compliance" element={withSuspense(<Compliance />)} />
            <Route path="compliance-management" element={withSuspense(<ComplianceManagement />)} />
            <Route path="reports" element={withSuspense(<Reports />)} />
            <Route path="integrations" element={withSuspense(<Integrations />)} />
            <Route path="ai-assistant" element={withSuspense(<AIAssistant />)} />
            <Route path="ai/resume-match" element={withSuspense(<AIAssistant />)} />
            <Route path="ai/boolean-generator" element={withSuspense(<AIAssistant />)} />
            <Route path="settings" element={<Navigate to="/users" replace />} />
            <Route path="users" element={withSuspense(<UserManagement />)} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
