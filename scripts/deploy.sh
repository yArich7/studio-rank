#!/usr/bin/env bash
#
# 一键部署后端到 Linux 服务器（Ubuntu 20.04+ / Debian 11+）
#
# 用法：
#   sudo bash deploy.sh                 # 交互式配置
#   sudo bash deploy.sh --dir /srv/app  # 自定义目录
#
# 非交互（CI 或重复部署）：
#   APPID=wx... APPSECRET=... INVITE_CODES=ABCDE sudo -E bash deploy.sh --yes
#
# 幂等：已存在 .env 会跳过；已部署会 git pull + pm2 reload。

set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/yArich7/studio-rank.git}"
BRANCH="${BRANCH:-main}"
APP_DIR="${APP_DIR:-/opt/leetcode-rank}"
ASSUME_YES=0

while [ $# -gt 0 ]; do
  case "$1" in
    --dir)     APP_DIR="${2:-}"; shift 2;;
    --dir=*)   APP_DIR="${1#*=}"; shift;;
    --branch=*) BRANCH="${1#*=}"; shift;;
    --yes|-y)  ASSUME_YES=1; shift;;
    --help|-h)
      sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
      exit 0;;
    *) echo "未知参数：$1（用 --help 查看）" >&2; exit 1;;
  esac
done

[ -n "$APP_DIR" ] || { echo "--dir 不能为空" >&2; exit 1; }

log()  { printf '\033[36m==>\033[0m %s\n' "$*"; }
ok()   { printf '\033[32m ✓ \033[0m %s\n' "$*"; }
warn() { printf '\033[33m ! \033[0m %s\n' "$*"; }
die()  { printf '\033[31m ✗ \033[0m %s\n' "$*" >&2; exit 1; }

# ---------- 0. 环境检查 ----------
[ "$(uname -s)" = "Linux" ] || die "这个脚本只在 Linux 上跑（当前 $(uname -s)）"

SUDO=""
if [ "$(id -u)" -ne 0 ]; then
  command -v sudo >/dev/null 2>&1 || die "需要 root 或 sudo"
  SUDO="sudo"
fi

need() { command -v "$1" >/dev/null 2>&1; }

# ---------- 1. 依赖 ----------
log "检查依赖"

if ! need git; then
  log "安装 git"
  $SUDO apt-get update -qq && $SUDO apt-get install -y -qq git
fi
ok "git $(git --version | awk '{print $3}')"

if ! need node; then
  log "安装 Node.js 20"
  curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO bash -
  $SUDO apt-get install -y -qq nodejs
fi
NODE_MAJOR="$(node -v | sed 's/v\([0-9]*\).*/\1/')"
[ "$NODE_MAJOR" -ge 18 ] || die "Node 版本过低（$(node -v)），需要 >= 18"
ok "node $(node -v)"

if ! need pm2; then
  log "安装 pm2"
  $SUDO npm i -g pm2 >/dev/null
fi
ok "pm2 $(pm2 -v)"

if ! need curl; then
  $SUDO apt-get install -y -qq curl
fi

# ---------- 2. 代码 ----------
log "获取代码到 $APP_DIR"

if [ -d "$APP_DIR" ] && [ ! -d "$APP_DIR/.git" ]; then
  die "$APP_DIR 已存在但不是 git 仓库，请先清空或换 --dir"
fi

if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" fetch --quiet origin "$BRANCH"
  git -C "$APP_DIR" checkout --quiet "$BRANCH"
  if ! git -C "$APP_DIR" pull --ff-only --quiet origin "$BRANCH"; then
    die "更新失败（可能有本地修改）。处理：cd $APP_DIR && git status"
  fi
  ok "已更新到 $(git -C "$APP_DIR" rev-parse --short HEAD)"
else
  $SUDO mkdir -p "$(dirname "$APP_DIR")"
  if ! git clone --quiet --branch "$BRANCH" "$REPO_URL" "$APP_DIR" 2>/dev/null; then
    die "克隆失败。如果仓库是私有的，请先配置 Deploy Key（见 server/DEPLOY.md 第 1 节），
   或者把仓库改成公开后再运行。"
  fi
  ok "已克隆 $(git -C "$APP_DIR" rev-parse --short HEAD)"
fi

[ -f "$APP_DIR/server/index.js" ] || die "$APP_DIR 结构不对，缺少 server/index.js"

