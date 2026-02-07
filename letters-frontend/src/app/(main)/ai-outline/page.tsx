"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Sparkles, Copy, Check, History, Edit3, Save, X } from "lucide-react";

type OutlinePayload = {
  theme: string;
  framework: string;
  conflicts: string;
  interactions: string;
};

type OutlineState = (OutlinePayload & {
  planDocumentId: number;
  version: number;
}) | null;

export default function AIOutlinePage() {
  const searchParams = useSearchParams();
  const novelId = Number(searchParams.get("novelId"));

  const [chapterNumber, setChapterNumber] = useState(1);
  const [outline, setOutline] = useState<OutlineState>(null);
  const [draft, setDraft] = useState<OutlinePayload>({
    theme: "",
    framework: "",
    conflicts: "",
    interactions: "",
  });
  const [isEditing, setIsEditing] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);

  const utils = trpc.useUtils();

  const latestPlanQuery = trpc.plans.getLatest.useQuery(
    {
      workspaceType: "novel",
      workspaceId: novelId,
      sectionNumber: chapterNumber,
    },
    {
      enabled: Number.isFinite(novelId) && novelId > 0,
    }
  );

  const planDocumentId = outline?.planDocumentId ?? latestPlanQuery.data?.planDocumentId;

  const versionsQuery = trpc.plans.listVersions.useQuery(
    {
      planDocumentId: planDocumentId || -1,
    },
    {
      enabled: Boolean(planDocumentId),
    }
  );

  useEffect(() => {
    if (!latestPlanQuery.data) {
      setOutline(null);
      setDraft({ theme: "", framework: "", conflicts: "", interactions: "" });
      setRestored(false);
      setSelectedVersion(null);
      setIsEditing(false);
      return;
    }

    const nextOutline = {
      theme: latestPlanQuery.data.theme,
      framework: latestPlanQuery.data.framework,
      conflicts: latestPlanQuery.data.conflicts,
      interactions: latestPlanQuery.data.interactions,
      planDocumentId: latestPlanQuery.data.planDocumentId,
      version: latestPlanQuery.data.version,
    };

    setOutline(nextOutline);
    setDraft({
      theme: nextOutline.theme,
      framework: nextOutline.framework,
      conflicts: nextOutline.conflicts,
      interactions: nextOutline.interactions,
    });
    setSelectedVersion(latestPlanQuery.data.version);
    setRestored(true);
    setIsEditing(false);
  }, [latestPlanQuery.data]);

  const generateOutline = trpc.ai.generateOutline.useMutation({
    onSuccess: (data) => {
      const nextOutline = {
        theme: data.theme,
        framework: data.framework,
        conflicts: data.conflicts,
        interactions: data.interactions,
        planDocumentId: data.planDocumentId,
        version: data.version,
      };
      setOutline(nextOutline);
      setDraft({
        theme: nextOutline.theme,
        framework: nextOutline.framework,
        conflicts: nextOutline.conflicts,
        interactions: nextOutline.interactions,
      });
      setSelectedVersion(data.version);
      setRestored(false);
      setIsEditing(false);
      utils.plans.getLatest.invalidate({
        workspaceType: "novel",
        workspaceId: novelId,
        sectionNumber: chapterNumber,
      });
      utils.plans.listVersions.invalidate({
        planDocumentId: data.planDocumentId,
      });
    },
  });

  const saveVersion = trpc.plans.saveVersion.useMutation({
    onSuccess: (data) => {
      const nextOutline = {
        theme: data.theme,
        framework: data.framework,
        conflicts: data.conflicts,
        interactions: data.interactions,
        planDocumentId: data.planDocumentId,
        version: data.version,
      };
      setOutline(nextOutline);
      setDraft({
        theme: nextOutline.theme,
        framework: nextOutline.framework,
        conflicts: nextOutline.conflicts,
        interactions: nextOutline.interactions,
      });
      setSelectedVersion(data.version);
      setRestored(false);
      setIsEditing(false);
      utils.plans.listVersions.invalidate({
        planDocumentId: data.planDocumentId,
      });
      utils.plans.getLatest.invalidate({
        workspaceType: "novel",
        workspaceId: novelId,
        sectionNumber: chapterNumber,
      });
    },
  });

  const handleGenerate = () => {
    if (!novelId) return;
    setRestored(false);
    generateOutline.mutate({ novelId, chapterNumber });
  };

  const handleCopy = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleLoadVersion = async (version: number) => {
    if (!planDocumentId) return;

    const plan = await utils.plans.getVersion.fetch({
      planDocumentId,
      version,
    });

    if (!plan) return;

    setOutline({
      theme: plan.theme,
      framework: plan.framework,
      conflicts: plan.conflicts,
      interactions: plan.interactions,
      planDocumentId,
      version: plan.version,
    });
    setDraft({
      theme: plan.theme,
      framework: plan.framework,
      conflicts: plan.conflicts,
      interactions: plan.interactions,
    });
    setSelectedVersion(version);
    setRestored(true);
    setIsEditing(false);
  };

  const outlineText = useMemo(() => {
    if (!outline) return "";
    return `${outline.theme}\n\n${outline.framework}\n\n${outline.conflicts}\n\n${outline.interactions}`;
  }, [outline]);

  const handleDraftChange = (key: keyof OutlinePayload, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const handleStartEdit = () => {
    if (!outline) return;
    setDraft({
      theme: outline.theme,
      framework: outline.framework,
      conflicts: outline.conflicts,
      interactions: outline.interactions,
    });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    if (!outline) return;
    setDraft({
      theme: outline.theme,
      framework: outline.framework,
      conflicts: outline.conflicts,
      interactions: outline.interactions,
    });
    setIsEditing(false);
  };

  const handleSaveEdit = () => {
    if (!outline) return;
    saveVersion.mutate({
      planDocumentId: outline.planDocumentId,
      theme: draft.theme,
      framework: draft.framework,
      conflicts: draft.conflicts,
      interactions: draft.interactions,
    });
  };

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
          <h1 className="page-title mb-0">AI 章节规划</h1>
          <p className="text-muted text-sm">生成后自动保存，可跨会话恢复</p>
        </div>
      </div>

      <div className="card mb-6">
        <div className="flex items-end gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-2">章节序号</label>
            <input
              type="number"
              value={chapterNumber}
              onChange={(e) => setChapterNumber(Number(e.target.value || 1))}
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
            {generateOutline.isPending ? "生成中..." : "生成并保存规划"}
          </button>
        </div>

        {restored && outline && (
          <div className="mt-4 p-3 bg-primary/10 border border-primary/20 rounded-lg text-sm text-primary">
            已恢复第 {chapterNumber} 章的最新规划（v{outline.version}）
          </div>
        )}
      </div>

      {generateOutline.isError && (
        <div className="card bg-error/10 border-error/20 mb-6">
          <p className="text-error">生成失败：{generateOutline.error.message}</p>
        </div>
      )}

      {saveVersion.isError && (
        <div className="card bg-error/10 border-error/20 mb-6">
          <p className="text-error">保存失败：{saveVersion.error.message}</p>
        </div>
      )}

      {outline && (
        <div className="space-y-4">
          <div className="card">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2 text-sm text-muted">
                <History className="w-4 h-4" />
                当前版本：v{outline.version}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {versionsQuery.data && versionsQuery.data.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted">历史版本</span>
                    <select
                      value={selectedVersion || outline.version}
                      onChange={(event) => {
                        const version = Number(event.target.value);
                        if (Number.isFinite(version)) {
                          handleLoadVersion(version).catch(console.error);
                        }
                      }}
                      className="input py-2 min-w-[140px]"
                    >
                      {versionsQuery.data.map((version) => (
                        <option key={version.version} value={version.version}>
                          v{version.version}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {!isEditing && (
                  <button
                    onClick={handleStartEdit}
                    className="btn-secondary flex items-center gap-2"
                  >
                    <Edit3 className="w-4 h-4" />
                    编辑规划
                  </button>
                )}
                {isEditing && (
                  <>
                    <button
                      onClick={handleSaveEdit}
                      disabled={saveVersion.isPending}
                      className="btn-primary flex items-center gap-2"
                    >
                      <Save className="w-4 h-4" />
                      {saveVersion.isPending ? "保存中..." : "保存为新版本"}
                    </button>
                    <button onClick={handleCancelEdit} className="btn-secondary flex items-center gap-2">
                      <X className="w-4 h-4" />
                      取消编辑
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {([
            { key: "theme", label: "章节主题" },
            { key: "framework", label: "情节框架" },
            { key: "conflicts", label: "关键冲突" },
            { key: "interactions", label: "人物互动" },
          ] as Array<{ key: keyof OutlinePayload; label: string }>).map((item) => {
            const content = isEditing ? draft[item.key] : outline[item.key];
            return (
              <div key={item.key} className="card">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-serif font-semibold text-foreground">{item.label}</h3>
                  <button
                    onClick={() => handleCopy(content, item.key)}
                    className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-muted/10 transition-colors"
                  >
                    {copied === item.key ? (
                      <Check className="w-4 h-4 text-success" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {isEditing ? (
                  <textarea
                    value={content}
                    onChange={(event) => handleDraftChange(item.key, event.target.value)}
                    className="textarea min-h-[140px]"
                    placeholder={`请输入${item.label}`}
                  />
                ) : (
                  <p className="text-foreground whitespace-pre-wrap leading-relaxed">
                    {content}
                  </p>
                )}
              </div>
            );
          })}

          <div className="flex gap-3 flex-wrap">
            <Link
              href={`/ai-expand?novelId=${novelId}&planDocumentId=${outline.planDocumentId}&version=${outline.version}`}
              className="btn-primary flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              使用此规划扩写
            </Link>
            <button onClick={handleGenerate} className="btn-secondary">
              重新生成并保存新版本
            </button>
            <button onClick={() => handleCopy(outlineText, "all")} className="btn-secondary">
              {copied === "all" ? "已复制" : "复制全文"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
