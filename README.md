# Main AI Agency

Main AI Agency is a **tenant-safe AI administration workspace**. It provides organization-scoped configuration management, governed change requests, approvals, audit history, rollback, provider selection, website-assistant administration, and consent-based lead capture.

The project currently includes the version-1 **EasyWiel Assistent**: a Dutch website-chatbot experience that is intentionally restricted to approved EasyWiel information and can create follow-up leads only after explicit visitor consent.

> **Important export note:** this is a React/TypeScript application, but its current backend and database are **not yet a Supabase stack**. It runs an Express/tRPC server with Drizzle ORM on a MySQL-compatible database. See [`docs/LOVABLE_IMPORT.md`](docs/LOVABLE_IMPORT.md) for the required adaptation path before using Supabase as the production backend in Lovable.

## Technology stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React 19, TypeScript, Vite 7, Wouter, Tailwind CSS 4 | Responsive administration workspace and public EasyWiel widget |
| UI | shadcn/ui-style components, Radix UI, Lucide icons, Sonner | Accessible controls, feedback, and interface primitives |
| Backend | Node.js, Express 4, TypeScript, tRPC 11 | Typed API procedures, authentication boundary, server-side governance |
| Database | MySQL-compatible SQL database, Drizzle ORM and Drizzle Kit | Tenant-scoped records, migrations, relationships, and query layer |
| Authentication | Manus OAuth and signed server sessions | User identity and organization-scoped access control |
| AI | Manus Forge LLM API through a server-side wrapper | Governed Platform AI proposals and the public EasyWiel assistant |
| Storage | Manus Forge storage proxy and S3-compatible presigned URLs | Optional file storage; file bytes are not stored in the database |
| Tests | Vitest | Governance, authorization, audit, and EasyWiel-bot behavior tests |

No Python backend is used. The application is a single Node.js/Express process that serves the Vite-built frontend and tRPC API.

## Main capabilities

The system keeps every organization isolated at the server and database layers. It supports organization memberships, active organization context, role-gated configuration changes, mandatory approvals for structural changes, immutable audit events, supported rollback, and provider settings that never expose credentials to the browser.

For EasyWiel, the new websitebot feature adds a public widget configuration, origin allowlisting, chat-session quotas, safe fallback answers, consent recording, tenant-bound lead storage, and a lead-inbox workflow for team follow-up.

## Local setup

### Prerequisites

Use Node.js 22 or newer and pnpm 10. A MySQL-compatible database is required for the full application and migrations.

### Install and run

```bash
corepack enable
pnpm install --frozen-lockfile
cp docs/ENVIRONMENT_TEMPLATE.md .env.local
# Fill only the values required for your environment.
pnpm check
pnpm test
pnpm dev
```

The development server uses the `PORT` environment variable when it is supplied. Otherwise, the server selects its normal local development port.

### Database migrations

Set `DATABASE_URL` first. Drizzle uses the MySQL dialect and reads the schema from `drizzle/schema.ts`.

```bash
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
```

Review generated SQL in `drizzle/` before applying it to a shared environment. The database layout is documented in [`docs/DATABASE_SCHEMA.md`](docs/DATABASE_SCHEMA.md).

### Quality checks

```bash
pnpm check
pnpm test
pnpm build
```

## Environment variables

Copy the values from [`docs/ENVIRONMENT_TEMPLATE.md`](docs/ENVIRONMENT_TEMPLATE.md) into a non-committed local `.env.local` file. The managed project environment does not permit a committed `.env.example` file to be generated directly; the tracked template provides the same variable names without values.

| Variable | Required for | Browser-safe? |
|---|---|---|
| `DATABASE_URL` | MySQL-compatible database and Drizzle migrations | No |
| `JWT_SECRET` | Server session signing | No |
| `OAUTH_SERVER_URL` | Manus OAuth server | No |
| `VITE_APP_ID` | Manus OAuth client identity | Yes, build-time public identifier |
| `VITE_OAUTH_PORTAL_URL` | Frontend sign-in route | Yes |
| `OWNER_OPEN_ID` | Bootstrap owner recognition | No |
| `BUILT_IN_FORGE_API_URL` | Server-side Manus Forge AI and storage endpoint | No |
| `BUILT_IN_FORGE_API_KEY` | Server-side Manus Forge AI and storage authorization | No |
| `VITE_FRONTEND_FORGE_API_URL` | Optional frontend Forge integration | Yes, endpoint only |
| `VITE_FRONTEND_FORGE_API_KEY` | Optional frontend Forge access, if explicitly supported by the runtime | Treat as sensitive; avoid exposing unless the platform documents it as public |
| `VITE_ANALYTICS_ENDPOINT` / `VITE_ANALYTICS_WEBSITE_ID` | Optional analytics | Public identifiers only |
| `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY` | Reserved for future direct server-side adapters; the current runtime uses Forge instead | No |

## External services and APIs

| Service | Current use |
|---|---|
| Manus OAuth | User authentication and signed session bootstrap |
| Manus Forge API | Server-side LLM calls, model listing, storage proxy, and optional owner notifications |
| MySQL-compatible database | Application persistence through Drizzle ORM |
| S3-compatible object storage | Optional file uploads through Forge-generated presigned URLs |
| EasyWiel public website | Source material for the approved version-1 EasyWiel assistant knowledge base; no live scraping occurs during visitor chats |

## GitHub and Lovable export

The repository intentionally excludes `.env*` files, local runtime artifacts, build outputs, and logs. Before importing into Lovable, read [`docs/LOVABLE_IMPORT.md`](docs/LOVABLE_IMPORT.md). The frontend can be reused as React/TypeScript, while the Express/tRPC/MySQL backend requires a deliberate migration to Supabase Auth, Postgres, and Edge Functions or a retained external backend.

## Repository structure

```text
client/                 React/Vite frontend and public widget UI
server/                 Express/tRPC backend, governance, database helpers
drizzle/                Drizzle schema and SQL migrations
docs/                   Architecture, bot-flow, database, and Lovable handoff docs
shared/                 Shared typed constants and errors
```

## Security model

Secrets are never committed or returned to browsers. Tenant operations require server-side active-context and membership checks. Structural configuration changes require an authorized administrator decision, and supported configuration changes create a pre-change snapshot for rollback. Public widget access is limited by the widget’s allowed origin and a per-session message quota; leads require explicit consent before contact details are stored.
