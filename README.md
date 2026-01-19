# 墨文 (MochanAI Letters)

一款融合传统水墨美学与现代 AI 技术的智能小说创作应用,为作家提供灵感记录、章节规划、内容扩写等全流程创作辅助。

## ✨ 核心功能

### 📚 小说管理
- 创建和管理多部小说作品
- 章节组织与编辑
- 字数统计与进度追踪
- AI 生成水墨风格封面

### 🤖 AI 辅助创作
- **RAG 向量检索**: 自动分析全文,提供智能背景上下文
- **章节规划**: 基于前文生成章节主题、框架、冲突点和互动元素
- **内容扩写**: 将大纲扩写为 4000 字完整章节,模仿用户文笔
- **自定义 AI 配置**: 支持 OpenAI 兼容 API,自由选择模型

### 📖 章节大纲视图
- 树状图展示小说结构
- 可视化章节关系和主题
- 快速导航和编辑

### 💡 灵感笔记
- 独立笔记模块,记录创作灵感
- 5 种分类:灵感、人物、世界观、情节、其他
- 支持关联到特定小说
- 分类筛选和快速查找

### 📥 多格式导出
- **TXT**: 纯文本格式
- **Markdown**: 保留格式的文本
- **ePub**: 标准电子书格式,适配 Kindle、Apple Books 等阅读设备

### ☁️ 云端同步
- 数据自动保存到云端
- 多设备无缝访问
- 本地备份导出(JSON 格式)

## 🎨 设计特色

### 水墨风格主题
- **米白色背景** (#F5F1E8): 模拟宣纸质感
- **墨黑色文字** (#2C2C2C): 营造书法笔触感
- **朱砂红强调** (#C8504D): 突出重要操作
- **思源宋体**: 优雅的中文书法字体

### 移动优先设计
- 遵循 Apple Human Interface Guidelines
- 单手操作友好
- 流畅的手势交互
- 响应式布局

## 🛠️ 技术栈

### 前端
- **React Native** 0.81 + **Expo SDK 54**: 跨平台移动应用框架
- **TypeScript** 5.9: 类型安全
- **NativeWind 4**: Tailwind CSS for React Native
- **React Query**: 数据获取和缓存
- **Expo Router 6**: 文件系统路由

### 后端
- **Node.js** + **Express**: 服务器框架
- **tRPC**: 端到端类型安全的 API
- **Drizzle ORM**: 类型安全的数据库操作
- **PostgreSQL（Neon）**: 关系型数据库

### AI 集成
- **OpenAI Embedding API**: 文本向量化
- **自定义 LLM**: 支持 OpenAI 兼容接口
- **RAG (Retrieval-Augmented Generation)**: 检索增强生成

### 数据存储
- **PostgreSQL（Neon）**: 结构化数据存储
- **S3**: 文件存储(封面图片/附件，可选)
- **AsyncStorage**: 本地缓存

## 📦 项目结构

```
novel_writer_app/
├── app/                      # 应用页面
│   ├── (tabs)/              # 标签页(小说列表、笔记)
│   ├── ai-outline.tsx       # AI 章节规划
│   ├── ai-expand.tsx        # AI 内容扩写
│   ├── chapter-detail.tsx   # 章节详情
│   ├── outline-view.tsx     # 章节大纲视图
│   ├── export.tsx           # 导出功能
│   ├── generate-cover.tsx   # 封面生成
│   ├── note-edit.tsx        # 笔记编辑
│   └── settings.tsx         # 设置
├── server/                   # 后端服务
│   ├── services/            # 业务逻辑
│   │   ├── rag.ts          # RAG 向量服务
│   │   ├── ai.ts           # AI 生成服务
│   │   ├── export.ts       # 导出服务
│   │   ├── cover.ts        # 封面生成
│   │   ├── backup.ts       # 备份服务
│   │   └── notes.ts        # 笔记服务
│   ├── routers.ts          # API 路由
│   └── db.ts               # 数据库操作
├── drizzle/                 # 数据库 schema
├── components/              # UI 组件
├── tests/                   # 单元测试
└── assets/                  # 静态资源
```

## 🚀 快速开始

### 环境要求
- Node.js 22+
- pnpm 9+
- PostgreSQL 16+

### 安装依赖
```bash
pnpm install
```

### 配置环境变量
创建 `.env` 文件（可直接复制并改写 [.env.example](file:///d:/Users/32162/Documents/GitHub/MochanAI_Letters/.env.example)）:
```env
DATABASE_URL=postgresql://user:password@host:port/database
JWT_SECRET=replace-with-a-long-random-string
BUILT_IN_FORGE_API_KEY=your-forge-api-key
```

### 数据库迁移
```bash
pnpm db:push
```

### 启动开发服务器
```bash
pnpm dev
```

### 运行测试
```bash
pnpm test
```

## 📱 部署

推荐按两条路径部署（文档更详细）：
- 本地 Docker Compose 一键启动（前端 Web + 后端 + Postgres）：[DEPLOYMENT_LOCAL_DOCKER_COMPOSE.md](file:///d:/Users/32162/Documents/GitHub/MochanAI_Letters/DEPLOYMENT_LOCAL_DOCKER_COMPOSE.md)
- 云端（Vercel 部署前后端 + Neon 部署数据库）：[DEPLOYMENT_CLOUD_VERCEL_NEON.md](file:///d:/Users/32162/Documents/GitHub/MochanAI_Letters/DEPLOYMENT_CLOUD_VERCEL_NEON.md)

### 移动端
使用 Expo 构建原生应用:
```bash
# iOS
pnpm ios

# Android
pnpm android

# 生成 QR 码(Expo Go)
pnpm qr
```

### 后端
```bash
# 构建
pnpm build

# 启动生产服务器
pnpm start
```

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request!

## 📧 联系方式

如有问题或建议,请通过 GitHub Issues 联系。

---

**墨文** - 让创作回归本质,用 AI 点亮灵感之光 ✨
