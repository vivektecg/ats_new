export type CandidateStatus = 'New' | 'Screening' | 'Interview' | 'Offer' | 'Placed' | 'Rejected' | 'On Hold';
export type JobStatus = 'Active' | 'On Hold' | 'Filled' | 'Cancelled';
export type SubmissionStatus = 'Submitted' | 'Client Review' | 'Interview Scheduled' | 'Offer Extended' | 'Placed' | 'Rejected';
export type Priority = 'Low' | 'Medium' | 'High' | 'Critical';
export type TaskStatus = 'Pending' | 'In Progress' | 'Completed' | 'Overdue';
export type ComplianceStatus = 'Pending' | 'Submitted' | 'Approved' | 'Expired' | 'Rejected';
export type CandidateDocumentType =
  | 'Resume'
  | 'RTR'
  | 'Visa copy'
  | 'ID proof'
  | 'LinkedIn'
  | 'Education certificate'
  | 'Certification'
  | 'References'
  | 'Background check documents'
  | 'Offer letter'
  | 'Signed agreement';
export type DocumentStatus = 'Missing' | 'Pending' | 'Received' | 'Verified' | 'Expired';
export type ResumeVersionType = 'Original resume' | 'Edited resume' | 'Client-submitted resume' | 'AI-optimized resume';
export type EmailTemplateCategory =
  | 'Candidate outreach'
  | 'Resume missing info request'
  | 'Client submission'
  | 'Interview availability request'
  | 'Follow-up after interview'
  | 'Offer discussion'
  | 'Rejection message';

export interface Candidate {
  id: string;
  name: string;
  email: string;
  phone: string;
  title: string;
  location: string;
  status: CandidateStatus;
  skills: string[];
  experience: number;
  salary: string;
  availability: string;
  source: string;
  recruiter: string;
  createdAt: string;
  updatedAt: string;
  avatar?: string;
  summary: string;
  linkedin?: string;
  resume?: string;
  passportNumber?: string;
  rating: number;
}

export interface Job {
  id: string;
  externalJobId?: string;
  title: string;
  client: string;
  clientId: string;
  spocName?: string;
  location: string;
  type: string;
  status: JobStatus;
  priority: Priority;
  salary: string;
  openings: number;
  filled: number;
  recruiter: string;
  description: string;
  requirements: string[];
  postedDate: string;
  closeDate: string;
  submissions: number;
  department: string;
}

export interface Client {
  id: string;
  name: string;
  industry: string;
  clientType: 'Direct client' | 'Implementation partner' | 'State client' | 'Federal client' | 'Vendor' | 'Prospect';
  logoUrl?: string;
  location: string;
  website: string;
  contact: string;
  contactTitle: string;
  contactEmail: string;
  contactPhone: string;
  contractTerms: string;
  paymentTerms: string;
  submissionRules: string;
  interviewProcess: string;
  backgroundCheckRules: string;
  visaRestrictions: string;
  rateCards: string;
  status: 'Active' | 'Prospect' | 'Inactive';
  tier: 'Platinum' | 'Gold' | 'Silver' | 'Bronze';
  totalPlacements: number;
  activeJobs: number;
  revenue: string;
  recruiter: string;
  notes: string;
  createdAt: string;
}

export interface Vendor {
  id: string;
  company: string;
  contact: string;
  email: string;
  phone: string;
  clientRepresented: string;
  submissionFormat: string;
  rateMargin: string;
  paymentTerms: string;
  agreementStatus: 'Active' | 'Pending' | 'Expired' | 'On Hold';
  notes: string;
  jobIds: string[];
  submissionIds: string[];
  recruiter: string;
  createdAt: string;
}

export interface EmailTemplate {
  id: string;
  category: EmailTemplateCategory;
  name: string;
  subject: string;
  body: string;
}

export interface EmailRecord {
  id: string;
  candidateId?: string;
  candidateName?: string;
  jobId?: string;
  jobTitle?: string;
  clientId?: string;
  clientName?: string;
  type: EmailTemplateCategory | 'Interview confirmation' | 'Follow-up email';
  to: string;
  cc?: string;
  subject: string;
  body: string;
  status: 'Draft' | 'Sent';
  sentAt: string;
  sender: string;
}

export interface Submission {
  id: string;
  candidateId: string;
  candidateName: string;
  jobId: string;
  jobTitle: string;
  clientId: string;
  clientName: string;
  status: SubmissionStatus;
  submittedDate: string;
  recruiter: string;
  rate: string;
  payRate?: string;
  billRate?: string;
  rtrStatus?: 'Not Requested' | 'Requested' | 'Received' | 'Expired';
  resumeVersion?: string;
  clientFeedback?: string;
  interviewRounds?: string;
  offerStatus?: 'Not Started' | 'Discussion' | 'Extended' | 'Accepted' | 'Declined';
  joiningStatus?: 'Not Started' | 'Pending' | 'Confirmed' | 'Joined' | 'Backed Out';
  submittedAt?: string;
  submittedByUserId?: string;
  submittedByEmail?: string;
  offerDocumentStatus?: 'Pending' | 'Completed';
  offerDocumentVerifiedAt?: string;
  offerDocumentVerifiedBy?: string;
  createdAt?: string;
  updatedAt?: string;
  notes: string;
}

export interface CandidateDocument {
  id: string;
  candidateId: string;
  candidateName: string;
  type: CandidateDocumentType;
  status: DocumentStatus;
  fileName?: string;
  uploadedAt?: string;
  verifiedBy?: string;
  expiryDate?: string;
  notes?: string;
}

export interface ResumeVersion {
  id: string;
  candidateId: string;
  candidateName: string;
  versionType: ResumeVersionType;
  fileName: string;
  version: string;
  createdAt: string;
  createdBy: string;
  status: 'Draft' | 'Active' | 'Submitted' | 'Archived';
  notes: string;
}

export interface Interview {
  id: string;
  candidateId: string;
  candidateName: string;
  jobTitle: string;
  clientName: string;
  type: 'Phone' | 'Video' | 'On-site' | 'Technical';
  date: string;
  time: string;
  timeZone?: string;
  duration: string;
  interviewer: string;
  status: 'Scheduled' | 'Completed' | 'Cancelled' | 'No Show';
  candidateAvailability?: string;
  clientAvailability?: string;
  meetingPlatform?: 'Google Meet' | 'Zoom' | 'Microsoft Teams' | 'Teams Calendar' | 'Video Call' | 'Phone' | 'On-site';
  meetingLink?: string;
  reminderEmailSent?: boolean;
  reminderSchedule?: string;
  rescheduleCount?: number;
  rescheduleHistory?: string[];
  feedback?: string;
  rating?: number;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  assignee: string;
  relatedTo?: string;
  relatedType?: 'Candidate' | 'Job' | 'Client';
  dueDate: string;
  priority: Priority;
  status: TaskStatus;
  category: string;
  createdAt: string;
}

export interface ComplianceDoc {
  id: string;
  candidateId: string;
  candidateName: string;
  docType: string;
  status: ComplianceStatus;
  uploadedDate?: string;
  expiryDate?: string;
  reviewer?: string;
  notes?: string;
}

export interface Metric {
  label: string;
  value: string | number;
  change: number;
  trend: 'up' | 'down' | 'flat';
  icon: string;
  color: string;
}
