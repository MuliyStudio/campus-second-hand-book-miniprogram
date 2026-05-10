// pages/my-upload/my-upload.js
Page({
  data: {
    // 当前激活的标签
    activeTab: 'book',
    
    // 加载状态
    loading: false,
    
    // 书籍数据
    books: [],
    
    // 资料数据
    materials: []
  },

  onLoad() {
    console.log('加载我的上传页面');
    this.checkLoginStatus();
    this.loadData();
  },

  onShow() {
    // 页面显示时刷新数据
    this.checkLoginStatus();
    this.refreshData();
  },

  // 检查登录状态
  checkLoginStatus() {
    const app = getApp();
    if (!app.globalData.isLoggedIn || !app.globalData.userInfo) {
      wx.navigateTo({
        url: '../login/login'
      });
      return false;
    }
    return true;
  },

  // 加载数据
  loadData() {
    this.setData({ loading: true });
    
    // 获取用户上传的二手书
    wx.cloud.callFunction({
      name: 'getBooks',
      data: {
        type: 'user'
      },
      success: (res) => {
        let books = [];
        if (res.result.success) {
          // 确保统计数据存在
          books = res.result.data.books.map(book => ({
            ...book,
            viewCount: book.viewCount || book.views || 0,
            favoriteCount: book.favoriteCount || book.favoritesCount || 0
          }));
        }
        
        // 获取用户上传的资料
        wx.cloud.callFunction({
          name: 'getMaterials',
          data: {
            type: 'user'
          },
          success: (res2) => {
            let materials = [];
            if (res2.result.success) {
              // 确保统计数据存在，注意资料使用的是 favoritesCount
              materials = res2.result.data.materials.map(material => ({
                ...material,
                downloadCount: material.downloadCount || 0,
                favoriteCount: material.favoriteCount || material.favoritesCount || 0
              }));
            }
            
            this.setData({
              books: books,
              materials: materials,
              loading: false
            });
          },
          fail: (error) => {
            console.error('获取资料失败:', error);
            this.setData({
              books: books,
              materials: [],
              loading: false
            });
          }
        });
      },
      fail: (error) => {
        console.error('获取书籍失败:', error);
        this.setData({
          books: [],
          materials: [],
          loading: false
        });
      }
    });
  },

  // 刷新数据
  refreshData() {
    if (this.data.activeTab === 'book') {
      // 获取用户上传的二手书
      wx.cloud.callFunction({
        name: 'getBooks',
        data: {
          type: 'user'
        },
        success: (res) => {
          let books = [];
          if (res.result.success) {
            books = res.result.data.books;
          }
          this.setData({ books });
        },
        fail: (error) => {
          console.error('获取书籍失败:', error);
        }
      });
    } else {
      // 获取用户上传的资料
      wx.cloud.callFunction({
        name: 'getMaterials',
        data: {
          type: 'user'
        },
        success: (res) => {
          let materials = [];
          if (res.result.success) {
            materials = res.result.data.materials;
          }
          this.setData({ materials });
        },
        fail: (error) => {
          console.error('获取资料失败:', error);
        }
      });
    }
  },

  // 获取用户上传的二手书
  getUserBooks() {
    const app = getApp();
    // 从全局数据获取
    if (app.globalData.books && app.globalData.books.length > 0) {
      return app.globalData.books;
    }
    
    // 从本地存储获取
    try {
      const publishedBooks = wx.getStorageSync('published_books') || [];
      return publishedBooks;
    } catch (error) {
      console.error('获取本地书籍失败:', error);
      return this.getMockBooks();
    }
  },



  // 获取模拟书籍数据
  getMockBooks() {
    return [
      {
        _id: '1',
        title: '数据结构与算法',
        author: '严蔚敏',
        publisher: '清华大学出版社',
        course: '数据结构',
        condition: 8,
        status: 'available',
        views: 45,
        favoriteCount: 12,
        createTime: '2024-01-15T10:30:00',
        price: 25
      },
      {
        _id: '2',
        title: '高等数学（第七版）',
        author: '同济大学数学系',
        publisher: '高等教育出版社',
        course: '高等数学',
        condition: 9,
        status: 'sold',
        views: 68,
        favoriteCount: 8,
        createTime: '2024-01-10T14:20:00',
        price: 18
      },
      {
        _id: '3',
        title: '计算机网络（第7版）',
        author: '谢希仁',
        publisher: '电子工业出版社',
        course: '计算机网络',
        condition: 7,
        status: 'reserved',
        views: 21,
        favoriteCount: 5,
        createTime: '2024-01-05T09:15:00',
        price: 30
      },
      {
        _id: '4',
        title: 'C++ Primer',
        author: 'Stanley B.Lippman',
        publisher: '电子工业出版社',
        course: 'C++编程',
        condition: 6,
        status: 'available',
        views: 32,
        favoriteCount: 15,
        createTime: '2023-12-28T16:45:00',
        price: 45
      }
    ];
  },

  // 获取模拟资料数据
  getMockMaterials() {
    return [
      {
        _id: 'm1',
        title: '高等数学上册复习资料',
        type: 'pdf',
        fileSize: '2.3MB',
        price: 0,
        downloadCount: 156,
        favoriteCount: 23,
        createTime: '2024-01-12T11:20:00'
      },
      {
        _id: 'm2',
        title: '数据结构课件合集',
        type: 'PPT',
        fileSize: '15.6MB',
        price: 5,
        downloadCount: 89,
        favoriteCount: 12,
        createTime: '2024-01-08T15:30:00'
      },
      {
        _id: 'm3',
        title: '计算机网络实验报告',
        type: 'Word',
        fileSize: '1.8MB',
        price: 2,
        downloadCount: 45,
        favoriteCount: 8,
        createTime: '2024-01-03T10:10:00'
      }
    ];
  },

  // 切换标签
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
  },



  // 格式化日期
  formatDate(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return '今天';
    } else if (days === 1) {
      return '昨天';
    } else if (days < 7) {
      return `${days}天前`;
    } else if (days < 30) {
      return `${Math.floor(days / 7)}周前`;
    } else {
      return date.getMonth() + 1 + '月' + date.getDate() + '日';
    }
  },

  // 编辑书籍
  editBook(e) {
    const bookId = e.currentTarget.dataset.id;
    const book = this.data.books.find(b => b._id === bookId);
    
    if (book) {
      wx.navigateTo({
        url: `/pages/publish-book/publish-book?edit=true&bookId=${bookId}&book=${encodeURIComponent(JSON.stringify(book))}`
      });
    }
  },

  // 跳转到书籍详情页
  goToBookDetail(e) {
    const bookId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/book-detail/book-detail?id=${bookId}`
    });
  },

  // 跳转到资料详情页
  goToMaterialDetail(e) {
    const materialId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/material-detail/material-detail?id=${materialId}`
    });
  },



  // 删除书籍
  deleteBook(e) {
    const bookId = e.currentTarget.dataset.id;
    const book = this.data.books.find(b => b._id === bookId);
    
    if (!book) return;
    
    wx.showModal({
      title: '确认删除',
      content: `确定要删除《${book.title}》吗？`,
      confirmText: '删除',
      confirmColor: '#ff6b6b',
      success: (res) => {
        if (res.confirm) {
          wx.cloud.callFunction({
            name: 'deleteBook',
            data: {
              bookId: bookId
            },
            success: (res) => {
              if (res.result.success) {
                const books = this.data.books.filter(b => b._id !== bookId);
                this.setData({ books });
                
                // 设置刷新标记，让首页知道需要刷新数据
                wx.setStorageSync('should_refresh_books', true);
                
                wx.showToast({
                  title: '删除成功',
                  icon: 'success',
                  duration: 1500
                });
              } else {
                wx.showToast({
                  title: res.result.message || '删除失败',
                  icon: 'none',
                  duration: 2000
                });
              }
            },
            fail: (err) => {
              console.error('调用云函数失败:', err);
              wx.showToast({
                title: '网络错误，请重试',
                icon: 'none',
                duration: 2000
              });
            }
          });
        }
      }
    });
  },

  // 编辑资料
  editMaterial(e) {
    const materialId = e.currentTarget.dataset.id;
    const material = this.data.materials.find(m => m._id === materialId);
    
    if (material) {
      wx.navigateTo({
        url: `/pages/publish-material/publish-material?edit=true&materialId=${materialId}&material=${encodeURIComponent(JSON.stringify(material))}`
      });
    }
  },

  // 切换书籍上下架状态
  toggleBookStatus(e) {
    const bookId = e.currentTarget.dataset.id;
    const currentStatus = e.currentTarget.dataset.status;
    const book = this.data.books.find(b => b._id === bookId);
    
    if (!book) return;
    
    const newStatus = currentStatus === 'offline' ? 'available' : 'offline';
    const actionText = newStatus === 'available' ? '上架' : '下架';
    
    wx.showModal({
      title: `确认${actionText}`,
      content: `确定要${actionText}《${book.title}》吗？`,
      confirmText: actionText,
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '处理中...', mask: true });
          
          wx.cloud.callFunction({
            name: 'updateBookStatus',
            data: {
              bookId: bookId,
              status: newStatus
            }
          }).then(res => {
            wx.hideLoading();
            
            if (res.result && res.result.success) {
              // 更新本地数据
              const books = this.data.books.map(b => {
                if (b._id === bookId) {
                  return {
                    ...b,
                    status: newStatus,
                    statusText: newStatus === 'available' ? '在售' : '已下架'
                  };
                }
                return b;
              });
              
              this.setData({ books });
              
              wx.showToast({
                title: `${actionText}成功`,
                icon: 'success',
                duration: 1500
              });
            } else {
              wx.showToast({
                title: res.result ? res.result.message : `${actionText}失败`,
                icon: 'none'
              });
            }
          }).catch(err => {
            wx.hideLoading();
            console.error('调用云函数失败:', err);
            wx.showToast({
              title: `${actionText}失败，请重试`,
              icon: 'none'
            });
          });
        }
      }
    });
  },

  // 切换资料上下架状态
  toggleMaterialStatus(e) {
    const materialId = e.currentTarget.dataset.id;
    const currentStatus = e.currentTarget.dataset.status;
    const material = this.data.materials.find(m => m._id === materialId);
    
    if (!material) return;
    
    const newStatus = currentStatus === 'offline' ? 'available' : 'offline';
    const actionText = newStatus === 'available' ? '上架' : '下架';
    
    wx.showModal({
      title: `确认${actionText}`,
      content: `确定要${actionText}《${material.title}》吗？`,
      confirmText: actionText,
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '处理中...', mask: true });
          
          wx.cloud.callFunction({
            name: 'updateMaterialStatus',
            data: {
              materialId: materialId,
              status: newStatus
            }
          }).then(res => {
            wx.hideLoading();
            
            if (res.result && res.result.success) {
              // 更新本地数据
              const materials = this.data.materials.map(m => {
                if (m._id === materialId) {
                  return {
                    ...m,
                    status: newStatus,
                    statusText: newStatus === 'available' ? '在售' : '已下架'
                  };
                }
                return m;
              });
              
              this.setData({ materials });
              
              wx.showToast({
                title: `${actionText}成功`,
                icon: 'success',
                duration: 1500
              });
            } else {
              wx.showToast({
                title: res.result ? res.result.message : `${actionText}失败`,
                icon: 'none'
              });
            }
          }).catch(err => {
            wx.hideLoading();
            console.error('调用云函数失败:', err);
            wx.showToast({
              title: `${actionText}失败，请重试`,
              icon: 'none'
            });
          });
        }
      }
    });
  },

  // 删除资料
  deleteMaterial(e) {
    const materialId = e.currentTarget.dataset.id;
    const material = this.data.materials.find(m => m._id === materialId);
    
    if (!material) return;
    
    wx.showModal({
      title: '确认删除',
      content: `确定要删除《${material.title}》吗？`,
      confirmText: '删除',
      confirmColor: '#ff6b6b',
      success: (res) => {
        if (res.confirm) {
          wx.cloud.callFunction({
            name: 'deleteMaterial',
            data: {
              materialId: materialId
            },
            success: (res) => {
              if (res.result.success) {
                const materials = this.data.materials.filter(m => m._id !== materialId);
                this.setData({ materials });
                
                wx.showToast({
                  title: '删除成功',
                  icon: 'success',
                  duration: 1500
                });
              } else {
                wx.showToast({
                  title: res.result.message || '删除失败',
                  icon: 'none',
                  duration: 2000
                });
              }
            },
            fail: (err) => {
              console.error('调用云函数失败:', err);
              wx.showToast({
                title: '网络错误，请重试',
                icon: 'none',
                duration: 2000
              });
            }
          });
        }
      }
    });
  },

  // 跳转到发布页面
  goToPublish() {
    if (this.data.activeTab === 'book') {
      wx.navigateTo({
        url: '/pages/publish-book/publish-book'
      });
    } else {
      wx.navigateTo({
        url: '/pages/publish-material/publish-material'
      });
    }
  }
});