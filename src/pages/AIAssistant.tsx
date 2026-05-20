import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BrainCircuit,
  Briefcase,
  FileQuestion,
  FileText,
  Lightbulb,
  MessagesSquare,
  Search,
  Sparkles,
  Target,
  UserCheck,
} from 'lucide-react';
import { QuickActionModal } from '@/components/ats/QuickActionModal';
import { candidates, jobs, submissions, tasks } from '@/lib/data';
import { getAllCandidates, getAllJobs } from '@/lib/localRecords';
import { cn } from '@/lib/utils';
import type { Candidate, Job } from '@/lib/types';

type AIModuleKey =
  | 'resume-parser'
  | 'jd-parser'
  | 'match-engine'
  | 'boolean-generator'
  | 'screening-questions'
  | 'resume-improvement'
  | 'client-submission'
  | 'recruiter-assistant';

const emptyJob: Job = {
  id: 'no-job',
  title: 'No job selected',
  client: 'Client pending',
  clientId: '',
  location: '',
  type: 'Contract',
  status: 'Active',
  priority: 'Medium',
  salary: 'Open',
  openings: 0,
  filled: 0,
  recruiter: 'SuperUser',
  description: 'Add a job to run JD and match modules.',
  requirements: [],
  postedDate: new Date().toISOString().slice(0, 10),
  closeDate: '',
  submissions: 0,
  department: 'Recruiting',
};

type AIOutput = {
  title: string;
  summary: string;
  sections: Array<{ label: string; value: string | string[] }>;
};

const modules: Array<{ key: AIModuleKey; title: string; subtitle: string; icon: typeof Sparkles; tone: string }> = [
  { key: 'resume-parser', title: 'Resume Parser', subtitle: 'Extract candidate profile data', icon: FileText, tone: 'text-blue-300 bg-blue-500/10 border-blue-500/20' },
  { key: 'jd-parser', title: 'JD Parser', subtitle: 'Extract job requirements', icon: Briefcase, tone: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20' },
  { key: 'match-engine', title: 'Resume-JD Match', subtitle: 'Score fit and gaps', icon: Target, tone: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20' },
  { key: 'boolean-generator', title: 'Boolean Generator', subtitle: 'LinkedIn, Dice, Google X-Ray', icon: Search, tone: 'text-violet-300 bg-violet-500/10 border-violet-500/20' },
  { key: 'screening-questions', title: 'Screening Questions', subtitle: 'Technical, domain, visa, rate', icon: FileQuestion, tone: 'text-amber-300 bg-amber-500/10 border-amber-500/20' },
  { key: 'resume-improvement', title: 'Resume Improvements', subtitle: 'Client-ready resume guidance', icon: Lightbulb, tone: 'text-orange-300 bg-orange-500/10 border-orange-500/20' },
  { key: 'client-submission', title: 'Client Submission', subtitle: 'Submission-ready summary', icon: UserCheck, tone: 'text-teal-300 bg-teal-500/10 border-teal-500/20' },
  { key: 'recruiter-assistant', title: 'Recruiter Assistant', subtitle: 'Ask the ATS questions', icon: MessagesSquare, tone: 'text-fuchsia-300 bg-fuchsia-500/10 border-fuchsia-500/20' },
];

const quickCandidateActions: Array<{ key: AIModuleKey; label: string; icon: typeof Sparkles; tone: string }> = [
  { key: 'resume-parser', label: 'Resume Parser', icon: FileText, tone: 'text-blue-300 hover:bg-blue-500/10 hover:border-blue-500/30' },
  { key: 'jd-parser', label: 'JD Parser', icon: Briefcase, tone: 'text-cyan-300 hover:bg-cyan-500/10 hover:border-cyan-500/30' },
  { key: 'match-engine', label: 'Resume-JD Match', icon: Target, tone: 'text-emerald-300 hover:bg-emerald-500/10 hover:border-emerald-500/30' },
  { key: 'boolean-generator', label: 'Boolean String', icon: Search, tone: 'text-violet-300 hover:bg-violet-500/10 hover:border-violet-500/30' },
  { key: 'screening-questions', label: 'Screening Questions', icon: FileQuestion, tone: 'text-amber-300 hover:bg-amber-500/10 hover:border-amber-500/30' },
  { key: 'resume-improvement', label: 'Resume Improvement', icon: Lightbulb, tone: 'text-orange-300 hover:bg-orange-500/10 hover:border-orange-500/30' },
  { key: 'client-submission', label: 'Client Submission', icon: UserCheck, tone: 'text-teal-300 hover:bg-teal-500/10 hover:border-teal-500/30' },
];

const candidateStatusTone: Record<string, string> = {
  New: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
  Screening: 'bg-violet-500/10 text-violet-300 border-violet-500/20',
  Interview: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',
  Offer: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  Placed: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  Rejected: 'bg-red-500/10 text-red-300 border-red-500/20',
  'On Hold': 'bg-slate-500/10 text-slate-300 border-slate-500/20',
};

const recruiterPrompts = [
  'Show best candidates for this job',
  'Which candidate is missing PMP?',
  'Generate client submission email',
  'Find candidates with state client experience',
  'Show candidates submitted to Charter',
  'Which jobs need follow-up today?',
  'Create Boolean string for this role',
  'Compare these 3 candidates',
];

const domainTerms = ['Fintech', 'Healthcare', 'Cybersecurity', 'Defense', 'Cloud', 'Data', 'Analytics', 'SaaS', 'State client', 'Federal'];
const toolTerms = ['React', 'TypeScript', 'Node.js', 'AWS', 'Kubernetes', 'Terraform', 'Python', 'SQL', 'Figma', 'Spark', 'Kafka', 'PostgreSQL', 'Salesforce'];

function unique(values: string[]) {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))];
}

