"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { formatRelativeTime, truncateText } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  Plus,
  FileText,
  Trash2,
  Edit,
  Lightbulb,
  User,
  Globe,
  BookOpen,
  MoreHorizontal,
} from "lucide-react";

const CATEGORIES = [
  { value: "inspiration", label: "灵感", icon: Lightbulb },
  { value: "character", label: "人物", icon: User },
  { value: "worldview", label: "世界观", icon: Globe },
  { value: "plot", label: "情节", icon: BookOpen },
  { value: "other", label: "其他", icon: MoreHorizontal },
] as const;

type Category = (typeof CATEGORIES)[number]["value"];

export default function NotesPage() {
  const [selectedCategory, setSelectedCategory] = useState<Category | "all">(
    "all"
  );
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    category: "inspiration" as Category,
  });

  const utils = trpc.useUtils();
  const { data: notes, isLoading } = trpc.notes.list.useQuery();

  const createNote = trpc.notes.create.useMutation({
    onSuccess: () => {
      utils.notes.list.invalidate();
      setIsCreating(false);
      resetForm();
    },
  });

  const updateNote = trpc.notes.update.useMutation({
    onSuccess: () => {
      utils.notes.list.invalidate();
      setIsEditing(null);
      resetForm();
    },
  });

  const deleteNote = trpc.notes.delete.useMutation({
    onSuccess: () => {
      utils.notes.list.invalidate();
    },
  });

  const resetForm = () => {
    setFormData({ title: "", content: "", category: "inspiration" });
  };

  const handleCreate = () => {
    if (!formData.title.trim() || !formData.content.trim()) return;
    createNote.mutate({
      title: formData.title.trim(),
      content: formData.content.trim(),
      category: formData.category,
    });
  };

  const handleUpdate = () => {
    if (!formData.title.trim() || !formData.content.trim() || !isEditing)
      return;
    updateNote.mutate({
      noteId: isEditing,
      title: formData.title.trim(),
      content: formData.content.trim(),
      category: formData.category,
    });
  };

  const handleEdit = (note: NonNullable<typeof notes>[number]) => {
    setFormData({
      title: note.title,
      content: note.content,
      category: note.category as Category,
    });
    setIsEditing(note.id);
  };

  const handleDelete = (id: number) => {
    if (confirm("确定要删除这条笔记吗？")) {
      deleteNote.mutate({ noteId: id });
    }
  };

  const filteredNotes =
    selectedCategory === "all"
      ? notes
      : notes?.filter((note) => note.category === selectedCategory);

  const getCategoryIcon = (category: string) => {
    const cat = CATEGORIES.find((c) => c.value === category);
    return cat?.icon || FileText;
  };

  return (
    <div className="content-container">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="page-title mb-1">灵感笔记</h1>
          <p className="text-muted">{notes?.length || 0} 条笔记</p>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          新建笔记
        </button>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setSelectedCategory("all")}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
            selectedCategory === "all"
              ? "bg-primary text-white"
              : "bg-surface text-muted hover:text-foreground border border-border"
          )}
        >
          全部
        </button>
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          return (
            <button
              key={cat.value}
              onClick={() => setSelectedCategory(cat.value)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2",
                selectedCategory === cat.value
                  ? "bg-primary text-white"
                  : "bg-surface text-muted hover:text-foreground border border-border"
              )}
            >
              <Icon className="w-4 h-4" />
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Create/Edit Modal */}
      {(isCreating || isEditing) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="card w-full max-w-lg mx-4">
            <h2 className="text-xl font-serif font-semibold mb-4">
              {isEditing ? "编辑笔记" : "新建笔记"}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">标题</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  className="input"
                  placeholder="请输入标题"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">分类</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((cat) => {
                    const Icon = cat.icon;
                    return (
                      <button
                        key={cat.value}
                        type="button"
                        onClick={() =>
                          setFormData({ ...formData, category: cat.value })
                        }
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2",
                          formData.category === cat.value
                            ? "bg-primary text-white"
                            : "bg-muted/10 text-muted hover:text-foreground"
                        )}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {cat.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">内容</label>
                <textarea
                  value={formData.content}
                  onChange={(e) =>
                    setFormData({ ...formData, content: e.target.value })
                  }
                  className="textarea min-h-[200px]"
                  placeholder="记录你的灵感..."
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setIsCreating(false);
                    setIsEditing(null);
                    resetForm();
                  }}
                  className="btn-secondary"
                >
                  取消
                </button>
                <button
                  onClick={isEditing ? handleUpdate : handleCreate}
                  disabled={
                    !formData.title.trim() ||
                    !formData.content.trim() ||
                    createNote.isPending ||
                    updateNote.isPending
                  }
                  className="btn-primary disabled:opacity-50"
                >
                  {createNote.isPending || updateNote.isPending
                    ? "保存中..."
                    : "保存"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-muted">加载中...</div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredNotes?.length === 0 && (
        <div className="text-center py-20">
          <FileText className="w-16 h-16 text-muted/30 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">
            {selectedCategory === "all" ? "还没有笔记" : "该分类下没有笔记"}
          </h3>
          <p className="text-muted mb-6">记录你的创作灵感</p>
          <button
            onClick={() => setIsCreating(true)}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            新建笔记
          </button>
        </div>
      )}

      {/* Notes Grid */}
      {filteredNotes && filteredNotes.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredNotes.map((note) => {
            const Icon = getCategoryIcon(note.category);
            return (
              <div
                key={note.id}
                className="card group hover:border-primary/30 transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-primary/10">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-xs text-muted">
                      {CATEGORIES.find((c) => c.value === note.category)?.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleEdit(note)}
                      className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-muted/10"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(note.id)}
                      className="p-1.5 rounded-lg text-muted hover:text-error hover:bg-error/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <h3 className="font-medium text-foreground mb-2">
                  {note.title}
                </h3>
                <p className="text-sm text-muted line-clamp-3 mb-3">
                  {truncateText(note.content, 100)}
                </p>
                <div className="text-xs text-muted">
                  {formatRelativeTime(note.updatedAt)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
