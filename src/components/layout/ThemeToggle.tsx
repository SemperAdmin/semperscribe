'use client';

import { useTheme } from 'next-themes';
import { useHydrated } from '@/hooks/useHydrated';
import { Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  // The theme only exists in the browser; render nothing until hydrated
  // so the static export and the first client paint agree.
  const mounted = useHydrated();

  if (!mounted) return null;

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="text-secondary-foreground hover:text-primary hover:bg-white/10"
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {theme === 'dark' ? (
        <Sun className="w-4 h-4" />
      ) : (
        <Moon className="w-4 h-4" />
      )}
    </Button>
  );
}
