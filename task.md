# Task Recorder

## 原始提示词

分析当前项目的功能、结构，将项目内的文件转移到 .backup 中，然后从零开始重新写一个具有相同前端风格、功能和结构，且满足以下要求的新项目：前端部署在 Vercel 上，后端部署在 VPS 上，数据存放在 Supabase 上。

## 任务要求

- 保持原有水墨风格 UI 设计
- 前后端分离架构
- 前端: Next.js 15 部署到 Vercel
- 后端: Node.js + Express 部署到 VPS
- 数据库: Supabase PostgreSQL + pgvector
- 认证: Supabase Auth
- 文件存储: Cloudflare R2
- RAG: OpenAI text-embedding-3-small
- 使用最新稳定版依赖包

## 整体结构

```
MochanAI_Letters/
├── letters-frontend/    # Next.js 15 前端
│   ├── src/app/         # App Router 页面
│   ├── src/components/  # UI 组件
│   ├── src/lib/         # 工具库 (Supabase, tRPC)
│   └── src/hooks/       # React Hooks
├── letters-backend/     # Node.js 后端
│   ├── src/routers/     # tRPC 路由
│   ├── src/services/    # 业务服务 (AI, RAG, Storage, Embedding)
│   ├── src/db/          # Drizzle ORM + pgvector
│   └── src/middleware/  # 认证中间件
├── .backup/             # 原项目备份
└── package.json         # Monorepo 配置
```

## 执行步骤

### Step 1: 备份原项目
- 状态: ✅ 完成
- 总结: 创建 .backup 目录，移动所有原有文件（保留 .git）

### Step 2: 初始化前端项目
- 状态: ✅ 完成
- 总结: 创建 mochan-web 目录，配置 Next.js 15 + TypeScript + Tailwind CSS

### Step 3: 迁移水墨风格主题
- 状态: ✅ 完成
- 总结: 配置 Tailwind 主题色（朱砂红、米白色、墨黑色等），创建全局 CSS 样式

### Step 4: 集成 Supabase Auth
- 状态: ✅ 完成
- 总结: 配置 Supabase SSR 客户端、认证中间件、登录/注册页面

### Step 5: 重写页面组件
- 状态: ✅ 完成
- 总结: 创建小说列表、小说详情、章节编辑、笔记、设置、AI 规划、AI 扩写、导出等页面

### Step 6: 配置 tRPC 客户端
- 状态: ✅ 完成
- 总结: 配置 tRPC React Query 客户端，集成 Supabase Auth token

### Step 7: 初始化后端项目
- 状态: ✅ 完成
- 总结: 创建 mochan-server 目录，配置 Node.js + Express + TypeScript

### Step 8: 配置 Drizzle ORM
- 状态: ✅ 完成
- 总结: 定义数据库 Schema（users, novels, chapters, notes, settings），配置 Supabase 连接

### Step 9: 迁移 tRPC 路由
- 状态: ✅ 完成
- 总结: 创建 novels, chapters, ai, notes, export, settings, backup 路由

### Step 10: 迁移服务层
- 状态: ✅ 完成
- 总结: 迁移 AI 服务、RAG 服务、导出服务、封面生成服务、备份服务

### Step 11: 实现认证中间件
- 状态: ✅ 完成
- 总结: 创建 Supabase JWT 验证中间件，自动创建/更新用户记录

### Step 12: 创建部署配置
- 状态: ✅ 完成
- 总结: 创建 Dockerfile、docker-compose.yml、vercel.json、README.md

### Step 13: 项目重命名
- 状态: ✅ 完成
- 总结: 将 mochan-server 重命名为 letters-backend，mochan-web 重命名为 letters-frontend

### Step 14: 实现 Cloudflare R2 存储
- 状态: ✅ 完成
- 总结: 创建 storage.ts 服务，支持文件上传/下载/删除，集成到封面生成和导出服务

### Step 15: 实现 RAG 嵌入功能
- 状态: ✅ 完成
- 总结: 
  - 创建 embedding.ts 服务，使用 OpenAI text-embedding-3-small 模型
  - 修改 schema.ts 使用 pgvector 向量类型 (1536 维度)
  - 重写 rag.ts 实现完整的向量相似度搜索
  - 创建数据库迁移文件启用 pgvector 扩展和 HNSW 索引
  - 扩展 userSettings 表支持用户自定义嵌入模型配置
  - 更新 AI 路由支持向量化和搜索功能

### Step 16: 添加中英文切换功能
- 状态: ✅ 完成
- 总结:
  - 安装 next-intl ^3.26.0 国际化库
  - 创建 messages/zh.json 和 messages/en.json 翻译文件
  - 配置 i18n/config.ts 和 i18n/request.ts
  - 更新 next.config.ts 集成 next-intl 插件
  - 创建 LanguageSwitcher 组件和 useLocale hook
  - 更新 Navbar、登录、注册、设置、小说列表等页面使用翻译
  - 语言偏好存储在 Cookie 中，支持持久化

## 依赖包版本 (2026-01 验证)

### 前端
- next: ^15.1.0
- next-intl: ^3.26.0
- react: ^19.0.0
- @supabase/supabase-js: ^2.90.1
- @trpc/client: ^11.0.0
- @tanstack/react-query: ^5.62.0
- tailwindcss: ^3.4.17

### 后端
- express: ^4.21.2
- @trpc/server: ^11.0.0
- drizzle-orm: ^0.38.0
- postgres: ^3.4.5
- @supabase/supabase-js: ^2.90.1
- @aws-sdk/client-s3: ^3.974.0
- @aws-sdk/s3-request-presigner: ^3.974.0
- openai: ^4.77.0
- pgvector: ^0.2.0
