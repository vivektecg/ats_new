# RecruitIQ

RecruitIQ is a modern ATS and recruitment CRM for US staffing teams. The app is a Vite + React + TypeScript frontend with a Node.js API backend. For production, the API can now persist ATS records in PostgreSQL.

## Production PostgreSQL Backend

The backend uses PostgreSQL when `DATABASE_URL` or `POSTGRES_URL` is configured and `ATS_STORAGE` is set to `postgres` or left unset.

PostgreSQL storage details:

- Runtime API server: `server/ai-api.mjs`
- PostgreSQL adapter: `server/ats-store.mjs`
- Migration runner: `server/migrate-postgres.mjs`
- Production table: `ats_records`
- Record format: JSONB rows grouped by ATS collection
- Database-level duplicate guard: one submission per `candidateId + jobId`

Recommended production environment variables:

```bash
NODE_ENV=production
DATABASE_URL=postgres://ats_user:strong_password@127.0.0.1:5432/eventus_ats
ATS_STORAGE=postgres
AI_API_PORT=8787
AI_CORS_ORIGIN=https://your-domain.com
VITE_ATS_API_URL=https://your-domain.com/api/ats
VITE_AI_API_URL=https://your-domain.com/api/ai/run
```

Production safety guard:

- The API now refuses to boot in `NODE_ENV=production` without PostgreSQL unless you explicitly set `ALLOW_JSON_STORAGE_IN_PRODUCTION=true`.
- This protects the app from accidentally running on ephemeral JSON-file storage, which is a common reason data seems to "disappear" after redeploys or server restarts.
- Demo seed data is disabled in production builds unless `VITE_ENABLE_DEMO_DATA=true` is intentionally set.

If your PostgreSQL provider requires SSL:

```bash
PGSSL=true
PGSSL_REJECT_UNAUTHORIZED=false
```

Run migrations:

```bash
npm run db:migrate
```

Start the backend:

```bash
npm run api:server
```

Local development can still run without `DATABASE_URL`; in that mode the backend falls back to `server/data/ats-db.json`.

## Step 3: SQL Backend Integration Plan

Step 3 prepares the app for a future SQL backend without connecting to paid services.

Added files:

- `database/schema.sql`: PostgreSQL-compatible schema for the full VRecruit domain.
- `database/seed.sql`: optional local seed data for development validation.

Recommended backend path:

1. Add a local Node.js Express API server.
2. Use PostgreSQL locally or in a self-managed environment.
3. Keep the React app pointed at mock data until API endpoints are ready.
4. Replace `src/lib/data.ts` imports page-by-page with typed API client calls.
5. Add authentication after users and roles are backed by the database.

No Supabase project, hosted database, or paid provider is connected by this step.

## Required Tables Covered

The schema includes:

- `users`
- `roles`
- `candidates`
- `candidate_skills`
- `candidate_documents`
- `jobs`
- `clients`
- `client_contacts`
- `submissions`
- `interviews`
- `tasks`
- `notes`
- `compliance_documents`
- `activity_logs`
- `integrations`
- `ai_logs`

Every major table includes:

- `id`
- `created_at`
- `updated_at`
- `created_by`
- `updated_by`

Recent backend-ready profile/logo additions:

- `users.avatar_url`: stores SuperUser and regular user profile-picture URLs.
- `users.password_hash`: stores backend-hashed passwords for real authentication.
- `users.mfa_enabled`, `users.failed_login_attempts`, `users.locked_until`: supports production security controls.
- `roles.permissions_json`: stores role/section permissions server-side.
- `clients.logo_url`: stores client/customer logo URLs for identity validation.
- `jobs.jd_attachment_name`, `jobs.jd_attachment_type`, `jobs.jd_attachment_size`, `jobs.jd_attachment_url`: store the current JD attachment metadata/path.
- `job_documents`: stores versioned job/JD attachments such as Outlook emails, Word documents, PDFs, images, text files, and ZIPs.
- `database/migrations/2026-05-15-profile-assets.sql`: migration for existing PostgreSQL databases.

In local React testing, uploaded pictures are stored as browser data URLs. In production, upload the image to private object storage or server file storage, then save only the resulting URL/path in `users.avatar_url` or `clients.logo_url`.

## Candidate Data Mapping

The Candidates module maps to:

- `candidates.full_name`
- `candidates.email`
- `candidates.phone`
- `candidates.current_title`
- `candidates.current_company`
- `candidates.location`
- `candidates.skills_summary`
- `candidate_skills.skill_name`
- `candidates.total_experience`
- `candidates.us_experience`
- `candidates.work_authorization`
- `candidates.visa_status`
- `candidates.current_rate`
- `candidates.expected_rate`
- `candidates.availability`
- `candidates.source`
- `candidates.owner_id`
- `candidates.status`
- `candidates.notes`

Candidate actions map as follows:

