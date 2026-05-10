// cloudfunctions/removeComment/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

/**
 * 移除评论云函数
 * @param {Object} event - 事件对象
 * @param {string} event.commentId - 评论ID
 * @param {Object} context - 上下文对象
 * @returns {Object} - 操作结果
 */
exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    
    console.log('=== 云函数调用开始 - removeComment ===')
    console.log('用户openid:', openid)
    console.log('事件参数:', event)
    
    if (!openid) {
      console.error('获取用户openid失败')
      return {
        success: false,
        message: '获取用户openid失败'
      }
    }
    
    if (!event.commentId) {
      console.error('评论ID为空')
      return {
        success: false,
        message: '评论ID不能为空'
      }
    }
    
    const { commentId } = event
    
    // 检查评论是否存在且属于当前用户
    const commentResult = await db.collection('comments')
      .doc(commentId)
      .get()
    
    if (!commentResult.data) {
      console.error('评论不存在')
      return {
        success: false,
        message: '评论不存在或无权限删除'
      }
    }
    
    const comment = commentResult.data
    
    // 检查是否是评论的作者
    if (comment._openid !== openid) {
      console.error('无权限删除评论')
      return {
        success: false,
        message: '无权限删除此评论'
      }
    }
    
    console.log('准备删除评论:', commentId)
    
    // 删除评论
    const result = await db.collection('comments')
      .doc(commentId)
      .remove()
    
    console.log('评论删除成功:', result)
    
    // 更新帖子的评论数
    if (comment.postId) {
      try {
        await db.collection('posts').doc(comment.postId).update({
          data: {
            commentCount: _.inc(-1)
          }
        })
        console.log('更新帖子评论数成功')
      } catch (error) {
        console.error('更新帖子评论数失败:', error)
      }
    }
    
    // 如果是回复评论，减少父评论的回复数
    if (comment.parentId) {
      try {
        await db.collection('comments').doc(comment.parentId).update({
          data: {
            replyCount: _.inc(-1)
          }
        })
        console.log('更新父评论回复数成功')
      } catch (error) {
        console.error('更新父评论回复数失败:', error)
      }
    } else {
      // 如果是主评论，级联删除所有回复
      try {
        const repliesResult = await db.collection('comments')
          .where({
            parentId: commentId,
            status: 'active'
          })
          .get()
        
        console.log('找到回复数量:', repliesResult.data.length)
        
        if (repliesResult.data.length > 0) {
          const deletePromises = repliesResult.data.map(reply => 
            db.collection('comments').doc(reply._id).remove()
          )
          await Promise.all(deletePromises)
          console.log('级联删除回复成功，删除数量:', repliesResult.data.length)
        }
      } catch (error) {
        console.error('级联删除回复失败:', error)
      }
    }
    
    console.log('=== 云函数调用结束 - removeComment ===')
    
    return {
      success: true,
      message: '删除评论成功',
      data: result
    }
  } catch (error) {
    console.error('删除评论失败:', error)
    console.error('错误堆栈:', error.stack)
    return {
      success: false,
      message: '删除评论失败，请重试',
      error: error.message
    }
  }
}