// cloudfunctions/getConversations/index.js
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;
const conversationsCollection = db.collection('conversations');

exports.main = async (event, context) => {
  try {
    console.log('=== 云函数调用开始 - getConversations ===');
    
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    const { page = 1, pageSize = 20 } = event;
    
    console.log('环境信息:', { openid });
    console.log('事件参数:', event);
    
    if (!openid) {
      console.error('获取用户openid失败');
      return {
        success: false,
        message: '获取用户openid失败'
      };
    }
    
    // 构建查询，查找用户参与的会话
    const query = conversationsCollection.where({
      participants: _.elemMatch(_.eq(openid))
    });
    
    // 获取会话列表，按最后消息时间倒序排列
    const conversationsResult = await query
      .orderBy('lastMessageTime', 'desc')
      .get();
    
    // 处理会话数据，确保每个对话只返回最新的一条记录
    const processedConversations = [];
    const conversationMap = new Map();
    
    for (const conversation of conversationsResult.data) {
      // 使用排序后的participants作为对话的唯一标识
      const conversationKey = conversation.participants.sort().join('_');
      
      if (!conversationMap.has(conversationKey)) {
        conversationMap.set(conversationKey, conversation);
        processedConversations.push(conversation);
      }
    }
    
    // 计算分页
    const total = processedConversations.length;
    const skip = (page - 1) * pageSize;
    const paginatedConversations = processedConversations.slice(skip, skip + pageSize);
    const hasMore = skip + pageSize < total;
    
    const conversations = paginatedConversations;
    console.log('获取到会话数量:', conversations.length);
    console.log('会话数据:', conversations);
    
    console.log('=== 云函数调用结束 - getConversations ===');
    
    return {
      success: true,
      data: {
        conversations: conversations,
        total: total,
        page: page,
        pageSize: pageSize,
        hasMore: hasMore
      },
      message: '获取会话列表成功'
    };
    
  } catch (error) {
    console.error('获取会话列表失败:', error);
    console.error('错误堆栈:', error.stack);
    return {
      success: false,
      message: '获取会话列表失败，请重试',
      error: error.message
    };
  }
};
