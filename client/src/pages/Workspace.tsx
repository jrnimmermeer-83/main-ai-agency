import { AIChatBox, type Message } from "@/components/AIChatBox";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { AlertTriangle, ArrowRight, Bot, CheckCircle2, CircleDot, Clock3, FileCheck2, Loader2, Plus, RotateCcw, ShieldCheck, Sparkles, Waypoints } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type Section = "overview" | "chat" | "changes" | "approvals" | "history" | "health" | "rollback" | "providers";

const statusTone: Record<string, string> = {
  verified: "border-emerald-200 bg-emerald-50 text-emerald-700",
  approved: "border-cyan-200 bg-cyan-50 text-cyan-700",
  validated: "border-blue-200 bg-blue-50 text-blue-700",
  pending_approval: "border-amber-200 bg-amber-50 text-amber-700",
  requested: "border-slate-200 bg-slate-100 text-slate-600",
  rejected: "border-rose-200 bg-rose-50 text-rose-700",
  failed: "border-rose-200 bg-rose-50 text-rose-700",
  rolled_back: "border-violet-200 bg-violet-50 text-violet-700",
  implemented: "border-emerald-200 bg-emerald-50 text-emerald-700",
  remaining: "border-amber-200 bg-amber-50 text-amber-700",
};

const sectionCopy: Record<Section, { eyebrow: string; title: string; description: string }> = {
  overview: { eyebrow: "Delivery & readiness", title: "Build progress you can audit", description: "Track implementation status, operational follow-ups, and the state of governed tenant changes." },
  chat: { eyebrow: "Platform AI Agent", title: "Propose changes, never bypass them", description: "Natural-language requests are converted into validated proposals and remain subject to roles and governance." },
  changes: { eyebrow: "Safe change lifecycle", title: "Controlled configuration changes", description: "Create, validate, execute, and verify supported tenant configuration changes." },
  approvals: { eyebrow: "Structural changes", title: "Explicit approval required", description: "Only an authorized organization administrator can approve or reject a structural request." },
  history: { eyebrow: "Immutable audit trail", title: "Operational history", description: "Review actors, timestamps, outcomes, and change-specific audit details." },
  health: { eyebrow: "Operational readiness", title: "Control-plane health", description: "See the status of governance safeguards and remaining operational checks." },
  rollback: { eyebrow: "Controlled recovery", title: "Tenant-bound rollback", description: "Restore the pre-change snapshot for a verified supported configuration change." },
  providers: { eyebrow: "Provider governance", title: "Customer and platform provider settings", description: "Provider choices are tenant-scoped. Credentials stay server-side and are never rendered in this workspace." },
};

function StatusBadge({ status }: { status: string }) {
  return <Badge variant="outline" className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize", statusTone[status] ?? "border-slate-200 bg-slate-100 text-slate-600")}>{status.replaceAll("_", " ")}</Badge>;
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function SectionHeader({ section, organizationName, role }: { section: Section; organizationName: string; role: string }) {
  const copy = sectionCopy[section];
  return (
    <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-cyan-700">{copy.eyebrow}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">{copy.title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{copy.description}</p>
      </div>
      <div className="flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm md:self-auto">
        <span className="grid size-7 place-items-center rounded-lg bg-slate-950 text-xs font-semibold text-cyan-300">{organizationName.slice(0, 1).toUpperCase()}</span>
        <span className="text-sm font-medium text-slate-800">{organizationName}</span>
        <span className="text-xs text-slate-400">{role}</span>
      </div>
    </div>
  );
}

function OrganizationEmptyState() {
  const utils = trpc.useUtils();
  const create = trpc.organizations.create.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.organizations.list.invalidate(), utils.organizations.active.invalidate()]);
      toast.success("Organization created and selected as the active context.");
    },
    onError: (error) => toast.error(error.message),
  });
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate({ name, slug });
  };
  return (
    <DashboardLayout>
      <section className="mx-auto mt-12 max-w-2xl rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50 md:p-10">
        <div className="grid size-12 place-items-center rounded-2xl bg-cyan-100 text-cyan-800"><ShieldCheck className="size-6" /></div>
        <p className="mt-7 text-sm font-semibold text-cyan-700">Tenant onboarding</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Create your first organization</h1>
        <p className="mt-3 max-w-xl leading-6 text-slate-600">Every configuration, audit event, approval, and snapshot is scoped to a single organization. Creating one establishes your first active server-side tenant context.</p>
        <form onSubmit={submit} className="mt-8 grid gap-4">
          <label className="grid gap-2 text-sm font-medium text-slate-700">Organization name<Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Example: Northstar AI" required minLength={3} /></label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">Slug<Input value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="northstar-ai" required minLength={3} pattern="[a-z0-9-]+" /></label>
          <Button type="submit" disabled={create.isPending} className="mt-2 bg-slate-950 text-white hover:bg-slate-800">{create.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Create governed organization</Button>
        </form>
      </section>
    </DashboardLayout>
  );
}

