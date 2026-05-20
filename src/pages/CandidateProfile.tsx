import { FormEvent, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Bot, Briefcase, Calendar, CheckCircle2, ClipboardList, Download,
  Link as LinkIcon, Mail, MapPin, Phone, ShieldCheck, Sparkles,
  Star, Upload, Send, Pencil, X, FileUp,
} from 'lucide-react';
import { candidates as seedCandidates, complianceDocs, interviews, jobs as seedJobs, submissions, tasks } from '@/lib/data';
import { LOCAL_CANDIDATES_KEY } from '@/lib/atsLocalStore';
import { readLocalRows, saveRows } from '@/lib/atsApi';
import { formatCallDuration, getCandidateCallLogs, openCandidateDialer, saveCandidateCallLog, type CallOutcome } from '@/lib/callLogs';
import { getAllCandidates, getAllJobs, getAllSubmissions } from '@/lib/localRecords';
import { createComplianceCase, createOnboardingCase, loadComplianceCases, loadOnboardingCases, saveComplianceCases, saveOnboardingCases } from '@/lib/onboardingStore';
import { createSubmissionRecord, duplicateSubmissionMessage } from '@/lib/submissionStore';
import type { Candidate, CandidateStatus, Job, Submission } from '@/lib/types';
import { cn } from '@/lib/utils';

const fallbackCandidate: Candidate = {
  id: 'no-candidate',
  name: 'No candidate selected',
  email: '',
  phone: '',
  title: 'Candidate pending',
  location: '',
  status: 'New',
  skills: [],
  experience: 0,
  salary: 'Open',
  availability: 'Needs confirmation',
  source: 'Manual',
  recruiter: 'SuperUser',
  createdAt: new Date().toISOString().slice(0, 10),
  updatedAt: new Date().toISOString().slice(0, 10),
  summary: 'Add a candidate to view the profile workspace.',
  rating: 1,
  resume: 'Resume pending',
};

const fallbackJob: Job = {
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
  description: 'Add a job to enable candidate matching.',
  requirements: [],
  postedDate: new Date().toISOString().slice(0, 10),
  closeDate: '',
  submissions: 0,
  department: 'Recruiting',
};

const localCandidates = getAllCandidates();
const localJobs = getAllJobs();
const candidates = localCandidates.length ? localCandidates : seedCandidates.length ? seedCandidates : [fallbackCandidate];
const jobs = localJobs.length ? localJobs : seedJobs.length ? seedJobs : [fallbackJob];

type EnrichedCandidate = Candidate & {
  currentEmployer: string;
  workAuthorization: string;
  visaType: string;
  relevantExperience: number;
  currentPayRate: string;
  expectedPayRate: string;
  relocationPreference: string;
  resumeUpload: string;
  parsedResumeDetails: string;
  education: string;
  certifications: string;
  documentChecklist: Array<{ label: string; status: 'Complete' | 'Pending' | 'Missing' }>;
  aiMatchScore: number;
  aiMatchedJob: string;
};

type ProfileAction = 'submit' | 'edit' | 'upload' | 'schedule' | 'validate' | 'compare' | 'call' | null;

type JDComparisonRow = {
  requirement: string;
  foundInResume: string;
  status: 'Matched' | 'Partial' | 'Missing';
  aiComment: string;
};

type CandidateSummaryKind =
  | 'recruiter'
  | 'client'
  | 'questions'
  | 'missingCandidateDetails'
  | 'missingDetailsEmail'
  | 'resumeImprovements'
  | 'linkedInOutreach'
  | 'interviewPrep';

type GeneratedCandidateSummary = {
  title: string;
  output: string;
};

type ResumeQualityStatus = 'Pass' | 'Needs Review' | 'Issue';

type ResumeQualityCheck = {
  label: string;
  status: ResumeQualityStatus;
  finding: string;
  action: string;
};

type FraudFlagSeverity = 'Clear' | 'Review' | 'Elevated';

type FraudRedFlagCheck = {
  label: string;
  severity: FraudFlagSeverity;
  evidence: string;
  recruiterAction: string;
};

type FraudAuditLog = {
  id: string;
  timestamp: string;
  action: string;
  actor: string;
  explanation: string;
};

type CandidateJobStage =
  | 'Sourced'
  | 'Contacted'
  | 'Interested'
  | 'Resume Received'
  | 'AI Validated'
  | 'Recruiter Screened'
  | 'Submitted to Client'
  | 'Client Review'
  | 'Interview Scheduled'
  | 'Interview Completed'
  | 'Selected'
  | 'Offer Released'
  | 'Joined'
  | 'Rejected'
  | 'Withdrawn';

type CandidateJobAssignment = {
  jobId: string;
  stage: CandidateJobStage;
  assignedAt: string;
  source: 'AI Match' | 'Manual' | 'Submission History';
};

type ResumeValidation = {
  candidateName: string;
  jobTitle: string;
  overallMatch: number;
  mandatorySkillsMatch: number;
  preferredSkillsMatch: number;
  experienceMatch: number;
  domainMatch: number;
  locationMatch: number;
  visaMatch: number;
  educationMatch: number;
  certificationMatch: number;
  missingMandatorySkills: string[];
  missingPreferredSkills: string[];
  weakAreas: string[];
  redFlags: string[];
  improvementSuggestions: string[];
  recruiterSummary: string;
  clientSubmissionSummary: string;
  screeningQuestions: string[];
  finalRecommendation: 'Strong Match' | 'Good Match' | 'Average Match' | 'Weak Match' | 'Not Recommended';
};

const statusColors: Record<CandidateStatus, string> = {
  New: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  Screening: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
  Interview: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  Offer: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  Placed: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  Rejected: 'bg-red-500/20 text-red-300 border-red-500/30',
  'On Hold': 'bg-slate-500/20 text-slate-300 border-slate-500/30',
};

const statusSteps: CandidateStatus[] = ['New', 'Screening', 'Interview', 'Offer', 'Placed'];
const validationWeights = [
  { label: 'Mandatory skills', weight: 30 },
  { label: 'Preferred skills', weight: 15 },
  { label: 'Experience', weight: 15 },
  { label: 'Domain', weight: 10 },
  { label: 'Location', weight: 10 },
  { label: 'Visa / work authorization', weight: 10 },
  { label: 'Education', weight: 5 },
  { label: 'Certification', weight: 5 },
];

const summaryActions: Array<{ kind: CandidateSummaryKind; label: string }> = [
  { kind: 'recruiter', label: 'Generate recruiter summary' },
  { kind: 'client', label: 'Generate client submission summary' },
  { kind: 'questions', label: 'Generate candidate screening questions' },
  { kind: 'missingCandidateDetails', label: 'Find Missing Candidate Details' },
  { kind: 'missingDetailsEmail', label: 'Generate missing details email' },
  { kind: 'resumeImprovements', label: 'Generate resume improvement points' },
  { kind: 'linkedInOutreach', label: 'Generate LinkedIn outreach message' },
  { kind: 'interviewPrep', label: 'Generate interview prep notes' },
];

const candidateJobStages: CandidateJobStage[] = [
  'Sourced',
  'Contacted',
  'Interested',
  'Resume Received',
  'AI Validated',
  'Recruiter Screened',
  'Submitted to Client',
  'Client Review',
  'Interview Scheduled',
  'Interview Completed',
  'Selected',
  'Offer Released',
  'Joined',
  'Rejected',
  'Withdrawn',
];

function normalizeSkill(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9+#.\s]/g, '').trim();
}

function skillMatches(candidate: EnrichedCandidate, requirement: string) {
  const normalizedRequirement = normalizeSkill(requirement.replace(/\d+\+?\s*years?/i, ''));
  return candidate.skills.some(skill => {
    const normalizedSkill = normalizeSkill(skill);
    return normalizedRequirement.includes(normalizedSkill) || normalizedSkill.includes(normalizedRequirement);
  });
}

function candidateMatchesRequirement(candidate: Candidate | EnrichedCandidate, requirement: string) {
  const normalizedRequirement = normalizeSkill(requirement.replace(/\d+\+?\s*years?/i, ''));
  const resumeText = normalizeSkill([
    candidate.title,
    candidate.summary,
    candidate.skills.join(' '),
    'parsedResumeDetails' in candidate ? candidate.parsedResumeDetails : '',
  ].join(' '));

  return candidate.skills.some(skill => {
    const normalizedSkill = normalizeSkill(skill);
    return normalizedRequirement.includes(normalizedSkill) || normalizedSkill.includes(normalizedRequirement);
  }) || resumeText.includes(normalizedRequirement);
}

function percentage(matched: number, total: number) {
  if (!total) return 100;
  return Math.round((matched / total) * 100);
}

function recommendationFromScore(score: number): ResumeValidation['finalRecommendation'] {
  if (score >= 90) return 'Strong Match';
  if (score >= 80) return 'Good Match';
  if (score >= 65) return 'Average Match';
  if (score >= 50) return 'Weak Match';
  return 'Not Recommended';
}

function findBestJobForCandidate(candidate: Candidate | EnrichedCandidate) {
  return [...jobs].sort((first, second) => scoreJobFit(candidate, second) - scoreJobFit(candidate, first))[0] ?? jobs[0];
}

function matchScoreForJob(candidate: EnrichedCandidate, job: typeof jobs[number]) {
  return validateResumeForJob(candidate, job).overallMatch;
}

function rankingForJob(candidate: EnrichedCandidate, job: typeof jobs[number]) {
  const rankedCandidates = candidates
    .map((candidateRow, index) => enrichCandidate(candidateRow, index))
    .sort((first, second) => matchScoreForJob(second, job) - matchScoreForJob(first, job));

  return rankedCandidates.findIndex(candidateRow => candidateRow.id === candidate.id) + 1 || rankedCandidates.length;
}

function stageFromSubmissionStatus(status: string): CandidateJobStage {
  if (status === 'Submitted') return 'Submitted to Client';
  if (status === 'Client Review') return 'Client Review';
  if (status === 'Interview Scheduled') return 'Interview Scheduled';
  if (status === 'Offer Extended') return 'Offer Released';
  if (status === 'Placed') return 'Joined';
  if (status === 'Rejected') return 'Rejected';
  return 'Submitted to Client';
}

function createInitialAssignments(candidate: EnrichedCandidate): CandidateJobAssignment[] {
  const assignmentMap = new Map<string, CandidateJobAssignment>();
  const bestJob = findBestJobForCandidate(candidate);

  assignmentMap.set(bestJob.id, {
    jobId: bestJob.id,
    stage: 'AI Validated',
    assignedAt: new Date().toISOString().slice(0, 10),
    source: 'AI Match',
  });

  submissions
    .filter(submission => submission.candidateId === candidate.id)
    .forEach(submission => {
      assignmentMap.set(submission.jobId, {
        jobId: submission.jobId,
        stage: stageFromSubmissionStatus(submission.status),
        assignedAt: submission.submittedDate,
        source: 'Submission History',
      });
    });

  return [...assignmentMap.values()];
}

function scoreJobFit(candidate: Candidate | EnrichedCandidate, job: typeof jobs[number]) {
  const requirementScore = job.requirements.reduce((score, requirement) => score + (candidateMatchesRequirement(candidate, requirement) ? 10 : 0), 0);
  const titleScore = normalizeSkill(job.title).split(/\s+/).reduce((score, word) => score + (normalizeSkill(candidate.title).includes(word) ? 4 : 0), 0);
  const summaryScore = normalizeSkill(candidate.summary).includes(normalizeSkill(job.department)) ? 8 : 0;
  const experienceScore = candidate.experience >= Number(job.requirements.join(' ').match(/(\d+)\+?\s*years?/i)?.[1] ?? 5) ? 8 : 0;

  return requirementScore + titleScore + summaryScore + experienceScore;
}

