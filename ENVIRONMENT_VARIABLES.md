# 环境变量清单（生产建议）

本仓库分为两个部署单元：
- 后端（API）：Node/Express + tRPC + Postgres
- 前端（Expo Web / App）：Expo Router

下面按“后端 / 前端”分别列出变量，并给出填写建议。

## 后端（API 项目）

### 必填（生产）

| 变量 | 用途 | 填写建议 |
|---|---|---|
| `DATABASE_URL` | Postgres 连接串 | 使用 Neon/自建 Postgres；建议最小权限账号；不要放到前端 |
| `JWT_SECRET` | 会话 Cookie/JWT 签名密钥 | 生成足够长的随机字符串（≥32 字符），定期轮换需要全体用户重新登录 |

### 登录方式

| 变量 | 用途 | 填写建议 |
|---|---|---|
| `AUTH_MODE` | 认证模式 | `local`（默认，邮箱+密码）/ `oauth`（接外部 OAuth）/ `demo`（演示，不建议上线） |
| `AUTH_PASSWORD_PEPPER` | 密码哈希增强 pepper | 生产强烈建议设置长随机字符串；只放后端；丢失会导致用户无法验证旧密码 |
| `VITE_APP_ID` | OAuth App ID | 仅 `AUTH_MODE=oauth` 时需要；没有外部 OAuth 可忽略 |
| `OAUTH_SERVER_URL` | OAuth 服务端地址 | 仅 `AUTH_MODE=oauth` 时需要；本仓库不提供该服务 |
| `VITE_OAUTH_PORTAL_URL` | OAuth 登录门户地址 | 仅 `AUTH_MODE=oauth` 时需要；本仓库不提供该服务 |

### 可选

| 变量 | 用途 | 填写建议 |
|---|---|---|
| `OWNER_OPEN_ID` / `OWNER_NAME` | owner 标识/通知 | 可选；用于管理员通知等能力 |
| `BUILT_IN_FORGE_API_URL` / `BUILT_IN_FORGE_API_KEY` | 内置 AI 能力 | 如果你使用内置 Forge/LLM，则配置；否则可让用户在前端“AI 配置”里自填 |
| `NODE_ENV` | 运行环境 | Vercel 通常自动设置为 `production` |
| `PORT` | 本地监听端口 | 主要用于本地/容器部署，Vercel 可忽略 |
| `DEMO_MODE` / `DEMO_OPEN_ID` / `DEMO_NAME` | Demo 用户 | 仅自用演示；上线不要开 |

## 前端（Web/App 项目）

前端的 `EXPO_PUBLIC_*` 会被打包进产物（相当于公开信息），不要放任何密钥。

| 变量 | 用途 | 填写建议 |
|---|---|---|
| `EXPO_PUBLIC_API_BASE_URL` | API 基址 | 生产建议填 `https://api.example.com` 或你的 Vercel 后端域名；末尾不需要 `/` |
| `EXPO_PUBLIC_APP_ID` | OAuth App ID | 仅接外部 OAuth 时需要；不接外部 OAuth 可留空 |
| `EXPO_PUBLIC_OAUTH_SERVER_URL` | OAuth 服务端地址 | 仅接外部 OAuth 时需要 |
| `EXPO_PUBLIC_OAUTH_PORTAL_URL` | OAuth 登录门户地址 | 仅接外部 OAuth 时需要 |
| `EXPO_PUBLIC_OWNER_OPEN_ID` / `EXPO_PUBLIC_OWNER_NAME` | owner 展示 | 可选 |

