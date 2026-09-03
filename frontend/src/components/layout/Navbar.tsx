// src/components/layout/Navbar.tsx
import { Menu, Search as SearchIcon } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

interface NavbarProps {
  title: string;
  /** Invoked when the mobile menu button is pressed to open the sidebar drawer. */
  onMenuClick?: () => void;
}

/**
 * Sticky top navigation bar. Shows the current page title, a global
 * search field, and quick actions (theme). Deliberately avoids
 * dead affordances — every control responds to user intent.
 */
export function Navbar({ title, onMenuClick }: NavbarProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedQuery = query.trim();
    navigate(trimmedQuery ? `/search?q=${encodeURIComponent(trimmedQuery)}` : "/search");
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/85 sm:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={onMenuClick}
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div className="flex min-w-0 items-center gap-2">
        <span className="sr-only" aria-hidden="true">{title}</span>
        <span className="truncate text-sm font-semibold tracking-tight sm:text-base">{title}</span>
      </div>

      <form onSubmit={submitSearch} className="relative ml-2 hidden max-w-md flex-1 sm:block">
        <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search repositories, files, symbols..."
          className="pl-8"
          aria-label="Search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </form>

      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
      </div>
    </header>
  );
}