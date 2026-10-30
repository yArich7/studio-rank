// 业务常量；云环境 ID 由 scripts/setup.mjs 生成到 config.local.ts
import { CLOUD_ENV } from './config.local'

export { CLOUD_ENV }

export const USER_KEY = 'auth_user_v3'
export const LAST_ERROR_KEY = 'last_login_error'

// 构建标记，用于确认手机上跑的是不是最新代码
export const BUILD = '10-30 17:44'
