"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Download, FileText } from "lucide-react";

export default function PaperExportPage() {
  const searchParams = useSearchParams();
  const paperId = Number(searchParams.get("paperId"));
  const [isExporting, setIsExporting] = useState(false);
  const [result, setResult] = useState<null | {
    zh: { downloadUrl: string; filename: string };
    en: { downloadUrl: string; filename: string };
  }>(null);

  const exportDocx = trpc.paperExport.docx.useMutation();

  const handleExport = async () => {
    if (!paperId) return;
    setIsExporting(true);
    setResult(null);

    try {
      const data = await exportDocx.mutateAsync({ paperId });
      setResult(data);
    } catch (error) {
      console.error("Paper docx export failed", error);
    } finally {
      setIsExporting(false);
    }
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
          <h1 className="page-title mb-0">导出论文</h1>
          <p className="text-muted text-sm">生成 Word 文档（中文/英文各一份）</p>
        </div>
      </div>

      <div className="card mb-6">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-lg bg-muted/10 text-muted">
            <FileText className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-foreground">Word（.docx）</h3>
            <p className="text-sm text-muted">
              将按顺序导出：标题、摘要、简介、文章主体（含图片）、结论
            </p>
          </div>
        </div>
      </div>

      <button
        onClick={handleExport}
        disabled={isExporting}
        className="btn-primary flex items-center gap-2"
      >
        <Download className="w-4 h-4" />
        {isExporting ? "导出中..." : "生成并获取下载链接"}
      </button>

      {exportDocx.isError && (
        <div className="card bg-error/10 border-error/20 mt-6">
          <p className="text-error">导出失败：{exportDocx.error.message}</p>
        </div>
      )}

      {result && (
        <div className="mt-6 space-y-3">
          <a
            href={result.zh.downloadUrl}
            download={result.zh.filename}
            className="btn-secondary inline-flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            下载中文 Word
          </a>
          <a
            href={result.en.downloadUrl}
            download={result.en.filename}
            className="btn-secondary inline-flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            下载英文 Word
          </a>
        </div>
      )}
    </div>
  );
}

