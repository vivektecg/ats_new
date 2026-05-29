import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Bot, Briefcase, CalendarCheck, Clock, Download, DollarSign, Eye, ShieldCheck,
  GitBranch, Percent, Send, TrendingUp, Trophy, Users, XCircle,
} from 'lucide-react';
import { QuickActionModal, QuickIconButton } from '@/components/ats/QuickActionModal';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { monthlyPlacements } from '@/lib/data';
import { resolveSession } from '@/lib/auth';
import { getAllCandidates, getAllClients, getAllInterviews, getAllJobs, getAllSubmissions } from '@/lib/localRecords';
import { cn } from '@/lib/utils';
import type { Candidate, Client, Interview, Job, Submission } from '@/lib/types';

type ExportReportType = 'candidates' | 'placed' | 'submissions' | 'interviews' | 'jobs' | 'clients' | 'all';

const chartColors = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#64748b'];

function groupCount<T extends string>(items: T[]) {
  return items.reduce<Record<string, number>>((counts, item) => {
    counts[item] = (counts[item] ?? 0) + 1;
    return counts;
  }, {});
}

function toChartRows(counts: Record<string, number>, label = 'count') {
  return Object.entries(counts).map(([name, value]) => ({ name, [label]: value }));
}

function daysBetween(start: string, end: string) {
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  if (Number.isNaN(startTime) || Number.isNaN(endTime)) return 0;
  return Math.max(0, Math.round((endTime - startTime) / 86_400_000));
}

function parseMoney(value: string) {
  const firstNumber = value.match(/\d+/)?.[0];
  if (!firstNumber) return 0;
  const amount = Number(firstNumber);
  if (value.toLowerCase().includes('k')) return amount * 1000;
  return amount;
}

function formatMoney(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1000) return `$${Math.round(value / 1000)}K`;
  return `$${Math.round(value)}`;
}

