import { and, desc, eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { drizzle } from "drizzle-orm/mysql2";
import {
  aiConfigurations,
  auditEvents,
  changeApprovals,
  changeRequests,
  configurationSnapshots,
  organizationMemberships,
  organizations,
  providerSettings,
  userOrganizationContexts,
  websiteChatSessions,
  websiteLeads,
  websiteWidgets,
  type InsertUser,
  users,
} from "../drizzle/schema";
import {
  buildGovernanceAuditEvent,
  type ChangeType,
  type ConfigurationProposal,
  type TargetScope,
  type TenantRole,
  validateProposal,
} from "./governance";

let _db: ReturnType<typeof drizzle> | null = null;
let governanceAuditWriter: typeof recordAuditEvent = recordAuditEvent;

export function setGovernanceTestDependenciesForTests(input?: {
  db?: ReturnType<typeof drizzle> | null;
  auditWriter?: typeof recordAuditEvent;
}) {
  _db = input?.db ?? null;
  governanceAuditWriter = input?.auditWriter ?? recordAuditEvent;
}

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  return db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId, lastSignedIn: new Date() };
  const updateSet: Record<string, unknown> = { lastSignedIn: new Date() };
  for (const field of ["name", "email", "loginMethod", "role"] as const) {
    if (user[field] !== undefined) {
      values[field] = user[field] as never;
      updateSet[field] = user[field] ?? null;
    }
  }
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function listOrganizationsForUser(userId: number) {
  const db = await requireDb();
  return db
    .select({ organization: organizations, membershipRole: organizationMemberships.role })
    .from(organizationMemberships)
    .innerJoin(organizations, eq(organizationMemberships.organizationId, organizations.id))
    .where(eq(organizationMemberships.userId, userId));
}

export async function getMembershipForOrganization(userId: number, organizationId: number) {
  const db = await requireDb();
  const result = await db
    .select()
    .from(organizationMemberships)
    .where(and(eq(organizationMemberships.userId, userId), eq(organizationMemberships.organizationId, organizationId)))
    .limit(1);
  return result[0];
}

export async function getActiveOrganizationForUser(userId: number) {
  const db = await requireDb();
  const result = await db
    .select({ organization: organizations, membershipRole: organizationMemberships.role })
    .from(userOrganizationContexts)
    .innerJoin(organizations, eq(userOrganizationContexts.organizationId, organizations.id))
    .innerJoin(
      organizationMemberships,
      and(
        eq(organizationMemberships.organizationId, organizations.id),
        eq(organizationMemberships.userId, userId),
      ),
    )
    .where(eq(userOrganizationContexts.userId, userId))
    .limit(1);
  return result[0];
}

export async function setActiveOrganizationForUser(userId: number, organizationId: number) {
  const db = await requireDb();
  await db
    .insert(userOrganizationContexts)
    .values({ userId, organizationId })
    .onDuplicateKeyUpdate({ set: { organizationId, updatedAt: new Date() } });
  return getActiveOrganizationForUser(userId);
}

export async function createOrganizationForUser(userId: number, name: string, slug: string) {
  const db = await requireDb();
  const now = new Date();
  return db.transaction(async (tx) => {
    const organizationResult = await tx.insert(organizations).values({ name, slug, createdBy: userId });
    const organizationId = Number(organizationResult[0].insertId);
    await tx.insert(organizationMemberships).values({ organizationId, userId, role: "owner" });
    await tx
      .insert(userOrganizationContexts)
      .values({ userId, organizationId })
      .onDuplicateKeyUpdate({ set: { organizationId, updatedAt: new Date() } });
    await tx.insert(aiConfigurations).values([
      {
        organizationId,
        scope: "customer",
        provider: "openai",
        model: "gpt-5-mini",
        systemPrompt: "Je bent de Customer AI. Antwoord behulpzaam, feitelijk en binnen de ingestelde guardrails.",
        guardrails: ["Gebruik geen providercredentials.", "Respecteer tenantgrenzen.", "Escalatie bij onzekere antwoorden."],
        updatedBy: userId,
      },
      {
        organizationId,
        scope: "platform",
        provider: "openai",
        model: "gpt-5-mini",
        systemPrompt: "Je bent de Platform AI Agent. Je doet alleen veilige wijzigingsvoorstellen en voert nooit ongeautoriseerde acties uit.",
        guardrails: ["Maak voorstellen, geen directe mutaties.", "Respecteer rollen en approvals.", "Gebruik geen of vraag nooit om geheimen."],
        updatedBy: userId,
      },
    ]);
    await tx.insert(providerSettings).values([
      { organizationId, scope: "customer", provider: "openai", model: "gpt-5-mini", enabled: false, updatedBy: userId },
      { organizationId, scope: "platform", provider: "openai", model: "gpt-5-mini", enabled: false, updatedBy: userId },
    ]);
    await tx.insert(auditEvents).values({
      organizationId,
      actorId: userId,
      action: "organization.created",
      subjectType: "organization",
      subjectId: organizationId,
      outcome: "success",
      details: { name, slug, bootstrapAt: now.toISOString() },
    });
    return { id: organizationId, name, slug, membershipRole: "owner" as const };
  });
}

