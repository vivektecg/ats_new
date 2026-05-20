import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, MapPin, Users, Calendar, DollarSign, Building2, Send, CreditCard as Edit, CircleCheck as CheckCircle } from 'lucide-react';
import { jobs, submissions, candidates } from '@/lib/data';
import { cn } from '@/lib/utils';

const priorityColors: Record<string, string> = {
  'Critical': 'text-red-400 bg-red-500/10 border border-red-500/20',
  'High': 'text-orange-400 bg-orange-500/10 border border-orange-500/20',
  'Medium': 'text-yellow-400 bg-yellow-500/10 border border-yellow-500/20',
  'Low': 'text-slate-400 bg-white/5 border border-white/10',
};

const statusColors: Record<string, string> = {
  'Submitted': 'text-blue-400 bg-blue-500/10',
  'Client Review': 'text-violet-400 bg-violet-500/10',
  'Interview Scheduled': 'text-cyan-400 bg-cyan-500/10',
  'Offer Extended': 'text-emerald-400 bg-emerald-500/10',
  'Placed': 'text-amber-400 bg-amber-500/10',
  'Rejected': 'text-red-400 bg-red-500/10',
};

export default function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const job = jobs.find(j => j.id === id) ?? jobs[0];
  const jobSubs = submissions.filter(s => s.jobId === job.id);

  return (
    <div className="p-6">
      <button
        onClick={() => navigate('/jobs')}
        className="flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-5 transition-colors"
      >
        <ArrowLeft size={15} />
        Back to Jobs
      </button>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Main */}
        <div className="xl:col-span-2 space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#0d1729] border border-white/5 rounded-xl p-6"
          >
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h1 className="text-xl font-bold text-white">{job.title}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <Building2 size={13} className="text-slate-600" />
                  <button
                    onClick={() => navigate(`/clients/${job.clientId}`)}
                    className="text-sm text-blue-400 hover:underline"
                  >
                    {job.client}
                  </button>
                </div>
              </div>
              <div className="flex gap-2">
                <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full border', priorityColors[job.priority])}>
                  {job.priority}
                </span>
                <span className={cn(
                  'text-xs font-medium px-2.5 py-1 rounded-full',
                  job.status === 'Active' ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-400 bg-white/5'
                )}>
                  {job.status}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              {[
                { icon: MapPin, label: 'Location', value: job.location },
                { icon: DollarSign, label: 'Salary', value: job.salary },
                { icon: Users, label: 'Openings', value: `${job.filled}/${job.openings} filled` },
                { icon: Calendar, label: 'Close Date', value: job.closeDate },
              ].map(item => (
                <div key={item.label} className="bg-white/3 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                    <item.icon size={11} />
                    <span className="text-[10px] uppercase tracking-wider">{item.label}</span>
                  </div>
                  <p className="text-sm font-medium text-white">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="mb-5">
              <h3 className="text-sm font-semibold text-white mb-2">Job Description</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{job.description}</p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-white mb-2">Requirements</h3>
              <ul className="space-y-1.5">
                {job.requirements.map(req => (
                  <li key={req} className="flex items-center gap-2 text-sm text-slate-400">
                    <CheckCircle size={13} className="text-emerald-500 flex-shrink-0" />
                    {req}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex gap-3 mt-6">
              <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors">
                <Send size={14} />
                Submit Candidate
              </button>
              <button onClick={() => navigate(`/jobs/${job.id}/candidates`)} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors">
                <Users size={14} />
                View Ranked Candidates
              </button>
              <button className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-slate-300 text-sm px-4 py-2.5 rounded-xl transition-colors">
                <Edit size={14} />
                Edit Job
              </button>
            </div>
          </motion.div>

          {/* Submissions for this job */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-[#0d1729] border border-white/5 rounded-xl p-5"
          >
            <h3 className="text-sm font-semibold text-white mb-4">Submissions ({jobSubs.length})</h3>
            {jobSubs.length === 0 ? (
              <p className="text-sm text-slate-600 text-center py-6">No submissions yet for this job.</p>
            ) : (
              <div className="space-y-3">
                {jobSubs.map(s => (
                  <div
                    key={s.id}
                    onClick={() => navigate(`/candidates/${s.candidateId}`)}
                    className="flex items-center gap-3 p-3 bg-white/3 rounded-xl border border-white/5 cursor-pointer hover:bg-white/5 transition-colors group"
                  >
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                      {s.candidateName.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white group-hover:text-blue-400 transition-colors">{s.candidateName}</p>
                      <p className="text-xs text-slate-500">{s.submittedDate} · {s.recruiter}</p>
                      {s.notes && <p className="text-xs text-slate-600 mt-0.5 truncate">{s.notes}</p>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-semibold text-white">{s.rate}</p>
                      <span className={cn('text-[10px] px-2 py-0.5 rounded-full', statusColors[s.status])}>
                        {s.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-[#0d1729] border border-white/5 rounded-xl p-5"
          >
            <h3 className="text-sm font-semibold text-white mb-4">Job Details</h3>
            <div className="space-y-3">
              {[
                { label: 'Type', value: job.type },
                { label: 'Department', value: job.department },
                { label: 'Recruiter', value: job.recruiter },
                { label: 'Posted Date', value: job.postedDate },
                { label: 'Submissions', value: job.submissions.toString() },
              ].map(item => (
                <div key={item.label} className="flex justify-between text-xs">
                  <span className="text-slate-500">{item.label}</span>
                  <span className="text-white font-medium">{item.value}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Matching candidates suggestion */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-[#0d1729] border border-white/5 rounded-xl p-5"
          >
            <h3 className="text-sm font-semibold text-white mb-1">Suggested Candidates</h3>
            <p className="text-xs text-slate-500 mb-4">Based on skills match</p>
            <div className="space-y-3">
              {candidates.filter(c => c.status !== 'Placed' && c.status !== 'Rejected').slice(0, 3).map(c => (
                <div
                  key={c.id}
                  onClick={() => navigate(`/candidates/${c.id}`)}
                  className="flex items-center gap-3 cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                    {c.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white group-hover:text-blue-400 transition-colors truncate">{c.name}</p>
                    <p className="text-[10px] text-slate-500 truncate">{c.title}</p>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-semibold">87%</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