function normalized(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9+.# ]/g, ' ');
}

function candidateMatchesRequirement(candidate: typeof candidates[number], requirement: string) {
  const haystack = normalized([candidate.title, candidate.summary, candidate.skills.join(' ')].join(' '));
  const req = normalized(requirement);
  return req.split(/\s+/).filter(Boolean).some(term => term.length > 2 && haystack.includes(term));
}

function matchScore(candidate: typeof candidates[number], job: typeof jobs[number]) {
  const matched = job.requirements.filter(requirement => candidateMatchesRequirement(candidate, requirement));
  const skillMatch = Math.round((matched.length / Math.max(job.requirements.length, 1)) * 100);
  const experienceRequirement = Number(job.requirements.join(' ').match(/(\d+)\+?\s*years?/i)?.[1] ?? 5);
  const experienceMatch = Math.min(100, Math.round((candidate.experience / experienceRequirement) * 100));
  const titleWords = normalized(job.title).split(/\s+/).filter(word => word.length > 3);
  const domainMatch = titleWords.some(word => normalized(candidate.title).includes(word)) ? 90 : 68;
  return Math.round(skillMatch * 0.5 + experienceMatch * 0.3 + domainMatch * 0.2);
}

function bestJobForCandidate(candidate: typeof candidates[number]) {
  return getAllJobs()
    .map(job => ({ job, score: matchScore(candidate, job) }))
    .sort((first, second) => second.score - first.score)[0] ?? { job: emptyJob, score: 0 };
}

function recommendation(score: number) {
  if (score >= 85) return 'Strong Match';
  if (score >= 75) return 'Good Match';
  if (score >= 62) return 'Average Match';
  if (score >= 48) return 'Weak Match';
  return 'Not Recommended';
}

function buildBoolean(title: string, skills: string[], platform: string) {
  const titles = title.split(/[/-]/).map(part => part.trim()).filter(Boolean).slice(0, 3).map(part => `"${part}"`);
  const skillTerms = skills.slice(0, 6).map(skill => `"${skill}"`).join(' AND ');
  const titleTerms = titles.length ? titles.join(' OR ') : `"${title}"`;
  if (platform === 'Google X-Ray') return `site:linkedin.com/in (${titleTerms}) (${skillTerms}) -jobs -hiring`;
  if (platform === 'GitHub') return `(${skillTerms}) (${titleTerms}) site:github.com`;
  if (platform === 'Indeed') return `(${titleTerms}) AND (${skillTerms}) AND (resume OR profile)`;
  return `(${titleTerms}) AND (${skillTerms})`;
}

