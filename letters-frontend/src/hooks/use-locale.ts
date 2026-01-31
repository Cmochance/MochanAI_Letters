"use client";

import { useCallback, useTransition } from "react";
import { useLocale as useNextIntlLocale } from "next-intl";
import { type Locale, locales, localeNames } from "@/i18n";

export function useLocale() {
  const locale = useNextIntlLocale() as Locale;
  const [isPending, startTransition] = useTransition();

  const setLocale = useCallback((newLocale: Locale) => {
    startTransition(() => {
      // Set cookie and reload to apply new locale
      document.cookie = `locale=${newLocale};path=/;max-age=31536000`; // 1 year
      window.location.reload();
    });
  }, []);

  const toggleLocale = useCallback(() => {
    const currentIndex = locales.indexOf(locale);
    const nextIndex = (currentIndex + 1) % locales.length;
    setLocale(locales[nextIndex]);
  }, [locale, setLocale]);

  return {
    locale,
    locales,
    localeNames,
    setLocale,
    toggleLocale,
    isPending,
  };
}
