import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Archive, CheckCircle2, Clock, FileCheck2, FileText, FileUp,
  Link as LinkIcon,
} from 'lucide-react';
import { QuickActionModal, QuickIconButton } from '@/components/ats/QuickActionModal';
import { candidateDocuments, candidates } from '@/lib/data';
import { LOCAL_DOCUMENTS_KEY, readLocalRows, saveRows, uploadBackendFile, type AtsStoredFile } from '@/lib/atsApi';
import { getAllCandidates, getAllSubmissions } from '@/lib/localRecords';
import { cn } from '@/lib/utils';
import type { Candidate, CandidateDocument, CandidateDocumentType, DocumentStatus, Submission } from '@/lib/types';

const checklistTypes: CandidateDocumentType[] = [
  'Resume',
  'RTR',
  'Visa copy',
  'ID proof',
  'LinkedIn',
  'Education certificate',
  'Certification',
  'References',
  'Background check documents',
  'Offer letter',
  'Signed agreement',
];

const statusColors: Record<DocumentStatus, string> = {
  Missing: 'bg-red-500/10 text-red-300 border-red-500/20',
  Pending: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  Received: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
  Verified: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  Expired: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
};
const DOCUMENT_PAGE_SIZE = 100;

interface UploadFormState {
  candidateId: string;
  type: CandidateDocumentType;
  fileName: string;
  status: DocumentStatus;
  expiryDate: string;
  notes: string;
}

function loadLocalDocuments(): CandidateDocument[] {
  return readLocalRows<CandidateDocument>(LOCAL_DOCUMENTS_KEY);
}

