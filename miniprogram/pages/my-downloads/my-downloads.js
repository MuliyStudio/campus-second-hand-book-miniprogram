// pages/my-downloads/my-downloads.js
Page({
  data: {
    // 加载状态
    loading: false,
    
    // 下载记录
    downloads: []
  },

  onLoad() {
    console.log('加载我的下载页面');
    this.checkLoginStatus();
    this.loadData();
  },

  onShow() {
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
    
    setTimeout(() => {
      const downloads = this.getDownloads();
      this.setData({
        downloads: downloads,
        loading: false
      });
    }, 800);
  },

  // 刷新数据
  refreshData() {
    const downloads = this.getDownloads();
    this.setData({ downloads });
  },

  // 获取下载数据
  getDownloads() {
    try {
      const downloads = wx.getStorageSync('downloads') || [];
      return downloads;
    } catch (error) {
      console.error('获取下载记录失败:', error);
      return [];
    }
  },

  // 获取模拟下载数据（备用）
  getMockDownloads() {
    return [
      {
        _id: 'download_1',
        title: '高等数学复习资料',
        type: 'PDF',
        fileSize: '2.3MB',
        price: 5,
        downloadTime: '2024-01-13 11:20:00',
        uploaderId: 'uploader_001',
        uploaderName: '张老师'
      },
      {
        _id: 'download_2',
        title: '数据结构课件合集',
        type: 'PPT',
        fileSize: '15.6MB',
        price: 0,
        downloadTime: '2024-01-11 15:30:00',
        uploaderId: 'uploader_002',
        uploaderName: '李助教'
      },
      {
        _id: 'download_3',
        title: '计算机网络实验报告',
        type: 'Word',
        fileSize: '1.8MB',
        price: 2,
        downloadTime: '2024-01-09 10:10:00',
        uploaderId: 'uploader_003',
        uploaderName: '王教授'
      },
      {
        _id: 'download_4',
        title: '数据库系统视频教程',
        type: '视频',
        fileSize: '256MB',
        price: 10,
        downloadTime: '2024-01-07 13:45:00',
        uploaderId: 'uploader_004',
        uploaderName: '陈老师'
      }
    ];
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
    } else {
      return date.getMonth() + 1 + '月' + date.getDate() + '日';
    }
  },

  // 下载资料
  downloadMaterial(e) {
    // 阻止事件冒泡，避免触发父级的goToDetail事件
    if (e && e.stopPropagation) {
      e.stopPropagation();
    }
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    // 微信小程序特有的事件阻止
    if (e && e.currentTarget) {
      console.log('再次下载按钮事件已阻止冒泡');
    }
    
    console.log('点击了再次下载按钮');
    
    const downloadId = e.currentTarget.dataset.id;
    const downloads = this.data.downloads;
    const downloadItem = downloads.find(item => item._id === downloadId);
    
    if (!downloadItem) {
      wx.showToast({
        title: '下载记录不存在',
        icon: 'none',
        duration: 1500
      });
      return;
    }
    
    wx.showLoading({
      title: '下载中...',
      mask: true
    });
    
    // 模拟下载过程
    setTimeout(() => {
      wx.hideLoading();
      wx.showToast({
        title: '下载成功',
        icon: 'success',
        duration: 1500
      });
    }, 2000);
  },

  // 删除下载记录
  deleteDownload(e) {
    // 阻止事件冒泡，避免触发父级的goToDetail事件
    if (e && e.stopPropagation) {
      e.stopPropagation();
    }
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    // 微信小程序特有的事件阻止
    if (e && e.currentTarget) {
      console.log('删除按钮事件已阻止冒泡');
    }
    
    console.log('点击了删除按钮');
    
    const downloadId = e.currentTarget.dataset.id;
    const downloads = [...this.data.downloads];
    const index = downloads.findIndex(item => item._id === downloadId);
    
    if (index === -1) {
      wx.showToast({
        title: '记录不存在',
        icon: 'none',
        duration: 1500
      });
      return;
    }
    
    const downloadItem = downloads[index];
    
    wx.showModal({
      title: '确认删除',
      content: `确定要删除"${downloadItem.title}"的下载记录吗？`,
      success: (res) => {
        if (res.confirm) {
          // 检查是否有本地文件路径
          if (downloadItem.localPath) {
            console.log('删除本地文件:', downloadItem.localPath);
            // 注意：微信小程序中无法直接删除临时文件，临时文件会在小程序退出后自动清理
            // 这里我们只需要删除记录，文件会由系统自动管理
          }
          
          // 从数组中删除记录
          downloads.splice(index, 1);
          this.setData({ downloads });
          
          // 更新本地存储
          try {
            wx.setStorageSync('downloads', downloads);
            wx.showToast({
              title: '删除成功',
              icon: 'success',
              duration: 1500
            });
          } catch (error) {
            console.error('更新下载记录失败:', error);
            wx.showToast({
              title: '删除失败，请重试',
              icon: 'none',
              duration: 1500
            });
          }
        }
      }
    });
  },

  // 去浏览资料
  goToDiscover() {
    wx.switchTab({
      url: '/pages/discover/discover'
    });
  },

  // 跳转到详情页
  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/material-detail/material-detail?id=${id}`
    });
  }
});