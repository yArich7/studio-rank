# 班级 LeetCode 刷题榜（微信小程序 + 自建后端）

单班级（≤ 50 人）的刷题统计与排行榜。用户粘贴力扣主页链接绑定，服务端每小时抓一次公开数据。

## 架构

```
微信小程序（原生 + TS）
      │  HTTPS（已备案域名）
自建 Node 服务（零依赖）
      │
   data/db.json  ←── 每小时定时抓取力扣公开主页
```

- 不依赖数据库、缓存、消息队列——50 人用不上。
- 不依赖云开发，跑在你自己的服务器上。

## 目录

```
miniprogram/           小程序
├── config.ts          API 地址（本地 / 上线要改）
├── config.ts          业务常量（API 地址从 config.local 读）
├── config.local.ts    本机生成，不进版本库
├── pages/login        登录页（仅静默失败时兜底）
├── pages/rank         榜单（日/周/月/总）
├── pages/stats        我的数据
├── pages/mine         我的
├── pages/bind         粘贴主页链接绑定
├── pages/invite       邀请码入口
├── pages/profile      头像 / 昵称（chooseAvatar + type="nickname"）
└── utils/
    ├── lc.ts          链接解析（站点 + slug）
    └── api.ts         请求封装 + 登录态
server/                后端（零第三方依赖）
├── index.js           入口：HTTP 服务 / 静态头像 / 优雅退出
├── config.js          配置（环境变量 + .env）
├── routes.js          全部接口
├── sync.js            每小时同步 + 定时调度
├── auth.js            openid 签名 & code2Session
├── store.js           JSON 原子写入 + 每日备份
├── leetcode.js        力扣 GraphQL 读取（实测可用）
├── multipart.js       头像上传解析
├── logger.js          结构化日志
├── ecosystem.config.js pm2 进程守护
├── .env.example       配置模板
├── DEPLOY.md          部署步骤
└── data/              db.json / uploads / backups（自动生成）
config/
├── app.config.example.json   配置模板（提交）
└── app.config.json           本机配置（不提交）
scripts/
├── setup.mjs          读配置生成本机文件
└── e2e*.js            模拟器自动化测试
typings/               全局类型
```

## 首次配置

仓库里**不含 AppID 和 API 地址**，克隆后需要生成一次：

```bash
cp config/app.config.example.json config/app.config.json
# 编辑 config/app.config.json，填写 appid 与 apiBase
node scripts/setup.mjs
```

`app.config.json` 只有两个字段：

| 字段 | 说明 |
| --- | --- |
| `appid` | 小程序 AppID（mp 后台 → 开发管理 → 开发设置） |
| `apiBase` | 后端地址：模拟器填 `http://localhost:3000`，真机填电脑内网 IP，线上填 `https://域名` |

脚本会生成两个**不进版本库**的文件：

- `project.config.json` —— 开发者工具的项目配置（含 AppID）
- `miniprogram/config.local.ts` —— 小程序编译进包的 API 地址

换了网络或部署到线上，只要改 `app.config.json` 重新跑一次，不用动代码。

## 本地跑起来

```bash
# 1. 起后端（开发模式：跳过微信校验、登录固定身份）
cd server && npm run dev          # http://localhost:3000

# 需要自定义配置时：
cp server/.env.example server/.env   # 填 APPID / INVITE_CODES 等

# 2. 小程序配置
# miniprogram/config.ts 里的 API_BASE：
#   模拟器        → http://localhost:3000
#   真机调试      → http://<电脑内网IP>:3000   （手机上的 localhost 是手机自己）
#                   查 IP：ipconfig getifaddr en0
# 开发者工具：详情 → 本地设置 → 勾选「不校验合法域名、web-view、TLS 版本以及 HTTPS 证书」
# 真机调试还需：手机和电脑在同一 Wi-Fi / 热点

# 3. 打开项目，编译预览
```

验证后端：

