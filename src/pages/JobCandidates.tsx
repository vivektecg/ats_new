import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, AlertTriangle, BadgeCheck, BriefcaseBusiness, GitBranch, ShieldCheck, Star, Users } from 'lucide-react';
import { candidates, jobs, submissions } from '@/lib/data';
import { getAllCandidates, getAllJobs, getAllSubmissions } from '@/lib/localRecords';
import { createCandidateJobSubmission } from '@/lib/submissionStore';
import { cn } from '@/lib/utils';

function normalized(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9+.# ]/g, ' ');
}

function skillMatch(candidateSkills: string[], requirements: string[]) {
  const candidateText = normalized(candidateSkills.join(' '));
  const matched = requirements.filter(requirement =>
    normalized(requirement).split(/\s+/).filter(Boolean).some(term => term.length > 2 && candidateText.includes(term))
  );
  return {
    matched,
    missing: requirements.filter(requirement => !matched.includes(requirement)),
    score: Math.round((matched.length / Math.max(requirements.length, 1)) * 100),
  };
}

export default function JobCandidates() {
  const { id } = useParams();
  const navigate = useNavigate();
  const allJobs = getAllJobs().length ? getAllJobs() : jobs;
  const allCandidates = getAllCandidates().length ? getAllCandidates() : candidates;
  const allSubmissions = getAllSubmissions().length ? getAllSubmissions() : submissions;
  const job = allJobs.find(item => item.id === id) ?? allJobs[0];
  const [notice, setNotice] = useState('');

  const rankedCandidates = useMemo(() => {
    return allCandidates
      .map(candidate => {
        const skills = skillMatch(candidate.skills, job.requirements);
        const experienceScore = Math.min(100, candidate.experience * 12);
        const score = Math.round(skills.score * 0.62 + experienceScore * 0.28 + candidate.rating * 2);
        const priorSubmission = allSubmissions.find(submission => submission.candidateId === candidate.id && submission.jobId === job.id);
        const sameClientSubmission = allSubmissions.find(submission => submission.candidateId === candidate.id && submission.clientId === job.clientId);
        const stage = priorSubmission
          ? priorSubmission.status === 'Offer Extended' ? 'Offer Released' : priorSubmission.status
          : score >= 80 ? 'AI Validated' : score >= 65 ? 'Interested' : 'Sourced';

        return { candidate, skills, score, priorSubmission, sameClientSubmission, stage };
      })
      .sort((first, second) => second.score - first.score);
  }, [allCandidates, allSubmissions, job]);

  async function submitCandidate(candidate: typeof allCandidates[number]) {
    const result = await createCandidateJobSubmission(candidate, job, 'Submitted from job-wise candidate ranking.');
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    navigate('/submissions');
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <button
        onClick={() => navigate(`/jobs/${job.id}`)}
        className="mb-5 flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-white"
      >
        <ArrowLeft size={15} />
        Back to Job
      </button>

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-300">
            <BriefcaseBusiness size={14} />
            Job-wise candidate ranking
          </div>
          <h1 className="text-2xl font-bold text-white">{job.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{job.client} · {job.location} · {job.requirements.length} JD requirements connected</p>
        </div>
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          AI scores are recruiter guidance only. Final submission and rejection decisions must be made by a human recruiter.
        </div>
      </div>

      {notice && (
        <div className="mb-5 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3">
          <div className="flex items-start gap-3">
            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-amber-300" />
            <div>
              <h2 className="text-sm font-semibold text-amber-100">Duplicate Prevention</h2>
              <p className="mt-1 text-sm text-amber-100">{notice}</p>
              <p className="mt-2 text-xs text-amber-200/80">
                The same candidate cannot be submitted to the same job more than once, even from another ATS user account.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mb-5 grid gap-4 md:grid-cols-4">
        {[
          { label: 'Ranked candidates', value: rankedCandidates.length, icon: Users, tone: 'text-blue-300 bg-blue-500/10' },
          { label: 'Submitted to job', value: rankedCandidates.filter(item => item.priorSubmission).length, icon: GitBranch, tone: 'text-violet-300 bg-violet-500/10' },
          { label: 'Same client alerts', value: rankedCandidates.filter(item => !item.priorSubmission && item.sameClientSubmission).length, icon: AlertTriangle, tone: 'text-amber-300 bg-amber-500/10' },
          { label: 'AI validated', value: rankedCandidates.filter(item => item.stage === 'AI Validated').length, icon: ShieldCheck, tone: 'text-emerald-300 bg-emerald-500/10' },
        ].map(metric => (
          <div key={metric.label} className="rounded-lg border border-white/5 bg-[#0d1729] p-4">
            <div className={cn('mb-3 flex h-9 w-9 items-center justify-center rounded-lg', metric.tone)}>
              <metric.icon size={17} />
            </div>
            <p className="text-2xl font-bold text-white">{metric.value}</p>
            <p className="text-xs text-slate-500">{metric.label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-white/5 bg-[#0d1729]">
        <div className="grid grid-cols-[56px_minmax(320px,1.7fr)_110px_150px_minmax(260px,1fr)] gap-3 border-b border-white/5 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          <span>Rank</span>
          <span>Candidate</span>
          <span>Score</span>
          <span>Stage</span>
          <span>Submission control</span>
        </div>
        <div className="divide-y divide-white/5">
          {rankedCandidates.map((item, index) => (
            <motion.div
              key={item.candidate.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              className="grid grid-cols-[56px_minmax(320px,1.7fr)_110px_150px_minmax(260px,1fr)] gap-3 px-4 py-2.5"
            >
              <div className="flex items-center">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-xs font-bold text-white">#{index + 1}</span>
              </div>
              <button onClick={() => navigate(`/candidates/${item.candidate.id}`)} className="min-w-0 text-left">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="font-semibold text-white hover:text-blue-300">{item.candidate.name}</p>
                  <span className="text-xs text-slate-500">{item.candidate.title}</span>
                  <span className="text-xs text-slate-600">{item.candidate.location}</span>
                  <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-200">
                    {item.skills.matched.length} matched
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] text-slate-400">
                    {item.skills.missing.length} missing
                  </span>
                </div>
              </button>
              <div className="flex items-center">
                <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold',
                  item.score >= 80 ? 'bg-emerald-500/10 text-emerald-300' :
                    item.score >= 65 ? 'bg-blue-500/10 text-blue-300' :
                      'bg-amber-500/10 text-amber-300'
                )}>
                  <Star size={13} />
                  {item.score}%
                </span>
              </div>
              <div className="flex items-center">
                <span className="inline-flex rounded-full border border-white/10 bg-[#070d18] px-2.5 py-1 text-xs text-slate-300">
                  {item.stage}
                </span>
              </div>
              <div className="flex items-center text-xs">
                {item.priorSubmission ? (
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-emerald-100">
                    <BadgeCheck size={14} className="flex-shrink-0" />
                    <span className="truncate">Already submitted on {item.priorSubmission.submittedDate}</span>
                  </div>
                ) : item.sameClientSubmission ? (
                  <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-amber-100">
                    <AlertTriangle size={14} className="flex-shrink-0" />
                    <span className="truncate">Already submitted to {job.client}</span>
                  </div>
                ) : (
                  <button onClick={() => submitCandidate(item.candidate)} className="rounded-lg bg-blue-600 px-3 py-2 font-semibold text-white hover:bg-blue-500">
                    Submit to Job
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
