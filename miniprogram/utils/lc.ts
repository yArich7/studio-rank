export type LcSite = 'cn' | 'com'

export interface LcTarget {
  site: LcSite
  slug: string
}

const LINK_RE = /^(?:https?:\/\/)?(?:www\.)?(leetcode\.cn|leetcode\.com)\/(?:u\/)?([A-Za-z0-9_-]{2,40})$/i
const SLUG_RE = /^[A-Za-z0-9_-]{2,40}$/

/**
 * 解析用户粘贴的 LeetCode 主页链接，只取站点与 slug。
 * 服务端会再次校验，前端解析只是为了让用户立刻看到结果。
 */
export function parseProfileLink(raw: string, fallbackSite: LcSite = 'cn'): LcTarget | null {
  const input = (raw || '').trim()
  if (!input) return null

  const cleaned = input.split('?')[0].split('#')[0].replace(/\/+$/, '').trim()
  const matched = LINK_RE.exec(cleaned)
  if (matched) {
    return {
      site: matched[1].toLowerCase() === 'leetcode.com' ? 'com' : 'cn',
      slug: matched[2],
    }
  }

  if (SLUG_RE.test(cleaned)) {
    return { site: fallbackSite, slug: cleaned }
  }
  return null
}

export function profileUrl(target: LcTarget): string {
  const host = target.site === 'com' ? 'leetcode.com' : 'leetcode.cn'
  return `https://${host}/u/${target.slug}/`
}
