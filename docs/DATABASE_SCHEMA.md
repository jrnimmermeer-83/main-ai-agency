# Database schema

## Database engine

The current application uses a **MySQL-compatible relational database** through **Drizzle ORM** (`drizzle-orm/mysql2`) and Drizzle Kit with `dialect: "mysql"`. It is not currently a Supabase/PostgreSQL database.

All IDs are auto-incrementing integers. Timestamps are stored as database timestamps. Tenant-scoped tables carry `organizationId` and must only be accessed through server-side membership and active-context checks.

## Tables

| Table | Primary purpose | Key columns |
|---|---|---|
| `users` | Application users from OAuth | `id`, `openId` (unique), `name`, `email`, `role`, timestamps |
| `organizations` | Tenant organizations | `id`, `name`, `slug` (unique), `createdBy`, timestamps |
| `organization_memberships` | User role in an organization | `organizationId`, `userId`, `role` (`owner`, `admin`, `operator`, `viewer`) |
| `user_organization_contexts` | Active organization per user | `userId` (unique), `organizationId`, `updatedAt` |
| `ai_configurations` | Customer AI and Platform AI configuration | `organizationId`, `scope`, `provider`, `model`, `systemPrompt`, `guardrails`, `updatedBy`, `version` |
| `provider_settings` | Provider selection per AI scope | `organizationId`, `scope`, `provider`, `model`, `enabled`, `updatedBy` |
| `change_requests` | Governed safe and structural changes | `organizationId`, `requestedBy`, `changeType`, `targetScope`, `status`, `proposedValue`, `validationResult`, `requiresApproval` |
| `change_approvals` | Administrator approval or rejection decision | `changeRequestId`, `organizationId`, `decidedBy`, `decision`, `comment` |
| `configuration_snapshots` | Pre-change snapshot for rollback | `organizationId`, `changeRequestId`, `configurationId`, `snapshot`, restore fields |
| `audit_events` | Immutable operational audit entries | `organizationId`, `actorId`, optional `changeRequestId`, `action`, `outcome`, `details` |
| `website_widgets` | Public website assistant registrations | `organizationId`, `publicId` (unique), `name`, `allowedOrigins`, `enabled`, `createdBy` |
| `website_chat_sessions` | Per-widget, per-session rate-limit window | `widgetId`, `sessionKey`, `windowStartedAt`, `messageCount` |
| `website_leads` | Consent-based website lead records | `organizationId`, `widgetId`, `intent`, `status`, contact fields, `message`, `sourceUrl`, `consentAt` |

## Relationships

```text
users 1──* organizations                (organizations.createdBy)
users *──* organizations                (organization_memberships)
users 1──1 user_organization_contexts   (active organization)

organizations 1──* ai_configurations
organizations 1──* provider_settings
organizations 1──* change_requests
organizations 1──* audit_events
organizations 1──* website_widgets
organizations 1──* website_leads

change_requests 1──* change_approvals
change_requests 1──* configuration_snapshots
change_requests 1──* audit_events

website_widgets 1──* website_chat_sessions
website_widgets 1──* website_leads
```

## Relationship and isolation rules

| Rule | Enforcement point |
|---|---|
| A user can access an organization only through `organization_memberships`. | Server-side tRPC authorization procedures |
| A tenant-scoped procedure requires the user’s active `user_organization_contexts` record to match the input organization. | Server-side tenant context guard |
| Every governed change, audit entry, snapshot, widget, and lead is bound to exactly one organization. | Foreign keys and explicit `organizationId` filters |
| A public widget can only create leads for its owning organization. | Widget lookup by `publicId`, origin allowlist, then server-derived `organizationId` |
| Contact data is stored only after the public lead procedure receives explicit consent. | Required `consent: true` input and server-side `consentAt` timestamp |

## Important indexes and uniqueness constraints

`organizations.slug`, `users.openId`, `website_widgets.publicId`, `organization_memberships(organizationId, userId)`, `user_organization_contexts.userId`, `ai_configurations(organizationId, scope)`, `provider_settings(organizationId, scope)`, and `website_chat_sessions(widgetId, sessionKey)` are unique. The lead, audit, change, membership, and widget tables also have tenant-focused indexes for scoped queries.

## Migrations

Schema migrations are kept in `drizzle/`. The current websitebot additions are in `drizzle/0003_slim_krista_starr.sql`. Review every generated migration before applying it to a production database.
