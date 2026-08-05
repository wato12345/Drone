# Drone Path Planner — Backend

独立后端服务，负责用户认证与数据持久化。可单独作为 Git 仓库维护，前端通过 HTTP API 调用。

## 技术栈

- **Express** — HTTP API
- **MySQL** — 用户数据存储（`mysql2`）
- **bcrypt** — 密码哈希加密
- **JWT + HttpOnly Cookie** — 登录会话

## 目录结构

```
backend/
├── mysql-workbench/   # Workbench 连接配置（可导入）
├── scripts/           # MySQL 初始化与数据迁移脚本
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

### 1. 安装 MySQL 与 Workbench（macOS）

```bash
brew install mysql
brew install --cask mysqlworkbench
brew services start mysql
```

### 2. 初始化数据库

```bash
cd backend
cp .env.example .env
npm install
npm run setup:mysql
npm run dev
```

服务默认运行在 **http://localhost:5001**

## MySQL Workbench 连接

1. 打开 **MySQL Workbench**
2. 菜单 **Database → Manage Connections… → Import**
3. 选择 `backend/mysql-workbench/connections.xml`
4. 连接 **Drone Path Planner (Local)**，密码填写：`drone_dev_password`

| 字段 | 值 |
|------|-----|
| Host | `127.0.0.1` |
| Port | `3305` |
| User | `drone_app` |
| Password | `drone_dev_password` |
| Default Schema | `drone_path_planner` |

官方下载页：https://dev.mysql.com/downloads/workbench/

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `JWT_SECRET` | JWT 签名密钥（至少 32 字符） | — |
| `PORT` | 服务端口 | `5001` |
| `CLIENT_ORIGIN` | 前端地址（CORS） | `http://localhost:5173` |
| `MYSQL_HOST` | MySQL 主机 | `127.0.0.1` |
| `MYSQL_PORT` | MySQL 端口 | `3305` |
| `MYSQL_USER` | MySQL 用户名 | `drone_app` |
| `MYSQL_PASSWORD` | MySQL 密码 | `drone_dev_password` |
| `MYSQL_DATABASE` | 数据库名 | `drone_path_planner` |

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
| `id` | CHAR(36) | 主键 UUID |
| `username` | VARCHAR(32) | 用户名（唯一） |
| `email` | VARCHAR(255) | 邮箱（可选，唯一） |
| `password_hash` | VARCHAR(255) | bcrypt 哈希，不存明文 |
| `created_at` | DATETIME | 创建时间 |

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
git commit -m "Initial backend with MySQL auth"
```

前端项目在 `vite.config.ts` 中将 `/api` 代理到此后端地址即可。
