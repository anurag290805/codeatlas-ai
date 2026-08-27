import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { PropsWithChildren } from "react";

/**
 * Encapsulates next-themes configuration for the application, enabling
 * light/dark/system/colourful theme support via a `class` attribute on the
 * document root for Tailwind's dark mode variant and shadcn/ui.
 */
function ThemeProvider({ children }: PropsWithChildren) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      themes={["light", "dark", "system", "colourful"]}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}

export default ThemeProvider;
