import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface ErrorBoundaryProps { children: ReactNode }
interface ErrorBoundaryState { hasError: boolean; error: Error | null }

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("Unhandled CodeAtlas UI error", error, errorInfo);
  }

  private handleReload = () => window.location.reload();

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <AlertTriangle className="h-10 w-10 text-destructive" aria-hidden="true" />
            <div><h1 className="text-lg font-semibold">Something went wrong</h1><p className="mt-1 text-sm text-muted-foreground">The application hit an unexpected error. Reload to continue.</p>{import.meta.env.DEV && this.state.error && <p className="mt-3 break-words text-xs text-destructive">{this.state.error.message}</p>}</div>
            <Button onClick={this.handleReload} className="gap-2"><RefreshCw className="h-4 w-4" /> Reload application</Button>
          </CardContent>
        </Card>
      </main>
    );
  }
}
