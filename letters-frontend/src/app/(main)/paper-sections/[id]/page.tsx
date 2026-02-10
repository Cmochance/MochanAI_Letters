"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { countWords } from "@/lib/utils";
import { ArrowLeft, Save, Sparkles } from "lucide-react";
import { useDebouncedCallback } from "@/hooks/use-debounce";

export default function PaperSectionDetailPage() {
  const params = useParams();
  const sectionId = Number(params.id);

  const [title, setTitle] = useState("");
  const [activeLang, setActiveLang] = useState<"zh" | "en">("zh");
  const [contentZh, setContentZh] = useState("");
  const [contentEn, setContentEn] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const { data: section, isLoading } = trpc.paperSections.get.useQuery(
    { id: sectionId },
    { enabled: Number.isFinite(sectionId) && sectionId > 0 }
  );

  const updateSection = trpc.paperSections.update.useMutation({
    onSuccess: () => {
      setLastSaved(new Date());
      setIsSaving(false);
    },
    onError: () => {
      setIsSaving(false);
    },
  });

  useEffect(() => {
    if (section) {
      setTitle(section.title);
      setContentZh(section.content);
      setContentEn(section.contentEn || "");
    }
  }, [section]);

  const debouncedSave = useDebouncedCallback(
    useCallback(
      (payload: { title?: string; content?: string; contentEn?: string }) => {
        if (!section) return;
        setIsSaving(true);
        updateSection.mutate({
          id: sectionId,
          ...payload,
        });
      },
      [section, sectionId, updateSection]
    ),
    1800
  );

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    debouncedSave({ title: newTitle });
  };

  const handleContentChange = (newContent: string) => {
    if (activeLang === "zh") {
      setContentZh(newContent);
      debouncedSave({ content: newContent });
      return;
    }
    setContentEn(newContent);
    debouncedSave({ contentEn: newContent });
  };

  const handleManualSave = () => {
    if (!section) return;
    setIsSaving(true);
    updateSection.mutate({
      id: sectionId,
      title,
      content: contentZh,
      contentEn,
    });
  };

  const wordCount = countWords(activeLang === "zh" ? contentZh : contentEn);

  if (isLoading) {
    return (
      <div className="content-container">
        <div className="flex items-center justify-center py-20">
          <div className="text-muted">加载中...</div>
        </div>
      </div>
    );
  }

  if (!section) {
    return (
      <div className="content-container">
        <div className="text-center py-20">
          <p className="text-muted">小节不存在</p>
          <Link href="/papers" className="btn-primary mt-4 inline-block">
            返回论文列表
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-16 z-40 bg-surface/80 backdrop-blur-md border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={`/papers/${section.paperId}`}
                className="p-2 rounded-lg hover:bg-muted/10 transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-muted" />
              </Link>
              <div>
                <span className="tag text-xs">第 {section.sectionNumber} 节</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted">{wordCount.toLocaleString()} 字</span>
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
                href={`/paper-ai-expand?paperId=${section.paperId}&sectionId=${sectionId}`}
                className="btn-primary flex items-center gap-2 text-sm py-2"
              >
                <Sparkles className="w-4 h-4" />
                AI 扩写
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {section.figureUrl && (
          <div className="mb-8">
            <img
              src={section.figureUrl}
              alt={section.title}
              className="w-full rounded-xl border border-border bg-surface/40"
            />
            {(section.figureCaptionZh || section.figureCaptionEn) && (
              <p className="text-sm text-muted mt-3 text-center italic whitespace-pre-wrap">
                {activeLang === "zh"
                  ? section.figureCaptionZh || ""
                  : section.figureCaptionEn || ""}
              </p>
            )}
          </div>
        )}

        <input
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          className="w-full text-2xl font-serif font-bold text-foreground bg-transparent border-none outline-none mb-6 placeholder:text-muted/50"
          placeholder="小节标题"
        />

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveLang("zh")}
            className={`px-3 py-1 rounded-lg text-sm border transition-colors ${
              activeLang === "zh"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted hover:text-foreground hover:border-primary/40"
            }`}
          >
            中文
          </button>
          <button
            onClick={() => setActiveLang("en")}
            className={`px-3 py-1 rounded-lg text-sm border transition-colors ${
              activeLang === "en"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted hover:text-foreground hover:border-primary/40"
            }`}
          >
            English
          </button>
        </div>

        <textarea
          value={activeLang === "zh" ? contentZh : contentEn}
          onChange={(e) => handleContentChange(e.target.value)}
          className="w-full min-h-[60vh] text-lg leading-relaxed text-foreground bg-transparent border-none outline-none resize-none placeholder:text-muted/50 font-serif"
          placeholder="开始写作学术内容..."
        />
      </div>
    </div>
  );
}
