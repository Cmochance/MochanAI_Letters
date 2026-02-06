"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAuth } from "@/hooks/use-auth";
import { LanguageSwitcher } from "@/components/language-switcher";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signInWithEmail } = useAuth();
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const notice = searchParams.get("notice") || "";
  const nextPath = useMemo(() => {
    const raw = searchParams.get("next") || "/novels";
    if (!raw.startsWith("/")) {
      return "/novels";
    }
    return raw;
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signInWithEmail(email, password);
      router.push(nextPath);
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("invalidCredentials");
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-serif font-bold text-foreground mb-2">
            Letters
          </h1>
          <p className="text-muted">AI Novel & Paper Writing Platform</p>
        </div>

        <div className="card">
          <h2 className="text-xl font-serif font-semibold text-foreground mb-6 text-center">
            {t("login")}
          </h2>

          {notice && (
            <div className="p-3 mb-4 bg-primary/10 border border-primary/20 rounded-lg text-primary text-sm">
              {notice}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-error/10 border border-error/20 rounded-lg text-error text-sm">
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-foreground mb-2"
              >
                {t("email")}
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder={t("email")}
                required
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-foreground mb-2"
              >
                {t("password")}
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder={t("password")}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? tc("loading") : t("login")}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-muted text-sm">
              {t("noAccount")}{" "}
              <Link
                href={`/register?next=${encodeURIComponent(nextPath)}`}
                className="text-primary hover:underline font-medium"
              >
                {t("register")}
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-muted text-xs mt-8">
          Traditional Ink Wash Aesthetics × Modern AI Technology
        </p>
      </div>
    </div>
  );
}
