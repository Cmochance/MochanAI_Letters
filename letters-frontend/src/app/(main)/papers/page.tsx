"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { formatRelativeTime, truncateText } from "@/lib/utils";
import { Plus, FileText, Trash2 } from "lucide-react";

export default function PapersPage() {
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const utils = trpc.useUtils();
  const { data: papers, isLoading } = trpc.papers.list.useQuery();

  const createPaper = trpc.papers.create.useMutation({
    onSuccess: () => {
      utils.papers.list.invalidate();
      setIsCreating(false);
      setNewTitle("");
      setNewDescription("");
    },
  });

  const deletePaper = trpc.papers.delete.useMutation({
    onSuccess: () => {
      utils.papers.list.invalidate();
    },
  });

  const handleCreate = () => {
    if (!newTitle.trim()) return;
    createPaper.mutate({
      title: newTitle.trim(),
      description: newDescription.trim() || undefined,
    });
  };

  const handleDelete = (id: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm("确定要删除这篇论文吗？")) {
      deletePaper.mutate({ id });
    }
  };

  return (
    <div className="content-container">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="page-title mb-1">我的论文</h1>
          <p className="text-muted">{papers?.length || 0} 篇论文</p>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          新建论文
        </button>
      </div>

      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="card w-full max-w-md mx-4">
            <h2 className="text-xl font-serif font-semibold mb-4">新建论文</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">论文标题</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="input"
                  placeholder="请输入论文标题"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">论文摘要</label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="textarea"
                  placeholder="请输入论文摘要（可选）"
                  rows={3}
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setIsCreating(false)} className="btn-secondary">
                  取消
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!newTitle.trim() || createPaper.isPending}
                  className="btn-primary disabled:opacity-50"
                >
                  {createPaper.isPending ? "创建中..." : "创建"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isLoading && <div className="text-center py-20 text-muted">加载中...</div>}

      {!isLoading && papers?.length === 0 && (
        <div className="text-center py-20">
          <FileText className="w-16 h-16 text-muted/30 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">还没有论文</h3>
          <p className="text-muted mb-6">创建你的第一篇论文</p>
          <button
            onClick={() => setIsCreating(true)}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            新建论文
          </button>
        </div>
      )}

      {papers && papers.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {papers.map((paper) => (
            <Link
              key={paper.id}
              href={`/papers/${paper.id}`}
              className="card group hover:border-primary/30 transition-all relative"
            >
              <h3 className="font-serif font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">
                {paper.title}
              </h3>
              {paper.description && (
                <p className="text-sm text-muted line-clamp-3 mb-3">
                  {truncateText(paper.description, 120)}
                </p>
              )}
              <div className="flex items-center justify-between text-xs text-muted">
                <span>{paper.totalWords.toLocaleString()} 字</span>
                <span>{formatRelativeTime(paper.updatedAt)}</span>
              </div>

              <button
                onClick={(e) => handleDelete(paper.id, e)}
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
