"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { countWords } from "@/lib/utils";
import {
  ArrowLeft,
  Sparkles,
  Copy,
  Check,
  FileText,
  RefreshCw,
  History,
  ChevronDown,
} from "lucide-react";

export default function AIExpandPage() {
  const searchParams = useSearchParams();
  const novelId = Number(searchParams.get("novelId"));
  const chapterId = Number(searchParams.get("chapterId"));
  const planDocumentId = Number(searchParams.get("planDocumentId"));
  const version = Number(searchParams.get("version"));
  const initialOutline = searchParams.get("outline") || "";

  const [outline, setOutline] = useState(initialOutline);
  const [targetWords, setTargetWords] = useState(4000);
  const [expandedContent, setExpandedContent] = useState("");
  const [copied, setCopied] = useState(false);
  const [jobId, setJobId] = useState<number | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [fallbackMode, setFallbackMode] = useState(false);
  const contentRef = useRef<HTMLDivElement | null>(null);

  const hasPlanDocumentId = Number.isFinite(planDocumentId) && planDocumentId > 0;
  const hasVersion = Number.isFinite(version) && version > 0;
  const hasChapterId = Number.isFinite(chapterId) && chapterId > 0;

  const planQuery = trpc.plans.getVersion.useQuery(
    {
      planDocumentId,
      version: hasVersion ? version : undefined,
    },
    {
      enabled: hasPlanDocumentId && !initialOutline,
    }
  );

  useEffect(() => {
    if (!planQuery.data || outline) return;
    const text = `${planQuery.data.theme}\n\n${planQuery.data.framework}\n\n${planQuery.data.conflicts}\n\n${planQuery.data.interactions}`;
    setOutline(text);
  }, [planQuery.data, outline]);

  const expandContentAsync = trpc.ai.expandContentAsync.useMutation({
    onSuccess: (data) => {
      setExpandedContent("");
      setJobId(data.jobId);
    },
  });
  const expandContentSync = trpc.ai.expandContent.useMutation({
    onSuccess: (data) => {
      setExpandedContent(data.content);
      setJobId(null);
    },
  });

  const saveChapter = trpc.chapters.update.useMutation({
    onSuccess: () => {
      setSaveNotice("已保存为当前章节内容");
      setTimeout(() => setSaveNotice(null), 2000);
    },
  });

  const activeJobId = selectedJobId ?? jobId;

  const expandJobQuery = trpc.ai.getExpandJob.useQuery(
    { jobId: activeJobId || -1 },
    {
      enabled: Boolean(activeJobId),
      refetchInterval(query) {
        const status = query.state.data?.status;
        if (status === "pending" || status === "running") {
          return 2000;
        }
        return false;
      },
    }
  );

  const expandJobsQuery = trpc.ai.listExpandJobs.useQuery(
    {
      novelId,
      chapterId: hasChapterId ? chapterId : undefined,
      limit: 10,
    },
    {
      enabled: Number.isFinite(novelId) && novelId > 0,
      refetchInterval(query) {
        const hasRunning = (query.state.data || []).some(
          (job) => job.status === "pending" || job.status === "running"
        );
        return hasRunning ? 5000 : false;
      },
    }
  );

  useEffect(() => {
    if (!expandJobQuery.data) return;
    if (expandJobQuery.data.status === "succeeded") {
      setExpandedContent(expandJobQuery.data.resultContent || "");
    }
  }, [expandJobQuery.data]);

  const handleExpand = async () => {
    if (!novelId || !outline.trim()) return;
    if (fallbackMode) {
      await expandContentSync.mutateAsync({
        novelId,
        chapterId: hasChapterId ? chapterId : undefined,
        outline,
        targetWords,
        planDocumentId: hasPlanDocumentId ? planDocumentId : undefined,
        version: hasVersion ? version : undefined,
      });
      return;
    }

    try {
      const data = await expandContentAsync.mutateAsync({
        novelId,
        chapterId: hasChapterId ? chapterId : undefined,
        outline,
        targetWords,
        planDocumentId: hasPlanDocumentId ? planDocumentId : undefined,
        version: hasVersion ? version : undefined,
      });
      setSelectedJobId(data.jobId);
    } catch (error) {
      console.error("Async expand failed, fallback to sync expand", error);
      setFallbackMode(true);
      await expandContentSync.mutateAsync({
        novelId,
        chapterId: hasChapterId ? chapterId : undefined,
        outline,
        targetWords,
        planDocumentId: hasPlanDocumentId ? planDocumentId : undefined,
        version: hasVersion ? version : undefined,
      });
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(expandedContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleScrollDown = () => {
    if (!contentRef.current) return;
    contentRef.current.scrollTo({
      top: contentRef.current.scrollHeight,
      behavior: "smooth",
    });
  };

  const handleSaveToChapter = () => {
    if (!hasChapterId || !expandedContent.trim()) return;
    if (!confirm("确定要用扩写结果覆盖当前章节内容吗？")) return;
    saveChapter.mutate({
      id: chapterId,
      content: expandedContent,
    });
  };

  const statusLabel = useMemo(() => {
    const status = expandJobQuery.data?.status;
    if (!status) return "";
    if (status === "pending") return "排队中";
    if (status === "running") return "生成中";
    if (status === "succeeded") return "已完成";
    if (status === "failed") return "失败";
    if (status === "canceled") return "已取消";
    return status;
  }, [expandJobQuery.data?.status]);

  if (!novelId) {
    return (
      <div className="content-container">
        <div className="text-center py-20">
          <p className="text-muted">请从小说详情页进入</p>
          <Link href="/novels" className="btn-primary mt-4 inline-block">
            返回小说列表
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="content-container">
      <div className="flex items-center gap-4 mb-8">
        <Link
          href={`/novels/${novelId}`}
          className="p-2 rounded-lg hover:bg-muted/10 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-muted" />
        </Link>
        <div>
          <h1 className="page-title mb-0">AI 内容扩写</h1>
          <p className="text-muted text-sm">异步任务模式，支持轮询状态与失败重试</p>
        </div>
      </div>

      <div className="card mb-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">章节大纲</label>
            <textarea
              value={outline}
              onChange={(e) => setOutline(e.target.value)}
              className="textarea min-h-[200px]"
              placeholder="请输入章节大纲，包括主题、情节框架、冲突点等..."
            />
          </div>
          <div className="flex items-end gap-4">
            <div className="w-48">
              <label className="block text-sm font-medium mb-2">目标字数</label>
              <input
                type="number"
                value={targetWords}
                onChange={(e) => setTargetWords(Number(e.target.value))}
                className="input"
                min={1000}
                max={12000}
                step={500}
              />
            </div>
            <button
              onClick={() => {
                handleExpand().catch(console.error);
              }}
              disabled={
                expandContentAsync.isPending ||
                expandContentSync.isPending ||
                !outline.trim()
              }
              className="btn-primary flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              {expandContentAsync.isPending || expandContentSync.isPending
                ? "提交中..."
                : fallbackMode
                  ? "开始同步扩写"
                  : "开始异步扩写"}
            </button>
          </div>
        </div>
      </div>

      {planQuery.isLoading && (
        <div className="card mb-6 text-muted">正在读取已保存规划...</div>
      )}

      {expandContentAsync.isError && (
        <div className="card bg-error/10 border-error/20 mb-6">
          <p className="text-error">提交失败：{expandContentAsync.error.message}</p>
        </div>
      )}

      {fallbackMode && (
        <div className="card mb-6 bg-warning/10 border-warning/20">
          <p className="text-foreground text-sm">
            异步任务接口异常，已自动回退为同步扩写模式。建议检查后端是否已执行最新数据库迁移。
          </p>
        </div>
      )}

      {expandJobQuery.data && (
        <div className="card mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {(expandJobQuery.data.status === "pending" ||
                expandJobQuery.data.status === "running") && (
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              )}
              <span className="text-muted">任务状态：{statusLabel}</span>
            </div>
            <span className="text-xs text-muted">任务 ID: {expandJobQuery.data.id}</span>
          </div>

          {expandJobQuery.data.status === "failed" && (
            <div className="mt-3 p-3 rounded-lg bg-error/10 border border-error/20 text-error text-sm">
              扩写失败：{expandJobQuery.data.errorMessage || "未知错误"}
            </div>
          )}
        </div>
      )}

      {expandedContent && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-primary" />
              <span className="font-medium">扩写结果</span>
              <span className="tag">{countWords(expandedContent).toLocaleString()} 字</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleScrollDown}
                className="btn-secondary flex items-center gap-2 text-sm py-2"
              >
                <ChevronDown className="w-4 h-4" />
                下滚
              </button>
              <button
                onClick={handleCopy}
                className="btn-secondary flex items-center gap-2 text-sm py-2"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-success" />
                    已复制
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    复制内容
                  </>
                )}
              </button>
              <button
                onClick={handleSaveToChapter}
                disabled={!hasChapterId || saveChapter.isPending}
                className="btn-primary flex items-center gap-2 text-sm py-2 disabled:opacity-50"
              >
                {saveChapter.isPending ? "保存中..." : "保存为当前章节"}
              </button>
            </div>
          </div>

          {saveNotice && (
            <div className="mb-4 p-3 rounded-lg bg-success/10 border border-success/20 text-success text-sm">
              {saveNotice}
            </div>
          )}

          <div
            ref={contentRef}
            className="prose prose-lg max-w-none max-h-[360px] overflow-y-auto rounded-lg border border-border bg-surface/40 p-4"
          >
            <div className="whitespace-pre-wrap leading-relaxed text-foreground font-serif">
              {expandedContent}
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={() => {
                handleExpand().catch(console.error);
              }}
              className="btn-secondary flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              {fallbackMode ? "重新同步生成" : "重新提交任务"}
            </button>
          </div>
          {!hasChapterId && (
            <div className="mt-3 text-xs text-muted">
              需从章节详情页进入，才能保存为当前章节。
            </div>
          )}
        </div>
      )}

      <div className="card mt-8">
        <div className="flex items-center gap-2 mb-4">
          <History className="w-4 h-4 text-muted" />
          <span className="text-sm text-muted">扩写任务记录</span>
        </div>
        {expandJobsQuery.isLoading && (
          <div className="text-muted text-sm">加载任务中...</div>
        )}
        {expandJobsQuery.data && expandJobsQuery.data.length === 0 && (
          <div className="text-muted text-sm">暂无任务记录</div>
        )}
        {expandJobsQuery.data && expandJobsQuery.data.length > 0 && (
          <div className="space-y-2">
            {expandJobsQuery.data.map((job) => (
              <button
                key={job.id}
                onClick={() => setSelectedJobId(job.id)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  activeJobId === job.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground">任务 #{job.id}</span>
                  <span className="text-xs text-muted">
                    {job.status === "pending"
                      ? "排队中"
                      : job.status === "running"
                        ? "生成中"
                        : job.status === "succeeded"
                          ? "已完成"
                          : job.status === "failed"
                            ? "失败"
                            : "已取消"}
                  </span>
                </div>
                <div className="text-xs text-muted mt-1">
                  创建时间：{new Date(job.createdAt).toLocaleString()}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
