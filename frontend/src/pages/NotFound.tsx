// src/pages/NotFound.tsx
import { Compass } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

/**
 * Rendered when no route matches the current path. Provides a clear
 * way back into the application.
 */
export function NotFound() {
  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center gap-4 text-center">
      <Compass className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
      <h1 className="text-6xl font-semibold tracking-tight">404</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        We couldn't find the page you're looking for. It may have been moved or no longer exists.
      </p>
      <Button render={<Link to="/" />}>Return to Dashboard</Button>
    </div>
  );
}

export default NotFound;
