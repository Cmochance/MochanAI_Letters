import { ScrollView, Text, View, TouchableOpacity, TextInput, Alert, ActivityIndicator, Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
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
  
  const exportBackupMutation = trpc.backup.export.useQuery(undefined, {
    enabled: false,
  });
  
  const handleExportBackup = async () => {
    try {
      const data = await exportBackupMutation.refetch();
      if (!data.data) {
        Alert.alert("错误", "导出失败");
        return;
      }
      
      const json = JSON.stringify(data.data, null, 2);
      const filename = `mowen_backup_${new Date().toISOString().split('T')[0]}.json`;
      
      if (Platform.OS === "web") {
        // Web: download file
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        Alert.alert("成功", "备份已下载");
      } else {
        // Mobile: save and share
        const fileUri = `${FileSystem.documentDirectory}${filename}`;
        await FileSystem.writeAsStringAsync(fileUri, json);
        await Sharing.shareAsync(fileUri);
      }
    } catch (error) {
      Alert.alert("错误", "导出失败: " + (error as Error).message);
    }
  };
  
  const handleImportBackup = () => {
    Alert.alert(
      "导入备份",
      "导入功能开发中。您可以在设备上使用文件管理器打开备份文件。",
      [{ text: "确定" }]
    );
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
          
          {/* Backup Section */}
          <View className="mt-8 pt-6 border-t border-border">
            <Text className="text-2xl font-bold text-foreground font-title mb-4">
              数据备份
            </Text>
            
            <View className="bg-surface rounded-xl p-4 border border-border mb-4">
              <View className="flex-row items-center mb-2">
                <Text className="text-2xl mr-2">☁️</Text>
                <Text className="text-foreground font-semibold">云端同步</Text>
              </View>
              <Text className="text-sm text-muted">
                您的所有数据已自动保存到云端,登录同一账号即可在多个设备间同步访问。
              </Text>
            </View>
            
            <TouchableOpacity
              className="bg-surface border border-border py-4 rounded-xl items-center active:opacity-70 mb-3"
              onPress={handleExportBackup}
            >
              <Text className="text-foreground font-semibold text-base">
                📦 导出本地备份
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              className="bg-surface border border-border py-4 rounded-xl items-center active:opacity-70"
              onPress={handleImportBackup}
            >
              <Text className="text-foreground font-semibold text-base">
                📥 导入备份数据
              </Text>
            </TouchableOpacity>
            
            <Text className="text-xs text-muted mt-3 text-center">
              提示:备份文件为 JSON 格式,包含所有小说和章节数据
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
