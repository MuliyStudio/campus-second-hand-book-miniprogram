// pages/user-center/user-center.js
Page({
  data: {
    userId: null,
    isOwnProfile: false,
    userInfo: null,
    currentTab: 'books', // books, materials, favorites, posts
    books: [],
    materials: [],
    favorites: [],
    posts: [],
    page: 1,
    pageSize: 10,
    hasMore: true,
    isLoading: false,
    isRefreshing: false
  },

  onLoad: function (options) {
    this.checkLoginStatus();
    const userId = options.id;
    const tab = options.tab || 'books';
    
    this.setData({ 
      userId: userId,
      currentTab: tab
    });
    
    this.checkIsOwnProfile(userId);
    this.loadUserData(userId);
  },

  onShow: function () {
    this.checkLoginStatus();
    if (this.data.userId) {
      this.refreshData();
    }
  },

  // 检查登录状态
  checkLoginStatus: function() {
    const app = getApp();
    if (!app.globalData.isLoggedIn || !app.globalData.userInfo) {
      wx.navigateTo({
        url: '../login/login'
      });
      return false;
    }
    return true;
  },

  onPullDownRefresh: function () {
    this.onRefresh();
  },

  onReachBottom: function () {
    this.loadMoreData();
  },

  onShareAppMessage: function () {
    wx.showToast({
      title: '暂时无法分享',
      icon: 'none',
      duration: 2000
    });
  },

  // 检查是否是自己主页
  checkIsOwnProfile: function(userId) {
    const app = getApp();
    const isOwnProfile = !userId || userId === (app.globalData.userInfo && app.globalData.userInfo._id);
    this.setData({ isOwnProfile });
  },

  // 获取公开的图片URL
  getPublicImageUrl: function(fileId) {
    return new Promise((resolve, reject) => {
      if (!fileId || fileId.startsWith('http')) {
        resolve(fileId);
        return;
      }

      wx.cloud.callFunction({
        name: 'updateFilePermission',
        data: {
          fileID: fileId
        },
        success: (res) => {
          if (res.result.success) {
            resolve(res.result.data.tempFileURL);
          } else {
            console.error('获取公开图片URL失败:', res.result.message);
            resolve(fileId);
          }
        },
        fail: (err) => {
          console.error('调用云函数失败:', err);
          resolve(fileId);
        }
      });
    });
  },

  // 格式化时间
  formatTime: function(timestamp) {
    if (!timestamp) return '';

    // 如果是ISO格式的时间字符串，转换为Date对象
    let date;
    if (typeof timestamp === 'string' && timestamp.includes('T')) {
      date = new Date(timestamp);
    } else if (typeof timestamp === 'object' && timestamp.$date) {
      date = new Date(timestamp.$date);
    } else {
      date = new Date(timestamp);
    }

    // 获取当前时间
    const now = new Date();
    const diff = now - date;

    // 小于1分钟
    if (diff < 60000) {
      return '刚刚';
    }
    // 小于1小时
    else if (diff < 3600000) {
      return Math.floor(diff / 60000) + '分钟前';
    }
    // 小于1天
    else if (diff < 86400000) {
      return Math.floor(diff / 3600000) + '小时前';
    }
    // 小于7天
    else if (diff < 604800000) {
      return Math.floor(diff / 86400000) + '天前';
    }
    // 显示完整日期
    else {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  },

  // 加载用户数据
  loadUserData: function(userId) {
    this.setData({ isLoading: true });

    // 调用云函数获取用户信息和当前标签的数据
    wx.cloud.callFunction({
      name: 'getUserCenterData',
      data: {
        userId: userId, // 传递 userId 参数
        tab: this.data.currentTab,
        page: 1,
        pageSize: this.data.pageSize
      },
      success: (res) => {
        console.log('获取用户中心数据成功:', res);
        if (res.result.success) {
          const data = res.result.data;
          let userInfo = data.userInfo;

          // 处理用户头像URL
          const processAvatar = (info) => {
            if (info && info.avatarUrl) {
              return this.getPublicImageUrl(info.avatarUrl).then(publicUrl => {
                info.avatarUrl = publicUrl;
                return info;
              });
            }
            return Promise.resolve(info);
          };

          // 处理书籍/资料/帖子的封面URL
          const processTabData = (tabType, items) => {
            if (!items || items.length === 0) return Promise.resolve(items);

            const imageKey = tabType === 'posts' ? 'images' : 'coverUrl';

            const processItem = (item) => {
              // 收藏数据格式化时间
              if (tabType === 'favorites' && item.createTime) {
                item.formattedTime = this.formatTime(item.createTime);
              }

              if (tabType === 'posts' && item.images && item.images.length > 0) {
                return this.getPublicImageUrl(item.images[0]).then(publicUrl => {
                  item.coverImage = publicUrl; // 添加 coverImage 字段用于显示
                  return item;
                });
              } else if (item[imageKey]) {
                return this.getPublicImageUrl(item[imageKey]).then(publicUrl => {
                  item[imageKey] = publicUrl;
                  return item;
                });
              }
              return Promise.resolve(item);
            };

            const promises = items.map(item => processItem(item));
            return Promise.all(promises);
          };

          processAvatar(userInfo).then(processedUserInfo => {
            // 根据标签获取对应数据
            let tabData = [];
            switch(this.data.currentTab) {
              case 'books':
                tabData = data.books;
                break;
              case 'materials':
                tabData = data.materials;
                break;
              case 'posts':
                tabData = data.posts;
                break;
              case 'favorites':
                tabData = data.favorites;
                break;
            }

            // 处理标签数据的图片URL
            return processTabData(this.data.currentTab, tabData).then(processedTabData => {
              const dataKey = this.getDataKey(this.data.currentTab);

              this.setData({
                userInfo: processedUserInfo,
                [dataKey]: processedTabData,
                page: 1,
                hasMore: data.hasMore,
                isLoading: false
              });
            });
          }).catch(err => {
            console.error('处理URL失败:', err);
            // 即使处理失败也继续显示数据
            let tabData = [];
            switch(this.data.currentTab) {
              case 'books':
                tabData = data.books;
                break;
              case 'materials':
                tabData = data.materials;
                break;
              case 'posts':
                tabData = data.posts;
                break;
              case 'favorites':
                tabData = data.favorites;
                break;
            }

            const dataKey = this.getDataKey(this.data.currentTab);

            this.setData({
              userInfo: userInfo,
              [dataKey]: tabData,
              page: 1,
              hasMore: data.hasMore,
              isLoading: false
            });
          });
        } else {
          console.error('获取用户信息失败:', res.result.message);
          this.setData({ isLoading: false });
          wx.showToast({
            title: res.result.message || '获取用户信息失败',
            icon: 'none',
            duration: 2000
          });
        }
      },
      fail: (err) => {
        console.error('调用云函数失败:', err);
        this.setData({ isLoading: false });
        wx.showToast({
          title: '网络错误，请重试',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },

  // 刷新数据
  onRefresh: function() {
    this.setData({ isRefreshing: true });
    
    // 清空数据
    this.setData({
      page: 1,
      books: [],
      materials: [],
      favorites: [],
      posts: [],
      hasMore: true
    });
    
    // 重新加载用户数据和当前标签数据
    this.loadUserData(this.data.userId);
    
    this.setData({ isRefreshing: false });
    wx.stopPullDownRefresh();
    wx.showToast({
      title: '刷新成功',
      icon: 'success',
      duration: 1000
    });
  },

  // 加载更多
  loadMoreData: function() {
    if (!this.data.hasMore || this.data.isLoading) return;
    this.loadTabData(this.data.currentTab, this.data.page + 1);
  },

  // 切换标签
  switchTab: function(e) {
    const tab = e.currentTarget.dataset.tab;
    if (this.data.currentTab === tab) return;
    
    this.setData({
      currentTab: tab,
      page: 1,
      hasMore: true
    });
    
    // 清空当前数据
    const dataKey = this.getDataKey(tab);
    this.setData({ [dataKey]: [] });
    
    this.loadTabData(tab, 1);
  },

  // 加载标签数据
  loadTabData: function(tab, page) {
    if (this.data.isLoading) return;

    this.setData({ isLoading: true });

    console.log('开始加载标签数据:', { tab, page, userId: this.data.userId });

    // 调用云函数获取标签数据
    wx.cloud.callFunction({
      name: 'getUserCenterData',
      data: {
        userId: this.data.userId, // 传递 userId 参数
        tab: tab,
        page: page,
        pageSize: this.data.pageSize
      },
      success: (res) => {
        console.log('获取标签数据成功:', res);
        if (res.result.success) {
          const data = res.result.data;
          let newData = [];

          // 处理书籍/资料/帖子的封面URL
          const processTabData = (tabType, items) => {
            if (!items || items.length === 0) return Promise.resolve(items);

            const imageKey = tabType === 'posts' ? 'images' : 'coverUrl';

            const processItem = (item) => {
              // 收藏数据格式化时间
              if (tabType === 'favorites' && item.createTime) {
                item.formattedTime = this.formatTime(item.createTime);
              }

              if (tabType === 'posts' && item.images && item.images.length > 0) {
                return this.getPublicImageUrl(item.images[0]).then(publicUrl => {
                  item.coverImage = publicUrl;
                  return item;
                });
              } else if (item[imageKey]) {
                return this.getPublicImageUrl(item[imageKey]).then(publicUrl => {
                  item[imageKey] = publicUrl;
                  return item;
                });
              }
              return Promise.resolve(item);
            };

            const promises = items.map(item => processItem(item));
            return Promise.all(promises);
          };

          // 根据标签获取对应数据
          switch(tab) {
            case 'books':
              newData = data.books;
              break;
            case 'materials':
              newData = data.materials;
              break;
            case 'posts':
              newData = data.posts;
              break;
            case 'favorites':
              newData = data.favorites;
              break;
          }

          // 处理标签数据的图片URL
          processTabData(tab, newData).then(processedNewData => {
            const dataKey = this.getDataKey(tab);
            const currentData = this.data[dataKey] || [];
            const updatedData = page === 1 ? processedNewData : [...currentData, ...processedNewData];

            console.log('更新数据:', { dataKey, currentLength: currentData.length, newLength: processedNewData.length, updatedLength: updatedData.length });

            this.setData({
              [dataKey]: updatedData,
              page: page,
              hasMore: data.hasMore,
              isLoading: false
            });
          }).catch(err => {
            console.error('处理图片URL失败:', err);
            // 即使处理失败也继续显示数据
            const dataKey = this.getDataKey(tab);
            const currentData = this.data[dataKey] || [];
            const updatedData = page === 1 ? newData : [...currentData, ...newData];

            console.log('更新数据:', { dataKey, currentLength: currentData.length, newLength: newData.length, updatedLength: updatedData.length });

            this.setData({
              [dataKey]: updatedData,
              page: page,
              hasMore: data.hasMore,
              isLoading: false
            });
          });
        } else {
          console.error('获取标签数据失败:', res.result.message);
          this.setData({ isLoading: false });
          wx.showToast({
            title: res.result.message || '获取数据失败',
            icon: 'none',
            duration: 2000
          });
        }
      },
      fail: (err) => {
        console.error('调用云函数失败:', err);
        this.setData({ isLoading: false });
        wx.showToast({
          title: '网络错误，请重试',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },

  // 获取数据键名
  getDataKey: function(tab) {
    const map = {
      'books': 'books',
      'materials': 'materials',
      'favorites': 'favorites',
      'posts': 'posts'
    };
    return map[tab] || 'books';
  },

  // 关注用户
  followUser: function() {
    const app = getApp();
    if (!app.globalData.isLoggedIn) {
      wx.showModal({
        title: '提示',
        content: '登录后可以关注用户',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({
              url: '../login/login'
            });
          }
        }
      });
      return;
    }
    
    const userInfo = this.data.userInfo;
    userInfo.isFollowing = !userInfo.isFollowing;
    userInfo.followersCount = userInfo.isFollowing ? 
      userInfo.followersCount + 1 : Math.max(0, userInfo.followersCount - 1);
    
    this.setData({ userInfo });
    
    wx.vibrateShort({ type: 'light' });
    wx.showToast({
      title: userInfo.isFollowing ? '关注成功' : '已取消关注',
      icon: 'success',
      duration: 1000
    });
  },

  // 发送消息
  sendMessage: function() {
    const app = getApp();
    if (!app.globalData.isLoggedIn) {
      wx.showModal({
        title: '提示',
        content: '登录后可以发送消息',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({
              url: '../login/login'
            });
          }
        }
      });
      return;
    }
    
    const userInfo = this.data.userInfo;
    if (!userInfo) {
      wx.showToast({
        title: '用户信息加载失败',
        icon: 'error',
        duration: 1500
      });
      return;
    }
    
    // 跳转到聊天页面
    wx.navigateTo({
      url: `/pages/chat/chat?userId=${userInfo._id}&nickname=${encodeURIComponent(userInfo.nickname)}&avatar=${encodeURIComponent(userInfo.avatarUrl || '')}`
    });
  },

  // 查看书籍详情
  goToBookDetail: function(e) {
    const bookId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/book-detail/book-detail?id=${bookId}`
    });
  },

  // 查看资料详情
  goToMaterialDetail: function(e) {
    const materialId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/material-detail/material-detail?id=${materialId}`
    });
  },

  // 查看帖子详情
  goToPostDetail: function(e) {
    const postId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/post-detail/post-detail?id=${postId}`
    });
  },

  // 编辑资料
  goToEditProfile: function() {
    wx.navigateTo({
      url: '/pages/edit-profit/edit-profit'
    });
  },

  // 分享用户主页
  shareProfile: function() {
    wx.showShareMenu({
      withShareTicket: true
    });
    
    wx.showToast({
      title: '已生成分享卡片',
      icon: 'success',
      duration: 1000
    });
  },

  // 刷新数据
  refreshData: function() {
    this.loadUserData(this.data.userId);
  },

  // 返回上一页
  goBack: function() {
    wx.navigateBack();
  }
});