function parseResume(candidate: typeof candidates[number]): AIOutput {
  const best = bestJobForCandidate(candidate);
  const tools = candidate.skills.filter(skill => toolTerms.some(tool => normalized(tool) === normalized(skill)));
  const domains = unique(domainTerms.filter(term => normalized(candidate.summary + ' ' + candidate.title).includes(normalized(term))));
  return {
    title: `Resume Parser: ${candidate.name}`,
    summary: 'Structured resume profile extracted from the current candidate record.',
    sections: [
      { label: 'Name', value: candidate.name },
      { label: 'Email', value: candidate.email },
      { label: 'Phone', value: candidate.phone },
      { label: 'Location', value: candidate.location },
      { label: 'LinkedIn', value: candidate.linkedin ?? 'LinkedIn URL not found' },
      { label: 'Skills', value: candidate.skills },
      { label: 'Job titles', value: [candidate.title] },
      { label: 'Companies', value: ['Current employer not listed in seed resume', `${best.job.client} target client fit`] },
      { label: 'Experience', value: `${candidate.experience}+ years total experience` },
      { label: 'Education', value: candidate.summary.toLowerCase().includes('phd') ? 'PhD mentioned in profile summary' : 'Education details need recruiter confirmation' },
      { label: 'Certifications', value: candidate.skills.filter(skill => /cert|cissp|aws|salesforce/i.test(skill)).length ? candidate.skills.filter(skill => /cert|cissp|aws|salesforce/i.test(skill)) : ['Certifications not clearly listed'] },
      { label: 'Projects', value: [`Most relevant project evidence: ${candidate.summary}`] },
      { label: 'Tools', value: tools.length ? tools : candidate.skills.slice(0, 4) },
      { label: 'Domains', value: domains.length ? domains : ['Domain requires recruiter validation'] },
      { label: 'Work authorization', value: 'Work authorization requires candidate confirmation' },
    ],
  };
}

function parseJD(job: typeof jobs[number]): AIOutput {
  const mandatory = job.requirements.slice(0, 3);
  const preferred = job.requirements.slice(3);
  const years = job.requirements.join(' ').match(/(\d+)\+?\s*years?/i)?.[0] ?? 'Experience requirement not explicit';
  const keywords = unique([...job.title.split(/\s+/), ...job.requirements, job.department, job.client]).slice(0, 14);
  return {
    title: `JD Parser: ${job.title}`,
    summary: 'Structured job requirement profile extracted from the active job order.',
    sections: [
      { label: 'Job title', value: job.title },
      { label: 'Mandatory skills', value: mandatory },
      { label: 'Preferred skills', value: preferred.length ? preferred : ['Preferred skills not separately listed'] },
      { label: 'Years of experience', value: years },
      { label: 'Certifications', value: job.requirements.filter(item => /cert|cissp|ccsp|aws/i.test(item)).length ? job.requirements.filter(item => /cert|cissp|ccsp|aws/i.test(item)) : ['No certification explicitly required'] },
      { label: 'Education', value: 'Education requirement not explicit in seed JD' },
      { label: 'Location', value: job.location },
      { label: 'Visa restrictions', value: job.client === 'SecureBase Corp' ? 'US Citizen likely required for cleared/federal roles' : 'Visa restrictions require client confirmation' },
      { label: 'Responsibilities', value: [job.description] },
      { label: 'Keywords', value: keywords },
      { label: 'Domain', value: job.department },
      { label: 'Screening questions', value: [
        `How many years of hands-on experience do you have with ${mandatory[0] ?? job.title}?`,
        `Which project best proves your fit for ${job.department}?`,
        `Can you work in the required location/work model: ${job.location}?`,
      ] },
    ],
  };
}

