"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import type { User } from "@supabase/supabase-js";
import { BookOpen, FileText, Settings, LogOut, PenTool } from "lucide-react";
import { LanguageSwitcher } from "./language-switcher";

interface NavbarProps {
  user: User;
}

export function Navbar({ user }: NavbarProps) {
  const pathname = usePathname();
  const { signOut } = useAuth();
  const t = useTranslations("nav");

  const navItems = [
    { href: "/", label: t("novels"), icon: BookOpen },
    { href: "/notes", label: t("notes"), icon: FileText },
    { href: "/settings", label: t("settings"), icon: Settings },
  ];

  const handleSignOut = async () => {
    await signOut();
    window.location.href = "/login";
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-surface/80 backdrop-blur-md border-b border-border">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <PenTool className="w-6 h-6 text-primary" />
            <span className="text-xl font-serif font-bold text-foreground">
              Letters
            </span>
          </Link>

          {/* Navigation */}
          <div className="flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted hover:text-foreground hover:bg-muted/10"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* User Menu */}
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <span className="text-sm text-muted hidden md:inline">
              {user.email}
            </span>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-3 py-2 text-sm text-muted hover:text-foreground transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">{t("logout")}</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
