import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { invokeLLM, listLLMModels } from "./_core/llm";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { COOKIE_NAME } from "../shared/const";
import {
  applyApprovedChange,
  consumeWebsiteChatQuota,
  createWebsiteLead,
  createWebsiteWidget,
  createGovernedChange,
  createOrganizationForUser,
  decideStructuralChange,
  getActiveOrganizationForUser,
  getConfigurationForOrganization,
  getMembershipForOrganization,
  getProviderSettingsForOrganization,
  getPublicWebsiteWidget,
  getWebsiteWidgetForOrganization,
  getWorkspaceOverview,
  listAuditEventsForOrganization,
  listChangesForOrganization,
  listOrganizationsForUser,
  listWebsiteLeadsForOrganization,
  rollbackChangeForOrganization,
  setActiveOrganizationForUser,
  updateWebsiteLeadStatus,
} from "./db";
import { canApproveOrRollback, canOperate, classifyProposal, hasActiveOrganizationContext, supportedProviders, validateProposal } from "./governance";
import { easyWielAssistantPrompt, easyWielFallbackAnswer } from "./easywielBot";

const organizationInput = z.object({ organizationId: z.number().int().positive() });
const proposalSchema = z.object({
  scope: z.enum(["customer", "platform", "provider"]),
  providerScope: z.enum(["customer", "platform"]).optional(),
  provider: z.enum(supportedProviders),
  model: z.string().trim().min(1).max(160),
  systemPrompt: z.string().trim().max(12000).optional(),
  guardrails: z.array(z.string().trim().min(1).max(500)).max(20).optional(),
  enabled: z.boolean().optional(),
});

async function requireTenantMembership(userId: number, organizationId: number) {
  const activeOrganization = await getActiveOrganizationForUser(userId);
  if (!hasActiveOrganizationContext(activeOrganization?.organization.id, organizationId)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Deze actie is alleen toegestaan binnen je actieve organisatiecontext.",
    });
  }
  const membership = await getMembershipForOrganization(userId, organizationId);
  if (!membership) throw new TRPCError({ code: "FORBIDDEN", message: "Je hebt geen toegang tot deze organisatie." });
  return membership;
}

async function requireOrganizationMembership(userId: number, organizationId: number) {
  const membership = await getMembershipForOrganization(userId, organizationId);
  if (!membership) throw new TRPCError({ code: "FORBIDDEN", message: "Je hebt geen toegang tot deze organisatie." });
  return membership;
}

