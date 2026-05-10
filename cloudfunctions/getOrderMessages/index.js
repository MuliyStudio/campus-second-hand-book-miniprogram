// cloudfunctions/getOrderMessages/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

/**
 * 获取订单消息列表云函数
 * @param {Object} event - 事件对象
 * @param {number} event.page - 页码，默认 1
 * @param {number} event.pageSize - 每页数量，默认 20
 * @param {string} event.orderType - 订单类型：book/material/all
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
        message: '获取用户 openid 失败'
      }
    }
    
    const page = event.page || 1
    const pageSize = event.pageSize || 20
    const orderType = event.orderType || 'all'
    
    const messagesCollection = db.collection('messages')
    
    let query = messagesCollection.where({
      _openid: openid,
      type: 'personal',
      subType: 'order'
    })
    
    const skip = (page - 1) * pageSize
    
    const countResult = await query.count()
    const total = countResult.total
    
    const messagesResult = await query
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get()
    
    const messages = messagesResult.data.map(msg => {
      const fromUserInfo = msg.fromUser || {}
      const toUserInfo = msg.toUser || {}
      
      return {
        _id: msg._id,
        _openid: msg._openid,
        type: msg.type,
        subType: msg.subType,
        title: msg.title,
        content: msg.content,
        relatedId: msg.relatedId,
        relatedType: msg.relatedType,
        amount: msg.amount,
        isRead: msg.isRead,
        createTime: msg.createTime,
        updateTime: msg.updateTime,
        fromUser: {
          openid: fromUserInfo.openid,
          avatarUrl: fromUserInfo.avatarUrl,
          nickname: fromUserInfo.nickname
        },
        toUser: {
          openid: toUserInfo.openid,
          avatarUrl: toUserInfo.avatarUrl,
          nickname: toUserInfo.nickname
        },
        chatuser: msg.chatuser
      }
    })
    
    return {
      success: true,
      message: '获取成功',
      data: {
        messages: messages,
        total,
        page,
        pageSize,
        hasMore: skip + messages.length < total
      }
    }
  } catch (error) {
    console.error('获取订单消息失败:', error)
    return {
      success: false,
      message: '获取订单消息失败',
      error: error.message
    }
  }
}
