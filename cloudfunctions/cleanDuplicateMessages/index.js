// cloudfunctions/cleanDuplicateMessages/index.js
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const messagesCollection = db.collection('messages');
const chatMessagesCollection = db.collection('chat_messages');

exports.main = async (event, context) => {
  try {
    console.log('=== 云函数调用开始 - cleanDuplicateMessages ===');
    
    // 清理messages集合中的重复记录
    console.log('开始清理messages集合中的重复记录');
    await cleanDuplicateMessages();
    
    // 清理chat_messages集合中的重复记录
    console.log('开始清理chat_messages集合中的重复记录');
    await cleanDuplicateChatMessages();
    
    console.log('=== 云函数调用结束 - cleanDuplicateMessages ===');
    
    return {
      success: true,
      message: '重复消息记录清理成功'
    };
    
  } catch (error) {
    console.error('清理重复消息记录失败:', error);
    console.error('错误堆栈:', error.stack);
    return {
      success: false,
      message: '清理重复消息记录失败，请重试',
      error: error.message
    };
  }
};

// 清理messages集合中的重复记录
async function cleanDuplicateMessages() {
  try {
    // 获取所有消息记录
    const messagesResult = await messagesCollection.get();
    const messages = messagesResult.data;
    console.log('获取到messages记录数量:', messages.length);
    
    // 按内容、创建时间和相关ID分组，找出重复记录
    const messageGroups = {};
    messages.forEach(message => {
      // 创建分组键
      const key = `${message.content}_${message.createTime}_${message.relatedId || ''}`;
      if (!messageGroups[key]) {
        messageGroups[key] = [];
      }
      messageGroups[key].push(message);
    });
    
    // 清理重复记录
    let deletedCount = 0;
    for (const key in messageGroups) {
      const group = messageGroups[key];
      if (group.length > 1) {
        console.log(`发现重复消息记录组，数量: ${group.length}，内容: ${group[0].content}`);
        // 保留第一个记录，删除其他记录
        const messagesToDelete = group.slice(1);
        for (const message of messagesToDelete) {
          try {
            await messagesCollection.doc(message._id).remove();
            deletedCount++;
            console.log(`删除重复消息记录: ${message._id}`);
          } catch (error) {
            console.error(`删除消息记录失败: ${message._id}`, error);
          }
        }
      }
    }
    
    console.log(`清理messages集合完成，删除重复记录数量: ${deletedCount}`);
  } catch (error) {
    console.error('清理messages集合失败:', error);
  }
}

// 清理chat_messages集合中的重复记录
async function cleanDuplicateChatMessages() {
  try {
    // 获取所有聊天消息记录
    const chatMessagesResult = await chatMessagesCollection.get();
    const chatMessages = chatMessagesResult.data;
    console.log('获取到chat_messages记录数量:', chatMessages.length);
    
    // 按内容、创建时间和发送者分组，找出重复记录
    const chatMessageGroups = {};
    chatMessages.forEach(message => {
      // 创建分组键
      const key = `${message.content}_${message.createTime}_${message.senderOpenid}`;
      if (!chatMessageGroups[key]) {
        chatMessageGroups[key] = [];
      }
      chatMessageGroups[key].push(message);
    });
    
    // 清理重复记录
    let deletedCount = 0;
    for (const key in chatMessageGroups) {
      const group = chatMessageGroups[key];
      if (group.length > 1) {
        console.log(`发现重复聊天消息记录组，数量: ${group.length}，内容: ${group[0].content}`);
        // 保留第一个记录，删除其他记录
        const messagesToDelete = group.slice(1);
        for (const message of messagesToDelete) {
          try {
            await chatMessagesCollection.doc(message._id).remove();
            deletedCount++;
            console.log(`删除重复聊天消息记录: ${message._id}`);
          } catch (error) {
            console.error(`删除聊天消息记录失败: ${message._id}`, error);
          }
        }
      }
    }
    
    console.log(`清理chat_messages集合完成，删除重复记录数量: ${deletedCount}`);
  } catch (error) {
    console.error('清理chat_messages集合失败:', error);
  }
}