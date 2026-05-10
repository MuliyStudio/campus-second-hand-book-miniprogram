// cloudfunctions/removeLike/index.js
const cloud = require('wx-server-sdk')
cloud.init()

const db = cloud.database()
const _ = db.command

/**
 * 移除点赞云函数
 * @param {Object} event - 事件对象
 * @param {string} event.itemId - 点赞项ID
 * @param {string} event.type - 点赞类型 (post, comment)
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
    
    if (!event.itemId || !event.type) {
      return {
        success: false,
        message: '点赞项ID和类型不能为空'
      }
    }
    
    // 移除点赞记录
    const result = await db.collection('likes')
      .where({
        _openid: openid,
        itemId: event.itemId,
        type: event.type
      })
      .remove()
    
    if (result.stats.removed === 0) {
      return {
        success: false,
        message: '未找到点赞记录'
      }
    }
    
    // 如果是帖子点赞，更新帖子的点赞数
    if (event.type === 'post') {
      await db.collection('posts').doc(event.itemId).update({
        data: {
          likeCount: _.inc(-1)
        }
      })
    }
    
    return {
      success: true,
      message: '取消点赞成功',
      data: result
    }
  } catch (error) {
    console.error('移除点赞失败:', error)
    return {
      success: false,
      message: '移除点赞失败',
      error: error.message
    }
  }
}