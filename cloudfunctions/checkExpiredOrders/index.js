// cloudfunctions/checkExpiredOrders/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

/**
 * 检查并处理超时未付款的订单
 * 规则：订单状态为pending_payment且创建时间超过30分钟，则自动完成订单
 */
exports.main = async (event, context) => {
  try {
    console.log('开始检查超时订单...')

    // 获取当前时间（30分钟前）
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000)

    // 1. 查找超时未付款的书籍订单
    const expiredOrders = await db.collection('book_orders')
      .where({
        status: 'pending_payment',
        createTime: _.lt(thirtyMinutesAgo)
      })
      .get()

    console.log(`找到 ${expiredOrders.data.length} 个超时订单`)

    // 2. 处理每个超时订单
    const results = []

    for (const order of expiredOrders.data) {
      try {
        console.log(`处理订单: ${order.orderId}, 创建时间: ${order.createTime}`)

        // 2.1 更新订单状态为已取消
        await db.collection('book_orders').doc(order._id).update({
          data: {
            status: 'cancelled',
            statusText: '已取消',
            cancelReason: '超时未付款',
            cancelTime: db.serverDate(),
            updateTime: db.serverDate()
          }
        })

        console.log(`订单 ${order.orderId} 已取消`)

        // 2.2 恢复书籍状态为可售
        await db.collection('books').doc(order.bookId).update({
          data: {
            status: 'available',
            statusText: '在售',
            updateTime: db.serverDate()
          }
        })

        console.log(`书籍 ${order.bookId} 已恢复为可售状态`)

        // 2.3 发送系统通知给买家（写入 notices 表）
        try {
          await cloud.callFunction({
            name: 'sendSystemMessage',
            data: {
              receiverOpenid: order.buyerId,
              title: '订单已取消',
              content: `您的订单《${order.title}》因超时未付款已自动取消，书籍已重新上架。`,
              type: 'order',
              relatedId: order.orderId,
              relatedType: 'book_order'
            }
          })
          console.log(`已发送取消通知给买家 ${order.buyerId}`)
        } catch (msgError) {
          console.warn('发送买家通知失败:', msgError)
        }

        // 2.4 发送系统通知给卖家（写入 notices 表）
        try {
          await cloud.callFunction({
            name: 'sendSystemMessage',
            data: {
              receiverOpenid: order.sellerId,
              title: '订单已取消',
              content: `买家订单《${order.title}》因超时未付款已自动取消，书籍已重新上架。`,
              type: 'order',
              relatedId: order.orderId,
              relatedType: 'book_order'
            }
          })
          console.log(`已发送取消通知给卖家 ${order.sellerId}`)
        } catch (msgError) {
          console.warn('发送卖家通知失败:', msgError)
        }

        // 2.5 恢复收藏状态（如果有）
        try {
          await db.collection('favorites').where({
            _openid: order.buyerId,
            itemId: order.bookId,
            type: 'book'
          }).update({
            data: {
              status: 'available',
              statusText: '可购买',
              updateTime: db.serverDate()
            }
          })
          console.log(`已恢复收藏状态`)
        } catch (favError) {
          console.warn('恢复收藏状态失败:', favError)
        }

        results.push({
          orderId: order.orderId,
          status: 'success',
          bookId: order.bookId
        })

      } catch (orderError) {
        console.error(`处理订单 ${order.orderId} 失败:`, orderError)
        results.push({
          orderId: order.orderId,
          status: 'failed',
          error: orderError.message
        })
      }
    }

    return {
      success: true,
      message: `检查完成，共处理 ${expiredOrders.data.length} 个超时订单`,
      data: {
        totalOrders: expiredOrders.data.length,
        successCount: results.filter(r => r.status === 'success').length,
        failedCount: results.filter(r => r.status === 'failed').length,
        details: results
      }
    }

  } catch (error) {
    console.error('检查超时订单失败:', error)
    return {
      success: false,
      message: '检查超时订单失败',
      error: error.message
    }
  }
}
