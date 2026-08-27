import { useMemo, useState, type KeyboardEvent } from "react";
import { FileCode2, FolderGit2, Search as SearchIcon } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useRepositories } from "@/hooks/useRepositories";
import type { RepositoryListItem } from "@/types/repository";

type SearchScope = "repositories" | "files" | "symbols" | "semantic";

function repositoryName(repository: RepositoryListItem): string {
  return repository.repository_name
    .replace(/^https:\/\/github\.com\//, "")
    .replace(/\.git\/?$/, "");
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")})`, "ig"));
  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={`${part}-${index}`} className="rounded bg-primary/20 px-0.5 text-foreground">
            {part}
          </mark>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        ),
      )}
    </>
  );
}

export function Search() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [scope, setScope] = useState<SearchScope>("repositories");
  const [activeIndex, setActiveIndex] = useState(0);
  const repositoriesQuery = useRepositories();
  const repositories = useMemo(() => repositoriesQuery.data?.items ?? [], [repositoriesQuery.data]);
  const results = useMemo(
    () =>
      scope === "repositories" && query.trim()
        ? repositories.filter((repository) => repositoryName(repository).toLowerCase().includes(query.trim().toLowerCase()))
        : [],
    [query, repositories, scope],
  );

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setActiveIndex(0);
    if (value.trim()) setSearchParams({ q: value }, { replace: true });
    else setSearchParams({}, { replace: true });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, Math.max(results.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && results[activeIndex]) {
      navigate(`/repositories/${results[activeIndex].id}`);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Search</h1>
        <p className="text-sm text-muted-foreground">Find indexed repositories and code intelligence resources.</p>
      </div>

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              type="search"
              value={query}
              onChange={(event) => handleQueryChange(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search repositories, files, or symbols…"
              className="h-10 pl-9"
              aria-label="Search CodeAtlas"
              aria-controls="search-results"
              aria-activedescendant={results[activeIndex] ? `search-result-${results[activeIndex].id}` : undefined}
            />
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Search scope">
            {(["repositories", "files", "symbols", "semantic"] as SearchScope[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setScope(value)}
                className={`rounded-full border px-3 py-1 text-xs capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${scope === value ? "border-primary/40 bg-primary/10 text-foreground" : "border-border/60 text-muted-foreground hover:bg-muted"}`}
                aria-pressed={scope === value}
              >
                {value}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card id="search-results">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Search results</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {repositoriesQuery.isLoading ? (
            <div className="space-y-3 p-5">{[1, 2, 3].map((item) => <Skeleton key={item} className="h-16 w-full" />)}</div>
          ) : repositoriesQuery.isError ? (
            <p className="p-5 text-sm text-destructive">Unable to load searchable repositories. Please retry.</p>
          ) : scope !== "repositories" ? (
            <p className="p-5 text-sm text-muted-foreground">This backend does not currently expose a global {scope} search endpoint.</p>
          ) : !query.trim() ? (
            <p className="p-5 text-sm text-muted-foreground">Start typing to search imported repositories.</p>
          ) : results.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">No repositories matched “{query}”.</p>
          ) : (
            <div className="divide-y divide-border/60" role="listbox" aria-label="Search results">
              {results.map((repository, index) => (
                <button
                  key={repository.id}
                  id={`search-result-${repository.id}`}
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  onClick={() => navigate(`/repositories/${repository.id}`)}
                  className={`flex w-full items-center gap-3 p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${index === activeIndex ? "bg-muted/60" : "hover:bg-muted/40"}`}
                >
                  <FolderGit2 className="h-5 w-5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium"><Highlight text={repositoryName(repository)} query={query} /></span>
                    <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <FileCode2 className="h-3.5 w-3.5" /> {repository.files_indexed.toLocaleString()} files
                      <Badge variant="outline" className="font-normal">{repository.status}</Badge>
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default Search;
