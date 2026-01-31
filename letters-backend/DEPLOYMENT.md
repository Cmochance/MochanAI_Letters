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

在 Supabase SQL Editor 中执行 `drizzle/migrations/0000_fresh_start.sql`

### 1.3 获取连接信息

从 Supabase Dashboard > Settings > Database 获取：
- `DATABASE_URL`: 使用 Pooler 连接字符串 (端口 6543)
- `SUPABASE_URL`: 项目 URL
- `SUPABASE_SERVICE_KEY`: Service Role Key (Settings > API)

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
