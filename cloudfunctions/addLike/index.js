// cloudfunctions/addLike/index.js
const cloud = require('wx-server-sdk')
cloud.init()

const db = cloud.database()
const _ = db.command

/**
 * 添加点赞云函数
 * @param {Object} event - 事件对象
 * @param {string} event.itemId - 点赞项ID
 * @param {string} event.type - 点赞类型 (post, comment)
 * @param {Object} event.itemData - 点赞项数据
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
    
    // 检查是否已经点赞
    const existingLike = await db.collection('likes')
      .where({
        _openid: openid,
        itemId: event.itemId,
        type: event.type
      })
      .get()
    
    if (existingLike.data.length > 0) {
      return {
        success: false,
        message: '已经点赞过该内容'
      }
    }
    
    // 创建点赞记录
    const likeData = {
      _openid: openid,
      itemId: event.itemId,
      type: event.type,
      itemData: event.itemData || {},
      createTime: new Date(),
      status: 'active'
    }
    
    // 添加到数据库
    const result = await db.collection('likes').add({
      data: likeData
    })
    
    // 如果是帖子点赞，更新帖子的点赞数
    if (event.type === 'post') {
      await db.collection('posts').doc(event.itemId).update({
        data: {
          likeCount: _.inc(1)
        }
      })

      // 发送系统消息给发布者
      try {
        const postResult = await db.collection('posts').doc(event.itemId).get()
        if (postResult.data && postResult.data._openid !== openid) {
          const postAuthorId = postResult.data._openid
          const postTitle = postResult.data.title || '帖子'

          // 获取点赞者信息
          const userResult = await db.collection('users').where({
            _openid: openid
          }).get()

          const likerName = userResult.data[0]?.nickname || '用户'

          await cloud.callFunction({
            name: 'sendSystemMessage',
            data: {
              receiverOpenid: postAuthorId,
              title: '收到新点赞',
              content: `${likerName} 赞了你的帖子《${postTitle}》`,
              type: 'like',
              relatedId: event.itemId,
              relatedType: 'post'
            }
          })
          console.log('已发送点赞通知给发布者')
        }
      } catch (msgError) {
        console.warn('发送点赞通知失败:', msgError)
      }
    }

    return {
      success: true,
      message: '点赞成功',
      data: {
        _id: result._id,
        ...likeData
      }
    }
  } catch (error) {
    console.error('添加点赞失败:', error)
    return {
      success: false,
      message: '添加点赞失败',
      error: error.message
    }
  }
}