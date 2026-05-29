import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import * as XLSX from 'xlsx';
import { AlertTriangle, Bot, CalendarClock, FileSpreadsheet, FileUp, Play, UploadCloud } from 'lucide-react';
import { getAllJobs } from '@/lib/localRecords';
import { upsertLocalCandidates } from '@/lib/atsLocalStore';
import { currentOwnerName } from '@/lib/auth';
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
  experience?: number;
  education?: string;
  certifications?: string;
  workAuthorization?: string;
  visaStatus?: string;
  parsedResumeDetails?: string;
  summary?: string;
  notes?: string[];
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

type ExcelRow = Record<string, unknown>;
type AutopilotEmailDigest = {
  id: string;
  scheduleId: string;
  to: string;
  subject: string;
  body: string;
  createdAt: string;
};

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

const sectionHeadings = [
  'summary', 'profile', 'objective', 'experience', 'employment', 'work history', 'skills',
  'technical skills', 'education', 'certifications', 'projects', 'visa', 'authorization',
  'contact', 'awards', 'publications',
];

const knownSkills = [
  'JavaScript', 'TypeScript', 'React', 'Angular', 'Vue', 'Node.js', 'Express', 'Next.js',
  'HTML', 'CSS', 'Tailwind', 'Bootstrap', 'Java', 'Spring', 'Python', 'Django', 'Flask',
  'C#', '.NET', 'ASP.NET', 'SQL', 'PostgreSQL', 'MySQL', 'SQL Server', 'Oracle', 'MongoDB',
  'Redis', 'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Terraform', 'Jenkins', 'Git',
  'REST', 'GraphQL', 'API', 'Microservices', 'Agile', 'Scrum', 'Salesforce', 'ServiceNow',
  'SAP', 'Power BI', 'Tableau', 'Excel', 'ETL', 'Snowflake', 'Databricks', 'Spark',
  'Machine Learning', 'AI', 'Data Analysis', 'QA', 'Selenium', 'Cypress', 'Playwright',
  'Jira', 'Linux', 'Windows', 'Networking', 'Security', 'DevOps', 'CI/CD',
];

const roleKeywords = [
  'Developer', 'Engineer', 'Architect', 'Analyst', 'Administrator', 'Consultant', 'Manager',
  'Lead', 'Specialist', 'Recruiter', 'Designer', 'Tester', 'QA', 'Data Scientist',
  'Scrum Master', 'Product Owner', 'Business Analyst', 'Project Manager',
];

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function pick(row: ExcelRow, headers: string[]) {
  const entries = Object.entries(row);
  for (const wanted of headers) {
    const found = entries.find(([key]) => normalizeHeader(key) === wanted || normalizeHeader(key).includes(wanted));
    if (found && found[1] != null) return String(found[1]).trim();
  }
  return '';
}

function compactText(value: string) {
  return value.replace(/\r/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function cleanRtf(value: string) {
  return compactText(value
    .replace(/\\'[0-9a-fA-F]{2}/g, ' ')
    .replace(/\\[a-zA-Z]+\d* ?/g, ' ')
    .replace(/[{}]/g, ' '));
}

function extractPdfText(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 8192;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(index, index + chunkSize));
  }
  const matches = [...binary.matchAll(/\((?:\\.|[^\\)]){2,}\)/g)]
    .map(match => match[0].slice(1, -1).replace(/\\[nrtbf()]/g, ' '))
    .filter(text => /[a-zA-Z@]/.test(text));
  return compactText(matches.join('\n'));
}

function cleanBinaryText(value: string) {
  return compactText(Array.from(value).map(character => {
    const code = character.charCodeAt(0);
    return code === 9 || code === 10 || code === 13 || (code >= 32 && code <= 126) ? character : ' ';
  }).join(''));
}

async function readResumeText(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (['txt', 'text', 'md'].includes(extension)) return compactText(await file.text());
  if (['rtf'].includes(extension)) return cleanRtf(await file.text());
  if (extension === 'pdf') return extractPdfText(await file.arrayBuffer());
  if (extension === 'docx' || extension === 'zip') return '';
  return cleanBinaryText(await file.text().catch(() => ''));
}

function lineLooksLikeHeading(line: string) {
  const normalized = line.trim().toLowerCase().replace(/:$/, '');
  return sectionHeadings.some(heading => normalized === heading || normalized.includes(heading));
}

function extractSection(text: string, headingPatterns: RegExp[]) {
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  const startIndex = lines.findIndex(line => headingPatterns.some(pattern => pattern.test(line)));
  if (startIndex < 0) return '';
  const picked: string[] = [];
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    if (picked.length && lineLooksLikeHeading(lines[index])) break;
    if (picked.length >= 8) break;
    picked.push(lines[index]);
  }
  return picked.join('; ');
}

