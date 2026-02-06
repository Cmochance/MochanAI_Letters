"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { formatRelativeTime, truncateText } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Plus,
  FileText,
  Trash2,
  Edit,
  Search,
  BookOpen,
  FlaskConical,
  BarChart3,
  MessageSquare,
  Link2,
} from "lucide-react";

const CATEGORIES = [
  { value: "research_question", label: "研究问题", icon: Search },
  { value: "literature_review", label: "文献综述", icon: BookOpen },
  { value: "methodology", label: "方法设计", icon: FlaskConical },
  { value: "data_experiment", label: "数据与实验", icon: BarChart3 },
  { value: "result_analysis", label: "结果分析", icon: BarChart3 },
  { value: "discussion_limitations", label: "讨论与局限", icon: MessageSquare },
  { value: "citations_todo", label: "引文待补", icon: Link2 },
] as const;

type Category = (typeof CATEGORIES)[number]["value"];

export default function PaperNotesPage() {
  const params = useParams();
  const paperId = Number(params.id);

  const [selectedCategory, setSelectedCategory] = useState<Category | "all">(
    "all"
  );
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    category: "research_question" as Category,
  });

  const utils = trpc.useUtils();
  const { data: paper } = trpc.papers.get.useQuery(
    { id: paperId },
    { enabled: Number.isFinite(paperId) && paperId > 0 }
  );

  const { data: notes, isLoading } = trpc.paperNotes.byPaper.useQuery(
    { paperId },
    { enabled: Number.isFinite(paperId) && paperId > 0 }
  );

  const createNote = trpc.paperNotes.create.useMutation({
    onSuccess: () => {
      utils.paperNotes.byPaper.invalidate({ paperId });
      setIsCreating(false);
      resetForm();
    },
  });

  const updateNote = trpc.paperNotes.update.useMutation({
    onSuccess: () => {
      utils.paperNotes.byPaper.invalidate({ paperId });
      setIsEditing(null);
      resetForm();
    },
  });

  const deleteNote = trpc.paperNotes.delete.useMutation({
    onSuccess: () => {
      utils.paperNotes.byPaper.invalidate({ paperId });
    },
  });

  const resetForm = () => {
    setFormData({ title: "", content: "", category: "research_question" });
  };

  const handleCreate = () => {
    if (!formData.title.trim() || !formData.content.trim()) return;
    createNote.mutate({
      paperId,
      title: formData.title.trim(),
      content: formData.content.trim(),
      category: formData.category,
    });
  };

  const handleUpdate = () => {
    if (!formData.title.trim() || !formData.content.trim() || !isEditing) return;
    updateNote.mutate({
      noteId: isEditing,
      paperId,
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

  const handleDelete = (noteId: number) => {
    if (confirm("确定要删除这条笔记吗？")) {
      deleteNote.mutate({ noteId });
    }
  };

  const filteredNotes = useMemo(() => {
    if (!notes) return [];
    if (selectedCategory === "all") return notes;
    return notes.filter((note) => note.category === selectedCategory);
  }, [notes, selectedCategory]);

  if (!Number.isFinite(paperId) || paperId <= 0) {
    return (
      <div className="content-container">
        <div className="text-center py-20">
          <p className="text-muted">论文参数无效</p>
          <Link href="/papers" className="btn-primary mt-4 inline-block">
            返回论文列表
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="content-container">
      <div className="flex items-center gap-4 mb-8">
        <Link
          href={`/papers/${paperId}`}
          className="p-2 rounded-lg hover:bg-muted/10 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-muted" />
        </Link>
        <div className="flex-1">
          <h1 className="page-title mb-1">研究笔记</h1>
          <p className="text-muted">
            {paper ? `${paper.title} · ` : ""}
            {notes?.length || 0} 条笔记
          </p>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          新建笔记
        </button>
      </div>

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
                  placeholder="记录你的研究要点..."
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

      {isLoading && <div className="text-center py-20 text-muted">加载中...</div>}

      {!isLoading && filteredNotes.length === 0 && (
        <div className="text-center py-20">
          <FileText className="w-16 h-16 text-muted/30 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">还没有笔记</h3>
          <p className="text-muted mb-6">记录研究过程中的关键想法</p>
          <button
            onClick={() => setIsCreating(true)}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            新建笔记
          </button>
        </div>
      )}

      {filteredNotes.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredNotes.map((note) => {
            const category = CATEGORIES.find((item) => item.value === note.category);
            const Icon = category?.icon || FileText;
            return (
              <div key={note.id} className="card group">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-primary" />
                    <span className="text-xs tag">{category?.label || "其他"}</span>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleEdit(note)}
                      className="p-1.5 rounded text-muted hover:text-foreground hover:bg-muted/10"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(note.id)}
                      className="p-1.5 rounded text-muted hover:text-error hover:bg-error/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <h3 className="font-medium text-foreground mb-2">{note.title}</h3>
                <p className="text-sm text-muted line-clamp-3 mb-3">
                  {truncateText(note.content, 150)}
                </p>
                <p className="text-xs text-muted">{formatRelativeTime(note.updatedAt)}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
