"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/use-auth";
import { Save, Key, Server, Bot, PenTool, Database } from "lucide-react";

export default function SettingsPage() {
  const { user } = useAuth();
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const [formData, setFormData] = useState({
    apiKey: "",
    apiBaseUrl: "",
    modelName: "",
    writingStyle: "",
    embeddingApiKey: "",
    embeddingBaseUrl: "",
    embeddingModel: "",
  });
  const [isSaved, setIsSaved] = useState(false);

  const { data: settings, isLoading } = trpc.settings.get.useQuery();
  const updateSettings = trpc.settings.update.useMutation({
    onSuccess: () => {
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    },
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        apiKey: settings.apiKey || "",
        apiBaseUrl: settings.apiBaseUrl || "",
        modelName: settings.modelName || "",
        writingStyle: settings.writingStyle || "",
        embeddingApiKey: settings.embeddingApiKey || "",
        embeddingBaseUrl: settings.embeddingBaseUrl || "",
        embeddingModel: settings.embeddingModel || "",
      });
    }
  }, [settings]);

  const handleSave = () => {
    updateSettings.mutate({
      apiKey: formData.apiKey || undefined,
      apiBaseUrl: formData.apiBaseUrl || undefined,
      modelName: formData.modelName || undefined,
      writingStyle: formData.writingStyle || undefined,
      embeddingApiKey: formData.embeddingApiKey || undefined,
      embeddingBaseUrl: formData.embeddingBaseUrl || undefined,
      embeddingModel: formData.embeddingModel || undefined,
    });
  };

  return (
    <div className="content-container">
      <h1 className="page-title">{t("title")}</h1>

      {/* User Info */}
      <div className="card mb-6">
        <h2 className="section-title flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <PenTool className="w-5 h-5 text-primary" />
          </div>
          {t("account")}
        </h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-border">
            <span className="text-muted">Email</span>
            <span className="text-foreground">{user?.email}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-muted">User ID</span>
            <span className="text-foreground text-sm font-mono">
              {user?.id?.slice(0, 8)}...
            </span>
          </div>
        </div>
      </div>

      {/* AI Settings */}
      <div className="card mb-6">
        <h2 className="section-title flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <Bot className="w-5 h-5 text-primary" />
          </div>
          {t("aiConfig")}
        </h2>
        <p className="text-sm text-muted mb-6">
          {t("useBuiltIn")} / {t("useCustom")}
        </p>

        {isLoading ? (
          <div className="text-muted">{tc("loading")}</div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium mb-2">
                <Key className="w-4 h-4 text-muted" />
                {t("apiKey")}
              </label>
              <input
                type="password"
                value={formData.apiKey}
                onChange={(e) =>
                  setFormData({ ...formData, apiKey: e.target.value })
                }
                className="input"
                placeholder={t("apiKeyPlaceholder")}
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium mb-2">
                <Server className="w-4 h-4 text-muted" />
                {t("baseUrl")}
              </label>
              <input
                type="text"
                value={formData.apiBaseUrl}
                onChange={(e) =>
                  setFormData({ ...formData, apiBaseUrl: e.target.value })
                }
                className="input"
                placeholder={t("baseUrlPlaceholder")}
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium mb-2">
                <Bot className="w-4 h-4 text-muted" />
                {t("modelName")}
              </label>
              <input
                type="text"
                value={formData.modelName}
                onChange={(e) =>
                  setFormData({ ...formData, modelName: e.target.value })
                }
                className="input"
                placeholder={t("modelNamePlaceholder")}
              />
            </div>
          </div>
        )}
      </div>

      {/* Embedding Settings */}
      <div className="card mb-6">
        <h2 className="section-title flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <Database className="w-5 h-5 text-primary" />
          </div>
          {t("embeddingConfig")}
        </h2>
        <p className="text-sm text-muted mb-6">
          {t("useBuiltIn")} / {t("useCustom")}
        </p>

        {isLoading ? (
          <div className="text-muted">{tc("loading")}</div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium mb-2">
                <Key className="w-4 h-4 text-muted" />
                {t("embeddingApiKey")}
              </label>
              <input
                type="password"
                value={formData.embeddingApiKey}
                onChange={(e) =>
                  setFormData({ ...formData, embeddingApiKey: e.target.value })
                }
                className="input"
                placeholder={t("apiKeyPlaceholder")}
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium mb-2">
                <Server className="w-4 h-4 text-muted" />
                {t("embeddingBaseUrl")}
              </label>
              <input
                type="text"
                value={formData.embeddingBaseUrl}
                onChange={(e) =>
                  setFormData({ ...formData, embeddingBaseUrl: e.target.value })
                }
                className="input"
                placeholder={t("baseUrlPlaceholder")}
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium mb-2">
                <Bot className="w-4 h-4 text-muted" />
                {t("embeddingModel")}
              </label>
              <input
                type="text"
                value={formData.embeddingModel}
                onChange={(e) =>
                  setFormData({ ...formData, embeddingModel: e.target.value })
                }
                className="input"
                placeholder={t("embeddingModelPlaceholder")}
              />
            </div>
          </div>
        )}
      </div>

      {/* Writing Style */}
      <div className="card mb-6">
        <h2 className="section-title flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <PenTool className="w-5 h-5 text-primary" />
          </div>
          {t("writingStyle")}
        </h2>
        <textarea
          value={formData.writingStyle}
          onChange={(e) =>
            setFormData({ ...formData, writingStyle: e.target.value })
          }
          className="textarea"
          placeholder={t("writingStylePlaceholder")}
          rows={4}
        />
      </div>

      {/* Save Button */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={updateSettings.isPending}
          className="btn-primary flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          {updateSettings.isPending ? tc("loading") : tc("save")}
        </button>
        {isSaved && <span className="text-success text-sm">{t("saveSuccess")}</span>}
      </div>
    </div>
  );
}
