"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { formatRelativeTime, truncateText } from "@/lib/utils";
import { Plus, BookOpen, Trash2 } from "lucide-react";

export default function NovelsPage() {
  const t = useTranslations("novels");
  const tc = useTranslations("common");
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const utils = trpc.useUtils();
  const { data: novels, isLoading } = trpc.novels.list.useQuery();
  const createNovel = trpc.novels.create.useMutation({
    onSuccess: () => {
      utils.novels.list.invalidate();
      setIsCreating(false);
      setNewTitle("");
      setNewDescription("");
    },
  });
  const deleteNovel = trpc.novels.delete.useMutation({
    onSuccess: () => {
      utils.novels.list.invalidate();
    },
  });

  const handleCreate = () => {
    if (!newTitle.trim()) return;
    createNovel.mutate({
      title: newTitle.trim(),
      description: newDescription.trim() || undefined,
    });
  };

  const handleDelete = (id: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm(t("deleteConfirm"))) {
      deleteNovel.mutate({ id });
    }
  };

  return (
    <div className="content-container">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="page-title mb-1">{t("title")}</h1>
          <p className="text-muted">
            {novels?.length || 0} {t("chapters")}
          </p>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          {t("createNovel")}
        </button>
      </div>

      {/* Create Modal */}
      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="card w-full max-w-md mx-4">
            <h2 className="text-xl font-serif font-semibold mb-4">{t("createNovel")}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  {t("novelTitle")}
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="input"
                  placeholder={t("novelTitle")}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  {t("novelDescription")}
                </label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="textarea"
                  placeholder={t("novelDescription")}
                  rows={3}
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setIsCreating(false)}
                  className="btn-secondary"
                >
                  {tc("cancel")}
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!newTitle.trim() || createNovel.isPending}
                  className="btn-primary disabled:opacity-50"
                >
                  {createNovel.isPending ? tc("loading") : tc("create")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-muted">{tc("loading")}</div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && novels?.length === 0 && (
        <div className="text-center py-20">
          <BookOpen className="w-16 h-16 text-muted/30 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">
            {tc("noData")}
          </h3>
          <p className="text-muted mb-6">{t("createNovel")}</p>
          <button
            onClick={() => setIsCreating(true)}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {t("createNovel")}
          </button>
        </div>
      )}

      {/* Novel Grid */}
      {novels && novels.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {novels.map((novel) => (
            <Link
              key={novel.id}
              href={`/novels/${novel.id}`}
              className="card group hover:border-primary/30 transition-all"
            >
              {/* Cover */}
              <div className="aspect-[3/4] bg-muted/10 rounded-lg mb-4 overflow-hidden flex items-center justify-center">
                <img
                  src={novel.coverUrl || "/images/default-novel-cover.jpg"}
                  alt={novel.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (!target.src.endsWith("/images/default-novel-cover.jpg")) {
                      target.src = "/images/default-novel-cover.jpg";
                    }
                  }}
                />
              </div>

              {/* Info */}
              <h3 className="font-serif font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">
                {novel.title}
              </h3>
              {novel.description && (
                <p className="text-sm text-muted line-clamp-2 mb-2">
                  {truncateText(novel.description, 50)}
                </p>
              )}
              <div className="flex items-center justify-between text-xs text-muted">
                <span>{novel.totalWords.toLocaleString()} {t("words")}</span>
                <span>{formatRelativeTime(novel.updatedAt)}</span>
              </div>

              {/* Delete Button */}
              <button
                onClick={(e) => handleDelete(novel.id, e)}
                className="absolute top-4 right-4 p-2 rounded-lg bg-surface/80 text-muted hover:text-error hover:bg-error/10 opacity-0 group-hover:opacity-100 transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
