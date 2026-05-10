// cloudfunctions/sendChatMessage/index.js
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;
const chatMessagesCollection = db.collection('chat_messages');
const conversationsCollection = db.collection('conversations');
const messagesCollection = db.collection('messages');
const usersCollection = db.collection('users');

async function checkTextWithCloudFunction(texts, logId) {
  try {
    console.log(`[${logId}] 开始文本审核，共 ${texts.length} 条文本`);

    const result = await cloud.callFunction({
      name: 'checkText',
      data: {
        texts: texts
      },
      timeout: 10000 // 10秒超时
    });

    console.log(`[${logId}] 文本审核完成:`, JSON.stringify(result.result));

    if (!result.result || !result.result.success) {
      console.error(`[${logId}] 文本审核失败:`, result.result);
      return {
        success: false,
        message: result.result?.message || '文本审核失败',
        hasBlockedText: result.result?.hasBlockedText
      };
    }

    return result.result;
  } catch (error) {
    console.error(`[${logId}] 调用文本审核云函数失败:`, error);
    return {
      success: false,
      message: '文本审核服务异常，请重试'
    };
  }
}

async function saveAuditLog(db, data) {
  try {
    await db.collection('audit_logs').add({
      data: {
        ...data,
        createTime: new Date()
      }
    });
  } catch (error) {
    console.error('保存审核日志失败:', error);
  }
}