function csvValue(value: unknown) {
  if (Array.isArray(value)) return csvValue(value.join('; '));
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv<Row extends object>(rows: Row[], columns: Array<{ header: string; value: (row: Row) => unknown }>) {
  return [
    columns.map(column => csvValue(column.header)).join(','),
    ...rows.map(row => columns.map(column => csvValue(column.value(row))).join(',')),
  ].join('\n');
}

function downloadCsv(fileName: string, csv: string) {
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const candidateColumns: Array<{ header: string; value: (row: Candidate) => unknown }> = [
  { header: 'Candidate ID', value: row => row.id },
  { header: 'Name', value: row => row.name },
  { header: 'Email', value: row => row.email },
  { header: 'Phone', value: row => row.phone },
  { header: 'Current Role', value: row => row.title },
  { header: 'Location', value: row => row.location },
  { header: 'Status', value: row => row.status },
  { header: 'Skills', value: row => row.skills },
  { header: 'Experience', value: row => row.experience },
  { header: 'Rate / Salary', value: row => row.salary },
  { header: 'Availability', value: row => row.availability },
  { header: 'Source', value: row => row.source },
  { header: 'Recruiter', value: row => row.recruiter },
  { header: 'Created At', value: row => row.createdAt },
  { header: 'Updated At', value: row => row.updatedAt },
  { header: 'LinkedIn', value: row => row.linkedin },
  { header: 'Resume', value: row => row.resume },
  { header: 'Rating', value: row => row.rating },
  { header: 'Summary', value: row => row.summary },
];

const submissionColumns: Array<{ header: string; value: (row: Submission) => unknown }> = [
  { header: 'Submission ID', value: row => row.id },
  { header: 'Candidate ID', value: row => row.candidateId },
  { header: 'Candidate Name', value: row => row.candidateName },
  { header: 'Job ID', value: row => row.jobId },
  { header: 'Job Title', value: row => row.jobTitle },
  { header: 'Client ID', value: row => row.clientId },
  { header: 'Client Name', value: row => row.clientName },
  { header: 'Status', value: row => row.status },
  { header: 'Submitted Date', value: row => row.submittedDate },
  { header: 'Submitted Timestamp', value: row => row.submittedAt },
  { header: 'Submitted By Email', value: row => row.submittedByEmail },
  { header: 'Recruiter', value: row => row.recruiter },
  { header: 'Pay Rate', value: row => row.payRate ?? row.rate },
  { header: 'Bill Rate', value: row => row.billRate },
  { header: 'RTR Status', value: row => row.rtrStatus },
  { header: 'Resume Version', value: row => row.resumeVersion },
  { header: 'Offer Status', value: row => row.offerStatus },
  { header: 'Joining Status', value: row => row.joiningStatus },
  { header: 'Offer Document Status', value: row => row.offerDocumentStatus },
  { header: 'Notes', value: row => row.notes },
];

const jobColumns: Array<{ header: string; value: (row: Job) => unknown }> = [
  { header: 'Job ID', value: row => row.id },
  { header: 'External Job ID', value: row => row.externalJobId },
  { header: 'Title', value: row => row.title },
  { header: 'Client', value: row => row.client },
  { header: 'Client ID', value: row => row.clientId },
  { header: 'Location', value: row => row.location },
  { header: 'Type', value: row => row.type },
  { header: 'Status', value: row => row.status },
  { header: 'Priority', value: row => row.priority },
  { header: 'Salary / Bill Rate', value: row => row.salary },
  { header: 'Openings', value: row => row.openings },
  { header: 'Filled', value: row => row.filled },
  { header: 'Recruiter', value: row => row.recruiter },
  { header: 'Requirements', value: row => row.requirements },
  { header: 'Posted Date', value: row => row.postedDate },
  { header: 'Close Date', value: row => row.closeDate },
  { header: 'Department', value: row => row.department },
  { header: 'Description', value: row => row.description },
];

const clientColumns: Array<{ header: string; value: (row: Client) => unknown }> = [
  { header: 'Client ID', value: row => row.id },
  { header: 'Name', value: row => row.name },
  { header: 'Industry', value: row => row.industry },
  { header: 'Client Type', value: row => row.clientType },
  { header: 'Location', value: row => row.location },
  { header: 'Website', value: row => row.website },
  { header: 'Contact', value: row => row.contact },
  { header: 'Contact Title', value: row => row.contactTitle },
  { header: 'Contact Email', value: row => row.contactEmail },
  { header: 'Contact Phone', value: row => row.contactPhone },
  { header: 'Status', value: row => row.status },
  { header: 'Tier', value: row => row.tier },
  { header: 'Active Jobs', value: row => row.activeJobs },
  { header: 'Total Placements', value: row => row.totalPlacements },
  { header: 'Revenue', value: row => row.revenue },
  { header: 'Recruiter', value: row => row.recruiter },
  { header: 'Created At', value: row => row.createdAt },
  { header: 'Notes', value: row => row.notes },
];

const interviewColumns: Array<{ header: string; value: (row: Interview) => unknown }> = [
  { header: 'Interview ID', value: row => row.id },
  { header: 'Candidate ID', value: row => row.candidateId },
  { header: 'Candidate Name', value: row => row.candidateName },
  { header: 'Job Title', value: row => row.jobTitle },
  { header: 'Client Name', value: row => row.clientName },
  { header: 'Type', value: row => row.type },
  { header: 'Date', value: row => row.date },
  { header: 'Time', value: row => row.time },
  { header: 'Time Zone', value: row => row.timeZone },
  { header: 'Duration', value: row => row.duration },
  { header: 'Interviewer', value: row => row.interviewer },
  { header: 'Status', value: row => row.status },
  { header: 'Meeting Platform', value: row => row.meetingPlatform },
  { header: 'Meeting Link', value: row => row.meetingLink },
  { header: 'Reminder Email Sent', value: row => row.reminderEmailSent ? 'Yes' : 'No' },
  { header: 'Reminder Schedule', value: row => row.reminderSchedule },
  { header: 'Reschedule Count', value: row => row.rescheduleCount ?? 0 },
  { header: 'Feedback', value: row => row.feedback },
];

type TooltipPayloadItem = {
  name?: string;
  dataKey?: string;
  value?: string | number;
  color?: string;
};

type CustomTooltipProps = {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string | number;
};

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-[#0f172a] px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 text-slate-400">{label}</p>
      {payload.map(item => (
        <p key={`${item.name}-${item.dataKey}`} className="font-semibold" style={{ color: item.color || 'white' }}>
          {item.name}: {item.value}
        </p>
      ))}
    </div>
  );
};

export default function Reports() {
  const session = resolveSession();
  const isSuperUser = session?.role === 'SuperUser';
  const candidates = getAllCandidates();
  const clients = getAllClients();
  const jobs = getAllJobs();
  const submissions = getAllSubmissions();
  const scheduledInterviews = getAllInterviews();
  const [exportType, setExportType] = useState<ExportReportType>('candidates');
  const [exportNotice, setExportNotice] = useState('');
  const [reportAction, setReportAction] = useState<null | { title: string; metric: string; summary: string }>(null);
  const exportOptions = useMemo(() => [
    { value: 'candidates' as const, label: 'Candidate Data', rows: candidates.length },
    { value: 'placed' as const, label: 'Placed Data', rows: candidates.filter(candidate => candidate.status === 'Placed').length + submissions.filter(submission => submission.status === 'Placed').length },
    { value: 'submissions' as const, label: 'Submission Data', rows: submissions.length },
    { value: 'interviews' as const, label: 'Interview Schedule Data', rows: scheduledInterviews.length },
    { value: 'jobs' as const, label: 'Job Data', rows: jobs.length },
    { value: 'clients' as const, label: 'Client Data', rows: clients.length },
    { value: 'all' as const, label: 'Complete ATS Data', rows: candidates.length + submissions.length + scheduledInterviews.length + jobs.length + clients.length },
  ], [candidates, clients, jobs, scheduledInterviews, submissions]);
  const jobsByStatus = toChartRows(groupCount(jobs.map(job => job.status)), 'jobs');
  const candidatesByStatus = toChartRows(groupCount(candidates.map(candidate => candidate.status)), 'candidates');
  const submissionsByRecruiter = Object.values(submissions.reduce<Record<string, { name: string; submissions: number; placements: number; rejections: number }>>((rows, submission) => {
    rows[submission.recruiter] ??= { name: submission.recruiter, submissions: 0, placements: 0, rejections: 0 };
    rows[submission.recruiter].submissions += 1;
    if (submission.status === 'Placed') rows[submission.recruiter].placements += 1;
    if (submission.status === 'Rejected') rows[submission.recruiter].rejections += 1;
    return rows;
  }, {}));
  const candidateById = new Map(candidates.map(candidate => [candidate.id, candidate]));
  const interviewsByClient = toChartRows(groupCount(scheduledInterviews.map(interview => interview.clientName)), 'interviews');
  const interviewScheduleRows = scheduledInterviews
    .map(interview => ({
      ...interview,
      recruiterUser: candidateById.get(interview.candidateId)?.recruiter || interview.interviewer || 'Unassigned',
      scheduleDate: `${interview.date} ${interview.time} ${interview.timeZone ?? ''}`.trim(),
    }))
    .sort((left, right) => `${left.date} ${left.time}`.localeCompare(`${right.date} ${right.time}`));
  const recruiterInterviewSchedules = Object.values(interviewScheduleRows.reduce<Record<string, { name: string; scheduled: number; completed: number; noShows: number }>>((rows, interview) => {
    rows[interview.recruiterUser] ??= { name: interview.recruiterUser, scheduled: 0, completed: 0, noShows: 0 };
    if (interview.status === 'Completed') rows[interview.recruiterUser].completed += 1;
    else if (interview.status === 'No Show') rows[interview.recruiterUser].noShows += 1;
    else rows[interview.recruiterUser].scheduled += 1;
    return rows;
  }, {}));
  const placementRows = submissions.filter(submission => submission.status === 'Placed' || submission.status === 'Offer Extended');
  const rejectionRows = submissions.filter(submission => submission.status === 'Rejected');
  const timeToSubmit = submissions.map(submission => {
    const job = jobs.find(jobItem => jobItem.id === submission.jobId);
    return {
      name: submission.candidateName.split(' ')[0],
      days: job ? daysBetween(job.postedDate, submission.submittedDate) : 0,
    };
  });
  const avgTimeToSubmit = Math.round(timeToSubmit.reduce((sum, row) => sum + row.days, 0) / Math.max(1, timeToSubmit.length));
  const timeToHire = placementRows.map(row => ({
    month: row.submittedDate,
    days: 0,
  }));
  const avgTimeToHire = Math.round(timeToHire.reduce((sum, row) => sum + row.days, 0) / Math.max(1, timeToHire.length));
  const sourcePerformance = Object.values(candidates.reduce<Record<string, { name: string; candidates: number; placements: number }>>((rows, candidate) => {
    rows[candidate.source] ??= { name: candidate.source, candidates: 0, placements: 0 };
    rows[candidate.source].candidates += 1;
    if (candidate.status === 'Placed') rows[candidate.source].placements += 1;
    return rows;
  }, {}));
  const recruiterPerformance = Object.values(candidates.reduce<Record<string, { name: string; candidates: number; submissions: number; interviews: number; placements: number }>>((rows, candidate) => {
    rows[candidate.recruiter] ??= { name: candidate.recruiter, candidates: 0, submissions: 0, interviews: 0, placements: 0 };
    rows[candidate.recruiter].candidates += 1;
    if (candidate.status === 'Interview') rows[candidate.recruiter].interviews += 1;
    if (candidate.status === 'Placed') rows[candidate.recruiter].placements += 1;
    return rows;
  }, {})).map(row => ({
    ...row,
    submissions: submissions.filter(submission => submission.recruiter === row.name).length,
  }));
  const clientPerformance = clients.map(client => ({
    name: client.name,
    jobs: jobs.filter(job => job.clientId === client.id).length,
    submissions: submissions.filter(submission => submission.clientId === client.id).length,
    placements: submissions.filter(submission => submission.clientId === client.id && submission.status === 'Placed').length,
    revenue: parseMoney(client.revenue),
  }));
  const revenueForecast: Array<{ month: string; revenue: number }> = [];
  const marginReport = submissions.map(submission => {
    const pay = parseMoney(submission.payRate ?? submission.rate);
    const bill = parseMoney(submission.billRate ?? submission.rate);
    const margin = Math.max(0, bill - pay);
    return {
      name: submission.candidateName.split(' ')[0],
      pay,
      bill,
      margin,
      marginPct: bill ? Math.round((margin / bill) * 100) : 0,
    };
  });
  const candidatePipelineReport = ['New', 'Screening', 'Interview', 'Offer', 'Placed', 'Rejected', 'On Hold'].map(stage => ({
    name: stage,
    candidates: candidates.filter(candidate => candidate.status === stage).length,
    dropOff: candidates.filter(candidate => candidate.status === 'Rejected').length && stage === 'Rejected' ? candidates.filter(candidate => candidate.status === 'Rejected').length : 0,
  }));
  const aiMatchScoreDistribution = [
    { name: '90-100', candidates: candidates.filter(candidate => candidate.rating >= 5).length },
    { name: '80-89', candidates: candidates.filter(candidate => candidate.rating === 4).length },
    { name: '70-79', candidates: candidates.filter(candidate => candidate.rating === 3).length },
    { name: '<70', candidates: candidates.filter(candidate => candidate.rating <= 2).length },
  ];

  const totalForecast = revenueForecast.reduce((sum, row) => sum + row.revenue, 0);
  const totalMargin = marginReport.reduce((sum, row) => sum + row.margin, 0);
  const reportCards = [
    { label: 'Placements', value: `${placementRows.length}`, change: `${monthlyPlacements.at(-1)?.placements ?? 0} this month`, icon: Trophy, color: 'text-amber-400' },
    { label: 'Rejections', value: `${rejectionRows.length}`, change: 'Track drop-off reasons', icon: XCircle, color: 'text-red-400' },
    { label: 'Time-to-submit', value: `${avgTimeToSubmit} days`, change: 'Posting to submission', icon: Clock, color: 'text-blue-400' },
    { label: 'Time-to-hire', value: `${avgTimeToHire} days`, change: 'Submission to placement', icon: TrendingUp, color: 'text-emerald-400' },
    { label: 'Revenue forecast', value: formatMoney(totalForecast), change: 'Next 6 months', icon: DollarSign, color: 'text-cyan-400' },
    { label: 'Margin report', value: formatMoney(totalMargin), change: 'Estimated spread', icon: Percent, color: 'text-violet-400' },
  ];

  function buildSelectedReport() {
    if (exportType === 'candidates') {
      return { fileName: 'eventus-candidate-data.csv', csv: toCsv(candidates, candidateColumns), rows: candidates.length };
    }
    if (exportType === 'placed') {
      const placedCandidates = candidates.filter(candidate => candidate.status === 'Placed');
      const placedSubmissions = submissions.filter(submission => submission.status === 'Placed');
      const placedRows = [
        ...placedCandidates.map(candidate => ({
          recordType: 'Candidate',
          candidateId: candidate.id,
          candidateName: candidate.name,
          candidateEmail: candidate.email,
          jobId: '',
          jobTitle: '',
          clientName: '',
          status: candidate.status,
          recruiter: candidate.recruiter,
          payRate: candidate.salary,
          billRate: '',
          placedDate: candidate.updatedAt,
          source: candidate.source,
          notes: candidate.summary,
        })),
        ...placedSubmissions.map(submission => ({
          recordType: 'Submission',
          candidateId: submission.candidateId,
          candidateName: submission.candidateName,
          candidateEmail: candidates.find(candidate => candidate.id === submission.candidateId)?.email ?? '',
          jobId: submission.jobId,
          jobTitle: submission.jobTitle,
          clientName: submission.clientName,
          status: submission.status,
          recruiter: submission.recruiter,
          payRate: submission.payRate ?? submission.rate,
          billRate: submission.billRate ?? '',
          placedDate: submission.updatedAt ?? submission.submittedAt ?? submission.submittedDate,
          source: candidates.find(candidate => candidate.id === submission.candidateId)?.source ?? '',
          notes: submission.notes,
        })),
      ];
      return {
        fileName: 'eventus-placed-data.csv',
        csv: toCsv(placedRows, [
          { header: 'Record Type', value: row => row.recordType },
          { header: 'Candidate ID', value: row => row.candidateId },
          { header: 'Candidate Name', value: row => row.candidateName },
          { header: 'Candidate Email', value: row => row.candidateEmail },
          { header: 'Job ID', value: row => row.jobId },
          { header: 'Job Title', value: row => row.jobTitle },
          { header: 'Client Name', value: row => row.clientName },
          { header: 'Status', value: row => row.status },
          { header: 'Recruiter', value: row => row.recruiter },
          { header: 'Pay Rate', value: row => row.payRate },
          { header: 'Bill Rate', value: row => row.billRate },
          { header: 'Placed Date', value: row => row.placedDate },
          { header: 'Source', value: row => row.source },
          { header: 'Notes', value: row => row.notes },
        ]),
        rows: placedRows.length,
      };
    }
    if (exportType === 'submissions') {
      return { fileName: 'eventus-submission-data.csv', csv: toCsv(submissions, submissionColumns), rows: submissions.length };
    }
    if (exportType === 'interviews') {
      return { fileName: 'eventus-interview-schedules.csv', csv: toCsv(scheduledInterviews, interviewColumns), rows: scheduledInterviews.length };
    }
    if (exportType === 'jobs') {
      return { fileName: 'eventus-job-data.csv', csv: toCsv(jobs, jobColumns), rows: jobs.length };
    }
    if (exportType === 'clients') {
      return { fileName: 'eventus-client-data.csv', csv: toCsv(clients, clientColumns), rows: clients.length };
    }

    const combinedRows = [
      ...candidates.map(row => ({ recordType: 'Candidate', recordId: row.id, primaryName: row.name, status: row.status, owner: row.recruiter, relatedName: row.title, date: row.updatedAt, details: row.summary })),
      ...submissions.map(row => ({ recordType: 'Submission', recordId: row.id, primaryName: row.candidateName, status: row.status, owner: row.recruiter, relatedName: `${row.jobTitle} / ${row.clientName}`, date: row.updatedAt ?? row.submittedAt ?? row.submittedDate, details: row.notes })),
      ...interviewScheduleRows.map(row => ({ recordType: 'Interview', recordId: row.id, primaryName: row.candidateName, status: row.status, owner: row.recruiterUser, relatedName: `${row.jobTitle} / ${row.clientName}`, date: row.scheduleDate, details: `${row.meetingPlatform ?? row.type}: ${row.meetingLink ?? 'Meeting link pending'}` })),
      ...jobs.map(row => ({ recordType: 'Job', recordId: row.id, primaryName: row.title, status: row.status, owner: row.recruiter, relatedName: row.client, date: row.postedDate, details: row.description })),
      ...clients.map(row => ({ recordType: 'Client', recordId: row.id, primaryName: row.name, status: row.status, owner: row.recruiter, relatedName: row.contact, date: row.createdAt, details: row.notes })),
    ];
    return {
      fileName: 'eventus-complete-ats-data.csv',
      csv: toCsv(combinedRows, [
        { header: 'Record Type', value: row => row.recordType },
        { header: 'Record ID', value: row => row.recordId },
        { header: 'Primary Name', value: row => row.primaryName },
        { header: 'Status', value: row => row.status },
        { header: 'Owner / Recruiter', value: row => row.owner },
        { header: 'Related Name', value: row => row.relatedName },
        { header: 'Date', value: row => row.date },
        { header: 'Details', value: row => row.details },
      ]),
      rows: combinedRows.length,
    };
  }

  function handleExport() {
    if (!isSuperUser) {
      setExportNotice('Only SuperUser accounts can export ATS report data.');
      return;
    }
    const report = buildSelectedReport();
    downloadCsv(report.fileName, report.csv);
    setExportNotice(`${report.rows} rows exported to ${report.fileName}.`);
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Reporting & Analytics</h1>
          <p className="mt-1 text-sm text-slate-500">Visibility into funnel health, drop-offs, recruiter output, client performance, revenue, margin, and AI match quality.</p>
        </div>
        {isSuperUser && (
          <div className="flex w-full flex-col gap-2 rounded-lg border border-white/10 bg-[#0d1729] p-2 sm:w-auto sm:flex-row sm:items-center">
            <label className="flex items-center gap-1.5 whitespace-nowrap text-[11px] text-slate-400">
              <ShieldCheck size={13} className="text-emerald-300" />
              CSV Export
            </label>
            <select
              value={exportType}
              onChange={event => setExportType(event.target.value as ExportReportType)}
              className="h-8 w-full rounded-lg border border-white/10 bg-white/5 px-2.5 text-xs text-white outline-none focus:border-blue-500/60 sm:w-48"
            >
              {exportOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label} ({option.rows})</option>
              ))}
            </select>
            <button onClick={handleExport} className="flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-blue-500">
              <Download size={13} />
              Pull CSV
            </button>
          </div>
        )}
      </div>

      {exportNotice && (
        <div className="mb-5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {exportNotice}
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-6">
        {reportCards.map((card, index) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
            className="rounded-lg border border-white/5 bg-[#0d1729] p-4"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <card.icon size={16} className={card.color} />
              <div className="flex items-center gap-2">
                <p className={cn('text-xl font-bold', card.color)}>{card.value}</p>
                <QuickIconButton title={`Open ${card.label} report`} onClick={() => setReportAction({ title: card.label, metric: card.value, summary: card.change })}>
                  <Eye size={13} />
                </QuickIconButton>
              </div>
            </div>
            <p className="text-xs font-medium text-white">{card.label}</p>
            <p className="mt-1 text-[10px] text-slate-600">{card.change}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <ReportCard title="Jobs by status" icon={<Briefcase size={15} />}>
          <SimpleBar data={jobsByStatus} dataKey="jobs" color="#3b82f6" />
        </ReportCard>

        <ReportCard title="Candidates by status" icon={<Users size={15} />}>
          <SimpleBar data={candidatesByStatus} dataKey="candidates" color="#8b5cf6" />
        </ReportCard>

        <ReportCard title="Submissions by recruiter" icon={<Send size={15} />}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={submissionsByRecruiter} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={26} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px', color: '#64748b' }} />
              <Bar dataKey="submissions" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              <Bar dataKey="placements" fill="#10b981" radius={[3, 3, 0, 0]} />
              <Bar dataKey="rejections" fill="#ef4444" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ReportCard>

        <ReportCard title="Interviews by client" icon={<CalendarCheck size={15} />}>
          <SimpleBar data={interviewsByClient} dataKey="interviews" color="#06b6d4" />
        </ReportCard>

        <ReportCard title="Recruiter/User Interview Schedules" icon={<CalendarCheck size={15} />}>
          {recruiterInterviewSchedules.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={recruiterInterviewSchedules} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={26} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px', color: '#64748b' }} />
                <Bar dataKey="scheduled" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                <Bar dataKey="completed" fill="#10b981" radius={[3, 3, 0, 0]} />
                <Bar dataKey="noShows" fill="#ef4444" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <DataList rows={[]} empty="No interview schedules yet." />
          )}
        </ReportCard>

        <ReportCard title="Interview schedule report" icon={<CalendarCheck size={15} />}>
          <DataList rows={interviewScheduleRows.slice(0, 6).map(interview => ({
            label: interview.candidateName,
            meta: `${interview.recruiterUser} - ${interview.jobTitle} - ${interview.meetingPlatform ?? interview.type}`,
            value: interview.scheduleDate,
          }))} empty="No interview schedules yet." />
        </ReportCard>

        <ReportCard title="Placements" icon={<Trophy size={15} />}>
          <SimpleBar data={monthlyPlacements} dataKey="placements" color="#f59e0b" xKey="month" />
        </ReportCard>

        <ReportCard title="Rejections" icon={<XCircle size={15} />}>
          <DataList rows={rejectionRows.map(row => ({
            label: row.candidateName,
            meta: `${row.clientName} - ${row.jobTitle}`,
            value: row.submittedDate,
          }))} empty="No rejected submissions." />
        </ReportCard>

        <ReportCard title="Time-to-submit" icon={<Clock size={15} />}>
          <SimpleBar data={timeToSubmit} dataKey="days" color="#3b82f6" xKey="name" />
        </ReportCard>

        <ReportCard title="Time-to-hire" icon={<TrendingUp size={15} />}>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={timeToHire}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={26} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="days" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ReportCard>

        <ReportCard title="Source performance" icon={<GitBranch size={15} />}>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={sourcePerformance} dataKey="candidates" nameKey="name" innerRadius={50} outerRadius={82} paddingAngle={3}>
                {sourcePerformance.map((entry, index) => <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </ReportCard>

        <ReportCard title="Recruiter performance" icon={<Users size={15} />}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={recruiterPerformance} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={26} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px', color: '#64748b' }} />
              <Bar dataKey="candidates" fill="#64748b" radius={[3, 3, 0, 0]} />
              <Bar dataKey="submissions" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              <Bar dataKey="interviews" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
              <Bar dataKey="placements" fill="#10b981" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ReportCard>

        <ReportCard title="Client performance" icon={<Briefcase size={15} />}>
          <DataList rows={clientPerformance.slice(0, 6).map(client => ({
            label: client.name,
            meta: `${client.jobs} jobs - ${client.submissions} submissions - ${client.placements} placements`,
            value: formatMoney(client.revenue),
          }))} />
        </ReportCard>

        <ReportCard title="Revenue forecast" icon={<DollarSign size={15} />}>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={revenueForecast}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={value => `$${value / 1000}K`} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={42} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="revenue" stroke="#06b6d4" strokeWidth={2} dot={{ fill: '#06b6d4', r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ReportCard>

        <ReportCard title="Margin report" icon={<Percent size={15} />}>
          <DataList rows={marginReport.slice(0, 6).map(row => ({
            label: row.name,
            meta: `Pay ${formatMoney(row.pay)} - Bill ${formatMoney(row.bill)}`,
            value: `${formatMoney(row.margin)} / ${row.marginPct}%`,
          }))} />
        </ReportCard>

        <ReportCard title="Candidate pipeline report" icon={<GitBranch size={15} />}>
          <SimpleBar data={candidatePipelineReport} dataKey="candidates" color="#8b5cf6" />
        </ReportCard>

        <ReportCard title="AI match score distribution" icon={<Bot size={15} />}>
          <SimpleBar data={aiMatchScoreDistribution} dataKey="candidates" color="#10b981" />
        </ReportCard>
      </div>

      {reportAction && (
        <QuickActionModal
          title={`${reportAction.title} Report`}
          subtitle="Report quick action"
          onCancel={() => setReportAction(null)}
          saveLabel="Close"
          onSave={() => setReportAction(null)}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <InfoBox label="Metric" value={reportAction.metric} />
            <InfoBox label="Summary" value={reportAction.summary} />
            <InfoBox label="Candidates" value={String(candidates.length)} />
            <InfoBox label="Submissions" value={String(submissions.length)} />
          </div>
          <p className="mt-4 rounded-lg border border-white/5 bg-white/[0.03] p-4 text-sm text-slate-300">
            Use the SuperUser CSV export to pull the selected ATS data set with timestamps and related records.
          </p>
        </QuickActionModal>
      )}
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.03] p-3">
      <p className="text-[10px] uppercase tracking-wider text-slate-600">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function ReportCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-white/5 bg-[#0d1729] p-5"
    >
      <div className="mb-4 flex items-center gap-2">
        <span className="text-blue-300">{icon}</span>
        <h2 className="text-sm font-semibold text-white">{title}</h2>
      </div>
      {children}
    </motion.section>
  );
}

function SimpleBar({ data, dataKey, color, xKey = 'name' }: { data: Array<Record<string, string | number>>; dataKey: string; color: string; xKey?: string }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} barSize={24}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
        <XAxis dataKey={xKey} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} interval={0} />
        <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={26} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
        <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function DataList({ rows, empty = 'No data available.' }: { rows: Array<{ label: string; meta: string; value: string }>; empty?: string }) {
  if (rows.length === 0) return <p className="py-8 text-center text-sm text-slate-600">{empty}</p>;

  return (
    <div className="space-y-2">
      {rows.map(row => (
        <div key={`${row.label}-${row.meta}`} className="rounded-lg border border-white/5 bg-white/[0.03] p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{row.label}</p>
              <p className="mt-1 text-xs text-slate-500">{row.meta}</p>
            </div>
            <span className="flex-shrink-0 text-xs font-semibold text-blue-300">{row.value}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