async function requireOperator(userId: number, organizationId: number) {
  const membership = await requireTenantMembership(userId, organizationId);
  if (!canOperate(membership.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Je rol mag geen tenantconfiguratie wijzigen." });
  }
  return membership;
}

async function requireAdministrator(userId: number, organizationId: number) {
  const membership = await requireTenantMembership(userId, organizationId);
  if (!canApproveOrRollback(membership.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Alleen een organisatiebeheerder mag deze actie uitvoeren." });
  }
  return membership;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(ctx.req), maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  organizations: router({
    list: protectedProcedure.query(({ ctx }) => listOrganizationsForUser(ctx.user.id)),
    create: protectedProcedure
      .input(z.object({ name: z.string().trim().min(3).max(160), slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]+$/).min(3).max(160) }))
      .mutation(({ ctx, input }) => createOrganizationForUser(ctx.user.id, input.name, input.slug)),
    active: protectedProcedure.query(({ ctx }) => getActiveOrganizationForUser(ctx.user.id)),
    setActive: protectedProcedure.input(organizationInput).mutation(async ({ ctx, input }) => {
      await requireOrganizationMembership(ctx.user.id, input.organizationId);
      return setActiveOrganizationForUser(ctx.user.id, input.organizationId);
    }),
    context: protectedProcedure.input(organizationInput).query(async ({ ctx, input }) => {
      const membership = await requireTenantMembership(ctx.user.id, input.organizationId);
      return { organizationId: input.organizationId, role: membership.role };
    }),
  }),
  configurations: router({
    list: protectedProcedure.input(organizationInput).query(async ({ ctx, input }) => {
      await requireTenantMembership(ctx.user.id, input.organizationId);
      const [customer, platform] = await Promise.all([
        getConfigurationForOrganization(input.organizationId, "customer"),
        getConfigurationForOrganization(input.organizationId, "platform"),
      ]);
      return { customer, platform };
    }),
  }),
  workspace: router({
    overview: protectedProcedure.input(organizationInput).query(async ({ ctx, input }) => {
      await requireTenantMembership(ctx.user.id, input.organizationId);
      return getWorkspaceOverview(input.organizationId);
    }),
    health: protectedProcedure.input(organizationInput).query(async ({ ctx, input }) => {
      await requireTenantMembership(ctx.user.id, input.organizationId);
      const overview = await getWorkspaceOverview(input.organizationId);
      return { status: "operational" as const, ...overview };
    }),
  }),
  changes: router({
    list: protectedProcedure.input(organizationInput).query(async ({ ctx, input }) => {
      await requireTenantMembership(ctx.user.id, input.organizationId);
      return listChangesForOrganization(input.organizationId);
    }),
    history: protectedProcedure.input(organizationInput).query(async ({ ctx, input }) => {
      await requireTenantMembership(ctx.user.id, input.organizationId);
      return listAuditEventsForOrganization(input.organizationId);
    }),
    create: protectedProcedure
      .input(organizationInput.extend({
        title: z.string().trim().min(3).max(200),
        rationale: z.string().trim().min(3).max(3000),
        source: z.enum(["manual", "agent"]).default("manual"),
        proposedValue: proposalSchema,
      }))
      .mutation(async ({ ctx, input }) => {
        await requireOperator(ctx.user.id, input.organizationId);
        const changeType = classifyProposal(input.proposedValue);
        return createGovernedChange({
          organizationId: input.organizationId,
          requestedBy: ctx.user.id,
          source: input.source,
          changeType,
          targetScope: input.proposedValue.scope,
          title: input.title,
          rationale: input.rationale,
          proposedValue: input.proposedValue,
        });
      }),
    executeSafe: protectedProcedure
      .input(organizationInput.extend({ changeId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        await requireOperator(ctx.user.id, input.organizationId);
        return applyApprovedChange({ organizationId: input.organizationId, changeId: input.changeId, actorId: ctx.user.id });
      }),
    decide: protectedProcedure
      .input(organizationInput.extend({ changeId: z.number().int().positive(), decision: z.enum(["approved", "rejected"]), comment: z.string().trim().max(1000).optional() }))
      .mutation(async ({ ctx, input }) => {
        await requireAdministrator(ctx.user.id, input.organizationId);
        return decideStructuralChange({ organizationId: input.organizationId, changeId: input.changeId, decidedBy: ctx.user.id, decision: input.decision, comment: input.comment });
      }),
    rollback: protectedProcedure
      .input(organizationInput.extend({ changeId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        await requireAdministrator(ctx.user.id, input.organizationId);
        return rollbackChangeForOrganization({ organizationId: input.organizationId, changeId: input.changeId, actorId: ctx.user.id });
      }),
  }),
  providers: router({
    list: protectedProcedure.input(organizationInput).query(async ({ ctx, input }) => {
      await requireTenantMembership(ctx.user.id, input.organizationId);
      return getProviderSettingsForOrganization(input.organizationId);
    }),
    models: protectedProcedure.query(async () => {
      const { data } = await listLLMModels();
      return data.map((model) => ({ id: model.id }));
    }),
  }),
  website: router({
    widget: protectedProcedure.input(organizationInput).query(async ({ ctx, input }) => {
      await requireTenantMembership(ctx.user.id, input.organizationId);
      return getWebsiteWidgetForOrganization(input.organizationId);
    }),
    createWidget: protectedProcedure.input(organizationInput.extend({ name: z.string().trim().min(3).max(120), allowedOrigins: z.array(z.string().url().max(300)).min(1).max(5) })).mutation(async ({ ctx, input }) => {
      await requireAdministrator(ctx.user.id, input.organizationId);
      return createWebsiteWidget({ organizationId: input.organizationId, createdBy: ctx.user.id, name: input.name, allowedOrigins: input.allowedOrigins.map((value) => new URL(value).origin) });
    }),
    leads: protectedProcedure.input(organizationInput).query(async ({ ctx, input }) => {
      await requireTenantMembership(ctx.user.id, input.organizationId);
      return listWebsiteLeadsForOrganization(input.organizationId);
    }),
    updateLeadStatus: protectedProcedure.input(organizationInput.extend({ leadId: z.number().int().positive(), status: z.enum(["new", "in_progress", "contacted", "closed"]) })).mutation(async ({ ctx, input }) => {
      await requireOperator(ctx.user.id, input.organizationId);
      await updateWebsiteLeadStatus({ organizationId: input.organizationId, leadId: input.leadId, status: input.status, actorId: ctx.user.id });
      return { success: true };
    }),
  }),
  publicWidget: router({
    config: publicProcedure.input(z.object({ publicId: z.string().trim().min(8).max(64), sourceUrl: z.string().url().max(1000) })).query(async ({ input }) => {
      const widget = await getPublicWebsiteWidget(input.publicId, input.sourceUrl);
      return { name: widget.name, publicId: widget.publicId };
    }),
    chat: publicProcedure.input(z.object({ publicId: z.string().trim().min(8).max(64), sourceUrl: z.string().url().max(1000), sessionKey: z.string().trim().min(16).max(80), message: z.string().trim().min(1).max(1000) })).mutation(async ({ input }) => {
      const widget = await getPublicWebsiteWidget(input.publicId, input.sourceUrl);
      await consumeWebsiteChatQuota(widget.id, input.sessionKey);
      try {
        const { data: models } = await listLLMModels();
        const model = models.find((candidate) => candidate.id === "gpt-5-mini")?.id ?? models[0]?.id;
        if (!model) throw new Error("Geen AI-model beschikbaar.");
        const response = await invokeLLM({ model, messages: [{ role: "system", content: easyWielAssistantPrompt }, { role: "user", content: input.message }] });
        const reply = response.choices[0]?.message.content;
        if (!reply || typeof reply !== "string") throw new Error("Leeg antwoord.");
        return { reply, usedFallback: false };
      } catch {
        return { reply: easyWielFallbackAnswer(input.message), usedFallback: true };
      }
    }),
    createLead: publicProcedure.input(z.object({ publicId: z.string().trim().min(8).max(64), sourceUrl: z.string().url().max(1000), sessionKey: z.string().trim().min(16).max(80), consent: z.literal(true), intent: z.enum(["purchase", "fleet", "service", "general"]), name: z.string().trim().min(2).max(160), email: z.string().trim().email().max(320), phone: z.string().trim().max(40).optional(), message: z.string().trim().min(4).max(3000) })).mutation(async ({ input }) => {
      const widget = await getPublicWebsiteWidget(input.publicId, input.sourceUrl);
      await consumeWebsiteChatQuota(widget.id, input.sessionKey);
      const leadId = await createWebsiteLead({ widgetId: widget.id, organizationId: widget.organizationId, intent: input.intent, name: input.name, email: input.email.toLowerCase(), phone: input.phone, message: input.message, sourceUrl: input.sourceUrl });
      return { success: true, leadId };
    }),
  }),
  agent: router({
    propose: protectedProcedure
      .input(organizationInput.extend({ request: z.string().trim().min(8).max(3000) }))
      .mutation(async ({ ctx, input }) => {
        await requireOperator(ctx.user.id, input.organizationId);
        const { data: models } = await listLLMModels();
        const model = models.find((candidate) => candidate.id === "gpt-5-mini")?.id ?? models[0]?.id;
        const response = await invokeLLM({
          model,
          messages: [
            {
              role: "system",
              content: "Je bent de Platform AI Agent in een beveiligde tenantadministratie. Lever uitsluitend een wijzigingsvoorstel. Je mag nooit credentials verwerken, een wijziging uitvoeren, een approval simuleren of de governance omzeilen. Kies scope provider uitsluitend wanneer een providerinstelling verandert; die scope is altijd structureel en vereist providerScope customer of platform. Voor customer en platform moet je een systeemprompt en minstens één guardrail voorstellen. Reageer uitsluitend als geldig JSON volgens het schema.",
            },
            { role: "user", content: input.request },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "governed_change_proposal",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  rationale: { type: "string" },
                  assistantMessage: { type: "string" },
                  proposedValue: {
                    type: "object",
                    properties: {
                      scope: { type: "string", enum: ["customer", "platform", "provider"] },
                      providerScope: { type: "string", enum: ["customer", "platform"] },
                      provider: { type: "string", enum: ["openai", "anthropic", "google"] },
                      model: { type: "string" },
                      systemPrompt: { type: "string" },
                      guardrails: { type: "array", items: { type: "string" } },
                      enabled: { type: "boolean" },
                    },
                    required: ["scope", "provider", "model"],
                    additionalProperties: false,
                  },
                },
                required: ["title", "rationale", "assistantMessage", "proposedValue"],
                additionalProperties: false,
              },
            },
          },
        });
        const content = response.choices[0]?.message.content;
        if (!content || typeof content !== "string") {
          throw new TRPCError({ code: "BAD_GATEWAY", message: "De agent gaf geen bruikbaar JSON-voorstel terug." });
        }
        const parsed = z.object({ title: z.string().min(3).max(200), rationale: z.string().min(3).max(3000), assistantMessage: z.string().min(3).max(3000), proposedValue: proposalSchema }).parse(JSON.parse(content));
        const validation = validateProposal(parsed.proposedValue);
        if (!validation.passed) throw new TRPCError({ code: "BAD_REQUEST", message: validation.checks.join(" ") });
        const change = await createGovernedChange({
          organizationId: input.organizationId,
          requestedBy: ctx.user.id,
          source: "agent",
          changeType: classifyProposal(parsed.proposedValue),
          targetScope: parsed.proposedValue.scope,
          title: parsed.title,
          rationale: parsed.rationale,
          proposedValue: parsed.proposedValue,
        });
        return { assistantMessage: parsed.assistantMessage, proposal: change };
      }),
  }),
});

export type AppRouter = typeof appRouter;
