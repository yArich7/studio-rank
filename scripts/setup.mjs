#!/usr/bin/env node
// 读取 config/app.config.json，生成本机需要的两个文件：
//   - project.config.json      （微信开发者工具用，含 AppID）
//   - miniprogram/config.local.ts（小程序用，含 API 地址）
//
// 用法：
//   cp config/app.config.example.json config/app.config.json
//   # 填写 appid 与 apiBase
//   node scripts/setup.mjs

import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const configPath = join(root, 'config/app.config.json')
const examplePath = join(root, 'config/app.config.example.json')

if (!existsSync(configPath)) {
  copyFileSync(examplePath, configPath)
  console.log('已创建 config/app.config.json')
  console.log('请填写其中的 appid 与 apiBase，然后重新运行：node scripts/setup.mjs')
  process.exit(1)
}

let config
try {
  config = JSON.parse(readFileSync(configPath, 'utf8'))
} catch (err) {
  console.error('config/app.config.json 不是合法 JSON：', err.message)
  process.exit(1)
}

const { appid, cloudEnv } = config
const problems = []
if (!appid || appid === 'wx0000000000000000') problems.push('appid 未填写')
if (!cloudEnv) problems.push('cloudEnv 未填写')
if (problems.length) {
  console.error('配置有问题：')
  for (const item of problems) console.error('  -', item)
  process.exit(1)
}

// 1) 小程序端云环境 ID
writeFileSync(
  join(root, 'miniprogram/config.local.ts'),
  `// 由 scripts/setup.mjs 生成，不要手改；改配置请编辑 config/app.config.json\n` +
  `export const CLOUD_ENV = '${cloudEnv}'\n`,
  'utf8'
)

// 2) 开发者工具项目配置
const exampleConfig = JSON.parse(readFileSync(join(root, 'project.config.example.json'), 'utf8'))
exampleConfig.appid = appid
writeFileSync(
  join(root, 'project.config.json'),
  JSON.stringify(exampleConfig, null, 2) + '\n',
  'utf8'
)

console.log('✓ miniprogram/config.local.ts  CLOUD_ENV =', cloudEnv)
console.log('✓ project.config.json         appid    =', appid)
