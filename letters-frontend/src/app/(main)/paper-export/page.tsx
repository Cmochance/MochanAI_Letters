"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Download, FileText, FileCode } from "lucide-react";

type ExportFormat = "txt" | "markdown";

export default function PaperExportPage() {
  const searchParams = useSearchParams();
  const paperId = Number(searchParams.get("paperId"));
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>("txt");
  const [isExporting, setIsExporting] = useState(false);

  const exportTxt = trpc.paperExport.txt.useMutation();
  const exportMarkdown = trpc.paperExport.markdown.useMutation();

  const formats = [
    {
      value: "txt" as const,
      label: "纯文本",
      description: "TXT 格式，兼容性最好",
      icon: FileText,
    },
    {
      value: "markdown" as const,
      label: "Markdown",
      description: "保留结构与标题层级",
      icon: FileCode,
    },
  ];

  const handleExport = async () => {
    if (!paperId) return;
    setIsExporting(true);

    try {
      let result: { content: string; filename: string };

      if (selectedFormat === "txt") {
        result = await exportTxt.mutateAsync({ paperId });
      } else {
        result = await exportMarkdown.mutateAsync({ paperId });
      }

      downloadTextFile(result.content, result.filename);
    } catch (error) {
      console.error("Paper export failed", error);
    } finally {
      setIsExporting(false);
    }
  };

  const downloadTextFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
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
          <p className="text-muted text-sm">选择格式并下载论文</p>
        </div>
      </div>

      <div className="space-y-3 mb-8">
        {formats.map((format) => {
          const Icon = format.icon;
          return (
            <button
              key={format.value}
              onClick={() => setSelectedFormat(format.value)}
              className={`card w-full text-left flex items-center gap-4 transition-all ${
                selectedFormat === format.value
                  ? "border-primary bg-primary/5"
                  : "hover:border-primary/30"
              }`}
            >
              <div
                className={`p-3 rounded-lg ${
                  selectedFormat === format.value
                    ? "bg-primary text-white"
                    : "bg-muted/10 text-muted"
                }`}
              >
                <Icon className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-foreground">{format.label}</h3>
                <p className="text-sm text-muted">{format.description}</p>
              </div>
              <div
                className={`w-5 h-5 rounded-full border-2 ${
                  selectedFormat === format.value
                    ? "border-primary bg-primary"
                    : "border-border"
                }`}
              />
            </button>
          );
        })}
      </div>

      <button
        onClick={handleExport}
        disabled={isExporting}
        className="btn-primary flex items-center gap-2"
      >
        <Download className="w-4 h-4" />
        {isExporting ? "导出中..." : "开始导出"}
      </button>
    </div>
  );
}
