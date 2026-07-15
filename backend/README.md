# Drone Path Planner — Backend

独立后端服务，负责用户认证与数据持久化。可单独作为 Git 仓库维护，前端通过 HTTP API 调用。

## 技术栈

- **Express** — HTTP API
- **SQLite** — 用户数据存储（`better-sqlite3`）
- **bcrypt** — 密码哈希加密
- **JWT + HttpOnly Cookie** — 登录会话

## 目录结构

```
backend/
├── data/              # SQLite 数据库文件（自动生成，已 gitignore）
├── scripts/           # 数据迁移脚本
├── src/
│   ├── db/            # 数据库连接与用户仓储
│   ├── middleware/    # 认证中间件
│   ├── routes/        # API 路由
│   ├── services/      # 加密、JWT 等业务逻辑
│   └── index.js       # 入口
├── .env.example
└── package.json
```

## 快速开始

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

服务默认运行在 **http://localhost:5001**

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `JWT_SECRET` | JWT 签名密钥（至少 32 字符） | — |
| `PORT` | 服务端口 | `5001` |
| `CLIENT_ORIGIN` | 前端地址（CORS） | `http://localhost:5173` |
| `DATABASE_PATH` | SQLite 文件路径 | `./data/app.db` |

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| POST | `/api/auth/register` | 注册 |
| POST | `/api/auth/login` | 登录 |
| POST | `/api/auth/logout` | 退出 |
| GET | `/api/auth/me` | 获取当前用户 |

## 数据库

用户表 `users`：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | TEXT | 主键 UUID |
| `username` | TEXT | 用户名（唯一） |
| `email` | TEXT | 邮箱（可选，唯一） |
| `password_hash` | TEXT | bcrypt 哈希，不存明文 |
| `created_at` | TEXT | 创建时间 |

数据库文件位于 `backend/data/app.db`。

## 从旧 JSON 迁移

若之前使用 `server/data/users.json`，可一键导入：

```bash
npm run migrate:json
# 或指定路径
node scripts/migrate-from-json.js ../server/data/users.json
```

## 作为独立仓库

```bash
cd backend
git init
git add .
git commit -m "Initial backend with SQLite auth"
```

前端项目在 `vite.config.ts` 中将 `/api` 代理到此后端地址即可。
