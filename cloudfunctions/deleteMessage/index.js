// cloudfunctions/deleteMessage/index.js
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const messagesCollection = db.collection('messages');

exports.main = async (event, context) => {
  try {
    console.log('=== 云函数调用开始 - deleteMessage ===');
    
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    const { messageId } = event;
    
    console.log('环境信息:', { openid });
    console.log('事件参数:', event);
    
    if (!openid || !messageId) {
      console.error('参数缺失');
      return {
        success: false,
        message: '参数缺失'
      };
    }
    
    // 查找消息，确保消息属于当前用户
    const messageResult = await messagesCollection
      .where({ _id: messageId, _openid: openid })
      .get();
    
    if (messageResult.data.length === 0) {
      console.error('消息不存在或无权限');
      return {
        success: false,
        message: '消息不存在或无权限'
      };
    }
    
    // 删除消息
    const deleteResult = await messagesCollection
      .doc(messageId)
      .remove();
    
    console.log('消息删除成功:', deleteResult);
    
    console.log('=== 云函数调用结束 - deleteMessage ===');
    
    return {
      success: true,
      message: '消息已删除'
    };
    
  } catch (error) {
    console.error('删除消息失败:', error);
    console.error('错误堆栈:', error.stack);
    return {
      success: false,
      message: '删除消息失败，请重试',
      error: error.message
    };
  }
};
