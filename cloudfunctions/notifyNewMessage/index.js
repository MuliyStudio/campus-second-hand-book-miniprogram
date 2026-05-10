// cloudfunctions/notifyNewMessage/index.js
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

/**
 * 通知用户有新消息
 * 这个云函数用于在发送系统消息后，更新用户的未读消息计数
 * 前端可以轮询这个计数来显示红点
 */
exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext();
    const { receiverOpenid, increment = 1 } = event;
    
    if (!receiverOpenid) {
      return {
        success: false,
        message: '接收者 openid 不能为空'
      };
    }
    
    // 更新用户的未读消息计数
    const userResult = await db.collection('users').where({
      _openid: receiverOpenid
    }).get();
    
    if (userResult.data.length === 0) {
      return {
        success: false,
        message: '用户不存在'
      };
    }
    
    const user = userResult.data[0];
    const currentUnreadCount = user.unreadMessageCount || 0;
    
    // 更新未读消息计数
    await db.collection('users').where({
      _openid: receiverOpenid
    }).update({
      data: {
        unreadMessageCount: currentUnreadCount + increment,
        lastMessageTime: new Date()
      }
    });
    
    console.log('用户未读消息计数已更新:', receiverOpenid, '当前未读数:', currentUnreadCount + increment);
    
    return {
      success: true,
      data: {
        unreadMessageCount: currentUnreadCount + increment
      },
      message: '通知成功'
    };
    
  } catch (error) {
    console.error('通知新消息失败:', error);
    return {
      success: false,
      message: '通知失败',
      error: error.message
    };
  }
};