export async function getConfigurationForOrganization(organizationId: number, scope: "customer" | "platform") {
  const db = await requireDb();
  const result = await db
    .select()
    .from(aiConfigurations)
    .where(and(eq(aiConfigurations.organizationId, organizationId), eq(aiConfigurations.scope, scope)))
    .limit(1);
  return result[0];
}

export async function getProviderSettingsForOrganization(organizationId: number) {
  const db = await requireDb();
  return db.select().from(providerSettings).where(eq(providerSettings.organizationId, organizationId));
}

export async function getWebsiteWidgetForOrganization(organizationId: number) {
  const db = await requireDb();
  const result = await db.select().from(websiteWidgets).where(eq(websiteWidgets.organizationId, organizationId)).limit(1);
  return result[0];
}

export async function getPublicWebsiteWidget(publicId: string, sourceUrl: string) {
  const db = await requireDb();
  const result = await db.select().from(websiteWidgets).where(eq(websiteWidgets.publicId, publicId)).limit(1);
  const widget = result[0];
  if (!widget || !widget.enabled) throw new Error("Deze website-assistent is niet beschikbaar.");
  const allowedOrigins = widget.allowedOrigins as string[];
  let origin: string;
  try {
    origin = new URL(sourceUrl).origin;
  } catch {
    throw new Error("De herkomst van dit chatverzoek is ongeldig.");
  }
  if (!allowedOrigins.includes(origin)) throw new Error("Deze website mag de EasyWiel Assistent niet gebruiken.");
  return widget;
}

export async function createWebsiteWidget(input: { organizationId: number; createdBy: number; name: string; allowedOrigins: string[] }) {
  const db = await requireDb();
  const publicId = `ew_${randomBytes(18).toString("base64url")}`;
  const inserted = await db.insert(websiteWidgets).values({
    organizationId: input.organizationId,
    publicId,
    name: input.name,
    allowedOrigins: input.allowedOrigins,
    createdBy: input.createdBy,
  });
  const id = Number(inserted[0].insertId);
  await governanceAuditWriter({ organizationId: input.organizationId, actorId: input.createdBy, action: "website_widget.created", subjectType: "website_widget", subjectId: id, outcome: "success", details: { name: input.name, allowedOrigins: input.allowedOrigins } });
  return getWebsiteWidgetForOrganization(input.organizationId);
}

export async function consumeWebsiteChatQuota(widgetId: number, sessionKey: string) {
  const db = await requireDb();
  const now = new Date();
  const result = await db.select().from(websiteChatSessions).where(and(eq(websiteChatSessions.widgetId, widgetId), eq(websiteChatSessions.sessionKey, sessionKey))).limit(1);
  const current = result[0];
  if (!current) {
    await db.insert(websiteChatSessions).values({ widgetId, sessionKey, windowStartedAt: now, messageCount: 1 });
    return;
  }
  const windowExpired = now.getTime() - current.windowStartedAt.getTime() >= 60 * 60 * 1000;
  if (!windowExpired && current.messageCount >= 20) throw new Error("Je hebt het maximale aantal chatberichten voor dit uur bereikt. Probeer het later opnieuw of neem contact op met EasyWiel.");
  await db.update(websiteChatSessions).set(windowExpired ? { windowStartedAt: now, messageCount: 1, updatedAt: now } : { messageCount: current.messageCount + 1, updatedAt: now }).where(eq(websiteChatSessions.id, current.id));
}

