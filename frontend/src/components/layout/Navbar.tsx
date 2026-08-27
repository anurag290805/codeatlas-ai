// src/components/layout/Navbar.tsx
import { Bell, Menu, Search as SearchIcon } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

interface NavbarProps {
  title: string;
  /** Invoked when the mobile menu button is pressed to open the sidebar drawer. */
  onMenuClick?: () => void;
}

/**
 * Sticky top navigation bar. Displays the current page title, a global
 * search field, and quick-access actions (theme, notifications, profile).
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
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={onMenuClick}
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div className="flex min-w-0 items-center gap-2"><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary shadow-[0_0_0_3px_color-mix(in_oklab,var(--primary)_15%,transparent)]" aria-hidden="true" /><h1 className="truncate text-sm font-semibold tracking-tight sm:text-base">{title}</h1></div>

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
        <Button variant="ghost" size="icon" aria-label="Notifications">
          <Bell className="h-5 w-5" />
        </Button>

        <ThemeToggle />

        <Avatar className="h-8 w-8">
          <AvatarFallback>CA</AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
