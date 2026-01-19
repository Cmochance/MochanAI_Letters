# 云端部署（Vercel + Neon）

目标：
- 使用 Vercel 部署前端（Web）
- 使用 Vercel 部署后端（API）
- 使用 Neon 部署数据库（Postgres）

## 0. 重要前提：本仓库已切换为 Postgres

当前代码与迁移工具链已默认使用 Postgres：
- Drizzle 迁移配置：`dialect: "postgresql"`（见 [drizzle.config.ts](file:///d:/Users/32162/Documents/GitHub/MochanAI_Letters/drizzle.config.ts)）
- 运行时数据库驱动：`pg` + `drizzle-orm/node-postgres`（见 [server/db.ts](file:///d:/Users/32162/Documents/GitHub/MochanAI_Letters/server/db.ts)）

## 1. Neon：创建数据库并获取连接串

1. 登录 Neon 控制台，创建 Project（Postgres）。
2. 创建数据库（例如 `mochan`）。
3. 复制连接串（Neon 会提供 `postgresql://...` 形式）。
4. 在 Vercel 后端项目中设置环境变量 `DATABASE_URL`（使用 Neon 的连接串）。

建议：优先使用 Neon 提供的 Pooled/Serverless 连接方式，避免在 Serverless 冷启动/并发下触发连接数问题。

## 2. 迁移与建表（在 Neon 上应用 Drizzle 迁移）

1. 在本地把 `DATABASE_URL` 指向 Neon（建议使用 Neon 的 pooled 连接串）。
2. 运行迁移：
   - `pnpm db:push`

如果你之前已经在 MySQL 里有数据：该切换不会自动迁移历史数据；需要自行导出/导入（或写一次性迁移脚本）。

## 3. Vercel：部署后端（API）

### 3.1 关键点：Express 常驻服务 ≠ Vercel Serverless

本仓库的后端入口是长驻进程（见 [server/_core/index.ts](file:///d:/Users/32162/Documents/GitHub/MochanAI_Letters/server/_core/index.ts)）。
在 Vercel 上通常需要把 API 作为 Serverless Function 暴露出来（例如放到 `api/` 目录），并导出 handler。

建议做法：
- 本仓库已提供 Vercel Function 入口：`api/[...path].ts`
- 该入口复用现有的 `appRouter/createContext`，并暴露：
  - `/api/trpc`
  - `/api/health`
  -（以及 OAuth 相关的 `/api/oauth/*` 路由）

重要：Vercel 后端项目的 `Root Directory` 需要保持为空（仓库根目录）。  
如果把 `Root Directory` 设为 `api/`，那么 `api/[...path].ts` 会变成部署根目录下的 `[...path].ts`，URL 将不再是 `/api/*`，从而出现 `/api/health` 404。

另外：如果你看到构建报错 `No Output Directory named "public"`，说明该 Vercel 项目被当作“需要产出静态目录”的项目在构建。仓库已提供 `public/` 目录用于满足默认的 Output Directory（也可以在 Vercel 项目设置里把 Output Directory 改为你需要的目录）。

如果部署后访问 `/api/health` 变成 500（FUNCTION_INVOCATION_FAILED），通常是函数在冷启动时崩溃。一个常见原因是 Node/Vercel 对 TypeScript 源码的模块解析与本地开发不同：仓库内所有服务端内部引用已改为不带 `.js` 后缀，避免出现 `Cannot find module .../*.js` 导致的崩溃。更新后重新部署即可。

如果日志里出现 `Error [ERR_REQUIRE_ESM]: require() of ES Module .../jose/... not supported`，说明函数被以 CommonJS 方式运行，但 `jose` 是 ESM-only。仓库已将 `jose` 的使用改为运行时动态 `import("jose")`，以兼容 CommonJS 的函数运行时；重新部署即可生效。

### 3.2 Vercel 环境变量（后端项目）

在 Vercel 后端项目里配置（Production/Preview/Development 视情况同步）：
- `DATABASE_URL`（Neon Postgres 连接串）
- `JWT_SECRET`
- 若启用 OAuth：`VITE_APP_ID`、`OAUTH_SERVER_URL`、`VITE_OAUTH_PORTAL_URL`、`OWNER_OPEN_ID`、`OWNER_NAME`
- 若启用 AI：`BUILT_IN_FORGE_API_URL`、`BUILT_IN_FORGE_API_KEY`

### 3.3 验证

- 打开后端域名，访问：`/api/health`
- 前端联通验证：前端能请求 `/api/trpc` 并返回数据/错误码正常

## 4. Vercel：部署前端（Expo Web）

### 4.1 构建方式

前端推荐单独建一个 Vercel 项目（“前端项目”），把 Expo Web 导出为静态资源后由 Vercel 托管。

1. 在 Vercel 新建项目
   - Import Git Repository：选择本仓库
   - Root Directory：保持为空（仓库根目录）
   - Framework Preset：选 `Other`

2. 配置 Build & Output Settings（前端项目）
   - Install Command：`pnpm install --frozen-lockfile`
   - Build Command：`pnpm build:web`
   - Output Directory：`dist`
   - Node.js Version：建议 18+（与默认一致即可）

3. 部署并校验静态产物
   - 部署完成后，Vercel 会从 `dist/` 提供静态站点
   - 如果你在 Build Logs 里看到输出目录不是 `dist`，就把 Output Directory 改成日志里实际的目录名

提示：本仓库的 `package.json` 里的 `pnpm run build` 是给后端打包（`dist/index.js`）用的，不适合作为前端项目的 Build Command。

### 4.2 Vercel 环境变量（前端项目）

在前端项目的 Environment Variables（Production/Preview/Development 视情况同步）里配置：
- `EXPO_PUBLIC_API_BASE_URL`
  - 如果你把后端单独部署在另一个 Vercel 项目：填 `https://<你的后端域名>`（例如 `https://mochan-ai-letters-back.vercel.app`）
  - 如果你打算前后端同域（推荐）：把前端请求改为相对路径 `/api`（或把该值填前端同域名，确保走同域的 `/api/*`）
- 若启用 OAuth：
  - `EXPO_PUBLIC_OAUTH_PORTAL_URL`
  - `EXPO_PUBLIC_OAUTH_SERVER_URL`
  - `EXPO_PUBLIC_APP_ID`
- 可选：
  - `EXPO_PUBLIC_OWNER_OPEN_ID`
  - `EXPO_PUBLIC_OWNER_NAME`

提示：前端 `.env` 读取逻辑在 [load-env.js](file:///d:/Users/32162/Documents/GitHub/MochanAI_Letters/scripts/load-env.js)。在 Vercel 上建议直接配置 `EXPO_PUBLIC_*`，避免混淆。

### 4.3 常见问题：刷新子路由 404

如果你使用 Expo Router，并且在页面内路由跳转正常，但“刷新某个子路径”出现 404，通常是静态托管缺少 fallback。

做法：在仓库根目录添加 `vercel.json`（注意：同仓库的所有 Vercel 项目都会读取它），加入以下 rewrites（保留 `/api/*`，其余重写到 `index.html`），然后重新部署：

```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/$1" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

## 5. OAuth / Cookie 的跨域注意事项（如启用登录）

Web 登录如果依赖 Cookie，会遇到跨域与 SameSite 限制：
- 最理想：前后端同域名（例如都在同一个域名下，通过反向代理把 `/api` 指到后端）
- 若前后端是不同域：需要正确设置 Cookie 的 `SameSite=None; Secure`，并确保 HTTPS
- 本仓库的 CORS 逻辑会回显 Origin 并允许 credentials（见 [server/_core/index.ts](file:///d:/Users/32162/Documents/GitHub/MochanAI_Letters/server/_core/index.ts)），但 Serverless 下仍需验证实际响应头是否符合浏览器策略

