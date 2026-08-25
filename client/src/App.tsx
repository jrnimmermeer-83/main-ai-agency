import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import NotFound from "./pages/NotFound";
import Workspace from "./pages/Workspace";

function Router() {
  return <Switch>
    <Route path="/" component={() => <Workspace section="overview" />} />
    <Route path="/chat" component={() => <Workspace section="chat" />} />
    <Route path="/changes" component={() => <Workspace section="changes" />} />
    <Route path="/approvals" component={() => <Workspace section="approvals" />} />
    <Route path="/history" component={() => <Workspace section="history" />} />
    <Route path="/health" component={() => <Workspace section="health" />} />
    <Route path="/rollback" component={() => <Workspace section="rollback" />} />
    <Route path="/providers" component={() => <Workspace section="providers" />} />
    <Route component={NotFound} />
  </Switch>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster richColors position="top-right" /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
