// 后端地址
//
// 模拟器：localhost 可以工作
// 真机调试：手机上的 localhost 指的是手机自己，必须用电脑的内网 IP
//   查 IP：终端执行 `ipconfig getifaddr en0`
//   前提：手机和电脑在同一 Wi-Fi（或同一热点），且开发者工具勾选了
//        「详情 → 本地设置 → 不校验合法域名、web-view、TLS 版本以及 HTTPS 证书」
// 上线：改成 https://你的已备案域名
export const API_BASE = 'http://172.20.10.3:3000'

export const TOKEN_KEY = 'auth_token'
export const USER_KEY = 'auth_user'
export const LAST_ERROR_KEY = 'last_login_error'
