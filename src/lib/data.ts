import type {
  Candidate, Job, Client, Vendor, EmailTemplate, EmailRecord, Submission,
  CandidateDocument, ResumeVersion, Interview, Task, ComplianceDoc,
} from './types';

// Fresh testing baseline: no seeded ATS records.
// Manual uploads and form-created records should start from an empty workspace.
export const candidates: Candidate[] = [];
export const jobs: Job[] = [];
export const clients: Client[] = [];
export const vendors: Vendor[] = [];
export const submissions: Submission[] = [];
export const interviews: Interview[] = [];
export const tasks: Task[] = [];
export const complianceDocs: ComplianceDoc[] = [];
export const candidateDocuments: CandidateDocument[] = [];
export const resumeVersions: ResumeVersion[] = [];
export const emailHistory: EmailRecord[] = [];

export const emailTemplates: EmailTemplate[] = [
  {
    id: 'et1',
    category: 'Candidate outreach',
    name: 'Initial candidate outreach',
    subject: 'Opportunity for {{jobTitle}} with {{clientName}}',
    body: 'Hi {{candidateName}},\n\nI came across your profile and thought your background in {{candidateTitle}} could be a strong fit for a {{jobTitle}} role with {{clientName}}.\n\nPlease let me know if you are open to a quick call today or tomorrow.\n\nBest,\n{{recruiter}}',
  },
  {
    id: 'et2',
    category: 'Resume missing info request',
    name: 'Missing candidate details request',
    subject: 'Details needed to complete your submission',
    body: 'Hi {{candidateName}},\n\nBefore I submit your profile for {{jobTitle}}, can you please confirm your current location, work authorization, expected rate, availability, relocation preference, LinkedIn URL, education, and certifications?\n\nBest,\n{{recruiter}}',
  },
  {
    id: 'et3',
    category: 'Client submission',
    name: 'Client candidate submission',
    subject: 'Candidate submission: {{candidateName}} for {{jobTitle}}',
    body: 'Hi {{clientContact}},\n\nPlease find {{candidateName}} submitted for the {{jobTitle}} role. I have attached the latest resume for your review.\n\nSummary:\n{{candidateSummary}}\n\nAvailability: {{availability}}\nExpected rate: {{candidateRate}}\nLocation: {{candidateLocation}}\nResume attachment: required\n\nBest,\n{{recruiter}}',
  },
  {
    id: 'et4',
    category: 'Interview availability request',
    name: 'Request interview availability',
    subject: 'Interview availability for {{jobTitle}}',
    body: 'Hi {{candidateName}},\n\nThe client would like to move forward with an interview for the {{jobTitle}} role. Please share 3-4 time slots over the next two business days, including your time zone.\n\nBest,\n{{recruiter}}',
  },
  {
    id: 'et5',
    category: 'Follow-up after interview',
    name: 'Post-interview follow-up',
    subject: 'Follow-up on your {{jobTitle}} interview',
    body: 'Hi {{candidateName}},\n\nHope your interview for the {{jobTitle}} role went well. Please share your feedback, interest level, and any questions that came up during the conversation.\n\nBest,\n{{recruiter}}',
  },
  {
    id: 'et6',
    category: 'Offer discussion',
    name: 'Offer discussion',
    subject: 'Offer discussion for {{jobTitle}}',
    body: 'Hi {{candidateName}},\n\nGood news. The client is moving toward an offer discussion for the {{jobTitle}} role. Please confirm your expected compensation, start date availability, and any decision factors we should keep in mind.\n\nBest,\n{{recruiter}}',
  },
  {
    id: 'et7',
    category: 'Rejection message',
    name: 'Professional rejection message',
    subject: 'Update on {{jobTitle}}',
    body: 'Hi {{candidateName}},\n\nThank you for your time and interest in the {{jobTitle}} role. The client has decided to move forward with another candidate for this opening.\n\nBest,\n{{recruiter}}',
  },
];

export const pipelineStages = {
  'New Applicants': [] as Candidate[],
  Screening: [] as Candidate[],
  Interview: [] as Candidate[],
  Offer: [] as Candidate[],
  Placed: [] as Candidate[],
};

export const weeklySubmissions: Array<{ week: string; submissions: number }> = [];
export const monthlyPlacements: Array<{ month: string; placements: number }> = [];
export const recruiters = ['SuperUser', 'All Team'];
