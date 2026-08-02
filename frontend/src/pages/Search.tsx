// src/pages/Search.tsx
import { Search as SearchIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

/**
 * Global search page. Composes the search input and results surfaces
 * for querying across indexed repositories. Search execution is wired
 * up via hooks and API services in a later milestone.
 */
export function Search() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Search</h1>
        <p className="text-sm text-muted-foreground">
          Search across repositories, files, and symbols using natural language.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Search Input</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search repositories, files, or symbols..."
              className="pl-9"
              aria-label="Search"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Search Results</CardTitle>
        </CardHeader>
        <CardContent>
          <CardDescription>Results will appear here once you run a search.</CardDescription>
        </CardContent>
      </Card>
    </div>
  );
}