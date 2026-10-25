# 服务端部署（Linux）

目标：一台 Linux 服务器 + 已备案域名，从 GitHub 拉代码跑起来，以后用 `git pull` 更新。

## 0. 准备

| 项 | 说明 |
| --- | --- |
| 服务器 | 1 核 1G 足够（50 人规模） |
| 域名 | 已备案，解析到服务器 IP |
| 证书 | Let's Encrypt，免费 |
| 仓库 | `git@github.com:yArich7/studio-rank.git`（私有） |

## 1. 服务器拉代码（只读部署密钥）

私有仓库需要凭证。推荐在**服务器上**生成一把只读 Deploy Key，加到仓库的 Settings → Deploy keys（不要勾 write）。

```bash
ssh-keygen -t ed25519 -f ~/.ssh/github_deploy -N "" -C "server-deploy"
cat ~/.ssh/github_deploy.pub      # 复制到 GitHub 仓库的 Deploy keys
```

配置别名，避免和别的项目冲突：

```bash
cat >> ~/.ssh/config <<'CONF'
Host github-studio
  HostName github.com
  User git
  IdentityFile ~/.ssh/github_deploy
  IdentitiesOnly yes
CONF
chmod 600 ~/.ssh/config
```

拉代码：

```bash
apt install -y git
git clone git@github-studio:yArich7/studio-rank.git /opt/leetcode-rank
cd /opt/leetcode-rank/server
```

## 2. 装 Node

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node -v      # 需要 >= 18
npm i -g pm2
```

服务端**零第三方依赖**，不需要 `npm install`。

## 3. 写配置

```bash
cp .env.example .env
vi .env
```

必填：

| 变量 | 说明 |
| --- | --- |
| `APPID` / `APPSECRET` | 小程序后台「开发管理 → 开发设置」 |
| `AUTH_SECRET` | `openssl rand -hex 32` 生成，**每台机器独立** |
| `ADMIN_TOKEN` | 手动同步口令 |
| `INVITE_CODES` | 邀请码，逗号分隔 |
| `INVITE_LIMIT` | 使用次数上限，默认 50 |
| `HOST` | 生产填 `127.0.0.1`，只让 Nginx 转发；不填则监听 `0.0.0.0` |

**生产环境不要设 `DEV_MODE=1`**，否则任何人绕过微信登录。
生产环境把 `HOST` 设为 `127.0.0.1`，3000 端口不要对公网开放。
生产环境缺 `APPID` / `AUTH_SECRET` / `INVITE_CODES` 时进程会直接拒绝启动。

## 4. 启动

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup          # 开机自启
pm2 logs leetcode-rank --lines 50
```

验证：

```bash
curl http://127.0.0.1:3000/api/health
# {"ok":true,"data":{"mode":"prod","users":0,...}}
```

## 5. Nginx + HTTPS

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate     /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    client_max_body_size 4m;          # 头像上传

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

```bash
apt install -y nginx certbot python3-certbot-nginx
certbot --nginx -d your-domain.com
```

## 6. 小程序侧

1. mp 后台 → 开发管理 → 服务器域名 → request 合法域名填 `https://your-domain.com`
2. `miniprogram/config.ts` 改 `API_BASE`
3. 开发者工具「上传」→ 后台设为体验版 / 提交审核

## 7. 日常更新

```bash
cd /opt/leetcode-rank
git pull
pm2 restart leetcode-rank
```

数据不受影响：`server/data/` 被 `.gitignore` 排除，`git pull` 不会覆盖。

## 8. 运维

```bash
pm2 status
pm2 logs --lines 100
pm2 restart leetcode-rank
```

数据与备份：

- 数据文件 `server/data/db.json`
- 每天首次写入自动备份到 `server/data/backups/`，保留 7 天
- 手动备份：`cp data/db.json ~/db-$(date +%F).json`

手动触发一次同步：

```bash
curl -X POST http://127.0.0.1:3000/api/sync -H "X-Admin-Token: $ADMIN_TOKEN"
```

## 常见问题

| 现象 | 原因 |
| --- | --- |
| 启动即退出，打印"启动失败，请补齐以下配置" | `.env` 缺必填项 |
| 小程序报"连不上服务" | request 合法域名没配，或没用 HTTPS |
| 登录一直失败 | 生产环境没配 `APPID` / `APPSECRET` |
| 数据不更新 | 进程没跑（`pm2 status`），或力扣接口变了（看日志） |
