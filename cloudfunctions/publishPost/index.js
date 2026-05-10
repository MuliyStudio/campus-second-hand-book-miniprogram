// cloudfunctions/publishPost/index.js
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const postsCollection = db.collection('posts');

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
  const logId = 'post_publish_' + Date.now();
  console.log(`[${logId}] ========== 开始发布帖子 ==========`);

  try {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    const { title, content, type, tags, images, videos, author } = event;

    console.log('收到发布帖子请求:', {
      openid,
      title: (title && title.substring(0, 20)) + (title && title.length > 20 ? '...' : ''),
      contentLength: content && content.length,
      tagsCount: tags && tags.length,
      imagesCount: (images && images.length) || 0,
      videosCount: (videos && videos.length) || 0
    });

    // 验证必填字段
    if (!title || !content || !type || !tags || !author) {
      console.error('缺少必填字段:', { title, content, type, tags, author });
      return {
        success: false,
        message: '缺少必填字段，请检查表单'
      };
    }

    // 验证字段长度
    if (title.length < 5 || title.length > 50) {
      return {
        success: false,
        message: '标题长度应在5-50字之间'
      };
    }

    if (content.length < 10 || content.length > 2000) {
      return {
        success: false,
        message: '内容长度应在10-2000字之间'
      };
    }

    if (tags.length === 0 || tags.length > 5) {
      return {
        success: false,
        message: '标签数量应在1-5个之间'
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
        type: 'post_text',
        openid: openid,
        title: title,
        result: textCheckResult,
        status: 'rejected',
        reason: errorMessage,
        texts: textsToCheck.map(t => ({ field: t.fieldName, text: t.text.substring(0, 50) }))
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
      type: 'post_text',
      openid: openid,
      title: title,
      result: textCheckResult,
      status: 'passed'
    }).catch(err => console.error(`[${logId}] 保存审核日志失败:`, err));

    console.log(`[${logId}] 文本审核通过`);

    // 创建帖子数据
    const postData = {
      _openid: openid,
      title: title.trim(),
      content: content.trim(),
      type,
      tags,
      images: images || [],
      videos: videos || [],
      author: {
        ...author,
        openid: openid
      },
      likeCount: 0,
      commentCount: 0,
      collectCount: 0,
      viewCount: 0,
      shareCount: 0,
      isLiked: false,
      isCollected: false,
      createTime: new Date(),
      updateTime: new Date(),
      status: 'published',
      isPublic: true
    };

    console.log('准备保存帖子数据');

    // 保存到数据库
    const result = await postsCollection.add({
      data: postData
    });

    console.log(`[${logId}] 帖子保存成功，ID:`, result._id);

    try {
      // 创建发布成功的系统通知到 notices
      await db.collection('notices').add({
        data: {
          _openid: openid,
          type: 'system',
          title: '发布成功',
          content: `您发布的帖子《${postData.title}》已成功发布`,
          relatedId: result._id,
          relatedType: 'post',
          isRead: false,
          createTime: new Date(),
          updateTime: new Date()
        }
      });
      console.log('系统通知创建成功');
    } catch (messageError) {
      console.warn('创建系统通知失败:', messageError);
      // 通知创建失败不影响帖子发布
    }

    console.log(`[${logId}] ========== 发布成功 ==========`);

    return {
      success: true,
      data: {
        ...postData,
        _id: result._id
      },
      message: '发布成功'
    };

  } catch (error) {
    console.error(`[${logId}] 发布帖子失败:`, error);

    let errorMessage = '发布失败，请重试';
    if (error.code === 'DATABASE_OPERATION_FAILED') {
      errorMessage = '数据库操作失败，请检查网络连接';
    } else if (error.code === 'TIMEOUT') {
      errorMessage = '操作超时，请稍后重试';
    }

    return {
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === 'production' ? undefined : error.message,
      logId: logId
    };
  }
};