# ---------- 3. .env ----------
ENV_FILE="$APP_DIR/server/.env"

gen_secret() {
  if need openssl; then openssl rand -hex 32
  else node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  fi
}

if [ -f "$ENV_FILE" ]; then
  ok ".env 已存在，跳过配置"
else
  log "生成 .env"

  if [ "$ASSUME_YES" -eq 0 ] && [ -t 0 ]; then
    read -rp "小程序 AppID: " IN_APPID
    read -rsp "小程序 AppSecret（输入不回显）: " IN_SECRET; echo
    read -rp "邀请码（逗号分隔）[STUDIO2026]: " IN_INVITE
    IN_INVITE="${IN_INVITE:-STUDIO2026}"
    read -rp "邀请码可用次数 [50]: " IN_LIMIT
    IN_LIMIT="${IN_LIMIT:-50}"
  else
    IN_APPID="${APPID:-}"
    IN_SECRET="${APPSECRET:-}"
    IN_INVITE="${INVITE_CODES:-STUDIO2026}"
    IN_LIMIT="${INVITE_LIMIT:-50}"
  fi

  [ -n "$IN_APPID" ] || die "缺少 APPID（交互输入，或设置环境变量 APPID）"
  [ -n "$IN_SECRET" ] || die "缺少 APPSECRET（交互输入，或设置环境变量 APPSECRET）"

  ADMIN_TOKEN_VALUE="${ADMIN_TOKEN:-$(gen_secret)}"

  $SUDO tee "$ENV_FILE" >/dev/null <<EOF
# 由 scripts/deploy.sh 生成
PORT=3000
HOST=127.0.0.1

APPID=$IN_APPID
APPSECRET=$IN_SECRET
AUTH_SECRET=$(gen_secret)
ADMIN_TOKEN=$ADMIN_TOKEN_VALUE

INVITE_CODES=$IN_INVITE
INVITE_LIMIT=$IN_LIMIT

SYNC_MINUTE=5
EOF

  $SUDO chmod 600 "$ENV_FILE"
  ok "已写入 $ENV_FILE（权限 600）"
  warn "ADMIN_TOKEN 已生成，手动同步时要用：$ADMIN_TOKEN_VALUE"
fi

# ---------- 4. 启动 ----------
log "启动服务"
cd "$APP_DIR/server"

if pm2 describe leetcode-rank >/dev/null 2>&1; then
  pm2 reload leetcode-rank --update-env >/dev/null
  ok "已重载进程"
else
  pm2 start ecosystem.config.js >/dev/null
  ok "已启动进程"
fi
pm2 save >/dev/null

# ---------- 5. 健康检查 ----------
PORT="$(grep -E '^PORT=' "$ENV_FILE" | cut -d= -f2)"
PORT="${PORT:-3000}"
log "健康检查 http://127.0.0.1:$PORT/api/health"

HEALTH=""
for _ in $(seq 1 15); do
  if HEALTH="$(curl -fsS "http://127.0.0.1:$PORT/api/health" 2>/dev/null)"; then break; fi
  sleep 1
done

if [ -z "$HEALTH" ]; then
  warn "健康检查失败，最近日志："
  pm2 logs leetcode-rank --lines 20 --nostream || true
  die "启动失败"
fi

ok "服务正常：$HEALTH"

MODE="$(echo "$HEALTH" | sed -n 's/.*"mode":"\([^"]*\)".*/\1/p')"
[ "$MODE" = "prod" ] || warn "当前是 $MODE 模式，检查 .env 是否残留 DEV_MODE"

# ---------- 6. 收尾提示 ----------
cat <<EOF

────────────────────────────────────────
 部署完成
────────────────────────────────────────
 目录      $APP_DIR
 进程      pm2 status / pm2 logs leetcode-rank
 配置      $APP_DIR/server/.env
 数据      $APP_DIR/server/data/
 更新      cd $APP_DIR && git pull && pm2 restart leetcode-rank

 还差两步（有域名之后）：
   1. Nginx 反代 + HTTPS   见 server/DEPLOY.md 第 5 节
   2. 小程序后台配置 request 合法域名，并改 config/app.config.json 的 apiBase

 开机自启（只需执行一次）：
   pm2 startup    # 复制它输出的那行命令执行
────────────────────────────────────────
EOF
