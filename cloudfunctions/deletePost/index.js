// cloudfunctions/deletePost/index.js
const cloud = require('wx-server-sdk')
cloud.init()

const db = cloud.database()

/**
 * 删除帖子云函数
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
        message: '帖子不存在或无权限删除'
      }
    }
    
    // 删除帖子
    await db.collection('posts')
      .doc(event.postId)
      .remove()
    
    // 级联删除相关的点赞记录
    await db.collection('likes')
      .where({
        itemId: event.postId,
        type: 'post'
      })
      .remove()
    
    // 级联删除相关的收藏记录
    await db.collection('favorites')
      .where({
        itemId: event.postId,
        type: 'post'
      })
      .remove()
    
    // 级联删除相关的评论
    await db.collection('comments')
      .where({
        postId: event.postId
      })
      .remove()
    
    return {
      success: true,
      message: '删除帖子成功'
    }
  } catch (error) {
    console.error('删除帖子失败:', error)
    return {
      success: false,
      message: '删除帖子失败',
      error: error.message
    }
  }
}