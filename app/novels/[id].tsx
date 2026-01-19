import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";

export default function ChaptersScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const novelId = parseInt(id);

  const { data: chapters, isLoading, refetch } = trpc.chapters.list.useQuery({ novelId });
  const deleteChapterMutation = trpc.chapters.delete.useMutation({
    onSuccess: () => refetch(),
  });

  const handleDeleteChapter = (chapterId: number, title: string) => {
    Alert.alert(
      "确认删除",
      `确定要删除《${title}》吗?`,
      [
        { text: "取消", style: "cancel" },
        {
          text: "删除",
          style: "destructive",
          onPress: () => deleteChapterMutation.mutate({ id: chapterId }),
        },
      ]
    );
  };

  const handleNewChapter = () => {
    const nextChapterNumber = (chapters?.length || 0) + 1;
    router.push(`/ai-outline?novelId=${novelId}&chapterNumber=${nextChapterNumber}` as any);
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
            <View className="flex-row justify-between items-center">
              <View>
                <Text className="text-3xl font-bold text-foreground">章节列表</Text>
                <Text className="mt-1 text-muted">共 {chapters?.length || 0} 章</Text>
              </View>
              <TouchableOpacity
                className="bg-surface px-4 py-2 rounded-full border border-border active:opacity-70"
                onPress={() => router.push(`/outline-view?novelId=${novelId}` as any)}
              >
                <Text className="text-primary font-semibold">📊 大纲</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Chapters List */}
          {chapters && chapters.length > 0 ? (
            <View className="gap-3">
              {chapters.map((chapter) => (
                <TouchableOpacity
                  key={chapter.id}
                  className="bg-surface rounded-xl p-4 border border-border active:opacity-70"
                  onPress={() => router.push(`/chapter-detail?id=${chapter.id}` as any)}
                  onLongPress={() => handleDeleteChapter(chapter.id, chapter.title)}
                >
                  <View className="flex-row items-center gap-3 mb-2">
                    <View className="w-10 h-10 rounded-full bg-primary/20 items-center justify-center">
                      <Text className="text-primary font-bold">{chapter.chapterNumber}</Text>
                    </View>
                    <Text className="flex-1 text-lg font-semibold text-foreground">
                      {chapter.title}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-4 ml-13">
                    <Text className="text-xs text-muted">
                      {chapter.wordCount.toLocaleString()} 字
                    </Text>
                    <Text className="text-xs text-muted">
                      {new Date(chapter.updatedAt).toLocaleDateString()}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View className="flex-1 justify-center items-center py-20">
              <Text className="text-6xl mb-4">✍️</Text>
              <Text className="text-lg text-foreground font-semibold mb-2">
                还没有章节
              </Text>
              <Text className="text-sm text-muted">点击下方按钮开始创作</Text>
            </View>
          )}

          {/* Create Button */}
          <View className="mt-6">
            <TouchableOpacity
              className="bg-primary py-4 rounded-full items-center active:opacity-80"
              onPress={handleNewChapter}
            >
              <Text className="text-background font-semibold text-lg">
                + 新建章节
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
