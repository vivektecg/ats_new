import { useState } from 'react';
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import {
  CalendarClock, CheckCircle2, ChevronLeft, ChevronRight, Clock,
  Eye, Mail, MapPin, Monitor, Phone, RefreshCw, Star, UserX, Video,
} from 'lucide-react';
import { QuickActionModal, QuickIconButton } from '@/components/ats/QuickActionModal';
import { interviews } from '@/lib/data';
import { getAllCandidates, getAllClients, getAllJobs } from '@/lib/localRecords';
import { LOCAL_INTERVIEWS_KEY, saveRows } from '@/lib/atsApi';
import { cn } from '@/lib/utils';
import type { Interview } from '@/lib/types';

type MeetingPlatform = NonNullable<Interview['meetingPlatform']>;

interface InterviewFormState {
  candidateId: string;
  jobId: string;
  type: Interview['type'];
  date: string;
  time: string;
  timeZone: string;
  duration: string;
  interviewer: string;
  candidateAvailability: string;
  clientAvailability: string;
  meetingPlatform: MeetingPlatform;
  meetingLink: string;
  reminderSchedule: string;
}

const typeIcons: Record<Interview['type'], ReactNode> = {
  Video: <Video size={11} />,
  Phone: <Phone size={11} />,
  'On-site': <MapPin size={11} />,
  Technical: <Monitor size={11} />,
};

const typeColors: Record<Interview['type'], string> = {
  Video: 'bg-blue-500/20 text-blue-400 border-blue-500/20',
  Phone: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20',
  'On-site': 'bg-amber-500/20 text-amber-400 border-amber-500/20',
  Technical: 'bg-violet-500/20 text-violet-400 border-violet-500/20',
};

const statusColors: Record<Interview['status'], string> = {
  Scheduled: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
  Completed: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  Cancelled: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
  'No Show': 'bg-red-500/10 text-red-300 border-red-500/20',
};

const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const interviewTimeZones = ['IND', 'EST', 'CST', 'MST', 'PST', 'UTC', 'GMT'];

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: (number | null)[] = Array(firstDay).fill(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);
  return days;
}