function compareResumeToJob(candidate: EnrichedCandidate, job: typeof jobs[number]): JDComparisonRow[] {
  const requiredYears = Number(job.requirements.join(' ').match(/(\d+)\+?\s*years?/i)?.[1] ?? 5);
  const skillRows = job.requirements.map((requirement, index) => {
    const matched = skillMatches(candidate, requirement);
    const normalizedRequirement = requirement.replace(/\d+\+?\s*years?/i, '').trim();
    const relatedSkills = candidate.skills.filter(skill => {
      const normalizedSkill = normalizeSkill(skill);
      const normalizedNeed = normalizeSkill(normalizedRequirement || requirement);
      return normalizedNeed.includes(normalizedSkill) || normalizedSkill.includes(normalizedNeed);
    });

    return {
      requirement: `${index < 3 ? 'Mandatory' : 'Preferred'}: ${requirement}`,
      foundInResume: matched ? (relatedSkills.length ? relatedSkills.join(', ') : `${candidate.title}; ${candidate.parsedResumeDetails}`) : 'Not clearly found in parsed resume',
      status: matched ? 'Matched' : 'Missing',
      aiComment: matched
        ? 'Resume has direct evidence for this JD requirement.'
        : 'Ask the candidate to confirm this skill or update the resume before client submission.',
    } satisfies JDComparisonRow;
  });

  const experienceStatus: JDComparisonRow['status'] = candidate.relevantExperience >= requiredYears ? 'Matched' : candidate.experience >= requiredYears ? 'Partial' : 'Missing';
  const locationAligned = job.location.toLowerCase().includes('remote') ||
    candidate.relocationPreference !== 'Local only' ||
    job.location.split(',').pop()?.trim() === candidate.location.split(',').pop()?.trim();
  const authAligned = candidate.workAuthorization === 'US Citizen' ||
    candidate.workAuthorization === 'Green Card' ||
    candidate.visaType === 'No sponsorship needed' ||
    job.description.toLowerCase().includes('sponsor');

  return [
    ...skillRows,
    {
      requirement: `Experience required: ${requiredYears}+ years`,
      foundInResume: `${candidate.experience} years total; ${candidate.relevantExperience} years relevant`,
      status: experienceStatus,
      aiComment: experienceStatus === 'Matched'
        ? 'Experience is at or above the JD threshold.'
        : 'Relevant experience needs clarification before sending to the client.',
    },
    {
      requirement: `Domain / role scope: ${job.department}`,
      foundInResume: `${candidate.title}; ${candidate.summary}`,
      status: candidate.title.toLowerCase().includes(job.department.toLowerCase()) || candidate.summary.toLowerCase().includes(job.department.toLowerCase()) ? 'Matched' : 'Partial',
      aiComment: 'Resume shows related role context; validate recent project domain during screening.',
    },
    {
      requirement: `Location / work model: ${job.location}`,
      foundInResume: `${candidate.location}; ${candidate.relocationPreference}`,
      status: locationAligned ? 'Matched' : 'Partial',
      aiComment: locationAligned ? 'Location and work model appear workable.' : 'Confirm commute, relocation, or remote flexibility with the candidate.',
    },
    {
      requirement: `Employment type / rate: ${job.type}; ${job.salary}`,
      foundInResume: `${candidate.availability}; expected ${candidate.expectedPayRate}`,
      status: 'Partial',
      aiComment: 'Rate and employment terms should be confirmed before submission.',
    },
    {
      requirement: 'Visa / work authorization',
      foundInResume: `${candidate.workAuthorization}; ${candidate.visaType}`,
      status: authAligned ? 'Matched' : 'Partial',
      aiComment: authAligned ? 'Authorization is likely acceptable for submission.' : 'Client sponsorship policy needs confirmation.',
    },
    {
      requirement: 'Education / certification evidence',
      foundInResume: `${candidate.education}; ${candidate.certifications}`,
      status: candidate.education || candidate.certifications ? 'Matched' : 'Missing',
      aiComment: 'Education and certification details are available for client review.',
    },
  ];
}

function formatList(items: string[], fallback = 'None identified') {
  return items.length ? items.join(', ') : fallback;
}

function candidateDetailChecks(candidate: EnrichedCandidate, job: typeof jobs[number], comparisonRows: JDComparisonRow[]) {
  const resumeText = [
    candidate.summary,
    candidate.parsedResumeDetails,
    candidate.skills.join(' '),
    candidate.education,
    candidate.certifications,
    candidate.currentEmployer,
  ].join(' ').toLowerCase();
  const domainTerms = [job.department, job.client, ...job.description.split(/\s+/).filter(word => word.length > 6)].map(term => term.toLowerCase());
  const hasDomainSignal = domainTerms.some(term => resumeText.includes(term));
  const hasProjectSignal = /project|platform|migration|implementation|delivery|microservice|application|system/i.test(resumeText);
  const hasToolSignal = candidate.skills.length > 0 || comparisonRows.some(row => row.status === 'Matched');

  return [
    { label: 'Phone number', status: candidate.phone ? 'Present' : 'Missing', detail: candidate.phone },
    { label: 'Email', status: candidate.email ? 'Present' : 'Missing', detail: candidate.email },
    { label: 'Location', status: candidate.location ? 'Present' : 'Missing', detail: candidate.location },
    { label: 'LinkedIn', status: candidate.linkedin ? 'Present' : 'Missing', detail: candidate.linkedin ?? '' },
    { label: 'Work authorization', status: candidate.workAuthorization ? 'Present' : 'Missing', detail: candidate.workAuthorization },
    { label: 'Visa status', status: candidate.visaType ? 'Present' : 'Missing', detail: candidate.visaType },
    { label: 'Total experience', status: candidate.experience ? 'Present' : 'Missing', detail: `${candidate.experience} years` },
    { label: 'Relevant experience', status: candidate.relevantExperience ? 'Present' : 'Missing', detail: `${candidate.relevantExperience} years` },
    { label: 'Education', status: candidate.education ? 'Present' : 'Missing', detail: candidate.education },
    { label: 'Certifications', status: candidate.certifications ? 'Present' : 'Missing', detail: candidate.certifications },
    { label: 'Current employer', status: candidate.currentEmployer ? 'Present' : 'Missing', detail: candidate.currentEmployer },
    { label: 'Rate expectation', status: candidate.expectedPayRate ? 'Present' : 'Missing', detail: candidate.expectedPayRate },
    { label: 'Availability', status: candidate.availability ? 'Present' : 'Missing', detail: candidate.availability },
    { label: 'Relocation preference', status: candidate.relocationPreference ? 'Present' : 'Missing', detail: candidate.relocationPreference },
    { label: 'Project details', status: hasProjectSignal ? 'Present' : 'Needs confirmation', detail: hasProjectSignal ? 'Project/delivery evidence found in resume summary.' : 'No clear project examples found.' },
    { label: 'Tools/technologies', status: hasToolSignal ? 'Present' : 'Missing', detail: candidate.skills.join(', ') },
    { label: 'Client/domain experience', status: hasDomainSignal ? 'Present' : 'Needs confirmation', detail: hasDomainSignal ? `Relevant ${job.department} or client/domain signal found.` : `Direct ${job.department} / ${job.client} experience not clearly mentioned.` },
  ];
}

function analyzeResumeQuality(candidate: EnrichedCandidate, job: typeof jobs[number], comparisonRows: JDComparisonRow[]): ResumeQualityCheck[] {
  const resumeText = [
    candidate.summary,
    candidate.parsedResumeDetails,
    candidate.skills.join(' '),
    candidate.education,
    candidate.certifications,
    candidate.currentEmployer,
  ].join(' ');
  const lowerResumeText = resumeText.toLowerCase();
  const missingStandardSections = [
    !candidate.email || !candidate.phone ? 'Contact' : '',
    !candidate.summary ? 'Summary' : '',
    candidate.skills.length === 0 ? 'Skills' : '',
    !candidate.parsedResumeDetails ? 'Experience' : '',
    !candidate.education ? 'Education' : '',
    !candidate.certifications ? 'Certifications' : '',
  ].filter(Boolean);
  const unclearTitle = candidate.title.split(/\s+/).length < 2 || /consultant|specialist|resource|developer/i.test(candidate.title) && !/backend|frontend|full.?stack|devops|data|security|qa|mobile|manager|architect/i.test(candidate.title);
  const hasDates = /\b(20\d{2}|19\d{2})\b|present|current|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i.test(resumeText);
  const possibleGapYears = candidate.experience - candidate.relevantExperience;
  const matchedKeywords = comparisonRows.filter(row => row.status === 'Matched').length;
  const missingKeywords = comparisonRows.filter(row => row.status === 'Missing').map(row => row.requirement);
  const hasMeasurableAchievement = /(\d+%|\$\d|\d+\s?(users|requests|events|transactions|systems|applications|services|apis)|reduced|improved|increased|saved|cut|optimized|scaled)/i.test(resumeText);
  const jdRequirementHits = job.requirements.filter(requirement => lowerResumeText.includes(requirement.replace(/\d+\+?\s*years?/i, '').trim().toLowerCase())).length;
  const hasProjectContext = /built|led|delivered|designed|implemented|migrated|owned|launched|supported|optimized|project|platform|application|system/i.test(resumeText);
  const hasFormattingSignals = /[;|]{2,}|\t{2,}| {4,}/.test(resumeText);
  const hasSectionSignals = /summary|experience|skills|education|certification/i.test(resumeText);

  return [
    {
      label: 'Detect tables/images in resume',
      status: /table|image|logo|chart|screenshot/i.test(resumeText) ? 'Issue' : 'Pass',
      finding: /table|image|logo|chart|screenshot/i.test(resumeText)
        ? 'Parsed resume text suggests visual/table elements may be present.'
        : 'No table/image markers detected in parsed resume text.',
      action: 'Keep resume content in plain text sections and avoid logos, screenshots, tables, or multi-column layouts.',
    },
    {
      label: 'Detect missing standard sections',
      status: missingStandardSections.length ? 'Issue' : 'Pass',
      finding: missingStandardSections.length ? `Missing or weak sections: ${missingStandardSections.join(', ')}.` : 'Core ATS sections are present.',
      action: 'Use standard section headings: Summary, Skills, Professional Experience, Education, Certifications, and Contact.',
    },
    {
      label: 'Detect unclear job titles',
      status: unclearTitle ? 'Needs Review' : 'Pass',
      finding: unclearTitle ? `${candidate.title} may be too broad for ATS role matching.` : `${candidate.title} is specific enough for role terminology matching.`,
      action: `Align the headline to the target role, for example ${job.title}, when accurate.`,
    },
    {
      label: 'Detect missing dates',
      status: hasDates ? 'Pass' : 'Issue',
      finding: hasDates ? 'Date signals were found in the parsed resume/profile text.' : 'No employment date markers were detected in parsed resume details.',
      action: 'Add month/year date ranges for each role and mark current role as Present where applicable.',
    },
    {
      label: 'Detect unexplained gaps',
      status: possibleGapYears > 2 ? 'Needs Review' : 'Pass',
      finding: possibleGapYears > 2 ? `${possibleGapYears} years are not clearly tied to relevant experience.` : 'No major unexplained experience gap detected from available profile data.',
      action: 'Ask the candidate to explain career gaps, non-relevant work periods, or contract breaks if present.',
    },
    {
      label: 'Detect weak keywords',
      status: missingKeywords.length ? 'Needs Review' : 'Pass',
      finding: missingKeywords.length ? `Weak or missing JD keywords: ${missingKeywords.join(', ')}.` : `${matchedKeywords} JD keywords/requirements are represented.`,
      action: `Add truthful keywords from the JD where supported: ${job.requirements.join(', ')}.`,
    },
    {
      label: 'Detect missing measurable achievements',
      status: hasMeasurableAchievement ? 'Pass' : 'Issue',
      finding: hasMeasurableAchievement ? 'Resume includes measurable impact language.' : 'Resume lacks quantified achievements or outcome metrics.',
      action: 'Add bullets with measurable results such as performance gains, cost savings, scale, throughput, delivery time, or team impact.',
    },
    {
      label: 'Detect copied JD stuffing',
      status: jdRequirementHits >= job.requirements.length && !hasProjectContext ? 'Issue' : jdRequirementHits >= job.requirements.length - 1 ? 'Needs Review' : 'Pass',
      finding: jdRequirementHits >= job.requirements.length - 1
        ? 'Many JD terms appear in the resume; confirm they are backed by real project examples.'
        : 'No obvious copied JD stuffing pattern detected.',
      action: 'Keep keywords natural and attach every major JD term to a real project, tool, or business outcome.',
    },
    {
      label: 'Detect inconsistent formatting',
      status: hasFormattingSignals || !hasSectionSignals ? 'Needs Review' : 'Pass',
      finding: hasFormattingSignals || !hasSectionSignals
        ? 'Parsed text suggests formatting may be inconsistent or section headings may not be explicit.'
        : 'Formatting signals look ATS-friendly from parsed text.',
      action: 'Use a single-column resume, consistent bullets, standard headings, and simple fonts.',
    },
  ];
}

