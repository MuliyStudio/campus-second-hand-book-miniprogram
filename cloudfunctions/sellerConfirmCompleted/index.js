// cloudfunctions/sellerConfirmCompleted/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

/**
 * 确认订单已完成云函数
 * 买家或卖家在对方确认处理后，点击"确认已完成"完成订单
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

    console.log('=== 确认订单已完成开始 ===')
    console.log('openid:', openid)
    console.log('orderId:', orderId)
    console.log('category:', category)

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
    const orderSellerId = order.sellerId || order._openid
    const orderBuyerId = order.buyerId
    const isBuyer = (orderBuyerId === openid)
    const isSeller = (orderSellerId === openid)

    console.log('订单数据:', JSON.stringify({
      _id: order._id,
      orderId: order.orderId,
      status: order.status,
      sellerProcessed: order.sellerProcessed,
      buyerProcessed: order.buyerProcessed,
      isBuyer: isBuyer,
      isSeller: isSeller
    }, null, 2))

    // 验证身份：买家或卖家都可以点击确认完成
    if (!isBuyer && !isSeller) {
      console.log('验证身份失败')
      return {
        success: false,
        message: '无权操作此订单'
      }
    }

    // 验证订单状态必须为 processing
    if (order.status !== 'processing') {
      console.log('订单状态不正确，当前状态:', order.status)
      return {
        success: false,
        message: `订单状态不正确，当前状态：${order.statusText || order.status}`
      }
    }

    // 根据身份标记已确认
    const updateData = {
      updateTime: db.serverDate()
    }

    if (isBuyer) {
      updateData.buyerProcessed = true
      updateData.buyerCompleteTime = db.serverDate()
    }

    if (isSeller) {
      updateData.sellerProcessed = true
      updateData.sellerCompleteTime = db.serverDate()
    }

    // 判断是否双方都已确认
    const bothConfirmed = (order.sellerProcessed || isSeller) && (order.buyerProcessed || isBuyer)

    if (bothConfirmed) {
      // 双方都确认完成，订单状态变为已完成
      updateData.status = 'completed'
      updateData.statusText = '已完成'
      updateData.completeTime = db.serverDate()
    }

    await orderCollection.doc(orderId).update({
      data: updateData
    })

    console.log('更新数据:', JSON.stringify(updateData))

    // 发送通知
    const receiverId = isBuyer ? orderSellerId : orderBuyerId
    const itemInfo = order.bookInfo || order.materialInfo || {}
    const isBook = !!order.bookInfo

    try {
      await cloud.callFunction({
        name: 'sendSystemMessage',
        data: {
          receiverOpenid: receiverId,
          title: isBuyer ? '买家已确认完成' : '卖家已确认完成',
          content: `${isBuyer ? '买家' : '卖家'}已确认《${itemInfo.title}》交易完成。`,
          type: 'order',
          relatedId: order.orderId,
          relatedType: isBook ? 'book_order' : 'material_order'
        }
      })
      console.log('已发送通知')
    } catch (msgError) {
      console.warn('发送通知失败:', msgError)
    }

    console.log('=== 确认订单已完成成功 ===')

    return {
      success: true,
      message: bothConfirmed ? '订单已完成' : '已确认，等待对方确认',
      data: {
        orderId: orderId,
        newStatus: bothConfirmed ? 'completed' : 'processing'
      }
    }

  } catch (error) {
    console.error('=== 确认订单已完成失败 ===')
    console.error('错误信息:', error)
    console.error('错误堆栈:', error.stack)
    return {
      success: false,
      message: `操作失败：${error.message}`,
      error: error.message
    }
  }
}
