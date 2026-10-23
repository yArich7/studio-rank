import { ensureLogin, updateProfile, uploadAvatar, toastError } from '../../utils/api'

Page({
  data: {
    nickname: '',
    avatarUrl: '',
    uploading: false,
    saving: false,
  },

  async onLoad() {
    try {
      const user = await ensureLogin()
      this.setData({ nickname: user.nickname, avatarUrl: user.avatarUrl })
    } catch (err) {
      toastError(err)
    }
  },

  /** 微信头像选择：用户点头像按钮后回填，需要自己上传到服务器 */
  async onChooseAvatar(e: { detail: { avatarUrl: string } }) {
    const tempPath = e.detail.avatarUrl
    if (!tempPath) return

    this.setData({ uploading: true, avatarUrl: tempPath })
    try {
      const { url } = await uploadAvatar(tempPath)
      this.setData({ avatarUrl: url })
    } catch (err) {
      toastError(err)
    } finally {
      this.setData({ uploading: false })
    }
  },

  onNicknameInput(e: WechatMiniprogram.Input) {
    this.setData({ nickname: e.detail.value })
  },

  async onSave() {
    const nickname = this.data.nickname.trim()
    if (!nickname) {
      wx.showToast({ title: '昵称不能为空', icon: 'none' })
      return
    }
    if (this.data.uploading) {
      wx.showToast({ title: '头像还在上传', icon: 'none' })
      return
    }

    this.setData({ saving: true })
    try {
      await updateProfile({ nickname, avatarUrl: this.data.avatarUrl })
      wx.showToast({ title: '已保存', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 600)
    } catch (err) {
      toastError(err)
    } finally {
      this.setData({ saving: false })
    }
  },
})