function analyzeFraudRedFlags(candidate: EnrichedCandidate, job: typeof jobs[number], comparisonRows: JDComparisonRow[], validation: ResumeValidation): FraudRedFlagCheck[] {
  const resumeText = [
    candidate.summary,
    candidate.parsedResumeDetails,
    candidate.skills.join(' '),
    candidate.education,
    candidate.certifications,
    candidate.currentEmployer,
  ].join(' ');
  const lowerResumeText = resumeText.toLowerCase();
  const hasDateSignals = /\b(20\d{2}|19\d{2})\b|present|current|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i.test(resumeText);
  const repeatedProjectSignals = (resumeText.match(/project|platform|application|system|migration/gi) ?? []).length;
  const shortProjectSignals = (resumeText.match(/\b(1|2|3|4|5|6)\s?(month|months|mo|mos)\b/gi) ?? []).length;
  const genericClientName = /confidential|client|vendor|project|abc|xyz|sample|test/i.test(candidate.currentEmployer);
  const titleMismatch = validation.domainMatch < 75 || comparisonRows.filter(row => row.status === 'Missing').length >= 3;
  const unrealisticExperience = candidate.experience > 30 || candidate.relevantExperience > candidate.experience || (candidate.experience > 15 && /junior|associate|entry/i.test(candidate.title));
  const locationAuthMismatch = candidate.workAuthorization === 'H-1B' && /federal|defense|clearance|usc|citizen/i.test(job.description);
  const samePhoneEmailCandidates = candidates.filter(candidateRow =>
    candidateRow.id !== candidate.id && (candidateRow.phone === candidate.phone || candidateRow.email.toLowerCase() === candidate.email.toLowerCase())
  );
  const currentFingerprint = normalizeSkill(`${candidate.summary} ${candidate.skills.join(' ')}`);
  const duplicateResumeCandidates = candidates.filter(candidateRow =>
    candidateRow.id !== candidate.id && normalizeSkill(`${candidateRow.summary} ${candidateRow.skills.join(' ')}`) === currentFingerprint
  );
  const proxyRiskSignals = /proxy|impersonation|different person|camera off|lip sync|no video|screen share refused/i.test(resumeText);
  const copiedJdHits = job.requirements.filter(requirement => lowerResumeText.includes(requirement.replace(/\d+\+?\s*years?/i, '').trim().toLowerCase())).length;
  const copiedJdRisk = copiedJdHits >= job.requirements.length - 1 && repeatedProjectSignals < 2;

  return [
    {
      label: 'Resume date gaps',
      severity: hasDateSignals ? 'Clear' : 'Review',
      evidence: hasDateSignals ? 'Resume/profile has date-like signals.' : 'Parsed resume does not show clear employment date ranges.',
      recruiterAction: 'Ask for month/year start and end dates for every employer and contract.',
    },
    {
      label: 'Overlapping employment dates',
      severity: hasDateSignals ? 'Review' : 'Review',
      evidence: hasDateSignals ? 'Structured dates are not detailed enough to rule out overlaps.' : 'No structured dates available to compare overlaps.',
      recruiterAction: 'Manually verify date ranges and ask whether any roles were concurrent contracts.',
    },
    {
      label: 'Same project repeated across companies',
      severity: repeatedProjectSignals > 5 ? 'Review' : 'Clear',
      evidence: repeatedProjectSignals > 5 ? 'Repeated project/platform terms may indicate reused project wording.' : 'No obvious repeated-project pattern detected.',
      recruiterAction: 'Ask candidate to explain project scope, employer, client, dates, and individual contribution for repeated-looking work.',
    },
    {
      label: 'Fake-looking client names',
      severity: genericClientName ? 'Review' : 'Clear',
      evidence: genericClientName ? `${candidate.currentEmployer} looks generic or anonymized.` : `${candidate.currentEmployer} does not look obviously fake from available data.`,
      recruiterAction: 'Verify employer/client names against LinkedIn, resume, and screening notes.',
    },
    {
      label: 'Too many short projects',
      severity: shortProjectSignals >= 3 ? 'Elevated' : shortProjectSignals > 0 ? 'Review' : 'Clear',
      evidence: shortProjectSignals ? `${shortProjectSignals} short-duration project markers found.` : 'No excessive short-project markers detected.',
      recruiterAction: 'Ask for contract duration, reason for exits, and whether short projects were extensions or separate clients.',
    },
    {
      label: 'Inconsistent job titles',
      severity: titleMismatch ? 'Review' : 'Clear',
      evidence: titleMismatch ? `${candidate.title} has weak alignment to ${job.title} / ${job.department}.` : 'Candidate title aligns reasonably with the selected job.',
      recruiterAction: 'Clarify target title and align resume headline only if it truthfully reflects recent work.',
    },
    {
      label: 'Unrealistic experience',
      severity: unrealisticExperience ? 'Elevated' : 'Clear',
      evidence: unrealisticExperience ? `${candidate.experience} total years and ${candidate.relevantExperience} relevant years need validation.` : 'Experience range appears plausible from profile data.',
      recruiterAction: 'Validate graduation timeline, employment chronology, and years of hands-on experience.',
    },
    {
      label: 'Missing LinkedIn',
      severity: candidate.linkedin ? 'Clear' : 'Review',
      evidence: candidate.linkedin ? candidate.linkedin : 'LinkedIn URL is missing from candidate profile.',
      recruiterAction: 'Request LinkedIn URL or document why LinkedIn is unavailable.',
    },
    {
      label: 'Resume/job mismatch',
      severity: validation.overallMatch < 60 ? 'Elevated' : validation.overallMatch < 75 ? 'Review' : 'Clear',
      evidence: `${validation.overallMatch}% match against ${job.title}; missing mandatory skills: ${formatList(validation.missingMandatorySkills)}.`,
      recruiterAction: 'Do not submit until recruiter confirms the candidate has direct experience for missing mandatory requirements.',
    },
    {
      label: 'Suspicious location/work authorization mismatch',
      severity: locationAuthMismatch ? 'Elevated' : 'Clear',
      evidence: locationAuthMismatch ? `${candidate.workAuthorization} may conflict with role/client constraints.` : `${candidate.location}, ${candidate.workAuthorization}, and ${candidate.visaType} do not show an obvious mismatch.`,
      recruiterAction: 'Confirm work authorization, sponsorship needs, location, and client eligibility before submission.',
    },
    {
      label: 'Same phone/email used by multiple candidates',
      severity: samePhoneEmailCandidates.length ? 'Elevated' : 'Clear',
      evidence: samePhoneEmailCandidates.length ? `Matched with: ${samePhoneEmailCandidates.map(candidateRow => candidateRow.name).join(', ')}.` : 'No duplicate phone/email found in local candidate data.',
      recruiterAction: 'Investigate shared contact details before submission; document explanation if legitimate.',
    },
    {
      label: 'Multiple resumes with same content',
      severity: duplicateResumeCandidates.length ? 'Elevated' : 'Clear',
      evidence: duplicateResumeCandidates.length ? `Similar content matched with: ${duplicateResumeCandidates.map(candidateRow => candidateRow.name).join(', ')}.` : 'No exact duplicate resume fingerprint found in local candidate data.',
      recruiterAction: 'Compare resume files and ask candidate to verify original work history if duplicate content appears.',
    },
    {
      label: 'Proxy interview risk notes',
      severity: proxyRiskSignals ? 'Elevated' : 'Review',
      evidence: proxyRiskSignals ? 'Proxy/interview-risk language detected in notes.' : 'No proxy evidence found; still requires normal identity and interview controls.',
      recruiterAction: 'Use live video, ID/name confirmation, consistent contact details, and technical screening continuity checks.',
    },
    {
      label: 'Copied JD stuffing',
      severity: copiedJdRisk ? 'Review' : 'Clear',
      evidence: copiedJdRisk ? 'Most JD keywords appear without enough project context.' : 'No obvious copied JD stuffing pattern detected.',
      recruiterAction: 'Ask for project examples for every major keyword before client submission.',
    },
  ];
}

function generateCandidateSummary(
  kind: CandidateSummaryKind,
  candidate: EnrichedCandidate,
  job: typeof jobs[number],
  validation: ResumeValidation,
  comparisonRows: JDComparisonRow[]
): GeneratedCandidateSummary {
  const missingRows = comparisonRows.filter(row => row.status === 'Missing');
  const partialRows = comparisonRows.filter(row => row.status === 'Partial');
  const matchedRows = comparisonRows.filter(row => row.status === 'Matched');
  const missingDetails = [
    ...validation.missingMandatorySkills,
    ...validation.missingPreferredSkills,
    ...partialRows.map(row => row.requirement),
  ].slice(0, 6);
  const topSkills = candidate.skills.slice(0, 5).join(', ');
  const matchLine = `${validation.overallMatch}% overall match with ${validation.mandatorySkillsMatch}% mandatory skill coverage`;
  const detailChecks = candidateDetailChecks(candidate, job, comparisonRows);
  const needsRecruiterFollowUp = detailChecks.filter(check => check.status !== 'Present');

  if (kind === 'recruiter') {
    return {
      title: 'Recruiter Summary',
      output: `${candidate.name} has ${candidate.experience}+ years of experience as a ${candidate.title} with strong ${topSkills} background. Resume aligns to ${job.title} at ${matchLine}. The strongest evidence is ${formatList(matchedRows.slice(0, 3).map(row => row.requirement.toLowerCase()))}, while ${formatList(missingDetails, 'no critical gaps')} should be validated before client submission.`,
    };
  }

  if (kind === 'client') {
    return {
      title: 'Client Submission Summary',
      output: `${candidate.name} is available ${candidate.availability.toLowerCase()} for ${job.title} at ${job.client}. Candidate brings ${candidate.experience} years total experience, ${candidate.relevantExperience} years relevant experience, and hands-on strengths in ${topSkills}. Current validation recommends ${validation.finalRecommendation} with ${matchLine}; recruiter has flagged ${formatList(missingRows.map(row => row.requirement), 'no missing JD requirements')} for final confirmation.`,
    };
  }

  if (kind === 'questions') {
    return {
      title: 'Candidate Screening Questions',
      output: [
        `1. Can you walk me through your recent hands-on work with ${job.requirements[0] ?? job.title}?`,
        `2. Which project best demonstrates your fit for ${job.title} at ${job.client}?`,
        `3. Can you confirm your current work authorization: ${candidate.workAuthorization} / ${candidate.visaType}?`,
        `4. Are you comfortable with ${job.location}, ${job.type}, and the target range ${job.salary}?`,
        `5. Please clarify these possible gaps: ${formatList(missingDetails)}.`,
      ].join('\n'),
    };
  }

  if (kind === 'missingCandidateDetails') {
    return {
      title: 'Missing Candidate Details',
      output: [
        'AI detail check:',
        ...detailChecks.map(check => `- ${check.label}: ${check.status}${check.detail ? ` (${check.detail})` : ''}`),
        '',
        'Recruiter action list:',
        `Ask candidate to confirm work authorization, expected rate, availability, and whether they have direct ${job.department.toLowerCase()} or ${job.client} client experience.`,
        needsRecruiterFollowUp.length
          ? `Also verify: ${needsRecruiterFollowUp.map(check => check.label).join(', ')}.`
          : 'No major missing profile details detected.',
      ].join('\n'),
    };
  }

  if (kind === 'missingDetailsEmail') {
    return {
      title: 'Missing Details Email',
      output: `Subject: Quick details needed for ${job.title}\n\nHi ${candidate.name.split(' ')[0]},\n\nI am preparing your profile for ${job.title} with ${job.client}. Could you please confirm or share details for: ${formatList(missingDetails)}?\n\nAlso please confirm your availability, current/expected rate, work authorization, and whether ${job.location} works for you.\n\nThanks,\n${candidate.recruiter}`,
    };
  }

  if (kind === 'resumeImprovements') {
    return {
      title: 'Resume Improvement Points',
      output: [
        `1. Add the strongest matching JD keywords near the top: ${formatList(job.requirements.slice(0, 4))}.`,
        `2. Add measurable outcomes for recent ${job.department.toLowerCase()} projects, especially scale, performance, cost, or delivery impact.`,
        `3. Clarify missing or weak areas: ${formatList(missingDetails)}.`,
        `4. Place work authorization, availability, location preference, and expected rate in an easy recruiter-visible section.`,
        `5. Add client/domain examples that map directly to ${job.description}`,
      ].join('\n'),
    };
  }

  if (kind === 'linkedInOutreach') {
    return {
      title: 'LinkedIn Outreach Message',
      output: `Hi ${candidate.name.split(' ')[0]}, I came across your ${candidate.title} profile and your background in ${topSkills} looks relevant for a ${job.title} opening with ${job.client}. The role is ${job.location} and focuses on ${job.requirements.slice(0, 3).join(', ')}. Would you be open to a quick conversation today?`,
    };
  }

  return {
    title: 'Interview Prep Notes',
    output: [
      `${candidate.name} should prepare for ${job.title} by reviewing ${job.requirements.slice(0, 4).join(', ')} and recent projects that prove hands-on delivery.`,
      `Likely strengths: ${formatList(matchedRows.slice(0, 4).map(row => row.requirement))}.`,
      `Likely follow-up areas: ${formatList([...missingRows, ...partialRows].slice(0, 5).map(row => row.requirement))}.`,
      `Prep the candidate to explain availability (${candidate.availability}), expected rate (${candidate.expectedPayRate}), location fit (${candidate.location}; ${candidate.relocationPreference}), and work authorization (${candidate.workAuthorization}).`,
    ].join('\n\n'),
  };
}