function Overview({ overview, changes, onCreateSafe }: { overview: any; changes: any[]; onCreateSafe: () => void }) {
  const roadmap = [
    ["Tenant safety", "Server-side roles, active organization context, and organization-bound data", "implemented"],
    ["Controlled change flow", "Validation, execution, verification, audit events, and snapshots", "implemented"],
    ["Structural governance", "Explicit administrator approval or rejection before execution", "implemented"],
    ["Platform AI Agent", "AI creates governed proposals instead of direct changes", "implemented"],
    ["Operational checks", "Normal signup validation and leaked-password protection", "remaining"],
  ] as const;
  return <div className="grid gap-6">
    <section className="overflow-hidden rounded-3xl bg-slate-950 p-6 text-white shadow-2xl shadow-slate-900/15 md:p-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl"><div className="mb-5 flex size-11 items-center justify-center rounded-2xl bg-cyan-300 text-slate-950"><Waypoints className="size-5" /></div><p className="text-sm font-medium text-cyan-300">Delivery roadmap</p><h2 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">Governed configuration is now the product backbone.</h2><p className="mt-3 text-sm leading-6 text-slate-400">The next value is created through tenant-safe configuration changes that are validated, recorded, and recoverable.</p></div>
        <Button onClick={onCreateSafe} className="bg-cyan-300 text-slate-950 hover:bg-cyan-200"><Plus className="size-4" /> New Safe Change</Button>
      </div>
      <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{roadmap.map(([title, detail, status]) => <div key={title} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4"><StatusBadge status={status} /><p className="mt-4 text-sm font-semibold">{title}</p><p className="mt-2 text-xs leading-5 text-slate-400">{detail}</p></div>)}</div>
    </section>
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {[["Verified changes", overview?.counts.verifiedChanges ?? 0, FileCheck2, "Configuration changes with an execution record"], ["Pending approvals", overview?.counts.pendingApprovals ?? 0, Clock3, "Structural requests waiting for an administrator"], ["Audit events", overview?.counts.auditEvents ?? 0, ShieldCheck, "Immutable activity records in this tenant"], ["Provider settings", overview?.counts.providerSettings ?? 0, Sparkles, "Separate Customer AI and Platform AI choices"]].map(([label, value, Icon, detail]: any) => <article key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><p className="text-sm font-medium text-slate-500">{label}</p><span className="rounded-xl bg-slate-100 p-2 text-slate-700"><Icon className="size-4" /></span></div><p className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">{value}</p><p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p></article>)}
    </section>
    <section className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]"><article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="text-base font-semibold text-slate-900">Recent changes</h2><p className="mt-1 text-sm text-slate-500">Every change remains tied to an organization and actor.</p></div><StatusBadge status="implemented" /></div><div className="mt-5 divide-y divide-slate-100">{changes.slice(0, 4).length ? changes.slice(0, 4).map((entry: any) => <div key={entry.change.id} className="flex items-center gap-4 py-4"><span className="grid size-9 place-items-center rounded-xl bg-slate-100 text-slate-700"><CircleDot className="size-4" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-800">{entry.change.title}</p><p className="mt-1 text-xs text-slate-500">{entry.requester ?? "Workspace user"} · {formatDate(entry.change.createdAt)}</p></div><StatusBadge status={entry.change.status} /></div>) : <p className="py-8 text-sm text-slate-500">No changes have been requested in this organization yet.</p>}</div></article><article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-base font-semibold text-slate-900">Operational checks</h2><p className="mt-1 text-sm text-slate-500">Safeguards that remain visible after delivery.</p><div className="mt-5 grid gap-3">{overview?.operationalChecks?.map((check: any) => <div key={check.id} className="flex gap-3 rounded-xl bg-slate-50 p-3"><span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full", check.status === "implemented" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>{check.status === "implemented" ? <CheckCircle2 className="size-3" /> : <AlertTriangle className="size-3" />}</span><p className="text-sm leading-5 text-slate-600">{check.label}</p></div>)}</div></article></section>
  </div>;
}

