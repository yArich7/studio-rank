import { callApi, toastError, ensureLogin } from '../../utils/api'
import { parseProfileLink } from '../../utils/lc'

Page({
  data: {
    link: '',
    slug: '',
    site: 'cn' as string,
    preview: null as LcPreview | null,
    invite: '',
    needInvite: false,
    checking: false,
    saving: false,
    error: '',
  },

  async onShow() {
    try {
      const user = await ensureLogin()
      this.setData({ needInvite: !user.invitedAt })
    } catch (err) {
      // 静默失败，绑定时还会再校验一次
    }
  },

  onInviteInput(e: WechatMiniprogram.Input) {
    this.setData({ invite: e.detail.value, error: '' })
  },

  onInput(e: WechatMiniprogram.Input) {
    this.setData({ link: e.detail.value, error: '', preview: null })
  },

  onPasteTip() {
    wx.showModal({
      title: '怎么拿到主页链接',
      content: '打开力扣 App 或网页 → 我的 → 分享主页 → 复制链接，形如 https://leetcode.cn/u/your-name/',
      showCancel: false,
    })
  },

  async onCheck() {
    const target = parseProfileLink(this.data.link)
    if (!target) {
      this.setData({ error: '请粘贴力扣主页链接，如 https://leetcode.cn/u/your-name/' })
      return
    }

    this.setData({ checking: true, error: '', preview: null })
    try {
      await ensureLogin()
      const preview = await callApi<LcPreview>('bind', {
        site: target.site,
        slug: target.slug,
        invite: this.data.invite.trim(),
        dryRun: true,
      })
      this.setData({ preview, slug: target.slug, site: target.site, checking: false })
    } catch (err) {
      this.setData({
        checking: false,
        error: err instanceof Error ? err.message : '校验失败',
      })
    }
  },

  async onConfirm() {
    if (!this.data.preview) return
    this.setData({ saving: true })
    try {
      await callApi('bind', {
        site: this.data.site,
        slug: this.data.slug,
        invite: this.data.invite.trim(),
        dryRun: false,
      })
      wx.showToast({ title: '绑定成功', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 800)
    } catch (err) {
      toastError(err)
    } finally {
      this.setData({ saving: false })
    }
  },
})
