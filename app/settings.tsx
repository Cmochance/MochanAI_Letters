import { ScrollView, Text, View, TouchableOpacity, TextInput, Alert, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import { useState, useEffect } from "react";

export default function SettingsScreen() {
  const colors = useColors();

  const [apiKey, setApiKey] = useState("");
  const [apiBaseUrl, setApiBaseUrl] = useState("");
  const [modelName, setModelName] = useState("");
  const [writingStyle, setWritingStyle] = useState("");

  const { data: settings, isLoading } = trpc.settings.get.useQuery();
  const updateSettingsMutation = trpc.settings.update.useMutation({
    onSuccess: () => {
      Alert.alert("成功", "配置已保存");
    },
  });

  useEffect(() => {
    if (settings) {
      setApiKey(settings.apiKey || "");
      setApiBaseUrl(settings.apiBaseUrl || "");
      setModelName(settings.modelName || "");
      setWritingStyle(settings.writingStyle || "");
    }
  }, [settings]);

  const handleSave = () => {
    updateSettingsMutation.mutate({
      apiKey: apiKey.trim() || undefined,
      apiBaseUrl: apiBaseUrl.trim() || undefined,
      modelName: modelName.trim() || undefined,
      writingStyle: writingStyle.trim() || undefined,
    });
  };

  const handleTestConnection = () => {
    if (!apiKey.trim() || !apiBaseUrl.trim()) {
      Alert.alert("提示", "请先填写 API Key 和 Base URL");
      return;
    }

    // Simple test
    Alert.alert("提示", "连接测试功能开发中");
  };

  if (isLoading) {
    return (
      <ScreenContainer className="justify-center items-center">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="mt-4 text-muted">加载中...</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-4">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1">
          {/* Header */}
          <View className="mb-6">
            <TouchableOpacity onPress={() => router.back()}>
              <Text className="text-primary mb-2">← 返回</Text>
            </TouchableOpacity>
            <Text className="text-3xl font-bold text-foreground font-title">AI 配置</Text>
            <Text className="mt-1 text-muted">配置您的 AI 模型参数</Text>
          </View>

          {/* API Key */}
          <View className="mb-4">
            <Text className="text-sm font-semibold text-muted mb-2">API Key</Text>
            <TextInput
              className="bg-surface rounded-xl p-4 text-foreground text-base border border-border"
              value={apiKey}
              onChangeText={setApiKey}
              placeholder="sk-..."
              placeholderTextColor={colors.muted}
              secureTextEntry
              autoCapitalize="none"
            />
            <Text className="text-xs text-muted mt-1">
              您的 OpenAI 或兼容 API 的密钥
            </Text>
          </View>

          {/* Base URL */}
          <View className="mb-4">
            <Text className="text-sm font-semibold text-muted mb-2">Base URL</Text>
            <TextInput
              className="bg-surface rounded-xl p-4 text-foreground text-base border border-border"
              value={apiBaseUrl}
              onChangeText={setApiBaseUrl}
              placeholder="https://api.openai.com"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              keyboardType="url"
            />
            <Text className="text-xs text-muted mt-1">
              API 端点地址,支持自定义
            </Text>
          </View>

          {/* Model Name */}
          <View className="mb-4">
            <Text className="text-sm font-semibold text-muted mb-2">模型名称</Text>
            <TextInput
              className="bg-surface rounded-xl p-4 text-foreground text-base border border-border"
              value={modelName}
              onChangeText={setModelName}
              placeholder="gpt-4"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
            />
            <Text className="text-xs text-muted mt-1">
              使用的模型名称,如 gpt-4、claude-3 等
            </Text>
          </View>

          {/* Writing Style */}
          <View className="mb-6">
            <Text className="text-sm font-semibold text-muted mb-2">文笔风格</Text>
            <TextInput
              className="bg-surface rounded-xl p-4 text-foreground text-base border border-border"
              value={writingStyle}
              onChangeText={setWritingStyle}
              multiline
              numberOfLines={4}
              placeholder="简洁明快,注重情节推进..."
              placeholderTextColor={colors.muted}
              style={{ minHeight: 100 }}
            />
            <Text className="text-xs text-muted mt-1">
              描述您的写作风格,AI 将尝试模仿
            </Text>
          </View>

          {/* Action Buttons */}
          <View className="gap-3">
            <TouchableOpacity
              className="bg-primary py-4 rounded-full items-center active:opacity-80"
              onPress={handleSave}
              disabled={updateSettingsMutation.isPending}
            >
              <Text className="text-background font-semibold text-lg">
                {updateSettingsMutation.isPending ? "保存中..." : "保存配置"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="border border-primary py-4 rounded-full items-center active:opacity-70"
              onPress={handleTestConnection}
            >
              <Text className="text-primary font-semibold text-lg">
                测试连接
              </Text>
            </TouchableOpacity>
          </View>

          {/* Info */}
          <View className="mt-6 bg-surface rounded-xl p-4 border border-border">
            <Text className="text-sm text-muted">
              💡 提示:如果不配置自定义 API,将使用内置的 AI 模型。配置后,AI 章节规划和内容扩写功能将使用您的 API。
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
