"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { formatRelativeTime } from "@/lib/utils";
import {
  ArrowLeft,
  FileText,
  Trash2,
  Sparkles,
  Download,
  NotebookPen,
  Upload,
} from "lucide-react";

type PaperDataType =
  | "line_chart"
  | "bar_chart"
  | "stacked_bar_chart"
  | "scatter_plot"
  | "histogram"
  | "box_plot"
  | "heatmap"
  | "pie_chart"
  | "table"
  | "map"
  | "other";

export default function PaperDetailPage() {
  const params = useParams();
  const router = useRouter();
  const paperId = Number(params.id);

  const [isUploadingFigure, setIsUploadingFigure] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedFigure, setUploadedFigure] = useState<{
    key: string;
    url: string;
    contentType: string;
    filename: string;
  } | null>(null);
  const [analysisResult, setAnalysisResult] = useState<{
    dataType: PaperDataType;
    detailDescriptionZh: string;
    mainFeatures: string[];
    suggestedQueries: string[];
    analysisZh: string;
    analysisEn: string;
    captionZh: string;
    captionEn: string;
    existingSectionId: number | null;
    requiresConfirmReplace: boolean;
    webSearchEnabled?: boolean;
  } | null>(null);
  const [figureError, setFigureError] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const { data: paper, isLoading: isPaperLoading } = trpc.papers.get.useQuery(
    { id: paperId },
    { enabled: Number.isFinite(paperId) && paperId > 0 }
  );
  const { data: sections, isLoading: isSectionsLoading } =
    trpc.paperSections.list.useQuery(
      { paperId },
      { enabled: Number.isFinite(paperId) && paperId > 0 }
    );

  const getFigureUploadUrl = trpc.paperFiles.getFigureUploadUrl.useMutation();
  const deleteObject = trpc.paperFiles.deleteObject.useMutation();
  const analyzeFigure = trpc.paperFigures.analyze.useMutation();
  const saveFigure = trpc.paperFigures.save.useMutation();

  const deleteSection = trpc.paperSections.delete.useMutation({
    onSuccess: () => {
      utils.paperSections.list.invalidate({ paperId });
      utils.papers.list.invalidate();
    },
  });

  const resetFigureModal = async (options?: { cleanupUploaded?: boolean }) => {
    const cleanup = options?.cleanupUploaded ?? true;
    const key = uploadedFigure?.key;
    setIsUploadingFigure(false);
    setSelectedFile(null);
    setAnalysisResult(null);
    setFigureError(null);
    setUploadedFigure(null);

    if (cleanup && key) {
      try {
        await deleteObject.mutateAsync({ paperId, key });
      } catch (error) {
        console.error("Failed to cleanup uploaded figure", error);
      }
    }
  };

  const handleUploadAndAnalyze = async () => {
    if (!paperId || !selectedFile) return;
    setFigureError(null);
    setAnalysisResult(null);

    const contentType = selectedFile.type || "application/octet-stream";
    try {
      if (uploadedFigure?.key) {
        // Best-effort cleanup for previously uploaded (unsaved) object.
        try {
          await deleteObject.mutateAsync({ paperId, key: uploadedFigure.key });
        } catch (error) {
          console.error("Failed to cleanup previous uploaded figure", error);
        } finally {
          setUploadedFigure(null);
        }
      }

      const { key, uploadUrl, publicUrl } = await getFigureUploadUrl.mutateAsync({
        paperId,
        contentType,
        filename: selectedFile.name,
      });

      await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": contentType,
        },
        body: selectedFile,
      });

      const figureRef = {
        key,
        url: publicUrl,
        contentType,
        filename: selectedFile.name,
      };
      setUploadedFigure(figureRef);

      const result = await analyzeFigure.mutateAsync({
        paperId,
        figure: figureRef,
      });
      setAnalysisResult(result);
    } catch (error) {
      console.error("Figure upload/analyze failed", error);
      setFigureError(error instanceof Error ? error.message : "上传或分析失败");
    }
  };

  const handleSaveFigure = async () => {
    if (!paperId || !uploadedFigure || !analysisResult) return;

    if (analysisResult.requiresConfirmReplace) {
      const ok = confirm("该数据类型的小节已存在，是否确认替换为最新内容？");
      if (!ok) return;
    }

    try {
      const result = await saveFigure.mutateAsync({
        paperId,
        dataType: analysisResult.dataType,
        contentZh: analysisResult.analysisZh,
        contentEn: analysisResult.analysisEn,
        captionZh: analysisResult.captionZh,
        captionEn: analysisResult.captionEn,
        figure: uploadedFigure,
        confirmReplace: analysisResult.requiresConfirmReplace,
      });

      await utils.paperSections.list.invalidate({ paperId });
      await utils.papers.list.invalidate();

      // Close modal without deleting the saved object.
      await resetFigureModal({ cleanupUploaded: false });
      router.push(`/paper-sections/${result.sectionId}`);
    } catch (error) {
      console.error("Save figure failed", error);
      setFigureError(error instanceof Error ? error.message : "保存失败");
    }
  };

  const handleDeleteSection = (id: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm("确定要删除这一节吗？")) {
      deleteSection.mutate({ id });
    }
  };

  if (!Number.isFinite(paperId) || paperId <= 0) {
    return (
      <div className="content-container">
        <div className="text-center py-20">
          <p className="text-muted">论文参数无效</p>
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
          href="/papers"
          className="p-2 rounded-lg hover:bg-muted/10 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-muted" />
        </Link>
        <div className="flex-1">
          <h1 className="page-title mb-1">{paper?.title || "论文详情"}</h1>
          {paper?.description && <p className="text-muted">{paper.description}</p>}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-8">
        <button
          onClick={() => setIsUploadingFigure(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Upload className="w-4 h-4" />
          上传数据图
        </button>
        <Link
          href={`/paper-ai-outline?paperId=${paperId}`}
          className="btn-secondary flex items-center gap-2"
        >
          <Sparkles className="w-4 h-4" />
          全文撰写
        </Link>
        <Link
          href={`/papers/${paperId}/notes`}
          className="btn-secondary flex items-center gap-2"
        >
          <NotebookPen className="w-4 h-4" />
          研究笔记
        </Link>
        <Link
          href={`/paper-export?paperId=${paperId}`}
          className="btn-secondary flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          导出
        </Link>
      </div>

      {isUploadingFigure && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="card w-full max-w-md mx-4">
            <h2 className="text-xl font-serif font-semibold mb-4">上传数据图</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">选择图片</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="input"
                />
                {selectedFile && (
                  <p className="text-xs text-muted mt-2">
                    已选择：{selectedFile.name}（{Math.round(selectedFile.size / 1024)} KB）
                  </p>
                )}
              </div>

              {figureError && (
                <div className="p-3 rounded-lg bg-error/10 border border-error/20 text-error text-sm">
                  {figureError}
                </div>
              )}

              <button
                onClick={() => {
                  handleUploadAndAnalyze().catch(console.error);
                }}
                disabled={!selectedFile || getFigureUploadUrl.isPending || analyzeFigure.isPending}
                className="btn-primary w-full disabled:opacity-50"
              >
                {getFigureUploadUrl.isPending || analyzeFigure.isPending
                  ? "分析中..."
                  : "上传并分析"}
              </button>

              {analysisResult && (
                <div className="space-y-3 p-3 rounded-lg border border-border bg-surface/40">
                  <div className="text-sm">
                    <span className="tag mr-2">{analysisResult.dataType}</span>
                    {analysisResult.webSearchEnabled === false && (
                      <span className="text-xs text-muted">未启用 Web Search</span>
                    )}
                  </div>
                  {analysisResult.requiresConfirmReplace && (
                    <div className="p-2 rounded-lg bg-warning/10 border border-warning/20 text-sm text-foreground">
                      该数据类型的小节已存在，保存后将覆盖为最新内容。
                    </div>
                  )}
                  {analysisResult.detailDescriptionZh && (
                    <p className="text-sm text-foreground whitespace-pre-wrap">
                      {analysisResult.detailDescriptionZh}
                    </p>
                  )}
                  {analysisResult.mainFeatures?.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {analysisResult.mainFeatures.slice(0, 8).map((f) => (
                        <span key={f} className="tag text-xs">
                          {f}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="grid grid-cols-1 gap-2">
                    <div className="text-xs text-muted">图注（中文）</div>
                    <div className="text-sm text-foreground whitespace-pre-wrap">
                      {analysisResult.captionZh}
                    </div>
                    <div className="text-xs text-muted">Caption (EN)</div>
                    <div className="text-sm text-foreground whitespace-pre-wrap">
                      {analysisResult.captionEn}
                    </div>
                  </div>

                  <details className="rounded-lg border border-border bg-surface/30 p-3">
                    <summary className="cursor-pointer text-sm text-foreground">
                      查看分析内容（中英）
                    </summary>
                    <div className="mt-3 space-y-3">
                      <div>
                        <div className="text-xs text-muted mb-2">分析（中文）</div>
                        <textarea
                          readOnly
                          value={analysisResult.analysisZh}
                          className="textarea min-h-[140px]"
                        />
                      </div>
                      <div>
                        <div className="text-xs text-muted mb-2">Analysis (EN)</div>
                        <textarea
                          readOnly
                          value={analysisResult.analysisEn}
                          className="textarea min-h-[140px]"
                        />
                      </div>
                    </div>
                  </details>
                </div>
              )}

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    resetFigureModal().catch(console.error);
                  }}
                  className="btn-secondary"
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    handleSaveFigure().catch(console.error);
                  }}
                  disabled={!analysisResult || !uploadedFigure || saveFigure.isPending}
                  className="btn-primary disabled:opacity-50"
                >
                  {saveFigure.isPending
                    ? "保存中..."
                    : analysisResult?.requiresConfirmReplace
                      ? "替换并保存"
                      : "保存到小节"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {(isPaperLoading || isSectionsLoading) && (
        <div className="text-center py-20 text-muted">加载中...</div>
      )}

      {!isSectionsLoading && sections?.length === 0 && (
        <div className="text-center py-20">
          <FileText className="w-16 h-16 text-muted/30 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">还没有小节</h3>
          <p className="text-muted mb-6">上传数据图以生成分析小节</p>
          <button
            onClick={() => setIsUploadingFigure(true)}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            上传数据图
          </button>
        </div>
      )}

      {sections && sections.length > 0 && (
        <div className="space-y-3">
          {sections.map((section) => (
            <Link
              key={section.id}
              href={`/paper-sections/${section.id}`}
              className="card group flex items-center justify-between hover:border-primary/30 transition-all"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <span className="tag">第 {section.sectionNumber} 节</span>
                  <h3 className="font-medium text-foreground group-hover:text-primary transition-colors truncate">
                    {section.title}
                  </h3>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted">
                  <span>{section.wordCount.toLocaleString()} 字</span>
                  <span>{formatRelativeTime(section.updatedAt)}</span>
                </div>
              </div>
              <button
                onClick={(e) => handleDeleteSection(section.id, e)}
                className="p-2 rounded-lg text-muted hover:text-error hover:bg-error/10 opacity-0 group-hover:opacity-100 transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
