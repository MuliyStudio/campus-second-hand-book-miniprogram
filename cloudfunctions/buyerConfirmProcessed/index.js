// cloudfunctions/buyerConfirmProcessed/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

/**
 * 买家确认已处理云函数
 * 将订单状态从"待处理"变为"处理中"
 * @param {Object} event - 事件对象
 * @param {string} event.orderId - 订单 ID
 * @param {string} event.category - 订单分类：book 或 material
 * @param {Object} context - 上下文对象
 * @returns {Object} - 操作结果
 */
exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID

    const orderId = event.orderId
    const category = event.category || 'book'

    if (!orderId) {
      return {
        success: false,
        message: '订单 ID 不能为空'
      }
    }

    const collectionName = category === 'book' ? 'book_orders' : 'material_orders'
    const orderCollection = db.collection(collectionName)

    console.log('=== 买家确认已处理开始 ===')
    console.log('openid:', openid)
    console.log('orderId:', orderId)
    console.log('category:', category)
    console.log('collectionName:', collectionName)

    // 查询订单
    const orderResult = await orderCollection.doc(orderId).get()

    if (!orderResult.data) {
      console.log('订单不存在，orderId:', orderId)
      return {
        success: false,
        message: '订单不存在'
      }
    }

    const order = orderResult.data
    console.log('订单数据:', JSON.stringify({
      _id: order._id,
      orderId: order.orderId,
      status: order.status,
      buyerId: order.buyerId,
      _openid: order._openid
    }, null, 2))

    // 验证是否为买家（兼容 buyerId 和 _openid）
    const orderBuyerId = order.buyerId || order._openid
    if (orderBuyerId !== openid) {
      console.log('验证买家身份失败')
      console.log('orderBuyerId:', orderBuyerId)
      console.log('openid:', openid)
      return {
        success: false,
        message: '只有买家可以确认已处理'
      }
    }

    // 验证订单状态
    if (order.status !== 'pending_processing') {
      console.log('订单状态不正确')
      console.log('当前状态:', order.status)
      return {
        success: false,
        message: `订单状态不正确，当前状态：${order.statusText || order.status}`
      }
    }

    // 更新订单状态为"处理中"，标记买家已确认
    await orderCollection.doc(orderId).update({
      data: {
        status: 'processing',
        statusText: '处理中',
        buyerConfirmTime: db.serverDate(),
        buyerProcessed: true,
        updateTime: db.serverDate()
      }
    })

    // 发送通知给卖家
    const sellerId = order.sellerId
    const itemInfo = order.bookInfo || order.materialInfo || {}
    const isBook = !!order.bookInfo

    try {
      await cloud.callFunction({
        name: 'sendSystemMessage',
        data: {
          receiverOpenid: sellerId,
          title: '买家已确认',
          content: `买家已确认《${itemInfo.title}》已处理，请尽快完成交易。`,
          type: 'order',
          relatedId: order.orderId,
          relatedType: isBook ? 'book_order' : 'material_order'
        }
      })
      console.log('已发送通知给卖家')
    } catch (msgError) {
      console.warn('发送通知失败:', msgError)
    }

    console.log('=== 买家确认已处理成功 ===')

    return {
      success: true,
      message: '确认成功，订单进入处理中状态',
      data: {
        orderId: orderId,
        newStatus: 'processing'
      }
    }

  } catch (error) {
    console.error('=== 买家确认失败 ===')
    console.error('错误信息:', error)
    console.error('错误堆栈:', error.stack)
    return {
      success: false,
      message: `操作失败：${error.message}`,
      error: error.message
    }
  }
}
