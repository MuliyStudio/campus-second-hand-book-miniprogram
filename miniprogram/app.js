// app.js
App({
  globalData: {
    openid: null,
    userInfo: null,
    wechatUserInfo: null,
    isLoggedIn: false,
    debugMode: true,
    isTesting: false,
    favorites: [],
    following: [],
    followers: [],
    unreadMessageCount: 0,
    platform: 'unknown',
    isHarmonyOS: false,
    safeArea: { top: 0, bottom: 0, left: 0, right: 0 },
    // 用户上传的资料
    uploadedMaterials: [],
    // 用户发布的帖子
    uploadedPosts: [],
    // 用户的点赞记录
    userLikes: [],
    // 用户的收藏记录
    userFavorites: [],
    // 用户的评论记录
    userComments: [],
    // 校区宿舍映射
    campusDormMappings: {
      '西校区': ['南苑', '北苑', '西苑', '东苑'],
      '东校区': ['1 栋', '2 栋', '3 栋', '4 栋', '5 栋', '6 栋', '7 栋', '8 栋', '9 栋', '10 栋'],
    },
    // 消息监听器
    messageWatchers: [],
    // 全局消息轮询定时器
    _messagePollingTimer: null,
    _lastUnreadCount: 0
  },

  onLaunch: function () {
    console.log('🎉 App Launch - 校园资源共享平台启动');

    // 检测平台和适配HarmonyOS
    this.detectPlatform();

    // 初始化云开发
    wx.cloud.init({
      env: 'xiaowen-env-0gdw907s2b9957d2',
      traceUser: true
    });

    // 检查本地登录状态
    const hasLocalLogin = this.checkLocalLoginStatus();

    if (!hasLocalLogin) {
      // 未登录，游客模式，直接进入首页
      console.log('👤 游客模式启动');
      wx.hideLoading();
      this.enterHomePage();
    } else {
      // 已登录，验证登录状态
      console.log('🔐 已登录，验证登录状态');
      this.verifyLoginStatus();
      this.enterHomePage();
      this.loadUserData();
    }
  },

  onShow: function () {
    console.log('📱 App Show - 应用前台显示');
  },

  onHide: function () {
    console.log('📴 App Hide - 应用后台运行');
  },

  onError: function (error) {
    console.error('❌ App Error:', error);
  },

  // 检测平台和HarmonyOS适配
  detectPlatform: function() {
    try {
      // 使用 getDeviceInfo 检测平台
      if (wx.getDeviceInfo) {
        wx.getDeviceInfo({
          success: (res) => {
            console.log('设备信息:', res);
            this.handlePlatformDetection(res);
          },
          fail: () => {
            this.fallbackPlatformDetection();
          }
        });
      } else {
        this.fallbackPlatformDetection();
      }
    } catch (error) {
      console.error('平台检测失败:', error);
      this.globalData.platform = 'unknown';
    }
  },

  // 处理平台检测结果
  handlePlatformDetection: function(deviceInfo) {
    const platform = deviceInfo.platform;
    const system = deviceInfo.system || '';
    
    // 检测HarmonyOS
    const isHarmonyOS = platform === 'ohos' || system.includes('HarmonyOS') || system.includes('OpenHarmony');
    
    this.globalData.platform = platform;
    this.globalData.isHarmonyOS = isHarmonyOS;
    
    console.log('检测到平台:', platform);
    console.log('系统信息:', system);
    console.log('是否为HarmonyOS:', isHarmonyOS);
    
    if (isHarmonyOS) {
      console.log('🔧 检测到鸿蒙系统，进行适配处理');
      this.adaptHarmonyOS(deviceInfo);
    }
  },

  // 回退平台检测
  fallbackPlatformDetection: function() {
    try {
      const systemInfo = wx.getSystemInfoSync();
      console.log('系统信息:', systemInfo);
      
      const platform = systemInfo.platform;
      const system = systemInfo.system || '';
      const isHarmonyOS = platform === 'ohos' || system.includes('HarmonyOS') || system.includes('OpenHarmony');
      
      this.globalData.platform = platform;
      this.globalData.isHarmonyOS = isHarmonyOS;
      
      if (isHarmonyOS) {
        console.log('🔧 检测到鸿蒙系统，进行适配处理');
        this.adaptHarmonyOS(systemInfo);
      }
    } catch (error) {
      console.error('回退平台检测失败:', error);
      this.globalData.platform = 'unknown';
      this.globalData.isHarmonyOS = false;
    }
  },

  // HarmonyOS适配
  adaptHarmonyOS: function(systemInfo) {
    console.log('🔧 开始适配鸿蒙系统');
    
    // 1. 设置安全区域
    this.setSafeArea(systemInfo);
    
    // 2. 优化UI元素避让
    this.optimizeUILayout();
    
    // 3. 调整动画效果
    this.adjustAnimations();
    
    // 4. 设置全局样式变量
    this.setHarmonyOSStyles();
  },

  // 设置安全区域
  setSafeArea: function(systemInfo) {
    const safeArea = systemInfo.safeArea || {
      top: 0,
      bottom: 0,
      left: 0,
      right: 0
    };
    
    this.globalData.safeArea = safeArea;
    console.log('安全区域:', safeArea);
    
    // 设置全局安全区域变量
    wx.setStorageSync('safeArea', safeArea);
  },

  // 优化UI布局
  optimizeUILayout: function() {
    console.log('🔧 优化鸿蒙系统UI布局');
    
    // 设置全局样式
    const styles = {
      '--harmony-safe-top': this.globalData.safeArea.top + 'px',
      '--harmony-safe-bottom': this.globalData.safeArea.bottom + 'px',
      '--harmony-safe-left': this.globalData.safeArea.left + 'px',
      '--harmony-safe-right': this.globalData.safeArea.right + 'px'
    };
    
    // 存储样式配置
    wx.setStorageSync('harmonyStyles', styles);
  },

  // 调整动画效果
  adjustAnimations: function() {
    console.log('🔧 调整鸿蒙系统动画效果');
    
    // 鸿蒙系统可能需要更流畅的动画配置
    const animationConfig = {
      duration: 300,
      timingFunction: 'ease-out'
    };
    
    wx.setStorageSync('animationConfig', animationConfig);
  },

  // 设置HarmonyOS样式
  setHarmonyOSStyles: function() {
    // 设置全局CSS变量
    const styles = wx.getStorageSync('harmonyStyles') || {};
    
    // 在app.wxss中可以通过CSS变量使用这些值
    console.log('🎨 设置鸿蒙系统样式变量:', styles);
  },

  // 检查本地登录状态
  checkLocalLoginStatus: function() {
    try {
      const userInfo = wx.getStorageSync('userInfo');
      const isLoggedIn = wx.getStorageSync('isLoggedIn');
      const openid = wx.getStorageSync('openid');
      
      if (userInfo && isLoggedIn && openid) {
        // 本地有登录信息
        this.globalData.userInfo = userInfo;
        this.globalData.isLoggedIn = true;
        this.globalData.openid = openid;
        
        console.log('📱 从本地存储恢复登录状态');
        console.log('用户信息:', this.globalData.userInfo.nickname);

        // 启动全局消息轮询
        this.startMessagePolling();
        
        return true;
      }
    } catch (error) {
      console.error('读取本地登录状态失败:', error);
    }
    
    return false;
  },

  // 启动登录流程
  startLogin: function() {
    // 显示加载提示
    wx.showLoading({ 
      title: '登录中...', 
      mask: true 
    });

    // 执行微信登录
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

      console.log('🔐 获取到登录code:', loginRes.code);

      // 2. 调用云函数获取 openid
      const cloudRes = await wx.cloud.callFunction({
        name: 'login',
        data: { code: loginRes.code }
      });

      // 关键：将 openid 保存到 globalData
      this.globalData.openid = cloudRes.result.openid;
      console.log('✅ 获取到的openid:', this.globalData.openid);
      
      // 保存到本地存储
      wx.setStorageSync('openid', this.globalData.openid);

      // 检查用户是否已完善信息
      await this.checkUserInfo();
      
    } catch (error) {
      console.error('❌ 登录出错:', error);
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

      if (userRes.data.length === 0 || this.globalData.isTesting) {
        // 新用户或测试模式，跳转到完善信息页
        console.log('👤 跳转到完善信息页面');
        console.log('- 新用户:', userRes.data.length === 0);
        console.log('- 测试模式:', this.globalData.isTesting);
        
        wx.redirectTo({
          url: '/pages/complete-info/complete-info'
        });
      } else {
        // 老用户，直接进入首页
        console.log('👥 老用户，直接进入首页');
        
        // 保存用户信息
        this.globalData.userInfo = userRes.data[0];
        this.globalData.isLoggedIn = true;
        
        // 保存到本地存储
        this.saveLoginStatus();

        // 启动全局消息轮询
        this.startMessagePolling();
        // 进入首页
        this.enterHomePage();
        
        // 加载用户相关数据
        this.loadUserData();
        
        // 震动反馈
        wx.vibrateShort({ type: 'light' });
      }

    } catch (error) {
      console.error('❌ 检查用户信息失败:', error);
      wx.hideLoading();
      
      // 出错时进入完善信息页
      wx.redirectTo({
        url: '/pages/complete-info/complete-info'
      });
    }
  },

  // 验证登录状态
  verifyLoginStatus: async function() {
    try {
      if (!this.globalData.openid) return;
      
      const db = wx.cloud.database();
      const userRes = await db.collection('users')
        .where({ _openid: this.globalData.openid })
        .get();

      if (userRes.data.length === 0) {
        // 数据库中没有用户信息，需要重新完善
        console.log('⚠️ 本地有登录信息但数据库中不存在，跳转到完善信息页');
        
        this.globalData.isLoggedIn = false;
        this.globalData.userInfo = null;
        
        wx.removeStorageSync('userInfo');
        wx.removeStorageSync('isLoggedIn');
        
        wx.redirectTo({
          url: '/pages/complete-info/complete-info'
        });
      } else {
        // 更新用户信息
        this.globalData.userInfo = userRes.data[0];
        console.log('✅ 登录状态验证通过');
      }
    } catch (error) {
      console.error('验证登录状态失败:', error);
    }
  },

  // 保存登录状态到本地存储
  saveLoginStatus: function() {
    try {
      wx.setStorageSync('userInfo', this.globalData.userInfo);
      wx.setStorageSync('isLoggedIn', this.globalData.isLoggedIn);
      wx.setStorageSync('openid', this.globalData.openid);
      console.log('💾 登录状态已保存到本地');
    } catch (error) {
      console.error('保存登录状态失败:', error);
    }
  },

  // 进入首页
  enterHomePage: function() {
    wx.switchTab({
      url: '/pages/index/index',
      success: () => {
        console.log('🏠 进入首页');
      }
    });
  },

  // 用户完善信息后调用
  onUserInfoUpdated: function(userInfo) {
    console.log('👤 用户信息已完善');
    
    this.globalData.userInfo = userInfo;
    this.globalData.isLoggedIn = true;
    
    // 保存到本地存储
    this.saveLoginStatus();

    // 启动全局消息轮询
    this.startMessagePolling();

    // 检查未读消息
    // 加载用户数据
    this.loadUserData();
    
    // 震动反馈
    wx.vibrateShort({ type: 'medium' });
    
    // 发送全局事件通知，通知所有页面用户信息已更新
    try {
      if (wx.eventCenter && wx.eventCenter.trigger) {
        wx.eventCenter.trigger('userInfoUpdated', userInfo);
      }
    } catch (error) {
      console.error('发送用户信息更新事件失败:', error);
    }
  },

  // 加载用户数据
  loadUserData: function() {
    console.log('📥 开始加载用户数据');
    
    if (!this.globalData.openid || !this.globalData.isLoggedIn) {
      console.warn('⚠️ 未登录，跳过加载用户数据');
      return;
    }

    const that = this;
    
    // 从本地存储加载数据
    that.loadDataFromStorage();
    
    // 使用模拟数据填充（如果本地存储没有数据）
    setTimeout(() => {
      // 如果本地存储没有数据，使用模拟数据
      if (that.globalData.uploadedMaterials.length === 0) {
        that.globalData.uploadedMaterials = [
          {
            _id: 'material_' + Date.now(),
            title: '数据结构复习资料',
            author: {
              _id: that.globalData.openid,
              nickname: that.globalData.userInfo.nickname,
              avatarUrl: that.globalData.userInfo.avatarUrl
            },
            downloadCount: 120,
            favoriteCount: 35,
            type: '复习资料',
            fileSize: '2.5MB',
            format: 'PDF',
            isFree: true,
            price: 0,
            isFavorited: false,
            createTime: new Date().toISOString(),
            description: '包含数据结构所有章节的重点知识点和习题解答'
          }
        ];
      }

      if (that.globalData.uploadedPosts.length === 0) {
        that.globalData.uploadedPosts = [
          {
            _id: 'post_' + Date.now(),
            title: '学习经验分享',
            content: '今天给大家分享一下我的学习经验，希望能帮到大家',
            author: {
              _id: that.globalData.openid,
              nickname: that.globalData.userInfo.nickname,
              avatarUrl: that.globalData.userInfo.avatarUrl,
              college: that.globalData.userInfo.college,
              major: that.globalData.userInfo.major
            },
            type: 'share',
            tags: ['分享', '经验', '学习'],
            likeCount: 25,
            commentCount: 8,
            viewCount: 150,
            createTime: new Date().toISOString(),
            isLiked: false
          }
        ];
      }

      // 保存数据到本地存储
      that.saveUserDataToStorage();
      
      console.log('✅ 用户数据加载完成');
    }, 500);
  },
  
  // 从本地存储加载数据
  loadDataFromStorage: function() {
    try {
      const uploadedMaterials = wx.getStorageSync('uploadedMaterials');
      const uploadedPosts = wx.getStorageSync('uploadedPosts');
      const userLikes = wx.getStorageSync('userLikes');
      const userFavorites = wx.getStorageSync('userFavorites');
      const userComments = wx.getStorageSync('userComments');
      
      if (uploadedMaterials) {
        this.globalData.uploadedMaterials = uploadedMaterials;
        console.log('📥 从本地存储加载上传的资料:', uploadedMaterials.length, '条');
      }
      
      if (uploadedPosts) {
        this.globalData.uploadedPosts = uploadedPosts;
        console.log('📥 从本地存储加载上传的帖子:', uploadedPosts.length, '条');
      }
      
      if (userLikes) {
        this.globalData.userLikes = userLikes;
        console.log('📥 从本地存储加载点赞记录:', userLikes.length, '条');
      }
      
      if (userFavorites) {
        this.globalData.userFavorites = userFavorites;
        console.log('📥 从本地存储加载收藏记录:', userFavorites.length, '条');
      }
      
      if (userComments) {
        this.globalData.userComments = userComments;
        console.log('📥 从本地存储加载评论记录:', userComments.length, '条');
      }
    } catch (error) {
      console.error('从本地存储加载数据失败:', error);
    }
  },
  
  // 保存用户数据到本地存储
  saveUserDataToStorage: function() {
    try {
      wx.setStorageSync('uploadedMaterials', this.globalData.uploadedMaterials);
      wx.setStorageSync('uploadedPosts', this.globalData.uploadedPosts);
      wx.setStorageSync('userLikes', this.globalData.userLikes);
      wx.setStorageSync('userFavorites', this.globalData.userFavorites);
      wx.setStorageSync('userComments', this.globalData.userComments);
      console.log('💾 用户数据已保存到本地存储');
    } catch (error) {
      console.error('保存用户数据到本地存储失败:', error);
    }
  },

  // 刷新用户数据
  refreshUserData: function() {
    console.log('🔄 刷新用户数据');
    
    if (!this.globalData.isLoggedIn) {
      return;
    }
    
    this.checkUnreadMessages();
  },

  // 检查未读消息（从云数据库统计真实未读数）
  checkUnreadMessages: function() {
    if (!this.globalData.openid) return;

    const openid = this.globalData.openid;

    Promise.all([
      wx.cloud.callFunction({
        name: 'getNotices',
        data: { type: 'unread_count', openid: openid }
      }),
      wx.cloud.callFunction({
        name: 'getMessages',
        data: { type: 'unread_count' }
      })
    ]).then(([noticesRes, messagesRes]) => {
      let systemUnread = 0;
      let personalUnread = 0;

      if (noticesRes.result && noticesRes.result.success) {
        systemUnread = noticesRes.result.data.unreadCount || 0;
      }
      if (messagesRes.result && messagesRes.result.success) {
        personalUnread = messagesRes.result.data.unreadCount || 0;
      }

      const total = systemUnread + personalUnread;
      const prevCount = this.globalData.unreadMessageCount;
      this.globalData.unreadMessageCount = total;
      this._lastUnreadCount = total;

      console.log('未读消息数 - 系统:', systemUnread, '个人:', personalUnread, '总计:', total);

      // 更新 tabBar 红点
      this._updateTabBarBadge(total);

      // 如果未读数增加了，通知所有监听器
      if (total > prevCount) {
        this.globalData.messageWatchers.forEach(watcher => {
          try {
            watcher(total);
          } catch (error) {
            console.error('消息监听器执行失败:', error);
          }
        });
      }
    }).catch(err => {
      console.error('检查未读消息失败:', err);
    });
  },

  // 启动全局消息轮询（登录后调用）
  startMessagePolling: function() {
    if (this.globalData._messagePollingTimer) return;
    if (!this.globalData.openid) return;

    console.log('📡 启动全局消息轮询');
    // 首次立即检查一次
    this.checkUnreadMessages();

    // 每 10 秒轮询一次
    this.globalData._messagePollingTimer = setInterval(() => {
      if (this.globalData.isLoggedIn && this.globalData.openid) {
        this.checkUnreadMessages();
      }
    }, 10000);
  },

  // 停止全局消息轮询
  stopMessagePolling: function() {
    if (this.globalData._messagePollingTimer) {
      clearInterval(this.globalData._messagePollingTimer);
      this.globalData._messagePollingTimer = null;
      console.log('📡 停止全局消息轮询');
    }
  },

  // 更新 tabBar 红点
  _updateTabBarBadge: function(count) {
    if (count > 0) {
      wx.setTabBarBadge({
        index: 2,
        text: count > 99 ? '99+' : count.toString()
      });
    } else {
      wx.removeTabBarBadge({ index: 2 });
    }
  },

  // 注册消息监听器（用于实时接收新消息通知）
  registerMessageWatcher: function(watcher) {
    if (typeof watcher === 'function' && !this.globalData.messageWatchers.includes(watcher)) {
      this.globalData.messageWatchers.push(watcher);
      console.log('📡 注册消息监听器，当前监听器数量:', this.globalData.messageWatchers.length);
    }
  },

  // 移除消息监听器
  unregisterMessageWatcher: function(watcher) {
    const index = this.globalData.messageWatchers.indexOf(watcher);
    if (index > -1) {
      this.globalData.messageWatchers.splice(index, 1);
      console.log('📡 移除消息监听器，当前监听器数量:', this.globalData.messageWatchers.length);
    }
  },

  // 通知所有监听器有新消息
  notifyNewMessage: function(messageCount) {
    console.log('🔔 收到新消息通知，未读数:', messageCount);
    
    if (messageCount && typeof messageCount === 'number') {
      this.globalData.unreadMessageCount = messageCount;
    } else {
      // 没有传具体数量时，不自增，避免重复累加
      // 消息页 onShow 时会自动重新统计
      return;
    }
    
    // 通知所有监听器
    this.globalData.messageWatchers.forEach(watcher => {
      try {
        watcher(this.globalData.unreadMessageCount);
      } catch (error) {
        console.error('消息监听器执行失败:', error);
      }
    });
    
    // 保存到本地存储
    wx.setStorageSync('unreadMessageCount', this.globalData.unreadMessageCount);
  },

  // 获取当前未读消息数
  getUnreadMessageCount: function() {
    return this.globalData.unreadMessageCount;
  },

  // 检查登录状态
  checkLogin: function(redirectToLogin) {
    if (!this.globalData.isLoggedIn) {
      if (redirectToLogin) {
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
      }
      return false;
    }
    return true;
  },

  // 获取宿舍苑栋列表
  getDormList: function(campus) {
    if (!campus) return [];
    
    return this.globalData.campusDormMappings[campus] || [];
  },

  // 获取完整的校区宿舍标签
  getCampusDormTag: function(userInfo) {
    if (!userInfo) return '';
    
    const campus = userInfo.campus || '';
    const dorm = userInfo.dorm || '';
    
    if (campus && dorm) {
      return `${campus} ${dorm}`;
    } else if (campus) {
      return campus;
    } else {
      return '未设置';
    }
  },

  // 计算距离评分（根据校区和宿舍）
  calculateDistanceScore: function(sellerInfo, buyerInfo) {
    if (!sellerInfo || !buyerInfo) return 0;
    
    const sellerCampus = sellerInfo.campus || '';
    const buyerCampus = buyerInfo.campus || '';
    const sellerDorm = sellerInfo.dorm || '';
    const buyerDorm = buyerInfo.dorm || '';
    
    // 同一校区+同一宿舍 = 100分
    if (sellerCampus === buyerCampus && sellerDorm === buyerDorm) {
      return 100;
    }
    // 同一校区+不同宿舍 = 60分
    else if (sellerCampus === buyerCampus) {
      return 60;
    }
    // 不同校区 = 20分
    else {
      return 20;
    }
  },

  // 计算距离描述
  getDistanceDescription: function(sellerInfo, buyerInfo) {
    if (!sellerInfo || !buyerInfo) return '距离未知';
    
    const sellerCampus = sellerInfo.campus || '';
    const buyerCampus = buyerInfo.campus || '';
    const sellerDorm = sellerInfo.dorm || '';
    const buyerDorm = buyerInfo.dorm || '';
    
    if (sellerCampus === buyerCampus && sellerDorm === buyerDorm) {
      return '同一宿舍苑栋';
    } else if (sellerCampus === buyerCampus) {
      return '同一校区';
    } else {
      return '不同校区';
    }
  },

  // 获取距离徽章样式
  getDistanceBadgeClass: function(sellerInfo, buyerInfo) {
    const score = this.calculateDistanceScore(sellerInfo, buyerInfo);
    
    if (score >= 80) {
      return 'distance-close';
    } else if (score >= 40) {
      return 'distance-medium';
    } else {
      return 'distance-far';
    }
  },

  // 获取距离徽章颜色
  getDistanceBadgeColor: function(sellerInfo, buyerInfo) {
    const score = this.calculateDistanceScore(sellerInfo, buyerInfo);
    
    if (score >= 80) {
      return '#2e7d32'; // 绿色
    } else if (score >= 40) {
      return '#f57c00'; // 橙色
    } else {
      return '#f44336'; // 红色
    }
  },

  // 格式化校区宿舍信息
  formatCampusDormInfo: function(userInfo, showIcon = true) {
    if (!userInfo) return '';
    
    const campus = userInfo.campus || '';
    const dorm = userInfo.dorm || '';
    
    let result = '';
    
    if (showIcon) {
      result += '📍 ';
    }
    
    if (campus && dorm) {
      result += `${campus} ${dorm}`;
    } else if (campus) {
      result += campus;
    } else {
      result += '未设置位置';
    }
    
    return result;
  },

  // 排序功能：按距离排序
  sortItemsByDistance: function(items, buyerInfo, reverse = false) {
    if (!buyerInfo || !items || items.length === 0) return items;
    
    const sortedItems = [...items].sort((a, b) => {
      const scoreA = this.calculateDistanceScore(a.sellerInfo || a.author, buyerInfo);
      const scoreB = this.calculateDistanceScore(b.sellerInfo || b.author, buyerInfo);
      
      return reverse ? scoreA - scoreB : scoreB - scoreA;
    });
    
    return sortedItems;
  },

  // 测试功能
  toggleTestMode: function() {
    this.globalData.isTesting = !this.globalData.isTesting;
    const modeText = this.globalData.isTesting ? '开启' : '关闭';
    console.log('🔧 测试模式:', modeText);
    
    wx.showToast({
      title: `测试模式${modeText}`,
      icon: 'none',
      duration: 2000
    });
    
    return this.globalData.isTesting;
  },

  // 返回完善信息页面（测试用）
  goToCompleteInfoPage: function() {
    console.log('🔧 测试：返回完善信息页面');
    
    wx.redirectTo({
      url: '/pages/complete-info/complete-info'
    });
  },

  // 模拟登录（测试用）
  mockLogin: function(userData) {
    console.log('🔧 测试：模拟登录');
    
    this.globalData.openid = 'mock_openid_' + Date.now();
    this.globalData.userInfo = userData || {
      _id: 'mock_user_' + Date.now(),
      nickname: '测试用户',
      avatarUrl: '/images/default-avatar.png',
      campus: '西校区',
      dorm: '南苑',
      gender: 'male',
      college: '计算机学院',
      major: '计算机科学与技术',
      grade: 2022,
      studentId: '2230823010',
      isAdmin: false,
      creditScore: 100
    };
    this.globalData.isLoggedIn = true;
    
    this.saveLoginStatus();
    this.loadUserData();

    // 启动全局消息轮询
    this.startMessagePolling();
    
    wx.showToast({
      title: '模拟登录成功',
      icon: 'success',
      duration: 2000
    });
    
    wx.switchTab({
      url: '/pages/index/index'
    });
  },

  // 清空登录状态
  clearLoginStatus: function() {
    wx.showModal({
      title: '提示',
      content: '确定要清空登录状态吗？',
      confirmText: '确定',
      confirmColor: '#ff4444',
      success: (res) => {
        if (res.confirm) {
          this.globalData.openid = null;
          this.globalData.userInfo = null;
          this.globalData.isLoggedIn = false;
          
          // 清空本地存储
          wx.removeStorageSync('userInfo');
          wx.removeStorageSync('isLoggedIn');
          wx.removeStorageSync('openid');
          
          console.log('🧹 已清空登录状态');
          
          wx.showToast({
            title: '登录状态已清空',
            icon: 'success',
            duration: 1500
          });
          
          // 跳转到完善信息页
          setTimeout(() => {
            wx.redirectTo({
              url: '/pages/complete-info/complete-info'
            });
          }, 1500);
        }
      }
    });
  },

  // 获取调试信息
  getDebugInfo: function() {
    return {
      openid: this.globalData.openid,
      isLoggedIn: this.globalData.isLoggedIn,
      isTesting: this.globalData.isTesting,
      debugMode: this.globalData.debugMode,
      platform: this.globalData.platform,
      isHarmonyOS: this.globalData.isHarmonyOS,
      userInfo: this.globalData.userInfo,
      campusDormTag: this.getCampusDormTag(this.globalData.userInfo),
      favoritesCount: this.globalData.favorites.length,
      followingCount: this.globalData.following.length,
      followersCount: this.globalData.followers.length,
      unreadMessages: this.globalData.unreadMessageCount
    };
  },

  // 导出调试信息
  exportDebugInfo: function() {
    const debugInfo = this.getDebugInfo();
    console.log('🔍 调试信息:', debugInfo);
    
    const content = `登录状态: ${debugInfo.isLoggedIn ? '已登录' : '未登录'}
用户: ${debugInfo.userInfo ? debugInfo.userInfo.nickname : '无'}
位置: ${debugInfo.campusDormTag}
OpenID: ${debugInfo.openid || '无'}
平台: ${debugInfo.platform} ${debugInfo.isHarmonyOS ? '(HarmonyOS)' : ''}
测试模式: ${debugInfo.isTesting ? '开启' : '关闭'}
收藏: ${debugInfo.favoritesCount}个
关注: ${debugInfo.followingCount}个
粉丝: ${debugInfo.followersCount}个
未读消息: ${debugInfo.unreadMessages}条`;
    
    wx.showModal({
      title: '调试信息',
      content: content,
      confirmText: '复制',
      cancelText: '关闭',
      success: (res) => {
        if (res.confirm) {
          wx.setClipboardData({
            data: content,
            success: () => {
              wx.showToast({
                title: '已复制到剪贴板',
                icon: 'success'
              });
            }
          });
        }
      }
    });
  },

  // 显示测试菜单
  showTestMenu: function() {
    if (!this.globalData.debugMode) return;
    
    const menuItems = [
      this.globalData.isTesting ? '关闭测试模式' : '开启测试模式',
      '返回完善信息页',
      '模拟登录',
      '清空登录状态',
      '查看调试信息',
      '测试距离计算',
      '取消'
    ];
    
    wx.showActionSheet({
      itemList: menuItems,
      success: (res) => {
        const index = res.tapIndex;
        switch(index) {
          case 0:
            this.toggleTestMode();
            break;
          case 1:
            this.goToCompleteInfoPage();
            break;
          case 2:
            this.mockLogin();
            break;
          case 3:
            this.clearLoginStatus();
            break;
          case 4:
            this.exportDebugInfo();
            break;
          case 5:
            this.testDistanceCalculation();
            break;
        }
      }
    });
  },

  // 测试距离计算
  testDistanceCalculation: function() {
    const testSeller = { campus: '西校区', dorm: '南苑' };
    const testBuyer1 = { campus: '西校区', dorm: '南苑' };
    const testBuyer2 = { campus: '西校区', dorm: '北苑' };
    const testBuyer3 = { campus: '东校区', dorm: '1栋' };
    
    const score1 = this.calculateDistanceScore(testSeller, testBuyer1);
    const score2 = this.calculateDistanceScore(testSeller, testBuyer2);
    const score3 = this.calculateDistanceScore(testSeller, testBuyer3);
    
    const desc1 = this.getDistanceDescription(testSeller, testBuyer1);
    const desc2 = this.getDistanceDescription(testSeller, testBuyer2);
    const desc3 = this.getDistanceDescription(testSeller, testBuyer3);
    
    const content = `距离计算测试：
1. 同一宿舍苑栋：${score1}分 (${desc1})
2. 同一校区不同苑：${score2}分 (${desc2})
3. 不同校区：${score3}分 (${desc3})`;
    
    wx.showModal({
      title: '距离计算测试',
      content: content,
      showCancel: false
    });
  }
});