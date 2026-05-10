// cloudfunctions/addComment/index.js
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
 * 添加评论云函数
 * @param {Object} event - 事件对象
 * @param {string} event.postId - 帖子ID
 * @param {string} event.content - 评论内容
 * @param {string} event.parentId - 父评论ID（回复时使用）
 * @param {Object} event.authorInfo - 评论者信息
 * @param {Object} context - 上下文对象
 * @returns {Object} - 操作结果
 */
exports.main = async (event, context) => {
  const logId = 'comment_' + Date.now();
  console.log(`[${logId}] ========== 开始添加评论 ==========`);

  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID

    console.log('用户openid:', openid)
    console.log('事件参数:', event)

    if (!openid) {
      console.error('获取用户openid失败')
      return {
        success: false,
        message: '获取用户openid失败'
      }
    }

    if (!event.postId || !event.content) {
      console.error('参数缺失: postId或content为空')
      return {
        success: false,
        message: '帖子ID和评论内容不能为空'
      }
    }

    const { postId, content, parentId, authorInfo } = event

    if (content.trim().length === 0) {
      console.error('评论内容为空')
      return {
        success: false,
        message: '评论内容不能为空'
      }
    }

    if (content.trim().length > 500) {
      console.error('评论内容过长')
      return {
        success: false,
        message: '评论内容不能超过500字'
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
        type: parentId ? 'comment_reply' : 'comment',
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
      type: parentId ? 'comment_reply' : 'comment',
      openid: openid,
      postId: postId,
      parentId: parentId,
      content: content.substring(0, 100),
      result: textCheckResult,
      status: 'passed'
    }).catch(err => console.error(`[${logId}] 保存审核日志失败:`, err));

    console.log(`[${logId}] 文本审核通过`);

    const commentData = {
      _openid: openid,
      postId: postId,
      content: content.trim(),
      parentId: parentId || null,
      authorInfo: authorInfo || {},
      likeCount: 0,
      createTime: new Date(),
      updateTime: new Date(),
      status: 'active'
    }

    console.log('准备添加评论:', commentData)

    const result = await db.collection('comments').add({
      data: commentData
    })

    console.log(`[${logId}] 评论添加成功, ID:`, result._id)

    const createdComment = {
      _id: result._id,
      ...commentData
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

    if (parentId) {
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
    }

    // 发送系统消息给帖子发布者
    try {
      const postResult = await db.collection('posts').doc(postId).get()
      if (postResult.data && postResult.data._openid !== openid) {
        const postAuthorId = postResult.data._openid
        const postTitle = postResult.data.title || '帖子'

        // 获取评论者信息
        const userResult = await db.collection('users').where({
          _openid: openid
        }).get()

        const commenterName = userResult.data[0]?.nickname || '用户'

        await cloud.callFunction({
          name: 'sendSystemMessage',
          data: {
            receiverOpenid: postAuthorId,
            title: parentId ? '收到新回复' : '收到新评论',
            content: `${commenterName}${parentId ? '回复了' : '评论了'}你的帖子《${postTitle}》：${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`,
            type: 'comment',
            relatedId: postId,
            relatedType: 'post'
          }
        })
        console.log('已发送评论通知给发布者')
      }
    } catch (msgError) {
      console.warn('发送评论通知失败:', msgError)
    }

    console.log(`[${logId}] ========== 评论添加成功 ==========`)

    return {
      success: true,
      message: parentId ? '回复成功' : '评论成功',
      data: createdComment
    }
  } catch (error) {
    console.error(`[${logId}] 添加评论失败:`, error)
    console.error(`[${logId}] 错误堆栈:`, error.stack)
    return {
      success: false,
      message: '添加评论失败，请重试',
      error: error.message,
      logId: logId
    }
  }
}