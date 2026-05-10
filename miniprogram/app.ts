// miniprogram/app.ts
App({
  onLaunch() {
    wx.cloud.init({ env: 'default', traceUser: true });
    this.checkLoginStatus();
  },

  async checkLoginStatus() {
    try {
      const cloudRes = await wx.cloud.callFunction({
        name: 'login'
      });

      // 类型安全检查
      if (
        typeof cloudRes.result !== 'object' ||
        cloudRes.result === null ||
        !('openid' in cloudRes.result)
      ) {
        throw new Error('云函数返回格式错误');
      }

      const openid = cloudRes.result.openid as string;
      console.log('[App] 获取到 openid:', openid);

      const db = wx.cloud.database();
      const res = await db.collection('users').where({ _openid: openid }).get();

      if (res.data.length > 0) {
        wx.switchTab({ url: '/pages/index/index' });
      } else {
        wx.redirectTo({
          url: `/pages/complete-info/complete-info?openid=${encodeURIComponent(openid)}`
        });
      }
    } catch (err) {
      console.error('[App] 登录失败:', err);
      wx.showToast({ title: '初始化失败', icon: 'none' });
    }
  }
});