function extractEmail(text: string) {
  return text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? '';
}

function extractPhone(text: string) {
  const phones = [...text.matchAll(/(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/g)]
    .map(match => match[0].trim());
  return phones[0] ?? '';
}

function extractLinkedIn(text: string) {
  return text.match(/https?:\/\/(?:www\.)?linkedin\.com\/[^\s)]+/i)?.[0]
    ?? text.match(/(?:www\.)?linkedin\.com\/[^\s)]+/i)?.[0]
    ?? '';
}

function extractName(text: string, fallback: string) {
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  const candidateLine = lines.slice(0, 12).find(line => {
    if (line.length < 3 || line.length > 60) return false;
    if (/@|www\.|http|resume|curriculum|vitae|phone|email|linkedin/i.test(line)) return false;
    if (lineLooksLikeHeading(line)) return false;
    const words = line.split(/\s+/).filter(Boolean);
    return words.length >= 2 && words.length <= 5 && words.every(word => /^[A-Za-z.'-]+$/.test(word));
  });
  return candidateLine || fallback;
}

function extractTitle(text: string) {
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  return lines.slice(0, 25).find(line =>
    line.length <= 80 && roleKeywords.some(keyword => new RegExp(`\\b${keyword}\\b`, 'i').test(line))
  ) ?? '';
}

function extractLocation(text: string) {
  return text.match(/(?:Location|Address)\s*[:|-]\s*([^\n]+)/i)?.[1]?.trim() ?? '';
}

function extractExperience(text: string) {
  const years = [...text.matchAll(/(\d{1,2})\+?\s*(?:years|yrs)\b/gi)]
    .map(match => Number(match[1]))
    .filter(Number.isFinite);
  return years.length ? Math.max(...years) : undefined;
}

function extractSkills(text: string) {
  const lower = text.toLowerCase();
  const skillSection = extractSection(text, [/^technical skills\b/i, /^skills\b/i, /^core competencies\b/i]);
  const sectionSkills = skillSection.split(/[,|•;/]/).map(skill => skill.trim()).filter(skill => skill.length > 1 && skill.length < 40);
  const dictionarySkills = knownSkills.filter(skill => lower.includes(skill.toLowerCase()));
  return Array.from(new Set([...sectionSkills, ...dictionarySkills])).slice(0, 24);
}

function extractEducation(text: string) {
  const educationSection = extractSection(text, [/^education\b/i, /^academic/i]);
  const degreeLines = text.split('\n').map(line => line.trim()).filter(line =>
    /\b(Bachelor|Master|MBA|B\.?S\.?|M\.?S\.?|B\.?Tech|M\.?Tech|Ph\.?D|University|College|Degree|Diploma)\b/i.test(line)
  );
  return compactText([educationSection, ...degreeLines.slice(0, 4)].filter(Boolean).join('; '));
}

function extractCertifications(text: string) {
  const certSection = extractSection(text, [/^certifications?\b/i, /^licenses?\b/i]);
  const certLines = text.split('\n').map(line => line.trim()).filter(line =>
    /\b(Certified|Certification|AWS|Azure|Scrum|PMP|ITIL|Salesforce|Oracle|Microsoft Certified)\b/i.test(line)
  );
  return compactText([certSection, ...certLines.slice(0, 5)].filter(Boolean).join('; '));
}

function extractAuthorization(text: string) {
  return text.match(/\b(US Citizen|Green Card|GC|H-?1B|H4 EAD|L2 EAD|OPT|CPT|TN Visa|EAD|Work Authorization)[^\n]*/i)?.[0] ?? '';
}

function parseResumeText(text: string, fileName: string): PreviewCandidate {
  const cleaned = compactText(text);
  const fallbackName = nameFromFile(fileName);
  const email = extractEmail(cleaned);
  const phone = extractPhone(cleaned);
  const skills = extractSkills(cleaned);
  const education = extractEducation(cleaned);
  const certifications = extractCertifications(cleaned);
  const workAuthorization = extractAuthorization(cleaned);
  const experience = extractExperience(cleaned);
  const title = extractTitle(cleaned);
  const location = extractLocation(cleaned);
  const name = extractName(cleaned, fallbackName);
  const summaryLines = [
    title && `Role: ${title}`,
    typeof experience === 'number' && `Experience: ${experience} years`,
    skills.length && `Skills: ${skills.join(', ')}`,
    education && `Education: ${education}`,
    certifications && `Certifications: ${certifications}`,
    workAuthorization && `Work authorization: ${workAuthorization}`,
  ].filter(Boolean);

  return {
    name,
    email,
    phone,
    linkedin: extractLinkedIn(cleaned),
    title,
    location,
    skills,
    experience,
    education,
    certifications,
    workAuthorization,
    visaStatus: workAuthorization,
    parsedResumeDetails: summaryLines.join('\n'),
    summary: summaryLines.join('. '),
    notes: [`Resume parser extracted ${summaryLines.length} profile fields from ${fileName}.`],
    resumeFile: fileName,
    warning: makeWarning({ name, email, phone }) || (!cleaned ? 'Resume text could not be read; import will keep blanks for missing fields.' : ''),
  };
}

function makeWarning(row: PreviewCandidate) {
  const missing = [!row.name && 'Name missing', !row.email && 'Email missing', !row.phone && 'Phone missing'].filter(Boolean);
  return row.warning || missing.join(', ');
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

  async function parseResumeFiles(files: File[]) {
    const limited = files.slice(0, 50);
    setResumeFiles(limited);
    setNotice(`Reading ${limited.length} resume file${limited.length === 1 ? '' : 's'} and extracting candidate details...`);
    const rows = await Promise.all(limited.map(async file => {
      const text = await readResumeText(file);
      return parseResumeText(text, file.name);
    }));
    setResumeRows(rows);
    const extractedEmails = rows.filter(row => row.email).length;
    const extractedPhones = rows.filter(row => row.phone).length;
    const extractedSkills = rows.filter(row => row.skills?.length).length;
    setNotice(`${rows.length} resume files parsed. Extracted ${extractedEmails} emails, ${extractedPhones} phones, and skills from ${extractedSkills} resumes. Review preview, then click Parse & Import Resume Batch.`);
  }

  async function parseExcelFile(file: File) {
    setExcelFile(file);
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<ExcelRow>(sheet, { defval: '' });
    const headers = rows[0] ? Object.keys(rows[0]) : [];
    setExcelMappings(headers.map(header => ({ header, mapsTo: inferMapping(header), status: inferMapping(header) === 'Ignored' ? 'Ignored' : 'Mapped' })));
    const parsed = rows.map((row, index) => {
      const candidate = {
        name: pick(row, ['name', 'fullname', 'candidatename']) || `Excel Candidate ${index + 1}`,
        email: pick(row, ['email', 'emailaddress']),
        phone: pick(row, ['phone', 'phonenumber', 'mobile', 'contact']),
        linkedin: pick(row, ['linkedin', 'linkedinurl']),
        title: pick(row, ['title', 'role', 'currenttitle', 'jobtitle']) || 'Excel Imported Candidate',
        location: pick(row, ['location', 'currentlocation', 'city']) || 'Location pending',
        skills: pick(row, ['skills', 'skillset', 'technologies']).split(',').map(skill => skill.trim()).filter(Boolean),
      };
      return { ...candidate, warning: makeWarning(candidate) };
    });
    setExcelRows(parsed);
    setNotice(`${parsed.length} Excel rows parsed from ${file.name}. Click Import Excel Candidates to commit them to ATS.`);
  }

  function inferMapping(header: string) {
    const normalized = normalizeHeader(header);
    if (normalized.includes('name')) return 'Candidate name';
    if (normalized.includes('email')) return 'Email';
    if (normalized.includes('phone') || normalized.includes('mobile')) return 'Phone';
    if (normalized.includes('linkedin')) return 'LinkedIn URL';
    if (normalized.includes('location') || normalized.includes('city')) return 'Location';
    if (normalized.includes('skill')) return 'Skills';
    if (normalized.includes('title') || normalized.includes('role')) return 'Current title';
    return 'Ignored';
  }

  function importResumeBatch() {
    if (!resumeRows.length) {
      setNotice('Select resume files from your computer first.');
      return;
    }
    const owner = currentOwnerName();
    const result = upsertLocalCandidates(resumeRows.map(row => ({
      ...row,
      source: 'Bulk Resume Upload',
      recruiter: owner,
      resumeAttachment: row.resumeFile ? { fileName: row.resumeFile, fileType: 'resume-upload', fileSize: resumeFiles.find(file => file.name === row.resumeFile)?.size ?? 0, uploadedAt: new Date().toISOString() } : undefined,
    })));
    setNotice(`Bulk resume import completed: ${result.imported} new candidates saved to ATS database. Candidates, Pipeline, Reports, Dashboard, and AI modules will refresh from the shared store.`);
  }

  function importExcelCandidates() {
    if (!excelRows.length) {
      setNotice('Upload and parse an Excel/CSV file first.');
      return;
    }
    const result = upsertLocalCandidates(excelRows.map(row => ({ ...row, source: 'Excel Import', recruiter: currentOwnerName() })));
    setNotice(`Excel import committed to ATS database: ${result.imported} new candidates saved and available across Candidates, Pipeline, Reports, Dashboard, and AI modules.`);
  }

  function runSchedule(schedule: AutopilotSchedule) {
    const job = jobs.find(item => item.id === schedule.jobId) ?? selectedJob;
    const rows = candidateRowsForAutopilot(schedule, job);
    const result = upsertLocalCandidates(rows.map(row => ({ ...row, source: `Autopilot: ${schedule.boards[0] ?? 'Authorized source'}`, recruiter: currentOwnerName(job.recruiter) })));
    writeArray(AUTOPILOT_EMAILS_KEY, [{ id: `digest-${Date.now()}`, scheduleId: schedule.id, to: 'scheduler@eventus.local', subject: `Autopilot fetched ${rows.length} profiles for ${job.title}`, body: emailTable(rows), createdAt: new Date().toISOString() }, ...readArray<AutopilotEmailDigest>(AUTOPILOT_EMAILS_KEY)].slice(0, 50));
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
                <p className="mt-1 text-xs text-slate-500">Text-based PDF, TXT, RTF, DOC, DOCX, or ZIP batch. Max 50 resumes. Scanned PDFs may need manual review.</p>
                <input type="file" multiple accept=".pdf,.doc,.docx,.txt,.rtf,.zip" className="hidden" onChange={event => { void parseResumeFiles(Array.from(event.target.files ?? [])); }} />
              </label>
              <button onClick={importResumeBatch} className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500"><Play size={15} />Parse & Import Resume Batch</button>
            </div>
            <CandidatePreview rows={resumeRows} empty="No resume files staged yet." showRoleAndSkills />
          </div>
        </Panel>
      )}

      {activeMode === 'excel' && (
        <Panel title="Option 2: Upload Data From Excel" icon={<FileSpreadsheet size={16} />}>
          <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
            <div className="space-y-4">
              <label className="block rounded-lg border border-dashed border-white/15 bg-white/[0.03] p-6 text-center cursor-pointer hover:bg-white/[0.05]">
                <FileSpreadsheet size={28} className="mx-auto mb-3 text-blue-300" />
                <p className="text-sm font-semibold text-white">{excelFile?.name ?? 'Choose Excel/CSV file from computer'}</p>
                <p className="mt-1 text-xs text-slate-500">Supports XLSX, XLS, CSV, TSV.</p>
                <input type="file" accept=".xlsx,.xls,.csv,.tsv" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) void parseExcelFile(file); }} />
              </label>
              <button onClick={importExcelCandidates} className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500"><UploadCloud size={15} />Import Excel Candidates</button>
            </div>
            <div className="space-y-4">
              <CandidatePreview rows={excelRows} empty="No spreadsheet rows parsed yet." showRoleAndSkills />
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
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-lg border border-white/5 bg-[#0d1729] p-5"><div className="mb-4 flex items-center gap-2"><span className="text-blue-300">{icon}</span><h2 className="text-sm font-semibold text-white">{title}</h2></div>{children}</motion.section>;
}

function CandidatePreview({ rows, empty, compact = false, showRoleAndSkills = false }: { rows: PreviewCandidate[]; empty: string; compact?: boolean; showRoleAndSkills?: boolean }) {
  const gridClass = showRoleAndSkills
    ? 'grid-cols-[minmax(140px,1fr)_minmax(160px,1fr)_130px_minmax(150px,0.9fr)_minmax(180px,1.1fr)_minmax(180px,1fr)_minmax(160px,1fr)]'
    : 'grid-cols-[1fr_1fr_130px_1fr]';

  return <div className="overflow-x-auto rounded-lg border border-white/5 bg-[#070d18]"><div className={cn('grid min-w-[900px] gap-3 border-b border-white/5 px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500', gridClass)}><span>Name</span><span>Email</span><span>Phone</span>{showRoleAndSkills && <><span>Role</span><span>Skills</span><span>Education</span></>}<span>Warning</span></div>{rows.length ? rows.map(row => <div key={`${row.name}-${row.email}-${row.phone}-${row.resumeFile}`} className={cn('grid min-w-[900px] gap-3 border-b border-white/5 px-4 text-xs last:border-0', gridClass, compact ? 'py-2' : 'py-3')}><span className="font-semibold text-white">{row.name}</span><span className={row.email ? 'text-slate-400' : 'text-red-300'}>{row.email || 'Missing'}</span><span className={row.phone ? 'text-slate-400' : 'text-red-300'}>{row.phone || 'Missing'}</span>{showRoleAndSkills && <><span className="text-slate-300">{row.title || 'Blank'}</span><span className="text-slate-400">{row.skills?.length ? row.skills.join(', ') : 'Blank'}</span><span className="text-slate-400">{row.education || 'Blank'}</span></>}<span className={makeWarning(row) ? 'text-amber-300' : 'text-emerald-300'}>{makeWarning(row) || 'Ready'}</span></div>) : <p className="p-4 text-sm text-slate-500">{empty}</p>}</div>;
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
