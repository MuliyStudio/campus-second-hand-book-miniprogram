// cloudfunctions/sellerConfirmProcessed/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

/**
 * 卖家确认已处理云函数
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

    console.log('=== 卖家确认已处理开始 ===')
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
      sellerId: order.sellerId,
      _openid: order._openid
    }, null, 2))

    // 验证是否为卖家（兼容 sellerId 和 _openid）
    const orderSellerId = order.sellerId || order._openid
    if (orderSellerId !== openid) {
      console.log('验证卖家身份失败')
      console.log('orderSellerId:', orderSellerId)
      console.log('openid:', openid)
      return {
        success: false,
        message: '只有卖家可以确认已处理'
      }
    }

    // 验证订单状态 - 卖家可以处理 pending 和 pending_processing 状态的订单
    if (order.status !== 'pending' && order.status !== 'pending_processing') {
      console.log('订单状态不正确')
      console.log('当前状态:', order.status)
      return {
        success: false,
        message: `订单状态不正确，当前状态：${order.statusText || order.status}`
      }
    }

    // 更新订单状态为"处理中"，标记卖家已确认
    await orderCollection.doc(orderId).update({
      data: {
        status: 'processing',
        statusText: '处理中',
        sellerConfirmTime: db.serverDate(),
        sellerProcessed: true,
        updateTime: db.serverDate()
      }
    })

    // 发送通知给买家
    const buyerId = order.buyerId
    const itemInfo = order.bookInfo || order.materialInfo || {}
    const isBook = !!order.bookInfo

    try {
      await cloud.callFunction({
        name: 'sendSystemMessage',
        data: {
          receiverOpenid: buyerId,
          title: '卖家已确认',
          content: `卖家已确认《${itemInfo.title}》正在处理，请耐心等待。`,
          type: 'order',
          relatedId: order.orderId,
          relatedType: isBook ? 'book_order' : 'material_order'
        }
      })
      console.log('已发送通知给买家')
    } catch (msgError) {
      console.warn('发送通知失败:', msgError)
    }

    console.log('=== 卖家确认已处理成功 ===')

    return {
      success: true,
      message: '确认成功，订单进入处理中状态',
      data: {
        orderId: orderId,
        newStatus: 'processing'
      }
    }

  } catch (error) {
    console.error('=== 卖家确认失败 ===')
    console.error('错误信息:', error)
    console.error('错误堆栈:', error.stack)
    return {
      success: false,
      message: `操作失败：${error.message}`,
      error: error.message
    }
  }
}