"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { countWords } from "@/lib/utils";
import { ArrowLeft, Save, Sparkles } from "lucide-react";
import { useDebouncedCallback } from "@/hooks/use-debounce";

export default function ChapterDetailPage() {
  const params = useParams();
  const router = useRouter();
  const chapterId = Number(params.id);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const { data: chapter, isLoading } = trpc.chapters.get.useQuery({
    id: chapterId,
  });

  const updateChapter = trpc.chapters.update.useMutation({
    onSuccess: () => {
      setLastSaved(new Date());
      setIsSaving(false);
    },
    onError: () => {
      setIsSaving(false);
    },
  });

  // Initialize form with chapter data
  useEffect(() => {
    if (chapter) {
      setTitle(chapter.title);
      setContent(chapter.content);
    }
  }, [chapter]);

  // Auto-save with debounce
  const debouncedSave = useDebouncedCallback(
    useCallback(
      (newTitle: string, newContent: string) => {
        if (!chapter) return;
        setIsSaving(true);
        updateChapter.mutate({
          id: chapterId,
          title: newTitle,
          content: newContent,
        });
      },
      [chapter, chapterId, updateChapter]
    ),
    2000
  );

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    debouncedSave(newTitle, content);
  };

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    debouncedSave(title, newContent);
  };

  const handleManualSave = () => {
    if (!chapter) return;
    setIsSaving(true);
    updateChapter.mutate({
      id: chapterId,
      title,
      content,
    });
  };

  const wordCount = countWords(content);

  if (isLoading) {
    return (
      <div className="content-container">
        <div className="flex items-center justify-center py-20">
          <div className="text-muted">加载中...</div>
        </div>
      </div>
    );
  }

  if (!chapter) {
    return (
      <div className="content-container">
        <div className="text-center py-20">
          <p className="text-muted">章节不存在</p>
          <Link href="/novels" className="btn-primary mt-4 inline-block">
            返回首页
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-16 z-40 bg-surface/80 backdrop-blur-md border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={`/novels/${chapter.novelId}`}
                className="p-2 rounded-lg hover:bg-muted/10 transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-muted" />
              </Link>
              <div>
                <span className="tag text-xs">
                  第 {chapter.chapterNumber} 章
                </span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted">
                {wordCount.toLocaleString()} 字
              </span>
              {lastSaved && (
                <span className="text-xs text-muted">
                  已保存于 {lastSaved.toLocaleTimeString()}
                </span>
              )}
              <button
                onClick={handleManualSave}
                disabled={isSaving}
                className="btn-secondary flex items-center gap-2 text-sm py-2"
              >
                <Save className="w-4 h-4" />
                {isSaving ? "保存中..." : "保存"}
              </button>
              <Link
                href={`/ai-outline?novelId=${chapter.novelId}&chapterId=${chapterId}`}
                className="btn-secondary flex items-center gap-2 text-sm py-2"
              >
                <Sparkles className="w-4 h-4" />
                AI 规划
              </Link>
              <Link
                href={`/ai-expand?novelId=${chapter.novelId}&chapterId=${chapterId}`}
                className="btn-primary flex items-center gap-2 text-sm py-2"
              >
                <Sparkles className="w-4 h-4" />
                AI 扩写
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Editor */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Title Input */}
        <input
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          className="w-full text-2xl font-serif font-bold text-foreground bg-transparent border-none outline-none mb-6 placeholder:text-muted/50"
          placeholder="章节标题"
        />

        {/* Content Editor */}
        <textarea
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          className="w-full min-h-[60vh] text-lg leading-relaxed text-foreground bg-transparent border-none outline-none resize-none placeholder:text-muted/50 font-serif"
          placeholder="开始写作..."
        />
      </div>
    </div>
  );
}
