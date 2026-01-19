import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator, TextInput, Alert } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import { useState } from "react";

export default function AIExpandScreen() {
  const colors = useColors();
  const { novelId, chapterNumber, outline: initialOutline } = useLocalSearchParams<{
    novelId: string;
    chapterNumber: string;
    outline: string;
  }>();

  const [chapterTitle, setChapterTitle] = useState(`第 ${chapterNumber} 章`);
  const [outline, setOutline] = useState(decodeURIComponent(initialOutline || ""));
  const [expandedContent, setExpandedContent] = useState("");

  const expandContentMutation = trpc.ai.expandContent.useMutation({
    onSuccess: (data) => {
      setExpandedContent(data.content);
    },
  });

  const createChapterMutation = trpc.chapters.create.useMutation({
    onSuccess: () => {
      Alert.alert("成功", "章节已保存", [
        {
          text: "确定",
          onPress: () => router.back(),
        },
      ]);
    },
  });

  const handleGenerate = () => {
    if (!outline.trim()) {
      Alert.alert("提示", "请输入章节大纲");
      return;
    }

    expandContentMutation.mutate({
      novelId: parseInt(novelId),
      outline: outline.trim(),
      targetWords: 4000,
    });
  };

  const handleSave = () => {
    if (!expandedContent.trim()) {
      Alert.alert("提示", "请先生成章节内容");
      return;
    }

    createChapterMutation.mutate({
      novelId: parseInt(novelId),
      chapterNumber: parseInt(chapterNumber),
      title: chapterTitle.trim(),
      content: expandedContent.trim(),
    });
  };

  const wordCount = expandedContent.length;

  return (
    <ScreenContainer className="p-4">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1">
          {/* Header */}
          <View className="mb-6">
            <TouchableOpacity onPress={() => router.back()}>
              <Text className="text-primary mb-2">← 返回</Text>
            </TouchableOpacity>
            <Text className="text-3xl font-bold text-foreground">AI 内容扩写</Text>
            <Text className="mt-1 text-muted">第 {chapterNumber} 章</Text>
          </View>

          {/* Chapter Title Input */}
          <View className="mb-4">
            <Text className="text-sm font-semibold text-muted mb-2">章节标题</Text>
            <TextInput
              className="bg-surface rounded-xl p-4 text-foreground text-base border border-border"
              value={chapterTitle}
              onChangeText={setChapterTitle}
              placeholder="输入章节标题"
              placeholderTextColor={colors.muted}
            />
          </View>

          {/* Outline Input */}
          <View className="mb-4">
            <Text className="text-sm font-semibold text-muted mb-2">章节大纲</Text>
            <TextInput
              className="bg-surface rounded-xl p-4 text-foreground text-base border border-border"
              value={outline}
              onChangeText={setOutline}
              multiline
              numberOfLines={6}
              placeholder="输入章节主要内容和情节要点"
              placeholderTextColor={colors.muted}
              style={{ minHeight: 150 }}
            />
          </View>

          {/* Generate Button */}
          {!expandedContent && (
            <TouchableOpacity
              className="bg-primary py-4 rounded-full items-center active:opacity-80 mb-6"
              onPress={handleGenerate}
              disabled={expandContentMutation.isPending}
            >
              <Text className="text-background font-semibold text-lg">
                {expandContentMutation.isPending ? "生成中..." : "生成完整章节"}
              </Text>
            </TouchableOpacity>
          )}

          {/* Loading State */}
          {expandContentMutation.isPending && (
            <View className="flex-1 justify-center items-center py-20">
              <ActivityIndicator size="large" color={colors.primary} />
              <Text className="mt-4 text-muted text-center">
                AI 正在扩写,预计需要 30 秒...
              </Text>
            </View>
          )}

          {/* Expanded Content */}
          {expandedContent && (
            <View className="mb-6">
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-sm font-semibold text-muted">生成内容</Text>
                <Text className="text-xs text-muted">{wordCount} 字</Text>
              </View>
              <TextInput
                className="bg-surface rounded-xl p-4 text-foreground text-base border border-border"
                value={expandedContent}
                onChangeText={setExpandedContent}
                multiline
                numberOfLines={20}
                placeholder="生成的章节内容将显示在这里"
                placeholderTextColor={colors.muted}
                style={{ minHeight: 400 }}
              />
            </View>
          )}

          {/* Action Buttons */}
          {expandedContent && (
            <View className="gap-3">
              <TouchableOpacity
                className="bg-primary py-4 rounded-full items-center active:opacity-80"
                onPress={handleSave}
                disabled={createChapterMutation.isPending}
              >
                <Text className="text-background font-semibold text-lg">
                  {createChapterMutation.isPending ? "保存中..." : "保存章节"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="border border-primary py-4 rounded-full items-center active:opacity-70"
                onPress={handleGenerate}
                disabled={expandContentMutation.isPending}
              >
                <Text className="text-primary font-semibold text-lg">
                  重新生成
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
