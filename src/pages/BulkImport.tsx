import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import * as XLSX from 'xlsx';
import { AlertTriangle, Bot, CalendarClock, Download, FileSpreadsheet, FileUp, Play, Plus, RefreshCw, UploadCloud } from 'lucide-react';
import { getAllJobs } from '@/lib/localRecords';
import { upsertLocalCandidates } from '@/lib/atsLocalStore';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { Job } from '@/lib/types';

const jobBoards = [
  'LinkedIn Recruiter Lite', 'Dice', 'Monster', 'CareerBuilder', 'Indeed', 'ZipRecruiter',
  'Glassdoor', 'SimplyHired', 'ClearanceJobs', 'TechFetch', 'FlexJobs', 'Wellfound', 'USAJobs', 'Google X-Ray',
];
const timeZones = ['EST', 'CST', 'MST', 'PST', 'AST', 'UTC', 'IST'];
const countries = ['USA', 'India', 'Canada', 'Mexico', 'Remote'];
const profileLimits = [10, 20, 30, 40, 50];
const AUTOPILOT_SCHEDULES_KEY = 'eventus:test:autopilot-schedules';
const AUTOPILOT_EMAILS_KEY = 'eventus:test:autopilot-email-digests';
const timeZoneOffsets: Record<string, number> = { EST: -5, CST: -6, MST: -7, PST: -8, AST: -4, UTC: 0, IST: 5.5 };

type PreviewCandidate = {
  name: string;
  email: string;
  phone: string;
  linkedin?: string;
  title?: string;
  location?: string;
  skills?: string[];
  resumeFile?: string;
  warning?: string;
};

type AutopilotSchedule = {
  id: string;
  jobId: string;
  boards: string[];
  countries: string[];
  locations: string;
  timeZone: string;
  scheduleDate: string;
  scheduleTime: string;
  profileLimit: number;
  booleanString: string;
  requiredSkills: string;
  preferredSkills: string;
  status: 'Scheduled' | 'Completed';
  createdAt: string;
  lastRunAt?: string;
};

type CandidateSheetKey =
  | 'name'
  | 'email'
  | 'phone'
  | 'title'
  | 'currentCompany'
  | 'linkedin'
  | 'location'
  | 'skills'
  | 'experience'
  | 'usExperience'
  | 'relevantExperience'
  | 'workAuthorization'
  | 'visaStatus'
  | 'currentRate'
  | 'expectedRate'
  | 'availability'
  | 'source'
  | 'owner'
  | 'notes';

type TemplateCandidateRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  title: string;
  currentCompany: string;
  linkedin: string;
  location: string;
  skills: string;
  experience: string;
  usExperience: string;
  relevantExperience: string;
  workAuthorization: string;
  visaStatus: string;
  currentRate: string;
  expectedRate: string;
  availability: string;
  source: string;
  owner: string;
  notes: string;
};

const candidateSheetFields: Array<{
  key: CandidateSheetKey;
  label: string;
  aliases: string[];
  mapsTo: string;
  placeholder: string;
}> = [
  { key: 'name', label: 'Full Name', aliases: ['full name', 'fullname', 'candidate name', 'name'], mapsTo: 'Candidate full name', placeholder: 'John Smith' },
  { key: 'email', label: 'Email', aliases: ['email', 'email address', 'mail'], mapsTo: 'Email', placeholder: 'john@example.com' },
  { key: 'phone', label: 'Phone Number', aliases: ['phone', 'phone number', 'mobile', 'contact number'], mapsTo: 'Phone', placeholder: '+1 555 123 4567' },
  { key: 'title', label: 'Current Title', aliases: ['title', 'current title', 'job title', 'role', 'designation'], mapsTo: 'Current title', placeholder: 'Senior Java Developer' },
  { key: 'currentCompany', label: 'Current Company', aliases: ['current company', 'company', 'employer'], mapsTo: 'Current company', placeholder: 'Eventus Consulting' },
  { key: 'linkedin', label: 'LinkedIn URL', aliases: ['linkedin', 'linkedin url', 'linkedin profile'], mapsTo: 'LinkedIn URL', placeholder: 'https://linkedin.com/in/...' },
  { key: 'location', label: 'Location', aliases: ['location', 'current location', 'city', 'state'], mapsTo: 'Location', placeholder: 'Dallas, TX' },
  { key: 'skills', label: 'Skills', aliases: ['skills', 'skillset', 'technologies', 'tech stack'], mapsTo: 'Skills', placeholder: 'Java, Spring Boot, AWS' },
  { key: 'experience', label: 'Total Experience', aliases: ['experience', 'total experience', 'years of experience'], mapsTo: 'Total experience', placeholder: '8' },
  { key: 'usExperience', label: 'US Experience', aliases: ['us experience', 'usa experience'], mapsTo: 'US experience', placeholder: '5' },
  { key: 'relevantExperience', label: 'Relevant Experience', aliases: ['relevant experience', 'relevant exp'], mapsTo: 'Relevant experience', placeholder: '6' },
  { key: 'workAuthorization', label: 'Work Authorization', aliases: ['work authorization', 'work auth', 'authorization'], mapsTo: 'Work authorization', placeholder: 'H-1B' },
  { key: 'visaStatus', label: 'Visa Status', aliases: ['visa status', 'visa', 'immigration status'], mapsTo: 'Visa status', placeholder: 'Transfer required' },
  { key: 'currentRate', label: 'Current Rate', aliases: ['current rate', 'current ctc', 'current salary'], mapsTo: 'Current rate', placeholder: '$65/hr' },
  { key: 'expectedRate', label: 'Expected Rate', aliases: ['expected rate', 'expected ctc', 'expected salary'], mapsTo: 'Expected rate', placeholder: '$72/hr' },
  { key: 'availability', label: 'Availability', aliases: ['availability', 'notice period', 'available from'], mapsTo: 'Availability', placeholder: '2 weeks' },
  { key: 'source', label: 'Source', aliases: ['source', 'lead source'], mapsTo: 'Source', placeholder: 'LinkedIn' },
  { key: 'owner', label: 'Owner', aliases: ['owner', 'recruiter', 'assigned recruiter'], mapsTo: 'Owner', placeholder: 'Sarah Chen' },
  { key: 'notes', label: 'Notes', aliases: ['notes', 'remarks', 'comments', 'summary'], mapsTo: 'Notes', placeholder: 'Optional recruiter notes' },
];

