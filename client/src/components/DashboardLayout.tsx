import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { startLogin } from "@/const";
import {
  Activity,
  Bot,
  CheckCircle2,
  ClipboardList,
  History,
  LayoutDashboard,
  LogOut,
  RotateCcw,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import { useLocation } from "wouter";

const menuItems = [
  { icon: LayoutDashboard, label: "Overview", path: "/" },
  { icon: Bot, label: "Chat", path: "/chat" },
  { icon: ClipboardList, label: "Changes", path: "/changes" },
  { icon: CheckCircle2, label: "Approvals", path: "/approvals" },
  { icon: History, label: "History", path: "/history" },
  { icon: Activity, label: "Health", path: "/health" },
  { icon: RotateCcw, label: "Rollback", path: "/rollback" },
  { icon: Settings2, label: "Providers", path: "/providers" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { loading, user, logout } = useAuth();
  const [location, setLocation] = useLocation();

  if (loading) {
    return <div className="min-h-screen bg-slate-950" aria-busy="true" />;
  }

  if (!user) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 p-6 text-slate-100">
        <section className="w-full max-w-md rounded-3xl border border-slate-700/80 bg-slate-900 p-8 shadow-2xl shadow-black/30">
          <div className="mb-8 flex size-12 items-center justify-center rounded-2xl bg-cyan-400/15 text-cyan-300">
            <ShieldCheck className="size-6" />
          </div>
          <p className="text-sm font-medium text-cyan-300">Main AI Agent</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Governed AI administration</h1>
          <p className="mt-3 leading-6 text-slate-400">Sign in to access your organization-specific configuration, approval, and audit workspace.</p>
          <Button onClick={() => startLogin()} className="mt-8 w-full bg-cyan-300 text-slate-950 hover:bg-cyan-200">
            Sign in securely
          </Button>
        </section>
      </main>
    );
  }

  const activeItem = menuItems.find((item) => item.path === location) ?? menuItems[0];
  return (
    <SidebarProvider>
      <Sidebar className="border-r border-slate-800 bg-slate-950 text-slate-100">
        <SidebarHeader className="border-b border-slate-800 p-4">
          <button onClick={() => setLocation("/")} className="flex w-full items-center gap-3 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
            <span className="grid size-9 place-items-center rounded-xl bg-cyan-300 text-slate-950 shadow-lg shadow-cyan-300/10">
              <ShieldCheck className="size-5" />
            </span>
            <span className="min-w-0 group-data-[collapsible=icon]:hidden">
              <span className="block truncate text-sm font-semibold tracking-tight">Main AI Agent</span>
              <span className="block truncate text-xs text-slate-500">Governed workspace</span>
            </span>
          </button>
        </SidebarHeader>
        <SidebarContent className="bg-slate-950 px-3 py-4">
          <p className="px-2 pb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 group-data-[collapsible=icon]:hidden">Control plane</p>
          <SidebarMenu>
            {menuItems.map((item) => {
              const isActive = item.path === location;
              return (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    isActive={isActive}
                    onClick={() => setLocation(item.path)}
                    tooltip={item.label}
                    className="h-10 rounded-lg text-slate-400 hover:bg-slate-900 hover:text-slate-100 data-[active=true]:bg-cyan-300 data-[active=true]:text-slate-950"
                  >
                    <item.icon className="size-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="border-t border-slate-800 bg-slate-950 p-3">
          <div className="flex items-center gap-3 rounded-xl bg-slate-900/80 p-2">
            <Avatar className="size-8 border border-slate-700">
              <AvatarFallback className="bg-slate-800 text-xs text-cyan-300">{user.name?.slice(0, 1).toUpperCase() ?? "U"}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-sm font-medium text-slate-100">{user.name ?? "Workspace user"}</p>
              <p className="truncate text-xs text-slate-500">Authenticated session</p>
            </div>
            <button onClick={logout} aria-label="Sign out" className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 group-data-[collapsible=icon]:hidden">
              <LogOut className="size-4" />
            </button>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="min-h-screen bg-[#f7f8fb]">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200/80 bg-[#f7f8fb]/90 px-4 backdrop-blur md:px-8">
          <SidebarTrigger className="text-slate-700" />
          <div>
            <p className="text-sm font-semibold text-slate-950">{activeItem.label}</p>
            <p className="text-xs text-slate-500">Tenant-safe control plane</p>
          </div>
          <div className="ml-auto hidden items-center gap-2 sm:flex">
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">Governance online</span>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1600px] p-4 md:p-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
