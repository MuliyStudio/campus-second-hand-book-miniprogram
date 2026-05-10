// pages/chat/chat.js
Page({
  data: {
    // 接收方信息
    receiver: {
      id: '',
      avatar: '',
      openid: '' // 接收方的openid
    },
    
    // 发送方信息
    sender: {
      id: '',
      nickname: '我',
      avatar: '',
      openid: '' // 发送方的openid
    },
    
    // 消息列表
    messages: [],
    
    // 输入框值
    inputValue: '',
    
    // 自动聚焦
    autoFocus: false,
    
    // 滚动位置
    scrollTop: 0,
    scrollToId: '',
    
    // 是否显示今天分隔线
    showTodayDivider: true,
    
    // 消息ID计数
    messageId: 1,
    
    // 是否显示表情面板
    showEmojiPanel: false,
    
    // 是否显示更多选项面板
    showMorePanel: false,
    

    
    // 是否正在加载更多消息
    loading: false,
    
    // 是否有更多消息
    hasMore: true,
    
    // 页面是否滚动到底部
    isScrolledToBottom: true,
    
    // 输入框高度
    inputHeight: 0,
    
    // 会话ID
    conversationId: '',
    
    // 分页信息
    page: 1,
    pageSize: 20,
    
    // 网络状态
    networkConnected: true,
    
    // 消息监听
    messageListener: null
  },

  onLoad: function (options) {
    console.log('💬 进入聊天页面，参数:', options);
    
    // 从参数中获取对方信息
    if (options) {
      let avatar = decodeURIComponent(options.avatar || options.avatarUrl || '');
      
      // 处理头像URL，确保使用临时URL
      if (avatar && avatar.includes('cloud://')) {
        this.updateAvatarPermission(avatar).then(tempUrl => {
          if (tempUrl) {
            avatar = tempUrl;
          }
          this.setupReceiver(options, avatar);
        }).catch(() => {
          this.setupReceiver(options, avatar);
        });
      } else {
        this.setupReceiver(options, avatar);
      }
    }
    
    // 设置默认头像
    const defaultSenderAvatar = 'https://via.placeholder.com/100x100/999999/ffffff?text=我';
    if (!this.data.sender.avatar) {
      this.setData({
        'sender.avatar': defaultSenderAvatar
      });
    }
    
    // 初始化云服务
    this.initCloud();
    
    // 自动滚动到底部
    setTimeout(() => {
      this.scrollToBottom(true);
    }, 300);
  },
  
  // 设置接收方信息
  setupReceiver: function(options, avatar) {
    const receiver = {
      id: options.userId || options.id || 'user_001',
      nickname: decodeURIComponent(options.nickname || options.name || '匿名卖家'),
      avatar: avatar || 'https://via.placeholder.com/100x100/07c160/ffffff?text=卖家',
      openid: options.openid || options.userId || options.id || '' // 接收方的openid
    };
    
    this.setData({ receiver });
    
    // 设置页面标题为对方的名字
    wx.setNavigationBarTitle({
      title: receiver.nickname
    });
    
    console.log('设置接收方信息:', receiver);
    
    // 如果 sender.openid 已经获取到了，立即加载消息历史
    if (this.data.sender.openid) {
      console.log('receiver.openid 设置完成，sender.openid 也已初始化，开始加载消息');
      this.loadMessageHistory();
    }
  },
  
  // 更新头像文件权限
  updateAvatarPermission: function(avatarUrl) {
    return new Promise((resolve, reject) => {
      // 检查是否是腾讯云CDN URL
      if (avatarUrl.includes('tcb.qcloud.la')) {
        // 对于CDN URL，直接使用，因为它应该已经是可访问的
        resolve(avatarUrl);
        return;
      }
      
      // 检查是否是cloud://格式
      if (avatarUrl.includes('cloud://')) {
        // 直接使用cloud://格式的fileID
        wx.cloud.callFunction({
          name: 'updateFilePermission',
          data: { fileID: avatarUrl },
          success: (res) => {
            console.log('更新头像权限成功:', res.result);
            if (res.result && res.result.success && res.result.data && res.result.data.tempFileURL) {
              resolve(res.result.data.tempFileURL);
            } else {
              resolve(avatarUrl);
            }
          },
          fail: (err) => {
            console.error('更新头像权限失败:', err);
            resolve(avatarUrl);
          }
        });
      } else {
        // 其他格式的URL直接使用
        resolve(avatarUrl);
      }
    });
  },
  
  // 加载消息历史
  loadMessageHistory: function() {
    try {
      const receiverId = this.data.receiver.id;
      const storedMessages = wx.getStorageSync(`chat_messages_${receiverId}`);
      const storedMessageId = wx.getStorageSync(`chat_message_id_${receiverId}`);
      
      if (storedMessages) {
        this.setData({
          messages: storedMessages,
          messageId: storedMessageId || this.data.messageId
        });
        console.log('📥 从本地存储加载消息历史:', storedMessages.length, '条消息');
      } else {
        // 如果没有存储的消息，显示空消息列表
        this.setData({
          messages: [],
          messageId: 1
        });
        console.log('📥 没有历史消息，显示空消息列表');
      }
    } catch (error) {
      console.error('加载消息历史失败:', error);
      // 发生错误时显示空消息列表
      this.setData({
        messages: [],
        messageId: 1
      });
    }
  },
  
  // 初始化云服务
  initCloud: function() {
    // 获取用户openid
    this.getUserOpenid();
    
    // 监听网络状态
    this.listenNetworkStatus();
  },
  
  // 获取用户openid和信息
  getUserOpenid: function() {
    wx.cloud.callFunction({
      name: 'getOpenid',
      success: (res) => {
        console.log('获取openid成功:', res.result);
        if (res.result && res.result.openid) {
          this.setData({
            'sender.openid': res.result.openid,
            'sender.id': res.result.openid,
            'sender.nickname': '我',
            'sender.avatar': 'https://via.placeholder.com/100x100/999999/ffffff?text=我'
          });
          
          // 只有当 receiver.openid 也已设置时，才加载消息历史
          if (this.data.receiver.openid) {
            console.log('sender.openid 和 receiver.openid 都已初始化，开始加载消息');
            this.loadMessageHistory();
          } else {
            console.log('receiver.openid 尚未初始化，等待设置完成');
          }
          
          // 监听新消息
          this.listenForNewMessages();
        }
      },
      fail: (err) => {
        console.error('获取openid失败:', err);
        wx.showToast({
          title: '初始化失败，请重试',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },
  
  // 监听网络状态
  listenNetworkStatus: function() {
    wx.onNetworkStatusChange((res) => {
      console.log('网络状态变化:', res);
      this.setData({ networkConnected: res.isConnected });
      
      if (res.isConnected) {
        wx.showToast({
          title: '网络已连接',
          icon: 'success',
          duration: 1500
        });
        // 网络恢复后重新加载消息
        this.loadMessageHistory();
      } else {
        wx.showToast({
          title: '网络连接已断开',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },
  
  // 加载消息历史
  loadMessageHistory: function() {
    const { sender, receiver } = this.data;
    
    if (!sender.openid || !receiver.openid) {
      console.log('用户信息未初始化，无法加载消息');
      return;
    }
    
    wx.showLoading({
      title: '加载消息中...',
    });
    
    // 先获取会话ID
    this.getConversationId().then(conversationId => {
      if (conversationId) {
        this.setData({ conversationId });
        
        // 获取聊天消息
        this.getChatMessages(conversationId, 1, this.data.pageSize);
      } else {
        // 会话不存在，显示空消息列表
        wx.hideLoading();
        console.log('未找到会话，显示空消息列表');
        this.setData({
          messages: [],
          hasMore: false
        });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('加载消息失败:', err);
      wx.showToast({
        title: '加载消息失败',
        icon: 'none',
        duration: 1500
      });
      // 发生错误时显示空消息列表
      this.setData({
        messages: [],
        hasMore: false
      });
    });
  },
  
  // 获取会话ID
  getConversationId: function() {
    return new Promise((resolve, reject) => {
      const { sender, receiver } = this.data;
      
      wx.cloud.callFunction({
        name: 'getConversations',
        data: {
          page: 1,
          pageSize: 20
        },
        success: (res) => {
          console.log('获取会话列表成功:', res.result);
          
          if (res.result && res.result.success && res.result.data) {
            const conversations = res.result.data.conversations;
            
            // 查找与当前接收方的会话
            const existingConversation = conversations.find(conv => 
              conv.participants.includes(sender.openid) && 
              conv.participants.includes(receiver.openid)
            );
            
            if (existingConversation) {
              resolve(existingConversation._id);
            } else {
              // 会话不存在，后续发送消息时会自动创建
              resolve(null);
            }
          } else {
            resolve(null);
          }
        },
        fail: (err) => {
          console.error('获取会话列表失败:', err);
          reject(err);
        }
      });
    });
  },
  
  // 获取聊天消息
  getChatMessages: function(conversationId, page, pageSize) {
    wx.cloud.callFunction({
      name: 'getChatMessages',
      data: {
        conversationId: conversationId,
        page: page,
        pageSize: pageSize
      },
      success: (res) => {
        wx.hideLoading();
        console.log('获取聊天消息成功:', res.result);
        
        if (res.result && res.result.success && res.result.data) {
          const messages = res.result.data.messages;
          const hasMore = res.result.data.hasMore;
          
          // 转换消息格式，确保发送者发送的消息显示为我方的消息（右边）
          // 当用户的openid与发送者id一致时显示我方消息聊天框，反之显示对方消息聊天框
          const formattedMessages = messages.map((msg, index) => ({
            id: msg._id,
            sender: msg.senderOpenid === this.data.sender.openid ? 'me' : 'other',
            content: msg.content,
            type: msg.type || 'text',
            time: this.formatMessageTime(msg.createTime),
            status: msg.isRead ? 'read' : 'delivered',
            timestamp: new Date(msg.createTime).getTime()
          }));
          
          console.log('消息格式转换完成，发送者判断逻辑：', {
            senderOpenid: this.data.sender.openid,
            messages: formattedMessages.map(m => ({ id: m.id, sender: m.sender }))
          });
          
          if (page === 1) {
            // 首次加载，替换消息列表
            this.setData({
              messages: formattedMessages,
              hasMore: hasMore,
              page: page
            });
          } else {
            // 加载更多，添加到消息列表前面
            this.setData({
              messages: [...formattedMessages, ...this.data.messages],
              hasMore: hasMore,
              page: page
            });
          }
          
          // 滚动到底部
          this.scrollToBottom(true);
        } else {
          console.log('获取聊天消息失败:', res.result);
          // 会话不存在时不显示错误提示，显示空消息列表
          if (res.result && res.result.message === '会话不存在') {
            this.setData({
              messages: [],
              hasMore: false
            });
          } else {
            wx.showToast({
              title: '加载消息失败',
              icon: 'none',
              duration: 1500
            });
          }
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('获取聊天消息失败:', err);
        wx.showToast({
          title: '网络错误，请重试',
          icon: 'none',
          duration: 1500
        });
      }
    });
  },
  
  // 监听新消息
  listenForNewMessages: function() {
    // 使用云开发的实时数据推送功能
    const { sender, receiver } = this.data;
    
    if (!sender.openid || !receiver.openid) return;
    
    // 这里可以使用 wx.cloud.subscribeMessage 或其他实时通信方案
    // 由于微信小程序的限制，我们使用定时轮询的方式
    this.messageListener = setInterval(() => {
      if (this.data.conversationId) {
        this.getLatestMessages();
      }
    }, 5000); // 每5秒轮询一次
  },
  
  // 获取最新消息
  getLatestMessages: function() {
    const { conversationId, messages, sender } = this.data;
    
    if (!conversationId || messages.length === 0) return;
    
    const lastMessageTime = messages[messages.length - 1].timestamp;
    
    wx.cloud.callFunction({
      name: 'getChatMessages',
      data: {
        conversationId: conversationId,
        page: 1,
        pageSize: 20
      },
      success: (res) => {
        if (res.result && res.result.success && res.result.data) {
          const newMessages = res.result.data.messages;
          
          // 过滤出比最后一条消息时间晚的新消息，并且排除本地临时消息和已存在的消息
          // 同时排除自己发送的消息，避免重复添加
          const existingMessageIds = new Set(this.data.messages.map(msg => msg.id));
          const latestMessages = newMessages.filter(msg => {
            const msgTime = new Date(msg.createTime).getTime();
            const isTempMessage = msg._id && msg._id.startsWith('temp_');
            const isExistingMessage = existingMessageIds.has(msg._id);
            const isSelfMessage = msg.senderOpenid === sender.openid;
            return msgTime > lastMessageTime && !isTempMessage && !isExistingMessage && !isSelfMessage;
          });
          
          if (latestMessages.length > 0) {
            const formattedMessages = latestMessages.map(msg => ({
              id: msg._id,
              sender: msg.senderOpenid === this.data.sender.openid ? 'me' : 'other',
              content: msg.content,
              type: msg.type || 'text',
              time: this.formatMessageTime(msg.createTime),
              status: msg.isRead ? 'read' : 'delivered',
              timestamp: new Date(msg.createTime).getTime()
            }));
            
            this.setData({
              messages: [...this.data.messages, ...formattedMessages]
            });
            
            // 滚动到底部
            this.scrollToBottom(true, true);
          }
        }
      },
      fail: (err) => {
        console.error('获取最新消息失败:', err);
      }
    });
  },
  
  // 保存消息历史（本地缓存作为备份）
  saveMessageHistory: function() {
    try {
      const receiverId = this.data.receiver.id;
      wx.setStorageSync(`chat_messages_${receiverId}`, this.data.messages);
      wx.setStorageSync(`chat_message_id_${receiverId}`, this.data.messageId);
      console.log('📤 消息历史已保存到本地存储');
    } catch (error) {
      console.error('保存消息历史失败:', error);
    }
  },

  onShow: function () {
    // 页面显示时自动聚焦输入框
    this.setData({ autoFocus: true });
    // 页面显示时，如果 sender.openid 和 receiver.openid 都已初始化，则重新加载消息
    if (this.data.sender.openid && this.data.receiver.openid) {
      this.loadMessageHistory();
    }
  },

  onHide: function () {
    // 页面隐藏时的处理
  },

  onUnload: function () {
    // 清理消息监听定时器
    if (this.data.messageListener) {
      clearInterval(this.data.messageListener);
    }
  },



  // 滚动事件
  onScroll: function(e) {
    const scrollTop = e.detail.scrollTop;
    const scrollHeight = e.detail.scrollHeight;
    const windowHeight = e.detail.clientHeight;
    
    // 判断是否滚动到底部
    const isBottom = (scrollTop + windowHeight >= scrollHeight - 50);
    this.setData({ isScrolledToBottom: isBottom });
    
    // 加载更多消息
    if (scrollTop < 100 && this.data.hasMore && !this.data.loading) {
      this.loadMoreMessages();
    }
  },

  // 滚动到底部事件
  onScrollToLower: function() {
    // 滚动到底部时的处理
    this.setData({ isScrolledToBottom: true });
  },

  // 加载更多消息
  loadMoreMessages: function() {
    if (this.data.loading || !this.data.hasMore) return;
    
    this.setData({ loading: true });
    
    const { conversationId, page, pageSize } = this.data;
    
    if (!conversationId) {
      this.setData({ loading: false });
      return;
    }
    
    // 从云服务加载更多消息
    this.getChatMessages(conversationId, page + 1, pageSize);
  },

  // 返回
  goBack: function () {
    wx.navigateBack();
  },

  // 显示更多操作
  showMoreActions: function () {
    wx.showActionSheet({
      itemList: ['清空聊天记录', '举报用户', '删除聊天'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.clearChatHistory();
        } else if (res.tapIndex === 1) {
          this.reportUser();
        } else if (res.tapIndex === 2) {
          this.deleteChat();
        }
      }
    });
  },

  // 清空聊天记录
  clearChatHistory: function () {
    wx.showModal({
      title: '清空聊天记录',
      content: '确定要清空与对方的聊天记录吗？',
      confirmText: '清空',
      confirmColor: '#fa5151',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          this.setData({ messages: [] });
          // 保存清空后的状态
          this.saveMessageHistory();
          wx.showToast({
            title: '已清空',
            icon: 'success',
            duration: 1500
          });
        }
      }
    });
  },

  // 举报用户
  reportUser: function () {
    wx.showActionSheet({
      itemList: ['骚扰/辱骂', '虚假信息', '不当行为', '取消'],
      success: (res) => {
        if (res.tapIndex < 3) {
          const reasons = ['骚扰/辱骂', '虚假信息', '不当行为'];
          wx.showModal({
            title: '确认举报',
            content: `确认举报 ${this.data.receiver.nickname}？\n原因：${reasons[res.tapIndex]}`,
            confirmText: '确认举报',
            confirmColor: '#fa5151',
            cancelText: '取消',
            success: (modalRes) => {
              if (modalRes.confirm) {
                wx.showToast({
                  title: '举报成功',
                  icon: 'success',
                  duration: 2000
                });
              }
            }
          });
        }
      }
    });
  },

  // 删除聊天
  deleteChat: function () {
    wx.showModal({
      title: '删除聊天',
      content: '删除后将清空聊天记录并从聊天列表移除',
      confirmText: '删除',
      confirmColor: '#fa5151',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          // 这里可以调用接口删除聊天
          wx.showToast({
            title: '已删除',
            icon: 'success',
            duration: 1500,
            success: () => {
              setTimeout(() => {
                wx.navigateBack();
              }, 1500);
            }
          });
        }
      }
    });
  },

  // 输入框变化
  onInputChange: function (e) {
    this.setData({
      inputValue: e.detail.value
    });
  },

  // 发送消息
  sendMessage: function () {
    const message = this.data.inputValue.trim();
    if (!message) {
      wx.showToast({
        title: '请输入消息',
        icon: 'none',
        duration: 1500
      });
      return;
    }
    
    const { sender, receiver } = this.data;
    
    if (!sender.openid) {
      wx.showToast({
        title: '用户信息未初始化',
        icon: 'none',
        duration: 1500
      });
      return;
    }
    
    // 确保接收方有 openid
    const receiverOpenid = receiver.openid || receiver.id;
    
    // 创建新消息（本地临时消息）
    // 发送的消息显示为我方的聊天框（右边）
    const tempMessage = {
      id: 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9), // 增加随机后缀避免 ID 重复
      sender: 'me',
      content: message,
      type: 'text',
      time: this.getCurrentTime(),
      status: 'sending',
      timestamp: Date.now()
    };
    
    // 添加到消息列表
    const messages = [...this.data.messages, tempMessage];
    this.setData({
      messages: messages,
      inputValue: '',
      messageId: this.data.messageId + 1,
      showEmojiPanel: false,
      showMorePanel: false,
      isVoiceMode: false
    });
    
    // 保存消息历史（本地缓存）
    this.saveMessageHistory();
    
    // 滚动到底部
    this.scrollToBottom(true, true);
    
    // 生成唯一的requestId
    const requestId = 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    // 通过云函数发送消息
    wx.showLoading({
      title: '发送中...',
      mask: true
    });
    
    wx.cloud.callFunction({
      name: 'sendChatMessage',
      data: {
        receiverOpenid: receiverOpenid,
        content: message,
        type: 'text',
        requestId: requestId
      },
      success: (res) => {
        wx.hideLoading();
        console.log('发送消息成功:', res.result);
        
        if (res.result && res.result.success) {
          // 更新消息状态
          this.updateMessageStatus(tempMessage.id, 'delivered');
          
          // 更新会话ID
          if (res.result.data.conversationId) {
            this.setData({ conversationId: res.result.data.conversationId });
            // 会话ID创建后，不需要立即获取最新消息，因为定时轮询会处理
          }
          
          // 模拟消息已读（实际应该由对方读取后更新）
          setTimeout(() => {
            this.updateMessageStatus(tempMessage.id, 'read');
          }, 2000);
        } else {
          console.error('发送消息失败:', res.result);
          this.updateMessageStatus(tempMessage.id, 'failed');
          wx.showToast({
            title: '发送失败，请重试',
            icon: 'none',
            duration: 2000
          });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('发送消息失败:', err);
        this.updateMessageStatus(tempMessage.id, 'failed');
        wx.showToast({
          title: '网络错误，请重试',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },

  // 模拟对方回复
  receiveReply: function () {
    const replies = [
      '好的，谢谢！',
      '明白了，我记下了。',
      '那我们约好了哦！',
      '可以，到时见！',
      '好的，我会准时到。',
      '谢谢告知！',
      '了解了，谢谢！',
      '好的，合作愉快！'
    ];
    
    const randomReply = replies[Math.floor(Math.random() * replies.length)];
    
    const replyMessage = {
      id: this.data.messageId,
      sender: 'other',
      content: randomReply,
      time: this.getCurrentTime(),
      status: 'delivered',
      timestamp: Date.now()
    };
    
    const messages = [...this.data.messages, replyMessage];
    this.setData({
      messages: messages,
      messageId: this.data.messageId + 1
    });
    
    // 保存消息历史
    this.saveMessageHistory();
    
    // 滚动到底部
    this.scrollToBottom(true, true);
  },

  // 更新消息状态
  updateMessageStatus: function (messageId, status) {
    const messages = this.data.messages.map(msg => 
      msg.id === messageId ? { ...msg, status } : msg
    );
    this.setData({ messages });
    
    // 状态更新不需要每次都保存，只在发送时和重要状态变更时保存
  },

  // 获取当前时间
  getCurrentTime: function () {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    return hours + ':' + minutes;
  },

  // 格式化消息时间
  formatTime: function(timeStr) {
    return timeStr;
  },

  // 格式化消息时间（用于时间分隔）
  formatMessageTime: function(timeStr) {
    let time;
    
    // 处理不同类型的时间格式
    if (typeof timeStr === 'string') {
      if (timeStr.includes(':')) {
        // 处理 HH:MM 格式
        time = new Date();
        const [hours, minutes] = timeStr.split(':');
        time.setHours(hours);
        time.setMinutes(minutes);
      } else {
        // 处理 ISO 格式时间字符串
        time = new Date(timeStr);
      }
    } else if (timeStr instanceof Date) {
      // 处理 Date 对象
      time = timeStr;
    } else {
      // 默认使用当前时间
      time = new Date();
    }
    
    const now = new Date();
    const diff = now - time;
    const diffMinutes = Math.floor(diff / (1000 * 60));
    const diffHours = Math.floor(diff / (1000 * 60 * 60));
    const diffDays = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (diffMinutes < 1) {
      return '刚刚';
    } else if (diffMinutes < 60) {
      return `${diffMinutes}分钟前`;
    } else if (diffHours < 24) {
      return `${diffHours}小时前`;
    } else if (diffDays < 7) {
      return `${diffDays}天前`;
    } else {
      // 显示具体日期
      const year = time.getFullYear();
      const month = (time.getMonth() + 1).toString().padStart(2, '0');
      const day = time.getDate().toString().padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  },

  // 判断是否显示时间分隔
  shouldShowTime: function(index) {
    if (index === 0) return true;
    
    const messages = this.data.messages;
    if (index >= messages.length) return false;
    
    const currentTime = messages[index].timestamp;
    const prevTime = messages[index - 1].timestamp;
    
    // 如果两条消息时间间隔超过5分钟，显示时间
    return (currentTime - prevTime) > 5 * 60 * 1000;
  },

  // 格式化文件大小
  formatFileSize: function(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },

  // 滚动到底部
  scrollToBottom: function(animated = true, force = false) {
    setTimeout(() => {
      if (this.data.messages.length > 0) {
        const lastMessage = this.data.messages[this.data.messages.length - 1];
        this.setData({
          scrollToId: 'msg_' + lastMessage.id
        });
      }
    }, 100);
  },

  // 切换表情面板
  toggleEmojiPanel: function() {
    this.setData({
      showEmojiPanel: !this.data.showEmojiPanel,
      showMorePanel: false,
      isVoiceMode: false,
      autoFocus: !this.data.showEmojiPanel
    });
  },

  // 切换更多选项面板
  toggleMorePanel: function() {
    this.setData({
      showMorePanel: !this.data.showMorePanel,
      showEmojiPanel: false,
      isVoiceMode: false,
      autoFocus: false
    });
  },



  // 预览图片
  previewImage: function(e) {
    const src = e.currentTarget.dataset.src;
    wx.previewImage({
      urls: [src],
      current: src
    });
  },

  // 下载文件
  downloadFile: function(e) {
    const url = e.currentTarget.dataset.url;
    wx.showLoading({
      title: '下载中...',
    });
    
    wx.downloadFile({
      url: url,
      success: (res) => {
        wx.hideLoading();
        if (res.statusCode === 200) {
          wx.showToast({
            title: '下载成功',
            icon: 'success',
            duration: 1500
          });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        wx.showToast({
          title: '下载失败',
          icon: 'none',
          duration: 1500
        });
      }
    });
  },

  // 跳转到个人主页
  goToUserProfile: function(e) {
    const userId = e.currentTarget.dataset.userid;
    const userInfo = e.currentTarget.dataset.userinfo;
    
    if (userId) {
      console.log('跳转到个人主页:', userId, userInfo);
      wx.navigateTo({
        url: `/pages/user-center/user-center?userId=${userId}&nickname=${encodeURIComponent(userInfo.nickname || '')}&avatar=${encodeURIComponent(userInfo.avatar || '')}`,
        fail: (err) => {
          console.error('跳转失败:', err);
          wx.showToast({
            title: '跳转失败',
            icon: 'none',
            duration: 1500
          });
        }
      });
    }
  },

  // 发送图片和视频
  sendImage: function() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image', 'video'],
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      maxDuration: 60,
      camera: 'back',
      success: (res) => {
        const tempFiles = res.tempFiles;
        console.log('选择的媒体:', tempFiles);
        
        wx.showLoading({
          title: '上传中...',
        });
        
        // 模拟上传
        setTimeout(() => {
          wx.hideLoading();
          const file = tempFiles[0];
          if (file.type === 'video') {
            this.sendMessageWithType('video', {
              url: file.tempFilePath,
              duration: Math.round(file.duration),
              height: file.height,
              width: file.width,
              size: file.size
            });
          } else {
            this.sendMessageWithType('image', file.tempFilePath);
          }
        }, 500);
      },
      fail: (err) => {
        console.error('选择媒体失败:', err);
        wx.showToast({
          title: '选择媒体失败',
          icon: 'none',
          duration: 1500
        });
      }
    });
    
    this.setData({ showMorePanel: false });
  },

  // 发送文件
  sendFile: function() {
    wx.chooseMessageFile({
      count: 1,
      type: 'all',
      success: (res) => {
        console.log('选择的文件:', res.tempFiles);
        const tempFile = res.tempFiles[0];
        
        wx.showLoading({
          title: '上传中...',
        });
        
        // 模拟上传
        setTimeout(() => {
          wx.hideLoading();
          this.sendMessageWithType('file', {
            url: tempFile.path,
            name: tempFile.name,
            size: tempFile.size
          });
        }, 500);
      },
      fail: (err) => {
        console.error('选择文件失败:', err);
        wx.showToast({
          title: '选择文件失败',
          icon: 'none',
          duration: 1500
        });
      }
    });
    
    this.setData({ showMorePanel: false });
  },

  // 拍摄照片
  takePhoto: function() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['camera'],
      success: (res) => {
        const tempFilePaths = res.tempFilePaths;
        console.log('拍摄的照片:', tempFilePaths);
        
        wx.showLoading({
          title: '上传中...',
        });
        
        // 模拟上传
        setTimeout(() => {
          wx.hideLoading();
          this.sendMessageWithType('image', tempFilePaths[0]);
        }, 500);
      },
      fail: (err) => {
        console.error('拍摄照片失败:', err);
        wx.showToast({
          title: '拍摄失败',
          icon: 'none',
          duration: 1500
        });
      }
    });
    
    this.setData({ showMorePanel: false });
  },

  // 快捷回复
  showQuickReplies: function() {
    const quickReplies = [
      '该书还在，可拍下',
      '好的，马上回复您',
      '稍等，我查一下',
      '可以，请问您什么时候方便交易？',
      '谢谢关注，这本书还在的',
      '您好，请问有什么可以帮您的？'
    ];
    
    wx.showActionSheet({
      itemList: quickReplies,
      success: (res) => {
        const selectedReply = quickReplies[res.tapIndex];
        this.setData({
          inputValue: selectedReply
        });
        // 自动发送快捷回复
        setTimeout(() => {
          this.sendMessage();
        }, 100);
      },
      fail: (err) => {
        console.error('选择快捷回复失败:', err);
      }
    });
    
    this.setData({ showMorePanel: false });
  },

  // 选择表情
  onEmojiSelect: function(e) {
    const emoji = e.detail.emoji;
    if (emoji) {
      this.setData({
        inputValue: this.data.inputValue + emoji,
        autoFocus: true
      });
    }
  },

  // 删除表情
  onEmojiDelete: function() {
    let inputValue = this.data.inputValue;
    if (inputValue) {
      // 使用Array.from将字符串转换为字符数组，确保每个表情符号都是一个元素
      const chars = Array.from(inputValue);
      // 移除最后一个元素（即一个完整的表情符号）
      chars.pop();
      // 将数组转换回字符串
      inputValue = chars.join('');
      this.setData({
        inputValue: inputValue,
        autoFocus: true
      });
    }
  },

  // 发送不同类型的消息
  sendMessageWithType: function(type, content) {
    const { sender, receiver } = this.data;
    
    if (!sender.openid) {
      wx.showToast({
        title: '用户信息未初始化',
        icon: 'none',
        duration: 1500
      });
      return;
    }
    
    // 确保接收方有 openid
    const receiverOpenid = receiver.openid || receiver.id;
    
    // 创建新消息（本地临时消息）
    // 发送的消息显示为我方的聊天框（右边）
    const tempMessage = {
      id: 'temp_' + Date.now(),
      sender: 'me',
      type: type,
      content: content,
      time: this.getCurrentTime(),
      status: 'sending',
      timestamp: Date.now()
    };
    
    // 添加到消息列表
    const messages = [...this.data.messages, tempMessage];
    this.setData({
      messages: messages,
      messageId: this.data.messageId + 1,
      showEmojiPanel: false,
      showMorePanel: false,
      isVoiceMode: false
    });
    
    // 保存消息历史（本地缓存）
    this.saveMessageHistory();
    
    // 滚动到底部
    this.scrollToBottom(true, true);
    
    // 生成唯一的requestId
    const requestId = 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    // 通过云函数发送消息
    wx.showLoading({
      title: '发送中...',
      mask: true
    });
    
    wx.cloud.callFunction({
      name: 'sendChatMessage',
      data: {
        receiverOpenid: receiverOpenid,
        content: content,
        type: type,
        requestId: requestId
      },
      success: (res) => {
        wx.hideLoading();
        console.log('发送消息成功:', res.result);
        
        if (res.result && res.result.success) {
          // 更新消息状态
          this.updateMessageStatus(tempMessage.id, 'delivered');
          
          // 更新会话ID
          if (res.result.data.conversationId) {
            this.setData({ conversationId: res.result.data.conversationId });
            // 会话ID创建后，不需要立即获取最新消息，因为定时轮询会处理
          }
          
          // 模拟消息已读（实际应该由对方读取后更新）
          setTimeout(() => {
            this.updateMessageStatus(tempMessage.id, 'read');
          }, 2000);
        } else {
          console.error('发送消息失败:', res.result);
          this.updateMessageStatus(tempMessage.id, 'failed');
          wx.showToast({
            title: '发送失败，请重试',
            icon: 'none',
            duration: 2000
          });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('发送消息失败:', err);
        this.updateMessageStatus(tempMessage.id, 'failed');
        wx.showToast({
          title: '网络错误，请重试',
          icon: 'none',
          duration: 2000
        });
      }
    });
  }
});
