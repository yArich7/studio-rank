import { login, ApiError } from '../../utils/api'

Page({
  data: {
    invite: '',
    submitting: false,
    error: '',
  },

  onInput(e: WechatMiniprogram.Input) {
    this.setData({ invite: e.detail.value.trim(), error: '' })
  },

  async onSubmit() {
    const invite = this.data.invite.trim()
    if (!invite) {
      this.setData({ error: '请输入邀请码' })
      return
    }

    this.setData({ submitting: true, error: '' })
    try {
      await login(invite)
      wx.showToast({ title: '欢迎加入', icon: 'success' })
      setTimeout(() => {
        wx.switchTab({ url: '/pages/rank/index' })
      }, 600)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : '邀请码校验失败'
      this.setData({ error: message })
    } finally {
      this.setData({ submitting: false })
    }
  },
})
