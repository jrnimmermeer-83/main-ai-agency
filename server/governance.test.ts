import { describe, expect, it } from "vitest";
import {
  buildGovernanceAuditEvent,
  canApproveOrRollback,
  canDecideStructuralChange,
  canExecuteGovernedChange,
  canOperate,
  canRollbackGovernedChange,
  classifyProposal,
  hasActiveOrganizationContext,
  validateProposal,
} from "./governance";

const customerProposal = {
  scope: "customer" as const,
  provider: "openai" as const,
  model: "gpt-5-mini",
  systemPrompt: "Be concise and escalate uncertainty.",
  guardrails: ["Respect tenant boundaries", "Never process credentials"],
};

describe("tenant authorization boundaries", () => {
  it("accepts only the currently active organization context", () => {
    expect(hasActiveOrganizationContext(44, 44)).toBe(true);
    expect(hasActiveOrganizationContext(44, 45)).toBe(false);
    expect(hasActiveOrganizationContext(undefined, 44)).toBe(false);
  });

  it("keeps viewer roles read-only and restricts administrator decisions", () => {
    expect(canOperate("owner")).toBe(true);
    expect(canOperate("operator")).toBe(true);
    expect(canOperate("viewer")).toBe(false);
    expect(canApproveOrRollback("admin")).toBe(true);
    expect(canApproveOrRollback("operator")).toBe(false);
  });
});

describe("governed change validation", () => {
  it("accepts only supported customer configuration changes as Safe Changes", () => {
    expect(classifyProposal(customerProposal)).toBe("safe");
    expect(validateProposal(customerProposal)).toEqual({
      passed: true,
      checks: ["Het wijzigingsvoorstel voldoet aan de ondersteunde contracten."],
      classifiedAs: "safe",
    });
  });

  it("requires a concrete Customer AI or Platform AI target for provider changes", () => {
    const invalidProviderProposal = { scope: "provider" as const, provider: "anthropic" as const, model: "claude-haiku-4-5", enabled: true };
    expect(validateProposal(invalidProviderProposal).passed).toBe(false);
    expect(validateProposal(invalidProviderProposal).checks).toContain("Providerwijzigingen vereisen een Customer AI- of Platform AI-doel.");
    expect(validateProposal({ ...invalidProviderProposal, providerScope: "platform" as const }).passed).toBe(true);
  });
});

describe("approval, execution, audit, and rollback lifecycle", () => {
  it("requires an administrator approval for a pending structural change", () => {
    expect(canDecideStructuralChange("structural", "pending_approval", "admin")).toBe(true);
    expect(canDecideStructuralChange("structural", "pending_approval", "operator")).toBe(false);
    expect(canDecideStructuralChange("safe", "pending_approval", "owner")).toBe(false);
  });

  it("allows execution only after safe validation or structural approval", () => {
    expect(canExecuteGovernedChange("validated")).toBe(true);
    expect(canExecuteGovernedChange("approved")).toBe(true);
    expect(canExecuteGovernedChange("pending_approval")).toBe(false);
    expect(canExecuteGovernedChange("rejected")).toBe(false);
  });

  it("permits one tenant-bound rollback only for a verified configuration snapshot", () => {
    expect(canRollbackGovernedChange("verified", "customer", false)).toBe(true);
    expect(canRollbackGovernedChange("verified", "provider", false)).toBe(false);
    expect(canRollbackGovernedChange("verified", "platform", true)).toBe(false);
    expect(canRollbackGovernedChange("approved", "customer", false)).toBe(false);
  });

  it("builds complete audit payloads for create, approval, execution, failure, and rollback flows", () => {
    const base = { organizationId: 10, actorId: 7, changeRequestId: 31, subjectId: 31, details: { targetScope: "customer" } };
    const created = buildGovernanceAuditEvent({ ...base, stage: "validated" });
    const approved = buildGovernanceAuditEvent({ ...base, stage: "approved" });
    const executed = buildGovernanceAuditEvent({ ...base, stage: "executed_and_verified" });
    const failed = buildGovernanceAuditEvent({ ...base, stage: "execution_failed" });
    const rolledBack = buildGovernanceAuditEvent({ ...base, stage: "rolled_back", subjectType: "configuration_snapshot" });

    expect(created).toMatchObject({ organizationId: 10, actorId: 7, changeRequestId: 31, action: "change.validated", outcome: "success" });
    expect(approved).toMatchObject({ action: "change.approved", outcome: "success" });
    expect(executed).toMatchObject({ action: "change.executed_and_verified", outcome: "success" });
    expect(failed).toMatchObject({ action: "change.execution_failed", outcome: "failed" });
    expect(rolledBack).toMatchObject({ action: "change.rolled_back", subjectType: "configuration_snapshot", subjectId: 31 });
  });
});
