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
  Image as ImageIcon,
} from "lucide-react";

export default function NovelDetailPage() {
  const params = useParams();
  const router = useRouter();
  const novelId = Number(params.id);

  const [isCreatingChapter, setIsCreatingChapter] = useState(false);
  const [newChapterTitle, setNewChapterTitle] = useState("");

  const utils = trpc.useUtils();
  const { data: novels } = trpc.novels.list.useQuery();
  const currentNovel = novels?.find((novel) => novel.id === novelId);
  const { data: chapters, isLoading } = trpc.chapters.list.useQuery({
    novelId,
  });

  const createChapter = trpc.chapters.create.useMutation({
    onSuccess: (data) => {
      utils.chapters.list.invalidate({ novelId });
      setIsCreatingChapter(false);
      setNewChapterTitle("");
      router.push(`/chapters/${data.id}`);
    },
  });

  const deleteChapter = trpc.chapters.delete.useMutation({
    onSuccess: () => {
      utils.chapters.list.invalidate({ novelId });
    },
  });

  const generateCover = trpc.novels.generateCover.useMutation({
    onSuccess: () => {
      utils.novels.list.invalidate();
    },
  });

  const handleCreateChapter = () => {
    if (!newChapterTitle.trim()) return;
    const chapterNumber = (chapters?.length || 0) + 1;
    createChapter.mutate({
      novelId,
      chapterNumber,
      title: newChapterTitle.trim(),
      content: "",
    });
  };

  const handleDeleteChapter = (id: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm("确定要删除这一章吗？此操作不可撤销。")) {
      deleteChapter.mutate({ id });
    }
  };

  return (
    <div className="content-container">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/"
          className="p-2 rounded-lg hover:bg-muted/10 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-muted" />
        </Link>
        <div className="flex-1">
          <h1 className="page-title mb-0">小说详情</h1>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 mb-8">
        <button
          onClick={() => setIsCreatingChapter(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          新建章节
        </button>
        <Link
          href={`/ai-outline?novelId=${novelId}`}
          className="btn-secondary flex items-center gap-2"
        >
          <Sparkles className="w-4 h-4" />
          AI 规划
        </Link>
        <Link
          href={`/export?novelId=${novelId}`}
          className="btn-secondary flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          导出
        </Link>
        <button
          onClick={() =>
            generateCover.mutate({
              novelId,
              title: currentNovel?.title || "小说",
              description: currentNovel?.description || "",
            })
          }
          disabled={generateCover.isPending}
          className="btn-secondary flex items-center gap-2"
        >
          <ImageIcon className="w-4 h-4" />
          {generateCover.isPending ? "生成中..." : "生成封面"}
        </button>
      </div>

      {/* Create Chapter Modal */}
      {isCreatingChapter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="card w-full max-w-md mx-4">
            <h2 className="text-xl font-serif font-semibold mb-4">新建章节</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  章节标题
                </label>
                <input
                  type="text"
                  value={newChapterTitle}
                  onChange={(e) => setNewChapterTitle(e.target.value)}
                  className="input"
                  placeholder={`第 ${(chapters?.length || 0) + 1} 章`}
                  autoFocus
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setIsCreatingChapter(false)}
                  className="btn-secondary"
                >
                  取消
                </button>
                <button
                  onClick={handleCreateChapter}
                  disabled={!newChapterTitle.trim() || createChapter.isPending}
                  className="btn-primary disabled:opacity-50"
                >
                  {createChapter.isPending ? "创建中..." : "创建"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-muted">加载中...</div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && chapters?.length === 0 && (
        <div className="text-center py-20">
          <FileText className="w-16 h-16 text-muted/30 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">
            还没有章节
          </h3>
          <p className="text-muted mb-6">开始创作您的第一章吧</p>
          <button
            onClick={() => setIsCreatingChapter(true)}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            新建章节
          </button>
        </div>
      )}

      {/* Chapter List */}
      {chapters && chapters.length > 0 && (
        <div className="space-y-3">
          {chapters.map((chapter) => (
            <Link
              key={chapter.id}
              href={`/chapters/${chapter.id}`}
              className="card group flex items-center justify-between hover:border-primary/30 transition-all"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <span className="tag">第 {chapter.chapterNumber} 章</span>
                  <h3 className="font-medium text-foreground group-hover:text-primary transition-colors truncate">
                    {chapter.title}
                  </h3>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted">
                  <span>{chapter.wordCount.toLocaleString()} 字</span>
                  <span>{formatRelativeTime(chapter.updatedAt)}</span>
                </div>
              </div>
              <button
                onClick={(e) => handleDeleteChapter(chapter.id, e)}
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
