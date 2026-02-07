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

const NOTE_TEMPLATES: Record<
  Category,
  { titlePlaceholder: string; description: string; content: string }
> = {
  inspiration: {
    titlePlaceholder: "例如：雨夜断桥重逢的核心灵感",
    description: "用于快速捕捉创意火花，并沉淀为可执行剧情素材。",
    content: `# 灵感模板（可扩展）

## 1. 核心灵感（一句话）
- [ ] 用一句话说明这个灵感的独特性：

## 2. 触发来源
- 来源类型：梦境/新闻/历史/他人故事/现实观察/随机联想
- 触发描述：

## 3. 主题与情绪
- 主题关键词（3-5个）：
- 情绪基调（如压抑/昂扬/悬疑/温暖）：

## 4. 场景画面与感官细节
- 视觉：
- 听觉：
- 嗅觉/触觉：
- 标志性意象（可反复出现）：

## 5. 可发展方向（至少2条）
- 方向A（主线向）：
- 方向B（人物向）：
- 方向C（反转向，可选）：

## 6. 与现有主线的连接
- 关联角色：
- 关联冲突：
- 适合插入章节（起始-结束）：
- 预计影响（短期/长期）：

## 7. 使用约束与风险
- 禁止触碰设定：
- 可能导致逻辑冲突点：
- 修复方案：

## 8. 下一步行动
- [ ] 需要补充的信息：
- [ ] 下一次写作要落地的最小片段：`,
  },
  character: {
    titlePlaceholder: "例如：女主师尊（反派伪装）人物档案",
    description: "用于角色建档、动机拆解、关系冲突与角色弧线管理。",
    content: `# 人物模板（可扩展）

## 1. 角色基础档案
- 姓名/别称：
- 年龄与外观特征：
- 身份/阵营/社会位置：
- 首次出场章节：

## 2. 核心驱动力
- 表层目标（短期）：
- 深层目标（长期）：
- 核心恐惧：
- 不可退让底线：

## 3. 性格结构
- 显性性格（对外）：
- 隐性性格（对内）：
- 反差点（打破刻板印象）：
- 习惯性动作/口头禅：

## 4. 背景时间线（关键事件）
- 事件1（年份/年龄）：
- 事件2：
- 事件3：
- 尚未公开的秘密：

## 5. 能力与限制
- 核心能力：
- 资源与人脉：
- 软肋与限制：
- 危机状态下的失控表现：

## 6. 关系网络
- 与主角关系：
- 与反派关系：
- 盟友/对手/依附者：
- 关系变化触发条件：

## 7. 角色弧线（起-承-转-合）
- 起点状态：
- 关键转折1：
- 关键转折2：
- 终点状态：

## 8. 可调用写作素材
- 冲突场景清单：
- 高光台词草案：
- 伏笔（埋设章 -> 回收章）：`,
  },
  worldview: {
    titlePlaceholder: "例如：宗门护山阵与灵气税制度",
    description: "用于构建世界规则，保证设定一致、可推演、可用于冲突生成。",
    content: `# 世界观模板（可扩展）

## 1. 世界一句话定义
- 这个世界的本质是：

## 2. 时空与地理框架
- 时代阶段（上古/乱世/近代等）：
- 核心地域与边界：
- 交通与通信方式：

## 3. 权力结构
- 最高权力中心：
- 地方权力体系：
- 灰色权力（黑市/宗派/财阀）：

## 4. 规则系统（魔法/修炼/科技）
- 规则来源：
- 成本与代价：
- 上限与禁区：
- 破例条件：

## 5. 社会与经济
- 阶层结构：
- 关键资源（谁掌控、如何流动）：
- 交易机制与货币：
- 普通人的生存逻辑：

## 6. 文化、信仰与禁忌
- 主流价值观：
- 宗教/仪式：
- 社会禁忌与惩罚：

## 7. 历史断层与未解事件
- 历史事件1：
- 历史事件2：
- 争议版本（官方 vs 民间）：

## 8. 对主线的约束与增益
- 能强化冲突的设定：
- 会限制角色行动的设定：
- 需提前埋设说明的设定：

## 9. 一致性检查清单
- [ ] 是否与已有章节冲突
- [ ] 是否有明确代价
- [ ] 是否可被角色利用/对抗`,
  },
  plot: {
    titlePlaceholder: "例如：第12-15章围剿线剧情拆解",
    description: "用于拆分事件链与章节节奏，管理伏笔、冲突升级和回收。",
    content: `# 情节模板（可扩展）

## 1. 情节目标
- 本段剧情要达成的结果：
- 对主线的推进价值：

## 2. 前置条件
- 已满足条件：
- 未满足条件（需补写）：

## 3. 事件链（因果）
- 触发事件：
- 角色行动：
- 直接结果：
- 代价与副作用：

## 4. 冲突升级设计
- 初级冲突：
- 中级冲突：
- 高级冲突（不可逆后果）：
- 失败分支（若主角失败会怎样）：

## 5. 关键决策点
- 决策点A（选项与代价）：
- 决策点B：
- 道德/价值冲突：

## 6. 伏笔与回收
- 伏笔1（埋设章 -> 回收章）：
- 伏笔2：
- 伪线索/误导：

## 7. 节奏与章节切分
- 开场钩子：
- 推进段（信息释放顺序）：
- 小高潮：
- 悬念收束句：
- 建议章节拆分：

## 8. 交付清单
- [ ] 下一章必须写到的场面
- [ ] 必须出现的角色
- [ ] 必须交代的信息`,
  },
  other: {
    titlePlaceholder: "例如：待归档设定与杂项资料",
    description: "用于承接临时资料，再逐步归并到其他结构化分类中。",
    content: `# 其他模板（可扩展）

## 1. 条目主题
- 本条笔记解决的问题：

## 2. 背景说明
- 来源：
- 上下文：

## 3. 关键事实/结论
- 事实1：
- 事实2：
- 结论：

## 4. 待办事项
- [ ] 待核实信息：
- [ ] 待补充引用或资料：
- [ ] 待迁移到正式分类：

## 5. 风险与开放问题
- 当前不确定点：
- 可能影响章节：
- 备用方案：`,
  },
};

