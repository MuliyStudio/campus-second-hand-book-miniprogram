// cloudfunctions/sendSystemMessage/index.js
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  try {
    console.log('=== 云函数调用开始 - sendSystemMessage ===');
    
    const wxContext = cloud.getWXContext();
    const senderOpenid = wxContext.OPENID;
    const { receiverOpenid, title, content, type = 'system', relatedId, relatedType } = event;
    
    console.log('环境信息:', { senderOpenid });
    console.log('事件参数:', event);
    
    if (!receiverOpenid || !title || !content) {
      console.error('参数缺失');
      return {
        success: false,
        message: '参数缺失'
      };
    }
    
    // 查询接收者的用户信息
    let receiverInfo = { id: receiverOpenid, nickname: '用户', avatarUrl: '' };
    try {
      const userResult = await db.collection('users').where({ _openid: receiverOpenid }).get();
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
    
    // 创建系统消息到 notices 集合
    console.log('创建系统消息到 notices 集合:', { receiverOpenid, title });
    const noticeResult = await db.collection('notices').add({
      data: {
        _openid: receiverOpenid,
        type: type,
        title: title,
        content: content,
        fromUser: {
          id: senderOpenid || 'system',
          nickname: '系统',
          avatarUrl: ''
        },
        toUser: receiverInfo,
        relatedId: relatedId || '',
        relatedType: relatedType || '',
        isRead: false,
        createTime: new Date(),
        updateTime: new Date()
      }
    });
    
    console.log('系统消息创建成功:', noticeResult._id);
    
    // 通知用户有新消息（更新未读计数）
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
    
    console.log('=== 云函数调用结束 - sendSystemMessage ===');
    
    return {
      success: true,
      data: {
        messageId: noticeResult._id
      },
      message: '系统消息发送成功'
    };
    
  } catch (error) {
    console.error('发送系统消息失败:', error);
    console.error('错误堆栈:', error.stack);
    return {
      success: false,
      message: '发送系统消息失败，请重试',
      error: error.message
    };
  }
};