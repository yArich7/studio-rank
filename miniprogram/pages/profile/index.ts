import { ensureLogin, updateProfile, uploadAvatar, toastError } from '../../utils/api'
import { resolveAvatar } from '../../utils/avatar'

Page({
  data: {
    nickname: '',
    avatarUrl: '',      // 显示用（完整地址）
    avatarPath: '',     // 存储用（相对路径）
    uploading: false,
    saving: false,
  },

  async onLoad() {
    try {
      const user = await ensureLogin()
      this.setData({
        nickname: user.nickname,
        // avatarPath 是相对路径（保存用），avatarUrl 可能已是内联 data URI（显示用）
        avatarPath: user.avatarPath || user.avatarUrl,
        avatarUrl: resolveAvatar(user.avatarUrl, 'me'),
      })
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
      this.setData({ avatarPath: url, avatarUrl: resolveAvatar(url, 'me') })
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
      await updateProfile({ nickname, avatarUrl: this.data.avatarPath })
      wx.showToast({ title: '已保存', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 600)
    } catch (err) {
      toastError(err)
    } finally {
      this.setData({ saving: false })
    }
  },
})
