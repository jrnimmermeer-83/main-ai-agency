export const tenantRoles = ["owner", "admin", "operator", "viewer"] as const;
export type TenantRole = (typeof tenantRoles)[number];

export const supportedProviders = ["openai", "anthropic", "google"] as const;
export type SupportedProvider = (typeof supportedProviders)[number];

export type ChangeType = "safe" | "structural";
export type TargetScope = "customer" | "platform" | "provider";

export type ConfigurationProposal = {
  scope: TargetScope;
  providerScope?: "customer" | "platform";
  provider: SupportedProvider;
  model: string;
  systemPrompt?: string;
  guardrails?: string[];
  enabled?: boolean;
};

export function canOperate(role: TenantRole) {
  return role === "owner" || role === "admin" || role === "operator";
}

export function canApproveOrRollback(role: TenantRole) {
  return role === "owner" || role === "admin";
}

export function hasActiveOrganizationContext(activeOrganizationId: number | undefined, requestedOrganizationId: number) {
  return activeOrganizationId === requestedOrganizationId;
}

export function canExecuteGovernedChange(status: string) {
  return status === "validated" || status === "approved";
}

export function canDecideStructuralChange(changeType: ChangeType, status: string, role: TenantRole) {
  return changeType === "structural" && status === "pending_approval" && canApproveOrRollback(role);
}

export function canRollbackGovernedChange(status: string, targetScope: TargetScope, snapshotAlreadyRestored: boolean) {
  return status === "verified" && targetScope !== "provider" && !snapshotAlreadyRestored;
}

export type GovernanceAuditStage =
  | "validated"
  | "requested_for_approval"
  | "approved"
  | "rejected"
  | "execution_started"
  | "executed_and_verified"
  | "execution_failed"
  | "rolled_back";

const auditStageDetails: Record<GovernanceAuditStage, { action: string; outcome: "success" | "failed" }> = {
  validated: { action: "change.validated", outcome: "success" },
  requested_for_approval: { action: "change.requested_for_approval", outcome: "success" },
  approved: { action: "change.approved", outcome: "success" },
  rejected: { action: "change.rejected", outcome: "success" },
  execution_started: { action: "change.execution_started", outcome: "success" },
  executed_and_verified: { action: "change.executed_and_verified", outcome: "success" },
  execution_failed: { action: "change.execution_failed", outcome: "failed" },
  rolled_back: { action: "change.rolled_back", outcome: "success" },
};

export function buildGovernanceAuditEvent(input: {
  stage: GovernanceAuditStage;
  organizationId: number;
  actorId: number;
  changeRequestId: number;
  subjectId: number;
  subjectType?: string;
  details: Record<string, unknown>;
}) {
  const stage = auditStageDetails[input.stage];
  return {
    organizationId: input.organizationId,
    actorId: input.actorId,
    changeRequestId: input.changeRequestId,
    action: stage.action,
    subjectType: input.subjectType ?? "change_request",
    subjectId: input.subjectId,
    outcome: stage.outcome,
    details: input.details,
  };
}

export function classifyProposal(proposal: ConfigurationProposal): ChangeType {
  return proposal.scope === "provider" ? "structural" : "safe";
}

export function validateProposal(proposal: ConfigurationProposal) {
  const checks: string[] = [];

  if (!supportedProviders.includes(proposal.provider)) {
    checks.push("De geselecteerde provider wordt niet ondersteund.");
  }
  if (!proposal.model.trim()) {
    checks.push("Een modelnaam is vereist.");
  }

  if (proposal.scope === "provider") {
    if (typeof proposal.enabled !== "boolean") {
      checks.push("Providerwijzigingen vereisen een expliciete enabled-waarde.");
    }
    if (proposal.providerScope !== "customer" && proposal.providerScope !== "platform") {
      checks.push("Providerwijzigingen vereisen een Customer AI- of Platform AI-doel.");
    }
  } else {
    if (!proposal.systemPrompt?.trim()) {
      checks.push("Een systeemprompt is vereist voor configuratiewijzigingen.");
    }
    if (!proposal.guardrails || proposal.guardrails.length === 0) {
      checks.push("Ten minste één guardrail is vereist.");
    }
    if ((proposal.guardrails ?? []).some((guardrail) => !guardrail.trim())) {
      checks.push("Guardrails mogen niet leeg zijn.");
    }
  }

  return {
    passed: checks.length === 0,
    checks: checks.length === 0 ? ["Het wijzigingsvoorstel voldoet aan de ondersteunde contracten."] : checks,
    classifiedAs: classifyProposal(proposal),
  };
}

export function redactProposalForAudit(proposal: ConfigurationProposal) {
  return {
    scope: proposal.scope,
    providerScope: proposal.providerScope,
    provider: proposal.provider,
    model: proposal.model,
    hasSystemPrompt: Boolean(proposal.systemPrompt?.trim()),
    guardrailCount: proposal.guardrails?.length ?? 0,
    enabled: proposal.enabled,
  };
}
