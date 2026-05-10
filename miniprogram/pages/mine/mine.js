// pages/mine/mine.js
Page({
  data: {
    userInfo: null,
    menuItems: [
      {
        id: 'posts',
        title: '我的帖子',
        icon: '💬',
        color: '#667eea',
        description: '查看和管理我的帖子'
      },
      {
        id: 'favorites',
        title: '我的收藏',
        icon: '⭐',
        color: '#667eea',
        description: '查看我的收藏内容'
      },
      {
        id: 'orders',
        title: '我的订单',
        icon: '📦',
        color: '#667eea',
        description: '查看订单详情'
      },
      {
        id: 'downloads',
        title: '我的下载',
        icon: '⬇️',
        color: '#667eea',
        description: '查看下载记录'
      },
      {
        id: 'manage-books',
        title: '发布管理',
        icon: '📚',
        color: '#667eea',
        description: '编辑和删除发布的内容'
      },
      {
        id: 'customer-service',
        title: '在线客服',
        icon: '💬',
        color: '#667eea',
        description: 'AI在线客服'
      }
    ],
    notifications: [],
    isLoading: false
  },

  onLoad: function () {
    this.checkLoginStatus();
  },

  onShow: function () {
    this.checkLoginStatus();
    this.loadUserData();
  },

  onPullDownRefresh: function () {
    this.refreshData();
  },

  // 检查登录状态
  checkLoginStatus: function() {
    const app = getApp();
    if (!app.globalData.isLoggedIn || !app.globalData.userInfo) {
      this.setData({ userInfo: null });
      return false;
    }
    return true;
  },

  // 加载用户数据
  loadUserData: function() {
    if (!this.checkLoginStatus()) {
      this.setData({ 
        userInfo: null,
        notifications: []
      });
      return;
    }
    
    this.setData({ isLoading: true });
    
    const app = getApp();
    let userInfo = app.globalData.userInfo;
    
    // 确保有宿舍苑栋信息
    if (!userInfo.dorm) {
      // 如果用户没有设置宿舍，根据校区设置默认值
      const campus = userInfo.campus || '西校区';
      const defaultDorm = campus === '西校区' ? '南苑' : '1栋';
      
      // 更新全局数据
      userInfo = {
        ...userInfo,
        dorm: defaultDorm
      };
      app.globalData.userInfo = userInfo;
      
      // 保存到本地存储
      wx.setStorageSync('userInfo', userInfo);
    }
    
    // 获取用户统计数据
    Promise.all([
      // 获取帖子数量
      wx.cloud.callFunction({
        name: 'getMyPosts',
        data: { page: 1, pageSize: 1 }
      }),
      // 获取收藏数量
      wx.cloud.callFunction({
        name: 'getMyFavorites',
        data: { type: 'all' }
      })
    ]).then(([postsRes, favoritesRes]) => {
      let postsCount = 0;
      let favoritesCount = 0;
      
      if (postsRes.result.success) {
        postsCount = postsRes.result.data.total;
      }
      
      if (favoritesRes.result.success) {
        favoritesCount = favoritesRes.result.data.favorites.length;
      }
      
      // 计算其他数据数量
      const booksCount = (app.globalData.books || wx.getStorageSync('published_books') || []).length;
      const materialsCount = (app.globalData.uploadedMaterials || []).length;
      const likesCount = (app.globalData.userLikes || []).length;
      
      // 确保用户信息包含所有必要字段，与user-center页面保持一致
      const completeUserInfo = {
        ...userInfo,
        grade: userInfo.grade || 2022,
        bio: userInfo.bio || '这个人很懒，还没有写个人简介~',
        level: userInfo.level || 3,
        creditScore: userInfo.creditScore || 95,
        booksCount: booksCount,
        materialsCount: materialsCount,
        favoritesCount: favoritesCount,
        postsCount: postsCount,
        likesCount: likesCount,
        isVerified: userInfo.isVerified !== undefined ? userInfo.isVerified : true
      };
      
      // 更新全局数据
      app.globalData.userInfo = completeUserInfo;
      
      // 保存到本地存储
      wx.setStorageSync('userInfo', completeUserInfo);
      
      // 设置用户信息
      this.setData({ 
        userInfo: completeUserInfo,
        notifications: [] // 移除模拟通知
      });
      
      this.setData({ isLoading: false });
    }).catch((error) => {
      console.error('获取用户统计数据失败:', error);
      
      // 计算其他数据数量
      const booksCount = (app.globalData.books || wx.getStorageSync('published_books') || []).length;
      const materialsCount = (app.globalData.uploadedMaterials || []).length;
      const favoritesCount = (app.globalData.userFavorites || []).length;
      const postsCount = (app.globalData.uploadedPosts || []).length;
      const likesCount = (app.globalData.userLikes || []).length;
      
      // 确保用户信息包含所有必要字段，与user-center页面保持一致
      const completeUserInfo = {
        ...userInfo,
        grade: userInfo.grade || 2022,
        bio: userInfo.bio || '这个人很懒，还没有写个人简介~',
        level: userInfo.level || 3,
        creditScore: userInfo.creditScore || 95,
        booksCount: booksCount,
        materialsCount: materialsCount,
        favoritesCount: favoritesCount,
        postsCount: postsCount,
        likesCount: likesCount,
        isVerified: userInfo.isVerified !== undefined ? userInfo.isVerified : true
      };
      
      // 更新全局数据
      app.globalData.userInfo = completeUserInfo;
      
      // 保存到本地存储
      wx.setStorageSync('userInfo', completeUserInfo);
      
      // 设置用户信息
      this.setData({ 
        userInfo: completeUserInfo,
        notifications: [] // 移除模拟通知
      });
      
      this.setData({ isLoading: false });
    });
  },

  // 刷新数据
  refreshData: function() {
    this.loadUserData();
    setTimeout(() => {
      wx.stopPullDownRefresh();
      wx.showToast({
        title: '刷新成功',
        icon: 'success',
        duration: 1000
      });
    }, 1000);
  },

  // 跳转到功能页面
  goToPage: function(e) {
    const pageId = e.currentTarget.dataset.id;
    
    const app = getApp();
    if (!app.globalData.isLoggedIn) {
      wx.navigateTo({
        url: '../login/login'
      });
      return;
    }
    
    const pageMap = {
      'posts': '../my-posts/my-posts',
      'favorites': '../favorites/favorites',
      'orders': '../my-orders/my-orders',
      'downloads': '../my-downloads/my-downloads',
      'manage-books': '../upload-management/upload-management',
      'customer-service': '../customer-service/customer-service'
    };
    
    if (pageMap[pageId]) {
      wx.navigateTo({
        url: pageMap[pageId]
      });
    } else {
      wx.showToast({
        title: '功能开发中',
        icon: 'none',
        duration: 1500
      });
    }
  },

  // 查看个人主页 - 只查看发布和上传
  goToProfile: function() {
    if (!this.checkLoginStatus()) {
      wx.navigateTo({
        url: '../login/login'
      });
      return;
    }
    
    wx.navigateTo({
      url: '../user-center/user-center?id=' + this.data.userInfo._id
    });
  },

  // 登录跳转
  goToLogin: function() {
    wx.navigateTo({
      url: '../login/login'
    });
  },

  // 退出登录
  logout: function() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      confirmText: '确定',
      confirmColor: '#f44336',
      success: (res) => {
        if (res.confirm) {
          const app = getApp();
          app.globalData.isLoggedIn = false;
          app.globalData.userInfo = null;
          app.globalData.favorites = [];
          app.globalData.following = [];
          
          // 清空本地存储
          wx.removeStorageSync('userInfo');
          wx.removeStorageSync('isLoggedIn');
          wx.removeStorageSync('openid');
          
          wx.switchTab({
            url: '/pages/index/index'
          });
          
          wx.showToast({
            title: '已退出登录',
            icon: 'success',
            duration: 1500
          });
        }
      }
    });
  },

  // 分享小程序
  onShareAppMessage: function() {
    wx.showToast({
      title: '暂时无法分享',
      icon: 'none',
      duration: 2000
    });
  },


});