function buildMatch(candidate: typeof candidates[number], job: typeof jobs[number]): AIOutput {
  const matched = job.requirements.filter(requirement => candidateMatchesRequirement(candidate, requirement));
  const missing = job.requirements.filter(requirement => !candidateMatchesRequirement(candidate, requirement));
  const score = matchScore(candidate, job);
  const skillMatch = Math.round((matched.length / Math.max(job.requirements.length, 1)) * 100);
  return {
    title: `Resume-JD Match: ${candidate.name} vs ${job.title}`,
    summary: `${score}% overall match. Final recommendation: ${recommendation(score)}.`,
    sections: [
      { label: 'Match %', value: `${score}%` },
      { label: 'Skill match', value: `${skillMatch}% (${matched.length}/${job.requirements.length} requirements matched)` },
      { label: 'Experience match', value: `${Math.min(100, Math.round((candidate.experience / 5) * 100))}% based on ${candidate.experience}+ years` },
      { label: 'Missing skills', value: missing.length ? missing : ['No major missing JD skills detected'] },
      { label: 'Strengths', value: matched.length ? matched.map(item => `Strong evidence for ${item}`) : ['Relevant experience summary should be reviewed manually'] },
      { label: 'Weaknesses', value: missing.length ? missing.map(item => `${item} is not clearly visible`) : ['No critical weakness detected'] },
      { label: 'Recommendation', value: recommendation(score) },
      { label: 'Human decision required', value: 'AI can recommend, score, summarize, and flag gaps, but final candidate decisions must always be made by a human recruiter. This output must not automatically reject or advance a candidate.' },
      { label: 'Recruiter notes', value: `${candidate.name} should be reviewed for ${job.client}. Validate rate, availability, work authorization, and client-specific domain examples before submission.` },
      { label: 'Candidate questions', value: [
        `Can you explain your strongest project using ${job.requirements[0] ?? job.title}?`,
        `Do you have direct experience with ${job.client} type environments?`,
        'Please confirm work authorization, expected rate, availability, and relocation preference.',
      ] },
    ],
  };
}

function buildBooleanOutput(job: typeof jobs[number]): AIOutput {
  const skills = job.requirements;
  const platforms = ['LinkedIn Recruiter', 'LinkedIn Recruiter Lite', 'Dice', 'Monster', 'CareerBuilder', 'Google X-Ray', 'GitHub', 'Indeed'];
  return {
    title: `Boolean Search Generator: ${job.title}`,
    summary: 'Sourcing strings generated for major recruiter platforms.',
    sections: platforms.map(platform => ({
      label: platform,
      value: buildBoolean(job.title, skills, platform),
    })),
  };
}

function buildScreeningQuestions(candidate: typeof candidates[number], job: typeof jobs[number]): AIOutput {
  return {
    title: `Candidate Screening Questions: ${candidate.name}`,
    summary: `Screening pack generated for ${job.title} at ${job.client}.`,
    sections: [
      { label: 'Technical questions', value: job.requirements.slice(0, 3).map(skill => `Describe a recent production project where you used ${skill}.`) },
      { label: 'Domain questions', value: [`What experience do you have in ${job.department} or similar client environments?`, `Which business problem did your work solve for the client?`] },
      { label: 'Project questions', value: ['Which project should we highlight for client submission?', 'What measurable outcomes can be added to the resume?'] },
      { label: 'Client-specific questions', value: [`Have you worked with a client similar to ${job.client}?`, `Can you align your resume to ${job.client}'s submission expectations?`] },
      { label: 'Visa/work authorization questions', value: ['Please confirm current work authorization.', 'Will you require sponsorship now or in the future?'] },
      { label: 'Rate/availability questions', value: [`Please confirm expected rate against ${job.salary}.`, `Can you start based on your listed availability: ${candidate.availability}?`] },
    ],
  };
}

function buildResumeImprovement(candidate: typeof candidates[number], job: typeof jobs[number]): AIOutput {
  const missing = job.requirements.filter(requirement => !candidateMatchesRequirement(candidate, requirement));
  return {
    title: `Resume Improvement Suggestions: ${candidate.name}`,
    summary: missing.length ? 'Resume needs recruiter follow-up before client submission.' : 'Resume appears broadly client-submission ready with minor polish.',
    sections: [
      { label: 'What to ask candidate to add', value: ['Current employer, work authorization, expected rate, availability, and project metrics.'] },
      { label: 'What is missing', value: missing.length ? missing : ['No major JD keywords missing from current ATS profile'] },
      { label: 'Skills to highlight', value: candidate.skills.slice(0, 6) },
      { label: 'Project to expand', value: `Expand the project that best supports ${job.requirements[0] ?? job.title} and include measurable delivery outcomes.` },
      { label: 'Keywords missing from JD', value: missing.length ? missing : ['All major listed JD requirements are represented'] },
      { label: 'Client-submission ready', value: missing.length > 2 ? 'Needs updates before submission' : 'Ready after recruiter confirms rate, visa, and availability' },
    ],
  };
}

