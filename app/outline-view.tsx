import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";

export default function OutlineViewScreen() {
  const colors = useColors();
  const { novelId } = useLocalSearchParams<{ novelId: string }>();
  const id = parseInt(novelId);

  const { data: novel } = trpc.novels.list.useQuery();
  const { data: chapters, isLoading } = trpc.chapters.list.useQuery({ novelId: id });

  const currentNovel = novel?.find((n) => n.id === id);

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
            <Text className="text-3xl font-bold text-foreground">章节大纲</Text>
            <Text className="mt-1 text-muted">{currentNovel?.title}</Text>
          </View>

          {/* Novel Overview */}
          <View className="bg-surface rounded-xl p-4 border border-border mb-6">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-lg font-semibold text-foreground">小说概览</Text>
              <View className="bg-primary/20 px-3 py-1 rounded-full">
                <Text className="text-primary text-xs font-semibold">
                  {chapters?.length || 0} 章
                </Text>
              </View>
            </View>
            <View className="flex-row gap-4">
              <View>
                <Text className="text-xs text-muted mb-1">总字数</Text>
                <Text className="text-base font-semibold text-foreground">
                  {currentNovel?.totalWords.toLocaleString() || 0}
                </Text>
              </View>
              <View>
                <Text className="text-xs text-muted mb-1">更新时间</Text>
                <Text className="text-base font-semibold text-foreground">
                  {currentNovel ? new Date(currentNovel.updatedAt).toLocaleDateString() : "-"}
                </Text>
              </View>
            </View>
          </View>

          {/* Chapter Tree */}
          {chapters && chapters.length > 0 ? (
            <View className="gap-3">
              <Text className="text-lg font-semibold text-foreground mb-2">章节结构</Text>
              
              {chapters.map((chapter, index) => {
                const isFirst = index === 0;
                const isLast = index === chapters.length - 1;
                
                return (
                  <View key={chapter.id}>
                    {/* Connection Line */}
                    {!isFirst && (
                      <View className="ml-6 h-4 w-0.5 bg-border" />
                    )}
                    
                    {/* Chapter Node */}
                    <TouchableOpacity
                      className="flex-row items-start gap-3 active:opacity-70"
                      onPress={() => router.push(`/chapter-detail?id=${chapter.id}` as any)}
                    >
                      {/* Node Circle */}
                      <View className="relative">
                        <View className="w-12 h-12 rounded-full bg-primary/20 items-center justify-center border-2 border-primary">
                          <Text className="text-primary font-bold text-sm">
                            {chapter.chapterNumber}
                          </Text>
                        </View>
                        
                        {/* Connecting Line to Content */}
                        <View className="absolute left-12 top-6 w-4 h-0.5 bg-border" />
                      </View>
                      
                      {/* Chapter Content */}
                      <View className="flex-1 bg-surface rounded-xl p-4 border border-border">
                        <Text className="text-base font-semibold text-foreground mb-2">
                          {chapter.title}
                        </Text>
                        
                        {/* Chapter Preview */}
                        <Text className="text-sm text-muted mb-3" numberOfLines={2}>
                          {chapter.content.substring(0, 100)}...
                        </Text>
                        
                        {/* Chapter Stats */}
                        <View className="flex-row items-center gap-4">
                          <View className="flex-row items-center gap-1">
                            <Text className="text-xs text-muted">📝</Text>
                            <Text className="text-xs text-muted">
                              {chapter.wordCount.toLocaleString()} 字
                            </Text>
                          </View>
                          <View className="flex-row items-center gap-1">
                            <Text className="text-xs text-muted">📅</Text>
                            <Text className="text-xs text-muted">
                              {new Date(chapter.updatedAt).toLocaleDateString()}
                            </Text>
                          </View>
                        </View>
                        
                        {/* Chapter Theme Tag */}
                        <View className="mt-3 flex-row flex-wrap gap-2">
                          <View className="bg-primary/10 px-2 py-1 rounded">
                            <Text className="text-xs text-primary">
                              第 {chapter.chapterNumber} 章
                            </Text>
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                    
                    {/* Connection Line to Next */}
                    {!isLast && (
                      <View className="ml-6 h-4 w-0.5 bg-border" />
                    )}
                  </View>
                );
              })}
            </View>
          ) : (
            <View className="flex-1 justify-center items-center py-20">
              <Text className="text-6xl mb-4">📋</Text>
              <Text className="text-lg text-foreground font-semibold mb-2">
                暂无章节
              </Text>
              <Text className="text-sm text-muted">创建章节后即可查看大纲</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