function ChangeForm({ organizationId, onComplete }: { organizationId: number; onComplete: () => void }) {
  const [systemPrompt, setSystemPrompt] = useState("You are the Customer AI. Provide concise, helpful responses and escalate uncertainty.");
  const [guardrails, setGuardrails] = useState("Respect organization context\nDo not process credentials\nEscalate unsupported requests");
  const create = trpc.changes.create.useMutation({ onSuccess: () => { toast.success("Safe Change validated and ready for execution."); onComplete(); }, onError: (error) => toast.error(error.message) });
  const submit = (event: FormEvent) => { event.preventDefault(); create.mutate({ organizationId, title: "Update Customer AI guidance", rationale: "Refresh the supported Customer AI system guidance and guardrails.", proposedValue: { scope: "customer", provider: "openai", model: "gpt-5-mini", systemPrompt, guardrails: guardrails.split("\n").map((item) => item.trim()).filter(Boolean) } }); };
  return <form onSubmit={submit} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div><p className="text-sm font-semibold text-slate-900">New Safe Change</p><p className="mt-1 text-sm text-slate-500">This supported Customer AI configuration change is validated, then waits for an authorized operator to execute it.</p></div><label className="grid gap-2 text-sm font-medium text-slate-700">System prompt<Textarea value={systemPrompt} onChange={(event) => setSystemPrompt(event.target.value)} className="min-h-24" /></label><label className="grid gap-2 text-sm font-medium text-slate-700">Guardrails <span className="text-xs font-normal text-slate-400">One per line</span><Textarea value={guardrails} onChange={(event) => setGuardrails(event.target.value)} className="min-h-24" /></label><Button type="submit" disabled={create.isPending} className="justify-self-start bg-slate-950 text-white hover:bg-slate-800">{create.isPending ? <Loader2 className="size-4 animate-spin" /> : <FileCheck2 className="size-4" />} Validate Safe Change</Button></form>;
}