exports.main = async (event, context) => {
  const logId = 'chat_send_' + Date.now();
  console.log(`[${logId}] ========== 开始发送聊天消息 ==========`);

  try {
    console.log('=== 云函数调用开始 - sendChatMessage ===');

    const wxContext = cloud.getWXContext();
    const senderOpenid = wxContext.OPENID;
    const { receiverOpenid, content, type = 'text', requestId } = event;

    console.log('环境信息:', { senderOpenid });
    console.log('事件参数:', event);

    if (!senderOpenid || !receiverOpenid || !content) {
      console.error('参数缺失');
      return {
        success: false,
        message: '参数缺失'
      };
    }

    // 文本审核（只审核文本消息）
    if (type === 'text' && content && content.trim()) {
      console.log(`[${logId}] 开始文本审核`);
      const textsToCheck = [
        { fieldName: 'content', text: content }
      ];

      const textCheckResult = await checkTextWithCloudFunction(textsToCheck, logId);

      if (!textCheckResult.success) {
        const errorMessage = textCheckResult.message || '文本审核失败';
        console.error(`[${logId}] 文本审核失败: ${errorMessage}`);

        // 异步保存审核日志
        saveAuditLog(db, {
          type: 'chat_message',
          openid: senderOpenid,
          receiverOpenid: receiverOpenid,
          content: content.substring(0, 100),
          result: textCheckResult,
          status: 'rejected',
          reason: errorMessage
        }).catch(err => console.error(`[${logId}] 保存审核日志失败:`, err));

        return {
          success: false,
          message: errorMessage,
          logId: logId,
          textCheckResult: textCheckResult
        };
      }

      // 异步保存文本审核通过的日志
      saveAuditLog(db, {
        type: 'chat_message',
        openid: senderOpenid,
        receiverOpenid: receiverOpenid,
        content: content.substring(0, 100),
        result: textCheckResult,
        status: 'passed'
      }).catch(err => console.error(`[${logId}] 保存审核日志失败:`, err));

      console.log(`[${logId}] 文本审核通过`);
    }
    
    // 幂等性处理：使用requestId防止重复提交
    if (requestId) {
      console.log('使用requestId进行幂等性检查:', requestId);
      try {
        // 检查是否已经处理过该请求
        const existingMessage = await chatMessagesCollection
          .where({
            requestId: requestId
          })
          .get();
        
        if (existingMessage.data.length > 0) {
          console.log('请求已处理，返回已有消息:', existingMessage.data[0]);
          // 查找会话ID
          let conversationId;
          if (existingMessage.data[0].conversationId) {
            conversationId = existingMessage.data[0].conversationId;
          } else {
            // 查找会话
            const conversationResult = await conversationsCollection
              .where({
                participants: db.command.all([senderOpenid, receiverOpenid])
              })
              .get();
            if (conversationResult.data.length > 0) {
              conversationId = conversationResult.data[0]._id;
            }
          }
          return {
            success: true,
            data: {
              message: existingMessage.data[0],
              conversationId: conversationId
            },
            message: '消息已发送'
          };
        }
      } catch (error) {
        console.error('幂等性检查失败:', error);
        // 幂等性检查失败不影响消息发送，继续处理
      }
    }
    
    if (senderOpenid === receiverOpenid) {
      console.error('不能给自己发送消息');
      return {
        success: false,
        message: '不能给自己发送消息'
      };
    }
    
    // 查找或创建会话
    let conversationId;
    let conversation;
    
    // 查找已存在的会话
    console.log('开始查找已存在的会话:', { senderOpenid, receiverOpenid });
    const existingConversationResult = await conversationsCollection
      .where({
        participants: db.command.all([senderOpenid, receiverOpenid])
      })
      .get();
    console.log('查找会话结果:', existingConversationResult.data.length);
    
    if (existingConversationResult.data.length > 0) {
      // 会话已存在
      conversation = existingConversationResult.data[0];
      conversationId = conversation._id;
      console.log('会话已存在，使用现有会话:', conversationId);
    } else {
      // 创建新会话
      console.log('创建新会话:', { senderOpenid, receiverOpenid });
      const newConversationResult = await conversationsCollection.add({
        data: {
          participants: [senderOpenid, receiverOpenid],
          lastMessage: {
            content: content,
            type: type,
            senderOpenid: senderOpenid
          },
          lastMessageTime: new Date(),
          unreadCount:1,
          createTime: new Date(),
          updateTime: new Date()
        }
      });
      
      conversationId = newConversationResult._id;
      conversation = {
        _id: conversationId,
        participants: [senderOpenid, receiverOpenid],
        lastMessage: {
          content: content,
          type: type,
          senderOpenid: senderOpenid
        },
        lastMessageTime: new Date(),
        unreadCount:1,
        createTime: new Date(),
        updateTime: new Date()
      };
      console.log('新会话创建成功:', conversationId);
    }
    
    // 创建聊天消息
    console.log('创建聊天消息:', { conversationId, senderOpenid, type });
    const chatMessageData = {
      conversationId: conversationId,
      senderOpenid: senderOpenid,
      content: content,
      type: type,
      isRead: false,
      requestId: requestId, // 添加requestId用于幂等性检查
      createTime: new Date()
    };
    
    const chatMessageResult = await chatMessagesCollection.add({
      data: chatMessageData
    });
    
    const createdChatMessage = {
      _id: chatMessageResult._id,
      ...chatMessageData
    };
    console.log('聊天消息创建成功:', createdChatMessage._id);
    
    // 更新会话的最后消息信息
    console.log('更新会话最后消息信息:', conversationId);
    await conversationsCollection
      .doc(conversationId)
      .update({
        data: {
          lastMessage: {
            content: content,
            type: type,
            senderOpenid: senderOpenid
          },
          lastMessageTime: new Date(),
          unreadCount: db.command.inc(1),
          updateTime: new Date()
        }
      });
    console.log('会话更新成功:', conversationId);
    
    // 查询发送者的用户信息
    let senderInfo = { id: senderOpenid, nickname: '用户', avatarUrl: '' };
    try {
      const userResult = await usersCollection.where({ _openid: senderOpenid }).get();
      if (userResult.data && userResult.data.length > 0) {
        const user = userResult.data[0];
        senderInfo = {
          id: senderOpenid,
          nickname: user.nickname || '用户',
          avatarUrl: user.avatarUrl || ''
        };
      }
    } catch (error) {
      console.error('查询发送者用户信息失败:', error);
    }
    
    // 查询接收者的用户信息
    let receiverInfo = { id: receiverOpenid, nickname: '用户', avatarUrl: '' };
    try {
      const userResult = await usersCollection.where({ _openid: receiverOpenid }).get();
      if (userResult.data && userResult.data.length > 0) {
        const user = userResult.data[0];
        receiverInfo = {
          id: receiverOpenid,
          nickname: user.nickname || '用户',
          avatarUrl: user.avatarUrl || ''
        };
      }
    } catch (error) {
      console.error('查询接收者用户信息失败:', error);
    }
    
    // 构建 chatuser 字段，确保顺序一致以便后续查询
    const chatUsers = [senderOpenid, receiverOpenid].sort();
    
    // 创建消息记录到 messages 集合（聊天消息）
    console.log('创建聊天消息记录:', { chatUsers, conversationId });
    await messagesCollection.add({
      data: {
        _openid: receiverOpenid,
        type: 'personal',
        subType: 'chat',
        title: '私信通知',
        content: content,
        fromUser: senderInfo,
        toUser: receiverInfo,
        chatuser: chatUsers,
        relatedId: conversationId,
        relatedType: 'conversation',
        isRead: false,
        createTime: new Date(),
        updateTime: new Date()
      }
    });
    console.log('聊天消息记录创建成功');
    
    // 通知接收者有新消息（更新未读计数）
    try {
      await cloud.callFunction({
        name: 'notifyNewMessage',
        data: {
          receiverOpenid: receiverOpenid,
          increment: 1
        }
      });
      console.log('新消息通知已发送');
    } catch (notifyError) {
      console.error('发送新消息通知失败:', notifyError);
    }
    
    console.log(`[${logId}] 聊天消息发送成功:`, createdChatMessage);
    console.log('会话 ID:', conversationId);
    
    console.log(`[${logId}] ========== 聊天消息发送成功 ==========`);

    console.log('=== 云函数调用结束 - sendChatMessage ===');
    
    return {
      success: true,
      data: {
        message: createdChatMessage,
        conversationId: conversationId
      },
      message: '消息发送成功'
    };
    
  } catch (error) {
    console.error(`[${logId}] 发送聊天消息失败:`, error);
    console.error(`[${logId}] 错误堆栈:`, error.stack);
    return {
      success: false,
      message: '发送聊天消息失败，请重试',
      error: error.message,
      logId: logId
    };
  }
};
