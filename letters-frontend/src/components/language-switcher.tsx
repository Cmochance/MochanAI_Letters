"use client";

import { Globe } from "lucide-react";
import { useLocale } from "@/hooks/use-locale";

export function LanguageSwitcher() {
  const { locale, localeNames, toggleLocale, isPending } = useLocale();

  return (
    <button
      onClick={toggleLocale}
      disabled={isPending}
      className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-foreground/80 hover:text-foreground hover:bg-surface rounded-md transition-colors disabled:opacity-50"
      title={localeNames[locale]}
    >
      <Globe className="w-4 h-4" />
      <span className="hidden sm:inline">{localeNames[locale]}</span>
    </button>
  );
}

export function LanguageDropdown() {
  const { locale, locales, localeNames, setLocale, isPending } = useLocale();

  return (
    <div className="relative group">
      <button
        disabled={isPending}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-foreground/80 hover:text-foreground hover:bg-surface rounded-md transition-colors disabled:opacity-50"
      >
        <Globe className="w-4 h-4" />
        <span className="hidden sm:inline">{localeNames[locale]}</span>
      </button>
      <div className="absolute right-0 top-full mt-1 py-1 bg-white border border-border rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 min-w-[100px]">
        {locales.map((loc) => (
          <button
            key={loc}
            onClick={() => setLocale(loc)}
            disabled={isPending || locale === loc}
            className={`w-full px-4 py-2 text-left text-sm hover:bg-surface transition-colors ${
              locale === loc ? "text-primary font-medium" : "text-foreground"
            } disabled:opacity-50`}
          >
            {localeNames[loc]}
          </button>
        ))}
      </div>
    </div>
  );
}