function ChangesList({ changes, organizationId, mode, onRefresh }: { changes: any[]; organizationId: number; mode: "changes" | "approvals" | "rollback"; onRefresh: () => void }) {
  const executeSafe = trpc.changes.executeSafe.useMutation({ onSuccess: () => { toast.success("Change executed and verified."); onRefresh(); }, onError: (error) => toast.error(error.message) });
  const decide = trpc.changes.decide.useMutation({ onSuccess: () => { toast.success("Structural change decision recorded."); onRefresh(); }, onError: (error) => toast.error(error.message) });
  const rollback = trpc.changes.rollback.useMutation({ onSuccess: () => { toast.success("Configuration restored from its pre-change snapshot."); onRefresh(); }, onError: (error) => toast.error(error.message) });
  const filtered = mode === "approvals" ? changes.filter((entry) => entry.change.status === "pending_approval") : mode === "rollback" ? changes.filter((entry) => entry.change.status === "verified" && entry.change.targetScope !== "provider") : changes;
  return <div className="grid gap-3">{filtered.length ? filtered.map((entry) => { const change = entry.change; return <article key={change.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><StatusBadge status={change.status} /><Badge variant="outline" className="rounded-full border-slate-200 bg-white text-slate-600">{change.changeType} · {change.targetScope}</Badge></div><h2 className="mt-3 text-base font-semibold text-slate-900">{change.title}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{change.rationale}</p><p className="mt-3 text-xs text-slate-500">Requested by {entry.requester ?? "Workspace user"} · {formatDate(change.createdAt)}</p></div><div className="flex shrink-0 flex-wrap gap-2">{mode === "changes" && change.status === "validated" ? <Button size="sm" onClick={() => executeSafe.mutate({ organizationId, changeId: change.id })} disabled={executeSafe.isPending} className="bg-slate-950 text-white hover:bg-slate-800">Execute Safe Change <ArrowRight className="size-3.5" /></Button> : null}{mode === "approvals" ? <><Button size="sm" onClick={() => decide.mutate({ organizationId, changeId: change.id, decision: "approved" })} disabled={decide.isPending} className="bg-emerald-600 text-white hover:bg-emerald-700">Approve</Button><Button size="sm" variant="outline" onClick={() => decide.mutate({ organizationId, changeId: change.id, decision: "rejected" })} disabled={decide.isPending} className="border-rose-200 text-rose-700 hover:bg-rose-50">Reject</Button></> : null}{mode === "rollback" ? <Button size="sm" variant="outline" onClick={() => rollback.mutate({ organizationId, changeId: change.id })} disabled={rollback.isPending} className="border-violet-200 text-violet-700 hover:bg-violet-50"><RotateCcw className="size-3.5" /> Restore snapshot</Button> : null}</div></div><details className="mt-4 rounded-xl bg-slate-50 p-3"><summary className="cursor-pointer text-xs font-semibold text-slate-600">Validation and proposed configuration</summary><pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs leading-5 text-slate-600">{JSON.stringify({ validation: change.validationResult, proposedValue: change.proposedValue }, null, 2)}</pre></details></article>; }) : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">No {mode === "approvals" ? "pending structural approvals" : mode === "rollback" ? "verified configuration changes available for rollback" : "changes"} in the active organization.</div>}</div>;
}

function Chat({ organizationId, onRefresh }: { organizationId: number; onRefresh: () => void }) {
  const [messages, setMessages] = useState<Message[]>([{ role: "system", content: "Governed Platform AI Agent" }, { role: "assistant", content: "Describe the configuration outcome you need. I will create a validated proposal; I will not execute a change or bypass an approval." }]);
  const propose = trpc.agent.propose.useMutation({ onSuccess: (result) => { setMessages((current) => [...current, { role: "assistant", content: `${result.assistantMessage}\n\n**Proposal #${result.proposal?.id ?? "new"}** is recorded in the governed change flow.` }]); onRefresh(); }, onError: (error) => { setMessages((current) => [...current, { role: "assistant", content: `I could not create a governed proposal: ${error.message}` }]); } });
  const onSendMessage = (content: string) => { setMessages((current) => [...current, { role: "user", content }]); propose.mutate({ organizationId, request: content }); };
  return <div className="grid gap-6 xl:grid-cols-[1fr_320px]"><AIChatBox messages={messages} onSendMessage={onSendMessage} isLoading={propose.isPending} height="650px" placeholder="Ask for a configuration proposal…" suggestedPrompts={["Improve the Customer AI escalation guidance", "Propose safer Platform AI guardrails", "Prepare a provider change for review"]} emptyStateMessage="Start a governed request" className="border-slate-200 shadow-sm" /><aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex size-10 items-center justify-center rounded-xl bg-cyan-100 text-cyan-800"><ShieldCheck className="size-5" /></div><h2 className="mt-4 font-semibold text-slate-900">Governance boundary</h2><p className="mt-2 text-sm leading-6 text-slate-600">The agent can only propose supported changes. It cannot access provider credentials, change your tenant context, approve structural work, or execute outside an authorized procedure.</p><div className="mt-5 grid gap-2">{["Tenant context required", "Proposal validation", "Approval for structural changes", "Server-side execution and audit"].map((item) => <div key={item} className="flex items-center gap-2 text-xs text-slate-600"><CheckCircle2 className="size-3.5 text-emerald-600" />{item}</div>)}</div></aside></div>;
}

function Providers({ organizationId, providers, onRefresh }: { organizationId: number; providers: any[]; onRefresh: () => void }) {
  const [scope, setScope] = useState<"customer" | "platform">("customer");
  const [provider, setProvider] = useState<"openai" | "anthropic" | "google">("openai");
  const [model, setModel] = useState("gpt-5-mini");
  const request = trpc.changes.create.useMutation({ onSuccess: () => { toast.success("Structural provider request submitted for administrator approval."); onRefresh(); }, onError: (error) => toast.error(error.message) });
  const submit = (event: FormEvent) => { event.preventDefault(); request.mutate({ organizationId, title: `Update ${scope === "customer" ? "Customer AI" : "Platform AI"} provider`, rationale: "Provider configuration is structural and requires an authorized administrator decision before server-side execution.", proposedValue: { scope: "provider", providerScope: scope, provider, model, enabled: true } }); };
  return <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]"><section className="grid gap-3">{["customer", "platform"].map((providerScope) => { const setting = providers.find((item) => item.scope === providerScope); return <article key={providerScope} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{providerScope} AI</p><h2 className="mt-2 text-lg font-semibold text-slate-900">{setting?.provider ?? "No provider"}</h2><p className="mt-1 text-sm text-slate-500">{setting?.model ?? "No model configured"}</p></div><StatusBadge status={setting?.enabled ? "implemented" : "remaining"} /></div><div className="mt-6 rounded-xl bg-slate-50 p-4"><p className="text-xs font-semibold text-slate-700">Credential boundary</p><p className="mt-1 text-sm text-slate-500">Credentials are server-side only. This workspace stores no API keys and never sends them to the browser.</p></div></article>; })}</section><form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex size-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700"><Sparkles className="size-5" /></div><h2 className="mt-4 text-lg font-semibold text-slate-900">Request provider change</h2><p className="mt-2 text-sm leading-6 text-slate-600">Changing the enabled provider or model is structural. It creates a pending request; an administrator must explicitly approve it before execution.</p><div className="mt-6 grid gap-4"><label className="grid gap-2 text-sm font-medium text-slate-700">AI scope<select value={scope} onChange={(event) => setScope(event.target.value as "customer" | "platform")} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"><option value="customer">Customer AI</option><option value="platform">Platform AI</option></select></label><label className="grid gap-2 text-sm font-medium text-slate-700">Provider<select value={provider} onChange={(event) => setProvider(event.target.value as "openai" | "anthropic" | "google")} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"><option value="openai">OpenAI</option><option value="anthropic">Anthropic</option><option value="google">Google</option></select></label><label className="grid gap-2 text-sm font-medium text-slate-700">Model<Input value={model} onChange={(event) => setModel(event.target.value)} placeholder="gpt-5-mini" /></label></div><Button type="submit" disabled={request.isPending} className="mt-6 bg-slate-950 text-white hover:bg-slate-800">{request.isPending ? <Loader2 className="size-4 animate-spin" /> : <FileCheck2 className="size-4" />} Submit structural request</Button></form></div>;
}

export default function Workspace({ section }: { section: Section }) {
  const utils = trpc.useUtils();
  const organizations = trpc.organizations.list.useQuery();
  const active = trpc.organizations.active.useQuery();
  const [organizationId, setOrganizationId] = useState(0);
  useEffect(() => { if (active.data?.organization.id) setOrganizationId(active.data.organization.id); }, [active.data?.organization.id]);
  const hasContext = organizationId > 0;
  const overview = trpc.workspace.overview.useQuery({ organizationId }, { enabled: hasContext });
  const changes = trpc.changes.list.useQuery({ organizationId }, { enabled: hasContext });
  const history = trpc.changes.history.useQuery({ organizationId }, { enabled: hasContext });
  const providers = trpc.providers.list.useQuery({ organizationId }, { enabled: hasContext });
  const setActive = trpc.organizations.setActive.useMutation({ onSuccess: async () => { await Promise.all([utils.organizations.active.invalidate(), utils.workspace.overview.invalidate(), utils.changes.list.invalidate(), utils.changes.history.invalidate(), utils.providers.list.invalidate()]); toast.success("Active organization context updated."); }, onError: (error) => toast.error(error.message) });
  const refresh = () => { void Promise.all([utils.workspace.overview.invalidate(), utils.changes.list.invalidate(), utils.changes.history.invalidate(), utils.providers.list.invalidate(), utils.configurations.list.invalidate()]); };
  const orgList = organizations.data ?? [];
  const activeData = active.data;
  const role = activeData?.membershipRole ?? "—";
  const organizationName = activeData?.organization.name ?? "Organization";
  const [showChangeForm, setShowChangeForm] = useState(false);

  if (organizations.isLoading || active.isLoading) return <DashboardLayout><div className="grid min-h-[50vh] place-items-center text-slate-500"><Loader2 className="size-6 animate-spin" /></div></DashboardLayout>;
  if (!orgList.length || !activeData) return <OrganizationEmptyState />;

  return <DashboardLayout><div className="mb-6 flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-slate-500">Active server-side organization context</p><label className="flex items-center gap-2 text-sm font-medium text-slate-700">Organization<select value={organizationId} onChange={(event) => setActive.mutate({ organizationId: Number(event.target.value) })} disabled={setActive.isPending} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm">{orgList.map((item) => <option key={item.organization.id} value={item.organization.id}>{item.organization.name} · {item.membershipRole}</option>)}</select></label></div><SectionHeader section={section} organizationName={organizationName} role={role} />{section === "overview" ? <><Overview overview={overview.data} changes={changes.data ?? []} onCreateSafe={() => setShowChangeForm(true)} />{showChangeForm ? <div className="mt-6"><ChangeForm organizationId={organizationId} onComplete={() => { setShowChangeForm(false); refresh(); }} /></div> : null}</> : null}{section === "changes" ? <div className="grid gap-6"><ChangeForm organizationId={organizationId} onComplete={refresh} /><ChangesList changes={changes.data ?? []} organizationId={organizationId} mode="changes" onRefresh={refresh} /></div> : null}{section === "approvals" ? <ChangesList changes={changes.data ?? []} organizationId={organizationId} mode="approvals" onRefresh={refresh} /> : null}{section === "rollback" ? <ChangesList changes={changes.data ?? []} organizationId={organizationId} mode="rollback" onRefresh={refresh} /> : null}{section === "chat" ? <Chat organizationId={organizationId} onRefresh={refresh} /> : null}{section === "providers" ? <Providers organizationId={organizationId} providers={providers.data ?? []} onRefresh={refresh} /> : null}{section === "history" ? <div className="grid gap-3">{history.data?.length ? history.data.map((entry) => <article key={entry.event.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center"><span className="grid size-10 place-items-center rounded-xl bg-slate-100 text-slate-700"><ShieldCheck className="size-4" /></span><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-800">{entry.event.action}</p><p className="mt-1 text-xs text-slate-500">{entry.actorName ?? "Workspace user"} · {formatDate(entry.event.createdAt)} · {entry.event.subjectType}</p></div><StatusBadge status={entry.event.outcome} /><details className="text-xs text-slate-500"><summary className="cursor-pointer">Details</summary><pre className="mt-2 max-w-md overflow-x-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-2">{JSON.stringify(entry.event.details, null, 2)}</pre></details></article>) : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">Audit events will appear as soon as this organization is used.</div>}</div> : null}{section === "health" ? <div className="grid gap-4 md:grid-cols-2">{overview.data?.operationalChecks?.map((check: any) => <article key={check.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-start justify-between"><div className={cn("grid size-10 place-items-center rounded-xl", check.status === "implemented" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>{check.status === "implemented" ? <CheckCircle2 className="size-5" /> : <AlertTriangle className="size-5" />}</div><StatusBadge status={check.status} /></div><p className="mt-5 text-base font-semibold text-slate-900">{check.label}</p><p className="mt-2 text-sm leading-6 text-slate-500">{check.status === "implemented" ? "This safeguard is represented in the server-side governance flow." : "This operational verification remains visible until it is completed in the provider environment."}</p></article>)}</div> : null}</DashboardLayout>;
}
