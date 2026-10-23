App<IAppOption>({
  globalData: {
    openid: '',
    user: null,
  },

  onLaunch() {
    // 登录态由 utils/api 的 ensureLogin() 按需触发，这里不做阻塞式登录
  },
})
