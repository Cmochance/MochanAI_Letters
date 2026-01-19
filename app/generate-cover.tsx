import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator, Image, Alert } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import { useState } from "react";

export default function GenerateCoverScreen() {
  const colors = useColors();
  const { novelId, title, description } = useLocalSearchParams<{
    novelId: string;
    title: string;
    description?: string;
  }>();

  const [generatedCoverUrl, setGeneratedCoverUrl] = useState<string | null>(null);

  const generateCoverMutation = trpc.novels.generateCover.useMutation({
    onSuccess: (data) => {
      setGeneratedCoverUrl(data.coverUrl);
      Alert.alert("成功", "封面已生成并保存");
    },
    onError: (error) => {
      Alert.alert("错误", error.message || "封面生成失败");
    },
  });

  const handleGenerate = () => {
    if (!novelId || !title) {
      Alert.alert("提示", "缺少必要信息");
      return;
    }

    generateCoverMutation.mutate({
      novelId: parseInt(novelId),
      title: decodeURIComponent(title),
      description: description ? decodeURIComponent(description) : undefined,
    });
  };

  const handleUseThisCover = () => {
    Alert.alert("成功", "封面已应用到小说", [
      {
        text: "确定",
        onPress: () => router.back(),
      },
    ]);
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
            <Text className="text-3xl font-bold text-foreground font-title">AI 封面生成</Text>
            <Text className="mt-1 text-muted">{decodeURIComponent(title)}</Text>
          </View>

          {/* Novel Info */}
          <View className="bg-surface rounded-xl p-4 border border-border mb-6">
            <Text className="text-lg font-semibold text-foreground font-title mb-3">小说信息</Text>
            <View className="gap-2">
              <View>
                <Text className="text-muted text-sm">标题</Text>
                <Text className="text-foreground font-semibold mt-1">
                  {decodeURIComponent(title)}
                </Text>
              </View>
              {description && (
                <View className="mt-2">
                  <Text className="text-muted text-sm">简介</Text>
                  <Text className="text-foreground mt-1" numberOfLines={3}>
                    {decodeURIComponent(description)}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Generate Button */}
          {!generatedCoverUrl && !generateCoverMutation.isPending && (
            <TouchableOpacity
              className="bg-primary py-4 rounded-full items-center active:opacity-80 mb-6"
              onPress={handleGenerate}
            >
              <Text className="text-background font-semibold text-lg">
                ✨ 生成水墨风格封面
              </Text>
            </TouchableOpacity>
          )}

          {/* Loading State */}
          {generateCoverMutation.isPending && (
            <View className="flex-1 justify-center items-center py-20">
              <ActivityIndicator size="large" color={colors.primary} />
              <Text className="mt-4 text-muted text-center">
                AI 正在创作水墨风格封面...
              </Text>
              <Text className="mt-2 text-muted text-center text-sm">
                这可能需要 10-20 秒
              </Text>
            </View>
          )}

          {/* Generated Cover */}
          {generatedCoverUrl && !generateCoverMutation.isPending && (
            <View className="gap-4">
              <View className="bg-surface rounded-xl p-4 border border-border">
                <Text className="text-lg font-semibold text-foreground font-title mb-3">
                  生成的封面
                </Text>
                <View className="items-center">
                  <Image
                    source={{ uri: generatedCoverUrl }}
                    style={{
                      width: 280,
                      height: 280,
                      borderRadius: 12,
                    }}
                    resizeMode="cover"
                  />
                </View>
              </View>

              {/* Action Buttons */}
              <View className="gap-3">
                <TouchableOpacity
                  className="bg-primary py-4 rounded-full items-center active:opacity-80"
                  onPress={handleUseThisCover}
                >
                  <Text className="text-background font-semibold text-lg">
                    使用此封面
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className="border border-primary py-4 rounded-full items-center active:opacity-70"
                  onPress={handleGenerate}
                >
                  <Text className="text-primary font-semibold text-lg">
                    重新生成
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Info */}
          <View className="mt-6 bg-surface rounded-xl p-4 border border-border">
            <Text className="text-sm text-muted">
              💡 提示:AI 将根据小说标题和简介,生成中国传统水墨画风格的封面。每次生成的封面都是独一无二的,您可以多次生成直到满意为止。
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
