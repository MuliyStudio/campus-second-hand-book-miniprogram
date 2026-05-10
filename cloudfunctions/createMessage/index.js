// cloudfunctions/createMessage/index.js
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const messagesCollection = db.collection('messages');

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
  const logId = 'message_' + Date.now();
  console.log(`[${logId}] ========== 开始创建消息 ==========`);

  try {
    console.log('=== 云函数调用开始 - createMessage ===');

    const wxContext = cloud.getWXContext();
    const { type, subType, title, content, relatedId, relatedType, targetOpenid } = event;

    console.log('环境信息:', { openid: wxContext.OPENID });
    console.log('事件参数:', event);

    if (!type || !subType || !title || !content || !targetOpenid) {
      console.error('参数缺失');
      return {
        success: false,
        message: '参数缺失'
      };
    }

    // 文本审核
    console.log(`[${logId}] 开始文本审核`);
    const textsToCheck = [
      { fieldName: 'title', text: title },
      { fieldName: 'content', text: content }
    ];

    const textCheckResult = await checkTextWithCloudFunction(textsToCheck, logId);

    if (!textCheckResult.success) {
      const errorMessage = textCheckResult.message || '文本审核失败';
      console.error(`[${logId}] 文本审核失败: ${errorMessage}`);

      // 异步保存审核日志
      saveAuditLog(db, {
        type: 'message',
        openid: wxContext.OPENID,
        targetOpenid: targetOpenid,
        title: title,
        content: content.substring(0, 100),
        result: textCheckResult,
        status: 'rejected',
        reason: errorMessage,
        messageType: type,
        messageSubType: subType
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
      type: 'message',
      openid: wxContext.OPENID,
      targetOpenid: targetOpenid,
      title: title,
      content: content.substring(0, 100),
      result: textCheckResult,
      status: 'passed',
      messageType: type,
      messageSubType: subType
    }).catch(err => console.error(`[${logId}] 保存审核日志失败:`, err));

    console.log(`[${logId}] 文本审核通过`);

    // 构建消息数据
    const messageData = {
      _openid: targetOpenid,
      type: type,
      subType: subType,
      title: title,
      content: content,
      relatedId: relatedId || '',
      relatedType: relatedType || '',
      isRead: false,
      createTime: new Date(),
      updateTime: new Date()
    };

    // 插入消息到数据库
    const result = await messagesCollection.add({
      data: messageData
    });

    console.log(`[${logId}] 消息创建成功:`, result);

    const createdMessage = {
      _id: result._id,
      ...messageData
    };

    console.log(`[${logId}] ========== 消息创建成功 ==========`);

    console.log('=== 云函数调用结束 - createMessage ===');

    return {
      success: true,
      data: createdMessage,
      message: '消息创建成功'
    };

  } catch (error) {
    console.error(`[${logId}] 创建消息失败:`, error);
    console.error(`[${logId}] 错误堆栈:`, error.stack);
    return {
      success: false,
      message: '创建消息失败，请重试',
      error: error.message,
      logId: logId
    };
  }
};
