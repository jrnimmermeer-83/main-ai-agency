import { beforeEach, describe, expect, it, vi } from "vitest";

const insert = vi.hoisted(() => vi.fn());
const values = vi.hoisted(() => vi.fn());

vi.mock("drizzle-orm/mysql2", () => ({
  drizzle: vi.fn(() => ({ insert })),
}));

describe("persistent governance audit events", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.DATABASE_URL = "mysql://test:password@localhost:3306/governance";
    insert.mockReturnValue({ values });
    values.mockResolvedValue(undefined);
  });

  it("persists actor, tenant, action, outcome, and change reference for every core lifecycle stage", async () => {
    const { recordAuditEvent } = await import("./db");
    const shared = { organizationId: 10, actorId: 7, changeRequestId: 31, subjectType: "change_request", subjectId: 31 };
    const events = [
      { ...shared, action: "change.validated", outcome: "success" as const, details: { changeType: "safe", targetScope: "customer" } },
      { ...shared, action: "change.approved", outcome: "success" as const, details: { comment: "Reviewed by administrator" } },
      { ...shared, action: "change.executed_and_verified", outcome: "success" as const, details: { targetScope: "customer", versioned: true } },
      { ...shared, action: "change.rolled_back", outcome: "success" as const, details: { configurationId: 4, restoredVersion: 3 } },
    ];

    for (const event of events) await recordAuditEvent(event);

    expect(insert).toHaveBeenCalledTimes(4);
    expect(values).toHaveBeenNthCalledWith(1, expect.objectContaining({ organizationId: 10, actorId: 7, changeRequestId: 31, action: "change.validated", outcome: "success" }));
    expect(values).toHaveBeenNthCalledWith(2, expect.objectContaining({ action: "change.approved", details: { comment: "Reviewed by administrator" } }));
    expect(values).toHaveBeenNthCalledWith(3, expect.objectContaining({ action: "change.executed_and_verified", details: { targetScope: "customer", versioned: true } }));
    expect(values).toHaveBeenNthCalledWith(4, expect.objectContaining({ action: "change.rolled_back", details: { configurationId: 4, restoredVersion: 3 } }));
  });

  it("keeps denied and failed outcomes explicit rather than silently recording success", async () => {
    const { recordAuditEvent } = await import("./db");
    await recordAuditEvent({
      organizationId: 10,
      actorId: 7,
      action: "change.execution_failed",
      subjectType: "change_request",
      subjectId: 31,
      changeRequestId: 31,
      outcome: "failed",
      details: { message: "Configuration target was unavailable" },
    });
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ outcome: "failed", action: "change.execution_failed" }));
  });
});
