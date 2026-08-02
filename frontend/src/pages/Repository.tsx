// src/pages/Repository.tsx
import { FolderTree, MessageSquare, Network, PanelsTopLeft } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Repository workspace page. Composes the panels a user will use to
 * explore a single repository (overview, file explorer, AI chat, and
 * dependency graph). Panel content is implemented in a later milestone.
 */
export function Repository() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Repository Workspace</h1>
        <p className="text-sm text-muted-foreground">
          Explore structure, files, and dependencies for this repository.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 space-y-0">
            <PanelsTopLeft className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">Repository Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>Summary, language breakdown, and metadata.</CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2 space-y-0">
            <FolderTree className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">File Explorer</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>Browse the repository's file tree.</CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2 space-y-0">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">AI Chat</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>Ask questions about this codebase.</CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2 space-y-0">
            <Network className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">Dependency Graph</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>Visualize module and file dependencies.</CardDescription>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}