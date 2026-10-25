// 业务常量放在这里；环境相关的值（API 地址）由 scripts/setup.mjs 生成到 config.local.ts
import { API_BASE } from './config.local'

export { API_BASE }

export const TOKEN_KEY = 'auth_token'
export const USER_KEY = 'auth_user_v2'
export const LAST_ERROR_KEY = 'last_login_error'
