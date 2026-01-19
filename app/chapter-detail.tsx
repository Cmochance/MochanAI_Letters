import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator, TextInput, Alert } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import { useState, useEffect } from "react";

export default function ChapterDetailScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const chapterId = parseInt(id);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const { data: chapter, isLoading } = trpc.chapters.get.useQuery({ id: chapterId });
  const updateChapterMutation = trpc.chapters.update.useMutation({
    onSuccess: () => {
      Alert.alert("成功", "章节已保存");
    },
  });

  useEffect(() => {
    if (chapter) {
      setTitle(chapter.title);
      setContent(chapter.content);
    }
  }, [chapter]);

  const handleSave = () => {
    if (!title.trim() || !content.trim()) {
      Alert.alert("提示", "标题和内容不能为空");
      return;
    }

    updateChapterMutation.mutate({
      id: chapterId,
      title: title.trim(),
      content: content.trim(),
    });
  };

  if (isLoading) {
    return (
      <ScreenContainer className="justify-center items-center">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="mt-4 text-muted">加载中...</Text>
      </ScreenContainer>
    );
  }

  if (!chapter) {
    return (
      <ScreenContainer className="justify-center items-center">
        <Text className="text-foreground">章节不存在</Text>
      </ScreenContainer>
    );
  }

  const wordCount = content.length;

  return (
    <ScreenContainer className="p-4">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1">
          {/* Header */}
          <View className="mb-6">
            <TouchableOpacity onPress={() => router.back()}>
              <Text className="text-primary mb-2">← 返回</Text>
            </TouchableOpacity>
            <Text className="text-3xl font-bold text-foreground">编辑章节</Text>
            <Text className="mt-1 text-muted">第 {chapter.chapterNumber} 章 · {wordCount} 字</Text>
          </View>

          {/* Title Input */}
          <View className="mb-4">
            <Text className="text-sm font-semibold text-muted mb-2">章节标题</Text>
            <TextInput
              className="bg-surface rounded-xl p-4 text-foreground text-base border border-border"
              value={title}
              onChangeText={setTitle}
              placeholder="输入章节标题"
              placeholderTextColor={colors.muted}
            />
          </View>

          {/* Content Input */}
          <View className="mb-6">
            <Text className="text-sm font-semibold text-muted mb-2">章节内容</Text>
            <TextInput
              className="bg-surface rounded-xl p-4 text-foreground text-base border border-border"
              value={content}
              onChangeText={setContent}
              multiline
              numberOfLines={20}
              placeholder="输入章节内容"
              placeholderTextColor={colors.muted}
              style={{ minHeight: 400 }}
            />
          </View>

          {/* Save Button */}
          <TouchableOpacity
            className="bg-primary py-4 rounded-full items-center active:opacity-80"
            onPress={handleSave}
            disabled={updateChapterMutation.isPending}
          >
            <Text className="text-background font-semibold text-lg">
              {updateChapterMutation.isPending ? "保存中..." : "保存修改"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
