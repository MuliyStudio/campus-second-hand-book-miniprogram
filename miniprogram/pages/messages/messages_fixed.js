  // 对个人消息按发送者分组
  groupPersonalMessages: function(personalMessages) {
    // 按发送者分组
    const groupedMessages = {};
    
    // 获取当前用户的 openid
    const app = getApp();
    const currentOpenid = app.globalData.userInfo && app.globalData.userInfo.openid ? app.globalData.userInfo.openid : app.globalData.openid || '';
    console.log('=== groupPersonalMessages 开始 ===');
    console.log('当前用户 openid:', currentOpenid);
    
    personalMessages.forEach(msg => {
      console.log('处理消息:', {
        _id: msg._id,
        content: msg.content,
        chatuser: msg.chatuser,
        fromUser: msg.fromUser,
        toUser: msg.toUser
      });
      
      // 处理用户信息，根据 chatuser 字段获取对方用户信息
      let otherUser = {};
      let otherOpenid = '';
      
      // 检查是否有 chatuser 字段
      if (msg.chatuser && Array.isArray(msg.chatuser) && msg.chatuser.length === 2) {
        // chatuser 数组包含两个用户的 openid，需要找出哪个是当前用户，哪个是对方
        const chatuserSorted = [...msg.chatuser].sort();
        console.log('chatuser 排序后:', chatuserSorted);
        
        // 从 chatuser 中获取与当前用户不同的 openid
        otherOpenid = msg.chatuser.find(id => id !== currentOpenid);
        console.log('对方用户 openid (otherOpenid):', otherOpenid);
        
        if (!otherOpenid) {
          // 如果没找到，说明当前用户可能不在 chatuser 中，取第一个不是当前用户的
          otherOpenid = chatuserSorted[0] === currentOpenid ? chatuserSorted[1] : chatuserSorted[0];
          console.log('重新计算 otherOpenid:', otherOpenid);
        }
        
        if (otherOpenid) {
          // 解析 fromUser 和 toUser
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
          
          console.log('fromUserInfo:', fromUserInfo);
          console.log('toUserInfo:', toUserInfo);
          
          // 根据 otherOpenid 精确匹配对方用户信息
          let otherUserInfo = {};
          
          // 优先使用 openid 字段匹配
          if (fromUserInfo.openid === otherOpenid) {
            otherUserInfo = fromUserInfo;
            console.log('从 fromUserInfo 中匹配到对方用户 (openid)');
          } else if (toUserInfo.openid === otherOpenid) {
            otherUserInfo = toUserInfo;
            console.log('从 toUserInfo 中匹配到对方用户 (openid)');
          } 
          // 其次使用 id 字段匹配
          else if (fromUserInfo.id === otherOpenid) {
            otherUserInfo = fromUserInfo;
            console.log('从 fromUserInfo 中匹配到对方用户 (id)');
          } else if (toUserInfo.id === otherOpenid) {
            otherUserInfo = toUserInfo;
            console.log('从 toUserInfo 中匹配到对方用户 (id)');
          }
          // 如果都不匹配，使用 fromUser 作为默认（兼容旧数据）
          else {
            // 尝试判断 fromUser 是否是对方
            if (fromUserInfo.openid || fromUserInfo.id) {
              const fromUserOpenid = fromUserInfo.openid || fromUserInfo.id;
              if (fromUserOpenid !== currentOpenid) {
                otherUserInfo = fromUserInfo;
                console.log('fromUser 不是当前用户，使用 fromUserInfo');
              } else if (toUserInfo.openid || toUserInfo.id) {
                otherUserInfo = toUserInfo;
                console.log('fromUser 是当前用户，使用 toUserInfo');
              }
            } else {
              // 都没有 openid/id 信息，使用默认
              otherUserInfo = {};
              console.log('无法匹配用户信息，使用默认值');
            }
          }
          
          otherUser = {
            id: otherOpenid,
            nickname: otherUserInfo.nickname || otherUserInfo.name || '用户',
            avatar: otherUserInfo.avatar || otherUserInfo.avatarUrl || 'https://via.placeholder.com/100x100/07c160/ffffff?text=用户',
            avatarUrl: otherUserInfo.avatar || otherUserInfo.avatarUrl || 'https://via.placeholder.com/100x100/07c160/ffffff?text=用户'
          };
        } else {
          // 如果没有找到对方用户，使用默认信息
          otherUser = {
            id: 'unknown',
            nickname: '用户',
            avatar: 'https://via.placeholder.com/100x100/07c160/ffffff?text=用户',
            avatarUrl: 'https://via.placeholder.com/100x100/07c160/ffffff?text=用户'
          };
        }
      } else {
        // 兼容旧数据，使用 fromUser 信息
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
        
        // 对于旧数据，使用 fromUser 的 id 作为 otherOpenid
        otherOpenid = fromUser.id || fromUser.openid || '';
      }
      
      // 尝试获取头像的临时 URL
      const avatarUrl = otherUser.avatar || otherUser.avatarUrl || '';
      if (avatarUrl && avatarUrl.includes('cloud://')) {
        wx.cloud.callFunction({
          name: 'updateFilePermission',
          data: { fileID: avatarUrl },
          success: (res) => {
            console.log('获取头像临时 URL 成功:', res.result);
            if (res.result && res.result.success && res.result.data && res.result.data.tempFileURL) {
              otherUser.avatar = res.result.data.tempFileURL;
              otherUser.avatarUrl = res.result.data.tempFileURL;
              const userId = otherUser.id || otherUser.openid || 'unknown';
              if (groupedMessages[userId]) {
            groupedMessages[userId].fromUser.avatar = otherUser.avatar;
            groupedMessages[userId].fromUser.avatarUrl = otherUser.avatarUrl;
            // 强制更新视图
            const updatedFilteredMessages = this.data.filteredMessages.map(section => {
              if (section.type === 'section') {
                return {
                  ...section,
                  data: section.data.map(item => 
                    item.userId === userId ? { ...item, fromUser: groupedMessages[userId].fromUser } : item
                  )
                };
              }
              return section;
            });
            
            this.setData({
              filteredMessages: updatedFilteredMessages
            });
          }
            }
          },
          fail: (err) => {
            console.error('获取头像临时 URL 失败:', err);
          }
        });
      } else if (!avatarUrl || avatarUrl === '') {
        // 确保头像 URL 有效
        otherUser.avatar = 'https://via.placeholder.com/100x100/07c160/ffffff?text=用户';
        otherUser.avatarUrl = 'https://via.placeholder.com/100x100/07c160/ffffff?text=用户';
      }
      
      // 确保使用稳定的用户 ID 进行分组
      const userId = otherUser.id || otherUser.openid || 'unknown';
      console.log('最终分组信息:', {
        userId: userId,
        otherOpenid: otherOpenid,
        nickname: otherUser.nickname,
        avatar: otherUser.avatar
      });
      
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
      // 计算未读数
      if (!msg.isRead) {
        groupedMessages[userId].unreadCount++;
      }
      
      // 更新最新消息时间戳
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
    
    // 转换为数组并排序（按最新消息时间）
    const chatGroups = Object.values(groupedMessages).map(group => {
      // 按时间排序消息
      group.messages.sort((a, b) => new Date(b.createTime) - new Date(a.createTime));
      
      // 获取最新消息
      const latestMessage = group.messages[0];
      
      // 格式化时间
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
        hasUnread: group.unreadCount > 0, // 根据实际未读数设置状态，true=未读（高亮），false=已读（不高亮）
        unreadCount: group.unreadCount, // 显示实际未读数
        otherOpenid: group.otherOpenid // 传递对方的 openid
      };
    }).sort((a, b) => b.latestMessageTimestamp - a.latestMessageTimestamp);
    
    // 按时间分组
    return this.groupByTime(chatGroups);
  },
