// 力扣公开数据读取（2026-10-23 实测可用）
const https = require('https')

const SITES = { cn: 'leetcode.cn', com: 'leetcode.com' }

const QUERY = `query Profile($userSlug: String!) {
  userProfilePublicProfile(userSlug: $userSlug) {
    username
    siteRanking
    profile { realName userAvatar }
    submissionProgress { acTotal }
  }
  userProfileUserQuestionProgressV2(userSlug: $userSlug) {
    numAcceptedQuestions { difficulty count }
  }
}`

function request(site, path, query, variables, operationName) {
  return new Promise((resolve, reject) => {
    const host = SITES[site]
    if (!host) return reject(new Error('站点不合法'))
    const body = JSON.stringify({ query, variables, operationName })

    const req = https.request({
      host,
      port: 443,
      path,
      method: 'POST',
      timeout: 8000,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        Referer: `https://${host}/`,
        Origin: `https://${host}`,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0 Safari/537.36'
      }
    }, (res) => {
      let raw = ''
      res.on('data', (chunk) => { raw += chunk })
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`力扣返回 HTTP ${res.statusCode}`))
        let parsed
        try { parsed = JSON.parse(raw) } catch (e) { return reject(new Error('力扣返回格式异常')) }
        if (parsed.errors && parsed.errors.length) {
          return reject(new Error(parsed.errors[0].message || '力扣查询失败'))
        }
        resolve(parsed.data)
      })
    })

    req.on('timeout', () => req.destroy(new Error('请求力扣超时')))
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

function pickDifficulty(list, name) {
  const hit = (list || []).find((item) => item.difficulty === name)
  return hit ? hit.count : 0
}

async function fetchProfile(site, slug) {
  const data = await request(site, '/graphql/', QUERY, { userSlug: slug }, 'Profile')
  const user = data && data.userProfilePublicProfile
  if (!user) throw new Error('未找到该用户')

  const accepted = (data.userProfileUserQuestionProgressV2 || {}).numAcceptedQuestions || []
  const easy = pickDifficulty(accepted, 'EASY')
  const medium = pickDifficulty(accepted, 'MEDIUM')
  const hard = pickDifficulty(accepted, 'HARD')
  const acTotal = (user.submissionProgress && user.submissionProgress.acTotal) || easy + medium + hard

  return {
    totalAc: acTotal,
    easy,
    medium,
    hard,
    avatarUrl: (user.profile && user.profile.userAvatar) || '',
    realName: (user.profile && user.profile.realName) || '',
    ranking: user.siteRanking || 0
  }
}

const RECENT_QUERY = `query recentAcSubmissions($userSlug: String!) {
  recentACSubmissions(userSlug: $userSlug) {
    submissionId
    submitTime
    question { titleSlug questionFrontendId }
  }
}`

/**
 * 最近通过的题目（含提交时间），用于回填历史每日数据。
 * 注意：这个查询只在 /graphql/noj-go/ 上存在，默认端点会报 Cannot query field。
 */
async function fetchRecentAC(site, slug) {
  if (site !== 'cn') return []
  const data = await request(site, '/graphql/noj-go/', RECENT_QUERY, { userSlug: slug }, 'recentAcSubmissions')
  const rows = (data && data.recentACSubmissions) || []
  return rows.map((row) => ({
    submissionId: String(row.submissionId || ''),
    submitTime: Number(row.submitTime || 0),
    slug: row.question ? row.question.titleSlug : ''
  }))
}

module.exports = { fetchProfile, fetchRecentAC, SITES }