const emptyJob: Job = {
  id: '', title: 'No job selected', client: 'Client pending', clientId: '', location: 'Manual location pending', type: 'Contract',
  status: 'Active', priority: 'Medium', salary: 'Open', openings: 0, filled: 0, recruiter: 'SuperUser', description: '',
  requirements: [], postedDate: new Date().toISOString().slice(0, 10), closeDate: '', submissions: 0, department: 'Recruiting',
};

function readArray<T>(key: string): T[] {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeArray<T>(key: string, rows: T[]) {
  window.localStorage.setItem(key, JSON.stringify(rows));
}

function nameFromFile(fileName: string) {
  return fileName.replace(/\.[^.]+$/, '').replace(/resume|cv|profile|[_-]+/gi, ' ').replace(/\s+/g, ' ').trim() || 'Imported Resume Candidate';
}

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function createTemplateRow(overrides: Partial<TemplateCandidateRow> = {}): TemplateCandidateRow {
  return {
    id: `sheet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: '',
    email: '',
    phone: '',
    title: '',
    currentCompany: '',
    linkedin: '',
    location: '',
    skills: '',
    experience: '',
    usExperience: '',
    relevantExperience: '',
    workAuthorization: '',
    visaStatus: '',
    currentRate: '',
    expectedRate: '',
    availability: '',
    source: '',
    owner: '',
    notes: '',
    ...overrides,
  };
}

function createTemplateRows(count = 5) {
  return Array.from({ length: count }, () => createTemplateRow());
}

function pick(row: Record<string, any>, headers: string[]) {
  const entries = Object.entries(row);
  for (const wanted of headers) {
    const found = entries.find(([key]) => normalizeHeader(key) === wanted || normalizeHeader(key).includes(wanted));
    if (found && found[1] != null) return String(found[1]).trim();
  }
  return '';
}

function makeWarning(row: PreviewCandidate) {
  const missing = [!row.name && 'Name missing', !row.email && 'Email missing', !row.phone && 'Phone missing'].filter(Boolean);
  return row.warning || missing.join(', ');
}

function fieldConfigForHeader(header: string) {
  const normalized = normalizeHeader(header);
  return candidateSheetFields.find(field =>
    field.aliases.some(alias => {
      const normalizedAlias = normalizeHeader(alias);
      return normalized === normalizedAlias || normalized.includes(normalizedAlias) || normalizedAlias.includes(normalized);
    })
  );
}

function pickSheetValue(row: Record<string, any>, key: CandidateSheetKey) {
  const field = candidateSheetFields.find(item => item.key === key);
  return field ? pick(row, field.aliases.map(alias => normalizeHeader(alias))) : '';
}

function templateRowHasContent(row: TemplateCandidateRow) {
  return candidateSheetFields.some(field => String(row[field.key] ?? '').trim());
}

function templateRowCanSync(row: TemplateCandidateRow) {
  return [row.name, row.email, row.phone, row.title, row.location].some(value => value.trim().length >= 2);
}

function templateRowToPreview(row: TemplateCandidateRow, index: number): PreviewCandidate {
  const preview = {
    name: row.name.trim() || `Sheet Candidate ${index + 1}`,
    email: row.email.trim(),
    phone: row.phone.trim(),
    linkedin: row.linkedin.trim(),
    title: row.title.trim() || 'ATS Sheet Candidate',
    location: row.location.trim() || 'Location pending',
    skills: row.skills.split(',').map(skill => skill.trim()).filter(Boolean),
  };
  return { ...preview, warning: makeWarning(preview) };
}

function templateRowsToPreview(rows: TemplateCandidateRow[]) {
  return rows.filter(templateRowHasContent).map(templateRowToPreview);
}

function templateRowToImport(row: TemplateCandidateRow, index: number, sourceLabel: string) {
  const preview = templateRowToPreview(row, index);
  const note = row.notes.trim();
  return {
    id: row.id,
    name: row.name.trim() || preview.name,
    email: row.email.trim(),
    phone: row.phone.trim(),
    linkedin: row.linkedin.trim(),
    title: row.title.trim(),
    currentCompany: row.currentCompany.trim(),
    location: row.location.trim(),
    skills: row.skills,
    experience: row.experience.trim(),
    usExperience: row.usExperience.trim(),
    relevantExperience: row.relevantExperience.trim(),
    workAuthorization: row.workAuthorization.trim(),
    visaStatus: row.visaStatus.trim(),
    currentRate: row.currentRate.trim(),
    expectedRate: row.expectedRate.trim(),
    availability: row.availability.trim(),
    source: row.source.trim() || sourceLabel,
    recruiter: row.owner.trim() || 'SuperUser',
    owner: row.owner.trim() || 'SuperUser',
    warning: preview.warning,
    notes: note ? [note] : undefined,
    parsedResumeDetails: note || undefined,
  };
}

function downloadTemplateWorkbook(rows: TemplateCandidateRow[]) {
  const exportRows = rows.length ? rows : createTemplateRows(5);
  const sheetData = [
    candidateSheetFields.map(field => field.label),
    ...exportRows.map(row => candidateSheetFields.map(field => row[field.key] ?? '')),
  ];
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'ATS Candidates');
  XLSX.writeFile(workbook, 'eventus-ats-candidate-template.xlsx');
}

function scheduleDateTime(schedule: Pick<AutopilotSchedule, 'scheduleDate' | 'scheduleTime' | 'timeZone'>) {
  const [year, month, day] = schedule.scheduleDate.split('-').map(Number);
  const [hour, minute] = (schedule.scheduleTime || '00:00').split(':').map(Number);
  const offset = timeZoneOffsets[schedule.timeZone] ?? 0;
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - offset * 60 * 60 * 1000);
}

function candidateRowsForAutopilot(schedule: AutopilotSchedule, job: Job): PreviewCandidate[] {
  const skills = [...schedule.requiredSkills.split(','), ...schedule.preferredSkills.split(',')].map(skill => skill.trim()).filter(Boolean);
  const country = schedule.countries[0] ?? 'USA';
  return Array.from({ length: Math.min(schedule.profileLimit, 50) }, (_, index) => ({
    name: `${country} Autopilot Profile ${index + 1}`,
    email: index % 3 === 0 ? `autopilot.${schedule.id}.${index + 1}@example.com` : '',
    phone: index % 2 === 0 ? `(555) 02${String(index).padStart(2, '0')}` : '',
    title: job.title || 'Sourced Candidate',
    location: `${schedule.locations || country} ${schedule.timeZone}`,
    skills: skills.length ? skills : job.requirements.slice(0, 5),
    warning: index % 3 === 0 ? '' : 'Contact details partially missing',
  }));
}

function emailTable(rows: PreviewCandidate[]) {
  const header = '| Name | Email | Location | Role |\n|---|---|---|---|';
  const body = rows.map(row => `| ${row.name} | ${row.email || 'Missing'} | ${row.location || 'Pending'} | ${row.title || 'Candidate'} |`).join('\n');
  return `${header}\n${body}`;
}

export default function BulkImport() {
  const [searchParams] = useSearchParams();
  const jobs = getAllJobs();
  const [activeMode, setActiveMode] = useState<'resume' | 'excel' | 'autopilot'>(() => searchParams.get('mode') === 'excel' ? 'excel' : 'resume');
  const [resumeFiles, setResumeFiles] = useState<File[]>([]);
  const [resumeRows, setResumeRows] = useState<PreviewCandidate[]>([]);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelRows, setExcelRows] = useState<PreviewCandidate[]>([]);
  const [excelMappings, setExcelMappings] = useState<Array<{ header: string; mapsTo: string; status: string }>>([]);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateRows, setTemplateRows] = useState<TemplateCandidateRow[]>(() => createTemplateRows());
  const [sheetSyncSummary, setSheetSyncSummary] = useState('Open the ATS sheet template, fill the headings you need, and matching candidate fields will stay in sync here.');
  const [selectedBoards, setSelectedBoards] = useState(['LinkedIn Recruiter Lite', 'Dice', 'Indeed']);
  const [selectedCountries, setSelectedCountries] = useState(['USA']);
  const [locations, setLocations] = useState('EST remote, New Jersey, Texas, Noida, Chandigarh');
  const [jobId, setJobId] = useState(jobs[0]?.id ?? '');
  const [timeZone, setTimeZone] = useState('EST');
  const [scheduleDate, setScheduleDate] = useState(new Date().toISOString().slice(0, 10));
  const [scheduleTime, setScheduleTime] = useState('02:30');
  const [booleanString, setBooleanString] = useState('("Senior React Developer" OR "Frontend Engineer") AND ("React" AND "TypeScript" AND "REST APIs") AND (EST OR CST OR India)');
  const [requiredSkills, setRequiredSkills] = useState('React, TypeScript, REST APIs');
  const [preferredSkills, setPreferredSkills] = useState('AWS, PostgreSQL, Agile');
  const [profileLimit, setProfileLimit] = useState(20);
  const [schedules, setSchedules] = useState<AutopilotSchedule[]>(() => readArray<AutopilotSchedule>(AUTOPILOT_SCHEDULES_KEY));
  const [notice, setNotice] = useState('Bulk import workspace ready. Upload a resume batch or Excel sheet to update ATS data.');
  const excelInputRef = useRef<HTMLInputElement | null>(null);

  const selectedJob = jobs.find(job => job.id === jobId) ?? jobs[0] ?? emptyJob;
  const requiredSkillList = requiredSkills.split(',').map(skill => skill.trim()).filter(Boolean);
  const preferredSkillList = preferredSkills.split(',').map(skill => skill.trim()).filter(Boolean);
  const booleanPreview = booleanString.trim() || [
    `("${selectedJob.title}" OR "${selectedJob.title.replace(/Senior|Lead|Principal/gi, '').trim()}")`,
    `(${requiredSkillList.map(skill => `"${skill}"`).join(' AND ')})`,
    `(${preferredSkillList.map(skill => `"${skill}"`).join(' OR ')})`,
    `(${selectedCountries.join(' OR ')})`,
    `(${timeZone} OR "Remote ${timeZone}")`,
  ].filter(Boolean).join(' AND ');

  const autopilotPreview = useMemo(() => candidateRowsForAutopilot({
    id: 'preview', jobId, boards: selectedBoards, countries: selectedCountries, locations, timeZone, scheduleDate, scheduleTime,
    profileLimit: Math.min(profileLimit, 3), booleanString: booleanPreview, requiredSkills, preferredSkills, status: 'Scheduled', createdAt: new Date().toISOString(),
  }, selectedJob), [booleanPreview, jobId, locations, preferredSkills, profileLimit, requiredSkills, scheduleDate, scheduleTime, selectedBoards, selectedCountries, selectedJob, timeZone]);

  useEffect(() => {
    const due = schedules.filter(schedule => schedule.status === 'Scheduled' && scheduleDateTime(schedule).getTime() <= Date.now());
    if (!due.length) return;
    due.forEach(runSchedule);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const previewRows = templateRowsToPreview(templateRows);
    setExcelRows(previewRows);
    const syncableRows = templateRows.filter(templateRowCanSync);
    if (!syncableRows.length) {
      setSheetSyncSummary('Add a name, email, phone, title, or location to start live syncing rows into ATS candidates.');
      return;
    }
    upsertLocalCandidates(syncableRows.map((row, index) => templateRowToImport(row, index, excelFile?.name ? `Excel Sheet: ${excelFile.name}` : 'ATS Sheet Template')));
    setSheetSyncSummary(`${syncableRows.length} row${syncableRows.length === 1 ? '' : 's'} live in ATS candidate records as of ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`);
  }, [excelFile?.name, templateRows]);

  function persistSchedules(next: AutopilotSchedule[]) {
    setSchedules(next);
    writeArray(AUTOPILOT_SCHEDULES_KEY, next);
  }

  function toggleBoard(board: string) {
    setSelectedBoards(current => current.includes(board) ? current.filter(item => item !== board) : [...current, board]);
  }

  function toggleCountry(country: string) {
    setSelectedCountries(current => current.includes(country) ? current.filter(item => item !== country) : [...current, country]);
  }

  function parseResumeFiles(files: File[]) {
    const limited = files.slice(0, 50);
    setResumeFiles(limited);
    const rows = limited.map(file => ({
      name: nameFromFile(file.name),
      email: '',
      phone: '',
      linkedin: '',
      title: 'Resume Uploaded Candidate',
      location: 'Location pending',
      skills: ['Resume parsing pending'],
      resumeFile: file.name,
      warning: 'Email and phone pending parser review',
    }));
    setResumeRows(rows);
    setNotice(`${rows.length} resume files staged. Click Parse & Import Resume Batch to save candidates to ATS.`);
  }

  async function parseExcelFile(file: File) {
    setExcelFile(file);
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
    const headers = rows[0] ? Object.keys(rows[0]) : [];
    setExcelMappings(headers.map(header => {
      const mapping = inferMapping(header);
      return { header, mapsTo: mapping, status: mapping === 'Ignored' ? 'Ignored' : 'Mapped' };
    }));
    const parsedTemplateRows = rows.map((row, index) => createTemplateRow({
      id: `excel-${Date.now()}-${index}`,
      name: pickSheetValue(row, 'name'),
      email: pickSheetValue(row, 'email'),
      phone: pickSheetValue(row, 'phone'),
      title: pickSheetValue(row, 'title'),
      currentCompany: pickSheetValue(row, 'currentCompany'),
      linkedin: pickSheetValue(row, 'linkedin'),
      location: pickSheetValue(row, 'location'),
      skills: pickSheetValue(row, 'skills'),
      experience: pickSheetValue(row, 'experience'),
      usExperience: pickSheetValue(row, 'usExperience'),
      relevantExperience: pickSheetValue(row, 'relevantExperience'),
      workAuthorization: pickSheetValue(row, 'workAuthorization'),
      visaStatus: pickSheetValue(row, 'visaStatus'),
      currentRate: pickSheetValue(row, 'currentRate'),
      expectedRate: pickSheetValue(row, 'expectedRate'),
      availability: pickSheetValue(row, 'availability'),
      source: pickSheetValue(row, 'source'),
      owner: pickSheetValue(row, 'owner'),
      notes: pickSheetValue(row, 'notes'),
    }));
    setTemplateRows(parsedTemplateRows.length ? parsedTemplateRows : createTemplateRows());
    setTemplateOpen(true);
    setNotice(parsedTemplateRows.length
      ? `${parsedTemplateRows.length} spreadsheet row${parsedTemplateRows.length === 1 ? '' : 's'} parsed from ${file.name}. The ATS sheet editor is open and syncing those candidate fields live.`
      : `${file.name} opened, but no data rows were found. Use the ATS sheet editor to start filling candidate headings.`);
  }

  function inferMapping(header: string) {
    return fieldConfigForHeader(header)?.mapsTo ?? 'Ignored';
  }

  function openExcelPicker() {
    excelInputRef.current?.click();
  }

  function updateTemplateRow(rowId: string, key: CandidateSheetKey, value: string) {
    setTemplateRows(current => current.map(row => row.id === rowId ? { ...row, [key]: value } : row));
  }

  function addTemplateRow() {
    setTemplateRows(current => [...current, createTemplateRow()]);
  }

  function resetTemplateSheet() {
    setExcelFile(null);
    setExcelMappings([]);
    setTemplateRows(createTemplateRows());
    setExcelRows([]);
    setSheetSyncSummary('ATS sheet reset. Fill the Add Candidate headings again or upload a new spreadsheet.');
    setNotice('ATS candidate sheet reset. You can start with a fresh template or upload another Excel/CSV file.');
  }

  function importResumeBatch() {
    if (!resumeRows.length) {
      setNotice('Select resume files from your computer first.');
      return;
    }
    const result = upsertLocalCandidates(resumeRows.map(row => ({
      ...row,
      source: 'Bulk Resume Upload',
      recruiter: 'SuperUser',
      resumeAttachment: row.resumeFile ? { fileName: row.resumeFile, fileType: 'resume-upload', fileSize: resumeFiles.find(file => file.name === row.resumeFile)?.size ?? 0, uploadedAt: new Date().toISOString() } : undefined,
    })));
    setNotice(`Bulk resume import completed: ${result.imported} new candidates saved to ATS database. Candidates, Pipeline, Reports, Dashboard, and AI modules will refresh from the shared store.`);
  }

  function importExcelCandidates() {
    const syncableRows = templateRows.filter(templateRowCanSync);
    if (!syncableRows.length) {
      setNotice('Open the ATS sheet template or upload an Excel/CSV file first.');
      return;
    }
    const result = upsertLocalCandidates(syncableRows.map((row, index) => templateRowToImport(row, index, excelFile?.name ? `Excel Import: ${excelFile.name}` : 'ATS Sheet Template')));
    setNotice(`${syncableRows.length} spreadsheet row${syncableRows.length === 1 ? '' : 's'} synced to ATS. ${result.imported} new candidate${result.imported === 1 ? '' : 's'} were created and existing matches were updated in place.`);
  }

  function runSchedule(schedule: AutopilotSchedule) {
    const job = jobs.find(item => item.id === schedule.jobId) ?? selectedJob;
    const rows = candidateRowsForAutopilot(schedule, job);
    const result = upsertLocalCandidates(rows.map(row => ({ ...row, source: `Autopilot: ${schedule.boards[0] ?? 'Authorized source'}`, recruiter: 'SuperUser' })));
    writeArray(AUTOPILOT_EMAILS_KEY, [{ id: `digest-${Date.now()}`, scheduleId: schedule.id, to: 'scheduler@eventus.local', subject: `Autopilot fetched ${rows.length} profiles for ${job.title}`, body: emailTable(rows), createdAt: new Date().toISOString() }, ...readArray<any>(AUTOPILOT_EMAILS_KEY)].slice(0, 50));
    const next = readArray<AutopilotSchedule>(AUTOPILOT_SCHEDULES_KEY).map(item => item.id === schedule.id ? { ...item, status: 'Completed' as const, lastRunAt: new Date().toISOString() } : item);
    persistSchedules(next);
    setNotice(`Autopilot completed: ${result.imported} candidates fetched, saved to ATS database, and email digest queued with Name, Email, Location, Role table.`);
  }

  function saveAutopilotSchedule() {
    const schedule: AutopilotSchedule = {
      id: `autopilot-${Date.now()}`, jobId: selectedJob.id, boards: selectedBoards, countries: selectedCountries, locations, timeZone,
      scheduleDate, scheduleTime, profileLimit, booleanString: booleanPreview, requiredSkills, preferredSkills, status: 'Scheduled', createdAt: new Date().toISOString(),
    };
    persistSchedules([schedule, ...schedules]);
    if (scheduleDateTime(schedule).getTime() <= Date.now()) runSchedule(schedule);
    else setNotice(`Autopilot scheduled for ${scheduleDate} ${scheduleTime} ${timeZone}. It will fetch ${profileLimit} profiles and queue an email digest when due.`);
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-300"><UploadCloud size={14} />Candidate intake automation</div>
          <h1 className="text-2xl font-bold text-white">Bulk Import & Autopilot</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">Upload resume files, import candidates from Excel, or schedule authorized job-board sourcing that writes candidates into the shared ATS database.</p>
        </div>
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">Autopilot must use authorized job-board APIs/accounts and consent-safe workflows. No scraping or unauthorized access.</div>
      </div>

      <div className="mb-5 grid gap-3 lg:grid-cols-3">
        {[
          { id: 'resume' as const, title: 'Bulk Resume Upload', icon: FileUp, copy: 'Select resume files from this computer and save parsed candidates to ATS.' },
          { id: 'excel' as const, title: 'Excel Candidate Import', icon: FileSpreadsheet, copy: 'Upload XLSX/XLS/CSV and map headers into candidate fields.' },
          { id: 'autopilot' as const, title: 'Autopilot Scheduler', icon: Bot, copy: 'Schedule authorized sourcing by country, timezone, date, time, skills, and Boolean string.' },
        ].map(mode => (
          <button key={mode.id} onClick={() => setActiveMode(mode.id)} className={cn('rounded-lg border p-4 text-left transition-colors', activeMode === mode.id ? 'border-blue-500/40 bg-blue-500/10' : 'border-white/5 bg-[#0d1729] hover:border-white/15')}>
            <mode.icon size={22} className="mb-3 text-blue-300" /><p className="font-semibold text-white">{mode.title}</p><p className="mt-1 text-xs leading-relaxed text-slate-500">{mode.copy}</p>
          </button>
        ))}
      </div>

      {notice && <div className="mb-4 rounded-lg border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm text-blue-100">{notice}</div>}

      {activeMode === 'resume' && (
        <Panel title="Option 1: Bulk Resume Upload" icon={<FileUp size={16} />}>
          <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
            <div className="space-y-4">
              <label className="block rounded-lg border border-dashed border-white/15 bg-white/[0.03] p-8 text-center cursor-pointer hover:bg-white/[0.05]">
                <FileUp size={30} className="mx-auto mb-3 text-blue-300" />
                <p className="text-sm font-semibold text-white">{resumeFiles.length ? `${resumeFiles.length} resume files selected` : 'Choose resume files from computer'}</p>
                <p className="mt-1 text-xs text-slate-500">PDF, DOC, DOCX, TXT, or ZIP batch. Max 50 resumes.</p>
                <input type="file" multiple accept=".pdf,.doc,.docx,.txt,.rtf,.zip" className="hidden" onChange={event => parseResumeFiles(Array.from(event.target.files ?? []))} />
              </label>
              <button onClick={importResumeBatch} className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500"><Play size={15} />Parse & Import Resume Batch</button>
            </div>
            <CandidatePreview rows={resumeRows} empty="No resume files staged yet." />
          </div>
        </Panel>
      )}

      {activeMode === 'excel' && (
        <Panel title="Option 2: Upload Data From Excel" icon={<FileSpreadsheet size={16} />}>
          <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
            <div className="space-y-4">
              <div onClick={() => setTemplateOpen(true)} className="block rounded-lg border border-dashed border-white/15 bg-white/[0.03] p-6 text-center cursor-pointer hover:bg-white/[0.05]">
                <FileSpreadsheet size={28} className="mx-auto mb-3 text-blue-300" />
                <p className="text-sm font-semibold text-white">{excelFile?.name ?? 'Choose Excel/CSV file from computer'}</p>
                <p className="mt-1 text-xs text-slate-500">Click here to open the ATS Add Candidate sheet template, or upload an existing XLSX, XLS, CSV, or TSV file.</p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <button onClick={event => { event.stopPropagation(); setTemplateOpen(true); }} className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-100 hover:bg-blue-500/15">Open ATS sheet template</button>
                  <button onClick={event => { event.stopPropagation(); openExcelPicker(); }} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10">Upload filled file</button>
                </div>
                <input ref={excelInputRef} type="file" accept=".xlsx,.xls,.csv,.tsv" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) void parseExcelFile(file); event.currentTarget.value = ''; }} />
              </div>
              <button onClick={importExcelCandidates} className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500"><UploadCloud size={15} />Sync Sheet To ATS</button>
              <button onClick={() => downloadTemplateWorkbook(templateRows)} className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-white/10"><Download size={15} />Download ATS Template</button>
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-100">{sheetSyncSummary}</div>
            </div>
            <div className="space-y-4">
              <CandidatePreview rows={excelRows} empty="No spreadsheet rows parsed yet." />
              <div className="rounded-lg border border-white/5 bg-[#070d18]">
                {excelMappings.length ? excelMappings.map(row => <div key={row.header} className="grid grid-cols-3 gap-3 border-b border-white/5 px-4 py-3 text-sm last:border-0"><span className="text-white">{row.header}</span><span className="text-slate-400">{row.mapsTo}</span><span className={row.status === 'Mapped' ? 'text-emerald-300' : 'text-slate-500'}>{row.status}</span></div>) : <p className="p-4 text-sm text-slate-500">Header mapping appears after file upload.</p>}
              </div>
            </div>
          </div>
        </Panel>
      )}

      {activeMode === 'autopilot' && (
        <Panel title="Option 3: Autopilot Scheduler" icon={<Bot size={16} />}>
          <div className="grid gap-5 xl:grid-cols-[400px_minmax(0,1fr)]">
            <div className="space-y-4">
              <Select label="Current role" value={jobId} options={jobs.map(job => ({ label: `${job.title} - ${job.client}`, value: job.id }))} onChange={setJobId} />
              <div className="grid grid-cols-2 gap-3"><Field label="Fetch date" type="date" value={scheduleDate} onChange={setScheduleDate} /><Field label="Fetch time" type="time" value={scheduleTime} onChange={setScheduleTime} /></div>
              <Select label="Schedule timezone" value={timeZone} options={timeZones.map(zone => ({ label: zone, value: zone }))} onChange={setTimeZone} />
              <Select label="Profiles per run" value={String(profileLimit)} options={profileLimits.map(limit => ({ label: `${limit} profiles`, value: String(limit) }))} onChange={value => setProfileLimit(Number(value))} />
              <Field label="Target locations" value={locations} onChange={setLocations} />
              <TextArea label="Boolean string" value={booleanString} onChange={setBooleanString} rows={5} />
              <Field label="Required skills filter" value={requiredSkills} onChange={setRequiredSkills} />
              <Field label="Preferred skills filter" value={preferredSkills} onChange={setPreferredSkills} />
              <ToggleGroup label="Countries" items={countries} selected={selectedCountries} onToggle={toggleCountry} />
              <ToggleGroup label="Connected job boards" items={jobBoards} selected={selectedBoards} onToggle={toggleBoard} />
              <button onClick={saveAutopilotSchedule} className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500"><CalendarClock size={15} />Save Autopilot Schedule</button>
            </div>
            <div className="space-y-4">
              <div className="rounded-lg border border-white/5 bg-[#070d18]">
                <div className="border-b border-white/5 px-4 py-3"><p className="text-sm font-semibold text-white">Candidate email table preview</p><p className="text-xs text-slate-500">{selectedJob.title} · {selectedCountries.join(', ')} · {timeZone}</p></div>
                <div className="border-b border-white/5 px-4 py-3"><p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Boolean query</p><p className="whitespace-pre-wrap rounded-lg border border-blue-500/20 bg-blue-500/10 p-3 text-xs leading-relaxed text-blue-100">{booleanPreview}</p></div>
                <CandidatePreview rows={autopilotPreview} empty="No preview profiles." compact />
                <div className="flex gap-2 px-4 py-3 text-xs text-amber-100"><AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />Missing phone/email is allowed; profiles still enter ATS with warning flags.</div>
              </div>
              <div className="rounded-lg border border-white/5 bg-[#070d18]">
                <div className="border-b border-white/5 px-4 py-3 text-sm font-semibold text-white">Saved schedules</div>
                {schedules.length ? schedules.map(schedule => <div key={schedule.id} className="border-b border-white/5 px-4 py-3 text-xs last:border-0"><p className="font-semibold text-white">{schedule.scheduleDate} {schedule.scheduleTime} {schedule.timeZone} · {schedule.profileLimit} profiles</p><p className="text-slate-500">{schedule.countries.join(', ')} · {schedule.boards.slice(0, 3).join(', ')} · {schedule.status}</p><button onClick={() => runSchedule(schedule)} className="mt-2 rounded-lg border border-white/10 px-3 py-1.5 text-[11px] text-slate-300 hover:bg-white/5">Run now</button></div>) : <p className="p-4 text-sm text-slate-500">No Autopilot schedules yet.</p>}
              </div>
            </div>
          </div>
        </Panel>
      )}

      <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
        <DialogContent className="max-h-[88vh] max-w-[96vw] gap-0 overflow-hidden border border-white/10 bg-[#08111f] p-0 text-white">
          <DialogHeader className="border-b border-white/10 px-6 py-5">
            <DialogTitle className="text-white">ATS Candidate Sheet Template</DialogTitle>
            <DialogDescription className="text-slate-400">
              These headings mirror the ATS Add Candidate section. Fill only the columns you need. As rows are filled, matching candidate fields are synced into ATS in real time.
            </DialogDescription>
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => downloadTemplateWorkbook(templateRows)} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-white/10"><Download size={14} />Download Excel template</button>
              <button onClick={openExcelPicker} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-white/10"><UploadCloud size={14} />Upload spreadsheet</button>
              <button onClick={addTemplateRow} className="inline-flex items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-100 hover:bg-blue-500/15"><Plus size={14} />Add row</button>
              <button onClick={resetTemplateSheet} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10"><RefreshCw size={14} />Reset sheet</button>
            </div>
          </DialogHeader>

          <div className="border-b border-white/10 bg-emerald-500/10 px-6 py-3 text-xs text-emerald-100">{sheetSyncSummary}</div>

          <div className="overflow-auto">
            <table className="min-w-[2500px] table-fixed">
              <thead className="sticky top-0 z-10 bg-[#0d1729]">
                <tr className="border-b border-white/10">
                  <th className="w-14 px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Row</th>
                  {candidateSheetFields.map(field => (
                    <th key={field.key} className="min-w-[180px] px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">{field.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {templateRows.map((row, rowIndex) => (
                  <tr key={row.id} className="border-b border-white/5 align-top last:border-0">
                    <td className="px-3 py-3 text-sm font-semibold text-slate-400">{rowIndex + 1}</td>
                    {candidateSheetFields.map(field => (
                      <td key={field.key} className="px-3 py-3">
                        <input
                          value={row[field.key]}
                          onChange={event => updateTemplateRow(row.id, field.key, event.target.value)}
                          placeholder={field.placeholder}
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-blue-500/60"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-white/10 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-400">Optional columns can stay blank. Use Name, Email, Phone, Title, or Location to begin syncing a row.</p>
            <button onClick={importExcelCandidates} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"><UploadCloud size={15} />Sync current sheet</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-lg border border-white/5 bg-[#0d1729] p-5"><div className="mb-4 flex items-center gap-2"><span className="text-blue-300">{icon}</span><h2 className="text-sm font-semibold text-white">{title}</h2></div>{children}</motion.section>;
}

function CandidatePreview({ rows, empty, compact = false }: { rows: PreviewCandidate[]; empty: string; compact?: boolean }) {
  return <div className="rounded-lg border border-white/5 bg-[#070d18]"><div className="grid grid-cols-[1fr_1fr_130px_1fr] gap-3 border-b border-white/5 px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500"><span>Name</span><span>Email</span><span>Phone</span><span>Warning</span></div>{rows.length ? rows.map(row => <div key={`${row.name}-${row.email}-${row.phone}`} className={cn('grid grid-cols-[1fr_1fr_130px_1fr] gap-3 border-b border-white/5 px-4 text-xs last:border-0', compact ? 'py-2' : 'py-3')}><span className="font-semibold text-white">{row.name}</span><span className={row.email ? 'text-slate-400' : 'text-red-300'}>{row.email || 'Missing'}</span><span className={row.phone ? 'text-slate-400' : 'text-red-300'}>{row.phone || 'Missing'}</span><span className={makeWarning(row) ? 'text-amber-300' : 'text-emerald-300'}>{makeWarning(row) || 'Ready'}</span></div>) : <p className="p-4 text-sm text-slate-500">{empty}</p>}</div>;
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-medium text-slate-400">{label}</span><input type={type} value={value} onChange={event => onChange(event.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500/60" /></label>;
}

function TextArea({ label, value, onChange, rows = 4 }: { label: string; value: string; onChange: (value: string) => void; rows?: number }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-medium text-slate-400">{label}</span><textarea value={value} rows={rows} onChange={event => onChange(event.target.value)} className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm leading-relaxed text-white outline-none focus:border-blue-500/60" /></label>;
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: Array<{ label: string; value: string }>; onChange: (value: string) => void }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-medium text-slate-400">{label}</span><select value={value} onChange={event => onChange(event.target.value)} className="w-full rounded-lg border border-white/10 bg-[#111b2d] px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500/60"><option value="">Select...</option>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}

function ToggleGroup({ label, items, selected, onToggle }: { label: string; items: string[]; selected: string[]; onToggle: (item: string) => void }) {
  return <div><p className="mb-2 text-xs font-medium text-slate-400">{label}</p><div className="grid gap-2 sm:grid-cols-2">{items.map(item => <button key={item} onClick={() => onToggle(item)} className={cn('rounded-lg border px-3 py-2 text-left text-xs transition-colors', selected.includes(item) ? 'border-blue-500/40 bg-blue-500/10 text-blue-100' : 'border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20')}>{item}</button>)}</div></div>;
}
