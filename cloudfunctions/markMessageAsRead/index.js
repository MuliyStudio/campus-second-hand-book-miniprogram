// cloudfunctions/markMessageAsRead/index.js
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const messagesCollection = db.collection('messages');
const noticesCollection = db.collection('notices');

exports.main = async (event, context) => {
  try {
    console.log('=== 云函数调用开始 - markMessageAsRead ===');
    
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    const { messageId, collection = 'messages', type, openid: targetOpenid } = event;
    
    console.log('环境信息:', { openid });
    console.log('事件参数:', event);
    
    // 批量标记所有未读消息为已读
    if (type === 'mark_all_as_read') {
      const userOpenid = targetOpenid || openid;
      console.log('批量标记所有未读消息为已读，用户:', userOpenid);
      
      let totalMarked = 0;
      
      // 标记 notices 中所有未读消息
      try {
        const unreadNotices = await noticesCollection
          .where({ _openid: userOpenid, isRead: false })
          .limit(100)
          .get();
        
        if (unreadNotices.data.length > 0) {
          const noticePromises = unreadNotices.data.map(notice => {
            return noticesCollection.doc(notice._id).update({
              data: { isRead: true, updateTime: new Date() }
            });
          });
          await Promise.all(noticePromises);
          totalMarked += unreadNotices.data.length;
          console.log(`已标记 ${unreadNotices.data.length} 条系统消息为已读`);
        }
      } catch (err) {
        console.error('标记系统消息失败:', err);
      }
      
      // 标记 messages 中当前用户相关的所有未读消息
      try {
        const unreadMessages = await messagesCollection
          .where({
            isRead: false,
            chatuser: userOpenid
          })
          .limit(100)
          .get();
        
        if (unreadMessages.data.length > 0) {
          const msgPromises = unreadMessages.data.map(msg => {
            return messagesCollection.doc(msg._id).update({
              data: { isRead: true, updateTime: new Date() }
            });
          });
          await Promise.all(msgPromises);
          totalMarked += unreadMessages.data.length;
          console.log(`已标记 ${unreadMessages.data.length} 条个人消息为已读`);
        }
      } catch (err) {
        console.error('标记个人消息失败:', err);
      }
      
      // 重置 users 表中的 unreadMessageCount
      try {
        await db.collection('users').where({ _openid: userOpenid }).update({
          data: { unreadMessageCount: 0 }
        });
      } catch (err) {
        console.error('重置用户未读计数失败:', err);
      }
      
      console.log('=== 批量标记完成，共标记', totalMarked, '条 ===');
      
      return {
        success: true,
        message: `已标记 ${totalMarked} 条消息为已读`,
        data: { markedCount: totalMarked }
      };
    }
    
    if (!openid || !messageId) {
      console.error('参数缺失');
      return {
        success: false,
        message: '参数缺失'
      };
    }
    
    // 根据集合类型查找消息
    const targetCollection = collection === 'notices' ? noticesCollection : messagesCollection;
    
    // 查找消息：查询 _id 匹配且当前用户是接收者（toUser 或 chatuser 中包含当前用户）
    const messageResult = await targetCollection
      .where({ _id: messageId })
      .get();
    
    if (messageResult.data.length === 0) {
      console.error('消息不存在');
      return {
        success: false,
        message: '消息不存在'
      };
    }
    
    const message = messageResult.data[0];
    
    // 验证权限：当前用户必须是消息的接收者
    const isReceiver = message._openid === openid || 
                      (message.toUser && (message.toUser.id === openid || message.toUser.openid === openid)) ||
                      (message.chatuser && Array.isArray(message.chatuser) && message.chatuser.includes(openid));
    
    if (!isReceiver) {
      console.error('无权限操作此消息');
      return {
        success: false,
        message: '无权限操作此消息'
      };
    }
    
    // 更新消息为已读
    const updateResult = await targetCollection
      .doc(messageId)
      .update({
        data: {
          isRead: true,
          updateTime: new Date()
        }
      });
    
    console.log('消息标记为已读成功:', updateResult);
    
    console.log('=== 云函数调用结束 - markMessageAsRead ===');
    
    return {
      success: true,
      message: '消息已标记为已读'
    };
    
  } catch (error) {
    console.error('标记消息为已读失败:', error);
    console.error('错误堆栈:', error.stack);
    return {
      success: false,
      message: '标记消息为已读失败，请重试',
      error: error.message
    };
  }
};
