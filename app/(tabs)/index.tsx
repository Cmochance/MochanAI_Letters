import { ScrollView, Text, View, TouchableOpacity, TextInput, Alert, ActivityIndicator, Image } from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { useColors } from "@/hooks/use-colors";

export default function NovelsScreen() {
  const colors = useColors();
  const [showNewNovelDialog, setShowNewNovelDialog] = useState(false);
  const [newNovelTitle, setNewNovelTitle] = useState("");
  
  const { data: novels, isLoading, refetch } = trpc.novels.list.useQuery();
  const createNovelMutation = trpc.novels.create.useMutation({
    onSuccess: () => {
      refetch();
      setShowNewNovelDialog(false);
      setNewNovelTitle("");
    },
  });
  const deleteNovelMutation = trpc.novels.delete.useMutation({
    onSuccess: () => refetch(),
  });

  const handleCreateNovel = () => {
    if (!newNovelTitle.trim()) {
      Alert.alert("提示", "请输入小说标题");
      return;
    }
    createNovelMutation.mutate({ title: newNovelTitle.trim() });
  };

  const handleDeleteNovel = (id: number, title: string) => {
    Alert.alert(
      "确认删除",
      `确定要删除《${title}》吗?删除后无法恢复。`,
      [
        { text: "取消", style: "cancel" },
        {
          text: "删除",
          style: "destructive",
          onPress: () => deleteNovelMutation.mutate({ id }),
        },
      ]
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
            <View className="flex-row justify-between items-center">
              <View>
                <Text className="text-4xl font-bold text-foreground font-title">我的小说</Text>
                <Text className="mt-1 text-muted">共 {novels?.length || 0} 部作品</Text>
              </View>
              <TouchableOpacity
                className="w-10 h-10 rounded-full bg-surface items-center justify-center active:opacity-70"
                onPress={() => router.push("/settings" as any)}
              >
                <Text className="text-xl">⚙️</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Novels List */}
          {novels && novels.length > 0 ? (
            <View className="gap-4">
              {novels.map((novel) => (
                <TouchableOpacity
                  key={novel.id}
                  className="bg-surface rounded-2xl border border-border active:opacity-70 overflow-hidden"
                  onPress={() => router.push(`/novels/${novel.id}`)}
                  onLongPress={() => handleDeleteNovel(novel.id, novel.title)}
                >
                  <View className="flex-row">
                    {/* Cover Image */}
                    {novel.coverUrl ? (
                      <Image
                        source={{ uri: novel.coverUrl }}
                        style={{ width: 100, height: 140 }}
                        resizeMode="cover"
                      />
                    ) : (
                      <View className="w-[100px] h-[140px] bg-background items-center justify-center">
                        <Text className="text-4xl">📖</Text>
                      </View>
                    )}
                    
                    {/* Novel Info */}
                    <View className="flex-1 p-4">
                      <Text className="text-xl font-semibold text-foreground font-title mb-2">
                        {novel.title}
                      </Text>
                      {novel.description && (
                        <Text className="text-sm text-muted mb-3" numberOfLines={2}>
                          {novel.description}
                        </Text>
                      )}
                      <View className="flex-row items-center gap-4 mb-2">
                        <Text className="text-xs text-muted">
                          {novel.totalWords.toLocaleString()} 字
                        </Text>
                        <Text className="text-xs text-muted">
                          {new Date(novel.createdAt).toLocaleDateString()}
                        </Text>
                      </View>
                      
                      {/* Generate Cover Button */}
                      {!novel.coverUrl && (
                        <TouchableOpacity
                          className="bg-primary/20 px-3 py-1.5 rounded-full self-start active:opacity-70"
                          onPress={(e) => {
                            e.stopPropagation();
                            router.push(`/generate-cover?novelId=${novel.id}&title=${encodeURIComponent(novel.title)}&description=${encodeURIComponent(novel.description || "")}` as any);
                          }}
                        >
                          <Text className="text-primary text-xs font-semibold">
                            ✨ 生成封面
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View className="flex-1 justify-center items-center py-20">
              <Text className="text-6xl mb-4">📚</Text>
              <Text className="text-lg text-foreground font-semibold mb-2">
                还没有小说
              </Text>
              <Text className="text-sm text-muted">点击下方按钮创建第一部作品</Text>
            </View>
          )}

          {/* Create Button */}
          <View className="mt-6">
            <TouchableOpacity
              className="bg-primary py-4 rounded-full items-center active:opacity-80"
              onPress={() => {
                setShowNewNovelDialog(true);
              }}
            >
              <Text className="text-background font-semibold text-lg">
                {createNovelMutation.isPending ? "创建中..." : "+ 新建小说"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {showNewNovelDialog && (
        <TouchableOpacity
          activeOpacity={1}
          className="absolute inset-0 bg-black/50 justify-center items-center px-6"
          onPress={() => {
            if (createNovelMutation.isPending) return;
            setShowNewNovelDialog(false);
            setNewNovelTitle("");
          }}
        >
          <View
            className="w-full max-w-md bg-background rounded-2xl p-5 border border-muted"
            onStartShouldSetResponder={() => true}
          >
            <Text className="text-lg font-semibold text-foreground">新建小说</Text>
            <Text className="text-sm text-muted mt-1">请输入小说标题</Text>

            <TextInput
              className="mt-4 w-full rounded-xl border border-muted px-4 py-3 text-foreground"
              placeholder="例如：风起墨痕"
              placeholderTextColor={colors.muted}
              value={newNovelTitle}
              autoFocus
              editable={!createNovelMutation.isPending}
              onChangeText={setNewNovelTitle}
              onSubmitEditing={handleCreateNovel}
              returnKeyType="done"
            />

            <View className="flex-row gap-3 mt-5">
              <TouchableOpacity
                className="flex-1 py-3 rounded-full items-center border border-muted active:opacity-80"
                onPress={() => {
                  if (createNovelMutation.isPending) return;
                  setShowNewNovelDialog(false);
                  setNewNovelTitle("");
                }}
              >
                <Text className="text-foreground font-semibold">取消</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="flex-1 py-3 rounded-full items-center bg-primary active:opacity-80"
                onPress={handleCreateNovel}
                disabled={createNovelMutation.isPending}
              >
                <Text className="text-background font-semibold">
                  {createNovelMutation.isPending ? "创建中..." : "创建"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      )}
    </ScreenContainer>
  );
}
