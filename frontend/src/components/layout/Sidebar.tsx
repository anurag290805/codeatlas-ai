import {
  BarChart3,
  FolderGit2,
  LayoutDashboard,
  MessageSquare,
  Network,
  Plus,
  Search,
  Settings,
  X,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useGlobalImport } from "@/components/common/useGlobalImport";
import { useVersion } from "@/hooks/useHealth";

interface NavItem {
  label: string;
  to: string;
  icon: typeof LayoutDashboard;
  /** When true, the item is active for any child route (e.g. chat/:id). */
  activeForPrefix?: string;
  /** Optional semantic accent for active state */
  accent?: "primary" | "info" | "success" | "warning";
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { label: "Dashboard", to: "/", icon: LayoutDashboard, accent: "primary" },
      { label: "Repositories", to: "/repositories", icon: FolderGit2, accent: "primary", activeForPrefix: "/repositories" },
      { label: "Search", to: "/search", icon: Search, accent: "info" },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { label: "AI Chat", to: "/chat", icon: MessageSquare, accent: "info", activeForPrefix: "/chat" },
      { label: "Dependency Graph", to: "/graph", icon: Network, accent: "success", activeForPrefix: "/graph" },
      { label: "Analytics", to: "/analytics", icon: BarChart3, accent: "warning", activeForPrefix: "/analytics" },
    ],
  },
  {
    label: "System",
    items: [{ label: "Settings", to: "/settings", icon: Settings, accent: "primary" }],
  },
];

const ACCENT_STYLES = {
  primary: {
    active: "bg-primary/18 text-primary border-primary/30 shadow-sm shadow-primary/10 dark:bg-primary/22 dark:border-primary/35 colourful:bg-primary/20",
    icon: "text-primary",
    indicator: "bg-primary",
  },
  info: {
    active: "bg-info/18 text-info border-info/30 shadow-sm shadow-info/10 dark:bg-info/22 dark:border-info/35 colourful:bg-info/20",
    icon: "text-info",
    indicator: "bg-info",
  },
  success: {
    active: "bg-success/18 text-success border-success/30 shadow-sm shadow-success/10 dark:bg-success/22 dark:border-success/35 colourful:bg-success/20",
    icon: "text-success",
    indicator: "bg-success",
  },
  warning: {
    active: "bg-warning/18 text-warning border-warning/30 shadow-sm shadow-warning/10 dark:bg-warning/22 dark:border-warning/35 colourful:bg-warning/20",
    icon: "text-warning",
    indicator: "bg-warning",
  },
} as const;

interface SidebarProps {
  /** Whether the mobile drawer is open. Ignored on desktop, where the sidebar is always visible. */
  isOpen?: boolean;
  /** Invoked when the mobile drawer should close. */
  onClose?: () => void;
}

/**
 * Primary application navigation. Renders as a fixed column on desktop
 * and a collapsible drawer on mobile. Navigation is grouped by
 * functional area so the product structure is legible at a glance, with
 * a primary import action and a quiet workspace footer.
 */
export function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const { openImport } = useGlobalImport();
  const version = useVersion();
  const backendVersion = version.data?.version
    ? `v${version.data.version}`
    : version.isLoading
      ? "v—"
      : "offline";

  const handleNav = () => onClose?.();

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r bg-sidebar transition-transform duration-200 ease-in-out",
          "md:sticky md:top-0 md:h-screen md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
        aria-label="Primary navigation"
      >
        <div className="flex h-14 items-center justify-between border-b border-sidebar-border bg-gradient-to-r from-primary/[0.04] to-transparent px-4">
          <span className="flex items-center gap-2.5 text-sm font-semibold tracking-tight">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm shadow-primary/20">
              <img
                src="/codeatlas-logo.png"
                alt=""
                className="h-5 w-5 object-contain"
              />
            </span>
            <span className="text-sidebar-foreground">
              CodeAtlas <span className="text-primary">AI</span>
            </span>
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={onClose}
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="border-b border-sidebar-border p-3">
          <Button
            onClick={() => {
              openImport();
              onClose?.();
            }}
            className="w-full gap-1.5 shadow-md shadow-primary/15"
          >
            <Plus className="h-4 w-4" />
            Import repository
          </Button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="space-y-1">
              <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/55">
                {group.label}
              </p>
              {group.items.map(({ label, to, icon: Icon, activeForPrefix, accent = "primary" }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={handleNav}
                  className="relative block"
                >
                  {({ isActive }) => {
                    const active =
                      isActive ||
                      (activeForPrefix !== undefined &&
                        window.location.pathname.startsWith(activeForPrefix));
                    const styles = ACCENT_STYLES[accent];
                    return (
                      <span
                        className={cn(
                          "flex items-center gap-3 rounded-lg border border-transparent px-3 py-2 text-sm font-medium transition-all duration-150",
                          active
                            ? cn("border shadow-sm", styles.active)
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:border-sidebar-border",
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-4 w-4 shrink-0 transition-colors",
                            active ? styles.icon : "text-sidebar-foreground/50",
                          )}
                          aria-hidden="true"
                        />
                        <span>{label}</span>
                      </span>
                    );
                  }}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-2.5 rounded-lg border border-sidebar-border bg-sidebar-accent/50 px-3 py-2.5 text-xs shadow-sm">
            <span
              className={cn(
                "h-2 w-2 shrink-0 rounded-full ring-2 ring-offset-1 ring-offset-sidebar",
                version.isSuccess
                  ? "bg-success ring-success/30 shadow-[0_0_6px_theme(colors.success)]"
                  : "bg-muted-foreground ring-muted-foreground/20",
              )}
              aria-hidden="true"
            />
            <span className="text-sidebar-foreground/80">
              {version.data?.environment === "production" ? "Production" : version.data?.environment === "staging" ? "Staging" : "Local"}
            </span>
            <span className="ml-auto font-mono text-xs font-medium text-sidebar-foreground">{backendVersion}</span>
          </div>
        </div>
      </aside>
    </>
  );
}