function saveLocalDocuments(documents: CandidateDocument[]) {
  window.localStorage.setItem(LOCAL_DOCUMENTS_KEY, JSON.stringify(documents));
  saveRows('candidateDocuments', documents);
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function initialUploadForm(candidateId = candidates[0]?.id ?? ''): UploadFormState {
  const availableCandidates = getAllCandidates();
  const candidate = availableCandidates.find(item => item.id === candidateId) ?? availableCandidates[0];
  return {
    candidateId,
    type: 'Resume',
    fileName: candidate ? `${candidate.name.replace(/\s+/g, '_')}_Resume.pdf` : '',
    status: 'Received',
    expiryDate: '',
    notes: '',
  };
}

export default function Documents() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const availableCandidates = getAllCandidates();
  const initialCandidateId = searchParams.get('candidate') ?? availableCandidates[0]?.id ?? '';
  const [selectedCandidateId, setSelectedCandidateId] = useState(initialCandidateId);
  const [page, setPage] = useState(1);
  const [localDocuments, setLocalDocuments] = useState<CandidateDocument[]>(loadLocalDocuments);
  const [uploadForm, setUploadForm] = useState<UploadFormState>(initialUploadForm(initialCandidateId));
  const [uploadedFile, setUploadedFile] = useState<AtsStoredFile | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [notice, setNotice] = useState('');
  const [documentAction, setDocumentAction] = useState<null | { type: 'checklist' | 'all-docs' | 'upload'; candidate: Candidate }>(null);

  const allDocuments = [
    ...candidateDocuments,
    ...localDocuments.filter(localDocument => !candidateDocuments.some(document => document.id === localDocument.id)),
  ];
  const selectedCandidate = availableCandidates.find(candidate => candidate.id === selectedCandidateId) ?? availableCandidates[0];
  const candidateDocs = selectedCandidate ? allDocuments.filter(document => document.candidateId === selectedCandidate.id) : [];
  const docsByCandidate = useMemo(() => {
    const map = new Map<string, CandidateDocument[]>();
    allDocuments.forEach(document => {
      const rows = map.get(document.candidateId) ?? [];
      rows.push(document);
      map.set(document.candidateId, rows);
    });
    return map;
  }, [allDocuments]);

  const checklistRows = checklistTypes.map(type => {
    const document = candidateDocs.find(item => item.type === type);
    return {
      type,
      status: document?.status ?? 'Missing' as DocumentStatus,
      fileName: document?.fileName ?? '',
      uploadedAt: document?.uploadedAt ?? '',
      notes: document?.notes ?? '',
      checked: document?.status === 'Received' || document?.status === 'Verified',
    };
  });

  const completedChecklist = checklistRows.filter(row => row.status === 'Verified' || row.status === 'Received').length;
  const missingChecklist = checklistRows.filter(row => row.status === 'Missing').length;
  const pendingDocuments = allDocuments.filter(document => document.status === 'Pending' || document.status === 'Missing').length;
  const pageCount = Math.max(1, Math.ceil(availableCandidates.length / DOCUMENT_PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pagedCandidates = availableCandidates.slice((safePage - 1) * DOCUMENT_PAGE_SIZE, safePage * DOCUMENT_PAGE_SIZE);
  const rangeStart = availableCandidates.length ? (safePage - 1) * DOCUMENT_PAGE_SIZE + 1 : 0;
  const rangeEnd = Math.min(safePage * DOCUMENT_PAGE_SIZE, availableCandidates.length);

  const updateSelectedCandidate = (candidateId: string) => {
    setSelectedCandidateId(candidateId);
    setUploadForm(initialUploadForm(candidateId));
  };

  const updateUploadForm = <K extends keyof UploadFormState>(key: K, value: UploadFormState[K]) => {
    setUploadForm(current => ({ ...current, [key]: value }));
  };

  const handleUploadDocument = () => {
    const candidate = availableCandidates.find(item => item.id === uploadForm.candidateId) ?? selectedCandidate;
    if (!candidate) {
      setNotice('Add a candidate before uploading documents.');
      return;
    }

    const document: CandidateDocument = {
      id: `doc-local-${Date.now()}`,
      candidateId: candidate.id,
      candidateName: candidate.name,
      type: uploadForm.type,
      status: uploadForm.status,
      fileName: uploadForm.fileName.trim() || `${candidate.name.replace(/\s+/g, '_')}_${uploadForm.type.replace(/\s+/g, '_')}.pdf`,
      fileType: uploadedFile?.fileType,
      fileSize: uploadedFile?.fileSize,
      fileUploadId: uploadedFile?.id,
      storageProvider: uploadedFile?.storageProvider,
      storagePath: uploadedFile?.storagePath,
      relativePath: uploadedFile?.relativePath,
      downloadUrl: uploadedFile?.downloadUrl,
      uploadedAt: todayDate(),
      uploadedBy: uploadedFile?.uploadedBy,
      uploadedByUserId: uploadedFile?.uploadedByUserId,
      uploadedByEmail: uploadedFile?.uploadedByEmail,
      verifiedBy: uploadForm.status === 'Verified' ? candidate.recruiter : undefined,
      expiryDate: uploadForm.expiryDate || undefined,
      notes: uploadForm.notes || `${uploadForm.type} uploaded from Document Management.`,
    };

    const nextDocuments = [
      document,
      ...localDocuments.filter(item => !(item.candidateId === document.candidateId && item.type === document.type)),
    ];
    saveLocalDocuments(nextDocuments);
    setLocalDocuments(nextDocuments);
    setSelectedCandidateId(candidate.id);
    setUploadedFile(null);
    setNotice(`${document.type} uploaded for ${candidate.name}.`);
    setDocumentAction(null);
  };

  const markChecklistForCandidate = (candidate: Candidate, type: CandidateDocumentType, status: DocumentStatus, fileName?: string) => {
    const docs = allDocuments.filter(document => document.candidateId === candidate.id);
    const existing = docs.find(document => document.type === type);
    const document: CandidateDocument = {
      id: existing?.id ?? `doc-local-${Date.now()}-${type.replace(/\s+/g, '-')}`,
      candidateId: candidate.id,
      candidateName: candidate.name,
      type,
      status,
      fileName: fileName ?? existing?.fileName ?? `${candidate.name.replace(/\s+/g, '_')}_${type.replace(/\s+/g, '_')}.pdf`,
      fileType: existing?.fileType,
      fileSize: existing?.fileSize,
      fileUploadId: existing?.fileUploadId,
      storageProvider: existing?.storageProvider,
      storagePath: existing?.storagePath,
      relativePath: existing?.relativePath,
      downloadUrl: existing?.downloadUrl,
      uploadedAt: todayDate(),
      verifiedBy: status === 'Verified' ? candidate.recruiter : existing?.verifiedBy,
      expiryDate: existing?.expiryDate,
      notes: fileName ? `${type} uploaded from checklist: ${fileName}.` : existing?.notes ?? `${type} marked as ${status}.`,
    };
    const nextDocuments = [
      document,
      ...localDocuments.filter(item => !(item.candidateId === document.candidateId && item.type === document.type)),
    ];
    saveLocalDocuments(nextDocuments);
    setLocalDocuments(nextDocuments);
    setSelectedCandidateId(candidate.id);
    setNotice(`${type} marked ${status} for ${candidate.name}.`);
  };

  const syncOfferDocumentStatus = (candidateId: string, verifiedBy: string) => {
    const offerSubmissions = getAllSubmissions().filter(submission =>
      submission.candidateId === candidateId &&
      (
        submission.status === 'Offer Extended' ||
        submission.status === 'Placed' ||
        submission.offerStatus === 'Discussion' ||
        submission.offerStatus === 'Extended' ||
        submission.offerStatus === 'Accepted'
      )
    );

    if (!offerSubmissions.length) return false;

    const verifiedAt = new Date().toISOString();
    const offerSubmissionIds = new Set(offerSubmissions.map(submission => submission.id));
    const nextSubmissions = getAllSubmissions().map((submission): Submission => offerSubmissionIds.has(submission.id)
      ? {
          ...submission,
          offerDocumentStatus: 'Completed',
          offerDocumentVerifiedAt: verifiedAt,
          offerDocumentVerifiedBy: verifiedBy,
          updatedAt: verifiedAt,
          notes: submission.notes.includes('Offer letter verified')
            ? submission.notes
            : `${submission.notes} Offer letter verified on ${todayDate()}.`,
        }
      : submission
    );
    saveRows('submissions', nextSubmissions);
    return true;
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Document Management</h1>
          <p className="mt-1 text-sm text-slate-500">Manage candidate document checklists, row-level uploads, verification, and ATS document history.</p>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Checklist complete" value={completedChecklist} icon={<CheckCircle2 size={16} />} color="text-emerald-400" />
        <Stat label="Missing for selected" value={missingChecklist} icon={<FileText size={16} />} color="text-red-400" />
        <Stat label="Pending documents" value={pendingDocuments} icon={<Clock size={16} />} color="text-amber-400" />
        <Stat label="All documents" value={allDocuments.length} icon={<Archive size={16} />} color="text-blue-400" />
      </div>

      {notice && (
        <div className="mb-4 rounded-lg border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm text-blue-200">
          {notice}
        </div>
      )}

      <section className="mb-5 overflow-hidden rounded-lg border border-white/5 bg-[#0d1729]">
        <div className="border-b border-white/5 px-4 py-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">Candidate Document Rows</h2>
              <p className="mt-1 text-xs text-slate-500">Showing {rangeStart}-{rangeEnd} of {availableCandidates.length}. Each candidate row owns checklist, upload, verify, and profile actions.</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(current => Math.max(1, current - 1))} disabled={safePage === 1} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10 disabled:opacity-40">Previous</button>
              <span className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-400">Page {safePage} / {pageCount}</span>
              <button onClick={() => setPage(current => Math.min(pageCount, current + 1))} disabled={safePage === pageCount} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10 disabled:opacity-40">Next</button>
            </div>
          </div>
        </div>
        <div className="max-h-[65vh] overflow-auto [scrollbar-gutter:stable]">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-white/5 text-left text-xs uppercase tracking-wider text-slate-500">
                {['Candidate', 'Role / Location', 'Checklist', 'Missing', 'Latest document', 'Actions'].map(header => (
                  <th key={header} className="px-4 py-3 font-medium">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagedCandidates.map(candidate => {
                const docs = docsByCandidate.get(candidate.id) ?? [];
                const complete = checklistTypes.filter(type => docs.some(document => document.type === type && ['Received', 'Verified'].includes(document.status))).length;
                const latest = docs[0];
                return (
                  <tr key={candidate.id} className={cn('border-b border-white/5 last:border-0 hover:bg-white/[0.03]', selectedCandidate?.id === candidate.id && 'bg-blue-500/10')}>
                    <td className="px-3 py-2">
                      <button onClick={() => updateSelectedCandidate(candidate.id)} className="text-left text-sm font-semibold text-white hover:text-blue-300">{candidate.name}</button>
                      <p className="mt-1 text-xs text-slate-500">{candidate.email}</p>
                    </td>
                    <td className="px-3 py-2 text-sm text-slate-300">
                      {candidate.title}
                      <p className="mt-1 text-xs text-slate-500">{candidate.location}</p>
                    </td>
                    <td className="px-3 py-2 text-sm font-semibold text-emerald-300">{complete}/{checklistTypes.length}</td>
                    <td className="px-3 py-2 text-sm font-semibold text-amber-300">{checklistTypes.length - complete}</td>
                    <td className="px-3 py-2 text-sm text-slate-400">{latest ? `${latest.type} - ${latest.status}` : 'No document yet'}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <QuickIconButton title="Open checklist" onClick={() => { updateSelectedCandidate(candidate.id); setDocumentAction({ type: 'checklist', candidate }); }}><FileCheck2 size={14} /></QuickIconButton>
                        <QuickIconButton title="Upload document" onClick={() => { updateSelectedCandidate(candidate.id); setUploadForm(initialUploadForm(candidate.id)); setUploadedFile(null); setDocumentAction({ type: 'upload', candidate }); }}><FileUp size={14} /></QuickIconButton>
                        <QuickIconButton title="All documents" onClick={() => { updateSelectedCandidate(candidate.id); setDocumentAction({ type: 'all-docs', candidate }); }}><FileText size={14} /></QuickIconButton>
                        <QuickIconButton title="Open profile" onClick={() => navigate(`/candidates/${candidate.id}`)}><LinkIcon size={14} /></QuickIconButton>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {documentAction && (
        <QuickActionModal
          title={
            documentAction.type === 'checklist'
              ? 'Candidate Document Checklist'
              : documentAction.type === 'upload'
                ? 'Upload Candidate Document'
                : 'All Candidate Documents'
          }
          subtitle={`${documentAction.candidate.name} - ${documentAction.candidate.title}`}
          onCancel={() => setDocumentAction(null)}
          saveLabel="Update / Close"
          onSave={documentAction.type === 'upload' ? handleUploadDocument : () => setDocumentAction(null)}
        >
          {documentAction.type === 'upload' ? (
            <div className="grid gap-4 md:grid-cols-2">
              <SelectField label="Candidate" value={uploadForm.candidateId} onChange={value => updateUploadForm('candidateId', value)} options={availableCandidates.map(candidate => ({ value: candidate.id, label: candidate.name }))} />
              <SelectField label="Document type" value={uploadForm.type} onChange={value => updateUploadForm('type', value as CandidateDocumentType)} options={checklistTypes.map(type => ({ value: type, label: type }))} />
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">Upload document file</label>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-blue-500/30 bg-blue-500/10 px-3 py-3 text-xs font-semibold text-blue-100 hover:bg-blue-500/15">
                  <FileUp size={14} />
                  {uploadingFile ? 'Uploading...' : uploadForm.fileName || 'Select file'}
                  <input
                    type="file"
                    className="hidden"
                    onChange={async event => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      const candidate = availableCandidates.find(item => item.id === uploadForm.candidateId) ?? selectedCandidate;
                      setUploadingFile(true);
                      try {
                        const stored = await uploadBackendFile(file, {
                          candidateId: candidate?.id,
                          candidateName: candidate?.name,
                          documentType: uploadForm.type,
                          entityType: 'candidate-document',
                        });
                        setUploadedFile(stored);
                        updateUploadForm('fileName', stored.fileName);
                      } catch (error) {
                        setNotice(error instanceof Error ? error.message : 'Document upload failed.');
                      } finally {
                        setUploadingFile(false);
                        event.target.value = '';
                      }
                    }}
                  />
                </label>
                {uploadedFile?.downloadUrl && <p className="mt-1 text-xs text-emerald-300">Stored in ATS backend file storage</p>}
              </div>
              <SelectField label="Status" value={uploadForm.status} onChange={value => updateUploadForm('status', value as DocumentStatus)} options={['Missing', 'Pending', 'Received', 'Verified', 'Expired'].map(status => ({ value: status, label: status }))} />
              <Field label="Expiry date" type="date" value={uploadForm.expiryDate} onChange={value => updateUploadForm('expiryDate', value)} />
              <Field label="Notes" value={uploadForm.notes} onChange={value => updateUploadForm('notes', value)} />
            </div>
          ) : documentAction.type === 'checklist' ? (
            <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
              {checklistTypes.map(type => {
                const docs = docsByCandidate.get(documentAction.candidate.id) ?? [];
                const row = docs.find(document => document.type === type);
                const checked = row?.status === 'Received' || row?.status === 'Verified';
                return (
                  <div key={type} className="rounded-lg border border-white/5 bg-white/[0.03] p-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <label className="flex min-w-0 cursor-pointer items-start gap-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={event => markChecklistForCandidate(documentAction.candidate, type, event.target.checked ? 'Pending' : 'Missing')}
                          className="mt-1 h-4 w-4 rounded border-white/20 bg-white/5 text-blue-500"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white">{type}</p>
                          <p className="mt-1 truncate text-xs text-slate-600">{row?.fileName || 'No file uploaded'}</p>
                        </div>
                      </label>
                      <span className={cn('w-fit rounded-full border px-2 py-0.5 text-[10px] font-medium', statusColors[row?.status ?? 'Missing'])}>{row?.status ?? 'Missing'}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <label className="cursor-pointer rounded-md border border-blue-500/30 bg-blue-500/10 px-2 py-1.5 text-[10px] font-medium text-blue-100 hover:bg-blue-500/15">
                        Upload
                        <input
                          type="file"
                          className="hidden"
                          onChange={event => {
                            const file = event.target.files?.[0];
                            if (file) markChecklistForCandidate(documentAction.candidate, type, 'Received', file.name);
                            event.target.value = '';
                          }}
                        />
                      </label>
                      <button onClick={() => markChecklistForCandidate(documentAction.candidate, type, 'Received')} className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-[10px] text-slate-300 hover:bg-white/10">Received</button>
                      <button
                        onClick={() => {
                          markChecklistForCandidate(documentAction.candidate, type, 'Verified');
                          if (type === 'Offer letter') {
                            const synced = syncOfferDocumentStatus(documentAction.candidate.id, documentAction.candidate.recruiter);
                            setNotice(synced
                              ? `Offer letter verified for ${documentAction.candidate.name}. Offer status marked completed.`
                              : `Offer letter verified for ${documentAction.candidate.name}. Create an offer record to reflect it in Offers.`
                            );
                          }
                        }}
                        className="rounded-md bg-blue-600 px-2 py-1.5 text-[10px] font-medium text-white hover:bg-blue-500"
                      >
                        Verify
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
              {(docsByCandidate.get(documentAction.candidate.id) ?? []).map(document => (
                <div key={document.id} className="rounded-lg border border-white/5 bg-white/[0.03] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{document.type}</p>
                      <p className="mt-1 text-xs text-slate-500">{document.fileName || 'No file uploaded'} - {document.uploadedAt}</p>
                      {document.downloadUrl && <a href={document.downloadUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-blue-300 hover:text-blue-200">Download stored file</a>}
                    </div>
                    <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-medium', statusColors[document.status])}>{document.status}</span>
                  </div>
                </div>
              ))}
              {!(docsByCandidate.get(documentAction.candidate.id) ?? []).length && (
                <p className="rounded-lg border border-white/5 bg-white/[0.03] p-4 text-sm text-slate-500">No documents uploaded for this candidate yet.</p>
              )}
            </div>
          )}
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
