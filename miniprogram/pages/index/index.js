// pages/index/index.js
Page({
  data: {
    currentTime: '00:00',
    userInfo: {},
    banners: [
      {
        _id: '1',
        imageUrl: 'https://free.picui.cn/free/2026/04/02/69ce49b673ef4.png',
        link: '/pages/category/category',
        title: '新学期教材特惠'
      },
      {
        _id: '2',
        imageUrl: 'https://free.picui.cn/free/2026/04/02/69ce49bb4063d.png',
        link: '/pages/category/category',
        title: '热门教材推荐'
      },
      {
        _id: '3',
        imageUrl: 'https://free.picui.cn/free/2026/04/02/69ce49bb7e247.png',
        link: '/pages/discover/discover',
        title: '同专业学长笔记'
      }
    ],
    recommendedBooks: [],
    page: 1,
    pageSize: 6,
    hasMore: true,
    isLoading: false,
    isRefreshing: false
  },

  onLoad: function () {
    this.updateTime();
    this.loadUserInfo();
    this.loadBooks();
    
    // 每分钟更新时间
    this.timeInterval = setInterval(() => {
      this.updateTime();
    }, 60000);
    
    // 监听用户信息更新事件
    this.listenUserInfoUpdate();
  },
  
  // 监听用户信息更新事件
  listenUserInfoUpdate: function() {
    const that = this;
    
    // 尝试使用 eventCenter 监听事件
    try {
      if (wx.eventCenter && wx.eventCenter.on) {
        wx.eventCenter.on('userInfoUpdated', function(userInfo) {
          console.log('📢 收到用户信息更新事件:', userInfo);
          // 重新加载数据以更新用户信息
          that.onRefresh();
        });
      }
    } catch (error) {
      console.error('监听用户信息更新事件失败:', error);
    }
  },

  onShow: function () {
    this.loadUserInfo();
    this.checkNewBooks();
    this.checkFavoritesStatus();
  },

  onUnload: function () {
    if (this.timeInterval) {
      clearInterval(this.timeInterval);
    }
  },

  onPullDownRefresh: function () {
    this.onRefresh();
  },

  onReachBottom: function () {
    this.loadMoreBooks();
  },

  // 更新时间
  updateTime: function () {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    this.setData({
      currentTime: hours + ':' + minutes
    });
  },

  // 加载用户信息
  loadUserInfo: function () {
    try {
      const app = getApp();
      const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo') || {};
      this.setData({ userInfo: userInfo });
    } catch (error) {
      console.error('加载用户信息失败:', error);
    }
  },

  // 检查是否有新发布的书籍
  checkNewBooks: function () {
    try {
      const shouldRefresh = wx.getStorageSync('should_refresh_books') || false;
      if (shouldRefresh) {
        wx.removeStorageSync('should_refresh_books');
        this.onRefresh();
      }
    } catch (error) {
      console.error('检查新书失败:', error);
    }
  },

  /**
   * 获取公开的图片URL
   */
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

  // 加载书籍
  loadBooks: function () {
    if (this.data.isLoading) return;
    
    this.setData({ isLoading: true });
    
    // 调用云函数获取书籍列表
    wx.cloud.callFunction({
      name: 'getBooks',
      data: {
        page: this.data.page,
        pageSize: this.data.pageSize
      },
      success: (res) => {
        try {
          if (res.result.success) {
            const newBooks = res.result.data.books;
            
            // 处理书籍封面URL
            const processBooks = async () => {
              for (const book of newBooks) {
                if (book.coverUrl || book.image) {
                  const imageUrl = book.coverUrl || book.image;
                  const publicUrl = await this.getPublicImageUrl(imageUrl);
                  book.coverUrl = publicUrl;
                  book.image = publicUrl;
                }
              }
              
              const updatedBooks = this.data.page === 1 
                ? newBooks 
                : [...this.data.recommendedBooks, ...newBooks];
              
              this.setData({
                recommendedBooks: updatedBooks,
                isLoading: false,
                hasMore: res.result.data.hasMore,
                page: this.data.page + 1
              });
              
              // 检查收藏状态
              this.checkFavoritesStatus();
            };
            
            processBooks();
          } else {
            console.error('获取书籍失败:', res.result.message);
            this.setData({ isLoading: false });
            wx.showToast({
              title: '获取书籍失败',
              icon: 'error',
              duration: 2000
            });
          }
        } catch (error) {
          console.error('处理书籍数据失败:', error);
          this.setData({ isLoading: false });
        }
      },
      fail: (error) => {
        console.error('调用云函数失败:', error);
        this.setData({ isLoading: false });
        wx.showToast({
          title: '网络错误，请重试',
          icon: 'error',
          duration: 2000
        });
      }
    });
  },

  // 下拉刷新
  onRefresh: function () {
    this.setData({ isRefreshing: true });
    
    setTimeout(() => {
      this.setData({
        page: 1,
        recommendedBooks: [],
        hasMore: true
      });
      
      this.loadBooks();
      this.setData({ isRefreshing: false });
      
      wx.stopPullDownRefresh();
      wx.showToast({
        title: '刷新成功',
        icon: 'success',
        duration: 1000
      });
    }, 1000);
  },

  // 加载更多
  loadMoreBooks: function () {
    if (!this.data.hasMore || this.data.isLoading) return;
    this.loadBooks();
  },

  // 换一批
  refreshBooks: function () {
    this.setData({
      page: 1,
      recommendedBooks: [],
      hasMore: true
    });
    this.loadBooks();
    
    wx.showToast({
      title: '已换一批',
      icon: 'success',
      duration: 1000
    });
  },

  // 格式化时间
  formatTime: function(time) {
    if (!time) return '';
    
    const date = new Date(time);
    const now = new Date();
    const diff = now - date;
    
    // 计算时间差
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days}天前`;
    } else if (hours > 0) {
      return `${hours}小时前`;
    } else if (minutes > 0) {
      return `${minutes}分钟前`;
    } else {
      return '刚刚';
    }
  },
  
  // 检查收藏状态
  checkFavoritesStatus: function () {
    try {
      const app = getApp();
      const favorites = wx.getStorageSync('favorites') || app.globalData.favorites || [];
      const books = this.data.recommendedBooks;
      
      if (books.length === 0) return;
      
      const updatedBooks = books.map(book => {
        const isCollected = favorites.some(fav => 
          fav.itemId === book._id || fav.itemId === book.id
        );
        
        // 格式化时间
        if (book.createTime) {
          book.formattedTime = this.formatTime(book.createTime);
        }
        
        return {
          ...book,
          isCollected: isCollected || false
        };
      });
      
      this.setData({ recommendedBooks: updatedBooks });
      
    } catch (error) {
      console.error('检查收藏状态失败:', error);
    }
  },

  // 收藏/取消收藏
  toggleFavorite: function (e) {
    if (e.stopPropagation) {
      e.stopPropagation();
    }
    const index = e.currentTarget.dataset.index;
    const book = this.data.recommendedBooks[index];

    // 检查登录状态
    const app = getApp();
    if (!app.globalData.isLoggedIn) {
      wx.showModal({
        title: '提示',
        content: '登录后可以收藏',
        confirmText: '去登录',
        cancelText: '再看看',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({
              url: '/pages/login/login'
            });
          }
        }
      });
      return;
    }

    try {
      const favorites = wx.getStorageSync('favorites') || [];
      const isCollected = book.isCollected;

      if (isCollected) {
        // 取消收藏
        const favoriteIndex = favorites.findIndex(fav =>
          fav.itemId === book._id || fav.itemId === book.id
        );
        if (favoriteIndex !== -1) {
          favorites.splice(favoriteIndex, 1);
        }
      } else {
        // 添加收藏
        favorites.push({
          itemId: book._id || book.id,
          title: book.title,
          price: book.price,
          image: book.image || book.coverUrl,
          type: 'book',
          timestamp: new Date().getTime()
        });
      }

      // 保存到本地
      wx.setStorageSync('favorites', favorites);

      // 更新数据
      const updatedBooks = [...this.data.recommendedBooks];
      updatedBooks[index] = {
        ...book,
        isCollected: !isCollected
      };

      this.setData({ recommendedBooks: updatedBooks });

      wx.showToast({
        title: isCollected ? '已取消收藏' : '收藏成功',
        icon: 'success',
        duration: 1000
      });

    } catch (error) {
      console.error('收藏操作失败:', error);
      wx.showToast({
        title: '操作失败',
        icon: 'error',
        duration: 1000
      });
    }
  },

  // 快捷通道 - 搜索
  goToSearch: function () {
    wx.navigateTo({
      url: '/pages/search/search'
    });
  },

  // 快捷通道 - 发布二手书
  goToPublishBook: function () {
    const app = getApp();
    if (!app.globalData.isLoggedIn) {
      wx.showModal({
        title: '提示',
        content: '请先登录',
        confirmText: '去登录',
        cancelText: '再看看',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({
              url: '/pages/login/login'
            });
          }
        }
      });
      return;
    }

    wx.navigateTo({
      url: '/pages/publish-book/publish-book'
    });
  },

  // 快捷通道 - 分区
  goToCategory: function () {
    wx.navigateTo({
      url: '/pages/category/category'
    });
  },

  // 快捷通道 - 收藏
  goToFavorites: function () {
    const app = getApp();
    if (!app.globalData.isLoggedIn) {
      wx.showModal({
        title: '提示',
        content: '请先登录',
        confirmText: '去登录',
        cancelText: '再看看',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({
              url: '/pages/login/login'
            });
          }
        }
      });
      return;
    }

    wx.navigateTo({
      url: '/pages/favorites/favorites'
    });
  },

  // 书籍详情
  goToBookDetail: function (e) {
    const bookId = e.currentTarget.dataset.id;
    const bookIndex = e.currentTarget.dataset.index;
    const book = this.data.recommendedBooks[bookIndex];
    
    // 增加浏览量
    this.incrementViewCount(book);
    
    wx.navigateTo({
      url: `/pages/book-detail/book-detail?id=${bookId}`
    });
  },

  // 增加浏览量
  incrementViewCount: function (book) {
    try {
      const allBooks = wx.getStorageSync('all_books') || {};
      const bookId = book._id || book.id;
      
      if (!allBooks[bookId]) {
        allBooks[bookId] = { ...book, viewCount: 0 };
      }
      
      allBooks[bookId].viewCount = (allBooks[bookId].viewCount || 0) + 1;
      wx.setStorageSync('all_books', allBooks);
      
    } catch (error) {
      console.error('增加浏览量失败:', error);
    }
  },

  // 点赞/取消点赞
  toggleLike: function (e) {
    e.stopPropagation();
    const index = e.currentTarget.dataset.index;
    const books = this.data.recommendedBooks;
    const book = books[index];
    
    book.isLiked = !book.isLiked;
    book.likeCount = book.isLiked ? (book.likeCount || 0) + 1 : Math.max(0, (book.likeCount || 0) - 1);
    
    this.setData({ recommendedBooks: books });
    
    wx.vibrateShort({ type: 'light' });
    wx.showToast({
      title: book.isLiked ? '已点赞' : '已取消',
      icon: 'success',
      duration: 1000
    });
  },

  // 轮播图点击
  onBannerTap: function(e) {
    const index = e.currentTarget.dataset.index;
    const banner = this.data.banners[index];
    if (banner.link) {
      wx.navigateTo({
        url: banner.link
      });
    }
  },

  // 获取本地已发布书籍
  getLocalPublishedBooks: function () {
    try {
      return wx.getStorageSync('published_books') || [];
    } catch (error) {
      console.error('获取本地书籍失败:', error);
      return [];
    }
  },


});