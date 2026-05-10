// pages/discover/discover.js
Page({
  data: {
    currentTab: 'rank', // rank: 排行榜, materials: 资料库, posts: 交流区
    rankList: [],
    materials: [],
    posts: [],
    searchText: '',
    isSearching: false,
    showFreeOnly: false, // 是否只显示免费
    selectedType: 'all', // 资料类型筛选
    page: 1,
    pageSize: 10,
    hasMore: true,
    isLoading: false,
    isRefreshing: false,
    
    // 新增：原始数据备份，用于搜索筛选
    originalMaterials: [],
    originalRankList: [],
    originalPosts: [],
    isFiltered: false
  },

  onLoad: function () {
    this.loadData();
    
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
          that.loadData();
        });
      }
    } catch (error) {
      console.error('监听用户信息更新事件失败:', error);
    }
  },

  onShow: function () {
    // 页面显示时刷新对应标签的数据
    if (this.data.currentTab === 'materials') {
      this.loadMaterials(1);
    } else if (this.data.currentTab === 'posts') {
      this.loadPosts(1);
    } else if (this.data.currentTab === 'rank') {
      this.loadRankList();
    }
  },

  onPullDownRefresh: function () {
    this.onRefresh();
  },

  onReachBottom: function () {
    this.loadMoreMaterials();
  },

  // 加载数据
  loadData: function() {
    this.setData({ isLoading: true });
    
    // 并行加载排行榜、资料和帖子
    Promise.all([
      this.loadRankList(),
      this.loadMaterials(1),
      this.loadPosts(1)
    ]).then(() => {
      this.setData({ isLoading: false });
    }).catch(err => {
      console.error('加载数据失败:', err);
      this.setData({ isLoading: false });
    });
  },

  // 刷新数据
  onRefresh: function() {
    this.setData({ isRefreshing: true });
    
    setTimeout(() => {
      this.setData({
        page: 1,
        materials: [],
        originalMaterials: [],
        posts: [],
        originalPosts: [],
        rankList: [],
        originalRankList: [],
        hasMore: true,
        isFiltered: false,
        searchText: '',
        showFreeOnly: false,
        selectedType: 'all'
      });
      
      this.loadData();
      this.setData({ isRefreshing: false });
      
      wx.stopPullDownRefresh();
      wx.showToast({
        title: '刷新成功',
        icon: 'success',
        duration: 1000
      });
    }, 1000);
  },

  // 加载更多资料
  loadMoreMaterials: function() {
    if (!this.data.hasMore || this.data.isLoading || this.data.isFiltered) return;
    
    // 如果是搜索或筛选状态，不需要加载更多
    if (this.data.searchText || this.data.showFreeOnly || this.data.selectedType !== 'all') {
      return;
    }
    
    this.loadMaterials(this.data.page + 1);
  },

  // 加载排行榜（专属于资料的排行榜，按收藏量排序）
  loadRankList: function() {
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name: 'getRankList',
        data: {
          type: 'materials',  // 专属于资料的排行榜
          limit: 10
        },
        success: (res) => {
          if (res.result.success) {
            const rankList = res.result.data;
            console.log('获取排行榜数据:', rankList);
            // 应用用户的交互状态
            this.applyUserInteractions(rankList, 'material').then(processedRankList => {
              // 添加排名和趋势字段
              const rankedList = processedRankList.map((item, index) => ({
                ...item,
                rank: index + 1,
                trend: Math.random() > 0.6 ? 'up' : Math.random() > 0.3 ? 'down' : 'stable'
              }));
              this.setData({
                rankList: rankedList,
                originalRankList: rankedList
              });
              resolve();
            }).catch(err => {
              console.error('处理排行榜数据失败:', err);
              this.setData({
                rankList: rankList,
                originalRankList: rankList
              });
              resolve();
            });
          } else {
            reject(res.result.message || '获取排行榜失败');
          }
        },
        fail: (err) => {
          console.error('调用云函数失败:', err);
          reject('网络错误，请重试');
        }
      });
    });
  },

  // 加载资料
  loadMaterials: function(page) {
    return new Promise((resolve, reject) => {
      this.setData({ isLoading: true });
      
      wx.cloud.callFunction({
        name: 'getMaterials',
        data: {
          page: page,
          pageSize: this.data.pageSize,
          type: this.data.selectedType,
          showFreeOnly: this.data.showFreeOnly
        },
        success: (res) => {
          if (res.result.success) {
            const newMaterials = res.result.data.materials;
            console.log('获取资料数据:', newMaterials);
            // 应用用户的交互状态
            this.applyUserInteractions(newMaterials, 'material').then(processedMaterials => {
              const materials = page === 1 ? processedMaterials : [...this.data.materials, ...processedMaterials];
              
              this.setData({
                materials: materials,
                originalMaterials: materials, // 保存原始数据
                page: page,
                hasMore: res.result.data.hasMore,
                isLoading: false
              });
              resolve();
            }).catch(err => {
              console.error('处理资料数据失败:', err);
              const materials = page === 1 ? newMaterials : [...this.data.materials, ...newMaterials];
              
              this.setData({
                materials: materials,
                originalMaterials: materials,
                page: page,
                hasMore: res.result.data.hasMore,
                isLoading: false
              });
              resolve();
            });
          } else {
            this.setData({ isLoading: false });
            reject(res.result.message || '获取资料失败');
          }
        },
        fail: (err) => {
          console.error('调用云函数失败:', err);
          this.setData({ isLoading: false });
          reject('网络错误，请重试');
        }
      });
    });
  },

  // 加载帖子
  loadPosts: function() {
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name: 'getPosts',
        data: {
          page: 1,
          pageSize: 20
        },
        success: (res) => {
          if (res.result.success) {
            const posts = res.result.data.posts;
            // 应用用户的交互状态
            this.applyUserInteractions(posts, 'post').then(processedPosts => {
              this.setData({ 
                posts: processedPosts,
                originalPosts: processedPosts
              });
              resolve();
            }).catch(err => {
              console.error('处理帖子数据失败:', err);
              this.setData({ 
                posts: posts,
                originalPosts: posts
              });
              resolve();
            });
          } else {
            reject(res.result.message || '获取帖子失败');
          }
        },
        fail: (err) => {
          console.error('调用云函数失败:', err);
          reject('网络错误，请重试');
        }
      });
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
  
  // 格式化日期时间为标准格式 YYYY-MM-DD HH:MM:SS
  formatDateTime: function(date) {
    const now = date || new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
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

  // 应用用户的交互状态（点赞、收藏）和更新用户信息
  applyUserInteractions: function(items, type) {
    const app = getApp();
    const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo');
    const openid = app.globalData.openid || wx.getStorageSync('openid');

    // 收集所有作者的 openid，用于批量查询
    const authorOpenids = new Set();
    items.forEach(item => {
      if (item.author && item.author._openid) {
        authorOpenids.add(item.author._openid);
      } else if (item._openid) {
        // 对于资料类型，直接使用 _openid
        authorOpenids.add(item._openid);
      }
    });

    // 批量查询作者信息（包含学院和专业）
    const queryUserDetails = () => {
      return new Promise((resolve) => {
        if (authorOpenids.size === 0) {
          resolve(new Map());
          return;
        }

        const db = wx.cloud.database();
        const _ = db.command;
        db.collection('users')
          .where({
            _openid: _.in(Array.from(authorOpenids))
          })
          .field({
            _openid: true,
            nickname: true,
            avatar: true,
            avatarUrl: true,
            college: true,
            major: true,
            campus: true
          })
          .get()
          .then(res => {
            const userMap = new Map();
            res.data.forEach(user => {
              userMap.set(user._openid, user);
            });
            resolve(userMap);
          })
          .catch(err => {
            console.error('查询用户详情失败:', err);
            resolve(new Map());
          });
      });
    };

    return queryUserDetails().then(userMap => {
      // 处理每个项目
      const processedItems = items.map(item => {
        // 检查是否已点赞
        const likedItem = app.globalData.userLikes.find(like => like.itemId === item._id && like.type === type);
        if (likedItem) {
          item.isLiked = true;
        }

        // 检查是否已收藏
        const favoritedItem = app.globalData.userFavorites.find(fav => fav.itemId === item._id && fav.type === type);
        if (favoritedItem) {
          item.isFavorited = true;
        }

        // 格式化时间
        if (item.createTime) {
          item.formattedTime = this.formatTime(item.createTime);
        }

        // 确保下载计数和收藏量字段存在
        item.downloadCount = item.downloadCount || item.downloads || 0;
        item.favoriteCount = item.favoritesCount || item.favoriteCount || 0;

        // 格式化类型显示（用于显示中文）
        const typeMap = {
          'past_exam': '真题',
          'notes': '笔记',
          'review_materials': '复习资料'
        };
        item.typeDisplay = typeMap[item.type] || '复习资料';

        // 补充作者信息（学院、专业）
        if (item.author && item.author._openid) {
          const authorInfo = userMap.get(item.author._openid);
          if (authorInfo) {
            item.author.college = authorInfo.college || '';
            item.author.major = authorInfo.major || '';
          }
        } else if (item._openid) {
          // 对于资料类型，使用 item._openid
          const authorInfo = userMap.get(item._openid);
          if (authorInfo) {
            if (!item.author) {
              item.author = {};
            }
            item.author.college = authorInfo.college || '';
            item.author.major = authorInfo.major || '';
          }
        }

        // 更新当前用户的信息
        if (userInfo && openid) {
          // 检查是否是当前用户的内容
          if (item._openid === openid || (item.author && item.author._openid === openid)) {
            // 更新作者信息为最新的用户信息
            if (item.author) {
              item.author.nickname = userInfo.nickName || userInfo.nickname || item.author.nickname;
              item.author.avatarUrl = userInfo.avatarUrl || userInfo.avatar || item.author.avatarUrl;
              // 也更新学院和专业
              item.author.college = userInfo.college || item.author.college;
              item.author.major = userInfo.major || item.author.major;
            } else {
              // 如果没有作者信息，创建一个
              item.author = {
                nickname: userInfo.nickName || userInfo.nickname || '用户',
                avatarUrl: userInfo.avatarUrl || userInfo.avatar || '',
                college: userInfo.college || '',
                major: userInfo.major || '',
                _openid: openid
              };
            }
          }
        }

        return item;
      });

      // 处理所有作者头像URL
      return Promise.all(processedItems.map(item => {
        if (item.author && item.author.avatarUrl) {
          return this.getPublicImageUrl(item.author.avatarUrl).then(publicUrl => {
            item.author.avatarUrl = publicUrl;
            return item;
          });
        }
        return Promise.resolve(item);
      }));
    });
  },

  // 切换标签
  switchTab: function(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ 
      currentTab: tab,
      page: 1,
      hasMore: true
    });
    
    // 当切换到资料库标签时，重新加载数据
    if (tab === 'materials') {
      this.loadMaterials(1);
    }
  },

  // 搜索资料
  onSearchInput: function(e) {
    this.setData({ 
      searchText: e.detail.value,
      page: 1
    });
    
    // 如果搜索框清空，恢复原始数据
    if (!e.detail.value.trim()) {
      this.resetFilters();
    }
  },

  // 开始搜索
  onSearch: function() {
    const searchText = this.data.searchText.trim();
    
    if (!searchText) {
      wx.showToast({
        title: '请输入搜索关键词',
        icon: 'none',
        duration: 1500
      });
      return;
    }
    
    this.setData({ 
      isSearching: true,
      page: 1
    });
    
    // 搜索逻辑
    setTimeout(() => {
      let searchResults = [];
      const keyword = searchText.toLowerCase();
      
      if (this.data.currentTab === 'rank') {
        // 搜索排行榜
        searchResults = this.searchInRankList(keyword);
        this.setData({ 
          rankList: searchResults,
          isSearching: false,
          isFiltered: true
        });
      } else if (this.data.currentTab === 'materials') {
        // 搜索资料库
        searchResults = this.searchInMaterials(keyword);
        this.setData({ 
          materials: searchResults,
          isSearching: false,
          isFiltered: true
        });
      } else if (this.data.currentTab === 'posts') {
        // 搜索帖子
        searchResults = this.searchInPosts(keyword);
        this.setData({ 
          posts: searchResults,
          isSearching: false,
          isFiltered: true
        });
      }
      
      wx.showToast({
        title: `找到${searchResults.length}个结果`,
        icon: 'success',
        duration: 1000
      });
    }, 500);
  },

  // 搜索排行榜
  searchInRankList: function(keyword) {
    return this.data.originalRankList.filter(item => {
      return item.title.toLowerCase().includes(keyword) ||
             item.author.nickname.toLowerCase().includes(keyword) ||
             item.type.toLowerCase().includes(keyword) ||
             item.description.toLowerCase().includes(keyword);
    });
  },

  // 搜索资料库
  searchInMaterials: function(keyword) {
    return this.data.originalMaterials.filter(item => {
      return item.title.toLowerCase().includes(keyword) ||
             item.author.nickname.toLowerCase().includes(keyword) ||
             item.type.toLowerCase().includes(keyword) ||
             item.description.toLowerCase().includes(keyword);
    });
  },

  // 搜索帖子
  searchInPosts: function(keyword) {
    return this.data.originalPosts.filter(item => {
      return item.title.toLowerCase().includes(keyword) ||
             item.content.toLowerCase().includes(keyword) ||
             item.author.nickname.toLowerCase().includes(keyword) ||
             (item.tags && item.tags.some(tag => tag.toLowerCase().includes(keyword)));
    });
  },

  // 切换免费筛选
  toggleFreeFilter: function() {
    const newShowFreeOnly = !this.data.showFreeOnly;
    this.setData({ 
      showFreeOnly: newShowFreeOnly,
      page: 1
    });
    
    this.applyFilters();
  },

  // 切换类型筛选
  changeTypeFilter: function(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({ 
      selectedType: type,
      page: 1
    });
    
    this.applyFilters();
  },

  // 应用所有筛选条件
  applyFilters: function() {
    const { originalMaterials, searchText, showFreeOnly, selectedType } = this.data;

    let filteredMaterials = [...originalMaterials];

    // 1. 先应用类型筛选
    if (selectedType !== 'all') {
      filteredMaterials = filteredMaterials.filter(item => {
        if (selectedType === 'review') return item.type === 'review_materials';
        if (selectedType === 'note') return item.type === 'notes';
        if (selectedType === 'exam') return item.type === 'past_exam';
        return true;
      });
    }

    // 2. 应用免费筛选
    if (showFreeOnly) {
      filteredMaterials = filteredMaterials.filter(item => item.isFree === true);
    }

    // 3. 应用搜索筛选（如果有关键词）
    if (searchText) {
      const keyword = searchText.toLowerCase();
      filteredMaterials = filteredMaterials.filter(item => {
        return item.title.toLowerCase().includes(keyword) ||
               item.author.nickname.toLowerCase().includes(keyword) ||
               item.type.toLowerCase().includes(keyword) ||
               item.description.toLowerCase().includes(keyword);
      });
    }

    this.setData({
      materials: filteredMaterials,
      isFiltered: searchText || showFreeOnly || selectedType !== 'all'
    });
  },

  // 重置筛选
  resetFilters: function() {
    this.setData({
      searchText: '',
      showFreeOnly: false,
      selectedType: 'all',
      isFiltered: false
    });
    
    // 恢复原始数据
    if (this.data.currentTab === 'rank') {
      this.setData({ rankList: this.data.originalRankList });
    } else if (this.data.currentTab === 'materials') {
      this.setData({ materials: this.data.originalMaterials });
    } else if (this.data.currentTab === 'posts') {
      this.setData({ posts: this.data.originalPosts });
    }
  },

  // 查看资料详情
  goToMaterialDetail: function(e) {
    const materialId = e.currentTarget.dataset.id;
    const material = e.currentTarget.dataset.material;
    
    wx.navigateTo({
      url: `/pages/material-detail/material-detail?id=${materialId}&title=${material.title}`
    });
  },

  // 获取最新的文件临时URL
  getLatestFileUrl: function(fileId) {
    return new Promise((resolve, reject) => {
      if (!fileId) {
        reject('缺少文件ID');
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
            reject(res.result.message || '获取文件URL失败');
          }
        },
        fail: (err) => {
          console.error('调用云函数失败:', err);
          reject('网络错误，请重试');
        }
      });
    });
  },

  // 创建资料订单
  createMaterialOrder: function(material) {
    const app = getApp();
    
    wx.showLoading({ title: '创建订单...' });
    
    wx.cloud.callFunction({
      name: 'createMaterialOrder',
      data: {
        materialId: material._id,
        buyerName: app.globalData.userInfo?.nickName || '用户',
        buyerAvatar: app.globalData.userInfo?.avatarUrl || ''
      }
    }).then(res => {
      wx.hideLoading();
      
      if (res.result && res.result.success) {
        if (res.result.data.isFree) {
          // 免费资料直接下载
          this.downloadMaterial(material);
        } else {
          // 付费资料跳转到订单页面
          wx.showToast({
            title: '购买成功',
            icon: 'success',
            duration: 1500
          });
          
          setTimeout(() => {
            wx.navigateTo({
              url: '/pages/my-orders/my-orders?category=material'
            });
          }, 1500);
        }
      } else {
        wx.showToast({
          title: res.result ? res.result.message : '购买失败',
          icon: 'none'
        });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('创建订单失败:', err);
      wx.showToast({
        title: '购买失败，请重试',
        icon: 'none'
      });
    });
  },

  // 下载资料
  downloadMaterial: function(material) {
    wx.showLoading({ title: '准备下载...' });
    
    // 获取最新的文件 URL
    this.getLatestFileUrl(material.fileId).then(fileUrl => {
      wx.hideLoading();
      
      if (!fileUrl) {
        wx.showToast({
          title: '文件链接不存在，无法下载',
          icon: 'none',
          duration: 2000
        });
        return;
      }
      
      wx.showLoading({ title: '下载中...' });
      
      // 下载文件
      wx.downloadFile({
        url: fileUrl,
        success: (res) => {
          wx.hideLoading();
          if (res.statusCode === 200) {
            // 保存下载记录
            this.saveDownloadRecord(material, res.tempFilePath);
            
            // 打开文件
            wx.openDocument({
              filePath: res.tempFilePath,
              showMenu: true,
              success: () => {
                console.log('文件打开成功');
              },
              fail: (err) => {
                console.error('打开文件失败:', err);
              }
            });
            
            wx.showToast({
              title: '下载成功',
              icon: 'success',
              duration: 1500
            });
            
            // 更新下载次数
            material.downloadCount = (material.downloadCount || 0) + 1;
            this.setData({ materials: this.data.materials });
            
            // 调用云函数更新下载计数
            wx.cloud.callFunction({
              name: 'updateDownloadCount',
              data: {
                materialId: material._id
              }
            });
          } else {
            wx.showToast({
              title: '下载失败，请稍后重试',
              icon: 'none',
              duration: 2000
            });
          }
        },
        fail: (err) => {
          wx.hideLoading();
          console.error('下载失败:', err);
          wx.showToast({
            title: '网络错误，请稍后重试',
            icon: 'none',
            duration: 2000
          });
        }
      });
    }).catch(err => {
      console.error('获取文件 URL 失败:', err);
      wx.hideLoading();
      wx.showToast({
        title: err || '获取文件链接失败',
        icon: 'none',
        duration: 2000
      });
    });
  },

  // 保存下载记录
  saveDownloadRecord: function(material, tempFilePath) {
    try {
      // 构造下载记录
      const downloadRecord = {
        _id: 'download_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        materialId: material._id,
        title: material.title,
        type: material.type,
        fileSize: material.fileSize,
        price: material.price,
        downloadTime: this.formatDateTime(new Date()),
        uploaderId: material.author._id,
        uploaderName: material.author.nickname,
        localPath: tempFilePath || ''
      };
      
      // 从本地存储获取现有下载记录
      let downloads = wx.getStorageSync('downloads') || [];
      
      // 检查是否已经下载过
      const existingIndex = downloads.findIndex(item => item.materialId === material._id);
      if (existingIndex !== -1) {
        // 更新现有记录
        downloads[existingIndex] = downloadRecord;
      } else {
        // 添加新记录
        downloads.unshift(downloadRecord);
      }
      
      // 保存到本地存储
      wx.setStorageSync('downloads', downloads);
      
      console.log('保存下载记录成功:', downloadRecord);
      
    } catch (error) {
      console.error('保存下载记录失败:', error);
    }
  },

  // 立即购买/下载
  purchaseMaterial: function(e) {
    const index = e.currentTarget.dataset.index;
    const currentTab = this.data.currentTab;
    let materials, material;
    
    if (currentTab === 'rank') {
      materials = this.data.rankList;
    } else {
      materials = this.data.materials;
    }
    
    material = materials[index];
    
    // 检查登录状态
    const app = getApp();
    if (!app.globalData.isLoggedIn) {
      wx.showModal({
        title: '提示',
        content: '登录后可以购买/下载资料',
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
    
    if (material.isFree) {
      // 免费资料直接下载
      wx.showLoading({ title: '准备下载...' });
      
      // 获取最新的文件URL
      this.getLatestFileUrl(material.fileId).then(fileUrl => {
        wx.hideLoading();
        
        if (!fileUrl) {
          wx.showToast({
            title: '文件链接不存在，无法下载',
            icon: 'none',
            duration: 2000
          });
          return;
        }
        
        wx.showLoading({ title: '下载中...' });
        
        // 下载文件
        wx.downloadFile({
          url: fileUrl,
          success: (res) => {
            wx.hideLoading();
            if (res.statusCode === 200) {
              // 保存下载记录
              this.saveDownloadRecord(material, res.tempFilePath);
              
              // 打开文件
              wx.openDocument({
                filePath: res.tempFilePath,
                showMenu: true,
                success: () => {
                  console.log('文件打开成功');
                },
                fail: (err) => {
                  console.error('打开文件失败:', err);
                }
              });
              
              wx.showToast({
                title: '下载成功',
                icon: 'success',
                duration: 1500
              });
              
              // 更新下载次数
              material.downloadCount = (material.downloadCount || 0) + 1;
              
              if (currentTab === 'rank') {
                this.setData({ rankList: materials });
              } else {
                this.setData({ materials: materials });
              }
              
              // 调用云函数更新下载计数
              wx.cloud.callFunction({
                name: 'updateDownloadCount',
                data: {
                  materialId: material._id
                },
                success: (res) => {
                  if (res.result.success) {
                    console.log('更新下载计数成功:', res.result.data);
                  } else {
                    console.error('更新下载计数失败:', res.result.message);
                  }
                },
                fail: (err) => {
                  console.error('调用云函数失败:', err);
                }
              });
            } else {
              console.error('下载失败，状态码:', res.statusCode);
              wx.showToast({
                title: '下载失败，请稍后重试',
                icon: 'none',
                duration: 2000
              });
            }
          },
          fail: (err) => {
            console.error('下载失败:', err);
            wx.hideLoading();
            wx.showToast({
              title: '网络错误，请稍后重试',
              icon: 'none',
              duration: 2000
            });
          }
        });
      }).catch(err => {
        console.error('获取文件URL失败:', err);
        wx.hideLoading();
        wx.showToast({
          title: err || '获取文件链接失败',
          icon: 'none',
          duration: 2000
        });
      });
    } else {
      // 付费资料 - 先判断是否是本人资料
      const app = getApp();
      const openid = app.globalData.openid || wx.getStorageSync('openid');
      
      if (material._openid === openid) {
        wx.showToast({
          title: '这是您自己上传的资料',
          icon: 'none'
        });
        return;
      }
      
      // 检查是否已购买过
      wx.showLoading({ title: '检查购买状态...' });
      
      wx.cloud.callFunction({
        name: 'getMyOrders',
        data: {
          type: 'buy',
          category: 'material',
          status: 'all'
        }
      }).then(res => {
        wx.hideLoading();
        
        if (res.result && res.result.success) {
          const orders = res.result.data.orders || [];
          const purchasedOrder = orders.find(order => order.materialId === material._id);
          
          if (purchasedOrder) {
            // 已购买，跳转到订单页面
            wx.showModal({
              title: '提示',
              content: '您已购买过该资料',
              showCancel: false,
              confirmText: '查看订单',
              success: () => {
                wx.navigateTo({
                  url: '/pages/my-orders/my-orders?category=material'
                });
              }
            });
            return;
          }
          
          // 未购买，创建订单
          this.createMaterialOrder(material);
        } else {
          wx.showToast({
            title: '检查购买状态失败',
            icon: 'none'
          });
        }
      }).catch(err => {
        wx.hideLoading();
        console.error('检查购买状态失败:', err);
        wx.showToast({
          title: '网络错误，请重试',
          icon: 'none'
        });
      });
    }
  },

  // 查看帖子详情
  goToPostDetail: function(e) {
    const postId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/post-detail/post-detail?id=${postId}`
    });
  },

  // 查看用户主页
  goToUserProfile: function(e) {
    const userId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/user-center/user-center?id=${userId}`
    });
  },

  // 发布帖子
  goToPublishPost: function() {
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
      url: '/pages/publish-post/publish-post'
    });
  },

  // 发布资料
  goToPublishMaterial: function() {
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
      url: '/pages/publish-material/publish-material'
    });
  },

  // 收藏资料
  favoriteMaterial: function(e) {
    e.stopPropagation();
    const index = e.currentTarget.dataset.index;
    const currentTab = this.data.currentTab;
    let materials, material;
    
    if (currentTab === 'rank') {
      materials = this.data.rankList;
    } else {
      materials = this.data.materials;
    }
    
    material = materials[index];
    
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
    
    const newIsFavorited = !material.isFavorited;
    
    if (newIsFavorited) {
      wx.cloud.callFunction({
        name: 'addFavorite',
        data: {
          itemId: material._id,
          type: 'material',
          itemData: {
            title: material.title,
            price: material.price,
            format: material.format || material.type,
            fileSize: material.fileSize,
            uploaderName: material.author?.nickname || '未知'
          }
        },
        success: (res) => {
          if (res.result.success) {
            material.isFavorited = true;
            material.favoriteCount = (material.favoriteCount || 0) + 1;
            
            if (!app.globalData.userFavorites) {
              app.globalData.userFavorites = [];
            }
            app.globalData.userFavorites.push({
              _id: res.result.data._id,
              userId: app.globalData.openid,
              itemId: material._id,
              type: 'material',
              itemData: material,
              createTime: new Date().toISOString()
            });
            app.saveUserDataToStorage();
            
            if (currentTab === 'rank') {
              this.setData({ rankList: materials });
            } else {
              this.setData({ materials: materials });
            }
            
            wx.showToast({
              title: '收藏成功',
              icon: 'success',
              duration: 1000
            });
          } else {
            wx.showToast({
              title: res.result.message || '收藏失败',
              icon: 'none',
              duration: 2000
            });
          }
        },
        fail: (err) => {
          console.error('添加收藏失败:', err);
          wx.showToast({
            title: '网络错误，请重试',
            icon: 'none',
            duration: 2000
          });
        }
      });
    } else {
      wx.cloud.callFunction({
        name: 'removeFavorite',
        data: {
          itemId: material._id,
          type: 'material'
        },
        success: (res) => {
          if (res.result.success) {
            material.isFavorited = false;
            material.favoriteCount = Math.max(0, (material.favoriteCount || 0) - 1);
            
            app.globalData.userFavorites = (app.globalData.userFavorites || []).filter(fav => fav.itemId !== material._id || fav.type !== 'material');
            app.saveUserDataToStorage();
            
            if (currentTab === 'rank') {
              this.setData({ rankList: materials });
            } else {
              this.setData({ materials: materials });
            }
            
            wx.showToast({
              title: '已取消收藏',
              icon: 'success',
              duration: 1000
            });
          } else {
            wx.showToast({
              title: res.result.message || '取消收藏失败',
              icon: 'none',
              duration: 2000
            });
          }
        },
        fail: (err) => {
          console.error('移除收藏失败:', err);
          wx.showToast({
            title: '网络错误，请重试',
            icon: 'none',
            duration: 2000
          });
        }
      });
    }
  },

  // 点赞帖子
  likePost: function(e) {
    e.stopPropagation();
    const index = e.currentTarget.dataset.index;
    const posts = this.data.posts;
    const post = posts[index];
    
    // 检查登录状态
    const app = getApp();
    if (!app.globalData.isLoggedIn) {
      wx.showModal({
        title: '提示',
        content: '登录后可以点赞',
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
    
    const newIsLiked = !post.isLiked;
    post.isLiked = newIsLiked;
    post.likeCount = newIsLiked ? (post.likeCount || 0) + 1 : Math.max(0, (post.likeCount || 0) - 1);
    
    if (newIsLiked) {
      // 添加点赞
      wx.cloud.callFunction({
        name: 'addLike',
        data: {
          itemId: post._id,
          type: 'post',
          itemData: post
        },
        success: (res) => {
          if (res.result.success) {
            // 更新本地点赞数据
            if (!app.globalData.userLikes) {
              app.globalData.userLikes = [];
            }
            app.globalData.userLikes.push({
              _id: res.result.data._id,
              userId: app.globalData.openid,
              itemId: post._id,
              type: 'post',
              itemData: post,
              createTime: new Date().toISOString()
            });
            app.saveUserDataToStorage();
            
            this.setData({ posts });
            
            wx.showToast({
              title: '已点赞',
              icon: 'success',
              duration: 1000
            });
          } else {
            post.isLiked = !newIsLiked;
            post.likeCount = newIsLiked ? (post.likeCount || 0) - 1 : (post.likeCount || 0) + 1;
            this.setData({ posts });
            wx.showToast({
              title: res.result.message || '点赞失败',
              icon: 'none',
              duration: 2000
            });
          }
        },
        fail: (err) => {
          console.error('添加点赞失败:', err);
          post.isLiked = !newIsLiked;
          post.likeCount = newIsLiked ? (post.likeCount || 0) - 1 : (post.likeCount || 0) + 1;
          this.setData({ posts });
          wx.showToast({
            title: '网络错误，请重试',
            icon: 'none',
            duration: 2000
          });
        }
      });
    } else {
      // 移除点赞
      wx.cloud.callFunction({
        name: 'removeLike',
        data: {
          itemId: post._id,
          type: 'post'
        },
        success: (res) => {
          if (res.result.success) {
            // 更新本地点赞数据
            app.globalData.userLikes = (app.globalData.userLikes || []).filter(like => like.itemId !== post._id || like.type !== 'post');
            app.saveUserDataToStorage();
            
            this.setData({ posts });
            
            wx.showToast({
              title: '已取消',
              icon: 'success',
              duration: 1000
            });
          } else {
            post.isLiked = !newIsLiked;
            post.likeCount = newIsLiked ? (post.likeCount || 0) - 1 : (post.likeCount || 0) + 1;
            this.setData({ posts });
            wx.showToast({
              title: res.result.message || '取消点赞失败',
              icon: 'none',
              duration: 2000
            });
          }
        },
        fail: (err) => {
          console.error('移除点赞失败:', err);
          post.isLiked = !newIsLiked;
          post.likeCount = newIsLiked ? (post.likeCount || 0) - 1 : (post.likeCount || 0) + 1;
          this.setData({ posts });
          wx.showToast({
            title: '网络错误，请重试',
            icon: 'none',
            duration: 2000
          });
        }
      });
    }
  },


});