import Link from "next/link";
import { BookOpen, FileText, Settings } from "lucide-react";

const featureCards = [
  {
    title: "我的小说",
    description: "创建、管理并 AI 辅助扩写你的小说项目。",
    href: "/novels",
    icon: BookOpen,
  },
  {
    title: "我的论文",
    description: "按章节进行学术写作规划、扩写与导出。",
    href: "/papers",
    icon: FileText,
  },
  {
    title: "设置",
    description: "配置模型、向量化与写作偏好。",
    href: "/settings",
    icon: Settings,
  },
];

export default function PublicHomePage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-16 md:py-24">
        <div className="max-w-2xl mb-12">
          <h1 className="text-5xl font-serif font-bold text-foreground mb-4">
            Letters
          </h1>
          <p className="text-lg text-muted leading-relaxed">
            一个面向长文本创作的 AI 工作台。支持小说与论文两类工作空间，
            提供规划、扩写、笔记知识库和导出能力。
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {featureCards.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.title}
                href={item.href}
                className="card group hover:border-primary/30 transition-all"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
                <h2 className="text-xl font-serif font-semibold mb-2 text-foreground group-hover:text-primary transition-colors">
                  {item.title}
                </h2>
                <p className="text-sm text-muted leading-relaxed">{item.description}</p>
                <p className="text-sm text-primary mt-4">点击进入</p>
              </Link>
            );
          })}
        </div>

        <div className="mt-12 text-sm text-muted">
          未登录用户可查看此页；进入任意功能后将自动跳转登录。
        </div>
      </div>
    </div>
  );
}
