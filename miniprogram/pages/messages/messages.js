// pages/messages/messages.js
Page({
  data: {
    messages: [],
    filteredMessages: [],
    activeTab: 'system',
    unreadCount: 0,
    systemUnreadCount: 0,
    personalUnreadCount: 0,
    isLoading: true,
    isRefreshing: false,
    isLoadingMore: false,
    hasMore: true,
    showUserInfoDialog: false,
    selectedUserInfo: {},
    isLoggedIn: false,
    page: 1,
    pageSize: 20,
    showMessageDetailDialog: false,
    selectedMessage: {},
    _isLoadingData: false,  // 防止重复加载标志
    _noticesWatcher: null,  // notices 实时监听器
    _messagesWatcher: null  // messages 实时监听器
  },

  onLoad: function () {
    // 注册 app.js 的全局消息监听回调
    this._registerGlobalWatcher();
  },

  onUnload: function () {
    this._unregisterGlobalWatcher();
    this.closeRealtimeWatchers();
  },

  onShow: function () {
    const isLoggedIn = this.checkLoginStatus();
    // 每次显示时启动实时监听
    if (isLoggedIn) {
      this.startRealtimeWatchers();
    }
  },

  onHide: function () {
    // 页面隐藏时关闭实时监听，节省资源
    this.closeRealtimeWatchers();
  },

  // 检查登录状态
  checkLoginStatus: function() {
    const app = getApp();
    const isLoggedIn = app.globalData.isLoggedIn && app.globalData.userInfo;

    this.setData({ isLoggedIn: isLoggedIn });

    if (isLoggedIn && !this.data._isLoadingData) {
      // 防止 onShow 和 onLoad 重复触发 loadMessages
      this.loadMessages();
    }

    return isLoggedIn;
  },

  onPullDownRefresh: function () {
    this.refreshMessages();
  },

  // 加载消息
  loadMessages: function(isRefresh = false) {
    // 防止重复加载
    if (this.data._isLoadingData) return;
    this.setData({ _isLoadingData: true });

    const page = isRefresh ? 1 : this.data.page;
    this.setData({
      isLoading: page === 1,
      isLoadingMore: page > 1
    });

    const app = getApp();
    const currentOpenid = app.globalData.openid || app.globalData.userInfo?.openid || '';

    Promise.all([
      wx.cloud.callFunction({
        name: 'getNotices',
        data: { page: page, pageSize: this.data.pageSize, openid: currentOpenid }
      }),
      wx.cloud.callFunction({
        name: 'getMessages',
        data: { type: 'personal', page: page, pageSize: this.data.pageSize, openid: currentOpenid }
      }),
      // 额外获取真实的未读数量（基于数据库 count，不依赖本地列表）
      wx.cloud.callFunction({
        name: 'getNotices',
        data: { type: 'unread_count', openid: currentOpenid }
      }),
      wx.cloud.callFunction({
        name: 'getMessages',
        data: { type: 'unread_count' }
      })
    ]).then(results => {
      const [noticesRes, messagesRes, noticesCountRes, messagesCountRes] = results;

      console.log('系统消息:', noticesRes);
      console.log('个人消息:', messagesRes);

      let allMessages = [];
      let hasMore = false;

      if (noticesRes.result && noticesRes.result.success && noticesRes.result.data && Array.isArray(noticesRes.result.data)) {
        const systemMessages = noticesRes.result.data.map(msg => ({
          ...msg,
          icon: this.getMessageIcon(msg.type).icon,
          color: this.getMessageIcon(msg.type).color,
          originalCreateTime: msg.createTime,
          createTime: this.formatMessageTime(msg.createTime),
          timestamp: new Date(msg.createTime).getTime()
        }));
        allMessages = [...allMessages, ...systemMessages];
        hasMore = hasMore || false;
      }

      if (messagesRes.result && messagesRes.result.success && messagesRes.result.data && Array.isArray(messagesRes.result.data)) {
        const personalMessages = messagesRes.result.data.map(msg => ({
          ...msg,
          icon: this.getMessageIcon(msg.subType || msg.type).icon,
          color: this.getMessageIcon(msg.subType || msg.type).color,
          originalCreateTime: msg.createTime,
          createTime: this.formatMessageTime(msg.createTime),
          timestamp: new Date(msg.createTime).getTime()
        }));
        allMessages = [...allMessages, ...personalMessages];
        hasMore = hasMore || false;
      }

      allMessages.sort((a, b) => b.timestamp - a.timestamp);

      // 转换云存储头像 URL
      this.convertAvatars(allMessages).then(convertedMessages => {
        const updatedMessages = page === 1 ? convertedMessages : [...this.data.messages, ...convertedMessages];

        this.setData({
          messages: updatedMessages,
          isLoading: false,
          isLoadingMore: false,
          isRefreshing: false,
          hasMore: hasMore,
          page: page + 1,
          _isLoadingData: false
        });

        // 使用云端 count 查询的真实未读数，不依赖本地列表统计
        let systemUnreadCount = 0;
        let personalUnreadCount = 0;

        if (noticesCountRes.result && noticesCountRes.result.success) {
          systemUnreadCount = noticesCountRes.result.data.unreadCount || 0;
        }
        if (messagesCountRes.result && messagesCountRes.result.success) {
          personalUnreadCount = messagesCountRes.result.data.unreadCount || 0;
        }

        const totalUnreadCount = systemUnreadCount + personalUnreadCount;

        this.setData({
          unreadCount: totalUnreadCount,
          systemUnreadCount: systemUnreadCount,
          personalUnreadCount: personalUnreadCount
        });

        this.updateFilteredMessages();
      });
    }).catch(err => {
      console.error('加载消息失败:', err);
      this.setData({
        isLoading: false,
        isLoadingMore: false,
        isRefreshing: false,
        _isLoadingData: false
      });
      wx.showToast({
        title: '加载失败，请重试',
        icon: 'none'
      });
    });
  },

  // 批量转换头像 URL（通过云函数管理员权限）
  convertAvatars: function(messages) {
    return new Promise((resolve) => {
      const cloudUrls = new Set();
      // cloudUrl -> [{msg, userField}]
      const urlLocations = new Map();

      // 收集所有需要转换的云存储 URL（fromUser 和 toUser，avatar 和 avatarUrl）
      messages.forEach(msg => {
        ['fromUser', 'toUser'].forEach(userField => {
          let user = msg[userField];
          if (!user) return;

          if (typeof user === 'string') {
            try {
              user = JSON.parse(user);
            } catch (e) {
              return;
            }
          }
          if (!user || typeof user !== 'object') return;

          ['avatar', 'avatarUrl'].forEach(key => {
            const url = user[key];
            if (url && typeof url === 'string' && url.includes('cloud://')) {
              cloudUrls.add(url);
              if (!urlLocations.has(url)) {
                urlLocations.set(url, []);
              }
              urlLocations.get(url).push({ msg, userField });
            }
          });
        });
      });

      if (cloudUrls.size === 0) {
        resolve(messages);
        return;
      }

      console.log('准备转换头像 URL，共', cloudUrls.size, '个');

      // 通过云函数批量转换 URL（管理员权限可访问所有文件）
      wx.cloud.callFunction({
        name: 'getTempImageUrl',
        data: { fileList: Array.from(cloudUrls) },
        success: (res) => {
          if (res.result && res.result.success && res.result.fileList) {
            res.result.fileList.forEach(item => {
              if (item.status === 0 && item.tempFileURL) {
                console.log('头像转换成功:', item.fileID, '->', item.tempFileURL);
                const locations = urlLocations.get(item.fileID);
                if (locations) {
                  locations.forEach(({ msg, userField }) => {
                    if (typeof msg[userField] === 'string') {
                      try {
                        const user = JSON.parse(msg[userField]);
                        user.avatar = item.tempFileURL;
                        user.avatarUrl = item.tempFileURL;
                        msg[userField] = user;
                      } catch (e) {
                        // ignore
                      }
                    } else if (typeof msg[userField] === 'object') {
                      msg[userField].avatar = item.tempFileURL;
                      msg[userField].avatarUrl = item.tempFileURL;
                    }
                  });
                }
              } else {
                console.warn('头像转换失败:', item.fileID, item.status, item.errMsg);
              }
            });
          }
          resolve(messages);
        },
        fail: (err) => {
          console.error('批量转换头像 URL 失败:', err);
          resolve(messages);
        }
      });
    });
  },

  
  // 加载未读消息（限制10条以内）
  loadUnreadMessages: function() {
    console.log('加载未读消息（限制10条）');

    const app = getApp();
    const currentOpenid = app.globalData.openid || app.globalData.userInfo?.openid || '';

    Promise.all([
      wx.cloud.callFunction({
        name: 'getNotices',
        data: { type: 'unread', page: 1, pageSize: 10, openid: currentOpenid }
      }),
      wx.cloud.callFunction({
        name: 'getMessages',
        data: { type: 'unread', page: 1, pageSize: 10, openid: currentOpenid }
      })
    ]).then(results => {
      const [noticesRes, messagesRes] = results;
      
      let allMessages = [];
      
      if (noticesRes.result && noticesRes.result.success && noticesRes.result.data && Array.isArray(noticesRes.result.data)) {
        const systemMessages = noticesRes.result.data.map(msg => ({
          ...msg,
          icon: this.getMessageIcon(msg.type).icon,
          color: this.getMessageIcon(msg.type).color,
          originalCreateTime: msg.createTime,
          createTime: this.formatMessageTime(msg.createTime),
          timestamp: new Date(msg.createTime).getTime()
        }));
        allMessages = [...allMessages, ...systemMessages];
      }
      
      if (messagesRes.result && messagesRes.result.success && messagesRes.result.data && Array.isArray(messagesRes.result.data)) {
        const personalMessages = messagesRes.result.data.map(msg => ({
          ...msg,
          icon: this.getMessageIcon(msg.subType || msg.type).icon,
          color: this.getMessageIcon(msg.subType || msg.type).color,
          originalCreateTime: msg.createTime,
          createTime: this.formatMessageTime(msg.createTime),
          timestamp: new Date(msg.createTime).getTime()
        }));
        allMessages = [...allMessages, ...personalMessages];
      }
      
      allMessages.sort((a, b) => b.timestamp - a.timestamp);
      
      this.setData({
        messages: allMessages,
        isLoading: false,
        isLoadingMore: false,
        isRefreshing: false,
        hasMore: allMessages.length >= 10,
        page: 2
      });
      
      this.checkUnreadCount();
      this.updateFilteredMessages();
    }).catch(err => {
      console.error('加载未读消息失败:', err);
      this.setData({ 
        isLoading: false,
        isLoadingMore: false,
        isRefreshing: false
      });
      wx.showToast({
        title: '加载失败，请重试',
        icon: 'none'
      });
    });
  },
  
  // 获取消息图标和颜色
  getMessageIcon: function(type) {
    const iconMap = {
      publish: { icon: '📤', color: '#2196F3' },
      delete: { icon: '🗑️', color: '#F44336' },
      system: { icon: '🔔', color: '#00BCD4' },
      announcement: { icon: '📢', color: '#2196F3' },
      report: { icon: '🚨', color: '#FF9800' },
      content_deleted: { icon: '🚫', color: '#F44336' },
      order: { icon: '💰', color: '#4CAF50' },
      like: { icon: '❤️', color: '#F44336' },
      collect: { icon: '⭐', color: '#FFD700' },
      chat: { icon: '💬', color: '#9C27B0' },
      purchase: { icon: '🛒', color: '#4CAF50' },
      favorite: { icon: '❤️', color: '#F44336' },
      comment: { icon: '💬', color: '#9C27B0' },
      default: { icon: '🔔', color: '#2196F3' }
    };
    
    return iconMap[type] || iconMap.default;
  },
  
  // 格式化消息时间
  formatMessageTime: function(createTime) {
    if (!createTime) return '刚刚';
    
    const createTimeObj = new Date(createTime);
    const now = new Date();
    const diffMs = now - createTimeObj;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 7) return `${diffDays}天前`;
    return createTimeObj.toLocaleDateString();
  },

  // 刷新消息：加载所有消息（包括已读和未读）
  refreshMessages: function() {
    this.setData({ 
      isRefreshing: true,
      page: 1,
      hasMore: true
    });
    // 不再调用loadMessages(true)来加载未读消息，而是加载所有消息
    this.loadMessages(false);
  },
  
  // 加载更多消息
  loadMoreMessages: function() {
    if (this.data.isLoadingMore || !this.data.hasMore) return;
    this.loadMessages(false);
  },

  // 检查未读消息数（从云端获取真实未读数，不依赖本地列表统计）
  checkUnreadCount: function() {
    const app = getApp();
    const currentOpenid = app.globalData.openid || app.globalData.userInfo?.openid || '';

    if (!currentOpenid) return;

    Promise.all([
      wx.cloud.callFunction({
        name: 'getNotices',
        data: { type: 'unread_count', openid: currentOpenid }
      }),
      wx.cloud.callFunction({
        name: 'getMessages',
        data: { type: 'unread_count' }
      })
    ]).then(([noticesRes, messagesRes]) => {
      let systemUnreadCount = 0;
      let personalUnreadCount = 0;

      if (noticesRes.result && noticesRes.result.success) {
        systemUnreadCount = noticesRes.result.data.unreadCount || 0;
      }
      if (messagesRes.result && messagesRes.result.success) {
        personalUnreadCount = messagesRes.result.data.unreadCount || 0;
      }

      const totalUnreadCount = systemUnreadCount + personalUnreadCount;

      this.setData({
        unreadCount: totalUnreadCount,
        systemUnreadCount: systemUnreadCount,
        personalUnreadCount: personalUnreadCount
      });

      const app = getApp();
      if (app && app.globalData) {
        app.globalData.unreadMessageCount = totalUnreadCount;
      }
      this.updateTabBarBadge();
    }).catch(err => {
      console.error('获取未读消息数失败:', err);
    });
  },

  // 注册 app.js 的全局消息监听回调
  _registerGlobalWatcher: function() {
    const app = getApp();
    const that = this;

    this._globalWatcher = function(unreadCount) {
      console.log('🔔 收到全局新消息通知，未读数:', unreadCount);
      if (typeof unreadCount === 'number' && unreadCount > 0) {
        that.setData({ unreadCount: unreadCount });
        that.updateTabBarBadge();
        // 收到新消息通知，刷新消息列表
        that._debouncedRefresh();
      }
    };

    app.registerMessageWatcher(this._globalWatcher);
  },

  // 移除 app.js 全局监听回调
  _unregisterGlobalWatcher: function() {
    const app = getApp();
    if (this._globalWatcher) {
      app.unregisterMessageWatcher(this._globalWatcher);
      this._globalWatcher = null;
    }
  },

  // 启动数据库实时监听（watch）
  startRealtimeWatchers: function() {
    if (this.data._noticesWatcher || this.data._messagesWatcher) return;

    const app = getApp();
    const currentOpenid = app.globalData.openid || app.globalData.userInfo?.openid || '';
    if (!currentOpenid) return;

    // 监听 notices 表变化
    try {
      const db = wx.cloud.database();
      this.data._noticesWatcher = db.collection('notices')
        .where({ _openid: currentOpenid })
        .orderBy('createTime', 'desc')
        .limit(1)
        .watch({
          onChange: (snapshot) => {
            console.log('🔔 notices 实时监听变化:', snapshot.type);
            if (snapshot.type === 'init') {
              // 初始化完成
              return;
            }
            // 有新变化时，刷新消息列表和未读计数
            this._debouncedRefresh();
          },
          onError: (err) => {
            console.error('notices 实时监听出错:', err);
          }
        });
      console.log('📡 notices 实时监听已启动');
    } catch (err) {
      console.error('启动 notices 实时监听失败:', err);
    }

    // 监听 messages 表变化
    try {
      const db = wx.cloud.database();
      this.data._messagesWatcher = db.collection('messages')
        .where({
          chatuser: currentOpenid,
          isRead: false
        })
        .orderBy('createTime', 'desc')
        .limit(1)
        .watch({
          onChange: (snapshot) => {
            console.log('💬 messages 实时监听变化:', snapshot.type);
            if (snapshot.type === 'init') {
              return;
            }
            this._debouncedRefresh();
          },
          onError: (err) => {
            console.error('messages 实时监听出错:', err);
          }
        });
      console.log('📡 messages 实时监听已启动');
    } catch (err) {
      console.error('启动 messages 实时监听失败:', err);
    }
  },

  // 关闭实时监听器
  closeRealtimeWatchers: function() {
    if (this.data._noticesWatcher) {
      try {
        this.data._noticesWatcher.close();
      } catch (e) {
        // ignore
      }
      this.data._noticesWatcher = null;
    }
    if (this.data._messagesWatcher) {
      try {
        this.data._messagesWatcher.close();
      } catch (e) {
        // ignore
      }
      this.data._messagesWatcher = null;
    }
    console.log('📡 实时监听器已关闭');
  },

  // 防抖刷新（避免短时间内多次触发）
  _debouncedRefresh: function() {
    if (this._refreshTimer) {
      clearTimeout(this._refreshTimer);
    }
    this._refreshTimer = setTimeout(() => {
      this._refreshTimer = null;
      console.log('🔄 实时监听触发刷新');
      // 先刷新未读计数
      this.checkUnreadCount();
      // 刷新消息列表（保留已有数据，新数据插入顶部）
      this._refreshNewMessages();
    }, 1500);
  },

  // 刷新新消息（增量更新，不重新加载整个列表）
  _refreshNewMessages: function() {
    if (this.data._isLoadingData) return;

    const app = getApp();
    const currentOpenid = app.globalData.openid || app.globalData.userInfo?.openid || '';

    Promise.all([
      wx.cloud.callFunction({
        name: 'getNotices',
        data: { page: 1, pageSize: 5, openid: currentOpenid }
      }),
      wx.cloud.callFunction({
        name: 'getMessages',
        data: { type: 'personal', page: 1, pageSize: 5, openid: currentOpenid }
      })
    ]).then(([noticesRes, messagesRes]) => {
      let newMessages = [];

      if (noticesRes.result?.success && Array.isArray(noticesRes.result.data)) {
        noticesRes.result.data.forEach(msg => {
          const exists = this.data.messages.find(m => m._id === msg._id);
          if (!exists) {
            newMessages.push({
              ...msg,
              icon: this.getMessageIcon(msg.type).icon,
              color: this.getMessageIcon(msg.type).color,
              originalCreateTime: msg.createTime,
              createTime: this.formatMessageTime(msg.createTime),
              timestamp: new Date(msg.createTime).getTime()
            });
          }
        });
      }

      if (messagesRes.result?.success && Array.isArray(messagesRes.result.data)) {
        messagesRes.result.data.forEach(msg => {
          const exists = this.data.messages.find(m => m._id === msg._id);
          if (!exists) {
            newMessages.push({
              ...msg,
              icon: this.getMessageIcon(msg.subType || msg.type).icon,
              color: this.getMessageIcon(msg.subType || msg.type).color,
              originalCreateTime: msg.createTime,
              createTime: this.formatMessageTime(msg.createTime),
              timestamp: new Date(msg.createTime).getTime()
            });
          }
        });
      }

      if (newMessages.length > 0) {
        // 转换头像后插入列表顶部
        this.convertAvatars(newMessages).then(converted => {
          const updatedMessages = [...converted, ...this.data.messages];
          this.setData({ messages: updatedMessages });
          this.checkUnreadCount();
          this.updateFilteredMessages();

          console.log('📨 收到', newMessages.length, '条新消息');
        });
      }
    }).catch(err => {
      console.error('刷新新消息失败:', err);
    });
  },

  // 更新 Tab 栏红点
  updateTabBarBadge: function() {
    // 优先使用页面自身的统计数，不依赖可能被污染的 globalData
    const unreadCount = this.data.unreadCount;
    const app = getApp();
    
    // 同步到 globalData 供其他页面使用
    if (app && app.globalData) {
      app.globalData.unreadMessageCount = unreadCount;
    }
    
    if (unreadCount > 0) {
      wx.setTabBarBadge({
        index: 2,
        text: unreadCount > 99 ? '99+' : unreadCount.toString()
      });
    } else {
      wx.removeTabBarBadge({
        index: 2
      });
    }
  },

  // 更新过滤后的消息
  updateFilteredMessages: function() {
    const { messages, activeTab } = this.data;
    let filteredMessages = [];

    if (activeTab === 'system') {
      // 系统消息：显示所有消息（包括已读），但只显示前10条
      filteredMessages = messages
        .filter(msg => msg.type !== 'personal')
        .map(msg => ({
          ...msg,
          fromUser: msg.fromUser || { id: 'system', nickname: '系统', avatarUrl: '/images/default-avatar.png' }
        }))
        .slice(0, 10); // 只取前10条
    } else if (activeTab === 'personal') {
      const personalMessages = messages.filter(msg => msg.type === 'personal');
      filteredMessages = this.groupPersonalMessages(personalMessages);
    } else {
      filteredMessages = messages
        .filter(msg => msg.type !== 'personal')
        .map(msg => ({
          ...msg,
          fromUser: msg.fromUser || { id: 'system', nickname: '系统', avatarUrl: '' }
        }));
    }

    this.setData({ filteredMessages });
  },

  // 对个人消息按发送者分组
  groupPersonalMessages: function(personalMessages) {
    const groupedMessages = {};
    const app = getApp();
    const currentOpenid = app.globalData.userInfo && app.globalData.userInfo.openid ? app.globalData.userInfo.openid : app.globalData.openid || '';
    
    personalMessages.forEach(msg => {
      let otherUser = {};
      let otherOpenid = '';
      
      if (msg.chatuser && Array.isArray(msg.chatuser) && msg.chatuser.length === 2) {
        otherOpenid = msg.chatuser.find(id => id !== currentOpenid);
        
        if (!otherOpenid) {
          const chatuserSorted = [...msg.chatuser].sort();
          otherOpenid = chatuserSorted[0] === currentOpenid ? chatuserSorted[1] : chatuserSorted[0];
        }
        
        if (otherOpenid) {
          let fromUserInfo = {};
          if (msg.fromUser) {
            if (typeof msg.fromUser === 'string') {
              try {
                fromUserInfo = JSON.parse(msg.fromUser);
              } catch (e) {
                fromUserInfo = {};
              }
            } else if (typeof msg.fromUser === 'object' && msg.fromUser !== null) {
              fromUserInfo = msg.fromUser;
            }
          }
          
          let toUserInfo = {};
          if (msg.toUser) {
            if (typeof msg.toUser === 'string') {
              try {
                toUserInfo = JSON.parse(msg.toUser);
              } catch (e) {
                toUserInfo = {};
              }
            } else if (typeof msg.toUser === 'object' && msg.toUser !== null) {
              toUserInfo = msg.toUser;
            }
          }
          
          let otherUserInfo = {};
          
          if (fromUserInfo.openid === otherOpenid) {
            otherUserInfo = fromUserInfo;
          } else if (toUserInfo.openid === otherOpenid) {
            otherUserInfo = toUserInfo;
          } else if (fromUserInfo.id === otherOpenid) {
            otherUserInfo = fromUserInfo;
          } else if (toUserInfo.id === otherOpenid) {
            otherUserInfo = toUserInfo;
          } else {
            if (fromUserInfo.openid || fromUserInfo.id) {
              const fromUserOpenid = fromUserInfo.openid || fromUserInfo.id;
              if (fromUserOpenid !== currentOpenid) {
                otherUserInfo = fromUserInfo;
              } else if (toUserInfo.openid || toUserInfo.id) {
                otherUserInfo = toUserInfo;
              }
            } else {
              otherUserInfo = {};
            }
          }
          
          otherUser = {
            id: otherOpenid,
            nickname: otherUserInfo.nickname || otherUserInfo.name || '用户',
            avatar: otherUserInfo.avatar || otherUserInfo.avatarUrl || 'https://via.placeholder.com/100x100/07c160/ffffff?text=用户',
            avatarUrl: otherUserInfo.avatar || otherUserInfo.avatarUrl || 'https://via.placeholder.com/100x100/07c160/ffffff?text=用户'
          };
        } else {
          otherUser = {
            id: 'unknown',
            nickname: '用户',
            avatar: 'https://via.placeholder.com/100x100/07c160/ffffff?text=用户',
            avatarUrl: 'https://via.placeholder.com/100x100/07c160/ffffff?text=用户'
          };
        }
      } else {
        let fromUser = msg.fromUser;
        
        if (typeof fromUser === 'string') {
          try {
            fromUser = JSON.parse(fromUser);
          } catch (e) {
            fromUser = {
              id: msg.fromUser,
              nickname: '用户',
              avatar: ''
            };
          }
        } else if (typeof fromUser !== 'object' || fromUser === null) {
          fromUser = {
            id: 'unknown',
            nickname: '用户',
            avatar: 'https://via.placeholder.com/100x100/07c160/ffffff?text=用户',
            avatarUrl: 'https://via.placeholder.com/100x100/07c160/ffffff?text=用户'
          };
        }
        
        otherUser = {
          id: fromUser.id || fromUser.openid || 'unknown',
          nickname: fromUser.nickname || fromUser.name || '用户',
          avatar: fromUser.avatar || fromUser.avatarUrl || 'https://via.placeholder.com/100x100/07c160/ffffff?text=用户',
          avatarUrl: fromUser.avatar || fromUser.avatarUrl || 'https://via.placeholder.com/100x100/07c160/ffffff?text=用户'
        };
        
        otherOpenid = fromUser.id || fromUser.openid || '';
      }
      
      const avatarUrl = otherUser.avatar || otherUser.avatarUrl || '';
      if (!avatarUrl || avatarUrl === '') {
        otherUser.avatar = '/images/default-avatar.png';
        otherUser.avatarUrl = '/images/default-avatar.png';
      }
      
      const userId = otherUser.id || otherUser.openid || 'unknown';
      
      if (!groupedMessages[userId]) {
        groupedMessages[userId] = {
          userId: userId,
          fromUser: otherUser,
          otherOpenid: otherOpenid,
          messages: [],
          unreadCount: 0,
          latestMessageTime: 0
        };
      }
      
      groupedMessages[userId].messages.push(msg);
      if (!msg.isRead) {
        groupedMessages[userId].unreadCount++;
      }
      
      let msgTime = 0;
      if (msg.timestamp) {
        msgTime = msg.timestamp;
      } else if (msg.originalCreateTime) {
        try {
          msgTime = new Date(msg.originalCreateTime).getTime();
        } catch (e) {
          msgTime = new Date().getTime();
        }
      } else if (msg.createTime) {
        try {
          msgTime = new Date(msg.createTime).getTime();
        } catch (e) {
          msgTime = new Date().getTime();
        }
      } else {
        msgTime = new Date().getTime();
      }
      if (msgTime > groupedMessages[userId].latestMessageTime) {
        groupedMessages[userId].latestMessageTime = msgTime;
      }
    });
    
    const chatGroups = Object.values(groupedMessages).map(group => {
      group.messages.sort((a, b) => new Date(b.createTime) - new Date(a.createTime));
      
      const latestMessage = group.messages[0];
      
      let createTime;
      try {
        createTime = new Date(latestMessage.createTime);
        if (isNaN(createTime.getTime())) {
          createTime = new Date();
        }
      } catch (e) {
        createTime = new Date();
      }
      const now = new Date();
      const diffMs = now - createTime;
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      let timeStr;
      if (diffMins < 1) {
        timeStr = '刚刚';
      } else if (diffMins < 60) {
        timeStr = `${diffMins}分钟前`;
      } else if (diffHours < 24) {
        timeStr = `${diffHours}小时前`;
      } else if (diffDays < 7) {
        timeStr = `${diffDays}天前`;
      } else {
        timeStr = createTime.toLocaleDateString();
      }
      
      return {
        ...group,
        latestMessage: latestMessage,
        latestMessageContent: latestMessage.content || latestMessage.title || '',
        latestMessageTime: timeStr,
        latestMessageTimestamp: group.latestMessageTime,
        hasUnread: group.unreadCount > 0,
        unreadCount: group.unreadCount,
        otherOpenid: group.otherOpenid
      };
    }).sort((a, b) => b.latestMessageTimestamp - a.latestMessageTimestamp);

    return this.groupByTime(chatGroups);
  },
  
  // 按时间分组
  groupByTime: function(chatGroups) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterday = today - 24 * 60 * 60 * 1000;
    const weekAgo = today - 7 * 24 * 60 * 60 * 1000;
    
    const groupedByTime = {
      today: [],
      yesterday: [],
      week: [],
      earlier: []
    };
    
    chatGroups.forEach(chat => {
      let messageTime = chat.latestMessageTimestamp || 0;
      
      if (typeof messageTime !== 'number' || isNaN(messageTime)) {
        if (chat.latestMessage && chat.latestMessage.createTime) {
          try {
            messageTime = new Date(chat.latestMessage.createTime).getTime();
          } catch (e) {
            messageTime = now.getTime();
          }
        } else {
          messageTime = now.getTime();
        }
      }
      
      if (messageTime >= today) {
        groupedByTime.today.push(chat);
      } else if (messageTime >= yesterday) {
        groupedByTime.yesterday.push(chat);
      } else if (messageTime >= weekAgo) {
        groupedByTime.week.push(chat);
      } else {
        groupedByTime.earlier.push(chat);
      }
    });
    
    const result = [];
    if (groupedByTime.today.length > 0) {
      result.push({ type: 'section', title: '今天', data: groupedByTime.today });
    }
    if (groupedByTime.yesterday.length > 0) {
      result.push({ type: 'section', title: '昨天', data: groupedByTime.yesterday });
    }
    if (groupedByTime.week.length > 0) {
      result.push({ type: 'section', title: '最近7天', data: groupedByTime.week });
    }
    if (groupedByTime.earlier.length > 0) {
      result.push({ type: 'section', title: '更早', data: groupedByTime.earlier });
    }
    
    return result;
  },

  // 切换标签
  switchTab: function(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
    this.updateFilteredMessages();
  },

  // 标记为已读
  markAsRead: function(e) {
    const id = e.currentTarget.dataset.id;
    // 根据消息类型确定collection，而不是根据activeTab
    const message = this.data.messages.find(msg => msg._id === id);
    const collection = (message && message.type === 'personal') ? 'messages' : 'notices';
    
    console.log('标记已读 - messageId:', id, 'collection:', collection, 'message type:', message?.type);
    
    wx.cloud.callFunction({
      name: 'markMessageAsRead',
      data: { messageId: id, collection: collection },
      success: (res) => {
        if (res.result.success) {
          const messages = this.data.messages;
          const updatedMessages = messages.map(msg => 
            msg._id === id ? { ...msg, isRead: true } : msg
          );
          
          this.setData({ messages: updatedMessages });
          this.checkUnreadCount();
          this.updateFilteredMessages();
          
          wx.showToast({ 
            title: '已标记为已读', 
            icon: 'success',
            duration: 1000
          });
        } else {
          console.error('标记消息为已读失败:', res.result.message);
          wx.showToast({
            title: '标记失败，请重试',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        console.error('调用云函数失败:', err);
        wx.showToast({
          title: '网络错误，请重试',
          icon: 'none'
        });
      }
    });
  },

  // 标记所有为已读（从云端标记 notices 和 messages 中所有未读消息）
  markAllAsRead: function() {
    // 先从云端检查是否有未读消息
    const app = getApp();
    const currentOpenid = app.globalData.openid || app.globalData.userInfo?.openid || '';

    wx.showLoading({ title: '处理中...', mask: true });

    // 调用 markAllAsRead 云函数批量标记
    wx.cloud.callFunction({
      name: 'markMessageAsRead',
      data: { type: 'mark_all_as_read', openid: currentOpenid }
    }).then(res => {
      wx.hideLoading();

      if (res.result && res.result.success) {
        // 更新本地列表所有消息为已读
        const messages = this.data.messages.map(msg => ({ ...msg, isRead: true }));
        this.setData({ messages });
        this.checkUnreadCount();
        this.updateFilteredMessages();

        wx.showToast({
          title: '全部已读',
          icon: 'success',
          duration: 1000
        });
      } else {
        wx.showToast({
          title: res.result ? res.result.message : '操作失败',
          icon: 'none'
        });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('标记所有消息为已读失败:', err);
      wx.showToast({
        title: '操作失败，请重试',
        icon: 'none'
      });
    });
  },

  // 清空所有未读消息
  clearMessages: function() {
    const app = getApp();
    const currentOpenid = app.globalData.openid || app.globalData.userInfo?.openid || '';

    wx.showModal({
      title: '确认清空',
      content: '确定要将所有未读消息标记为已读吗？',
      confirmText: '清空',
      confirmColor: '#ff6b6b',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '处理中...', mask: true });

          wx.cloud.callFunction({
            name: 'markMessageAsRead',
            data: { type: 'mark_all_as_read', openid: currentOpenid }
          }).then(res => {
            wx.hideLoading();

            if (res.result && res.result.success) {
              const messages = this.data.messages.map(msg => ({ ...msg, isRead: true }));
              this.setData({ messages });
              this.checkUnreadCount();
              this.updateFilteredMessages();

              wx.showToast({
                title: '全部已读',
                icon: 'success',
                duration: 1000
              });
            } else {
              wx.showToast({
                title: res.result ? res.result.message : '操作失败',
                icon: 'none'
              });
            }
          }).catch(err => {
            wx.hideLoading();
            console.error('清空消息失败:', err);
            wx.showToast({
              title: '操作失败，请重试',
              icon: 'none'
            });
          });
        }
      }
    });
  },

  // 删除消息
  deleteMessage: function(e) {
    const id = e.currentTarget.dataset.id;
    const messages = this.data.messages;
    const messageToDelete = messages.find(msg => msg._id === id);
    
    if (messageToDelete) {
      wx.showModal({
        title: '删除消息',
        content: `确定要删除"${messageToDelete.title}"吗？`,
        confirmText: '删除',
        confirmColor: '#ff6b6b',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            wx.cloud.callFunction({
              name: 'deleteMessage',
              data: { messageId: id },
              success: (res) => {
                if (res.result.success) {
                  const updatedMessages = messages.filter(msg => msg._id !== id);
                  
                  this.setData({ messages: updatedMessages });
                  this.checkUnreadCount();
                  this.updateFilteredMessages();
                  
                  wx.showToast({ 
                    title: '已删除', 
                    icon: 'success',
                    duration: 1000
                  });
                } else {
                  console.error('删除消息失败:', res.result.message);
                  wx.showToast({
                    title: '删除失败，请重试',
                    icon: 'none'
                  });
                }
              },
              fail: (err) => {
                console.error('调用云函数失败:', err);
                wx.showToast({
                  title: '网络错误，请重试',
                  icon: 'none'
                });
              }
            });
          }
        }
      });
    }
  },

  // 长按删除
  onLongPressMessage: function(e) {
    const id = e.currentTarget.dataset.id;
    this.deleteMessage({ currentTarget: { dataset: { id } } });
  },

  // 点击消息
  onMessageTap: function(e) {
    const id = e.currentTarget.dataset.id;
    const message = this.data.messages.find(msg => msg._id === id);
    
    if (message) {
      if (!message.isRead) {
        this.markAsReadSilent(message);
      }
      
      if (this.data.activeTab === 'system') {
        this.showMessageDetail(message);
      } else {
        this.goToChat(message);
      }
    }
  },

  // 静默标记为已读
  markAsReadSilent: function(message) {
    if (!message) return;
    
    const collection = (message && message.type === 'personal') ? 'messages' : 'notices';
    
    wx.cloud.callFunction({
      name: 'markMessageAsRead',
      data: { messageId: message._id, collection: collection },
      success: (res) => {
        if (res.result.success) {
          const messages = this.data.messages;
          const updatedMessages = messages.map(msg => 
            msg._id === message._id ? { ...msg, isRead: true } : msg
          );
          
          this.setData({ messages: updatedMessages });
          this.checkUnreadCount();
          this.updateFilteredMessages();
        }
      },
      fail: (err) => {
        console.error('静默标记已读失败:', err);
      }
    });
  },

  // 显示消息详情弹窗
  showMessageDetail: function(message) {
    if (!message) return;
    
    this.setData({
      selectedMessage: message,
      showMessageDetailDialog: true
    });
  },

  // 关闭消息详情弹窗
  closeMessageDetail: function() {
    this.setData({
      showMessageDetailDialog: false,
      selectedMessage: {}
    });
  },

  // 跳转到相关页面
  goToRelatedPage: function() {
    const message = this.data.selectedMessage;
    if (!message || !message.relatedId || !message.relatedType) {
      console.log('跳转参数缺失:', message);
      wx.showToast({
        title: '跳转信息不完整',
        icon: 'none'
      });
      return;
    }
    
    this.closeMessageDetail();
    
    console.log('跳转参数:', message.relatedType, message.relatedId);
    
    switch(message.relatedType) {
      case 'book':
        wx.navigateTo({
          url: `/pages/book-detail/book-detail?id=${message.relatedId}`,
          fail: (err) => {
            console.error('跳转书籍详情失败:', err);
            wx.showToast({
              title: '页面跳转失败',
              icon: 'none'
            });
          }
        });
        break;
      case 'book_order':
        wx.navigateTo({
          url: `/pages/my-orders/my-orders?category=book`,
          fail: (err) => {
            console.error('跳转书籍订单失败:', err);
            wx.showToast({
              title: '页面跳转失败',
              icon: 'none'
            });
          }
        });
        break;
      case 'material':
        wx.navigateTo({
          url: `/pages/material-detail/material-detail?id=${message.relatedId}`,
          fail: (err) => {
            console.error('跳转资料详情失败:', err);
            wx.showToast({
              title: '页面跳转失败',
              icon: 'none'
            });
          }
        });
        break;
      case 'material_order':
        wx.navigateTo({
          url: `/pages/my-orders/my-orders?category=material`,
          fail: (err) => {
            console.error('跳转资料订单失败:', err);
            wx.showToast({
              title: '页面跳转失败',
              icon: 'none'
            });
          }
        });
        break;
      case 'report':
        // 举报消息，直接跳转到被举报内容详情页
        if (message.reportInfo && message.reportInfo.targetType && message.reportInfo.targetId) {
          this.closeMessageDetail();
          const reportInfo = message.reportInfo;
          let url = '';
          switch(reportInfo.targetType) {
            case 'material':
              url = `/pages/material-detail/material-detail?id=${reportInfo.targetId}`;
              break;
            case 'book':
              url = `/pages/book-detail/book-detail?id=${reportInfo.targetId}`;
              break;
            case 'post':
              url = `/pages/post-detail/post-detail?id=${reportInfo.targetId}`;
              break;
            case 'user':
              url = `/pages/user-center/user-center?id=${reportInfo.targetId}`;
              break;
            default:
              wx.showToast({ title: '未知的内容类型', icon: 'none' });
              return;
          }
          wx.navigateTo({
            url: url,
            fail: (err) => {
              console.error('跳转失败:', err);
              wx.showToast({ title: '页面跳转失败', icon: 'none' });
            }
          });
        } else {
          wx.showToast({ title: '举报信息不完整', icon: 'none' });
        }
        break;
      default:
        console.log('未知的跳转类型:', message.relatedType);
        wx.showToast({
          title: '暂不支持此类型跳转',
          icon: 'none'
        });
        break;
    }
  },

  // 显示举报详情弹窗
  showReportDetail: function(message) {
    if (!message || !message.reportInfo) {
      wx.showToast({
        title: '举报信息不完整',
        icon: 'none'
      });
      return;
    }

    const reportInfo = message.reportInfo;
    const content = `举报类型：${reportInfo.reportType || '未知'}\n` +
                   `被举报内容：${reportInfo.targetInfo?.title || '未知'}\n` +
                   `举报理由：${reportInfo.reason || '无'}\n` +
                   `优先级：${reportInfo.priority || '普通'}`;

    wx.showModal({
      title: '举报详情',
      content: content,
      showCancel: true,
      cancelText: '关闭',
      confirmText: '查看内容',
      confirmColor: '#07c160',
      success: (res) => {
        if (res.confirm) {
          // 跳转到被举报内容详情页
          this.goToReportedContent(reportInfo);
        }
      }
    });
  },

  // 跳转到被举报内容（按钮绑定使用，从selectedMessage中获取reportInfo）
  goToReportedContent: function(e) {
    const message = this.data.selectedMessage;
    if (!message || !message.reportInfo) {
      wx.showToast({
        title: '举报信息不完整',
        icon: 'none'
      });
      return;
    }

    const reportInfo = message.reportInfo;
    const targetType = reportInfo.targetType;
    const targetId = reportInfo.targetId;

    if (!targetType || !targetId) {
      wx.showToast({
        title: '举报信息不完整',
        icon: 'none'
      });
      return;
    }

    let url = '';

    switch(targetType) {
      case 'material':
        url = `/pages/material-detail/material-detail?id=${targetId}`;
        break;
      case 'book':
        url = `/pages/book-detail/book-detail?id=${targetId}`;
        break;
      case 'post':
        url = `/pages/post-detail/post-detail?id=${targetId}`;
        break;
      case 'user':
        url = `/pages/user-center/user-center?id=${targetId}`;
        break;
      default:
        wx.showToast({
          title: '未知的内容类型',
          icon: 'none'
        });
        return;
    }

    this.closeMessageDetail();

    wx.navigateTo({
      url: url,
      fail: (err) => {
        console.error('跳转失败:', err);
        wx.showToast({
          title: '页面跳转失败',
          icon: 'none'
        });
      }
    });
  },

  // 删除举报内容（管理员功能）
  deleteReportedContent: function() {
    const message = this.data.selectedMessage;
    if (!message || !message.reportInfo) {
      wx.showToast({
        title: '举报信息不完整',
        icon: 'none'
      });
      return;
    }

    const reportInfo = message.reportInfo;
    const { reportId, targetType, targetId } = reportInfo;

    if (!reportId || !targetType || !targetId) {
      wx.showToast({
        title: '缺少必要参数',
        icon: 'none'
      });
      return;
    }

    wx.showModal({
      title: '确认删除',
      content: `确定要删除此${targetType === 'material' ? '资料' : targetType === 'book' ? '书籍' : targetType === 'post' ? '帖子' : '内容'}吗？\n删除后不可恢复！`,
      confirmText: '确认删除',
      confirmColor: '#ff6b6b',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          this.doDeleteReportedContent(reportId, targetType, targetId);
        }
      }
    });
  },

  // 执行删除举报内容
  doDeleteReportedContent: function(reportId, targetType, targetId) {
    wx.showLoading({
      title: '删除中...',
      mask: true
    });

    wx.cloud.callFunction({
      name: 'deleteReportedContent',
      data: {
        reportId: reportId,
        targetType: targetType,
        targetId: targetId,
        deleteReason: '管理员删除违规内容'
      },
      success: (res) => {
        wx.hideLoading();

        if (res.result && res.result.success) {
          // 更新本地消息中该举报的状态（让弹窗立即显示"已删除"）
          const message = this.data.selectedMessage;
          if (message && message.reportInfo) {
            const updatedReportInfo = {
              ...message.reportInfo,
              targetInfo: {
                ...message.reportInfo.targetInfo,
                status: 'deleted'
              }
            };
            const updatedMessages = this.data.messages.map(msg =>
              msg._id === message._id
                ? { ...msg, reportInfo: updatedReportInfo }
                : msg
            );
            this.setData({
              selectedMessage: {
                ...message,
                reportInfo: updatedReportInfo
              },
              messages: updatedMessages
            });
          }

          wx.showToast({
            title: '删除成功',
            icon: 'success',
            duration: 2000
          });

          // 延迟关闭弹窗并刷新消息列表
          setTimeout(() => {
            this.closeMessageDetail();
            this.refreshMessages();
          }, 1500);
        } else {
          wx.showToast({
            title: res.result ? res.result.message : '删除失败',
            icon: 'none',
            duration: 2000
          });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('调用删除云函数失败:', err);
        wx.showToast({
          title: '网络错误，请重试',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },

  // 跳转到聊天页面
  goToChat: function(message) {
    if (!message) {
      wx.showToast({
        title: '消息信息不完整',
        icon: 'error',
        duration: 1500
      });
      return;
    }
    
    const app = getApp();
    if (!app.globalData.isLoggedIn) {
      if (app.globalData.isTesting || app.globalData.debugMode) {
        console.log('测试模式：跳过登录检查，直接跳转到聊天页面');
      } else {
        wx.showModal({
          title: '提示',
          content: '请先登录',
          confirmText: '去登录',
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
    }
    
    let targetOpenid = message.otherOpenid;
    let targetUser = {};
    
    if (!targetOpenid && message.chatuser && Array.isArray(message.chatuser)) {
      const currentOpenid = app.globalData.userInfo && app.globalData.userInfo.openid ? app.globalData.userInfo.openid : app.globalData.openid || '';
      targetOpenid = message.chatuser.find(id => id !== currentOpenid);
    }
    
    let fromUser = message.fromUser;
    let toUser = message.toUser;
    
    if (typeof fromUser === 'string') {
      try {
        fromUser = JSON.parse(fromUser);
      } catch (e) {
        fromUser = {
          id: message.fromUser,
          nickname: message.title || message.content || '用户',
          avatar: ''
        };
      }
    }
    
    if (typeof toUser === 'string') {
      try {
        toUser = JSON.parse(toUser);
      } catch (e) {
        toUser = {};
      }
    }
    
    if (targetOpenid) {
      if ((fromUser && (fromUser.openid === targetOpenid || fromUser.id === targetOpenid))) {
        targetUser = fromUser;
      } else if (toUser && (toUser.openid === targetOpenid || toUser.id === targetOpenid)) {
        targetUser = toUser;
      } else {
        targetUser = fromUser || {};
      }
    } else {
      targetUser = fromUser || {};
      targetOpenid = targetUser.openid || targetUser.id || message.fromUser || '';
    }
    
    const finalTargetUser = {
      id: targetOpenid || targetUser.id || targetUser.openid || 'unknown',
      nickname: targetUser.nickname || targetUser.name || message.title || message.content || '用户',
      avatar: targetUser.avatar || targetUser.avatarUrl || ''
    };
    
    console.log('goToChat - 最终用户信息:', {
      targetOpenid: finalTargetUser.id,
      targetUser: finalTargetUser
    });
    
    wx.navigateTo({
      url: `/pages/chat/chat?userId=${finalTargetUser.id}&nickname=${encodeURIComponent(finalTargetUser.nickname)}&avatar=${encodeURIComponent(finalTargetUser.avatar)}&openid=${finalTargetUser.id}`
    });
  },

  // 点击用户信息
  onUserInfoTap: function(e) {
    const user = e.currentTarget.dataset.user;
    if (user) {
      this.setData({ 
        selectedUserInfo: user,
        showUserInfoDialog: true 
      });
    }
  },

  // 关闭用户信息对话框
  onUserInfoDialogClose: function() {
    this.setData({ showUserInfoDialog: false });
  },

  // 点击聊天卡片
  onChatTap: function(e) {
    const userId = e.currentTarget.dataset.userid;
    const fromUser = e.currentTarget.dataset.fromuser;
    const otherOpenid = e.currentTarget.dataset.otheropenid;
    const latestMessage = e.currentTarget.dataset.latestmessage;
    
    console.log('onChatTap - userId:', userId);
    console.log('onChatTap - otherOpenid:', otherOpenid);
    console.log('onChatTap - fromUser:', fromUser);
    
    if (fromUser) {
      this.markChatAsReadSilent(userId);
      
      const message = {
        fromUser: fromUser,
        otherOpenid: otherOpenid,
        latestMessage: latestMessage,
        title: fromUser.nickname || fromUser.name || '用户',
        content: latestMessage ? (latestMessage.content || latestMessage.title || '') : ''
      };
      
      this.goToChat(message);
    }
  },
  
  // 静默标记聊天消息为已读
  markChatAsReadSilent: function(userId) {
    if (!userId) return;
    
    const unreadMessages = this.data.messages.filter(msg => 
      msg.type === 'personal' && 
      !msg.isRead && 
      ((msg.fromUser && (msg.fromUser.id === userId || msg.fromUser.openid === userId)) ||
       (msg.toUser && (msg.toUser.id === userId || msg.toUser.openid === userId)))
    );
    
    if (unreadMessages.length === 0) return;
    
    const markPromises = unreadMessages.map(msg => {
      return new Promise((resolve, reject) => {
        wx.cloud.callFunction({
          name: 'markMessageAsRead',
          data: { messageId: msg._id, collection: 'messages' },
          success: (res) => resolve(res),
          fail: (err) => reject(err)
        });
      });
    });
    
    Promise.all(markPromises)
      .then(results => {
        const messages = this.data.messages.map(msg => {
          const isUnread = unreadMessages.find(m => m._id === msg._id);
          if (isUnread) {
            return { ...msg, isRead: true };
          }
          return msg;
        });
        
        this.setData({ messages });
        this.checkUnreadCount();
        this.updateFilteredMessages();
        
        console.log('聊天消息已静默标记为已读:', unreadMessages.length, '条');
      })
      .catch(err => {
        console.error('静默标记聊天消息失败:', err);
      });
  },
  
  // 跳转到登录页面
  goToLogin: function() {
    wx.navigateTo({
      url: '../login/login'
    });
  }
});
