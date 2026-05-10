Page({
  data: {
    // Tab 配置
    tabs: [
      { id: 'myPosts', name: '我的' },
      { id: 'likedPosts', name: '赞过' },
      { id: 'favoritedPosts', name: '收藏' }
    ],
    activeTab: 'myPosts',
    
    // 数据
    posts: [],
    filteredPosts: [],
    isLoading: false,
    isRefreshing: false,
    hasMore: true,
    page: 1,
    pageSize: 10,
    total: 0,
    filterType: 'all',
    showDeleteConfirm: false,
    postToDelete: null,
    scrollTop: 0,
    stats: {
      total: 0,
      helpCount: 0,
      shareCount: 0
    },
    sharedPostId: null
  },

  onLoad: function (options) {
    this.checkLoginStatus();
    this.loadPosts();
  },

  onShow: function () {
    this.checkLoginStatus();
    this.refreshData();
  },

  // 切换 Tab
  switchTab: function(e) {
    const tabId = e.currentTarget.dataset.id;
    if (tabId === this.data.activeTab) return;
    
    this.setData({
      activeTab: tabId,
      page: 1,
      hasMore: true,
      isRefreshing: false
    });
    
    this.loadPosts();
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
    this.loadMorePosts();
  },

  // 监听滚动事件
  onScroll: function (e) {
    this.setData({
      scrollTop: e.detail.scrollTop
    });
  },

  // 格式化时间显示
  formatTime: function (timeString) {
    if (!timeString) return '';
    const date = new Date(timeString);
    const now = new Date();
    const diff = now - date;
    const oneDay = 24 * 60 * 60 * 1000;
    
    if (diff < 60 * 1000) {
      return '刚刚';
    } else if (diff < 60 * 60 * 1000) {
      return Math.floor(diff / (60 * 1000)) + '分钟前';
    } else if (diff < oneDay) {
      return Math.floor(diff / (60 * 60 * 1000)) + '小时前';
    } else if (diff < 7 * oneDay) {
      return Math.floor(diff / oneDay) + '天前';
    } else {
      return date.toLocaleDateString();
    }
  },

  // 获取所有帖子数据
  getAllPosts: function (callback) {
    wx.cloud.callFunction({
      name: 'getMyPosts',
      data: {
        page: this.data.page,
        pageSize: this.data.pageSize,
        type: this.data.filterType
      },
      success: (res) => {
        if (res.result.success) {
          callback(null, res.result.data);
        } else {
          callback(res.result.message || '获取帖子失败');
        }
      },
      fail: (error) => {
        console.error('调用云函数失败:', error);
        callback('网络错误，请重试');
      }
    });
  },

  // 更新统计信息
  updateStats: function (posts) {
    const total = posts.length;
    const helpCount = posts.filter(post => post.type === 'help').length;
    const shareCount = posts.filter(post => post.type === 'share').length;
    const totalLikes = posts.reduce((sum, post) => sum + (post.likeCount || 0), 0);
    const totalComments = posts.reduce((sum, post) => sum + (post.commentCount || 0), 0);
    const totalViews = posts.reduce((sum, post) => sum + (post.viewCount || 0), 0);
    
    this.setData({
      stats: {
        total,
        helpCount,
        shareCount,
        totalLikes,
        totalComments,
        totalViews
      }
    });
  },

  // 加载帖子数据
  loadPosts: function (showLoading = true) {
    if (showLoading) {
      this.setData({ isLoading: true });
    }

    const { activeTab } = this.data;
    console.log('=== 开始加载帖子数据 ===');
    console.log('当前Tab:', activeTab);
    
    if (activeTab === 'myPosts') {
      // 获取我的帖子
      this.getAllPosts((error, data) => {
        if (error) {
          wx.showToast({
            title: error,
            icon: 'none',
            duration: 1500
          });
          this.setData({ isLoading: false });
          return;
        }
        
        const pageData = data.posts;
        console.log('=== 我的帖子数据 ===');
        console.log('帖子列表:', pageData);
        if (pageData.length > 0) {
          console.log('第一个帖子的authorInfo:', pageData[0].authorInfo);
        }
        
        this.setData({
          posts: pageData,
          filteredPosts: pageData, // 云函数已经处理了筛选
          isLoading: false,
          hasMore: data.hasMore,
          total: data.total
        });
        this.updateStats(pageData);
      });
    } else if (activeTab === 'likedPosts') {
      // 获取赞过的帖子
      this.getLikedPosts((error, data) => {
        if (error) {
          wx.showToast({
            title: error,
            icon: 'none',
            duration: 1500
          });
          this.setData({ isLoading: false });
          return;
        }
        
        const pageData = data.posts;
        console.log('=== 赞过的帖子数据 ===');
        console.log('帖子列表:', pageData);
        if (pageData.length > 0) {
          console.log('第一个帖子的authorInfo:', pageData[0].authorInfo);
        }
        
        this.setData({
          posts: pageData,
          isLoading: false,
          hasMore: data.hasMore,
          total: data.total
        });
      });
    } else if (activeTab === 'favoritedPosts') {
      // 获取收藏的帖子
      this.getFavoritedPosts((error, data) => {
        if (error) {
          wx.showToast({
            title: error,
            icon: 'none',
            duration: 1500
          });
          this.setData({ isLoading: false });
          return;
        }
        
        const pageData = data.posts;
        console.log('=== 收藏的帖子数据 ===');
        console.log('帖子列表:', pageData);
        if (pageData.length > 0) {
          console.log('第一个帖子的authorInfo:', pageData[0].authorInfo);
        }
        
        this.setData({
          posts: pageData,
          isLoading: false,
          hasMore: data.hasMore,
          total: data.total
        });
      });
    }
  },

  // 刷新数据
  onRefresh: function () {
    this.setData({ 
      isRefreshing: true,
      page: 1,
      hasMore: true,
      selectedPosts: [],
      isSelectAll: false
    });

    const { activeTab } = this.data;
    
    if (activeTab === 'myPosts') {
      // 获取我的帖子
      this.getAllPosts((error, data) => {
        if (error) {
          wx.showToast({
            title: error,
            icon: 'none',
            duration: 1500
          });
        } else {
          const pageData = data.posts;
          this.setData({
            posts: pageData,
            filteredPosts: pageData, // 云函数已经处理了筛选
            isRefreshing: false,
            hasMore: data.hasMore,
            total: data.total
          });
          this.updateStats(pageData);
        }
        wx.stopPullDownRefresh();
      });
    } else if (activeTab === 'likedPosts') {
      // 获取赞过的帖子
      this.getLikedPosts((error, data) => {
        if (error) {
          wx.showToast({
            title: error,
            icon: 'none',
            duration: 1500
          });
        } else {
          const pageData = data.posts;
          this.setData({
            posts: pageData,
            isRefreshing: false,
            hasMore: data.hasMore,
            total: data.total
          });
        }
        wx.stopPullDownRefresh();
      });
    } else if (activeTab === 'favoritedPosts') {
      // 获取收藏的帖子
      this.getFavoritedPosts((error, data) => {
        if (error) {
          wx.showToast({
            title: error,
            icon: 'none',
            duration: 1500
          });
        } else {
          const pageData = data.posts;
          this.setData({
            posts: pageData,
            isRefreshing: false,
            hasMore: data.hasMore,
            total: data.total
          });
        }
        wx.stopPullDownRefresh();
      });
    }
  },

  // 刷新数据（简化版）
  refreshData: function () {
    const { activeTab } = this.data;
    
    if (activeTab === 'myPosts') {
      // 获取我的帖子
      this.getAllPosts((error, data) => {
        if (error) {
          console.error('刷新数据失败:', error);
          return;
        }
        
        const pageData = data.posts;
        this.setData({
          posts: pageData,
          filteredPosts: pageData, // 云函数已经处理了筛选
          total: data.total
        });
        this.updateStats(pageData);
      });
    } else if (activeTab === 'likedPosts') {
      // 获取赞过的帖子
      this.getLikedPosts((error, data) => {
        if (error) {
          console.error('刷新数据失败:', error);
          return;
        }
        
        const pageData = data.posts;
        this.setData({
          posts: pageData,
          total: data.total
        });
      });
    } else if (activeTab === 'favoritedPosts') {
      // 获取收藏的帖子
      this.getFavoritedPosts((error, data) => {
        if (error) {
          console.error('刷新数据失败:', error);
          return;
        }
        
        const pageData = data.posts;
        this.setData({
          posts: pageData,
          total: data.total
        });
      });
    }
  },

  // 加载更多帖子
  loadMorePosts: function () {
    if (this.data.isLoading || !this.data.hasMore) return;

    const currentPage = this.data.page;
    this.setData({ 
      isLoading: true,
      page: currentPage + 1
    });

    const { activeTab, posts } = this.data;
    
    if (activeTab === 'myPosts') {
      // 获取更多我的帖子
      this.getAllPosts((error, data) => {
        if (error) {
          wx.showToast({
            title: error,
            icon: 'none',
            duration: 1500
          });
          this.setData({ 
            isLoading: false,
            page: currentPage // 恢复页码
          });
          return;
        }
        
        const pageData = data.posts;
        const newPosts = posts.concat(pageData);
        
        this.setData({
          posts: newPosts,
          filteredPosts: newPosts, // 云函数已经处理了筛选
          isLoading: false,
          hasMore: data.hasMore
        });
        this.updateStats(newPosts);
      });
    } else if (activeTab === 'likedPosts') {
      // 获取更多赞过的帖子
      this.getLikedPosts((error, data) => {
        if (error) {
          wx.showToast({
            title: error,
            icon: 'none',
            duration: 1500
          });
          this.setData({ 
            isLoading: false,
            page: currentPage // 恢复页码
          });
          return;
        }
        
        const pageData = data.posts;
        const newPosts = posts.concat(pageData);
        
        this.setData({
          posts: newPosts,
          isLoading: false,
          hasMore: data.hasMore
        });
      });
    } else if (activeTab === 'favoritedPosts') {
      // 获取更多收藏的帖子
      this.getFavoritedPosts((error, data) => {
        if (error) {
          wx.showToast({
            title: error,
            icon: 'none',
            duration: 1500
          });
          this.setData({ 
            isLoading: false,
            page: currentPage // 恢复页码
          });
          return;
        }
        
        const pageData = data.posts;
        const newPosts = posts.concat(pageData);
        
        this.setData({
          posts: newPosts,
          isLoading: false,
          hasMore: data.hasMore
        });
      });
    }
  },

  // 过滤帖子
  filterPosts: function (posts, type) {
    if (type === 'all') return posts;
    if (type === 'experience') {
      // 经验类型可以包含分享类型的帖子
      return posts.filter(post => post.type === 'share' && post.tags && post.tags.includes('经验'));
    }
    return posts.filter(post => post.type === type);
  },

  // 获取赞过的帖子
  getLikedPosts: function (callback) {
    wx.cloud.callFunction({
      name: 'getMyPostLikes',
      data: {
        page: this.data.page,
        pageSize: this.data.pageSize
      },
      success: (res) => {
        if (res.result.success) {
          callback(null, res.result.data);
        } else {
          callback(res.result.message || '获取赞过的帖子失败');
        }
      },
      fail: (error) => {
        console.error('调用云函数失败:', error);
        callback('网络错误，请重试');
      }
    });
  },

  // 获取收藏的帖子
  getFavoritedPosts: function (callback) {
    wx.cloud.callFunction({
      name: 'getMyPostFavorites',
      data: {
        page: this.data.page,
        pageSize: this.data.pageSize
      },
      success: (res) => {
        if (res.result.success) {
          callback(null, res.result.data);
        } else {
          callback(res.result.message || '获取收藏的帖子失败');
        }
      },
      fail: (error) => {
        console.error('调用云函数失败:', error);
        callback('网络错误，请重试');
      }
    });
  },



  // 切换管理模式


  // 改变筛选条件
  changeFilter: function (e) {
    const filterType = e.currentTarget.dataset.type;
    this.setData({ 
      filterType,
      page: 1,
      isLoading: true
    });

    // 重新获取筛选后的数据
    this.getAllPosts((error, data) => {
      if (error) {
        wx.showToast({
          title: error,
          icon: 'none',
          duration: 1500
        });
        this.setData({ isLoading: false });
        return;
      }
      
      const pageData = data.posts;
      this.setData({
        posts: pageData,
        filteredPosts: pageData,
        isLoading: false,
        hasMore: data.hasMore,
        total: data.total
      });
      this.updateStats(pageData);
    });
  },







  // 去发布新帖子
  goToPublishPost: function () {
    wx.navigateTo({
      url: '/pages/publish-post/publish-post'
    });
  },

  // 头像加载失败处理
  onAvatarError: function(e) {
    const index = e.currentTarget.dataset.index;
    // 使用 authorInfo 字段
    const key = `posts[${index}].authorInfo.avatarUrl`;
    // 设置为默认头像
    this.setData({
      [key]: '/images/default-avatar.png'
    });
  },

  // 跳转到帖子详情
  goToPostDetail: function (e) {
    const postId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/post-detail/post-detail?id=${postId}`
    });
  },

  // 编辑帖子
  editPost: function (e) {
    const postId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/publish-post/publish-post?id=${postId}&edit=true`
    });
  },

  // 删除帖子
  deletePost: function (e) {
    const postId = e.currentTarget.dataset.id;
    
    wx.showModal({
      title: '删除帖子',
      content: '确定要删除这篇帖子吗？删除后不可恢复',
      confirmText: '删除',
      confirmColor: '#f44336',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          this.confirmDeletePost(postId);
        }
      }
    });
  },

  // 确认删除帖子
  confirmDeletePost: function (postId) {
    wx.cloud.callFunction({
      name: 'deletePost',
      data: {
        postId: postId
      },
      success: (res) => {
        if (res.result.success) {
          // 删除成功后刷新数据
          this.onRefresh();
          wx.showToast({
            title: '删除成功',
            icon: 'success',
            duration: 1500
          });
        } else {
          wx.showToast({
            title: res.result.message || '删除失败',
            icon: 'none',
            duration: 1500
          });
        }
      },
      fail: (error) => {
        console.error('调用云函数失败:', error);
        wx.showToast({
          title: '网络错误，请重试',
          icon: 'none',
          duration: 1500
        });
      }
    });
  },

  // 切换帖子公开状态
  togglePostPublic: function (e) {
    const postId = e.currentTarget.dataset.id;
    
    wx.cloud.callFunction({
      name: 'togglePostPublic',
      data: {
        postId: postId
      },
      success: (res) => {
        if (res.result.success) {
          // 更新成功后刷新数据
          this.onRefresh();
          wx.showToast({
            title: '状态已更新',
            icon: 'success',
            duration: 1000
          });
        } else {
          wx.showToast({
            title: res.result.message || '更新失败',
            icon: 'none',
            duration: 1500
          });
        }
      },
      fail: (error) => {
        console.error('调用云函数失败:', error);
        wx.showToast({
          title: '网络错误，请重试',
          icon: 'none',
          duration: 1500
        });
      }
    });
  },

  // 分享帖子
  sharePost: function (e) {
    const postId = e.currentTarget.dataset.id;
    this.setData({ sharedPostId: postId });
    
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    });
    
    wx.showToast({
      title: '请选择分享方式',
      icon: 'none',
      duration: 1500
    });
  },

  // 分享到好友
  onShareAppMessage: function () {
    wx.showToast({
      title: '暂时无法分享',
      icon: 'none',
      duration: 2000
    });
  },

  // 分享到朋友圈
  onShareTimeline: function () {
    wx.showToast({
      title: '暂时无法分享',
      icon: 'none',
      duration: 2000
    });
  },

  // 返回上一页
  goBack: function () {
    wx.navigateBack();
  },

  // 获取统计信息
  getStats: function () {
    return this.data.stats;
  },

  // 显示统计信息
  showStats: function () {
    const stats = this.getStats();
    
    wx.showModal({
      title: '帖子统计',
      content: `总计: ${stats.total}篇\n求助: ${stats.helpCount}篇\n分享: ${stats.shareCount}篇\n获赞: ${stats.totalLikes}次\n评论: ${stats.totalComments}条\n浏览: ${stats.totalViews}次`,
      showCancel: false,
      confirmText: '知道了'
    });
  },

  // 回到顶部
  scrollToTop: function () {
    this.setData({
      scrollTop: 0
    });
  },

  // 阻止事件冒泡
  preventBubble: function () {}
});
