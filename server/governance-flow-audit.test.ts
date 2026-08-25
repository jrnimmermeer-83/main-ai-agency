import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyApprovedChange,
  createGovernedChange,
  decideStructuralChange,
  rollbackChangeForOrganization,
  setGovernanceTestDependenciesForTests,
} from "./db";

function createChain() {
  const where = vi.fn().mockResolvedValue([]);
  const set = vi.fn().mockReturnValue({ where });
  return { set, where };
}

function createFlowDb(selectResults: unknown[][]) {
  const inserts: unknown[] = [];
  const updates: ReturnType<typeof createChain>[] = [];
  const db = {
    insert: vi.fn(() => ({
      values: vi.fn(async (value: unknown) => {
        inserts.push(value);
        return [{ insertId: 31 }];
      }),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => selectResults.shift() ?? []),
        })),
      })),
    })),
    update: vi.fn(() => {
      const chain = createChain();
      updates.push(chain);
      return chain;
    }),
  };
  return { db, inserts, updates };
}

const safeChange = {
  id: 31,
  organizationId: 10,
  status: "validated",
  targetScope: "customer",
  proposedValue: {
    scope: "customer" as const,
    provider: "openai" as const,
    model: "gpt-5-mini",
    systemPrompt: "Escalate uncertain requests.",
    guardrails: ["Respect tenant boundaries"],
  },
};

describe("governance flow audit events", () => {
  const auditWriter = vi.fn(async () => undefined);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    setGovernanceTestDependenciesForTests();
  });

  it("records tenant and actor details when a Safe Change is created", async () => {
    const { db } = createFlowDb([[safeChange]]);
    setGovernanceTestDependenciesForTests({ db: db as never, auditWriter });
    await createGovernedChange({
      organizationId: 10,
      requestedBy: 7,
      source: "manual",
      changeType: "safe",
      targetScope: "customer",
      title: "Improve Customer AI guidance",
      rationale: "Clarify escalation.",
      proposedValue: safeChange.proposedValue,
    });
    expect(auditWriter).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 10, actorId: 7, changeRequestId: 31, action: "change.validated", outcome: "success" }));
  });

  it("records a structural rejection without executing the request", async () => {
    const structural = { ...safeChange, changeType: "structural", status: "pending_approval", targetScope: "provider" };
    const { db } = createFlowDb([[structural], [{ ...structural, status: "rejected" }]]);
    setGovernanceTestDependenciesForTests({ db: db as never, auditWriter });
    await decideStructuralChange({ organizationId: 10, changeId: 31, decidedBy: 8, decision: "rejected", comment: "Needs a provider review." });
    expect(auditWriter).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 10, actorId: 8, changeRequestId: 31, action: "change.rejected", outcome: "success" }));
  });

  it("records approval before it executes and verifies an approved Structural Change", async () => {
    const structural = {
      ...safeChange,
      changeType: "structural",
      status: "pending_approval",
      targetScope: "provider",
      proposedValue: { scope: "provider" as const, providerScope: "platform" as const, provider: "anthropic" as const, model: "claude-haiku-4-5", enabled: true },
    };
    const { db } = createFlowDb([[structural], [{ ...structural, status: "approved" }], [{ ...structural, status: "verified" }]]);
    setGovernanceTestDependenciesForTests({ db: db as never, auditWriter });
    await decideStructuralChange({ organizationId: 10, changeId: 31, decidedBy: 8, decision: "approved", comment: "Approved after provider review." });
    expect(auditWriter).toHaveBeenNthCalledWith(1, expect.objectContaining({ organizationId: 10, actorId: 8, changeRequestId: 31, action: "change.approved", outcome: "success" }));
    expect(auditWriter).toHaveBeenNthCalledWith(2, expect.objectContaining({ organizationId: 10, actorId: 8, changeRequestId: 31, action: "change.execution_started", outcome: "success" }));
    expect(auditWriter).toHaveBeenNthCalledWith(3, expect.objectContaining({ organizationId: 10, actorId: 8, changeRequestId: 31, action: "change.executed_and_verified", outcome: "success" }));
  });

  it("records execution start and verification for a supported Safe Change", async () => {
    const configuration = { id: 4, organizationId: 10, scope: "customer", provider: "openai", model: "gpt-5-mini", systemPrompt: "Old guidance", guardrails: ["Old guardrail"], version: 1 };
    const { db } = createFlowDb([[safeChange], [configuration], [{ ...safeChange, status: "verified" }]]);
    setGovernanceTestDependenciesForTests({ db: db as never, auditWriter });
    await applyApprovedChange({ organizationId: 10, changeId: 31, actorId: 7 });
    expect(auditWriter).toHaveBeenNthCalledWith(1, expect.objectContaining({ organizationId: 10, actorId: 7, changeRequestId: 31, action: "change.execution_started", outcome: "success" }));
    expect(auditWriter).toHaveBeenNthCalledWith(2, expect.objectContaining({ organizationId: 10, actorId: 7, changeRequestId: 31, action: "change.executed_and_verified", outcome: "success" }));
  });

  it("records a failed execution when the supported configuration target is absent", async () => {
    const { db } = createFlowDb([[safeChange], []]);
    setGovernanceTestDependenciesForTests({ db: db as never, auditWriter });
    await expect(applyApprovedChange({ organizationId: 10, changeId: 31, actorId: 7 })).rejects.toThrow("doelconfiguratie");
    expect(auditWriter).toHaveBeenNthCalledWith(1, expect.objectContaining({ action: "change.execution_started", outcome: "success" }));
    expect(auditWriter).toHaveBeenNthCalledWith(2, expect.objectContaining({ organizationId: 10, actorId: 7, changeRequestId: 31, action: "change.execution_failed", outcome: "failed" }));
  });

  it("records the snapshot subject and tenant context on rollback", async () => {
    const verified = { ...safeChange, status: "verified" };
    const snapshot = { id: 90, organizationId: 10, changeRequestId: 31, configurationId: 4, restoredAt: null, snapshot: { provider: "openai", model: "gpt-5-mini", systemPrompt: "Original guidance", guardrails: ["Original guardrail"], version: 1 } };
    const { db } = createFlowDb([[verified], [snapshot], [{ ...verified, status: "rolled_back" }]]);
    setGovernanceTestDependenciesForTests({ db: db as never, auditWriter });
    await rollbackChangeForOrganization({ organizationId: 10, changeId: 31, actorId: 9 });
    expect(auditWriter).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 10, actorId: 9, changeRequestId: 31, action: "change.rolled_back", subjectType: "configuration_snapshot", subjectId: 90, outcome: "success" }));
  });
});
