// src/components/layout/Sidebar.tsx
import {
  BarChart3,
  FolderGit2,
  LayoutDashboard,
  MessageSquare,
  Network,
  Settings,
  X,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface NavItem {
  label: string;
  to: string;
  icon: typeof LayoutDashboard;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "Repositories", to: "/repositories", icon: FolderGit2 },
  { label: "AI Chat", to: "/chat", icon: MessageSquare },
  { label: "Dependency Graph", to: "/graph", icon: Network },
  { label: "Analytics", to: "/analytics", icon: BarChart3 },
  { label: "Settings", to: "/settings", icon: Settings },
];

interface SidebarProps {
  /** Whether the mobile drawer is open. Ignored on desktop, where the sidebar is always visible. */
  isOpen?: boolean;
  /** Invoked when the mobile drawer should close (backdrop click, nav item click, close button). */
  onClose?: () => void;
}

/**
 * Primary application navigation. Renders as a fixed column on desktop
 * and a collapsible drawer on mobile, controlled via `isOpen`/`onClose`.
 */
export function Sidebar({ isOpen = false, onClose }: SidebarProps) {
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
          <span className="text-sm font-semibold tracking-tight">CodeAtlas AI</span>
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

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {NAV_ITEMS.map(({ label, to, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  "hover:bg-muted hover:text-foreground",
                  isActive
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground",
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}