function validateResumeForJob(candidate: EnrichedCandidate, job: typeof jobs[number]): ResumeValidation {
  const mandatorySkills = job.requirements.slice(0, 3);
  const preferredSkills = job.requirements.slice(3);
  const matchedMandatory = mandatorySkills.filter(requirement => skillMatches(candidate, requirement));
  const matchedPreferred = preferredSkills.filter(requirement => skillMatches(candidate, requirement));
  const mandatorySkillsMatch = percentage(matchedMandatory.length, mandatorySkills.length);
  const preferredSkillsMatch = percentage(matchedPreferred.length, preferredSkills.length);
  const requiredYears = Number(job.requirements.join(' ').match(/(\d+)\+?\s*years?/i)?.[1] ?? 5);
  const experienceMatch = Math.min(100, Math.round((candidate.relevantExperience / requiredYears) * 100));
  const domainMatch = candidate.title.toLowerCase().includes(job.department.toLowerCase()) ||
    job.title.toLowerCase().split(/\s+/).some(part => candidate.title.toLowerCase().includes(part))
    ? 90
    : 70;
  const locationMatch = job.location.toLowerCase().includes('remote') ||
    candidate.relocationPreference !== 'Local only' ||
    job.location.split(',').pop()?.trim() === candidate.location.split(',').pop()?.trim()
    ? 100
    : 55;
  const visaMatch = candidate.workAuthorization === 'US Citizen' || candidate.workAuthorization === 'Green Card' || candidate.visaType === 'No sponsorship needed'
    ? 100
    : job.description.toLowerCase().includes('sponsor') ? 80 : 60;
  const educationMatch = candidate.education.toLowerCase().includes('bachelor') || candidate.education.toLowerCase().includes('degree') ? 100 : 70;
  const certificationMatch = candidate.certifications.toLowerCase().includes('certified') || !job.requirements.join(' ').toLowerCase().includes('cert') ? 90 : 60;
  const weightedScore = Math.round(
    mandatorySkillsMatch * 0.30 +
    preferredSkillsMatch * 0.15 +
    experienceMatch * 0.15 +
    domainMatch * 0.10 +
    locationMatch * 0.10 +
    visaMatch * 0.10 +
    educationMatch * 0.05 +
    certificationMatch * 0.05
  );
  const missingMandatorySkills = mandatorySkills.filter(requirement => !matchedMandatory.includes(requirement));
  const missingPreferredSkills = preferredSkills.filter(requirement => !matchedPreferred.includes(requirement));
  const weakAreas = [
    mandatorySkillsMatch < 80 ? 'Mandatory skill coverage needs recruiter review.' : '',
    preferredSkillsMatch < 70 ? 'Preferred skills are only partially represented.' : '',
    experienceMatch < 80 ? `Relevant experience is below the ${requiredYears}+ year target.` : '',
    visaMatch < 80 ? 'Visa/work authorization may require client confirmation.' : '',
    locationMatch < 80 ? 'Location or relocation preference may not align.' : '',
  ].filter(Boolean);
  const redFlags = [
    missingMandatorySkills.length ? `Missing mandatory skills: ${missingMandatorySkills.join(', ')}.` : '',
    visaMatch < 70 ? 'Work authorization risk for this role.' : '',
    experienceMatch < 65 ? 'Experience appears materially below requirement.' : '',
  ].filter(Boolean);

  return {
    candidateName: candidate.name,
    jobTitle: job.title,
    overallMatch: weightedScore,
    mandatorySkillsMatch,
    preferredSkillsMatch,
    experienceMatch,
    domainMatch,
    locationMatch,
    visaMatch,
    educationMatch,
    certificationMatch,
    missingMandatorySkills,
    missingPreferredSkills,
    weakAreas: weakAreas.length ? weakAreas : ['No major weak areas detected.'],
    redFlags: redFlags.length ? redFlags : ['No major red flags detected.'],
    improvementSuggestions: [
      'Add measurable project outcomes tied to the mandatory skills.',
      'Move the strongest matching technologies into the top resume summary.',
      'Clarify work authorization and availability near the top of the resume.',
      'Add recent client/domain examples relevant to the job description.',
    ],
    recruiterSummary: `${candidate.name} is a ${recommendationFromScore(weightedScore).toLowerCase()} for ${job.title} with ${mandatorySkillsMatch}% mandatory skill coverage and ${experienceMatch}% experience alignment.`,
    clientSubmissionSummary: `${candidate.name} brings ${candidate.relevantExperience} years of relevant experience, strengths in ${candidate.skills.slice(0, 4).join(', ')}, and ${candidate.workAuthorization} work authorization. Overall match: ${weightedScore}%.`,
    screeningQuestions: [
      `Can you describe recent hands-on work with ${mandatorySkills[0] ?? job.title}?`,
      `How many years of production experience do you have with ${mandatorySkills[1] ?? 'the required stack'}?`,
      `Are you comfortable with the role location/work model: ${job.location}?`,
      `Can you confirm your work authorization and expected pay rate?`,
      `Which project best demonstrates your fit for ${job.title}?`,
    ],
    finalRecommendation: recommendationFromScore(weightedScore),
  };
}

function enrichCandidate(candidate: Candidate, index: number): EnrichedCandidate {
  const matchedJob = findBestJobForCandidate(candidate);
  const docs = complianceDocs.filter(doc => doc.candidateId === candidate.id);
  const documentChecklist = [
    { label: 'Resume', status: candidate.resume ? 'Complete' : 'Complete' },
    { label: 'Work authorization', status: docs.some(doc => doc.docType.includes('Authorization')) ? 'Complete' : 'Pending' },
    { label: 'I-9 / Identity', status: docs.some(doc => doc.docType.includes('I-9')) ? 'Complete' : 'Missing' },
    { label: 'Background check', status: docs.some(doc => doc.docType.includes('Background')) ? 'Complete' : 'Pending' },
  ] as EnrichedCandidate['documentChecklist'];

  return {
    ...candidate,
    currentEmployer: 'Not provided',
    workAuthorization: index % 3 === 0 ? 'US Citizen' : index % 3 === 1 ? 'Green Card' : 'H-1B',
    visaType: index % 3 === 2 ? 'H-1B transfer' : 'No sponsorship needed',
    relevantExperience: Math.max(1, candidate.experience - 1),
    currentPayRate: candidate.salary.split('–')[0] ?? candidate.salary,
    expectedPayRate: candidate.salary,
    relocationPreference: index % 2 === 0 ? 'Open to relocate' : 'Remote only',
    resumeUpload: candidate.resume ?? `${candidate.name.replace(/\s+/g, '_')}_Resume.pdf`,
    parsedResumeDetails: `${candidate.title}; ${candidate.experience} years total experience; ${Math.max(1, candidate.experience - 1)} years relevant experience; skills include ${candidate.skills.join(', ')}.`,
    education: index % 2 === 0 ? 'B.S. Computer Science' : 'Bachelor degree or equivalent experience',
    certifications: index % 3 === 0 ? 'AWS Certified Solutions Architect' : index % 3 === 1 ? 'Scrum Master Certified' : 'Role-specific certification preferred',
    documentChecklist,
    aiMatchScore: Math.min(98, 72 + candidate.rating * 4),
    aiMatchedJob: matchedJob.title,
  };
}

