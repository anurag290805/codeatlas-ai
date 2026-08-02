// src/pages/Settings.tsx
import { Palette, Sliders, User, GitBranch } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Application settings page. Composes the sections a user will use to
 * configure appearance, AI behavior, repository defaults, and their
 * account. Setting persistence is wired up in a later milestone.
 */
export function Settings() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your workspace preferences and account details.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 space-y-0">
            <Palette className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">Appearance</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>Theme, density, and editor font preferences.</CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2 space-y-0">
            <Sliders className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">AI Preferences</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>Default model provider and response style.</CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2 space-y-0">
            <GitBranch className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">Repository Defaults</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>Default branch, indexing depth, and exclusions.</CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2 space-y-0">
            <User className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">Account</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>Profile details and connected integrations.</CardDescription>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}