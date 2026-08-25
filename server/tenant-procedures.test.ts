import { describe, expect, it, beforeEach, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMock = vi.hoisted(() => ({
  applyApprovedChange: vi.fn(),
  createGovernedChange: vi.fn(),
  createOrganizationForUser: vi.fn(),
  decideStructuralChange: vi.fn(),
  getActiveOrganizationForUser: vi.fn(),
  getConfigurationForOrganization: vi.fn(),
  getMembershipForOrganization: vi.fn(),
  getProviderSettingsForOrganization: vi.fn(),
  getWorkspaceOverview: vi.fn(),
  listAuditEventsForOrganization: vi.fn(),
  listChangesForOrganization: vi.fn(),
  listOrganizationsForUser: vi.fn(),
  rollbackChangeForOrganization: vi.fn(),
  setActiveOrganizationForUser: vi.fn(),
}));

vi.mock("./db", () => dbMock);

import { appRouter } from "./routers";

function context(): TrpcContext {
  return {
    user: {
      id: 7,
      openId: "tenant-test-user",
      email: "tenant-test@example.com",
      name: "Tenant Test User",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("tenant-scoped tRPC procedures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.getActiveOrganizationForUser.mockResolvedValue({ organization: { id: 10, name: "Alpha" }, membershipRole: "admin" });
    dbMock.getMembershipForOrganization.mockResolvedValue({ organizationId: 10, userId: 7, role: "admin" });
    dbMock.getConfigurationForOrganization.mockResolvedValue({ id: 1, organizationId: 10, scope: "customer" });
    dbMock.getWorkspaceOverview.mockResolvedValue({ counts: {}, configurations: {}, operationalChecks: [] });
    dbMock.createGovernedChange.mockResolvedValue({ id: 22, status: "validated" });
    dbMock.decideStructuralChange.mockResolvedValue({ id: 23, status: "verified" });
    dbMock.rollbackChangeForOrganization.mockResolvedValue({ id: 24, status: "rolled_back" });
    dbMock.setActiveOrganizationForUser.mockResolvedValue({ organization: { id: 11, name: "Beta" }, membershipRole: "admin" });
  });

  it("rejects Customer AI and Platform AI configuration reads outside the active tenant", async () => {
    const caller = appRouter.createCaller(context());
    await expect(caller.configurations.list({ organizationId: 11 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(dbMock.getConfigurationForOrganization).not.toHaveBeenCalled();
  });

  it("allows a member to safely select another organization before acting in it", async () => {
    const caller = appRouter.createCaller(context());
    await expect(caller.organizations.setActive({ organizationId: 11 })).resolves.toMatchObject({ organization: { id: 11 } });
    expect(dbMock.getMembershipForOrganization).toHaveBeenCalledWith(7, 11);
    expect(dbMock.setActiveOrganizationForUser).toHaveBeenCalledWith(7, 11);
  });

  it("creates a Safe Change only through the active tenant context", async () => {
    const caller = appRouter.createCaller(context());
    await caller.changes.create({
      organizationId: 10,
      title: "Update Customer AI guidance",
      rationale: "Improve escalation clarity.",
      proposedValue: {
        scope: "customer",
        provider: "openai",
        model: "gpt-5-mini",
        systemPrompt: "Escalate uncertain requests.",
        guardrails: ["Respect tenant boundaries"],
      },
    });
    expect(dbMock.createGovernedChange).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 10, requestedBy: 7, changeType: "safe" }));
  });

  it("sends Structural Change decisions and rollback requests through the authorized tenant procedure", async () => {
    const caller = appRouter.createCaller(context());
    await caller.changes.decide({ organizationId: 10, changeId: 23, decision: "approved" });
    await caller.changes.rollback({ organizationId: 10, changeId: 24 });
    expect(dbMock.decideStructuralChange).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 10, decidedBy: 7, decision: "approved" }));
    expect(dbMock.rollbackChangeForOrganization).toHaveBeenCalledWith({ organizationId: 10, changeId: 24, actorId: 7 });
  });

  it("keeps provider requests structural and tenant-bound", async () => {
    const caller = appRouter.createCaller(context());
    await caller.changes.create({
      organizationId: 10,
      title: "Switch Platform AI provider",
      rationale: "Use a different approved model.",
      proposedValue: { scope: "provider", providerScope: "platform", provider: "anthropic", model: "claude-haiku-4-5", enabled: true },
    });
    expect(dbMock.createGovernedChange).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 10, changeType: "structural", targetScope: "provider" }));
  });
});
