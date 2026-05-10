// cloudfunctions/addCommentReply/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

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

/**
 * 添加评论回复云函数
 * @param {Object} event - 事件对象
 * @param {string} event.postId - 帖子 ID
 * @param {string} event.parentId - 父评论 ID
 * @param {string} event.content - 回复内容
 * @param {Object} event.authorInfo - 回复者信息
 * @param {Object} context - 上下文对象
 * @returns {Object} - 操作结果
 */
exports.main = async (event, context) => {
  const logId = 'comment_reply_' + Date.now();
  console.log(`[${logId}] ========== 开始添加评论回复 ==========`);

  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID

    console.log('用户 openid:', openid)
    console.log('事件参数:', event)

    if (!openid) {
      console.error('获取用户 openid 失败')
      return {
        success: false,
        message: '获取用户 openid 失败'
      }
    }

    if (!event.postId || !event.parentId || !event.content) {
      console.error('参数缺失：postId、parentId 或 content 为空')
      return {
        success: false,
        message: '帖子 ID、父评论 ID 和回复内容不能为空'
      }
    }

    const { postId, parentId, content, authorInfo } = event

    if (content.trim().length === 0) {
      console.error('回复内容为空')
      return {
        success: false,
        message: '回复内容不能为空'
      }
    }

    if (content.trim().length > 200) {
      console.error('回复内容过长')
      return {
        success: false,
        message: '回复内容不能超过 200 字'
      }
    }

    // 文本审核
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
        type: 'comment_reply',
        openid: openid,
        postId: postId,
        parentId: parentId,
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
      type: 'comment_reply',
      openid: openid,
      postId: postId,
      parentId: parentId,
      content: content.substring(0, 100),
      result: textCheckResult,
      status: 'passed'
    }).catch(err => console.error(`[${logId}] 保存审核日志失败:`, err));

    console.log(`[${logId}] 文本审核通过`);

    const replyData = {
      _openid: openid,
      postId: postId,
      parentId: parentId,
      content: content.trim(),
      authorInfo: authorInfo || {},
      likeCount: 0,
      createTime: new Date(),
      updateTime: new Date(),
      status: 'active'
    }

    console.log('准备添加回复:', replyData)

    const result = await db.collection('comments').add({
      data: replyData
    })

    console.log(`[${logId}] 回复添加成功，ID:`, result._id)

    const createdReply = {
      _id: result._id,
      ...replyData
    }

    try {
      await db.collection('posts').doc(postId).update({
        data: {
          commentCount: _.inc(1)
        }
      })
      console.log('更新帖子评论数成功')
    } catch (error) {
      console.error('更新帖子评论数失败:', error)
    }

    try {
      await db.collection('comments').doc(parentId).update({
        data: {
          replyCount: _.inc(1)
        }
      })
      console.log('更新父评论回复数成功')
    } catch (error) {
      console.error('更新父评论回复数失败:', error)
    }

    console.log(`[${logId}] ========== 回复添加成功 ==========`)

    console.log('=== 云函数调用结束 - addCommentReply ===')

    return {
      success: true,
      message: '回复成功',
      data: createdReply
    }
  } catch (error) {
    console.error(`[${logId}] 添加回复失败:`, error)
    console.error(`[${logId}] 错误堆栈:`, error.stack)
    return {
      success: false,
      message: '添加回复失败，请重试',
      error: error.message,
      logId: logId
    }
  }
}
