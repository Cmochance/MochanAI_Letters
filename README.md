# Letters - AI 智能小说创作平台

融合传统水墨美学与现代 AI 技术的智能小说创作平台。

## 项目结构

```
MochanAI_Letters/
├── letters-frontend/    # Next.js 15 前端 (部署到 Vercel)
├── letters-backend/     # Node.js + Express 后端 (部署到 VPS)
├── .backup/             # 原项目备份
└── package.json         # Monorepo 根配置
```

## 技术栈

### 前端 (letters-frontend)
- Next.js 15 (App Router + RSC)
- React 19
- Tailwind CSS 3.4 (水墨风格主题)
- tRPC 11 + TanStack Query 5
- Supabase Auth (SSR)

### 后端 (letters-backend)
- Node.js + Express 4.22
- tRPC 11
- Drizzle ORM
- PostgreSQL (Supabase) + pgvector

### 数据库 (Supabase)
- PostgreSQL 数据库
- pgvector 扩展 (向量相似度搜索)
- Supabase Auth 认证

### 存储 (Cloudflare R2)
- 封面图片存储
- 导出文件存储
- S3 兼容 API

### AI 服务
- OpenAI GPT-4 (文本生成)
- OpenAI text-embedding-3-small (向量嵌入)
- RAG 检索增强生成

## 快速开始

### 1. 安装依赖

```bash
npm run install:all
```

### 2. 配置环境变量

**前端 (letters-frontend/.env.local)**
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_URL=http://localhost:3000
```

**后端 (letters-backend/.env)**
```env
# Database (Supabase PostgreSQL with pgvector)
DATABASE_URL=postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres

# Supabase
SUPABASE_URL=https://[project-ref].supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key

# JWT
JWT_SECRET=your-jwt-secret

# AI (Chat Completion)
BUILT_IN_FORGE_API_KEY=your-openai-api-key
BUILT_IN_FORGE_BASE_URL=https://api.openai.com/v1

# AI Image Generation (for novel covers)
# Falls back to BUILT_IN_FORGE_* if IMAGE_GEN_API_KEY is not set
IMAGE_GEN_API_KEY=your-image-api-key
IMAGE_GEN_BASE_URL=https://api.openai.com/v1
IMAGE_GEN_MODEL=dall-e-3

# Embedding Model (for RAG)
EMBEDDING_API_KEY=your-openai-api-key
EMBEDDING_BASE_URL=https://api.openai.com/v1
EMBEDDING_MODEL=text-embedding-3-small

# Cloudflare R2 Storage
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_BUCKET_NAME=letters-storage
R2_PUBLIC_URL=https://your-bucket.r2.dev

# Server
PORT=3000
NODE_ENV=development

# CORS
CORS_ORIGIN=http://localhost:3001
```

### 3. 启用 pgvector 扩展

在 Supabase Dashboard 中执行:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 4. 初始化数据库

```bash
npm run db:push
```

或运行迁移文件:
```bash
cd letters-backend
psql $DATABASE_URL -f drizzle/migrations/0000_fresh_start.sql
```

### 5. 启动开发服务器

```bash
npm run dev
```

- 前端: http://localhost:3001
- 后端: http://localhost:3000

## 部署

### 前端部署到 Vercel

1. 连接 GitHub 仓库到 Vercel
2. 设置根目录为 `letters-frontend`
3. 配置环境变量
4. 部署

### 后端部署到 VPS

```bash
cd letters-backend

# 使用 Docker
docker build -t letters-backend .
docker run -d -p 3000:3000 --env-file .env letters-backend

# 或使用 docker-compose
docker-compose up -d
```

## 功能特性

- 📚 **小说管理** - 创建、编辑、删除小说
- 🖼️ **智能封面** - 新建小说自动生成封面，可手动重新生成
- 📝 **章节编辑** - 富文本编辑器，自动保存
- 🤖 **AI 辅助** - 章节规划、内容扩写
- 🔍 **RAG 检索** - 基于小说全文的智能上下文检索
- 💡 **灵感笔记** - 5 种分类，关联小说
- 📤 **多格式导出** - TXT、Markdown、ePub
- 🎨 **水墨风格** - 传统美学设计
- ☁️ **云端存储** - Cloudflare R2 文件存储

## RAG 功能说明

Letters 使用 RAG (Retrieval-Augmented Generation) 技术，将小说全文作为知识库：

1. **向量化**: 章节内容被分块并转换为向量嵌入 (1536 维度)
2. **存储**: 向量存储在 PostgreSQL 中，使用 pgvector 扩展
3. **检索**: 使用 HNSW 索引进行高效的余弦相似度搜索
4. **上下文**: 结合 RAG 结果和最近 3 章内容，为 AI 提供丰富的上下文

### API 端点

- `ai.vectorizeChapter` - 向量化单个章节
- `ai.vectorizeNovel` - 向量化整本小说
- `ai.getEmbeddingStats` - 获取向量化统计
- `ai.searchContext` - 搜索相关内容

## 水墨风格主题

| 颜色 | 用途 | 色值 |
|------|------|------|
| 朱砂红 | 主色 | #C8504D |
| 米白色 | 背景 | #F5F1E8 |
| 墨黑色 | 文字 | #2C2C2C |
| 竹青色 | 成功 | #6B8E23 |
| 土黄色 | 警告 | #D4A574 |

## 依赖版本

### 前端
- next: ^15.1.0
- react: ^19.0.0
- @supabase/supabase-js: ^2.90.1
- @trpc/client: ^11.0.0
- @tanstack/react-query: ^5.62.0

### 后端
- express: ^4.21.2
- @trpc/server: ^11.0.0
- drizzle-orm: ^0.38.0
- @aws-sdk/client-s3: ^3.974.0
- openai: ^4.77.0
- pgvector: ^0.2.0

## License

MIT