- Add/Edit Candidate: `candidates`, `candidate_skills`
- Upload Resume: `candidate_documents`
- Status Change: `candidates.status`, `activity_logs`
- Submit to Job: `submissions`
- Schedule Interview: `interviews`
- Create Task / Complete Task: `tasks`
- Add Note: `notes`
- Archive: `candidates.archived_at`
- Delete: hard delete only for admin workflows, otherwise prefer archive
- Connect: `activity_logs`, future email/SMS integration records

## Jobs Data Mapping

The Jobs module maps to:

- `jobs.title`
- `jobs.client_id`
- `jobs.client_contact_id`
- `jobs.location`
- `jobs.work_mode`
- `jobs.job_type`
- `jobs.openings`
- `jobs.pay_rate`
- `jobs.bill_rate`
- `jobs.priority`
- `jobs.status`
- `jobs.required_skills`
- `jobs.preferred_skills`
- `jobs.job_description`
- `jobs.submission_deadline`
- `jobs.assigned_recruiter_id`

## Suggested Express API Shape

Initial endpoints:

- `GET /api/users`
- `POST /api/users`
- `PATCH /api/users/:id`
- `POST /api/users/:id/avatar`
- `PATCH /api/users/:id/password`
- `PATCH /api/users/:id/permissions`
- `GET /api/candidates`
- `POST /api/candidates`
- `GET /api/candidates/:id`
- `PATCH /api/candidates/:id`
- `DELETE /api/candidates/:id`
- `POST /api/candidates/:id/archive`
- `POST /api/candidates/:id/documents`
- `POST /api/candidates/:id/notes`
- `POST /api/submissions`
- `POST /api/interviews`
- `POST /api/tasks`
- `PATCH /api/tasks/:id`
- `GET /api/jobs`
- `GET /api/clients`
- `POST /api/clients/:id/logo`

Frontend migration order:

1. Candidates
2. Jobs
3. Clients
4. Submissions
5. Interviews and calendar
6. Tasks
7. Compliance
8. Reports and dashboard metrics

## Local SQL Validation

Example local flow:

```bash
createdb vrecruit_local
psql vrecruit_local -f database/schema.sql
psql vrecruit_local -f database/seed.sql
```

Then the future Express backend can use a local connection string:

```bash
DATABASE_URL=postgres://localhost:5432/vrecruit_local
```

## Security Notes

- Store credentials in environment variables, never in frontend code.
- Store password hashes server-side only using a strong password hashing algorithm such as Argon2id or bcrypt.
- Store uploaded profile/client logo files outside the database; keep only `avatar_url` / `logo_url` paths in SQL.
- Keep file uploads in local storage during development, then switch to object storage only when a provider is chosen.
- Local testing persists manually added candidates and jobs under the `recruitiq:test:*` browser namespace so refreshes do not wipe manual QA entries.
- Use role-based authorization with `users.role_id`.
- Prefer archive flows over destructive deletes for auditability.
- Record important workflow actions in `activity_logs`.

## Production AI Gateway

The AI Workbench is wired for a protected backend AI gateway. The React app calls `/api/ai/run`; API keys must stay on the server.

Added:

- `server/ai-api.mjs`: Node HTTP API with AI module allow-list, RBAC check, simple rate limiting, prompt redaction, and JSONL audit logging.
- `src/lib/aiGateway.ts`: frontend gateway client that checks current session permissions and records local audit status.
- AI Workbench controls: `Run Secure Backend AI` and an on-screen AI audit trail.

Local run:

```bash
npm run ai:server
```

For local Vite development with the API on port 8787:

```bash
VITE_AI_API_URL=http://localhost:8787/api/ai/run npm run dev
```

Server environment variables:

```bash
AI_API_PORT=8787
AI_CORS_ORIGIN=https://your-vrecruit-domain.example
AI_RATE_LIMIT_PER_MINUTE=30
LLM_API_URL=https://your-llm-provider.example/v1/chat/completions
LLM_API_KEY=server-side-secret
LLM_MODEL=your-approved-model
```

Production requirements before go-live:

- Replace the temporary frontend localStorage session with backend-issued secure sessions or JWTs.
- Verify permissions server-side against the real users/roles database.
- Store AI audit logs in SQL `ai_logs` and `activity_logs`, not only JSONL.
- Use TLS, secure cookies, MFA, rate limiting, input validation, and retention policies.
- Keep human recruiter final decisions separate from AI recommendations.

## Step 4: Bolt SQL Schema Starter

Step 4 adds a simpler Bolt-friendly SQL starter in addition to the richer PostgreSQL schema from Step 3.

Added:

- `database/bolt-schema.sql`: MySQL-style `INT AUTO_INCREMENT` starter schema.
- `/database` app route: visual database readiness page with SQL preview, table coverage, and planned API endpoints.
- Sidebar navigation item: Database.

Use `database/bolt-schema.sql` when Bolt asks for a compact SQL schema starter. Use `database/schema.sql` when moving toward the more complete PostgreSQL backend.
