import {
  boolean,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const organizations = mysqlTable(
  "organizations",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    slug: varchar("slug", { length: 160 }).notNull(),
    createdBy: int("createdBy").notNull().references(() => users.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [uniqueIndex("organizations_slug_unique").on(table.slug)],
);

export const organizationMemberships = mysqlTable(
  "organization_memberships",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull().references(() => organizations.id),
    userId: int("userId").notNull().references(() => users.id),
    role: mysqlEnum("role", ["owner", "admin", "operator", "viewer"]).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    uniqueIndex("membership_organization_user_unique").on(table.organizationId, table.userId),
    index("membership_user_idx").on(table.userId),
  ],
);

export const userOrganizationContexts = mysqlTable(
  "user_organization_contexts",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id),
    organizationId: int("organizationId").notNull().references(() => organizations.id),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    uniqueIndex("user_organization_context_user_unique").on(table.userId),
    index("user_organization_context_organization_idx").on(table.organizationId),
  ],
);

export const aiConfigurations = mysqlTable(
  "ai_configurations",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull().references(() => organizations.id),
    scope: mysqlEnum("scope", ["customer", "platform"]).notNull(),
    provider: mysqlEnum("provider", ["openai", "anthropic", "google"]).notNull().default("openai"),
    model: varchar("model", { length: 160 }).notNull().default("gpt-5-mini"),
    systemPrompt: text("systemPrompt").notNull(),
    guardrails: json("guardrails").$type<string[]>().notNull(),
    updatedBy: int("updatedBy").notNull().references(() => users.id),
    version: int("version").notNull().default(1),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [uniqueIndex("configuration_organization_scope_unique").on(table.organizationId, table.scope)],
);

export const providerSettings = mysqlTable(
  "provider_settings",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull().references(() => organizations.id),
    scope: mysqlEnum("scope", ["customer", "platform"]).notNull(),
    provider: mysqlEnum("provider", ["openai", "anthropic", "google"]).notNull(),
    model: varchar("model", { length: 160 }).notNull(),
    enabled: boolean("enabled").notNull().default(false),
    updatedBy: int("updatedBy").notNull().references(() => users.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [uniqueIndex("provider_setting_organization_scope_unique").on(table.organizationId, table.scope)],
);

export const websiteWidgets = mysqlTable(
  "website_widgets",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull().references(() => organizations.id),
    publicId: varchar("publicId", { length: 64 }).notNull().unique(),
    name: varchar("name", { length: 120 }).notNull(),
    allowedOrigins: json("allowedOrigins").$type<string[]>().notNull(),
    enabled: boolean("enabled").notNull().default(true),
    createdBy: int("createdBy").notNull().references(() => users.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [index("widget_organization_idx").on(table.organizationId)],
);

export const websiteChatSessions = mysqlTable(
  "website_chat_sessions",
  {
    id: int("id").autoincrement().primaryKey(),
    widgetId: int("widgetId").notNull().references(() => websiteWidgets.id),
    sessionKey: varchar("sessionKey", { length: 80 }).notNull(),
    windowStartedAt: timestamp("windowStartedAt").notNull(),
    messageCount: int("messageCount").notNull().default(0),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [uniqueIndex("chat_session_widget_key_unique").on(table.widgetId, table.sessionKey)],
);

export const websiteLeads = mysqlTable(
  "website_leads",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull().references(() => organizations.id),
    widgetId: int("widgetId").notNull().references(() => websiteWidgets.id),
    intent: mysqlEnum("intent", ["purchase", "fleet", "service", "general"]).notNull(),
    status: mysqlEnum("status", ["new", "in_progress", "contacted", "closed"]).notNull().default("new"),
    name: varchar("name", { length: 160 }).notNull(),
    email: varchar("email", { length: 320 }).notNull(),
    phone: varchar("phone", { length: 40 }),
    message: text("message").notNull(),
    sourceUrl: varchar("sourceUrl", { length: 1000 }),
    consentAt: timestamp("consentAt").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index("lead_organization_status_idx").on(table.organizationId, table.status),
    index("lead_widget_created_idx").on(table.widgetId, table.createdAt),
  ],
);

export const changeRequests = mysqlTable(
  "change_requests",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull().references(() => organizations.id),
    requestedBy: int("requestedBy").notNull().references(() => users.id),
    source: mysqlEnum("source", ["manual", "agent"]).notNull().default("manual"),
    changeType: mysqlEnum("changeType", ["safe", "structural"]).notNull(),
    targetScope: mysqlEnum("targetScope", ["customer", "platform", "provider"]).notNull(),
    status: mysqlEnum("status", [
      "requested",
      "validated",
      "pending_approval",
      "approved",
      "rejected",
      "executing",
      "verified",
      "failed",
      "rolled_back",
    ]).notNull().default("requested"),
    title: varchar("title", { length: 200 }).notNull(),
    rationale: text("rationale").notNull(),
    proposedValue: json("proposedValue").$type<Record<string, unknown>>().notNull(),
    validationResult: json("validationResult").$type<Record<string, unknown>>().notNull(),
    requiresApproval: boolean("requiresApproval").notNull().default(false),
    executedAt: timestamp("executedAt"),
    verifiedAt: timestamp("verifiedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index("change_organization_status_idx").on(table.organizationId, table.status),
    index("change_requester_idx").on(table.requestedBy),
  ],
);

export const changeApprovals = mysqlTable(
  "change_approvals",
  {
    id: int("id").autoincrement().primaryKey(),
    changeRequestId: int("changeRequestId").notNull().references(() => changeRequests.id),
    organizationId: int("organizationId").notNull().references(() => organizations.id),
    decidedBy: int("decidedBy").notNull().references(() => users.id),
    decision: mysqlEnum("decision", ["approved", "rejected"]).notNull(),
    comment: text("comment"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("approval_change_idx").on(table.changeRequestId)],
);

export const configurationSnapshots = mysqlTable(
  "configuration_snapshots",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull().references(() => organizations.id),
    changeRequestId: int("changeRequestId").notNull().references(() => changeRequests.id),
    configurationId: int("configurationId").notNull().references(() => aiConfigurations.id),
    snapshot: json("snapshot").$type<Record<string, unknown>>().notNull(),
    createdBy: int("createdBy").notNull().references(() => users.id),
    restoredAt: timestamp("restoredAt"),
    restoredBy: int("restoredBy").references(() => users.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("snapshot_organization_change_idx").on(table.organizationId, table.changeRequestId)],
);

export const auditEvents = mysqlTable(
  "audit_events",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull().references(() => organizations.id),
    actorId: int("actorId").notNull().references(() => users.id),
    changeRequestId: int("changeRequestId").references(() => changeRequests.id),
    action: varchar("action", { length: 120 }).notNull(),
    subjectType: varchar("subjectType", { length: 120 }).notNull(),
    subjectId: int("subjectId"),
    outcome: mysqlEnum("outcome", ["success", "denied", "failed"]).notNull(),
    details: json("details").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [
    index("audit_organization_created_idx").on(table.organizationId, table.createdAt),
    index("audit_change_idx").on(table.changeRequestId),
  ],
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Organization = typeof organizations.$inferSelect;
export type OrganizationMembership = typeof organizationMemberships.$inferSelect;
export type UserOrganizationContext = typeof userOrganizationContexts.$inferSelect;
export type AiConfiguration = typeof aiConfigurations.$inferSelect;
export type WebsiteWidget = typeof websiteWidgets.$inferSelect;
export type WebsiteLead = typeof websiteLeads.$inferSelect;
export type ChangeRequest = typeof changeRequests.$inferSelect;
export type ChangeStatus = ChangeRequest["status"];
