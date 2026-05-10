// cloudfunctions/togglePostPublic/index.js
const cloud = require('wx-server-sdk')
cloud.init()

const db = cloud.database()

/**
 * 切换帖子公开状态云函数
 * @param {Object} event - 事件对象
 * @param {string} event.postId - 帖子ID
 * @param {Object} context - 上下文对象
 * @returns {Object} - 操作结果
 */
exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    
    if (!openid) {
      return {
        success: false,
        message: '获取用户openid失败'
      }
    }
    
    if (!event.postId) {
      return {
        success: false,
        message: '帖子ID不能为空'
      }
    }
    
    // 检查帖子是否存在且属于当前用户
    const post = await db.collection('posts')
      .where({
        _id: event.postId,
        _openid: openid
      })
      .get()
    
    if (post.data.length === 0) {
      return {
        success: false,
        message: '帖子不存在或无权限操作'
      }
    }
    
    // 切换公开状态
    const currentPost = post.data[0]
    const newPublicStatus = !currentPost.isPublic
    
    await db.collection('posts')
      .doc(event.postId)
      .update({
        data: {
          isPublic: newPublicStatus
        }
      })
    
    return {
      success: true,
      message: '切换帖子状态成功',
      data: {
        postId: event.postId,
        isPublic: newPublicStatus
      }
    }
  } catch (error) {
    console.error('切换帖子状态失败:', error)
    return {
      success: false,
      message: '切换帖子状态失败',
      error: error.message
    }
  }
}