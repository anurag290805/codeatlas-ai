import { useEffect, useState } from "react";
import { Activity, Brain, Code2, Palette, Settings2 } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { useHealth, useQueryHealth, useVersion } from "@/hooks/useHealth";

const STORAGE_KEYS = {
  streaming: "codeatlas.settings.streaming",
  citations: "codeatlas.settings.citations",
  compact: "codeatlas.settings.compact",
} as const;

function storedBoolean(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  return window.localStorage.getItem(key) == null
    ? fallback
    : window.localStorage.getItem(key) === "true";
}

function SettingToggle({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border border-border/60 p-3 transition-colors hover:bg-muted/40">
      <span><span className="block text-sm font-medium">{label}</span><span className="mt-1 block text-xs text-muted-foreground">{description}</span></span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1 h-4 w-4 accent-primary" />
    </label>
  );
}

export function Settings() {
  const { theme } = useTheme();
  const health = useHealth();
  const queryHealth = useQueryHealth();
  const version = useVersion();
  const [streaming, setStreaming] = useState(() => storedBoolean(STORAGE_KEYS.streaming, true));
  const [citations, setCitations] = useState(() => storedBoolean(STORAGE_KEYS.citations, true));
  const [compact, setCompact] = useState(() => storedBoolean(STORAGE_KEYS.compact, false));

  useEffect(() => { window.localStorage.setItem(STORAGE_KEYS.streaming, String(streaming)); }, [streaming]);
  useEffect(() => { window.localStorage.setItem(STORAGE_KEYS.citations, String(citations)); }, [citations]);
  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.compact, String(compact));
    document.documentElement.dataset.density = compact ? "compact" : "comfortable";
  }, [compact]);

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "Same origin";
  const backendStatus = health.isLoading ? "checking" : health.isError ? "unavailable" : "online";
  const queryStatus = queryHealth.isLoading ? "checking" : queryHealth.isError ? "unavailable" : queryHealth.data?.status ?? "unavailable";
  const themeLabel = theme ? theme.charAt(0).toUpperCase() + theme.slice(1) : "System";

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div><h1 className="text-2xl font-semibold tracking-tight">Settings</h1><p className="mt-1 text-sm text-muted-foreground">Manage workspace preferences and runtime diagnostics.</p></div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card><CardHeader className="flex flex-row items-center gap-3 space-y-0"><Palette className="h-5 w-5 text-primary" /><div><CardTitle className="text-base">Appearance</CardTitle><CardDescription>Control theme and information density.</CardDescription></div></CardHeader><CardContent className="space-y-3"><div className="flex items-center justify-between rounded-lg border border-border/60 p-3"><div><p className="text-sm font-medium">Theme</p><p className="text-xs text-muted-foreground">Current theme: {themeLabel}</p></div><ThemeToggle /></div><SettingToggle label="Compact mode" description="Reduce spacing in dense repository views." checked={compact} onChange={setCompact} /></CardContent></Card>

        <Card><CardHeader className="flex flex-row items-center gap-3 space-y-0"><Brain className="h-5 w-5 text-primary" /><div><CardTitle className="text-base">AI preferences</CardTitle><CardDescription>Choose how grounded answers are presented.</CardDescription></div></CardHeader><CardContent className="space-y-3"><SettingToggle label="Streaming responses" description="Persist the preference for progressive responses when supported." checked={streaming} onChange={setStreaming} /><SettingToggle label="Show citations" description="Keep source references visible in AI answers." checked={citations} onChange={setCitations} /><div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm"><div className="flex items-center justify-between gap-3"><p className="font-medium">AI query status</p><span className="text-xs font-medium capitalize text-primary">{queryStatus}</span></div><p className="mt-1 text-xs text-muted-foreground">{queryHealth.data?.llm_provider ?? "Gemini"} · {queryHealth.data?.llm_model ?? "configured by the backend"}</p><p className="mt-1 text-xs text-muted-foreground">{queryHealth.data?.message ?? "Health details unavailable."}</p></div></CardContent></Card>

        <Card><CardHeader className="flex flex-row items-center gap-3 space-y-0"><Activity className="h-5 w-5 text-primary" /><div><CardTitle className="text-base">Runtime diagnostics</CardTitle><CardDescription>Connection, AI readiness, and version information.</CardDescription></div></CardHeader><CardContent className="space-y-3"><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-lg border border-border/60 p-3"><p className="text-xs text-muted-foreground">Backend status</p><p className="mt-1 text-sm font-medium">{backendStatus}</p><p className="mt-0.5 text-xs text-muted-foreground">{apiBaseUrl}</p></div><div className="rounded-lg border border-border/60 p-3"><p className="text-xs text-muted-foreground">AI status</p><p className="mt-1 text-sm font-medium capitalize">{queryStatus}</p><p className="mt-0.5 text-xs text-muted-foreground">{queryHealth.data?.message ?? "Checking query subsystem…"}</p></div></div><Button variant="outline" size="sm" onClick={() => { void health.refetch(); void queryHealth.refetch(); void version.refetch(); }} disabled={health.isFetching || queryHealth.isFetching || version.isFetching}>Refresh diagnostics</Button></CardContent></Card>

        <Card><CardHeader className="flex flex-row items-center gap-3 space-y-0"><Code2 className="h-5 w-5 text-primary" /><div><CardTitle className="text-base">Developer</CardTitle><CardDescription>Build and environment information.</CardDescription></div></CardHeader><CardContent className="space-y-3 text-sm"><div className="flex justify-between gap-4"><span className="text-muted-foreground">Application</span><span className="font-medium">CodeAtlas AI</span></div><Separator /><div className="flex justify-between gap-4"><span className="text-muted-foreground">Frontend environment</span><span className="font-medium">{import.meta.env.MODE}</span></div><Separator /><div className="flex justify-between gap-4"><span className="text-muted-foreground">Backend version</span><span className="font-medium">{version.data?.version ?? "Unavailable"}</span></div><div className="flex justify-between gap-4"><span className="text-muted-foreground">Backend environment</span><span className="font-medium">{version.data?.environment ?? "Unavailable"}</span></div></CardContent></Card>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><Settings2 className="h-3.5 w-3.5" /> Preferences are stored locally in this browser.</div>
    </div>
  );
}

export default Settings;
