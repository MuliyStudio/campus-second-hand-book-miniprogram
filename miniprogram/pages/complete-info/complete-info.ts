// miniprogram/app.ts
App({
  globalData: {
    openid: '' // ✅ 初始化为空字符串
  },

  onLaunch() {
    wx.cloud.init({ env: 'default', traceUser: true });
    this.checkLoginStatus();
  },

  async checkLoginStatus() {
    try {
      const cloudRes = await wx.cloud.callFunction({ name: 'login' });

      // 类型安全检查
      if (
        !cloudRes.result ||
        typeof cloudRes.result !== 'object' ||
        !('openid' in cloudRes.result)
      ) {
        throw new Error('云函数未返回 openid');
      }

      const openid = cloudRes.result.openid as string;
      if (!openid) {
        throw new Error('openid 为空');
      }

      this.globalData.openid = openid;

      const db = wx.cloud.database();
      const res = await db.collection('users').where({ _openid: openid }).get();

      // 安全检查 data
      if (!res.data || !Array.isArray(res.data)) {
        throw new Error('数据库查询失败');
      }

      if (res.data.length === 0) {
        // 首次使用：因为 pages[0] 是 complete-info，无需跳转
        return;
      }

      // 已完善信息 → 进入首页
      wx.switchTab({ url: '/pages/index/index' });
    } catch (err) {
      console.error('[App] 登录失败:', err);
      wx.showToast({ title: '初始化失败', icon: 'none' });
    }
  }
});