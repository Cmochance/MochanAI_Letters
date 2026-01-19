import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator, TextInput } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import { useState, useEffect } from "react";

export default function AIOutlineScreen() {
  const colors = useColors();
  const { novelId, chapterNumber } = useLocalSearchParams<{ novelId: string; chapterNumber: string }>();
  
  const [outline, setOutline] = useState({
    theme: "",
    framework: "",
    conflicts: "",
    interactions: "",
  });

  const generateOutlineMutation = trpc.ai.generateOutline.useMutation({
    onSuccess: (data) => {
      setOutline(data);
    },
  });

  useEffect(() => {
    // Auto-generate outline on mount
    if (novelId && chapterNumber) {
      generateOutlineMutation.mutate({
        novelId: parseInt(novelId),
        chapterNumber: parseInt(chapterNumber),
      });
    }
  }, [novelId, chapterNumber]);

  const handleRegenerate = () => {
    if (novelId && chapterNumber) {
      generateOutlineMutation.mutate({
        novelId: parseInt(novelId),
        chapterNumber: parseInt(chapterNumber),
      });
    }
  };

  const handleStartExpand = () => {
    const outlineText = `【章节主题】\n${outline.theme}\n\n【情节框架】\n${outline.framework}\n\n【关键冲突】\n${outline.conflicts}\n\n【人物互动】\n${outline.interactions}`;
    router.push(`/ai-expand?novelId=${novelId}&chapterNumber=${chapterNumber}&outline=${encodeURIComponent(outlineText)}` as any);
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
            <Text className="text-3xl font-bold text-foreground font-title">AI 章节规划</Text>
            <Text className="mt-1 text-muted">第 {chapterNumber} 章</Text>
          </View>

          {/* Loading State */}
          {generateOutlineMutation.isPending && (
            <View className="flex-1 justify-center items-center py-20">
              <ActivityIndicator size="large" color={colors.primary} />
              <Text className="mt-4 text-muted text-center">
                AI 正在分析前文,生成章节框架...
              </Text>
            </View>
          )}

          {/* Outline Content */}
          {!generateOutlineMutation.isPending && outline.theme && (
            <View className="gap-4">
              <View className="bg-surface rounded-xl p-4 border border-border">
                <Text className="text-sm font-semibold text-primary mb-2">章节主题</Text>
                <TextInput
                  className="text-foreground text-base"
                  value={outline.theme}
                  onChangeText={(text) => setOutline({ ...outline, theme: text })}
                  multiline
                  placeholder="章节主题建议"
                  placeholderTextColor={colors.muted}
                />
              </View>

              <View className="bg-surface rounded-xl p-4 border border-border">
                <Text className="text-sm font-semibold text-primary mb-2">情节框架</Text>
                <TextInput
                  className="text-foreground text-base"
                  value={outline.framework}
                  onChangeText={(text) => setOutline({ ...outline, framework: text })}
                  multiline
                  placeholder="情节发展框架"
                  placeholderTextColor={colors.muted}
                />
              </View>

              <View className="bg-surface rounded-xl p-4 border border-border">
                <Text className="text-sm font-semibold text-primary mb-2">关键冲突</Text>
                <TextInput
                  className="text-foreground text-base"
                  value={outline.conflicts}
                  onChangeText={(text) => setOutline({ ...outline, conflicts: text })}
                  multiline
                  placeholder="关键冲突点"
                  placeholderTextColor={colors.muted}
                />
              </View>

              <View className="bg-surface rounded-xl p-4 border border-border">
                <Text className="text-sm font-semibold text-primary mb-2">人物互动</Text>
                <TextInput
                  className="text-foreground text-base"
                  value={outline.interactions}
                  onChangeText={(text) => setOutline({ ...outline, interactions: text })}
                  multiline
                  placeholder="人物互动要点"
                  placeholderTextColor={colors.muted}
                />
              </View>
            </View>
          )}

          {/* Action Buttons */}
          {!generateOutlineMutation.isPending && outline.theme && (
            <View className="mt-6 gap-3">
              <TouchableOpacity
                className="bg-primary py-4 rounded-full items-center active:opacity-80"
                onPress={handleStartExpand}
              >
                <Text className="text-background font-semibold text-lg">
                  开始扩写
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="border border-primary py-4 rounded-full items-center active:opacity-70"
                onPress={handleRegenerate}
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
