"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Download, FileText, FileCode, Book } from "lucide-react";

type ExportFormat = "txt" | "markdown" | "epub";

export default function ExportPage() {
  const searchParams = useSearchParams();
  const novelId = Number(searchParams.get("novelId"));
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>("txt");
  const [isExporting, setIsExporting] = useState(false);

  const exportTxt = trpc.export.txt.useMutation();
  const exportMarkdown = trpc.export.markdown.useMutation();
  const exportEpub = trpc.export.epub.useMutation();

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
      description: "保留格式的文本文件",
      icon: FileCode,
    },
    {
      value: "epub" as const,
      label: "电子书",
      description: "ePub 格式，适配 Kindle、Apple Books",
      icon: Book,
    },
  ];

  const handleExport = async () => {
    if (!novelId) return;
    setIsExporting(true);

    try {
      let result: { content: string; filename: string };

      if (selectedFormat === "txt") {
        result = await exportTxt.mutateAsync({ novelId });
        downloadTextFile(result.content, result.filename);
      } else if (selectedFormat === "markdown") {
        result = await exportMarkdown.mutateAsync({ novelId });
        downloadTextFile(result.content, result.filename);
      } else if (selectedFormat === "epub") {
        result = await exportEpub.mutateAsync({ novelId });
        // ePub is base64 encoded
        downloadBase64File(result.content, result.filename, "application/epub+zip");
      }
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const downloadTextFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadBase64File = (
    base64: string,
    filename: string,
    mimeType: string
  ) => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
          <h1 className="page-title mb-0">导出小说</h1>
          <p className="text-muted text-sm">选择格式并下载您的作品</p>
        </div>
      </div>

      {/* Format Selection */}
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
              >
                {selectedFormat === format.value && (
                  <svg
                    className="w-full h-full text-white"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Export Button */}
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
