"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Sparkles, Eye, Save, RefreshCw } from "lucide-react";

type PartType = "body" | "introduction" | "conclusion" | "abstract" | "title";

type Draft = {
  zh: string;
  en: string;
  keywordsZh?: string;
  keywordsEn?: string;
  providerUsed?: "vertex" | "pgvector";
  sources?: Array<{
    provider: "vertex" | "pgvector";
    title?: string;
    uri?: string;
    snippet: string;
    score?: number;
  }>;
};

function partLabel(part: PartType) {
  if (part === "body") return "生成文章主体";
  if (part === "introduction") return "生成简介";
  if (part === "conclusion") return "生成结论";
  if (part === "abstract") return "生成摘要";
  return "生成标题";
}

function savedLabel(part: PartType) {
  if (part === "body") return "文章主体";
  if (part === "introduction") return "简介";
  if (part === "conclusion") return "结论";
  if (part === "abstract") return "摘要";
  return "标题";
}

export default function PaperWritingPage() {
  const searchParams = useSearchParams();
  const paperId = Number(searchParams.get("paperId"));

  const [activePart, setActivePart] = useState<PartType | null>(null);
  const [drafts, setDrafts] = useState<Partial<Record<PartType, Draft>>>({});
  const [viewPart, setViewPart] = useState<PartType | null>(null);
  const [viewLang, setViewLang] = useState<"zh" | "en">("zh");

  const utils = trpc.useUtils();

  const latestQuery = trpc.paperWriting.getLatest.useQuery(
    { paperId },
    { enabled: Number.isFinite(paperId) && paperId > 0 }
  );

  const generatePart = trpc.paperWriting.generatePart.useMutation({
    onSuccess: (data, variables) => {
      setDrafts((prev) => ({
        ...prev,
        [variables.partType]: data,
      }));
      setViewPart(variables.partType);
      setViewLang("zh");
      setActivePart(null);
    },
    onError: () => {
      setActivePart(null);
    },
  });

  const savePart = trpc.paperWriting.savePart.useMutation({
    onSuccess: (_data, variables) => {
      utils.paperWriting.getLatest.invalidate({ paperId });
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[variables.partType];
        return next;
      });
    },
  });

  const isLocked = generatePart.isPending || savePart.isPending;

  const savedContent = useMemo(() => {
    const d = latestQuery.data;
    if (!d) return null;
    return {
      title: { zh: d.aiTitleZh || "", en: d.aiTitleEn || "" },
      abstract: {
        zh: d.aiAbstractZh || "",
        en: d.aiAbstractEn || "",
        keywordsZh: d.aiKeywordsZh || "",
        keywordsEn: d.aiKeywordsEn || "",
      },
      introduction: { zh: d.aiIntroductionZh || "", en: d.aiIntroductionEn || "" },
      body: { zh: d.aiBodyZh || "", en: d.aiBodyEn || "" },
      conclusion: { zh: d.aiConclusionZh || "", en: d.aiConclusionEn || "" },
    } as Record<PartType, Draft>;
  }, [latestQuery.data]);

  const parts: PartType[] = ["body", "introduction", "conclusion", "abstract", "title"];

  const handleGenerate = async (partType: PartType) => {
    if (!paperId || isLocked) return;
    setActivePart(partType);
    await generatePart.mutateAsync({ paperId, partType });
  };

  const handleOpenView = (partType: PartType) => {
    setViewPart(partType);
    setViewLang("zh");
  };

  const viewDraft = viewPart ? drafts[viewPart] : null;
  const viewSaved = viewPart && savedContent ? savedContent[viewPart] : null;
  const displayed = viewDraft || viewSaved;

  const canSaveCurrent = Boolean(viewPart && viewDraft && viewDraft.zh && viewDraft.en);

  const handleSave = async () => {
    if (!paperId || !viewPart || !viewDraft) return;
    await savePart.mutateAsync({
      paperId,
      partType: viewPart,
      zh: viewDraft.zh,
      en: viewDraft.en,
      keywordsZh: viewPart === "abstract" ? viewDraft.keywordsZh : undefined,
      keywordsEn: viewPart === "abstract" ? viewDraft.keywordsEn : undefined,
    });
  };

  if (!paperId) {
    return (
      <div className="content-container">
        <div className="text-center py-20">
          <p className="text-muted">请从论文详情页进入</p>
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
          href={`/papers/${paperId}`}
          className="p-2 rounded-lg hover:bg-muted/10 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-muted" />
        </Link>
        <div>
          <h1 className="page-title mb-0">全文撰写</h1>
          <p className="text-muted text-sm">生成后可查看详情，确认保存后覆盖为最新内容</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {parts.map((part) => {
          const hasDraft = Boolean(drafts[part]);
          const hasSaved = Boolean(
            savedContent &&
              (savedContent[part].zh?.trim() || savedContent[part].en?.trim())
          );
          const showView = hasDraft || hasSaved;

          return (
            <div key={part} className="card flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium text-foreground">{savedLabel(part)}</div>
                <div className="text-xs text-muted">
                  {hasDraft ? "已生成草稿（未保存）" : hasSaved ? "已保存最新内容" : "未生成"}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {showView && (
                  <button
                    onClick={() => handleOpenView(part)}
                    disabled={isLocked}
                    className="btn-secondary flex items-center gap-2 text-sm py-2 disabled:opacity-50"
                  >
                    <Eye className="w-4 h-4" />
                    查看详细内容
                  </button>
                )}

                <button
                  onClick={() => {
                    handleGenerate(part).catch(console.error);
                  }}
                  disabled={isLocked}
                  className="btn-primary flex items-center gap-2 text-sm py-2 disabled:opacity-50"
                >
                  {activePart === part && generatePart.isPending ? (
                    <>
                      <Sparkles className="w-4 h-4" />
                      生成中...
                    </>
                  ) : hasDraft || hasSaved ? (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      重新生成
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      {partLabel(part)}
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {generatePart.isError && (
        <div className="card bg-error/10 border-error/20 mt-6">
          <p className="text-error">生成失败：{generatePart.error.message}</p>
        </div>
      )}

      {savePart.isError && (
        <div className="card bg-error/10 border-error/20 mt-6">
          <p className="text-error">保存失败：{savePart.error.message}</p>
        </div>
      )}

      {viewPart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="card w-full max-w-3xl mx-4 max-h-[85vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between gap-4 pb-3 border-b border-border">
              <div className="min-w-0">
                <div className="text-lg font-serif font-semibold text-foreground">
                  {savedLabel(viewPart)}
                </div>
                <div className="text-xs text-muted">
                  {viewDraft ? "草稿预览（未保存）" : "已保存内容"}
                </div>
              </div>
              <button
                onClick={() => setViewPart(null)}
                className="btn-secondary text-sm py-2"
              >
                关闭
              </button>
            </div>

            <div className="pt-4 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex gap-2">
                <button
                  onClick={() => setViewLang("zh")}
                  className={`px-3 py-1 rounded-lg text-sm border transition-colors ${
                    viewLang === "zh"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted hover:text-foreground hover:border-primary/40"
                  }`}
                >
                  中文
                </button>
                <button
                  onClick={() => setViewLang("en")}
                  className={`px-3 py-1 rounded-lg text-sm border transition-colors ${
                    viewLang === "en"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted hover:text-foreground hover:border-primary/40"
                  }`}
                >
                  English
                </button>
              </div>

              {canSaveCurrent && (
                <button
                  onClick={() => {
                    handleSave().catch(console.error);
                  }}
                  disabled={savePart.isPending}
                  className="btn-primary flex items-center gap-2 text-sm py-2 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {savePart.isPending ? "保存中..." : "保存为最新内容"}
                </button>
              )}
            </div>

            <div className="mt-4 flex-1 overflow-y-auto rounded-lg border border-border bg-surface/40 p-4">
              {!displayed && <div className="text-sm text-muted">暂无内容</div>}

              {displayed && (
                <div className="whitespace-pre-wrap leading-relaxed text-foreground font-serif">
                  {viewLang === "zh" ? displayed.zh : displayed.en}
                </div>
              )}

              {viewPart === "abstract" && displayed && (
                <div className="mt-6 pt-4 border-t border-border">
                  <div className="text-sm font-medium text-foreground mb-2">
                    {viewLang === "zh" ? "关键词" : "Keywords"}
                  </div>
                  <div className="text-sm text-foreground whitespace-pre-wrap">
                    {viewLang === "zh"
                      ? displayed.keywordsZh || ""
                      : displayed.keywordsEn || ""}
                  </div>
                </div>
              )}

              {displayed?.sources && displayed.sources.length > 0 && (
                <details className="mt-6 pt-4 border-t border-border">
                  <summary className="cursor-pointer text-sm text-foreground">
                    来源（{displayed.providerUsed === "vertex" ? "Vertex RAG" : "pgvector 回退"}）
                  </summary>
                  <div className="mt-3 space-y-3">
                    {displayed.sources.slice(0, 12).map((source, index) => (
                      <div key={`${source.provider}-${index}`} className="rounded-lg border border-border p-3">
                        <div className="text-xs text-muted mb-1">
                          {source.provider === "vertex" ? "Vertex" : "pgvector"}
                          {typeof source.score === "number"
                            ? ` · score=${source.score.toFixed(3)}`
                            : ""}
                        </div>
                        {source.title && (
                          <div className="text-sm font-medium text-foreground mb-1">
                            {source.title}
                          </div>
                        )}
                        {source.uri && (
                          <a
                            href={source.uri}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-primary hover:underline break-all"
                          >
                            {source.uri}
                          </a>
                        )}
                        <div className="text-sm text-foreground whitespace-pre-wrap mt-1">
                          {source.snippet}
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
