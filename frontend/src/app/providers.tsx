// src/app/providers.tsx
import { RouterProvider } from "react-router-dom";
import { QueryProvider, ThemeProvider } from "@/providers";
import { router } from "@/app/router";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";

/**
 * Composes the application's global providers in the required order:
 * server state (QueryProvider), theme (ThemeProvider), and routing
 * (RouterProvider).
 */
export function AppProviders() {
  return <ErrorBoundary><QueryProvider><ThemeProvider><RouterProvider router={router} /></ThemeProvider></QueryProvider></ErrorBoundary>;
}