function buildClientSubmission(candidate: typeof candidates[number], job: typeof jobs[number]): AIOutput {
  const score = matchScore(candidate, job);
  const matched = job.requirements.filter(requirement => candidateMatchesRequirement(candidate, requirement));
  return {
    title: `Client Submission Generator: ${candidate.name}`,
    summary: `Submission package for ${job.title} at ${job.client}.`,
    sections: [
      { label: 'Candidate summary', value: `${candidate.name} is a ${candidate.title} with ${candidate.experience}+ years of experience and strengths in ${candidate.skills.slice(0, 5).join(', ')}.` },
      { label: 'Skill alignment', value: matched.length ? matched : ['Skill alignment requires recruiter review'] },
      { label: 'Availability', value: candidate.availability },
      { label: 'Rate', value: candidate.salary },
      { label: 'Work authorization', value: 'Confirm with candidate before submission' },
      { label: 'Why this candidate fits', value: `${score}% match for ${job.title}; strongest alignment includes ${matched.slice(0, 3).join(', ') || candidate.skills.slice(0, 3).join(', ')}.` },
      { label: 'Missing/confirmed details', value: ['Confirm work authorization', 'Confirm expected rate', 'Confirm current location and relocation preference', 'Confirm client/domain examples'] },
    ],
  };
}

function outputForModule(module: AIModuleKey, candidate: typeof candidates[number], job: typeof jobs[number]): AIOutput {
  if (module === 'resume-parser') return parseResume(candidate);
  if (module === 'jd-parser') return parseJD(job);
  if (module === 'match-engine') return buildMatch(candidate, job);
  if (module === 'boolean-generator') return buildBooleanOutput(job);
  if (module === 'screening-questions') return buildScreeningQuestions(candidate, job);
  if (module === 'resume-improvement') return buildResumeImprovement(candidate, job);
  if (module === 'client-submission') return buildClientSubmission(candidate, job);
  return {
    title: 'AI Recruiter Assistant',
    summary: 'Ask ATS questions about candidates, jobs, submissions, follow-ups, Boolean search, and comparisons.',
    sections: [
      { label: 'Available prompts', value: recruiterPrompts },
      { label: 'Data connected', value: [`${candidates.length} candidates`, `${jobs.length} jobs`, `${submissions.length} submissions`, `${tasks.length} tasks`] },
    ],
  };
}

