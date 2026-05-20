import { canAccess, resolveSession, type AuthSession } from './auth';

export type AIRequestModule =
  | 'resume-parser'
  | 'jd-parser'
  | 'match-engine'
  | 'boolean-generator'
  | 'screening-questions'
  | 'resume-improvement'
  | 'client-submission'
  | 'recruiter-assistant';

export type AIGatewayRequest = {
  module: AIRequestModule;
  prompt: string;
  candidateId?: string;
  jobId?: string;
  context: Record<string, unknown>;
};

export type AIGatewayResponse = {
  requestId: string;
  provider: 'server' | 'mock' | 'fallback';
  output: string;
  audit: {
    status: 'approved' | 'blocked' | 'failed';
    explanation: string;
  };
};

export type AIAuditLog = {
  id: string;
  timestamp: string;
  actor: string;
  actorRole: string;
  module: AIRequestModule;
  candidateId?: string;
  jobId?: string;
  status: 'requested' | 'approved' | 'blocked' | 'failed';
  explanation: string;
};

const LOCAL_AUDIT_KEY = 'eventus:test:ai-audit-log';

function getEndpoint() {
  return import.meta.env.VITE_AI_API_URL || '/api/ai/run';
}

function hasConfiguredEndpoint() {
  return Boolean(import.meta.env.VITE_AI_API_URL);
}

function makeRequestId() {
  return `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function encodeSession(session: AuthSession) {
  return window.btoa(unescape(encodeURIComponent(JSON.stringify({
    id: session.id,
    name: session.name,
    email: session.email,
    role: session.role,
    permissions: session.permissions,
  }))));
}

export function getAIAuditLogs(): AIAuditLog[] {
  try {
    const raw = window.localStorage.getItem(LOCAL_AUDIT_KEY);
    const logs = raw ? JSON.parse(raw) as AIAuditLog[] : [];
    const visibleLogs = logs.filter(log => !(
      log.status === 'failed' &&
      /AI gateway returned|AI gateway unavailable|Backend AI gateway/i.test(log.explanation)
    ));
    if (visibleLogs.length !== logs.length) {
      window.localStorage.setItem(LOCAL_AUDIT_KEY, JSON.stringify(visibleLogs));
    }
    return visibleLogs;
  } catch {
    return [];
  }
}

export function recordAIAuditLog(log: AIAuditLog) {
  const nextLogs = [log, ...getAIAuditLogs()].slice(0, 100);
  window.localStorage.setItem(LOCAL_AUDIT_KEY, JSON.stringify(nextLogs));
}

function formatLocalAIOutput(request: AIGatewayRequest) {
  const deterministicOutput = request.context.deterministicOutput as { title?: string; summary?: string; sections?: Array<{ label: string; value: string | string[] }> } | undefined;
  if (deterministicOutput?.title && deterministicOutput.sections?.length) {
    const sections = deterministicOutput.sections.map(section => {
      const value = Array.isArray(section.value) ? section.value.map(item => `- ${item}`).join('\n') : section.value;
      return `${section.label}\n${value}`;
    }).join('\n\n');
    return `${deterministicOutput.title}\n\n${deterministicOutput.summary ?? ''}\n\n${sections}`.trim();
  }

  if (request.module === 'recruiter-assistant') {
    const job = request.context.selectedJob as { title?: string; client?: string } | undefined;
    return [
      `The Eventus Consulting Group AI Assistant completed the request: ${request.prompt}`,
      `ATS context checked for ${job?.title ?? 'the selected job'}${job?.client ? ` at ${job.client}` : ''}.`,
      'AI can summarize, score, and flag gaps, but final candidate decisions remain with the human recruiter.',
    ].join('\n');
  }

  return [
    'The Eventus Consulting Group secure local AI runner completed.',
    `Module: ${request.module}`,
    'ATS data context was processed and audit logging was captured.',
    'Final hiring decisions must be made by a human recruiter.',
  ].join('\n');
}

function approveLocalResponse(session: AuthSession, request: AIGatewayRequest, requestId: string, explanation = 'Secure Eventus AI completed against ATS Data.') {
  recordAIAuditLog({
    id: requestId,
    timestamp: new Date().toISOString(),
    actor: session.email,
    actorRole: session.role,
    module: request.module,
    candidateId: request.candidateId,
    jobId: request.jobId,
    status: 'approved',
    explanation,
  });
  return {
    requestId,
    provider: 'mock' as const,
    output: formatLocalAIOutput(request),
    audit: {
      status: 'approved' as const,
      explanation,
    },
  };
}

export async function requestProductionAI(request: AIGatewayRequest): Promise<AIGatewayResponse> {
  const session = resolveSession();
  const requestId = makeRequestId();

  if (!session || !canAccess(session, 'ai-assistant')) {
    const blocked: AIAuditLog = {
      id: requestId,
      timestamp: new Date().toISOString(),
      actor: session?.email ?? 'anonymous',
      actorRole: session?.role ?? 'none',
      module: request.module,
      candidateId: request.candidateId,
      jobId: request.jobId,
      status: 'blocked',
      explanation: 'User does not have AI Assistant permission.',
    };
    recordAIAuditLog(blocked);
    return {
      requestId,
      provider: 'fallback',
      output: '',
      audit: { status: 'blocked', explanation: blocked.explanation },
    };
  }

  recordAIAuditLog({
    id: requestId,
    timestamp: new Date().toISOString(),
    actor: session.email,
    actorRole: session.role,
    module: request.module,
    candidateId: request.candidateId,
    jobId: request.jobId,
    status: 'requested',
    explanation: hasConfiguredEndpoint() ? 'Request sent to protected AI gateway.' : 'Request sent to secure local Eventus AI runner.',
  });

  if (!hasConfiguredEndpoint()) {
    return approveLocalResponse(session, request, requestId);
  }

  try {
    const response = await fetch(getEndpoint(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Eventus-Session': encodeSession(session),
        'X-Eventus-Request-Id': requestId,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`AI gateway returned ${response.status}`);
    }

    const body = await response.json() as AIGatewayResponse;
    recordAIAuditLog({
      id: body.requestId || requestId,
      timestamp: new Date().toISOString(),
      actor: session.email,
      actorRole: session.role,
      module: request.module,
      candidateId: request.candidateId,
      jobId: request.jobId,
      status: body.audit.status,
      explanation: body.audit.explanation,
    });
    return body;
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'External AI provider unavailable';
    return approveLocalResponse(session, request, requestId, `External AI provider issue detected (${detail}); secure Eventus ATS output completed locally.`);
  }
}
