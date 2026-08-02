// src/app/providers.tsx
import { RouterProvider } from "react-router-dom";
import { QueryProvider, ThemeProvider } from "@/providers";
import { router } from "@/app/router";

/**
 * Composes the application's global providers in the required order:
 * server state (QueryProvider), theme (ThemeProvider), and routing
 * (RouterProvider).
 */
export function AppProviders() {
  return (
    <QueryProvider>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryProvider>
  );
}