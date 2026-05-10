// pages/database-init/database-init.js
Page({
  data: {
    isInitializing: false,
    initResult: null,
    initError: null
  },

  onLoad: function () {
    this.initPage();
  },

  initPage: function () {
    this.setData({
      isInitializing: false,
      initResult: null,
      initError: null
    });
  },

  // 初始化数据库
  initializeDatabase: function () {
    const that = this;
    
    if (this.data.isInitializing) {
      wx.showToast({
        title: '初始化中，请稍候...',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    this.setData({ isInitializing: true });
    
    wx.cloud.callFunction({
      name: 'initDatabase',
      success: function (res) {
        that.setData({ isInitializing: false });
        
        if (res.result && res.result.success) {
          const result = res.result;
          
          wx.showToast({
            title: '初始化成功',
            icon: 'success',
            duration: 2000
          });
          
          that.setData({
            initResult: result,
            initError: null
          });
          
          console.log('数据库初始化结果:', result);
        } else {
          const errorMessage = res.result && res.result.message ? res.result.message : '初始化失败';
          
          wx.showToast({
            title: errorMessage,
            icon: 'error',
            duration: 2000
          });
          
          that.setData({
            initResult: null,
            initError: errorMessage
          });
        }
      },
      fail: function (error) {
        that.setData({ isInitializing: false });
        
        console.error('调用初始化云函数失败:', error);
        
        wx.showToast({
          title: '调用云函数失败',
          icon: 'error',
          duration: 2000
        });
        
        that.setData({
          initResult: null,
          initError: '调用云函数失败: ' + error.message
        });
      }
    });
  },

  // 重置页面
  resetPage: function () {
    this.initPage();
  }
});