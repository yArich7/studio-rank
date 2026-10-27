import { CLOUD_ENV } from './config'

App<IAppOption>({
  globalData: {
    openid: '',
    user: null,
  },

  onLaunch() {
    if (!wx.cloud) {
      console.error('基础库版本过低，请使用 2.2.3 及以上版本')
      return
    }
    wx.cloud.init({
      env: CLOUD_ENV,
      traceUser: true,
    })
  },
})
