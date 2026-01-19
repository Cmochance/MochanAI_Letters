# 本地部署（Docker Compose 一键启动前端 + 后端 + 数据库）

目标：在本机通过 Docker Compose 一键拉起：
- Postgres 数据库（容器）
- 后端 API（Express+tRPC，容器）
- 前端 Web（Expo Web Dev Server，容器）

> 说明：这里的“前端”指 Web 调试入口（`expo start --web`）。iOS/Android 本地调试通常仍建议直接在宿主机跑 Expo（便于真机/模拟器联调）。

## 0. 前置条件（Windows）

1. 安装并启动 Docker Desktop（建议启用 WSL2 后端）。
2. 确认 Docker 引擎可用：
   - `docker version` 能看到 Server 信息
3. 若你遇到报错：
   - `open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified`
   - 含义是 Docker CLI 连不上 Docker Desktop 引擎
   - 处理：启动/重启 Docker Desktop；必要时执行 `wsl --shutdown` 后再打开 Docker Desktop

## 1. 准备环境变量

本地 Compose 已在 `docker-compose.yml` 内给 `api` 服务写了默认的 `DATABASE_URL/JWT_SECRET`，你不需要额外创建 `.env` 就能跑起来。

如果你希望把本地参数写到文件里统一管理，可以复制 [.env.example](file:///d:/Users/32162/Documents/GitHub/MochanAI_Letters/.env.example) 为 `.env`，并根据需要改写（OAuth/Forge 等属于可选能力）。

## 2. 一键启动

在仓库根目录执行：
```bash
docker compose up --pull always
```

首次启动会：
- 拉取 `postgres:16` 镜像
- 安装 Node 依赖（通过 `deps` 服务只安装一次，避免并发安装导致错误）
- 启动后端（默认 `http://localhost:3000`）
- 启动前端 Web（默认 `http://localhost:8081`）

提示：`deps` 容器会在依赖安装完成后正常退出（状态 Exited 0），这属于预期行为。

## 3. 初始化数据库（迁移）

首次启动后，需要把 Drizzle 的迁移应用到 Postgres：
```bash
docker compose exec api pnpm db:push
```

验证表是否创建成功（可选）：
```bash
docker compose exec db psql -U postgres -d mochan -c "\\dt"
```

## 4. 访问与验证

- 后端健康检查：`GET http://localhost:3000/api/health`（期望返回 `{ ok: true, timestamp: ... }`）
- 前端 Web：打开 `http://localhost:8081`
- tRPC 接口：`http://localhost:3000/api/trpc`（供前端调用，不建议手动浏览器访问）

## 5. 常见问题

### 5.1 拉取镜像失败 / 找不到 dockerDesktopLinuxEngine
- 原因：Docker Desktop 未启动，或引擎没就绪
- 处理：启动 Docker Desktop；等状态 Running 后再执行 `docker compose up`
- 仍不行：`wsl --shutdown` 然后重启 Docker Desktop

### 5.2 端口冲突（3000/5432/8081）
- 修改 [docker-compose.yml](file:///d:/Users/32162/Documents/GitHub/MochanAI_Letters/docker-compose.yml) 里的 ports 映射，例如把 `3000:3000` 改成 `3100:3000`，并同步更新前端的 `EXPO_PUBLIC_API_BASE_URL`

### 5.3 数据库连接失败
- 确认 Postgres 容器健康：`docker compose ps`
- 确认后端环境变量：`docker compose exec api node -e "console.log(process.env.DATABASE_URL)"`

### 5.4 api/web 容器退出码 1，日志出现 ERR_PNPM_ENOENT

常见原因是多个容器同时在同一个挂载目录里执行 `pnpm install`，在 Windows + 目录挂载场景下容易触发文件同步/并发问题。

处理方式：
- 当前 [docker-compose.yml](file:///d:/Users/32162/Documents/GitHub/MochanAI_Letters/docker-compose.yml) 已加入 `deps` 服务：用于“只安装一次依赖”，并为 pnpm store 使用独立 volume
- 执行以下命令重启：
  - `docker compose down`
  - `docker compose up --pull always`

## 6. 停止与清理

- 停止：`docker compose down`
- 删除数据（慎用，会清空 Postgres）：`docker compose down -v`

