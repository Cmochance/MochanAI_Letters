"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { countWords } from "@/lib/utils";
import { ArrowLeft, Sparkles, Copy, Check, FileText } from "lucide-react";

export default function AIExpandPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const novelId = Number(searchParams.get("novelId"));
  const initialOutline = searchParams.get("outline") || "";

  const [outline, setOutline] = useState(initialOutline);
  const [targetWords, setTargetWords] = useState(4000);
  const [expandedContent, setExpandedContent] = useState("");
  const [copied, setCopied] = useState(false);

  const expandContent = trpc.ai.expandContent.useMutation({
    onSuccess: (data) => {
      setExpandedContent(data.content);
    },
  });

  const handleExpand = () => {
    if (!novelId || !outline.trim()) return;
    expandContent.mutate({ novelId, outline, targetWords });
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(expandedContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!novelId) {
    return (
      <div className="content-container">
        <div className="text-center py-20">
          <p className="text-muted">请从小说详情页进入</p>
          <Link href="/" className="btn-primary mt-4 inline-block">
            返回首页
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="content-container">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          href={`/novels/${novelId}`}
          className="p-2 rounded-lg hover:bg-muted/10 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-muted" />
        </Link>
        <div>
          <h1 className="page-title mb-0">AI 内容扩写</h1>
          <p className="text-muted text-sm">
            根据大纲扩写为完整章节内容
          </p>
        </div>
      </div>

      {/* Input */}
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
              <label className="block text-sm font-medium mb-2">
                目标字数
              </label>
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
              disabled={expandContent.isPending || !outline.trim()}
              className="btn-primary flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              {expandContent.isPending ? "生成中..." : "开始扩写"}
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {expandContent.isError && (
        <div className="card bg-error/10 border-error/20 mb-6">
          <p className="text-error">
            生成失败：{expandContent.error.message}
          </p>
        </div>
      )}

      {/* Loading */}
      {expandContent.isPending && (
        <div className="card mb-6">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-muted">
              AI 正在创作中，请稍候...（预计需要 30-60 秒）
            </span>
          </div>
        </div>
      )}

      {/* Result */}
      {expandedContent && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-primary" />
              <span className="font-medium">扩写结果</span>
              <span className="tag">
                {countWords(expandedContent).toLocaleString()} 字
              </span>
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
            <button onClick={handleExpand} className="btn-secondary">
              重新生成
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
