import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator, Alert, Platform } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import { useState } from "react";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

export default function ExportScreen() {
  const colors = useColors();
  const { novelId } = useLocalSearchParams<{ novelId: string }>();
  const id = parseInt(novelId);

  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<"txt" | "markdown" | "epub" | null>(null);

  const { data: novels } = trpc.novels.list.useQuery();
  const exportTxtMutation = trpc.export.txt.useMutation();
  const exportMarkdownMutation = trpc.export.markdown.useMutation();
  const exportEpubMutation = trpc.export.epub.useMutation();

  const currentNovel = novels?.find((n) => n.id === id);

  const handleExport = async (format: "txt" | "markdown" | "pdf" | "epub") => {
    setExporting(true);
    setExportFormat(format === "pdf" ? "markdown" : format);

    try {
      let content: string;
      let filename: string;

      if (format === "txt") {
        const result = await exportTxtMutation.mutateAsync({ novelId: id });
        content = result.content;
        filename = result.filename;
      } else if (format === "epub") {
        // ePub format returns base64 encoded buffer
        const result = await exportEpubMutation.mutateAsync({ novelId: id });
        const buffer = Buffer.from(result.content, 'base64');
        filename = result.filename;
        
        // Save to file system
        const fileUri = `${FileSystem.documentDirectory}${filename}`;
        await FileSystem.writeAsStringAsync(fileUri, result.content, {
          encoding: FileSystem.EncodingType.Base64,
        });

        // Share the file
        if (Platform.OS === "web") {
          // Web: download file
          const blob = new Blob([buffer], { type: "application/epub+zip" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = filename;
          link.click();
          URL.revokeObjectURL(url);
          
          Alert.alert("成功", `已下载 ${filename}`);
        } else {
          // Mobile: share file
          const canShare = await Sharing.isAvailableAsync();
          if (canShare) {
            await Sharing.shareAsync(fileUri);
          } else {
            Alert.alert("成功", `文件已保存到:\n${fileUri}`);
          }
        }
        
        setExporting(false);
        setExportFormat(null);
        return;
      } else {
        // For markdown and PDF, use markdown export
        const result = await exportMarkdownMutation.mutateAsync({ novelId: id });
        content = result.content;
        filename = format === "pdf" ? result.filename.replace(".docx", ".md") : result.filename;
      }

      // Save to file system
      const fileUri = `${FileSystem.documentDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(fileUri, content);

      // Share the file
      if (Platform.OS === "web") {
        // Web: download file
        const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
        
        Alert.alert("成功", `已下载 ${filename}`);
      } else {
        // Mobile: share file
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(fileUri);
        } else {
          Alert.alert("成功", `文件已保存到:\n${fileUri}`);
        }
      }
    } catch (error) {
      console.error("Export error:", error);
      Alert.alert("导出失败", "请稍后重试");
    } finally {
      setExporting(false);
      setExportFormat(null);
    }
  };

  return (
    <ScreenContainer className="p-4">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1">
          {/* Header */}
          <View className="mb-6">
            <TouchableOpacity onPress={() => router.back()}>
              <Text className="text-primary mb-2">← 返回</Text>
            </TouchableOpacity>
            <Text className="text-3xl font-bold text-foreground font-title">导出小说</Text>
            <Text className="mt-1 text-muted">{currentNovel?.title}</Text>
          </View>

          {/* Novel Info */}
          <View className="bg-surface rounded-xl p-4 border border-border mb-6">
            <Text className="text-lg font-semibold text-foreground font-title mb-3">小说信息</Text>
            <View className="gap-2">
              <View className="flex-row justify-between">
                <Text className="text-muted">总字数</Text>
                <Text className="text-foreground font-semibold">
                  {currentNovel?.totalWords.toLocaleString() || 0}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-muted">更新时间</Text>
                <Text className="text-foreground font-semibold">
                  {currentNovel ? new Date(currentNovel.updatedAt).toLocaleDateString() : "-"}
                </Text>
              </View>
            </View>
          </View>

          {/* Export Options */}
          <View className="gap-4">
            <Text className="text-lg font-semibold text-foreground font-title mb-2">选择格式</Text>

            {/* TXT Format */}
            <TouchableOpacity
              className="bg-surface rounded-xl p-4 border border-border active:opacity-70"
              onPress={() => handleExport("txt")}
              disabled={exporting}
            >
              <View className="flex-row items-center gap-3">
                <View className="w-12 h-12 rounded-full bg-primary/20 items-center justify-center">
                  <Text className="text-2xl">📄</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-lg font-semibold text-foreground font-title mb-1">TXT 文本</Text>
                  <Text className="text-sm text-muted">纯文本格式,兼容性最好</Text>
                </View>
                {exporting && exportFormat === "txt" && (
                  <ActivityIndicator size="small" color={colors.primary} />
                )}
              </View>
            </TouchableOpacity>

            {/* Markdown Format */}
            <TouchableOpacity
              className="bg-surface rounded-xl p-4 border border-border active:opacity-70"
              onPress={() => handleExport("markdown")}
              disabled={exporting}
            >
              <View className="flex-row items-center gap-3">
                <View className="w-12 h-12 rounded-full bg-primary/20 items-center justify-center">
                  <Text className="text-2xl">📝</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-lg font-semibold text-foreground font-title mb-1">Markdown</Text>
                  <Text className="text-sm text-muted">支持格式化,可转换为其他格式</Text>
                </View>
                {exporting && exportFormat === "markdown" && (
                  <ActivityIndicator size="small" color={colors.primary} />
                )}
              </View>
            </TouchableOpacity>

            {/* ePub Format */}
            <TouchableOpacity
              className="bg-surface rounded-xl p-4 border border-border active:opacity-70"
              onPress={() => handleExport("epub")}
              disabled={exporting}
            >
              <View className="flex-row items-center gap-3">
                <View className="w-12 h-12 rounded-full bg-primary/20 items-center justify-center">
                  <Text className="text-2xl">📖</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-lg font-semibold text-foreground font-title mb-1">ePub 电子书</Text>
                  <Text className="text-sm text-muted">适用于 Kindle, Apple Books 等阅读设备</Text>
                </View>
                {exporting && exportFormat === "epub" && (
                  <ActivityIndicator size="small" color={colors.primary} />
                )}
              </View>
            </TouchableOpacity>
            
            {/* PDF Format (Coming Soon) */}
            <View className="bg-surface rounded-xl p-4 border border-border opacity-50">
              <View className="flex-row items-center gap-3">
                <View className="w-12 h-12 rounded-full bg-primary/20 items-center justify-center">
                  <Text className="text-2xl">📕</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-lg font-semibold text-foreground font-title mb-1">PDF 文档</Text>
                  <Text className="text-sm text-muted">即将推出</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Tips */}
          <View className="mt-6 bg-surface rounded-xl p-4 border border-border">
            <Text className="text-sm text-muted">
              💡 提示:导出后的文件可以通过分享功能发送到其他应用,或保存到云盘备份。
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
