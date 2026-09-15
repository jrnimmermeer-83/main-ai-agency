# Lovable import and Supabase migration guide

## Current compatibility

The frontend is already React and TypeScript, so its components, visual design, routes, forms, and typed client patterns are usable as source material for Lovable. However, this project is **not currently a native Lovable/Supabase project**:

| Current component | Current implementation | Lovable/Supabase equivalent |
|---|---|---|
| Database | MySQL-compatible database with Drizzle | Supabase Postgres with SQL migrations |
| Auth | Manus OAuth and signed Node sessions | Supabase Auth and `auth.uid()` |
| Backend procedures | Express + tRPC | Supabase Edge Functions, RPC functions, or a retained external API |
| Tenant enforcement | Server-side membership/context guards | Postgres foreign keys plus Row Level Security policies |
| Server secrets | Manus environment variables | Supabase project secrets / Edge Function secrets |
| AI calls | Manus Forge server-side LLM wrapper | Edge Function calling OpenAI, Anthropic, Google, or a retained backend |

## Recommended import approach

Import the repository into Lovable as a React/TypeScript codebase, retain `client/` as the visual reference, and plan the backend migration before treating the imported project as production-ready. Do **not** copy `.env.example` values into browser-side code.

### Migration sequence

1. Create a Supabase project and reproduce the tables from [`DATABASE_SCHEMA.md`](DATABASE_SCHEMA.md) in Postgres.
2. Replace MySQL-specific enums, timestamps, and auto-increment IDs with Postgres equivalents, such as `uuid` or `bigint generated always as identity`.
3. Enable RLS on every tenant table. Policies must join `organization_memberships` against `auth.uid()` and must never accept a client-provided organization ID without checking membership.
4. Replace `server/routers.ts` procedures with Supabase Edge Functions or secure Postgres RPC functions. Keep public widget endpoints separate from authenticated administrator procedures.
5. Move all server-side secrets—AI keys and any CRM/email credentials—to Supabase Edge Function secrets.
6. Keep the public widget’s origin allowlist, per-session quota, consent gate, and server-derived organization ID.
7. Rebuild and test the audit, approval, rollback, and cross-tenant authorization paths before production launch.

## What should not be moved directly to the client

Never move `server/`, provider credentials, role checks, approval decisions, audit writers, rollback logic, lead creation authorization, or the LLM system prompt execution directly to React browser code. These are trust boundaries and must remain in Edge Functions, database functions protected by RLS, or another server-side service.

## EasyWiel widget after migration

The public widget must call a public Edge Function that validates the widget ID and page origin, enforces a message quota, reads only the approved EasyWiel knowledge base, and exposes a separate consent-required lead endpoint. Lead management must remain behind authenticated tenant policies.

## Validation checklist

Before marking the Lovable/Supabase migration complete, verify that a user from Organization A cannot read or change records belonging to Organization B; a public widget cannot submit a lead for an unapproved origin; provider keys do not appear in client bundles; and a structural change still requires explicit administrator approval.