export async function createWebsiteLead(input: { widgetId: number; organizationId: number; intent: "purchase" | "fleet" | "service" | "general"; name: string; email: string; phone?: string; message: string; sourceUrl?: string }) {
  const db = await requireDb();
  const inserted = await db.insert(websiteLeads).values({ ...input, consentAt: new Date(), phone: input.phone || null, sourceUrl: input.sourceUrl || null });
  return Number(inserted[0].insertId);
}

export async function listWebsiteLeadsForOrganization(organizationId: number) {
  const db = await requireDb();
  return db.select().from(websiteLeads).where(eq(websiteLeads.organizationId, organizationId)).orderBy(desc(websiteLeads.createdAt));
}

export async function updateWebsiteLeadStatus(input: { organizationId: number; leadId: number; status: "new" | "in_progress" | "contacted" | "closed"; actorId: number }) {
  const db = await requireDb();
  const result = await db.select().from(websiteLeads).where(and(eq(websiteLeads.organizationId, input.organizationId), eq(websiteLeads.id, input.leadId))).limit(1);
  const lead = result[0];
  if (!lead) throw new Error("Deze lead bestaat niet binnen de actieve organisatie.");
  await db.update(websiteLeads).set({ status: input.status, updatedAt: new Date() }).where(and(eq(websiteLeads.id, input.leadId), eq(websiteLeads.organizationId, input.organizationId)));
  await governanceAuditWriter({ organizationId: input.organizationId, actorId: input.actorId, action: "website_lead.status_changed", subjectType: "website_lead", subjectId: lead.id, outcome: "success", details: { previousStatus: lead.status, status: input.status, intent: lead.intent } });
}

export async function recordAuditEvent(input: {
  organizationId: number;
  actorId: number;
  action: string;
  subjectType: string;
  subjectId?: number;
  changeRequestId?: number;
  outcome: "success" | "denied" | "failed";
  details: Record<string, unknown>;
}) {
  const db = await requireDb();
  await db.insert(auditEvents).values(input);
}

export async function createGovernedChange(input: {
  organizationId: number;
  requestedBy: number;
  source: "manual" | "agent";
  changeType: ChangeType;
  targetScope: TargetScope;
  title: string;
  rationale: string;
  proposedValue: ConfigurationProposal;
}) {
  const validation = validateProposal(input.proposedValue);
  if (!validation.passed) throw new Error(validation.checks.join(" "));
  if (validation.classifiedAs !== input.changeType) {
    throw new Error("De change-classificatie komt niet overeen met de ondersteunde wijziging.");
  }

  const db = await requireDb();
  const requiresApproval = input.changeType === "structural";
  const status = requiresApproval ? "pending_approval" : "validated";
  const inserted = await db.insert(changeRequests).values({
    ...input,
    status,
    validationResult: validation,
    requiresApproval,
  });
  const changeId = Number(inserted[0].insertId);
  await governanceAuditWriter(buildGovernanceAuditEvent({
    stage: requiresApproval ? "requested_for_approval" : "validated",
    organizationId: input.organizationId,
    actorId: input.requestedBy,
    changeRequestId: changeId,
    subjectId: changeId,
    details: { changeType: input.changeType, targetScope: input.targetScope, validation },
  }));
  return getChangeForOrganization(input.organizationId, changeId);
}

export async function getChangeForOrganization(organizationId: number, changeId: number) {
  const db = await requireDb();
  const result = await db
    .select()
    .from(changeRequests)
    .where(and(eq(changeRequests.organizationId, organizationId), eq(changeRequests.id, changeId)))
    .limit(1);
  return result[0];
}

export async function listChangesForOrganization(organizationId: number) {
  const db = await requireDb();
  return db
    .select({ change: changeRequests, requester: users.name })
    .from(changeRequests)
    .leftJoin(users, eq(changeRequests.requestedBy, users.id))
    .where(eq(changeRequests.organizationId, organizationId))
    .orderBy(desc(changeRequests.createdAt));
}

export async function listAuditEventsForOrganization(organizationId: number) {
  const db = await requireDb();
  return db
    .select({ event: auditEvents, actorName: users.name })
    .from(auditEvents)
    .leftJoin(users, eq(auditEvents.actorId, users.id))
    .where(eq(auditEvents.organizationId, organizationId))
    .orderBy(desc(auditEvents.createdAt));
}

