import { ScrollView, Text, View, TouchableOpacity, TextInput, Alert } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import { useState, useEffect } from "react";

const CATEGORIES = [
  { key: "inspiration" as const, label: "灵感", icon: "💡" },
  { key: "character" as const, label: "人物", icon: "👤" },
  { key: "worldview" as const, label: "世界观", icon: "🌏" },
  { key: "plot" as const, label: "情节", icon: "📖" },
  { key: "other" as const, label: "其他", icon: "📌" },
];

export default function NoteEditScreen() {
  const colors = useColors();
  const { noteId } = useLocalSearchParams<{ noteId?: string }>();
  const id = noteId ? parseInt(noteId) : undefined;

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<"inspiration" | "character" | "worldview" | "plot" | "other">("inspiration");
  const [novelId, setNovelId] = useState<number | undefined>();

  const { data: note } = trpc.notes.getById.useQuery({ noteId: id! }, { enabled: !!id });
  const { data: novels } = trpc.novels.list.useQuery();
  
  const createMutation = trpc.notes.create.useMutation();
  const updateMutation = trpc.notes.update.useMutation();
  const deleteMutation = trpc.notes.delete.useMutation();

  const utils = trpc.useUtils();

  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setContent(note.content);
      setCategory(note.category);
      setNovelId(note.novelId || undefined);
    }
  }, [note]);

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert("提示", "请输入标题");
      return;
    }

    if (!content.trim()) {
      Alert.alert("提示", "请输入内容");
      return;
    }

    try {
      if (id) {
        await updateMutation.mutateAsync({
          noteId: id,
          title,
          content,
          category,
          novelId: novelId || null,
        });
      } else {
        await createMutation.mutateAsync({
          title,
          content,
          category,
          novelId,
        });
      }

      utils.notes.list.invalidate();
      utils.notes.byCategory.invalidate();
      Alert.alert("成功", id ? "笔记已更新" : "笔记已创建", [
        { text: "确定", onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error("Save note error:", error);
      Alert.alert("失败", "保存失败,请稍后重试");
    }
  };

  const handleDelete = () => {
    if (!id) return;

    Alert.alert("确认删除", "确定要删除这条笔记吗?", [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteMutation.mutateAsync({ noteId: id });
            utils.notes.list.invalidate();
            utils.notes.byCategory.invalidate();
            Alert.alert("成功", "笔记已删除", [{ text: "确定", onPress: () => router.back() }]);
          } catch (error) {
            console.error("Delete note error:", error);
            Alert.alert("失败", "删除失败,请稍后重试");
          }
        },
      },
    ]);
  };

  return (
    <ScreenContainer className="p-4">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1">
          {/* Header */}
          <View className="mb-6">
            <View className="flex-row items-center justify-between mb-2">
              <TouchableOpacity onPress={() => router.back()}>
                <Text className="text-primary">← 返回</Text>
              </TouchableOpacity>
              <View className="flex-row gap-3">
                {id && (
                  <TouchableOpacity onPress={handleDelete}>
                    <Text className="text-error">删除</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={handleSave}>
                  <Text className="text-primary font-semibold">保存</Text>
                </TouchableOpacity>
              </View>
            </View>
            <Text className="text-3xl font-bold text-foreground font-title">
              {id ? "编辑笔记" : "新建笔记"}
            </Text>
          </View>

          {/* Category Selection */}
          <View className="mb-4">
            <Text className="text-sm text-muted mb-2">分类</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-2">
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.key}
                    className={`px-4 py-2 rounded-full border ${
                      category === cat.key ? "bg-primary border-primary" : "bg-surface border-border"
                    }`}
                    onPress={() => setCategory(cat.key)}
                  >
                    <Text className={`font-semibold ${category === cat.key ? "text-background" : "text-foreground"}`}>
                      {cat.icon} {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Novel Link (Optional) */}
          {novels && novels.length > 0 && (
            <View className="mb-4">
              <Text className="text-sm text-muted mb-2">关联小说(可选)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    className={`px-4 py-2 rounded-full border ${
                      !novelId ? "bg-primary border-primary" : "bg-surface border-border"
                    }`}
                    onPress={() => setNovelId(undefined)}
                  >
                    <Text className={`font-semibold ${!novelId ? "text-background" : "text-foreground"}`}>无</Text>
                  </TouchableOpacity>
                  {novels.map((novel) => (
                    <TouchableOpacity
                      key={novel.id}
                      className={`px-4 py-2 rounded-full border ${
                        novelId === novel.id ? "bg-primary border-primary" : "bg-surface border-border"
                      }`}
                      onPress={() => setNovelId(novel.id)}
                    >
                      <Text
                        className={`font-semibold ${novelId === novel.id ? "text-background" : "text-foreground"}`}
                      >
                        {novel.title}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          {/* Title Input */}
          <View className="mb-4">
            <Text className="text-sm text-muted mb-2">标题</Text>
            <TextInput
              className="bg-surface rounded-xl p-4 text-foreground border border-border font-title"
              placeholder="输入标题..."
              placeholderTextColor={colors.muted}
              value={title}
              onChangeText={setTitle}
            />
          </View>

          {/* Content Input */}
          <View className="flex-1 mb-4">
            <Text className="text-sm text-muted mb-2">内容</Text>
            <TextInput
              className="bg-surface rounded-xl p-4 text-foreground border border-border flex-1"
              placeholder="记录你的灵感..."
              placeholderTextColor={colors.muted}
              value={content}
              onChangeText={setContent}
              multiline
              textAlignVertical="top"
              style={{ minHeight: 200 }}
            />
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
