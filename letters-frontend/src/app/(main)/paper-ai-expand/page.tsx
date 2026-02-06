"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { countWords } from "@/lib/utils";
import { ArrowLeft, Sparkles, Copy, Check, FileText, RefreshCw } from "lucide-react";

export default function PaperAIExpandPage() {
  const searchParams = useSearchParams();
  const paperId = Number(searchParams.get("paperId"));
  const planDocumentId = Number(searchParams.get("planDocumentId"));
  const version = Number(searchParams.get("version"));
  const initialOutline = searchParams.get("outline") || "";

  const [outline, setOutline] = useState(initialOutline);
  const [targetWords, setTargetWords] = useState(2500);
  const [expandedContent, setExpandedContent] = useState("");
  const [copied, setCopied] = useState(false);
  const [jobId, setJobId] = useState<number | null>(null);

  const hasPlanDocumentId = Number.isFinite(planDocumentId) && planDocumentId > 0;
  const hasVersion = Number.isFinite(version) && version > 0;

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

  const expandContentAsync = trpc.paperAi.expandContentAsync.useMutation({
    onSuccess: (data) => {
      setExpandedContent("");
      setJobId(data.jobId);
    },
  });

  const expandJobQuery = trpc.paperAi.getExpandJob.useQuery(
    { jobId: jobId || -1 },
    {
      enabled: Boolean(jobId),
      refetchInterval(query) {
        const status = query.state.data?.status;
        if (status === "pending" || status === "running") {
          return 2000;
        }
        return false;
      },
    }
  );

  useEffect(() => {
    if (!expandJobQuery.data) return;
    if (expandJobQuery.data.status === "succeeded") {
      setExpandedContent(expandJobQuery.data.resultContent || "");
    }
  }, [expandJobQuery.data]);

  const handleExpand = () => {
    if (!paperId || !outline.trim()) return;
    expandContentAsync.mutate({
      paperId,
      outline,
      targetWords,
      planDocumentId: hasPlanDocumentId ? planDocumentId : undefined,
      version: hasVersion ? version : undefined,
    });
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(expandedContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
          <h1 className="page-title mb-0">AI 论文扩写</h1>
          <p className="text-muted text-sm">异步任务模式，支持轮询状态与失败重试</p>
        </div>
      </div>

      <div className="card mb-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">论文提纲</label>
            <textarea
              value={outline}
              onChange={(e) => setOutline(e.target.value)}
              className="textarea min-h-[220px]"
              placeholder="请输入论文小节提纲..."
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
                max={10000}
                step={500}
              />
            </div>
            <button
              onClick={handleExpand}
              disabled={expandContentAsync.isPending || !outline.trim()}
              className="btn-primary flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              {expandContentAsync.isPending ? "提交中..." : "开始异步扩写"}
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
          </div>

          <div className="prose prose-lg max-w-none">
            <div className="whitespace-pre-wrap leading-relaxed text-foreground font-serif">
              {expandedContent}
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button onClick={handleExpand} className="btn-secondary flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              重新提交任务
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