export async function applyApprovedChange(input: { organizationId: number; changeId: number; actorId: number }) {
  const db = await requireDb();
  const change = await getChangeForOrganization(input.organizationId, input.changeId);
  if (!change) throw new Error("De wijziging bestaat niet binnen deze organisatie.");
  if (change.status !== "validated" && change.status !== "approved") {
    throw new Error("Deze wijziging is niet uitvoerbaar in de huidige status.");
  }

  await db.update(changeRequests).set({ status: "executing", updatedAt: new Date() }).where(eq(changeRequests.id, change.id));
  await governanceAuditWriter(buildGovernanceAuditEvent({
    stage: "execution_started",
    organizationId: input.organizationId,
    actorId: input.actorId,
    changeRequestId: change.id,
    subjectId: change.id,
    details: { targetScope: change.targetScope },
  }));

  try {
    const proposal = change.proposedValue as ConfigurationProposal;
    if (change.targetScope === "provider") {
      if (proposal.providerScope !== "customer" && proposal.providerScope !== "platform") {
        throw new Error("De providerwijziging mist een geldige AI-doelscope.");
      }
      await db
        .update(providerSettings)
        .set({ provider: proposal.provider, model: proposal.model, enabled: Boolean(proposal.enabled), updatedBy: input.actorId, updatedAt: new Date() })
        .where(and(eq(providerSettings.organizationId, input.organizationId), eq(providerSettings.scope, proposal.providerScope)));
    } else {
      const configuration = await getConfigurationForOrganization(input.organizationId, change.targetScope);
      if (!configuration) throw new Error("De doelconfiguratie is niet gevonden.");
      await db.insert(configurationSnapshots).values({
        organizationId: input.organizationId,
        changeRequestId: change.id,
        configurationId: configuration.id,
        snapshot: {
          provider: configuration.provider,
          model: configuration.model,
          systemPrompt: configuration.systemPrompt,
          guardrails: configuration.guardrails,
          version: configuration.version,
        },
        createdBy: input.actorId,
      });
      await db
        .update(aiConfigurations)
        .set({
          provider: proposal.provider,
          model: proposal.model,
          systemPrompt: proposal.systemPrompt ?? configuration.systemPrompt,
          guardrails: proposal.guardrails ?? configuration.guardrails,
          updatedBy: input.actorId,
          version: configuration.version + 1,
          updatedAt: new Date(),
        })
        .where(and(eq(aiConfigurations.id, configuration.id), eq(aiConfigurations.organizationId, input.organizationId)));
    }

    await db
      .update(changeRequests)
      .set({ status: "verified", executedAt: new Date(), verifiedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(changeRequests.id, change.id), eq(changeRequests.organizationId, input.organizationId)));
    await governanceAuditWriter(buildGovernanceAuditEvent({
      stage: "executed_and_verified",
      organizationId: input.organizationId,
      actorId: input.actorId,
      changeRequestId: change.id,
      subjectId: change.id,
      details: { targetScope: change.targetScope, versioned: change.targetScope !== "provider" },
    }));
    return getChangeForOrganization(input.organizationId, change.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende uitvoeringsfout.";
    await db
      .update(changeRequests)
      .set({ status: "failed", updatedAt: new Date() })
      .where(and(eq(changeRequests.id, change.id), eq(changeRequests.organizationId, input.organizationId)));
    await governanceAuditWriter(buildGovernanceAuditEvent({
      stage: "execution_failed",
      organizationId: input.organizationId,
      actorId: input.actorId,
      changeRequestId: change.id,
      subjectId: change.id,
      details: { targetScope: change.targetScope, message },
    }));
    throw error;
  }
}

export async function decideStructuralChange(input: {
  organizationId: number;
  changeId: number;
  decidedBy: number;
  decision: "approved" | "rejected";
  comment?: string;
}) {
  const db = await requireDb();
  const change = await getChangeForOrganization(input.organizationId, input.changeId);
  if (!change || change.changeType !== "structural" || change.status !== "pending_approval") {
    throw new Error("Deze structurele wijziging wacht niet op een beslissing binnen deze organisatie.");
  }
  await db.insert(changeApprovals).values({
    changeRequestId: change.id,
    organizationId: input.organizationId,
    decidedBy: input.decidedBy,
    decision: input.decision,
    comment: input.comment,
  });
  await db
    .update(changeRequests)
    .set({ status: input.decision === "approved" ? "approved" : "rejected", updatedAt: new Date() })
    .where(and(eq(changeRequests.id, change.id), eq(changeRequests.organizationId, input.organizationId)));
  await governanceAuditWriter(buildGovernanceAuditEvent({
    stage: input.decision,
    organizationId: input.organizationId,
    actorId: input.decidedBy,
    changeRequestId: change.id,
    subjectId: change.id,
    details: { comment: input.comment ?? null },
  }));
  return input.decision === "approved"
    ? applyApprovedChange({ organizationId: input.organizationId, changeId: change.id, actorId: input.decidedBy })
    : getChangeForOrganization(input.organizationId, change.id);
}

export async function rollbackChangeForOrganization(input: { organizationId: number; changeId: number; actorId: number }) {
  const db = await requireDb();
  const change = await getChangeForOrganization(input.organizationId, input.changeId);
  if (!change || change.status !== "verified" || change.targetScope === "provider") {
    throw new Error("Alleen een geverifieerde configuratiewijziging met snapshot kan worden teruggedraaid.");
  }
  const snapshots = await db
    .select()
    .from(configurationSnapshots)
    .where(and(eq(configurationSnapshots.organizationId, input.organizationId), eq(configurationSnapshots.changeRequestId, change.id)))
    .limit(1);
  const snapshot = snapshots[0];
  if (!snapshot || snapshot.restoredAt) throw new Error("Er is geen beschikbare pre-change snapshot voor rollback.");
  const original = snapshot.snapshot as { provider: "openai" | "anthropic" | "google"; model: string; systemPrompt: string; guardrails: string[]; version: number };
  await db
    .update(aiConfigurations)
    .set({
      provider: original.provider,
      model: original.model,
      systemPrompt: original.systemPrompt,
      guardrails: original.guardrails,
      version: original.version + 1,
      updatedBy: input.actorId,
      updatedAt: new Date(),
    })
    .where(and(eq(aiConfigurations.id, snapshot.configurationId), eq(aiConfigurations.organizationId, input.organizationId)));
  await db
    .update(configurationSnapshots)
    .set({ restoredAt: new Date(), restoredBy: input.actorId })
    .where(and(eq(configurationSnapshots.id, snapshot.id), eq(configurationSnapshots.organizationId, input.organizationId)));
  await db
    .update(changeRequests)
    .set({ status: "rolled_back", updatedAt: new Date() })
    .where(and(eq(changeRequests.id, change.id), eq(changeRequests.organizationId, input.organizationId)));
  await governanceAuditWriter(buildGovernanceAuditEvent({
    stage: "rolled_back",
    organizationId: input.organizationId,
    actorId: input.actorId,
    changeRequestId: change.id,
    subjectType: "configuration_snapshot",
    subjectId: snapshot.id,
    details: { configurationId: snapshot.configurationId, restoredVersion: original.version + 1 },
  }));
  return getChangeForOrganization(input.organizationId, change.id);
}

export async function getWorkspaceOverview(organizationId: number) {
  const db = await requireDb();
  const [customer, platform, changes, audits, providers] = await Promise.all([
    getConfigurationForOrganization(organizationId, "customer"),
    getConfigurationForOrganization(organizationId, "platform"),
    db.select().from(changeRequests).where(eq(changeRequests.organizationId, organizationId)),
    db.select().from(auditEvents).where(eq(auditEvents.organizationId, organizationId)),
    getProviderSettingsForOrganization(organizationId),
  ]);
  return {
    configurations: { customer, platform },
    counts: {
      changes: changes.length,
      pendingApprovals: changes.filter((change) => change.status === "pending_approval").length,
      verifiedChanges: changes.filter((change) => change.status === "verified").length,
      auditEvents: audits.length,
      providerSettings: providers.length,
    },
    operationalChecks: [
      { id: "tenant-boundary", label: "Tenantgrenzen worden server-side afgedwongen", status: "implemented" },
      { id: "provider-secrets", label: "Providercredentials blijven uitsluitend server-side", status: "implemented" },
      { id: "approval-flow", label: "Structurele wijzigingen vereisen een adminbeslissing", status: "implemented" },
      { id: "signup-check", label: "Normale signup/magic-link opnieuw verifiëren", status: "remaining" },
      { id: "password-protection", label: "Leaked Password Protection in Supabase inschakelen", status: "remaining" },
    ],
  };
}

export type TenantMembership = { role: TenantRole };
