# 服务端部署

目标：一台 Linux 服务器 + 一个已备案域名，跑起 `node index.js`。

## 0. 准备

- 服务器：1 核 1G 足够（50 人规模）
- 域名：已备案，解析到服务器 IP
- 证书：Let's Encrypt（免费）

## 1. 放代码

```bash
# 本机打包（排除数据和依赖）
tar czf server.tgz --exclude data --exclude node_modules -C /path/to/codeproject server

scp server.tgz root@your-server:/opt/
ssh root@your-server
mkdir -p /opt/leetcode-rank && tar xzf /opt/server.tgz -C /opt/leetcode-rank
cd /opt/leetcode-rank/server
```

## 2. 装 Node 与依赖

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm i -g pm2
npm install --omit=dev      # 当前零第三方依赖，这步可跳过
```

## 3. 写配置

```bash
cp .env.example .env
vi .env
```

必填：

| 变量 | 说明 |
| --- | --- |
| `APPID` / `APPSECRET` | 小程序后台「开发管理 → 开发设置」 |
| `AUTH_SECRET` | 随机长字符串，`openssl rand -hex 32` |
| `ADMIN_TOKEN` | 手动同步口令 |
| `INVITE_CODES` | 邀请码，逗号分隔 |
| `PUBLIC_BASE` | `https://your-domain.com`（头像链接用） |

**不要**在生产环境设 `DEV_MODE=1`，否则任何人绕过微信登录。

## 4. 启动

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup      # 开机自启
pm2 logs leetcode-rank
```

验证：`curl http://127.0.0.1:3000/api/health`

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
3. 重新上传体验版 / 提交审核

## 7. 运维

```bash
pm2 status
pm2 restart leetcode-rank
pm2 logs --lines 100
```

数据与备份：

- 数据在 `server/data/db.json`
- 每天首次写入自动备份到 `server/data/backups/`，保留 7 天
- 手动备份：`cp data/db.json ~/db-$(date +%F).json`

定时同步：进程内每小时第 5 分钟跑一次，也可手动触发：

```bash
curl -X POST http://127.0.0.1:3000/api/sync -H "X-Admin-Token: $ADMIN_TOKEN"
```
