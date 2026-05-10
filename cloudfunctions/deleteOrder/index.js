const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    
    const { orderId, category } = event
    
    if (!orderId) {
      return {
        success: false,
        message: '缺少订单ID'
      }
    }
    
    const collectionName = category === 'material' ? 'material_orders' : 'book_orders'
    const orderCollection = db.collection(collectionName)
    
    const orderResult = await orderCollection.doc(orderId).get()
    
    if (!orderResult.data) {
      return {
        success: false,
        message: '订单不存在'
      }
    }
    
    const order = orderResult.data
    
    if (order.buyerId !== openid && order.sellerId !== openid) {
      return {
        success: false,
        message: '无权删除此订单'
      }
    }
    
    if (order.status !== 'cancelled') {
      return {
        success: false,
        message: '只能删除已取消的订单'
      }
    }
    
    await orderCollection.doc(orderId).remove()
    
    return {
      success: true,
      message: '订单删除成功'
    }
  } catch (error) {
    console.error('删除订单失败:', error)
    return {
      success: false,
      message: '删除订单失败',
      error: error.message
    }
  }
}
