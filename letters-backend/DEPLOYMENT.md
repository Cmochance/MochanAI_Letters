# VPS Docker 部署指南

本指南介绍如何在 VPS 上使用 Docker 部署 Letters 后端，数据存储在 Supabase。

## 前置要求

- VPS (Ubuntu 22.04+ 推荐)
- Docker 和 Docker Compose
- Supabase 项目 (用于数据库和认证)
- 域名 (可选，用于 HTTPS)

## 1. Supabase 配置

### 1.1 创建 Supabase 项目

1. 访问 [supabase.com](https://supabase.com) 创建项目
2. 在 SQL Editor 中启用 pgvector 扩展：
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

### 1.2 运行数据库迁移

在 Supabase SQL Editor 中执行数据库迁移脚本：

1. 登录 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择你的项目
3. 点击左侧菜单的 **SQL Editor**
4. 点击 **New query** 创建新查询
5. 打开本项目的 `drizzle/migrations/0000_fresh_start.sql` 文件
6. 复制文件的全部内容，粘贴到 SQL Editor 中
7. 点击右下角的 **Run** 按钮执行
8. 确认执行成功（应显示 "Success. No rows returned"）

> **注意**：如果提示 pgvector 扩展相关错误，请先在 Dashboard > Database > Extensions 中启用 `vector` 扩展，或执行：
>
> ```sql
> CREATE EXTENSION IF NOT EXISTS vector;
> ```

执行完成后，可以在 **Table Editor** 中看到以下表：

- `users` - 用户表
- `novels` - 小说表
- `chapters` - 章节表
- `chapter_embeddings` - 章节向量嵌入表
- `user_settings` - 用户设置表
- `notes` - 笔记表

### 1.3 获取连接信息

需要从 Supabase Dashboard 获取以下配置信息：

#### DATABASE_URL（数据库连接字符串）

1. 进入 Supabase Dashboard > **Settings** > **Database**
2. 滚动到 **Connection string** 部分
3. 选择 **Transaction pooler** 模式（推荐用于 Serverless 和高并发场景）
4. 选择 **URI** 标签页
5. 复制连接字符串，格式如下：
   ```
   postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
   ```
6. 将 `[password]` 替换为你的数据库密码（创建项目时设置的）

> **关于连接模式**：
>
> - **Transaction pooler (端口 6543)**：推荐使用，支持高并发连接，适合 Docker 部署
> - **Session pooler (端口 5432)**：适合需要持久连接的场景
> - **Direct connection (端口 5432)**：直连数据库，连接数有限制

#### SUPABASE_URL（项目 URL）

1. 进入 Supabase Dashboard > **Settings** > **API**
2. 在 **Project URL** 部分复制 URL
3. 格式：`https://[project-ref].supabase.co`

#### SUPABASE_SERVICE_KEY（服务端密钥）

1. 进入 Supabase Dashboard > **Settings** > **API**
2. 在 **Project API keys** 部分找到 `service_role` 密钥
3. 点击 **Reveal** 显示并复制

> **⚠️ 安全警告**：`service_role` 密钥拥有完全的数据库访问权限，绕过所有 RLS 策略。请勿在前端代码中使用，仅用于后端服务。

#### 配置示例

```env
DATABASE_URL=postgresql://postgres.abcdefghijk:YourPassword123@aws-0-us-east-1.pooler.supabase.com:5432/postgres
SUPABASE_URL=https://abcdefghijk.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 1.4 配置 Cloudflare R2 存储（可选）

R2 用于存储小说封面图片和导出文件。如果不配置，相关功能将不可用。

#### 创建 R2 存储桶

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 在左侧菜单选择 **R2 Object Storage**
3. 点击 **Create bucket** 创建存储桶
4. 输入存储桶名称（如 `letters-storage`）
5. 选择区域后点击 **Create bucket**

#### 获取 Account ID

1. 在 Cloudflare Dashboard 右侧边栏查看 **Account ID**
2. 或进入 **R2 Object Storage** 页面，URL 中包含 Account ID

#### 创建 API Token

1. 进入 **R2 Object Storage** > **Manage R2 API Tokens**
2. 点击 **Create API token**
3. 设置权限为 **Object Read & Write**
4. 选择应用到的存储桶（或所有存储桶）
5. 点击 **Create API Token**
6. 保存显示的 **Access Key ID** 和 **Secret Access Key**

> **⚠️ 注意**：Secret Access Key 只显示一次，请立即保存。

#### 配置公开访问（可选）

如需通过公开 URL 访问文件：

1. 进入存储桶 > **Settings**
2. 在 **Public access** 部分启用 **R2.dev subdomain**
3. 复制生成的公开 URL（格式：`https://pub-xxx.r2.dev`）

或者配置自定义域名：

1. 在 **Custom domains** 部分添加你的域名
2. 按提示配置 DNS 记录

#### 配置示例

```env
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_BUCKET_NAME=letters-storage
R2_PUBLIC_URL=https://pub-xxx.r2.dev
```

## 2. VPS 部署

### 2.1 安装 Docker

```bash
# Ubuntu
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# 重新登录以应用权限
```

### 2.2 克隆项目

```bash
git clone <your-repo-url>
cd letters-backend
```

### 2.3 配置环境变量

```bash
cp .env.example .env
nano .env  # 编辑配置
```

关键配置项：

- `DATABASE_URL`: Supabase Pooler 连接字符串
- `SUPABASE_URL` / `SUPABASE_SERVICE_KEY`: Supabase 认证
- `CORS_ORIGIN`: 前端域名
- `BUILT_IN_FORGE_*`: AI API 配置

### 2.4 部署

```bash
chmod +x deploy.sh
./deploy.sh build
./deploy.sh start
```

### 2.5 验证

```bash
curl http://localhost:30080/api/health
# 应返回: {"ok":true,"timestamp":...}
```

## 3. Nginx 反向代理 (推荐)

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:30080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

使用 Certbot 配置 HTTPS：

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
```

## 4. 常用命令

```bash
./deploy.sh start    # 启动服务
./deploy.sh stop     # 停止服务
./deploy.sh restart  # 重启服务
./deploy.sh logs     # 查看日志
./deploy.sh update   # 更新并重新部署
./deploy.sh status   # 查看状态
```

## 5. 故障排查

### 数据库连接失败

- 确认使用 Pooler 连接字符串 (端口 6543)
- 检查 `?pgbouncer=true` 参数

### 认证失败

- 确认 `SUPABASE_SERVICE_KEY` 是 Service Role Key
- 检查前端使用的是 Anon Key

### CORS 错误

- 确认 `CORS_ORIGIN` 包含前端域名
- 多个域名用逗号分隔
