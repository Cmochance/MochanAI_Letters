import { ScrollView, Text, View, TouchableOpacity, RefreshControl } from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import { useState } from "react";

const CATEGORIES = [
  { key: "all" as const, label: "全部", icon: "📝" },
  { key: "inspiration" as const, label: "灵感", icon: "💡" },
  { key: "character" as const, label: "人物", icon: "👤" },
  { key: "worldview" as const, label: "世界观", icon: "🌏" },
  { key: "plot" as const, label: "情节", icon: "📖" },
  { key: "other" as const, label: "其他", icon: "📌" },
];

export default function NotesScreen() {
  const colors = useColors();
  const [selectedCategory, setSelectedCategory] = useState<"all" | "inspiration" | "character" | "worldview" | "plot" | "other">("all");

  const { data: allNotes, refetch: refetchAll, isLoading: isLoadingAll } = trpc.notes.list.useQuery();
  const { data: categoryNotes, refetch: refetchCategory, isLoading: isLoadingCategory } = trpc.notes.byCategory.useQuery(
    { category: selectedCategory as any },
    { enabled: selectedCategory !== "all" }
  );

  const notes = selectedCategory === "all" ? allNotes : categoryNotes;
  const isLoading = selectedCategory === "all" ? isLoadingAll : isLoadingCategory;
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    if (selectedCategory === "all") {
      await refetchAll();
    } else {
      await refetchCategory();
    }
    setRefreshing(false);
  };

  const getCategoryIcon = (category: string) => {
    const cat = CATEGORIES.find((c) => c.key === category);
    return cat?.icon || "📝";
  };

  return (
    <ScreenContainer className="p-4">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
      >
        <View className="flex-1">
          {/* Header */}
          <View className="mb-6">
            <Text className="text-3xl font-bold text-foreground font-title">灵感笔记</Text>
            <Text className="mt-1 text-muted">记录创作灵感与设定</Text>
          </View>

          {/* Category Filter */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6">
            <View className="flex-row gap-2">
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.key}
                  className={`px-4 py-2 rounded-full border ${
                    selectedCategory === cat.key ? "bg-primary border-primary" : "bg-surface border-border"
                  }`}
                  onPress={() => setSelectedCategory(cat.key)}
                >
                  <Text
                    className={`font-semibold ${selectedCategory === cat.key ? "text-background" : "text-foreground"}`}
                  >
                    {cat.icon} {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Notes List */}
          {isLoading ? (
            <View className="flex-1 items-center justify-center">
              <Text className="text-muted">加载中...</Text>
            </View>
          ) : !notes || notes.length === 0 ? (
            <View className="flex-1 items-center justify-center">
              <Text className="text-6xl mb-4">📝</Text>
              <Text className="text-lg text-muted mb-2">还没有笔记</Text>
              <Text className="text-sm text-muted">点击下方按钮创建第一条笔记</Text>
            </View>
          ) : (
            <View className="gap-3">
              {notes.map((note) => (
                <TouchableOpacity
                  key={note.id}
                  className="bg-surface rounded-xl p-4 border border-border active:opacity-70"
                  onPress={() => router.push(`/note-edit?noteId=${note.id}`)}
                >
                  <View className="flex-row items-start justify-between mb-2">
                    <View className="flex-1">
                      <View className="flex-row items-center gap-2 mb-1">
                        <Text className="text-lg">{getCategoryIcon(note.category)}</Text>
                        <Text className="text-lg font-semibold text-foreground font-title flex-1" numberOfLines={1}>
                          {note.title}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <Text className="text-muted mb-2" numberOfLines={2}>
                    {note.content}
                  </Text>
                  <Text className="text-xs text-muted">
                    {new Date(note.updatedAt).toLocaleString("zh-CN", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Floating Add Button */}
      <TouchableOpacity
        className="absolute bottom-8 right-4 w-14 h-14 rounded-full bg-primary items-center justify-center shadow-lg active:opacity-80"
        onPress={() => router.push("/note-edit")}
      >
        <Text className="text-3xl text-background">+</Text>
      </TouchableOpacity>
    </ScreenContainer>
  );
}
