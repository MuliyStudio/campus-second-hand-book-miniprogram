// cloudfunctions/getChatMessages/index.js
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const chatMessagesCollection = db.collection('chat_messages');
const conversationsCollection = db.collection('conversations');

exports.main = async (event, context) => {
  try {
    console.log('=== 云函数调用开始 - getChatMessages ===');
    
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    const { conversationId, page = 1, pageSize = 20 } = event;
    
    console.log('环境信息:', { openid });
    console.log('事件参数:', event);
    
    if (!openid || !conversationId) {
      console.error('参数缺失');
      return {
        success: false,
        message: '参数缺失'
      };
    }
    
    // 检查会话是否存在且用户有权限
    const conversationResult = await conversationsCollection
      .doc(conversationId)
      .get();
    
    if (!conversationResult.data) {
      console.error('会话不存在');
      return {
        success: false,
        message: '会话不存在'
      };
    }
    
    const conversation = conversationResult.data;
    if (!conversation.participants.includes(openid)) {
      console.error('无权限访问该会话');
      return {
        success: false,
        message: '无权限访问该会话'
      };
    }
    
    // 构建查询
    const query = chatMessagesCollection.where({ conversationId: conversationId });
    
    // 获取总数
    const countResult = await query.count();
    const total = countResult.total;
    
    // 计算分页
    const skip = (page - 1) * pageSize;
    const hasMore = skip + pageSize < total;
    
    // 获取聊天消息列表
    const messagesResult = await query
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get();
    
    const messages = messagesResult.data.reverse(); // 反转顺序，使消息按时间正序排列
    console.log('获取到消息数量:', messages.length);
    console.log('消息数据:', messages);
    
    // 标记消息为已读
    const unreadMessageIds = messages
      .filter(msg => msg.senderOpenid !== openid && !msg.isRead)
      .map(msg => msg._id);
    
    if (unreadMessageIds.length > 0) {
      await chatMessagesCollection
        .where({
          _id: db.command.in(unreadMessageIds)
        })
        .update({
          data: {
            isRead: true
          }
        });
    }
    
    console.log('=== 云函数调用结束 - getChatMessages ===');
    
    return {
      success: true,
      data: {
        messages: messages,
        total: total,
        page: page,
        pageSize: pageSize,
        hasMore: hasMore
      },
      message: '获取聊天消息成功'
    };
    
  } catch (error) {
    console.error('获取聊天消息失败:', error);
    console.error('错误堆栈:', error.stack);
    return {
      success: false,
      message: '获取聊天消息失败，请重试',
      error: error.message
    };
  }
};
