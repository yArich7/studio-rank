/// <reference path="../node_modules/miniprogram-api-typings/index.d.ts" />

interface IAppOption {
  globalData: {
    openid: string
    user: IUser | null
  }
}

interface IUser {
  openid: string
  nickname: string
  avatarUrl: string
  createdAt?: string
  lastSeenAt?: string
}

interface LcPreview {
  slug: string
  site: string
  avatarUrl: string
  realName: string
  totalAc: number
  easy: number
  medium: number
  hard: number
  ranking: number
}

interface RankRow {
  rank: number
  openid: string
  nickname: string
  avatarUrl: string
  score: number
  totalAc: number
}

interface RankResult {
  period: string
  startDate: string
  statsSince?: string | null
  list: RankRow[]
  myRank: { rank: number; score: number; totalAc: number } | null
  memberCount: number
  updatedAt: string
}

interface StatsResult {
  period: string
  today: number
  week: number
  month: number
  total: number
  byDifficulty: { easy: number; medium: number; hard: number }
  updatedAt: string
}
