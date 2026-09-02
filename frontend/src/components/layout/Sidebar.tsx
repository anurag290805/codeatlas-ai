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
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { label: "Dashboard", to: "/", icon: LayoutDashboard },
      { label: "Repositories", to: "/repositories", icon: FolderGit2, activeForPrefix: "/repositories" },
      { label: "Search", to: "/search", icon: Search },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { label: "AI Chat", to: "/chat", icon: MessageSquare, activeForPrefix: "/chat" },
      { label: "Dependency Graph", to: "/graph", icon: Network, activeForPrefix: "/graph" },
      { label: "Analytics", to: "/analytics", icon: BarChart3, activeForPrefix: "/analytics" },
    ],
  },
  {
    label: "System",
    items: [{ label: "Settings", to: "/settings", icon: Settings }],
  },
];

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
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r bg-background transition-transform duration-200 ease-in-out",
          "md:sticky md:top-0 md:h-screen md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
        aria-label="Primary navigation"
      >
        <div className="flex h-14 items-center justify-between border-b px-4">
          <span className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <img
              src="/codeatlas-logo.png"
              alt=""
              className="h-7 w-7 shrink-0 rounded-md object-contain"
            />
            <span>
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

        <div className="border-b p-3">
          <Button
            onClick={() => {
              openImport();
              onClose?.();
            }}
            className="w-full gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Import repository
          </Button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="space-y-1">
              <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {group.label}
              </p>
              {group.items.map(({ label, to, icon: Icon, activeForPrefix }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={handleNav}
                  className="relative"
                >
                  {({ isActive }) => {
                    const active =
                      isActive ||
                      (activeForPrefix !== undefined &&
                        window.location.pathname.startsWith(activeForPrefix));
                    return (
                      <span
                        className={cn(
                          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                          "hover:bg-muted hover:text-foreground",
                          active ? "bg-primary/10 text-primary" : "text-muted-foreground",
                        )}
                      >
                        {active && (
                          <span
                            className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary"
                            aria-hidden="true"
                          />
                        )}
                        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span>{label}</span>
                      </span>
                    );
                  }}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="border-t p-3">
          <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <span
              className={cn(
                "h-1.5 w-1.5 shrink-0 rounded-full",
                version.isSuccess ? "bg-emerald-500" : "bg-muted-foreground",
              )}
              aria-hidden="true"
            />
            Local backend
            <span className="ml-auto font-mono">{backendVersion}</span>
          </div>
        </div>
      </aside>
    </>
  );
}