export default function CandidateProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const currentCandidateRows = getAllCandidates();
  const candidateSource = currentCandidateRows.length ? currentCandidateRows : candidates;
  const baseIndex = Math.max(0, candidateSource.findIndex(candidate => candidate.id === id));
  const [candidate, setCandidate] = useState(() => enrichCandidate(candidateSource[baseIndex] ?? candidateSource[0] ?? fallbackCandidate, baseIndex));
  const [candSubmissions, setCandSubmissions] = useState(() => getAllSubmissions().filter(submission => submission.candidateId === candidate.id));
  const [candInterviews, setCandInterviews] = useState(() => interviews.filter(interview => interview.candidateId === candidate.id));
  const [callHistory, setCallHistory] = useState(() => getCandidateCallLogs(candidate.id));
  const [action, setAction] = useState<ProfileAction>(null);
  const [notice, setNotice] = useState('Candidate profile ready.');
  const initialComparisonJob = findBestJobForCandidate(candidate);
  const [comparisonJobId, setComparisonJobId] = useState(initialComparisonJob.id);
  const [assignmentJobId, setAssignmentJobId] = useState(initialComparisonJob.id);
  const [assignments, setAssignments] = useState<CandidateJobAssignment[]>(() => createInitialAssignments(candidate));
  const comparisonJob = jobs.find(job => job.id === comparisonJobId) ?? initialComparisonJob;
  const comparisonRows = compareResumeToJob(candidate, comparisonJob);
  const [resumeValidation, setResumeValidation] = useState<ResumeValidation>(() => validateResumeForJob(candidate, initialComparisonJob));
  const [resumeQualityChecks, setResumeQualityChecks] = useState<ResumeQualityCheck[]>(() =>
    analyzeResumeQuality(candidate, initialComparisonJob, compareResumeToJob(candidate, initialComparisonJob))
  );
  const [fraudRedFlags, setFraudRedFlags] = useState<FraudRedFlagCheck[]>(() =>
    analyzeFraudRedFlags(candidate, initialComparisonJob, compareResumeToJob(candidate, initialComparisonJob), validateResumeForJob(candidate, initialComparisonJob))
  );
  const [fraudAuditLogs, setFraudAuditLogs] = useState<FraudAuditLog[]>(() => [{
    id: `audit-${Date.now()}`,
    timestamp: new Date().toISOString(),
    action: 'Initial red-flag scan',
    actor: 'AI warning module',
    explanation: 'Initial scan generated recruiter warnings only. No automated rejection or status change was applied.',
  }]);
  const [generatedSummary, setGeneratedSummary] = useState<GeneratedCandidateSummary>(() =>
    generateCandidateSummary('recruiter', candidate, comparisonJob, resumeValidation, comparisonRows)
  );
  const candTasks = tasks.filter(task => task.relatedTo === candidate.name);
  const stepIndex = statusSteps.indexOf(candidate.status);

  function record(message: string) {
    setNotice(message);
  }

  function persistCandidate(candidateRow: EnrichedCandidate) {
    const localRows = readLocalRows<Candidate>(LOCAL_CANDIDATES_KEY);
    const normalizedCandidate = {
      ...candidateRow,
      expectedRate: candidateRow.expectedPayRate,
      currentRate: candidateRow.currentPayRate,
      updatedAt: new Date().toISOString().slice(0, 10),
    };
    const nextRows = [normalizedCandidate, ...localRows.filter(row => row.id !== normalizedCandidate.id)];
    window.localStorage.setItem(LOCAL_CANDIDATES_KEY, JSON.stringify(nextRows));
    void saveRows('candidates', nextRows as Candidate[]);
  }

  function ensureOnboarding(jobId: string, reason: string) {
    const existingCases = loadOnboardingCases();
    if (existingCases.some(item => item.candidateId === candidate.id && item.jobId === jobId)) return;
    const nextCase = createOnboardingCase(candidate.id, jobId);
    const complianceCase = createComplianceCase(candidate.id, jobId);
    if (nextCase) saveOnboardingCases([nextCase, ...existingCases]);
    if (complianceCase) saveComplianceCases([complianceCase, ...loadComplianceCases()]);
    record(`${reason} Onboarding and compliance case started for ${candidate.name}.`);
  }

  async function persistSubmission(submission: Submission) {
    const result = await createSubmissionRecord(submission);
    if (!result.ok) {
      record(result.message);
      return false;
    }
    setCandSubmissions(result.rows.filter(item => item.candidateId === candidate.id));
    return true;
  }

  function startCandidateCall() {
    const opened = openCandidateDialer(candidate.phone);
    const log = saveCandidateCallLog({
      candidateId: candidate.id,
      candidateName: candidate.name,
      phone: candidate.phone,
      outcome: 'Initiated',
      startedAt: new Date().toISOString(),
      durationSeconds: 0,
      notes: opened ? 'ATS quick-call dialer opened from candidate profile.' : 'No phone number available to dial.',
    });
    setCallHistory(previous => [log, ...previous]);
    record(opened ? `Dialer opened for ${candidate.name} at ${candidate.phone}.` : `No phone number added for ${candidate.name}.`);
  }

  function saveProfileCall(outcome: CallOutcome, durationSeconds: number, notes: string) {
    const endedAt = new Date().toISOString();
    const log = saveCandidateCallLog({
      candidateId: candidate.id,
      candidateName: candidate.name,
      phone: candidate.phone,
      outcome,
      startedAt: new Date(Date.now() - durationSeconds * 1000).toISOString(),
      endedAt,
      durationSeconds,
      notes,
    });
    setCallHistory(previous => [log, ...previous]);
    record(`Call logged for ${candidate.name}: ${outcome}, ${formatCallDuration(durationSeconds)}.`);
  }

  function sameClientSubmissionAlert(jobId: string) {
    const selectedJob = jobs.find(job => job.id === jobId) ?? jobs[0];
    return candSubmissions.find(submission => submission.clientId === selectedJob.clientId && submission.jobId !== selectedJob.id);
  }

  function assignmentForJob(jobId: string) {
    return assignments.find(assignment => assignment.jobId === jobId);
  }

  function upsertAssignment(jobId: string, stage: CandidateJobStage, source: CandidateJobAssignment['source']) {
    setAssignments(previous => {
      if (previous.some(assignment => assignment.jobId === jobId)) {
        return previous.map(assignment => assignment.jobId === jobId ? { ...assignment, stage } : assignment);
      }

      return [
        {
          jobId,
          stage,
          assignedAt: new Date().toISOString().slice(0, 10),
          source,
        },
        ...previous,
      ];
    });
  }

  function assignCandidateToJob(jobId: string) {
    const selectedJob = jobs.find(job => job.id === jobId) ?? jobs[0];
    const duplicateAssignment = assignmentForJob(jobId);
    const duplicateSubmission = candSubmissions.find(submission => submission.jobId === jobId);
    const sameClientSubmission = sameClientSubmissionAlert(jobId);

    if (duplicateAssignment || duplicateSubmission) {
      record(`Duplicate prevented: ${candidate.name} is already assigned or submitted to ${selectedJob.title}.`);
      return;
    }

    upsertAssignment(jobId, 'Sourced', 'Manual');
    setComparisonJobId(jobId);
    setResumeValidation(validateResumeForJob(candidate, selectedJob));
    record(sameClientSubmission
      ? `Assigned to ${selectedJob.title}. Alert: candidate was already submitted to ${sameClientSubmission.clientName} for ${sameClientSubmission.jobTitle}.`
      : `Assigned ${candidate.name} to ${selectedJob.title}.`);
  }

  function updateAssignmentStage(jobId: string, stage: CandidateJobStage) {
    const selectedJob = jobs.find(job => job.id === jobId) ?? jobs[0];
    upsertAssignment(jobId, stage, 'Manual');
    record(`${selectedJob.title} stage updated to ${stage}.`);
  }

  async function submitCandidateToJob(jobId: string) {
    const selectedJob = jobs.find(job => job.id === jobId) ?? jobs[0];
    const duplicateSubmission = candSubmissions.find(submission => submission.jobId === jobId);
    const sameClientSubmission = sameClientSubmissionAlert(jobId);

    if (duplicateSubmission) {
      record(`Duplicate submission blocked: ${duplicateSubmissionMessage(duplicateSubmission)}`);
      return;
    }

    const submission: Submission = {
      id: `s${Date.now()}`,
      candidateId: candidate.id,
      candidateName: candidate.name,
      jobId: selectedJob.id,
      jobTitle: selectedJob.title,
      clientId: selectedJob.clientId,
      clientName: selectedJob.client,
      status: 'Submitted',
      submittedDate: new Date().toISOString().slice(0, 10),
      recruiter: candidate.recruiter,
      rate: candidate.expectedPayRate,
      payRate: candidate.expectedPayRate,
      billRate: selectedJob.salary,
      rtrStatus: 'Requested',
      resumeVersion: candidate.resume ?? `${candidate.name.replace(/\s+/g, '_')}_Resume.pdf`,
      clientFeedback: 'Awaiting client feedback.',
      interviewRounds: 'Not started',
      offerStatus: 'Not Started',
      joiningStatus: 'Not Started',
      notes: sameClientSubmission
        ? `Auto-alert: previously submitted to ${sameClientSubmission.clientName} for ${sameClientSubmission.jobTitle}.`
        : 'Submitted from candidate assignment workflow.',
    };

    const saved = await persistSubmission(submission);
    if (!saved) return;
    setCandidate(previous => {
      const nextCandidate = { ...previous, status: 'Screening' as CandidateStatus };
      persistCandidate(nextCandidate);
      return nextCandidate;
    });
    upsertAssignment(jobId, 'Submitted to Client', 'Manual');
    record(sameClientSubmission
      ? `Submitted to ${selectedJob.title}. Alert: prior submission exists for ${sameClientSubmission.clientName}.`
      : `${candidate.name} submitted to ${selectedJob.title}.`);
  }

  function runResumeParse() {
    const parsedResumeDetails = [
      `${candidate.name} resume parsed successfully.`,
      `Detected ${candidate.title} profile at ${candidate.currentEmployer}.`,
      `${candidate.relevantExperience} years relevant experience from ${candidate.experience} years total.`,
      `Core skills: ${candidate.skills.join(', ')}.`,
      `Education: ${candidate.education}.`,
      `Certifications: ${candidate.certifications}.`,
    ].join(' ');

    setCandidate(previous => ({
      ...previous,
      parsedResumeDetails,
      documentChecklist: previous.documentChecklist.map(document =>
        document.label === 'Resume' ? { ...document, status: 'Complete' } : document
      ),
    }));
    record(`AI resume parsing completed for ${candidate.name}.`);
  }

  function runAIMatch() {
    const matchedJob = findBestJobForCandidate(candidate);
    const aiMatchScore = Math.min(98, 70 + candidate.skills.length * 4 + candidate.rating * 2);
    setCandidate(previous => ({ ...previous, aiMatchedJob: matchedJob.title, aiMatchScore }));
    setComparisonJobId(matchedJob.id);
    upsertAssignment(matchedJob.id, 'AI Validated', 'AI Match');
    record(`AI matched ${candidate.name} to ${matchedJob.title} at ${aiMatchScore}%.`);
  }

  function runResumeValidation(jobId: string) {
    const selectedJob = jobs.find(job => job.id === jobId) ?? jobs[0];
    const validation = validateResumeForJob(candidate, selectedJob);
    setResumeValidation(validation);
    setComparisonJobId(selectedJob.id);
    upsertAssignment(selectedJob.id, 'AI Validated', 'AI Match');
    setCandidate(previous => ({
      ...previous,
      aiMatchedJob: selectedJob.title,
      aiMatchScore: validation.overallMatch,
      documentChecklist: previous.documentChecklist.map(document =>
        document.label === 'Resume' ? { ...document, status: 'Complete' } : document
      ),
    }));
    record(`AI resume validation completed for ${candidate.name} against ${selectedJob.title}: ${validation.overallMatch}% ${validation.finalRecommendation}.`);
  }

  function downloadResume() {
    const contents = [
      candidate.name,
      candidate.title,
      candidate.email,
      candidate.phone,
      '',
      candidate.parsedResumeDetails,
      '',
      `Skills: ${candidate.skills.join(', ')}`,
    ].join('\n');
    const blob = new Blob([contents], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = candidate.resumeUpload.replace(/\.[^.]+$/, '.txt');
    anchor.click();
    URL.revokeObjectURL(url);
    record(`${candidate.resumeUpload} downloaded.`);
  }

  function updateDocument(label: string) {
    setCandidate(previous => ({
      ...previous,
      documentChecklist: previous.documentChecklist.map(document =>
        document.label === label ? { ...document, status: 'Complete' } : document
      ),
    }));
    record(`${label} marked complete.`);
  }

  function runSummaryGenerator(kind: CandidateSummaryKind) {
    const validation = validateResumeForJob(candidate, comparisonJob);
    const rows = compareResumeToJob(candidate, comparisonJob);
    const output = generateCandidateSummary(kind, candidate, comparisonJob, validation, rows);

    setResumeValidation(validation);
    setGeneratedSummary(output);
    record(`${output.title} generated for ${candidate.name} against ${comparisonJob.title}.`);
  }

  function runResumeQualityCheck() {
    const rows = compareResumeToJob(candidate, comparisonJob);
    const qualityChecks = analyzeResumeQuality(candidate, comparisonJob, rows);
    const issueCount = qualityChecks.filter(check => check.status === 'Issue').length;
    const reviewCount = qualityChecks.filter(check => check.status === 'Needs Review').length;

    setResumeQualityChecks(qualityChecks);
    record(`Resume Quality / ATS Formatting Checker completed: ${issueCount} issues and ${reviewCount} items need review.`);
  }

  function runFraudRedFlagDetection() {
    const validation = validateResumeForJob(candidate, comparisonJob);
    const rows = compareResumeToJob(candidate, comparisonJob);
    const flags = analyzeFraudRedFlags(candidate, comparisonJob, rows, validation);
    const elevatedCount = flags.filter(flag => flag.severity === 'Elevated').length;
    const reviewCount = flags.filter(flag => flag.severity === 'Review').length;

    setFraudRedFlags(flags);
    setFraudAuditLogs(previous => [{
      id: `audit-${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'AI fraud / red-flag scan',
      actor: 'AI warning module',
      explanation: `Generated ${elevatedCount} elevated warnings and ${reviewCount} review warnings for recruiter review only. No automated rejection, ranking penalty, or candidate status change was applied.`,
    }, ...previous]);
    record(`AI Fraud / Red Flag Detection completed: ${elevatedCount} elevated warnings and ${reviewCount} review warnings. Recruiter review only.`);
  }

  const selectedAssignmentJob = jobs.find(job => job.id === assignmentJobId) ?? initialComparisonJob;
  const selectedAssignment = assignmentForJob(selectedAssignmentJob.id);
  const selectedDuplicateSubmission = candSubmissions.find(submission => submission.jobId === selectedAssignmentJob.id);
  const selectedSameClientSubmission = sameClientSubmissionAlert(selectedAssignmentJob.id);
  const rankedJobsForCandidate = jobs
    .map(job => ({
      job,
      matchScore: matchScoreForJob(candidate, job),
      ranking: rankingForJob(candidate, job),
    }))
    .sort((first, second) => second.matchScore - first.matchScore);

  return (
    <div className="p-6 space-y-5">
      <button onClick={() => navigate('/candidates')} className="inline-flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-white">
        <ArrowLeft size={15} />
        Back to Candidates
      </button>

      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="rounded-lg border border-white/5 bg-[#0d1729] p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 text-xl font-bold text-white">
                {candidate.name.split(' ').map(part => part[0]).join('')}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg font-bold text-white">{candidate.name}</h1>
                  <span className={cn('rounded-full border px-2.5 py-1 text-xs font-medium', statusColors[candidate.status])}>{candidate.status}</span>
                </div>
                <p className="mt-0.5 text-sm text-slate-400">{candidate.title}</p>
                <div className="mt-1 flex items-center gap-1">
                  {[...Array(5)].map((_, index) => (
                    <Star key={index} size={12} className={index < candidate.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-700'} />
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-2.5">
              <Contact icon={<Mail size={13} />} value={candidate.email} />
              <Contact icon={<Phone size={13} />} value={candidate.phone} />
              <Contact icon={<LinkIcon size={13} />} value={candidate.linkedin ?? 'LinkedIn URL not added'} />
              <Contact icon={<MapPin size={13} />} value={candidate.location} />
              <Contact icon={<Briefcase size={13} />} value={candidate.currentEmployer} />
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button onClick={() => setAction('submit')} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-xs font-medium text-white transition-colors hover:bg-blue-500">
                <Send size={12} />
                Submit
              </button>
              <button onClick={() => setAction('call')} className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 text-xs font-medium text-white transition-colors hover:bg-emerald-500">
                <Phone size={12} />
                Call Candidate
              </button>
              <button onClick={() => setAction('edit')} className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/5 py-2.5 text-xs font-medium text-slate-300 transition-colors hover:bg-white/10">
                <Pencil size={12} />
                Edit
              </button>
              <button onClick={() => setAction('upload')} className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/5 py-2.5 text-xs font-medium text-slate-300 transition-colors hover:bg-white/10">
                <Upload size={12} />
                Resume Upload
              </button>
              <button onClick={downloadResume} className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/5 py-2.5 text-xs font-medium text-slate-300 transition-colors hover:bg-white/10">
                <Download size={12} />
                Download
              </button>
              <button onClick={runResumeParse} className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/5 py-2.5 text-xs font-medium text-slate-300 transition-colors hover:bg-white/10">
                <Sparkles size={12} />
                AI Parse
              </button>
              <button onClick={runAIMatch} className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/5 py-2.5 text-xs font-medium text-slate-300 transition-colors hover:bg-white/10">
                <Bot size={12} />
                AI Match
              </button>
              <button onClick={() => setAction('validate')} className="col-span-2 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 text-xs font-medium text-white transition-colors hover:bg-emerald-500">
                <ShieldCheck size={12} />
                Resume Validation
              </button>
              <button onClick={() => setAction('compare')} className="col-span-2 inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-600 py-2.5 text-xs font-medium text-white transition-colors hover:bg-cyan-500">
                <ClipboardList size={12} />
                Resume vs JD Comparison
              </button>
              <button onClick={() => setAction('schedule')} className="col-span-2 inline-flex items-center justify-center gap-2 rounded-lg bg-white/5 py-2.5 text-xs font-medium text-slate-300 transition-colors hover:bg-white/10">
                <Calendar size={12} />
                Schedule Interview
              </button>
            </div>
          </motion.div>

          <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-300">Last action</p>
            <p className="mt-2 text-sm text-blue-100">{notice}</p>
          </div>

          <Section title="Call Timeline">
            <div className="space-y-2">
              {callHistory.length ? callHistory.slice(0, 5).map(log => (
                <div key={log.id} className="rounded-lg border border-white/5 bg-white/[0.03] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold text-white">{log.outcome}</p>
                    <p className="text-[10px] text-slate-600">{new Date(log.startedAt).toLocaleString()}</p>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{log.phone} · {formatCallDuration(log.durationSeconds)} · {log.recruiterName}</p>
                  {log.notes && <p className="mt-1 text-xs leading-relaxed text-slate-500">{log.notes}</p>}
                </div>
              )) : (
                <p className="text-xs leading-relaxed text-slate-500">No calls logged yet. Use Call Candidate to create the first phone timeline entry.</p>
              )}
            </div>
          </Section>

          <Section title="AI Candidate-Job Matching">
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">Best match</p>
              <p className="mt-2 text-sm font-semibold text-white">{candidate.aiMatchedJob}</p>
              <p className="mt-1 text-2xl font-bold text-emerald-200">{candidate.aiMatchScore}%</p>
              <p className="mt-2 text-xs leading-relaxed text-emerald-100/70">Contextual fit uses parsed resume skills, experience, authorization, availability, and role requirements.</p>
            </div>
          </Section>

          <Section title="AI Match Score Formula">
            <div className="space-y-2">
              {validationWeights.map(item => (
                <div key={item.label} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2">
                  <span className="text-xs text-slate-300">{item.label}</span>
                  <span className="text-xs font-semibold text-white">{item.weight}%</span>
                </div>
              ))}
            </div>
          </Section>
        </aside>

        <main className="space-y-4">
          <Section title="Candidate ATS Fields">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <Info label="Full name" value={candidate.name} />
              <Info label="Email" value={candidate.email} />
              <Info label="Phone" value={candidate.phone} />
              <Info label="LinkedIn URL" value={candidate.linkedin ?? 'Not added'} />
              <Info label="Current location" value={candidate.location} />
              <Info label="Work authorization" value={candidate.workAuthorization} />
              <Info label="Visa type" value={candidate.visaType} />
              <Info label="Availability" value={candidate.availability} />
              <Info label="Current employer" value={candidate.currentEmployer} />
              <Info label="Total experience" value={`${candidate.experience} years`} />
              <Info label="Relevant experience" value={`${candidate.relevantExperience} years`} />
              <Info label="Current pay rate" value={candidate.currentPayRate} />
              <Info label="Expected pay rate" value={candidate.expectedPayRate} />
              <Info label="Relocation preference" value={candidate.relocationPreference} />
              <Info label="Resume upload" value={candidate.resumeUpload} />
              <Info label="Education" value={candidate.education} />
              <Info label="Certifications" value={candidate.certifications} />
              <Info label="Candidate status" value={candidate.status} />
            </div>
          </Section>

          <Section title="Recruitment Pipeline">
            <div className="flex items-center">
              {statusSteps.map((step, index) => {
                const isActive = index === stepIndex;
                const isPast = index < stepIndex;
                return (
                  <div key={step} className="flex flex-1 items-center">
                    <div className="flex flex-col items-center">
                      <div className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all',
                        isActive ? 'border-blue-400 bg-blue-600' : isPast ? 'border-emerald-500 bg-emerald-600' : 'border-white/10 bg-white/5'
                      )}>
                        {isPast ? <CheckCircle2 size={14} className="text-white" /> : <span className="text-xs font-bold text-white">{index + 1}</span>}
                      </div>
                      <span className={cn('mt-1 text-[10px] font-medium', isActive ? 'text-blue-400' : isPast ? 'text-emerald-400' : 'text-slate-600')}>{step}</span>
                    </div>
                    {index < statusSteps.length - 1 && <div className={cn('mx-1 mb-4 h-0.5 flex-1', isPast ? 'bg-emerald-500' : 'bg-white/5')} />}
                  </div>
                );
              })}
            </div>
          </Section>

          <Section title="Candidate Assignment to Job">
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto_auto] xl:items-end">
              <SelectField label="Assign candidate to job" value={assignmentJobId} options={jobs.map(job => ({ label: `${job.title} · ${job.client}`, value: job.id }))} onChange={setAssignmentJobId} />
              <button onClick={() => assignCandidateToJob(assignmentJobId)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500">
                <Briefcase size={15} />
                Assign Candidate
              </button>
              <button onClick={() => submitCandidateToJob(assignmentJobId)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500">
                <Send size={15} />
                Submit to Job
              </button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <Info label="Candidate-job match score" value={`${matchScoreForJob(candidate, selectedAssignmentJob)}%`} />
              <Info label="Job-wise candidate ranking" value={`#${rankingForJob(candidate, selectedAssignmentJob)} of ${candidates.length}`} />
              <Info label="Candidate stage under that job" value={selectedAssignment?.stage ?? 'Not assigned'} />
              <Info label="Duplicate submission guard" value={selectedDuplicateSubmission ? `Blocked: submitted ${selectedDuplicateSubmission.submittedDate}` : 'Clear'} />
            </div>

            {selectedSameClientSubmission && (
              <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">Auto-alert: same client submission</p>
                <p className="mt-2 text-sm text-amber-100">{candidate.name} was already submitted to {selectedSameClientSubmission.clientName} for {selectedSameClientSubmission.jobTitle} on {selectedSameClientSubmission.submittedDate}.</p>
              </div>
            )}

            <div className="mt-4 grid gap-4">
              {assignments.map(assignment => {
                const job = jobs.find(jobRow => jobRow.id === assignment.jobId) ?? jobs[0];
                const duplicateSubmission = candSubmissions.find(submission => submission.jobId === job.id);
                const sameClientSubmission = sameClientSubmissionAlert(job.id);

                return (
                  <div key={assignment.jobId} className="rounded-lg border border-white/5 bg-white/[0.03] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{job.title}</p>
                        <p className="mt-1 text-xs text-slate-500">{job.client} · {job.location} · {assignment.source} · Assigned {assignment.assignedAt}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">{matchScoreForJob(candidate, job)}% match</span>
                        <span className="rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-300">Rank #{rankingForJob(candidate, job)}</span>
                        {duplicateSubmission && <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-300">Submitted {duplicateSubmission.submittedDate}</span>}
                      </div>
                    </div>

                    {sameClientSubmission && (
                      <p className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">Auto-alert: already submitted to same client for {sameClientSubmission.jobTitle}.</p>
                    )}

                    <div className="mt-4 grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)_auto] lg:items-center">
                      <SelectField label="Candidate stage under this job" value={assignment.stage} options={candidateJobStages.map(stage => ({ label: stage, value: stage }))} onChange={stage => updateAssignmentStage(job.id, stage as CandidateJobStage)} />
                      <CandidateJobPipeline stage={assignment.stage} />
                      <button onClick={() => submitCandidateToJob(job.id)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/10">
                        <Send size={14} />
                        Submit
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              <div className="rounded-lg border border-white/5 bg-white/[0.03] p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Job-wise candidate ranking</p>
                <div className="mt-3 space-y-2">
                  {rankedJobsForCandidate.slice(0, 5).map(row => (
                    <div key={row.job.id} className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.03] px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">{row.job.title}</p>
                        <p className="text-xs text-slate-500">{row.job.client}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-emerald-300">{row.matchScore}%</p>
                        <p className="text-xs text-slate-500">Rank #{row.ranking}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-white/5 bg-white/[0.03] p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Previous submission history</p>
                <div className="mt-3 space-y-2">
                  {candSubmissions.length ? candSubmissions.map(submission => (
                    <div key={submission.id} className="rounded-lg bg-white/[0.03] px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-white">{submission.jobTitle}</p>
                        <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] text-blue-300">{submission.status}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{submission.clientName} · {submission.submittedDate} · {submission.rate}</p>
                    </div>
                  )) : <p className="text-sm text-slate-600">No previous submissions yet.</p>}
                </div>
              </div>
            </div>
          </Section>

          <Section title="AI Resume Validation Output">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Info label="Candidate name" value={resumeValidation.candidateName} />
              <Info label="Job title matched against" value={resumeValidation.jobTitle} />
              <Info label="Overall match percentage" value={`${resumeValidation.overallMatch}%`} />
              <Info label="Final recommendation" value={resumeValidation.finalRecommendation} />
              <Info label="Mandatory skills match percentage" value={`${resumeValidation.mandatorySkillsMatch}%`} />
              <Info label="Preferred skills match percentage" value={`${resumeValidation.preferredSkillsMatch}%`} />
              <Info label="Experience match" value={`${resumeValidation.experienceMatch}%`} />
              <Info label="Domain match" value={`${resumeValidation.domainMatch}%`} />
              <Info label="Location match" value={`${resumeValidation.locationMatch}%`} />
              <Info label="Visa/work authorization match" value={`${resumeValidation.visaMatch}%`} />
              <Info label="Education match" value={`${resumeValidation.educationMatch}%`} />
              <Info label="Certification match" value={`${resumeValidation.certificationMatch}%`} />
            </div>
            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              <ValidationList title="Missing mandatory skills" items={resumeValidation.missingMandatorySkills} empty="No missing mandatory skills." />
              <ValidationList title="Missing preferred skills" items={resumeValidation.missingPreferredSkills} empty="No missing preferred skills." />
              <ValidationList title="Weak areas" items={resumeValidation.weakAreas} />
              <ValidationList title="Red flags" items={resumeValidation.redFlags} />
              <ValidationList title="Resume improvement suggestions" items={resumeValidation.improvementSuggestions} />
              <ValidationList title="Candidate screening questions" items={resumeValidation.screeningQuestions} />
            </div>
            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              <SummaryBlock title="Recruiter summary" value={resumeValidation.recruiterSummary} />
              <SummaryBlock title="Client submission summary" value={resumeValidation.clientSubmissionSummary} />
            </div>
          </Section>

          <Section title="AI Candidate Summary Generator">
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {summaryActions.map(action => (
                <button key={action.kind} onClick={() => runSummaryGenerator(action.kind)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/5 bg-white/[0.04] px-3 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:border-blue-500/30 hover:bg-blue-500/10 hover:text-white">
                  <Sparkles size={14} className="text-blue-300" />
                  {action.label}
                </button>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-blue-500/20 bg-blue-500/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-300">{generatedSummary.title}</p>
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-medium text-blue-100">{comparisonJob.title}</span>
              </div>
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-blue-50">{generatedSummary.output}</p>
            </div>
          </Section>

          <Section title="Resume Quality / ATS Formatting Checker">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div>
                <p className="text-sm text-slate-300">AI checks resume structure, ATS keyword quality, formatting risks, role terminology, dates, gaps, achievements, and copied JD stuffing patterns.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-300">{resumeQualityChecks.filter(check => check.status === 'Issue').length} issues</span>
                  <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-300">{resumeQualityChecks.filter(check => check.status === 'Needs Review').length} needs review</span>
                  <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">{resumeQualityChecks.filter(check => check.status === 'Pass').length} pass</span>
                </div>
              </div>
              <button onClick={runResumeQualityCheck} className="inline-flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-500">
                <ShieldCheck size={15} />
                Run ATS Formatting Check
              </button>
            </div>
            <ResumeQualityTable checks={resumeQualityChecks} />
          </Section>

          <Section title="AI Fraud / Red Flag Detection">
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">Recruiter warning only</p>
              <p className="mt-2 text-sm leading-relaxed text-amber-100">AI does not auto-reject candidates, change candidate status, or make hiring decisions. These signals are explainable warnings for human review, transparency, privacy, and fairness.</p>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-300">{fraudRedFlags.filter(flag => flag.severity === 'Elevated').length} elevated</span>
                <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-300">{fraudRedFlags.filter(flag => flag.severity === 'Review').length} review</span>
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">{fraudRedFlags.filter(flag => flag.severity === 'Clear').length} clear</span>
              </div>
              <button onClick={runFraudRedFlagDetection} className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-500">
                <ShieldCheck size={15} />
                Run Red Flag Detection
              </button>
            </div>
            <FraudRedFlagTable flags={fraudRedFlags} />
            <div className="mt-4 rounded-lg border border-white/5 bg-white/[0.03] p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Explainable audit logs</p>
              <div className="mt-3 space-y-2">
                {fraudAuditLogs.map(log => (
                  <div key={log.id} className="rounded-lg bg-white/[0.03] px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-white">{log.action}</p>
                      <span className="text-[10px] text-slate-500">{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{log.actor}</p>
                    <p className="mt-2 text-xs leading-relaxed text-slate-300">{log.explanation}</p>
                  </div>
                ))}
              </div>
            </div>
          </Section>

          <Section title="AI Resume vs JD Comparison Screen">
            <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <SelectField label="Compare resume against JD" value={comparisonJobId} options={jobs.map(job => ({ label: `${job.title} · ${job.client}`, value: job.id }))} onChange={jobId => {
                setComparisonJobId(jobId);
                const selectedJob = jobs.find(job => job.id === jobId) ?? jobs[0];
                setResumeValidation(validateResumeForJob(candidate, selectedJob));
              }} />
              <button onClick={() => setAction('compare')} className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-cyan-500">
                <ClipboardList size={15} />
                Open Comparison
              </button>
            </div>
            <ComparisonSummary rows={comparisonRows} job={comparisonJob} />
            <JDComparisonTable rows={comparisonRows} />
          </Section>

          <div className="grid gap-4 xl:grid-cols-2">
            <Section title="Parsed Resume Details">
              <p className="text-sm leading-relaxed text-slate-400">{candidate.parsedResumeDetails}</p>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Skills</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {candidate.skills.map(skill => (
                  <span key={skill} className="rounded-lg border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-xs text-blue-300">{skill}</span>
                ))}
              </div>
            </Section>

            <Section title="Document Checklist">
              <div className="space-y-2">
                {candidate.documentChecklist.map(document => (
                  <button key={document.label} onClick={() => updateDocument(document.label)} className="flex w-full items-center justify-between rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2.5 text-left transition-colors hover:bg-white/[0.06]">
                    <span className="inline-flex items-center gap-2 text-sm text-slate-300">
                      <ShieldCheck size={14} className="text-slate-500" />
                      {document.label}
                    </span>
                    <span className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-medium',
                      document.status === 'Complete' ? 'bg-emerald-500/10 text-emerald-300' :
                      document.status === 'Pending' ? 'bg-amber-500/10 text-amber-300' :
                      'bg-red-500/10 text-red-300'
                    )}>{document.status}</span>
                  </button>
                ))}
              </div>
            </Section>
          </div>

          <Section title="Previous Submissions">
            {candSubmissions.length === 0 ? (
              <p className="text-sm text-slate-600">No previous submissions yet.</p>
            ) : (
              <div className="space-y-3">
                {candSubmissions.map(submission => (
                  <div key={submission.id} className="rounded-lg border border-white/5 bg-white/[0.03] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-white">{submission.jobTitle}</p>
                        <p className="text-xs text-slate-500">{submission.clientName} · {submission.submittedDate}</p>
                      </div>
                      <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] text-blue-300">{submission.status}</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">{submission.notes}</p>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <div className="grid gap-4 xl:grid-cols-2">
            <Section title="Interviews">
              <div className="space-y-2">
                {candInterviews.map(interview => (
                  <div key={interview.id} className="rounded-lg border border-white/5 bg-white/[0.03] p-3">
                    <p className="text-sm font-medium text-white">{interview.jobTitle}</p>
                    <p className="mt-1 text-xs text-slate-500"><Calendar size={11} className="mr-1 inline" />{interview.date} · {interview.time} · {interview.type}</p>
                  </div>
                ))}
                {candInterviews.length === 0 && <p className="text-sm text-slate-600">No interviews scheduled.</p>}
              </div>
            </Section>

            <Section title="Recruiter Notes">
              <p className="text-sm leading-relaxed text-slate-400">{candidate.summary}</p>
              <div className="mt-4 space-y-2">
                {candTasks.map(task => (
                  <div key={task.id} className="rounded-lg border border-white/5 bg-white/[0.03] p-3">
                    <p className="text-sm text-white"><ClipboardList size={12} className="mr-1 inline text-slate-500" />{task.title}</p>
                    <p className="mt-1 text-xs text-slate-500">Due {task.dueDate} · {task.assignee}</p>
                  </div>
                ))}
              </div>
            </Section>
          </div>
        </main>
      </div>

      {action === 'submit' && (
        <SubmitPanel
          candidate={candidate}
          onClose={() => setAction(null)}
          onSubmit={jobId => {
            submitCandidateToJob(jobId);
            setAction(null);
          }}
        />
      )}
      {action === 'edit' && (
        <EditPanel
          candidate={candidate}
          onClose={() => setAction(null)}
          onSubmit={updates => {
            setCandidate(previous => {
              const nextCandidate = { ...previous, ...updates };
              persistCandidate(nextCandidate);
              if (nextCandidate.status === 'Offer' || nextCandidate.status === 'Placed') {
                ensureOnboarding(assignmentJobId, `Candidate status changed to ${nextCandidate.status}.`);
              }
              return nextCandidate;
            });
            record(`${candidate.name} profile updated.`);
            setAction(null);
          }}
        />
      )}
      {action === 'upload' && (
        <UploadPanel
          candidate={candidate}
          onClose={() => setAction(null)}
          onSubmit={(fileName, jobId) => {
            setCandidate(previous => ({
              ...previous,
              resumeUpload: fileName,
              documentChecklist: previous.documentChecklist.map(document =>
                document.label === 'Resume' ? { ...document, status: 'Complete' } : document
              ),
            }));
            const selectedJob = jobs.find(job => job.id === jobId) ?? jobs[0];
            const validationCandidate = { ...candidate, resumeUpload: fileName };
            const validation = validateResumeForJob(validationCandidate, selectedJob);
            setResumeValidation(validation);
            setComparisonJobId(selectedJob.id);
            setCandidate(previous => ({
              ...previous,
              aiMatchedJob: selectedJob.title,
              aiMatchScore: validation.overallMatch,
            }));
            record(`${fileName} uploaded and validated against ${selectedJob.title}: ${validation.overallMatch}% ${validation.finalRecommendation}.`);
            setAction(null);
          }}
        />
      )}
      {action === 'validate' && (
        <ResumeValidationPanel
          candidate={candidate}
          validation={resumeValidation}
          onClose={() => setAction(null)}
          onSubmit={jobId => {
            runResumeValidation(jobId);
            setAction(null);
          }}
        />
      )}
      {action === 'compare' && (
        <JDComparisonPanel
          candidate={candidate}
          jobId={comparisonJobId}
          onClose={() => setAction(null)}
          onChangeJob={jobId => {
            setComparisonJobId(jobId);
            const selectedJob = jobs.find(job => job.id === jobId) ?? jobs[0];
            setResumeValidation(validateResumeForJob(candidate, selectedJob));
            record(`AI Resume vs JD comparison refreshed for ${candidate.name} against ${selectedJob.title}.`);
          }}
        />
      )}
      {action === 'call' && (
        <CallPanel
          candidate={candidate}
          onClose={() => setAction(null)}
          onStart={startCandidateCall}
          onSubmit={(outcome, durationSeconds, notes) => {
            saveProfileCall(outcome, durationSeconds, notes);
            setAction(null);
          }}
        />
      )}
      {action === 'schedule' && (
        <SchedulePanel
          candidate={candidate}
          onClose={() => setAction(null)}
          onSubmit={(date, time, type) => {
            setCandInterviews(previous => [{
              id: `i${Date.now()}`,
              candidateId: candidate.id,
              candidateName: candidate.name,
              jobTitle: candidate.aiMatchedJob,
              clientName: jobs[0]?.client ?? 'Client',
              type,
              date,
              time,
              duration: '60 min',
              interviewer: 'Hiring Manager + Recruiter',
              status: 'Scheduled',
            }, ...previous]);
            setCandidate(previous => {
              const nextCandidate = { ...previous, status: 'Interview' as CandidateStatus };
              persistCandidate(nextCandidate);
              return nextCandidate;
            });
            record(`Interview scheduled for ${candidate.name} on ${date} at ${time}.`);
            setAction(null);
          }}
        />
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="rounded-lg border border-white/5 bg-[#0d1729] p-5">
      <h2 className="mb-4 text-sm font-semibold text-white">{title}</h2>
      {children}
    </motion.section>
  );
}

function Contact({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <div className="flex items-center gap-2.5 text-sm text-slate-400">
      <span className="text-slate-600">{icon}</span>
      <span className="min-w-0 truncate">{value}</span>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.03] p-3">
      <p className="text-[10px] uppercase tracking-wider text-slate-600">{label}</p>
      <p className="mt-1 text-sm font-medium text-white">{value || 'Not specified'}</p>
    </div>
  );
}

function ValidationList({ title, items, empty = 'No items found.' }: { title: string; items: string[]; empty?: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.03] p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</p>
      <div className="mt-3 space-y-2">
        {(items.length ? items : [empty]).map(item => (
          <p key={item} className="rounded-lg bg-white/[0.03] px-3 py-2 text-xs leading-relaxed text-slate-300">{item}</p>
        ))}
      </div>
    </div>
  );
}

function SummaryBlock({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.03] p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</p>
      <p className="mt-3 text-sm leading-relaxed text-slate-300">{value}</p>
    </div>
  );
}

function resumeQualityClass(status: ResumeQualityStatus) {
  if (status === 'Pass') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
  if (status === 'Needs Review') return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
  return 'border-red-500/30 bg-red-500/10 text-red-300';
}

function ResumeQualityTable({ checks }: { checks: ResumeQualityCheck[] }) {
  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-white/5">
      <div className="grid grid-cols-[1fr_130px_1.3fr_1.3fr] gap-0 bg-white/[0.04] px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500 max-lg:hidden">
        <span>Quality Check</span>
        <span>Status</span>
        <span>AI Finding</span>
        <span>Recruiter Action</span>
      </div>
      <div className="divide-y divide-white/5">
        {checks.map(check => (
          <div key={check.label} className="grid gap-3 px-4 py-4 lg:grid-cols-[1fr_130px_1.3fr_1.3fr] lg:items-start">
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600 lg:hidden">Quality Check</p>
              <p className="text-sm font-medium text-white">{check.label}</p>
            </div>
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600 lg:hidden">Status</p>
              <span className={cn('inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold', resumeQualityClass(check.status))}>{check.status}</span>
            </div>
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600 lg:hidden">AI Finding</p>
              <p className="text-sm leading-relaxed text-slate-300">{check.finding}</p>
            </div>
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600 lg:hidden">Recruiter Action</p>
              <p className="text-sm leading-relaxed text-slate-400">{check.action}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function fraudSeverityClass(severity: FraudFlagSeverity) {
  if (severity === 'Clear') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
  if (severity === 'Review') return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
  return 'border-red-500/30 bg-red-500/10 text-red-300';
}

function FraudRedFlagTable({ flags }: { flags: FraudRedFlagCheck[] }) {
  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-white/5">
      <div className="grid grid-cols-[1fr_120px_1.3fr_1.3fr] gap-0 bg-white/[0.04] px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500 max-lg:hidden">
        <span>Red-Flag Check</span>
        <span>Severity</span>
        <span>Explainable Evidence</span>
        <span>Recruiter Action</span>
      </div>
      <div className="divide-y divide-white/5">
        {flags.map(flag => (
          <div key={flag.label} className="grid gap-3 px-4 py-4 lg:grid-cols-[1fr_120px_1.3fr_1.3fr] lg:items-start">
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600 lg:hidden">Red-Flag Check</p>
              <p className="text-sm font-medium text-white">{flag.label}</p>
            </div>
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600 lg:hidden">Severity</p>
              <span className={cn('inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold', fraudSeverityClass(flag.severity))}>{flag.severity}</span>
            </div>
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600 lg:hidden">Explainable Evidence</p>
              <p className="text-sm leading-relaxed text-slate-300">{flag.evidence}</p>
            </div>
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600 lg:hidden">Recruiter Action</p>
              <p className="text-sm leading-relaxed text-slate-400">{flag.recruiterAction}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CandidateJobPipeline({ stage }: { stage: CandidateJobStage }) {
  const activeIndex = candidateJobStages.indexOf(stage);

  return (
    <div>
      <p className="mb-2 text-xs font-medium text-slate-400">Show candidate pipeline per job</p>
      <div className="grid grid-cols-5 gap-1 md:grid-cols-8 lg:grid-cols-[repeat(15,minmax(0,1fr))]">
        {candidateJobStages.map((pipelineStage, index) => (
          <div key={pipelineStage} title={pipelineStage} className={cn(
            'h-2 rounded-full',
            index < activeIndex ? 'bg-emerald-500' : index === activeIndex ? 'bg-blue-500' : 'bg-white/10'
          )} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {candidateJobStages.map((pipelineStage, index) => (
          <span key={pipelineStage} className={cn(
            'rounded-full px-2 py-0.5 text-[10px]',
            index === activeIndex ? 'bg-blue-500/15 text-blue-300' : index < activeIndex ? 'bg-emerald-500/10 text-emerald-300' : 'bg-white/[0.03] text-slate-600'
          )}>{index + 1}. {pipelineStage}</span>
        ))}
      </div>
    </div>
  );
}

function statusClass(status: JDComparisonRow['status']) {
  if (status === 'Matched') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
  if (status === 'Partial') return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
  return 'border-red-500/30 bg-red-500/10 text-red-300';
}

function ComparisonSummary({ rows, job }: { rows: JDComparisonRow[]; job: typeof jobs[number] }) {
  const matched = rows.filter(row => row.status === 'Matched').length;
  const partial = rows.filter(row => row.status === 'Partial').length;
  const missing = rows.filter(row => row.status === 'Missing').length;
  const score = Math.round(((matched + partial * 0.5) / rows.length) * 100);

  return (
    <div className="mb-4 grid gap-3 md:grid-cols-4">
      <Info label="JD selected" value={job.title} />
      <Info label="Comparison score" value={`${score}%`} />
      <Info label="Matched / partial" value={`${matched} matched · ${partial} partial`} />
      <Info label="Missing requirements" value={`${missing}`} />
    </div>
  );
}

function JDComparisonTable({ rows }: { rows: JDComparisonRow[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-white/5">
      <div className="grid grid-cols-[1.2fr_1.2fr_120px_1.4fr] gap-0 bg-white/[0.04] px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500 max-lg:hidden">
        <span>JD Requirement</span>
        <span>Found in Resume</span>
        <span>Status</span>
        <span>AI Comment</span>
      </div>
      <div className="divide-y divide-white/5">
        {rows.map(row => (
          <div key={row.requirement} className="grid gap-3 px-4 py-4 lg:grid-cols-[1.2fr_1.2fr_120px_1.4fr] lg:items-start">
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600 lg:hidden">JD Requirement</p>
              <p className="text-sm font-medium text-white">{row.requirement}</p>
            </div>
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600 lg:hidden">Found in Resume</p>
              <p className="text-sm leading-relaxed text-slate-300">{row.foundInResume}</p>
            </div>
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600 lg:hidden">Status</p>
              <span className={cn('inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold', statusClass(row.status))}>{row.status}</span>
            </div>
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600 lg:hidden">AI Comment</p>
              <p className="text-sm leading-relaxed text-slate-400">{row.aiComment}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Panel({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, x: 32 }} animate={{ opacity: 1, x: 0 }} className="h-full w-full max-w-2xl overflow-y-auto border-l border-white/10 bg-[#08111f] shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#08111f]/95 px-6 py-4 backdrop-blur">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button aria-label="Close" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white">
            <X size={16} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </motion.div>
    </div>
  );
}

function SubmitPanel({ candidate, onClose, onSubmit }: { candidate: EnrichedCandidate; onClose: () => void; onSubmit: (jobId: string) => void }) {
  const [jobId, setJobId] = useState(jobs[0]?.id ?? '');
  const selectedJob = jobs.find(job => job.id === jobId) ?? jobs[0];

  return (
    <Panel title={`Submit Candidate: ${candidate.name}`} onClose={onClose}>
      <div className="space-y-5">
        <SelectField label="Job" value={jobId} options={jobs.map(job => ({ label: `${job.title} · ${job.client}`, value: job.id }))} onChange={setJobId} />
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
          <p className="text-sm font-semibold text-white">{selectedJob.title}</p>
          <p className="mt-1 text-xs text-slate-500">{selectedJob.client} · {selectedJob.location} · {selectedJob.salary}</p>
          <p className="mt-3 text-xs text-slate-400">Candidate rate: {candidate.expectedPayRate}</p>
        </div>
        <button onClick={() => onSubmit(selectedJob.id)} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500">
          <Send size={16} />
          Submit Candidate
        </button>
      </div>
    </Panel>
  );
}

function EditPanel({ candidate, onClose, onSubmit }: { candidate: EnrichedCandidate; onClose: () => void; onSubmit: (updates: Partial<EnrichedCandidate>) => void }) {
  const [title, setTitle] = useState(candidate.title);
  const [status, setStatus] = useState<CandidateStatus>(candidate.status);
  const [location, setLocation] = useState(candidate.location);
  const [availability, setAvailability] = useState(candidate.availability);
  const [currentPayRate, setCurrentPayRate] = useState(candidate.currentPayRate);
  const [expectedPayRate, setExpectedPayRate] = useState(candidate.expectedPayRate);
  const [relocationPreference, setRelocationPreference] = useState(candidate.relocationPreference);
  const [summary, setSummary] = useState(candidate.summary);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit({ title, status, location, availability, currentPayRate, expectedPayRate, relocationPreference, summary });
  }

  return (
    <Panel title={`Edit Profile: ${candidate.name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Current title" value={title} onChange={setTitle} />
          <SelectField label="Candidate status" value={status} options={[
            { label: 'New', value: 'New' },
            { label: 'Screening', value: 'Screening' },
            { label: 'Interview', value: 'Interview' },
            { label: 'Offer', value: 'Offer' },
            { label: 'Placed', value: 'Placed' },
            { label: 'Rejected', value: 'Rejected' },
            { label: 'On Hold', value: 'On Hold' },
          ]} onChange={value => setStatus(value as CandidateStatus)} />
          <Field label="Current location" value={location} onChange={setLocation} />
          <Field label="Availability" value={availability} onChange={setAvailability} />
          <Field label="Current pay rate" value={currentPayRate} onChange={setCurrentPayRate} />
          <Field label="Expected pay rate" value={expectedPayRate} onChange={setExpectedPayRate} />
          <SelectField label="Relocation preference" value={relocationPreference} options={[
            { label: 'Open to relocate', value: 'Open to relocate' },
            { label: 'Remote only', value: 'Remote only' },
            { label: 'Hybrid only', value: 'Hybrid only' },
            { label: 'Local only', value: 'Local only' },
            { label: 'Not open to relocate', value: 'Not open to relocate' },
          ]} onChange={setRelocationPreference} />
        </div>
        <TextAreaField label="Recruiter notes" value={summary} onChange={setSummary} />
        <div className="grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={onClose} className="rounded-lg bg-white/5 px-4 py-3 text-sm text-slate-300 hover:bg-white/10">Cancel</button>
          <button type="submit" className="rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500">Save Profile</button>
        </div>
      </form>
    </Panel>
  );
}

function UploadPanel({ candidate, onClose, onSubmit }: { candidate: EnrichedCandidate; onClose: () => void; onSubmit: (fileName: string, jobId: string) => void }) {
  const [fileName, setFileName] = useState(candidate.resumeUpload);
  const [jobId, setJobId] = useState(jobs.find(job => job.title === candidate.aiMatchedJob)?.id ?? jobs[0]?.id ?? '');
  const selectedJob = jobs.find(job => job.id === jobId) ?? jobs[0];

  return (
    <Panel title={`Resume Upload: ${candidate.name}`} onClose={onClose}>
      <div className="space-y-5">
        <div className="rounded-lg border border-dashed border-white/15 bg-white/[0.03] p-8 text-center">
          <FileUp size={28} className="mx-auto mb-3 text-blue-300" />
          <p className="text-sm font-medium text-white">{fileName}</p>
          <p className="mt-1 text-xs text-slate-500">PDF, DOC, or DOCX resume</p>
        </div>
        <Field label="Resume file name" value={fileName} onChange={setFileName} />
        <SelectField label="Validate against job" value={jobId} options={jobs.map(job => ({ label: `${job.title} · ${job.client}`, value: job.id }))} onChange={setJobId} />
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">AI validation will run after upload</p>
          <p className="mt-2 text-sm font-medium text-white">{selectedJob.title}</p>
          <p className="mt-1 text-xs text-emerald-100/70">{selectedJob.client} · {selectedJob.location}</p>
        </div>
        <button onClick={() => onSubmit(fileName, jobId)} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500">
          <Upload size={16} />
          Upload & Validate Resume
        </button>
      </div>
    </Panel>
  );
}

function ResumeValidationPanel({
  candidate,
  validation,
  onClose,
  onSubmit,
}: {
  candidate: EnrichedCandidate;
  validation: ResumeValidation;
  onClose: () => void;
  onSubmit: (jobId: string) => void;
}) {
  const [jobId, setJobId] = useState(jobs.find(job => job.title === validation.jobTitle)?.id ?? jobs[0]?.id ?? '');
  const selectedJob = jobs.find(job => job.id === jobId) ?? jobs[0];

  return (
    <Panel title={`AI Resume Validation: ${candidate.name}`} onClose={onClose}>
      <div className="space-y-5">
        <SelectField label="Selected job" value={jobId} options={jobs.map(job => ({ label: `${job.title} · ${job.client}`, value: job.id }))} onChange={setJobId} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Info label="Candidate name" value={candidate.name} />
          <Info label="Job title matched against" value={selectedJob.title} />
          <Info label="Current resume" value={candidate.resumeUpload} />
          <Info label="Current recommendation" value={validation.finalRecommendation} />
        </div>
        <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-300">Weighted scoring formula</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {validationWeights.map(item => (
              <div key={item.label} className="flex items-center justify-between rounded-lg bg-white/[0.04] px-3 py-2">
                <span className="text-xs text-blue-100/80">{item.label}</span>
                <span className="text-xs font-semibold text-white">{item.weight}%</span>
              </div>
            ))}
          </div>
        </div>
        <button onClick={() => onSubmit(jobId)} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500">
          <ShieldCheck size={16} />
          Run Resume Validation
        </button>
      </div>
    </Panel>
  );
}

function JDComparisonPanel({
  candidate,
  jobId,
  onClose,
  onChangeJob,
}: {
  candidate: EnrichedCandidate;
  jobId: string;
  onClose: () => void;
  onChangeJob: (jobId: string) => void;
}) {
  const [selectedJobId, setSelectedJobId] = useState(jobId);
  const selectedJob = jobs.find(job => job.id === selectedJobId) ?? jobs[0];
  const rows = compareResumeToJob(candidate, selectedJob);

  function handleJobChange(nextJobId: string) {
    setSelectedJobId(nextJobId);
    onChangeJob(nextJobId);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 p-4 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden rounded-lg border border-white/10 bg-[#08111f] shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">AI Resume vs JD Comparison Screen</p>
            <h2 className="mt-1 text-lg font-semibold text-white">{candidate.name} · {selectedJob.title}</h2>
          </div>
          <button aria-label="Close" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white">
            <X size={16} />
          </button>
        </div>
        <div className="overflow-y-auto p-5">
          <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <SelectField label="JD Requirement source" value={selectedJobId} options={jobs.map(job => ({ label: `${job.title} · ${job.client}`, value: job.id }))} onChange={handleJobChange} />
            <div className="rounded-lg border border-white/5 bg-white/[0.03] p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-600">Resume being compared</p>
              <p className="mt-1 text-sm font-medium text-white">{candidate.resumeUpload}</p>
              <p className="mt-1 text-xs text-slate-500">{candidate.title} · {candidate.location}</p>
            </div>
          </div>
          <ComparisonSummary rows={rows} job={selectedJob} />
          <JDComparisonTable rows={rows} />
        </div>
      </motion.div>
    </div>
  );
}

function SchedulePanel({
  candidate,
  onClose,
  onSubmit,
}: {
  candidate: EnrichedCandidate;
  onClose: () => void;
  onSubmit: (date: string, time: string, type: 'Phone' | 'Video' | 'On-site' | 'Technical') => void;
}) {
  const [date, setDate] = useState('2026-05-14');
  const [time, setTime] = useState('10:00');
  const [type, setType] = useState<'Phone' | 'Video' | 'On-site' | 'Technical'>('Video');

  return (
    <Panel title={`Schedule Interview: ${candidate.name}`} onClose={onClose}>
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date" type="date" value={date} onChange={setDate} />
          <Field label="Time" type="time" value={time} onChange={setTime} />
          <SelectField label="Interview type" value={type} options={[
            { label: 'Phone', value: 'Phone' },
            { label: 'Video', value: 'Video' },
            { label: 'On-site', value: 'On-site' },
            { label: 'Technical', value: 'Technical' },
          ]} onChange={value => setType(value as 'Phone' | 'Video' | 'On-site' | 'Technical')} />
          <Field label="Interviewer" value="Hiring Manager + Recruiter" onChange={() => undefined} />
        </div>
        <button onClick={() => onSubmit(date, time, type)} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500">
          <Calendar size={16} />
          Schedule Interview
        </button>
      </div>
    </Panel>
  );
}

function CallPanel({
  candidate,
  onClose,
  onStart,
  onSubmit,
}: {
  candidate: EnrichedCandidate;
  onClose: () => void;
  onStart: () => void;
  onSubmit: (outcome: CallOutcome, durationSeconds: number, notes: string) => void;
}) {
  const [outcome, setOutcome] = useState<CallOutcome>('Completed');
  const [minutes, setMinutes] = useState('0');
  const [seconds, setSeconds] = useState('0');
  const [notes, setNotes] = useState('');
  const durationSeconds = Math.max(0, (Number(minutes) || 0) * 60 + (Number(seconds) || 0));

  return (
    <Panel title={`Call Candidate: ${candidate.name}`} onClose={onClose}>
      <div className="space-y-5">
        <div className="rounded-lg border border-white/5 bg-white/[0.03] p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Phone number</p>
          <p className="mt-1 text-lg font-semibold text-white">{candidate.phone || 'No phone number added'}</p>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">This opens the device phone app now. Automatic duration/recording can be connected later through a telephony provider webhook.</p>
        </div>
        <button disabled={!candidate.phone} onClick={onStart} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50">
          <Phone size={16} />
          Start Call
        </button>
        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField label="Outcome" value={outcome} options={['Completed', 'No Answer', 'Left Voicemail', 'Busy', 'Wrong Number'].map(value => ({ label: value, value }))} onChange={value => setOutcome(value as CallOutcome)} />
          <Field label="Duration minutes" type="number" value={minutes} onChange={setMinutes} />
          <Field label="Duration seconds" type="number" value={seconds} onChange={setSeconds} />
        </div>
        <TextAreaField label="Call notes" value={notes} onChange={setNotes} />
        <button onClick={() => onSubmit(outcome, durationSeconds, notes)} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500">
          <CheckCircle2 size={16} />
          Save Call Timeline
        </button>
      </div>
    </Panel>
  );
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-400">{label}</span>
      <input type={type} value={value} onChange={event => onChange(event.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none transition-all focus:border-blue-500/60" />
    </label>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: Array<{ label: string; value: string }>; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-400">{label}</span>
      <select value={value} onChange={event => onChange(event.target.value)} className="w-full rounded-lg border border-white/10 bg-[#111b2d] px-3 py-2.5 text-sm text-white outline-none transition-all focus:border-blue-500/60">
        {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function TextAreaField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-400">{label}</span>
      <textarea value={value} onChange={event => onChange(event.target.value)} rows={4} className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none transition-all focus:border-blue-500/60" />
    </label>
  );
}
