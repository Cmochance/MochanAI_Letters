"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { formatRelativeTime } from "@/lib/utils";
import {
  ArrowLeft,
  Plus,
  FileText,
  Trash2,
  Sparkles,
  Download,
  NotebookPen,
} from "lucide-react";

export default function PaperDetailPage() {
  const params = useParams();
  const router = useRouter();
  const paperId = Number(params.id);

  const [isCreatingSection, setIsCreatingSection] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState("");

  const utils = trpc.useUtils();
  const { data: paper, isLoading: isPaperLoading } = trpc.papers.get.useQuery(
    { id: paperId },
    { enabled: Number.isFinite(paperId) && paperId > 0 }
  );
  const { data: sections, isLoading: isSectionsLoading } =
    trpc.paperSections.list.useQuery(
      { paperId },
      { enabled: Number.isFinite(paperId) && paperId > 0 }
    );

  const createSection = trpc.paperSections.create.useMutation({
    onSuccess: (data) => {
      utils.paperSections.list.invalidate({ paperId });
      utils.papers.list.invalidate();
      setIsCreatingSection(false);
      setNewSectionTitle("");
      router.push(`/paper-sections/${data.id}`);
    },
  });

  const deleteSection = trpc.paperSections.delete.useMutation({
    onSuccess: () => {
      utils.paperSections.list.invalidate({ paperId });
      utils.papers.list.invalidate();
    },
  });

  const handleCreateSection = () => {
    if (!newSectionTitle.trim()) return;
    const sectionNumber = (sections?.length || 0) + 1;
    createSection.mutate({
      paperId,
      sectionNumber,
      title: newSectionTitle.trim(),
      content: "",
    });
  };

  const handleDeleteSection = (id: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm("确定要删除这一节吗？")) {
      deleteSection.mutate({ id });
    }
  };

  if (!Number.isFinite(paperId) || paperId <= 0) {
    return (
      <div className="content-container">
        <div className="text-center py-20">
          <p className="text-muted">论文参数无效</p>
          <Link href="/papers" className="btn-primary mt-4 inline-block">
            返回论文列表
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="content-container">
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/papers"
          className="p-2 rounded-lg hover:bg-muted/10 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-muted" />
        </Link>
        <div className="flex-1">
          <h1 className="page-title mb-1">{paper?.title || "论文详情"}</h1>
          {paper?.description && <p className="text-muted">{paper.description}</p>}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-8">
        <button
          onClick={() => setIsCreatingSection(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          新建小节
        </button>
        <Link
          href={`/paper-ai-outline?paperId=${paperId}`}
          className="btn-secondary flex items-center gap-2"
        >
          <Sparkles className="w-4 h-4" />
          AI 规划
        </Link>
        <Link
          href={`/papers/${paperId}/notes`}
          className="btn-secondary flex items-center gap-2"
        >
          <NotebookPen className="w-4 h-4" />
          研究笔记
        </Link>
        <Link
          href={`/paper-export?paperId=${paperId}`}
          className="btn-secondary flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          导出
        </Link>
      </div>

      {isCreatingSection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="card w-full max-w-md mx-4">
            <h2 className="text-xl font-serif font-semibold mb-4">新建小节</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">小节标题</label>
                <input
                  type="text"
                  value={newSectionTitle}
                  onChange={(e) => setNewSectionTitle(e.target.value)}
                  className="input"
                  placeholder={`第 ${(sections?.length || 0) + 1} 节`}
                  autoFocus
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setIsCreatingSection(false)} className="btn-secondary">
                  取消
                </button>
                <button
                  onClick={handleCreateSection}
                  disabled={!newSectionTitle.trim() || createSection.isPending}
                  className="btn-primary disabled:opacity-50"
                >
                  {createSection.isPending ? "创建中..." : "创建"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {(isPaperLoading || isSectionsLoading) && (
        <div className="text-center py-20 text-muted">加载中...</div>
      )}

      {!isSectionsLoading && sections?.length === 0 && (
        <div className="text-center py-20">
          <FileText className="w-16 h-16 text-muted/30 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">还没有小节</h3>
          <p className="text-muted mb-6">开始写作第一节内容</p>
          <button
            onClick={() => setIsCreatingSection(true)}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            新建小节
          </button>
        </div>
      )}

      {sections && sections.length > 0 && (
        <div className="space-y-3">
          {sections.map((section) => (
            <Link
              key={section.id}
              href={`/paper-sections/${section.id}`}
              className="card group flex items-center justify-between hover:border-primary/30 transition-all"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <span className="tag">第 {section.sectionNumber} 节</span>
                  <h3 className="font-medium text-foreground group-hover:text-primary transition-colors truncate">
                    {section.title}
                  </h3>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted">
                  <span>{section.wordCount.toLocaleString()} 字</span>
                  <span>{formatRelativeTime(section.updatedAt)}</span>
                </div>
              </div>
              <button
                onClick={(e) => handleDeleteSection(section.id, e)}
                className="p-2 rounded-lg text-muted hover:text-error hover:bg-error/10 opacity-0 group-hover:opacity-100 transition-all"
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
