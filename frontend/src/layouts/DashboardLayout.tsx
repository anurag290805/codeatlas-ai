// src/layouts/DashboardLayout.tsx
import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Navbar } from "@/components/layout/Navbar";
import { PageContainer } from "@/components/layout/PageContainer";
import { Sidebar } from "@/components/layout/Sidebar";

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/repositories": "Repositories",
  "/chat": "AI Chat",
  "/graph": "Dependency Graph",
  "/analytics": "Analytics",
  "/settings": "Settings",
};

/**
 * Application shell composing the sidebar, top navigation, and routed
 * page content. Owns only shell-level state (the mobile sidebar
 * drawer) — page content and data fetching belong to individual routes.
 */
export function DashboardLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { pathname } = useLocation();

  const title = PAGE_TITLES[pathname] ?? "CodeAtlas AI";

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <div className="flex min-h-screen flex-1 flex-col">
        <Navbar title={title} onMenuClick={() => setIsSidebarOpen(true)} />

        <main className="flex-1 overflow-y-auto">
          <PageContainer fullHeight>
            <Outlet />
          </PageContainer>
        </main>
      </div>
    </div>
  );
}