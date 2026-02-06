"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Sparkles, Copy, Check, History } from "lucide-react";

type OutlineState = {
  theme: string;
  framework: string;
  conflicts: string;
  interactions: string;
  planDocumentId: number;
  version: number;
} | null;

export default function PaperAIOutlinePage() {
  const searchParams = useSearchParams();
  const paperId = Number(searchParams.get("paperId"));

  const [sectionNumber, setSectionNumber] = useState(1);
  const [outline, setOutline] = useState<OutlineState>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);

  const utils = trpc.useUtils();

  const latestPlanQuery = trpc.plans.getLatest.useQuery(
    {
      workspaceType: "paper",
      workspaceId: paperId,
      sectionNumber,
    },
    {
      enabled: Number.isFinite(paperId) && paperId > 0,
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
      setRestored(false);
      setSelectedVersion(null);
      return;
    }

    setOutline({
      theme: latestPlanQuery.data.theme,
      framework: latestPlanQuery.data.framework,
      conflicts: latestPlanQuery.data.conflicts,
      interactions: latestPlanQuery.data.interactions,
      planDocumentId: latestPlanQuery.data.planDocumentId,
      version: latestPlanQuery.data.version,
    });
    setSelectedVersion(latestPlanQuery.data.version);
    setRestored(true);
  }, [latestPlanQuery.data]);

  const generateOutline = trpc.paperAi.generateOutline.useMutation({
    onSuccess: (data) => {
      setOutline({
        theme: data.theme,
        framework: data.framework,
        conflicts: data.conflicts,
        interactions: data.interactions,
        planDocumentId: data.planDocumentId,
        version: data.version,
      });
      setSelectedVersion(data.version);
      setRestored(false);
      utils.plans.getLatest.invalidate({
        workspaceType: "paper",
        workspaceId: paperId,
        sectionNumber,
      });
      utils.plans.listVersions.invalidate({
        planDocumentId: data.planDocumentId,
      });
    },
  });

  const handleGenerate = () => {
    if (!paperId) return;
    setRestored(false);
    generateOutline.mutate({ paperId, sectionNumber });
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
    setSelectedVersion(version);
    setRestored(true);
  };

  const outlineText = useMemo(() => {
    if (!outline) return "";
    return `${outline.theme}\n\n${outline.framework}\n\n${outline.conflicts}\n\n${outline.interactions}`;
  }, [outline]);

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
          <h1 className="page-title mb-0">AI 论文规划</h1>
          <p className="text-muted text-sm">生成后自动保存，可跨会话恢复</p>
        </div>
      </div>

      <div className="card mb-6">
        <div className="flex items-end gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-2">小节序号</label>
            <input
              type="number"
              value={sectionNumber}
              onChange={(e) => setSectionNumber(Number(e.target.value || 1))}
              className="input"
              min={1}
              placeholder="请输入小节序号"
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
            已恢复第 {sectionNumber} 节的最新规划（v{outline.version}）
          </div>
        )}
      </div>

      {generateOutline.isError && (
        <div className="card bg-error/10 border-error/20 mb-6">
          <p className="text-error">生成失败：{generateOutline.error.message}</p>
        </div>
      )}

      {outline && (
        <div className="space-y-4">
          <div className="card">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-sm text-muted">
                <History className="w-4 h-4" />
                当前版本：v{outline.version}
              </div>
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
            </div>
          </div>

          {[
            { key: "theme", label: "核心论点", content: outline.theme },
            { key: "framework", label: "论证结构", content: outline.framework },
            { key: "conflicts", label: "争议与风险", content: outline.conflicts },
            {
              key: "interactions",
              label: "证据与衔接",
              content: outline.interactions,
            },
          ].map((item) => (
            <div key={item.key} className="card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-serif font-semibold text-foreground">{item.label}</h3>
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

          <div className="flex gap-3">
            <Link
              href={`/paper-ai-expand?paperId=${paperId}&planDocumentId=${outline.planDocumentId}&version=${outline.version}`}
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