function loadLocalInterviews(): Interview[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(LOCAL_INTERVIEWS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalInterviews(nextInterviews: Interview[]) {
  window.localStorage.setItem(LOCAL_INTERVIEWS_KEY, JSON.stringify(nextInterviews));
  saveRows('interviews', nextInterviews);
}

function generateMeetingLink(platform: MeetingPlatform, candidateName: string) {
  const slug = candidateName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (platform === 'Google Meet') return `https://meet.google.com/eventus-${slug}`;
  if (platform === 'Zoom') return `https://zoom.us/j/eventus-${slug}`;
  if (platform === 'Microsoft Teams' || platform === 'Teams Calendar') return `https://teams.microsoft.com/l/meetup-join/eventus-${slug}`;
  if (platform === 'Video Call') return `Video call link pending - add client bridge or custom URL`;
  if (platform === 'Phone') return 'Phone screen - recruiter will call candidate';
  return 'On-site interview - location shared by client';
}

function enrichInterview(interview: Interview): Interview {
  const availableCandidates = getAllCandidates();
  const availableClients = getAllClients();
  const candidate = availableCandidates.find(item => item.id === interview.candidateId);
  const client = availableClients.find(item => item.name === interview.clientName);
  const platform: MeetingPlatform = interview.meetingPlatform ?? (interview.type === 'Phone' ? 'Phone' : interview.type === 'On-site' ? 'On-site' : 'Google Meet');

  return {
    ...interview,
    candidateAvailability: interview.candidateAvailability ?? candidate?.availability ?? 'Needs confirmation',
    clientAvailability: interview.clientAvailability ?? client?.interviewProcess ?? 'Client availability not confirmed',
    meetingPlatform: platform,
    meetingLink: interview.meetingLink ?? generateMeetingLink(platform, interview.candidateName),
    reminderEmailSent: interview.reminderEmailSent ?? false,
    reminderSchedule: interview.reminderSchedule ?? '24 hours before interview',
    rescheduleCount: interview.rescheduleCount ?? 0,
    rescheduleHistory: interview.rescheduleHistory ?? [],
  };
}

function defaultForm(): InterviewFormState {
  const availableCandidates = getAllCandidates();
  const availableJobs = getAllJobs();
  const availableClients = getAllClients();
  const candidate = availableCandidates[0];
  const job = availableJobs[0];
  const platform: MeetingPlatform = 'Google Meet';

  return {
    candidateId: candidate?.id ?? '',
    jobId: job?.id ?? '',
    type: 'Video',
    date: todayDate(),
    time: '10:00 AM',
    timeZone: 'EST',
    duration: '60 min',
    interviewer: job?.spocName || 'SPOC not assigned',
    candidateAvailability: candidate?.availability ?? 'Needs confirmation',
    clientAvailability: availableClients.find(client => client.id === job?.clientId)?.interviewProcess ?? 'Client availability pending',
    meetingPlatform: platform,
    meetingLink: generateMeetingLink(platform, candidate?.name ?? 'candidate'),
    reminderSchedule: '24 hours before interview',
  };
}

export default function Calendar() {
  const availableCandidates = getAllCandidates();
  const availableJobs = getAllJobs();
  const availableClients = getAllClients();
  const today = new Date();
  const [currentDate, setCurrentDate] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [localInterviews, setLocalInterviews] = useState<Interview[]>(loadLocalInterviews);
  const [form, setForm] = useState<InterviewFormState>(defaultForm);
  const [selectedInterviewId, setSelectedInterviewId] = useState<string>(interviews[0]?.id ?? '');
  const [feedbackDraft, setFeedbackDraft] = useState('');
  const [notice, setNotice] = useState('');
  const [calendarAction, setCalendarAction] = useState<null | { type: 'invite' | 'workflow' | 'upcoming'; interview: Interview }>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  const allInterviews = [
    ...interviews.map(enrichInterview),
    ...localInterviews.filter(localInterview => !interviews.some(interview => interview.id === localInterview.id)).map(enrichInterview),
  ];
  const selectedInterview = allInterviews.find(interview => interview.id === selectedInterviewId) ?? allInterviews[0];
  const days = getCalendarDays(currentDate.year, currentDate.month);

  const scheduledCount = allInterviews.filter(interview => interview.status === 'Scheduled').length;
  const completedCount = allInterviews.filter(interview => interview.status === 'Completed').length;
  const noShowCount = allInterviews.filter(interview => interview.status === 'No Show').length;
  const reminderCount = allInterviews.filter(interview => interview.reminderEmailSent).length;

  const updateForm = <K extends keyof InterviewFormState>(key: K, value: InterviewFormState[K]) => {
    setForm(current => ({ ...current, [key]: value }));
  };

  const syncCandidate = (candidateId: string) => {
    const candidate = availableCandidates.find(item => item.id === candidateId);
    if (!candidate) return;
    updateForm('candidateId', candidateId);
    updateForm('candidateAvailability', candidate.availability);
    updateForm('meetingLink', generateMeetingLink(form.meetingPlatform, candidate.name));
  };

  const syncJob = (jobId: string) => {
    const job = availableJobs.find(item => item.id === jobId);
    if (!job) return;
    const client = availableClients.find(item => item.id === job.clientId);
    updateForm('jobId', jobId);
    updateForm('interviewer', job.spocName || 'SPOC not assigned');
    updateForm('clientAvailability', client?.interviewProcess ?? 'Client availability pending');
  };

  const syncPlatform = (platform: MeetingPlatform) => {
    const candidate = availableCandidates.find(item => item.id === form.candidateId);
    updateForm('meetingPlatform', platform);
    updateForm('meetingLink', generateMeetingLink(platform, candidate?.name ?? 'candidate'));
  };

  const prevMonth = () => {
    setCurrentDate(d => d.month === 0
      ? { year: d.year - 1, month: 11 }
      : { year: d.year, month: d.month - 1 }
    );
  };

  const nextMonth = () => {
    setCurrentDate(d => d.month === 11
      ? { year: d.year + 1, month: 0 }
      : { year: d.year, month: d.month + 1 }
    );
  };

  const persistInterviewChange = (updatedInterview: Interview) => {
    const nextLocalInterviews = [
      updatedInterview,
      ...localInterviews.filter(interview => interview.id !== updatedInterview.id),
    ];
    saveLocalInterviews(nextLocalInterviews);
    setLocalInterviews(nextLocalInterviews);
    setSelectedInterviewId(updatedInterview.id);
  };

  const updateInterview = (id: string, changes: Partial<Interview>) => {
    const current = allInterviews.find(interview => interview.id === id);
    if (!current) return;

    persistInterviewChange(enrichInterview({ ...current, ...changes }));
  };

  const handleSchedule = () => {
    const candidate = availableCandidates.find(item => item.id === form.candidateId);
    const job = availableJobs.find(item => item.id === form.jobId);
    if (!candidate || !job) {
      setNotice('Add at least one candidate and one job before scheduling interviews.');
      return;
    }

    const interview: Interview = enrichInterview({
      id: `interview-local-${Date.now()}`,
      candidateId: candidate.id,
      candidateName: candidate.name,
      jobTitle: job.title,
      clientName: job.client,
      type: form.type,
      date: form.date,
      time: form.time,
      timeZone: form.timeZone,
      duration: form.duration,
      interviewer: form.interviewer,
      status: 'Scheduled',
      candidateAvailability: form.candidateAvailability,
      clientAvailability: form.clientAvailability,
      meetingPlatform: form.meetingPlatform,
      meetingLink: form.meetingLink,
      reminderEmailSent: true,
      reminderSchedule: form.reminderSchedule,
      rescheduleCount: 0,
      rescheduleHistory: [],
    });

    persistInterviewChange(interview);
    setNotice(`Interview scheduled for ${candidate.name}. Reminder email queued.`);
    setShowScheduleModal(false);
  };

  const rescheduleSelectedInterview = () => {
    if (!selectedInterview) return;

    updateInterview(selectedInterview.id, {
      date: form.date,
      time: form.time,
      timeZone: form.timeZone,
      duration: form.duration,
      meetingPlatform: form.meetingPlatform,
      meetingLink: form.meetingLink,
      reminderEmailSent: true,
      reminderSchedule: form.reminderSchedule,
      rescheduleCount: (selectedInterview.rescheduleCount ?? 0) + 1,
      rescheduleHistory: [
        ...(selectedInterview.rescheduleHistory ?? []),
        `Rescheduled from ${selectedInterview.date} ${selectedInterview.time} to ${form.date} ${form.time}`,
      ],
      status: 'Scheduled',
    });
    setNotice(`Interview rescheduled for ${selectedInterview.candidateName}. Reminder email queued.`);
  };

  const getInterviewsForDay = (day: number) => {
    const dateStr = `${currentDate.year}-${String(currentDate.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return allInterviews.filter(interview => interview.date === dateStr);
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Calendar / Interview Scheduling</h1>
          <p className="mt-1 text-sm text-slate-500">Schedule interviews, coordinate availability, send reminders, track status, feedback, reschedules, and no-shows.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setShowScheduleModal(true)} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500">
            <CalendarClock size={15} />
            Schedule Interview
          </button>
          <div className="flex items-center gap-2 rounded-lg border border-white/5 bg-[#0d1729] px-1.5 py-1.5">
            <button onClick={prevMonth} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/5 hover:text-white">
              <ChevronLeft size={15} />
            </button>
            <span className="min-w-36 px-2 text-center text-sm font-semibold text-white">
              {months[currentDate.month]} {currentDate.year}
            </span>
            <button onClick={nextMonth} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/5 hover:text-white">
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Scheduled" value={scheduledCount} icon={<CalendarClock size={16} />} color="text-blue-400" />
        <Stat label="Completed" value={completedCount} icon={<CheckCircle2 size={16} />} color="text-emerald-400" />
        <Stat label="No-shows" value={noShowCount} icon={<UserX size={16} />} color="text-red-400" />
        <Stat label="Reminders sent" value={reminderCount} icon={<Mail size={16} />} color="text-violet-400" />
      </div>

      {notice && (
        <div className="mb-4 rounded-lg border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm text-blue-200">
          {notice}
        </div>
      )}

      <section className="mb-5 overflow-hidden rounded-lg border border-white/5 bg-[#0d1729]">
        <div className="border-b border-white/5 px-4 py-3">
          <h2 className="text-sm font-semibold text-white">Interview Candidate Rows</h2>
          <p className="mt-1 text-xs text-slate-500">Schedule invites, workflow updates, and upcoming interview quick actions.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px]">
            <thead>
              <tr className="border-b border-white/5 text-left text-xs uppercase tracking-wider text-slate-500">
                {['Candidate', 'Job / Client', 'Schedule', 'Platform', 'Status', 'Actions'].map(header => (
                  <th key={header} className="px-4 py-3 font-medium">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allInterviews.map(interview => (
                <tr key={interview.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]">
                  <td className="px-4 py-3 text-sm font-semibold text-white">{interview.candidateName}</td>
                  <td className="px-4 py-3 text-sm text-slate-300">{interview.jobTitle}<p className="mt-1 text-xs text-slate-500">{interview.clientName}</p></td>
                  <td className="px-4 py-3 text-sm text-slate-400">{interview.date} - {interview.time} {interview.timeZone}</td>
                  <td className="px-4 py-3 text-sm text-slate-400">{interview.meetingPlatform}</td>
                  <td className="px-4 py-3"><span className={cn('rounded-full border px-2.5 py-1 text-xs', statusColors[interview.status])}>{interview.status}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <QuickIconButton title="Schedule invite" onClick={() => setCalendarAction({ type: 'invite', interview })}><Mail size={14} /></QuickIconButton>
                      <QuickIconButton title="Workflow" onClick={() => setCalendarAction({ type: 'workflow', interview })}><RefreshCw size={14} /></QuickIconButton>
                      <QuickIconButton title="Upcoming interview" onClick={() => setCalendarAction({ type: 'upcoming', interview })}><Eye size={14} /></QuickIconButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-5">
        <div className="space-y-5">
          <div className="overflow-hidden rounded-lg border border-white/5 bg-[#0d1729]">
            <div className="grid grid-cols-7 border-b border-white/5">
              {daysOfWeek.map(day => (
                <div key={day} className="py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-500">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((day, i) => {
                const isToday = day === today.getDate() &&
                  currentDate.month === today.getMonth() &&
                  currentDate.year === today.getFullYear();
                const dayInterviews = day ? getInterviewsForDay(day) : [];

                return (
                  <div
                    key={i}
                    className={cn(
                      'min-h-[96px] border-b border-r border-white/5 p-1.5 last:border-r-0',
                      day ? 'cursor-pointer hover:bg-white/[0.03]' : ''
                    )}
                  >
                    {day && (
                      <>
                        <div className={cn(
                          'mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                          isToday ? 'bg-blue-600 text-white' : 'text-slate-400'
                        )}>
                          {day}
                        </div>
                        {dayInterviews.slice(0, 3).map(interview => (
                          <button
                            key={interview.id}
                            onClick={() => setSelectedInterviewId(interview.id)}
                            className={cn('mb-0.5 w-full truncate rounded border px-1.5 py-0.5 text-left text-[9px] leading-tight', typeColors[interview.type])}
                          >
                            {interview.candidateName}
                          </button>
                        ))}
                        {dayInterviews.length > 3 && (
                          <span className="text-[9px] text-slate-600">+{dayInterviews.length - 3} more</span>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <motion.section initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} className="rounded-lg border border-white/5 bg-[#0d1729] p-5">
            <h2 className="mb-4 text-sm font-semibold text-white">Interview Workflow</h2>

            {selectedInterview ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-white/5 bg-white/[0.03] p-4">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{selectedInterview.candidateName}</p>
                      <p className="mt-1 text-xs text-slate-500">{selectedInterview.jobTitle} - {selectedInterview.clientName}</p>
                    </div>
                    <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-medium', statusColors[selectedInterview.status])}>{selectedInterview.status}</span>
                  </div>

                  <div className="grid gap-2 text-xs text-slate-400">
                    <Info icon={<Clock size={13} />} label="Schedule" value={`${selectedInterview.date} - ${selectedInterview.time} ${selectedInterview.timeZone ?? ''} - ${selectedInterview.duration}`} />
                    <Info icon={typeIcons[selectedInterview.type]} label="Type" value={`${selectedInterview.type} via ${selectedInterview.meetingPlatform}`} />
                    <Info icon={<Monitor size={13} />} label="Meeting link" value={selectedInterview.meetingLink ?? 'Not set'} />
                    <Info icon={<Mail size={13} />} label="Reminder emails" value={`${selectedInterview.reminderEmailSent ? 'Sent' : 'Not sent'} - ${selectedInterview.reminderSchedule}`} />
                    <Info icon={<RefreshCw size={13} />} label="Reschedules" value={`${selectedInterview.rescheduleCount ?? 0}`} />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Rule title="Candidate availability" value={selectedInterview.candidateAvailability ?? 'Needs confirmation'} />
                  <Rule title="Client availability" value={selectedInterview.clientAvailability ?? 'Needs confirmation'} />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <ActionButton label="Complete" icon={<CheckCircle2 size={13} />} onClick={() => updateInterview(selectedInterview.id, { status: 'Completed' })} />
                  <ActionButton label="No-show" icon={<UserX size={13} />} onClick={() => updateInterview(selectedInterview.id, { status: 'No Show' })} />
                  <ActionButton label="Send reminder" icon={<Mail size={13} />} onClick={() => updateInterview(selectedInterview.id, { reminderEmailSent: true })} />
                  <ActionButton label="Reschedule" icon={<RefreshCw size={13} />} onClick={rescheduleSelectedInterview} />
                </div>

                <div className="rounded-lg border border-white/5 bg-white/[0.03] p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Interview feedback</p>
                  <textarea
                    rows={5}
                    value={feedbackDraft || selectedInterview.feedback || ''}
                    onChange={event => setFeedbackDraft(event.target.value)}
                    className="w-full resize-y rounded-lg border border-white/10 bg-[#0d1729] px-3 py-2 text-sm leading-relaxed text-slate-200 outline-none focus:border-blue-500/50"
                    placeholder="Capture interviewer feedback, outcome, strengths, risks, and next steps..."
                  />
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1 text-amber-300">
                      {[1, 2, 3, 4, 5].map(star => <Star key={star} size={13} fill={star <= (selectedInterview.rating ?? 0) ? 'currentColor' : 'none'} />)}
                    </div>
                    <button onClick={() => {
                      updateInterview(selectedInterview.id, { feedback: feedbackDraft || selectedInterview.feedback || 'Feedback recorded.', rating: selectedInterview.rating ?? 4, status: 'Completed' });
                      setFeedbackDraft('');
                      setNotice(`Feedback saved for ${selectedInterview.candidateName}.`);
                    }} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-500">
                      Save Feedback
                    </button>
                  </div>
                </div>

                {(selectedInterview.rescheduleHistory ?? []).length > 0 && (
                  <div className="rounded-lg border border-white/5 bg-white/[0.03] p-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Reschedule history</p>
                    <div className="space-y-1">
                      {selectedInterview.rescheduleHistory?.map(entry => (
                        <p key={entry} className="text-xs text-slate-400">{entry}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No interview selected.</p>
            )}
          </motion.section>

          <motion.section initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="rounded-lg border border-white/5 bg-[#0d1729] p-5">
            <h2 className="mb-4 text-sm font-semibold text-white">Upcoming Interviews</h2>
            <div className="space-y-3">
              {allInterviews.filter(interview => interview.status === 'Scheduled').map(interview => (
                <button key={interview.id} onClick={() => setSelectedInterviewId(interview.id)} className="w-full rounded-lg border border-white/5 bg-white/[0.03] p-3 text-left transition-colors hover:bg-white/[0.06]">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-white">{interview.candidateName}</p>
                      <p className="truncate text-[11px] text-slate-500">{interview.jobTitle}</p>
                    </div>
                    <span className={cn('flex flex-shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]', typeColors[interview.type])}>
                      {typeIcons[interview.type]}
                      {interview.type}
                    </span>
                  </div>
                  <div className="space-y-0.5 text-[10px] text-slate-600">
                    <p>{interview.date} - {interview.time} - {interview.duration}</p>
                    <p>{interview.clientName}</p>
                    <p>{interview.meetingPlatform}: {interview.meetingLink}</p>
                  </div>
                </button>
              ))}
            </div>
          </motion.section>
        </div>
      </div>

      {showScheduleModal && (
        <QuickActionModal
          title="Schedule Interview"
          subtitle="Create a candidate interview and save it to ATS calendar"
          onCancel={() => setShowScheduleModal(false)}
          onSave={handleSchedule}
          saveLabel="Schedule"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <SelectField label="Candidate" value={form.candidateId} onChange={syncCandidate} options={availableCandidates.map(candidate => ({ value: candidate.id, label: candidate.name }))} />
            <SelectField label="Job / client" value={form.jobId} onChange={syncJob} options={availableJobs.map(job => ({ value: job.id, label: `${job.title} - ${job.client}` }))} />
            <SelectField label="Interview type" value={form.type} onChange={value => updateForm('type', value as Interview['type'])} options={['Phone', 'Video', 'On-site', 'Technical'].map(type => ({ value: type, label: type }))} />
            <Field label="Date" type="date" value={form.date} onChange={value => updateForm('date', value)} />
            <Field label="Time" value={form.time} onChange={value => updateForm('time', value)} />
            <SelectField label="Time zone" value={form.timeZone} onChange={value => updateForm('timeZone', value)} options={interviewTimeZones.map(zone => ({ value: zone, label: zone }))} />
            <Field label="Duration" value={form.duration} onChange={value => updateForm('duration', value)} />
            <Field label="Interviewer / SPOC" value={form.interviewer} onChange={value => updateForm('interviewer', value)} />
            <Field label="Candidate availability date/time" value={form.candidateAvailability} onChange={value => updateForm('candidateAvailability', value)} />
            <Field label="Interview availability date/time" value={form.clientAvailability} onChange={value => updateForm('clientAvailability', value)} />
            <SelectField label="Meeting platform" value={form.meetingPlatform} onChange={value => syncPlatform(value as MeetingPlatform)} options={['Google Meet', 'Zoom', 'Microsoft Teams', 'Teams Calendar', 'Video Call', 'Phone', 'On-site'].map(platform => ({ value: platform, label: platform }))} />
            <Field label="Meeting / video call link" value={form.meetingLink} onChange={value => updateForm('meetingLink', value)} />
            <Field label="Reminder emails" value={form.reminderSchedule} onChange={value => updateForm('reminderSchedule', value)} />
          </div>
        </QuickActionModal>
      )}

      {calendarAction && (
        <QuickActionModal
          title={
            calendarAction.type === 'invite' ? 'Schedule Invite' :
              calendarAction.type === 'workflow' ? 'Interview Workflow' : 'Upcoming Interview'
          }
          subtitle={`${calendarAction.interview.candidateName} - ${calendarAction.interview.jobTitle}`}
          onCancel={() => setCalendarAction(null)}
          onSave={() => {
            if (calendarAction.type === 'invite') updateInterview(calendarAction.interview.id, { reminderEmailSent: true });
            if (calendarAction.type === 'workflow') updateInterview(calendarAction.interview.id, { status: 'Completed', feedback: calendarAction.interview.feedback ?? 'Workflow completed from quick action.' });
            if (calendarAction.type === 'upcoming') setSelectedInterviewId(calendarAction.interview.id);
            setCalendarAction(null);
          }}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <Rule title="Candidate" value={calendarAction.interview.candidateName} />
            <Rule title="Schedule" value={`${calendarAction.interview.date} ${calendarAction.interview.time} ${calendarAction.interview.timeZone ?? ''}`} />
            <Rule title="Meeting link" value={calendarAction.interview.meetingLink ?? 'Not set'} />
            <Rule title="Status" value={calendarAction.interview.status} />
          </div>
        </QuickActionModal>
      )}
    </div>
  );
}

function Stat({ label, value, icon, color }: { label: string; value: number; icon: ReactNode; color: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-[#0d1729] p-4">
      <div className="flex items-center justify-between gap-3">
        <span className={cn('opacity-80', color)}>{icon}</span>
        <p className={cn('text-2xl font-bold', color)}>{value}</p>
      </div>
      <p className="mt-2 text-xs text-slate-500">{label}</p>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-500">{label}</span>
      <input
        type={type}
        value={value}
        onChange={event => onChange(event.target.value)}
        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-blue-500/50"
      />
    </label>
  );
}

function SelectField({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-500">{label}</span>
      <select
        value={value}
        onChange={event => onChange(event.target.value)}
        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-blue-500/50"
      >
        {options.map(option => (
          <option key={option.value} value={option.value} className="bg-[#0d1729] text-slate-200">
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Info({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-2">
      <span className="flex items-center gap-1.5 text-slate-600">{icon}{label}</span>
      <span className="min-w-0 break-words text-slate-300">{value}</span>
    </div>
  );
}

function Rule({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.03] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">{title}</p>
      <p className="mt-2 text-xs leading-relaxed text-slate-300">{value}</p>
    </div>
  );
}

function ActionButton({ label, icon, onClick }: { label: string; icon: ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white">
      {icon}
      {label}
    </button>
  );
}