export default function NovelNotesPage() {
  const params = useParams();
  const novelId = Number(params.id);

  const [selectedCategory, setSelectedCategory] = useState<Category | "all">(
    "all"
  );
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    content: NOTE_TEMPLATES.inspiration.content,
    category: "inspiration" as Category,
  });

  const utils = trpc.useUtils();
  const { data: novels, isLoading: isNovelsLoading } = trpc.novels.list.useQuery();
  const { data: notes, isLoading: isNotesLoading } = trpc.notes.byNovel.useQuery(
    { novelId },
    { enabled: Number.isFinite(novelId) && novelId > 0 }
  );

  const selectedNovel = useMemo(
    () => novels?.find((novel) => novel.id === novelId),
    [novels, novelId]
  );

  const createNote = trpc.notes.create.useMutation({
    onSuccess: () => {
      utils.notes.byNovel.invalidate({ novelId });
      setIsCreating(false);
      resetForm();
    },
  });

  const updateNote = trpc.notes.update.useMutation({
    onSuccess: () => {
      utils.notes.byNovel.invalidate({ novelId });
      setIsEditing(null);
      resetForm();
    },
  });

  const deleteNote = trpc.notes.delete.useMutation({
    onSuccess: () => {
      utils.notes.byNovel.invalidate({ novelId });
    },
  });

  const resetForm = (category: Category = "inspiration") => {
    setFormData({
      title: "",
      content: NOTE_TEMPLATES[category].content,
      category,
    });
  };

  const startCreate = () => {
    const defaultCategory =
      selectedCategory === "all" ? "inspiration" : selectedCategory;
    resetForm(defaultCategory);
    setIsEditing(null);
    setIsCreating(true);
  };

  const handleCreate = () => {
    if (!formData.title.trim() || !formData.content.trim()) return;
    createNote.mutate({
      novelId,
      title: formData.title.trim(),
      content: formData.content.trim(),
      category: formData.category,
    });
  };

  const handleUpdate = () => {
    if (!formData.title.trim() || !formData.content.trim() || !isEditing) return;
    updateNote.mutate({
      noteId: isEditing,
      novelId,
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
    const cat = CATEGORIES.find((item) => item.value === category);
    return cat?.icon || FileText;
  };

  if (!Number.isFinite(novelId) || novelId <= 0) {
    return (
      <div className="content-container">
        <div className="text-center py-20">
          <p className="text-muted">小说参数无效</p>
          <Link href="/novels" className="btn-primary mt-4 inline-block">
            返回小说列表
          </Link>
        </div>
      </div>
    );
  }

  if (!isNovelsLoading && novels && !selectedNovel) {
    return (
      <div className="content-container">
        <div className="text-center py-20">
          <p className="text-muted">小说不存在或无权限访问</p>
          <Link href="/novels" className="btn-primary mt-4 inline-block">
            返回小说列表
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="content-container">
      <div className="flex items-center gap-4 mb-8">
        <Link
          href={`/novels/${novelId}`}
          className="p-2 rounded-lg hover:bg-muted/10 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-muted" />
        </Link>
        <div className="flex-1">
          <h1 className="page-title mb-1">灵感笔记</h1>
          <p className="text-muted">
            {selectedNovel ? `${selectedNovel.title} · ` : ""}
            {notes?.length || 0} 条笔记
          </p>
        </div>
        <button
          onClick={startCreate}
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
            <p className="text-sm text-muted mb-4">
              当前小说：{selectedNovel?.title || "-"}
            </p>
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
                  placeholder={NOTE_TEMPLATES[formData.category].titlePlaceholder}
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
                          setFormData((prev) => ({
                            ...prev,
                            category: cat.value,
                            content:
                              isEditing === null
                                ? NOTE_TEMPLATES[cat.value].content
                                : prev.content,
                          }))
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
                <div className="flex items-center justify-between mb-2 gap-2">
                  <label className="block text-sm font-medium">内容</label>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        content: NOTE_TEMPLATES[prev.category].content,
                      }))
                    }
                    className="text-xs text-primary hover:underline"
                  >
                    重新套用模板
                  </button>
                </div>
                <p className="text-xs text-muted mb-2">
                  {NOTE_TEMPLATES[formData.category].description}
                </p>
                <textarea
                  value={formData.content}
                  onChange={(e) =>
                    setFormData({ ...formData, content: e.target.value })
                  }
                  className="textarea min-h-[320px]"
                  placeholder="按模板逐项补充即可"
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

      {isNotesLoading && (
        <div className="text-center py-20 text-muted">加载中...</div>
      )}

      {!isNotesLoading && filteredNotes?.length === 0 && (
        <div className="text-center py-20">
          <FileText className="w-16 h-16 text-muted/30 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">还没有笔记</h3>
          <p className="text-muted mb-6">记录你的创作灵感</p>
          <button
            onClick={startCreate}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            新建笔记
          </button>
        </div>
      )}

      {filteredNotes && filteredNotes.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredNotes.map((note) => {
            const Icon = getCategoryIcon(note.category);
            return (
              <div key={note.id} className="card group">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-primary" />
                    <span className="text-xs tag">
                      {CATEGORIES.find((c) => c.value === note.category)?.label}
                    </span>
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
