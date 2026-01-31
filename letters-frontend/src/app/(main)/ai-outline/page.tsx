"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Sparkles, Copy, Check } from "lucide-react";

export default function AIOutlinePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const novelId = Number(searchParams.get("novelId"));

  const [chapterNumber, setChapterNumber] = useState(1);
  const [outline, setOutline] = useState<{
    theme: string;
    framework: string;
    conflicts: string;
    interactions: string;
  } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const generateOutline = trpc.ai.generateOutline.useMutation({
    onSuccess: (data) => {
      setOutline(data);
    },
  });

  const handleGenerate = () => {
    if (!novelId) return;
    generateOutline.mutate({ novelId, chapterNumber });
  };

  const handleCopy = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
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
          <h1 className="page-title mb-0">AI 章节规划</h1>
          <p className="text-muted text-sm">
            让 AI 帮你规划下一章的内容框架
          </p>
        </div>
      </div>

      {/* Input */}
      <div className="card mb-6">
        <div className="flex items-end gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-2">章节序号</label>
            <input
              type="number"
              value={chapterNumber}
              onChange={(e) => setChapterNumber(Number(e.target.value))}
              className="input"
              min={1}
              placeholder="请输入章节序号"
            />
          </div>
          <button
            onClick={handleGenerate}
            disabled={generateOutline.isPending}
            className="btn-primary flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            {generateOutline.isPending ? "生成中..." : "生成规划"}
          </button>
        </div>
      </div>

      {/* Error */}
      {generateOutline.isError && (
        <div className="card bg-error/10 border-error/20 mb-6">
          <p className="text-error">
            生成失败：{generateOutline.error.message}
          </p>
        </div>
      )}

      {/* Result */}
      {outline && (
        <div className="space-y-4">
          {[
            { key: "theme", label: "章节主题", content: outline.theme },
            { key: "framework", label: "情节框架", content: outline.framework },
            { key: "conflicts", label: "关键冲突", content: outline.conflicts },
            {
              key: "interactions",
              label: "人物互动",
              content: outline.interactions,
            },
          ].map((item) => (
            <div key={item.key} className="card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-serif font-semibold text-foreground">
                  {item.label}
                </h3>
                <button
                  onClick={() => handleCopy(item.content, item.key)}
                  className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-muted/10 transition-colors"
                >
                  {copied === item.key ? (
                    <Check className="w-4 h-4 text-success" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
              <p className="text-foreground whitespace-pre-wrap leading-relaxed">
                {item.content}
              </p>
            </div>
          ))}

          {/* Actions */}
          <div className="flex gap-3">
            <Link
              href={`/ai-expand?novelId=${novelId}&outline=${encodeURIComponent(
                `${outline.theme}\n\n${outline.framework}\n\n${outline.conflicts}\n\n${outline.interactions}`
              )}`}
              className="btn-primary flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              使用此规划扩写
            </Link>
            <button onClick={handleGenerate} className="btn-secondary">
              重新生成
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
