#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SQL_FILE="$ROOT_DIR/scripts/setup-mysql.sql"
MYSQL_PORT="${MYSQL_PORT:-3305}"

MYSQL_BIN=""
for candidate in \
  /opt/homebrew/opt/mysql@8.4/bin/mysql \
  /opt/homebrew/bin/mysql \
  /usr/local/mysql/bin/mysql \
  /usr/local/bin/mysql; do
  if [[ -x "$candidate" ]]; then
    MYSQL_BIN="$candidate"
    break
  fi
done

if [[ -z "$MYSQL_BIN" ]] && command -v mysql >/dev/null 2>&1; then
  MYSQL_BIN="$(command -v mysql)"
fi

if [[ -z "$MYSQL_BIN" ]]; then
  echo "未找到 mysql 命令。请先安装 MySQL Server："
  echo "  brew install mysql"
  echo "或从 https://dev.mysql.com/downloads/mysql/ 下载 macOS ARM 安装包"
  exit 1
fi

if ! pgrep -x mysqld >/dev/null 2>&1; then
  echo "正在启动 MySQL 服务..."
  if command -v brew >/dev/null 2>&1; then
    brew services start mysql || true
  fi
  sleep 3
fi

echo "正在创建数据库和用户（端口 ${MYSQL_PORT}）..."
"$MYSQL_BIN" -u root -P "$MYSQL_PORT" --protocol=TCP < "$SQL_FILE"

echo "MySQL 已配置完成："
echo "  数据库: drone_path_planner"
echo "  用户名: drone_app"
echo "  密码:   drone_dev_password"
echo "  主机:   127.0.0.1"
echo "  端口:   ${MYSQL_PORT}"
