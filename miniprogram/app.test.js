// app.test.js - 简化版应用入口
App({
  globalData: {
    openid: null,
    userInfo: null,
    isLoggedIn: false,
    debugMode: true
  },

  onLaunch: function () {
    console.log('App Launch - 校园资源共享平台启动');
    
    // 初始化云开发
    wx.cloud.init({
      env: 'xiaowen-env-0gdw907s2b9957d2',
      traceUser: true
    });

    // 显示加载提示
    wx.showLoading({ 
      title: '加载中...', 
      mask: true 
    });

    // 执行登录流程
    this.login();
  },

  // 微信登录流程
  login: async function () {
    try {
      // 1. 获取微信登录凭证
      const loginRes = await wx.login();
      if (!loginRes.code) {
        throw new Error('获取登录凭证失败');
      }

      console.log('获取到登录code:', loginRes.code);

      // 2. 调用云函数获取 openid
      const cloudRes = await wx.cloud.callFunction({
        name: 'login',
        data: { code: loginRes.code }
      });

      // 关键：将 openid 保存到 globalData
      this.globalData.openid = cloudRes.result.openid;
      console.log('获取到的openid:', this.globalData.openid);
      
      // 保存到本地存储
      wx.setStorageSync('openid', this.globalData.openid);

      // 检查用户是否已完善信息
      await this.checkUserInfo();
      
    } catch (error) {
      console.error('登录出错:', error);
      wx.hideLoading();
      
      wx.showToast({
        title: '登录失败，请重试',
        icon: 'none',
        duration: 2000
      });
    }
  },

  // 检查用户信息
  checkUserInfo: async function() {
    try {
      const db = wx.cloud.database();
      const userRes = await db.collection('users')
        .where({ _openid: this.globalData.openid })
        .get();

      wx.hideLoading();

      if (userRes.data.length === 0) {
        // 新用户，跳转到完善信息页
        console.log('跳转到完善信息页面');
        
        wx.redirectTo({
          url: '/pages/complete-info/complete-info'
        });
      } else {
        // 老用户，直接进入首页
        console.log('老用户，直接进入首页');
        
        // 保存用户信息
        this.globalData.userInfo = userRes.data[0];
        this.globalData.isLoggedIn = true;
        
        // 保存到本地存储
        wx.setStorageSync('userInfo', userRes.data[0]);
        wx.setStorageSync('isLoggedIn', true);
        
        // 进入首页
        wx.switchTab({
          url: '/pages/index/index'
        });
      }

    } catch (error) {
      console.error('检查用户信息失败:', error);
      wx.hideLoading();
      
      // 出错时进入完善信息页
      wx.redirectTo({
        url: '/pages/complete-info/complete-info'
      });
    }
  },

  // 用户完善信息后调用
  onUserInfoUpdated: function(userInfo) {
    console.log('用户信息已完善');
    
    this.globalData.userInfo = userInfo;
    this.globalData.isLoggedIn = true;
    
    // 保存到本地存储
    wx.setStorageSync('userInfo', userInfo);
    wx.setStorageSync('isLoggedIn', true);
    
    // 进入首页
    wx.switchTab({
      url: '/pages/index/index'
    });
  },

  // 检查登录状态
  checkLogin: function(redirectToLogin) {
    if (!this.globalData.isLoggedIn) {
      if (redirectToLogin) {
        wx.showModal({
          title: '提示',
          content: '请先登录',
          confirmText: '去登录',
          cancelText: '取消',
          success: (res) => {
            if (res.confirm) {
              wx.redirectTo({
                url: '/pages/login/login'
              });
            }
          }
        });
      }
      return false;
    }
    return true;
  }
});