```bash
curl http://localhost:3000/api/health
curl -X POST http://localhost:3000/api/login -H 'Content-Type: application/json' -d '{"code":"dev:alice"}'
```

自动化测试（需要开发者工具已开启自动化端口 9420）：

```bash
node scripts/e2e.js
```

## 登录与准入

```
打开小程序 → 云函数 login（自动带上 OPENID）
              ├─ 老用户 → 直接返回资料
              └─ 新用户 → 自动建档，先看榜单

绑定力扣 → 校验邀请码 → 绑定成功才消耗一次
退出登录 → 删除绑定与每日记录，清空 invitedAt
```

- 云函数里 `cloud.getWXContext().OPENID` 直接给出身份，**不需要 `wx.login`、不需要 AppSecret、不签发 token**
- 邀请码只在**绑定力扣**时校验；没绑定的人能浏览榜单，但不会出现在榜单上（榜单只含已绑定成员）
- 退出后想再绑定，需要重新输入邀请码

## 云函数接口

统一入口 `wx.cloud.callFunction({ name: 'api', data: { action, ... } })`，返回 `{ ok, data }` 或 `{ ok: false, error, code }`。

| action | 参数 | 说明 |
| --- | --- | --- |
| `login` | — | 建档并返回用户资料 |
| `bind` | `{site, slug, invite?, dryRun}` | 校验/写入力扣绑定，首次需要邀请码 |
| `profile` | `{nickname?, avatarUrl?}` | 更新昵称与头像 |
| `rank` | `{period}` | `day` / `week` / `month` / `total` |
| `stats` | — | 今日/本周/本月/总计 + 难度数量 |
| `logout` | — | 删除绑定与每日记录 |
| `setup` | — | 手动建集合（一般不需要，首次调用会自动建） |

定时同步是独立的 `sync` 云函数，由触发器每小时第 5 分钟调用。

## 后端方案

默认用**微信云开发**（云函数 + 云数据库），不需要买服务器、不需要备案域名。

```
小程序 ──wx.cloud.callFunction──▶ 云函数 api ──▶ 云数据库
                                    ▲
                        云函数 sync（每小时定时触发）
```

### 部署（三条命令）

```bash
# 1. 生成配置（填 appid 与云环境 ID）
node scripts/setup.mjs

# 2. 部署云函数
/Applications/wechatwebdevtools.app/Contents/MacOS/cli cloud functions deploy \
  --env <你的环境ID> --names api sync --remote-npm-install \
  --project . --port 18344
```

`--remote-npm-install` 不能省，否则云端找不到 `wx-server-sdk`。

### 部署后在控制台做两件事

1. **云函数 → sync → 配置**：超时改成 **60 秒**（默认 3 秒，50 人同步会超时）
2. **云函数 → sync → 触发器**：确认有每小时触发（`0 5 * * * * *`）

### 数据库集合

首次调用云函数会自动创建：

| 集合 | 内容 |
| --- | --- |
| `users` | 用户资料（昵称、头像） |
| `lc_accounts` | 力扣绑定与累计数据 |
| `accounts` | — |
| `daily_stats` | 每日新增 |
| `sync_logs` | 同步日志 |
| `invites` | 邀请码与使用次数 |

### 邀请码管理

云开发控制台 → 数据库 → `invites`：

```json
{ "code": "STUDIO2026", "used": 0, "limit": 50 }
```

改 `limit` 调上限，加一条记录就是新邀请码，删掉即失效。

## 自建服务器（备选）

`server/` 目录是完整的自托管版本（零依赖 Node，JSON 文件存储），适合有公网服务器的场景。步骤见 [server/DEPLOY.md](server/DEPLOY.md)，一键脚本：

```bash
scp scripts/deploy.sh root@your-server:/root/
ssh root@your-server 'bash /root/deploy.sh'
```

两种方案的接口逻辑一致，`server/` 不需要时可以整个删掉。