export default function AIAssistant() {
  const availableCandidates = getAllCandidates();
  const availableJobs = getAllJobs();
  const [candidateId, setCandidateId] = useState(availableCandidates[0]?.id ?? '');
  const [notice, setNotice] = useState('AI workbench ready.');
  const [aiAction, setAiAction] = useState<null | { candidate: Candidate; module: AIModuleKey }>(null);

  const candidateRows = useMemo(() => availableCandidates
    .map(candidate => {
      const best = bestJobForCandidate(candidate);
      return { candidate, job: best.job, score: best.score };
    })
    .sort((first, second) => second.score - first.score), [availableCandidates]);
  const averageMatchScore = candidateRows.length
    ? Math.round(candidateRows.reduce((total, row) => total + row.score, 0) / candidateRows.length)
    : 0;
  const tableMetrics = [
    { label: 'Candidate records', value: availableCandidates.length, icon: UserCheck, tone: 'from-violet-600 to-violet-400' },
    { label: 'Open job context', value: availableJobs.length, icon: Briefcase, tone: 'from-blue-600 to-blue-400' },
    { label: 'Avg AI match', value: `${averageMatchScore}%`, icon: Target, tone: 'from-emerald-600 to-emerald-400' },
    { label: 'AI quick actions', value: quickCandidateActions.length, icon: Sparkles, tone: 'from-amber-600 to-amber-400' },
  ];
  const actionJob = aiAction ? bestJobForCandidate(aiAction.candidate).job : emptyJob;
  const actionOutput = aiAction ? outputForModule(aiAction.module, aiAction.candidate, actionJob) : null;

  function runCandidateQuickAction(candidate: Candidate, module: AIModuleKey) {
    const matchedJob = bestJobForCandidate(candidate).job;
    setCandidateId(candidate.id);
    const moduleLabel = modules.find(item => item.key === module)?.title ?? 'AI action';
    setNotice(`${moduleLabel} completed for ${candidate.name}${module === 'resume-parser' ? '' : ` against ${matchedJob.title}`}.`);
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-300">
            <BrainCircuit size={14} />
            AI module suite
          </div>
          <h1 className="text-2xl font-bold text-white">The Eventus Consulting Group AI Workbench</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Resume parser, JD parser, match engine, Boolean generators, screening, improvement, client submission, and recruiter assistant in one ATS workspace.
          </p>
        </div>
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {notice}
        </div>
      </div>

      <div className="mb-5 rounded-lg border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
        <span className="font-semibold text-amber-200">AI safety rule:</span> AI can recommend, score, summarize, and flag gaps, but it cannot automatically reject candidates or make final hiring decisions. A human recruiter must review the explanation and make the final decision.
      </div>

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tableMetrics.map((metric, index) => (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
            className="relative overflow-hidden rounded-lg border border-white/5 bg-[#0d1729] p-4"
          >
            <div className={cn('absolute right-0 top-0 h-20 w-20 rounded-bl-full bg-gradient-to-br opacity-10', metric.tone)} />
            <div className={cn('mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br', metric.tone)}>
              <metric.icon size={17} className="text-white" />
            </div>
            <p className="text-2xl font-bold text-white">{metric.value}</p>
            <p className="text-xs text-slate-500">{metric.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="mb-5 overflow-hidden rounded-lg border border-white/5 bg-[#0d1729]">
        <div className="flex flex-col gap-2 border-b border-white/5 px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Candidate AI Action Table</h2>
            <p className="text-xs text-slate-500">Select any row action to load the candidate, matched JD, and AI module instantly.</p>
          </div>
          <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-violet-300">
            Dashboard table format
          </span>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[1120px]">
            <div className="grid grid-cols-[minmax(220px,1.2fr)_minmax(270px,1.35fr)_minmax(210px,1fr)_90px_115px_minmax(300px,1.4fr)] gap-4 border-b border-white/5 px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              <span>Candidate Details</span>
              <span>Skills</span>
              <span>Best JD Match</span>
              <span>AI Score</span>
              <span>Status</span>
              <span>Quick Actions</span>
            </div>
            <div className="divide-y divide-white/5">
              {candidateRows.map(({ candidate, job, score }, index) => (
                <motion.div
                  key={candidate.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.025 }}
                  className={cn(
                    'grid grid-cols-[minmax(220px,1.2fr)_minmax(270px,1.35fr)_minmax(210px,1fr)_90px_115px_minmax(300px,1.4fr)] gap-4 px-4 py-4 transition-colors',
                    candidate.id === candidateId ? 'bg-violet-500/[0.06]' : 'hover:bg-white/[0.025]'
                  )}
                >
                  <div>
                    <button onClick={() => setCandidateId(candidate.id)} className="text-left font-semibold text-white transition-colors hover:text-violet-300">
                      {candidate.name}
                    </button>
                    <p className="mt-1 text-xs text-slate-500">{candidate.title}</p>
                    <p className="mt-1 text-[11px] text-slate-600">{candidate.email || candidate.location}</p>
                  </div>
                  <div className="flex min-w-0 flex-wrap items-start gap-1.5">
                    {candidate.skills.slice(0, 6).map(skill => (
                      <span
                        key={`${candidate.id}-${skill}`}
                        title={skill}
                        className="inline-flex max-w-full rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] leading-none text-slate-300"
                      >
                        <span className="max-w-[170px] truncate">{skill}</span>
                      </span>
                    ))}
                    {candidate.skills.length > 6 && <span className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] leading-none text-slate-500">+{candidate.skills.length - 6}</span>}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-200">{job.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{job.client}</p>
                  </div>
                  <div>
                    <span className={cn(
                      'inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold',
                      score >= 80 ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' :
                        score >= 65 ? 'border-amber-500/20 bg-amber-500/10 text-amber-300' :
                          'border-red-500/20 bg-red-500/10 text-red-300'
                    )}>
                      {score}%
                    </span>
                  </div>
                  <div>
                    <span className={cn('inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold', candidateStatusTone[candidate.status] ?? candidateStatusTone.New)}>
                      {candidate.status}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {quickCandidateActions.map(action => (
                      <button
                        key={`${candidate.id}-${action.key}`}
                        type="button"
                        title={action.label}
                        aria-label={`${action.label} for ${candidate.name}`}
                        onClick={() => setAiAction({ candidate, module: action.key })}
                        className={cn(
                          'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-400 transition-colors hover:text-white',
                          action.tone
                        )}
                      >
                        <action.icon size={14} />
                      </button>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
            {!candidateRows.length && (
              <div className="px-4 py-12 text-center text-sm text-slate-600">
                Add candidates first to use AI quick actions.
              </div>
            )}
          </div>
        </div>
      </div>

      {aiAction && (
        <QuickActionModal
          title={modules.find(item => item.key === aiAction.module)?.title ?? 'AI Quick Action'}
          subtitle={`${aiAction.candidate.name} - ${aiAction.candidate.title}`}
          onCancel={() => setAiAction(null)}
          onSave={() => {
            runCandidateQuickAction(aiAction.candidate, aiAction.module);
            setAiAction(null);
          }}
          saveLabel="Run / Update"
          maxWidthClass="max-w-4xl"
        >
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-white/5 bg-white/[0.03] p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-600">Skills</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {aiAction.candidate.skills.slice(0, 8).map(skill => (
                  <span
                    key={`${aiAction.candidate.id}-modal-${skill}`}
                    title={skill}
                    className="inline-flex max-w-full rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs leading-none text-slate-300"
                  >
                    <span className="max-w-[190px] truncate">{skill}</span>
                  </span>
                ))}
                {!aiAction.candidate.skills.length && <span className="text-sm text-slate-500">No skills listed</span>}
              </div>
            </div>
            <div className="rounded-lg border border-white/5 bg-white/[0.03] p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-600">ATS Context</p>
              <p className="mt-1 text-sm text-white">{aiAction.candidate.status}</p>
              <p className="mt-1 text-xs text-slate-500">{aiAction.module === 'resume-parser' ? 'Candidate profile parser' : `${actionJob.title} - ${actionJob.client}`}</p>
            </div>
          </div>
          {actionOutput && (
            <div className="mt-4 rounded-lg border border-violet-500/20 bg-violet-500/10 p-4">
              <h3 className="text-sm font-semibold text-violet-100">{actionOutput.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-violet-100/80">{actionOutput.summary}</p>
            </div>
          )}
          {actionOutput && (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {actionOutput.sections.map(section => (
                <div key={section.label} className="rounded-lg border border-white/5 bg-[#070d18] p-3">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-600">{section.label}</p>
                  {Array.isArray(section.value) ? (
                    section.value.every(item => item.length <= 36) ? (
                      <div className="flex flex-wrap gap-1.5">
                        {section.value.map(item => (
                          <span key={item} className="inline-flex max-w-full rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs leading-snug text-slate-300">
                            <span className="max-w-[280px] truncate">{item}</span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {section.value.map(item => (
                          <div key={item} className="flex gap-2 text-sm leading-relaxed text-slate-300">
                            <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-violet-300" />
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    )
                  ) : (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">{section.value}</p>
                  )}
                </div>
              ))}
            </div>
          )}
          <p className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
            Final hiring decisions remain human controlled. This quick task only prepares ATS-ready AI output for recruiter review.
          </p>
        </QuickActionModal>
      )}
    </div>
  );
}
