// cloudfunctions/submitRating/index.js
const cloud = require('wx-server-sdk')
cloud.init()

const db = cloud.database()

/**
 * 提交评分云函数
 * @param {Object} event - 事件对象
 * @param {string} event.orderId - 订单 ID
 * @param {string} event.category - 商品分类：book 或 material
 * @param {number} event.rating - 评分 0-5
 * @param {Object} context - 上下文对象
 * @returns {Object} - 操作结果
 */
exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    
    const { orderId, category, rating } = event
    
    if (!orderId || !category || rating === undefined) {
      return {
        success: false,
        message: '参数不完整'
      }
    }
    
    if (rating < 0 || rating > 5) {
      return {
        success: false,
        message: '评分必须在 0-5 之间'
      }
    }
    
    // 检查是否已经评分过
    const ratingCollection = db.collection('ratings')
    const existingRating = await ratingCollection.where({
      orderId: orderId,
      buyerId: openid
    }).get()
    
    if (existingRating.data.length > 0) {
      return {
        success: false,
        message: '您已经评价过该订单，不能重复评价'
      }
    }
    
    // 查询订单信息获取卖家 openid
    const orderCollection = db.collection(category === 'book' ? 'book_orders' : 'material_orders')
    const order = await orderCollection.doc(orderId).get()
    
    if (!order.data) {
      return {
        success: false,
        message: '订单不存在'
      }
    }
    
    const orderData = order.data
    const sellerId = orderData.sellerId
    
    // 创建评分记录
    const ratingData = {
      _openid: openid,
      orderId: orderId,
      category: category,
      buyerId: openid,
      sellerId: sellerId,
      rating: rating,
      createTime: db.serverDate()
    }
    
    const createResult = await ratingCollection.add({
      data: ratingData
    })
    
    // 计算信誉分变化
    let creditChange = 0
    switch (rating) {
      case 0:
        creditChange = -3
        break
      case 1:
        creditChange = -2
        break
      case 2:
        creditChange = -1
        break
      case 3:
        creditChange = 0
        break
      case 4:
        creditChange = 1
        break
      case 5:
        creditChange = 2
        break
    }
    
    // 更新卖家信誉分
    if (creditChange !== 0 && sellerId) {
      const usersCollection = db.collection('users')
      const user = await usersCollection.where({
        _openid: sellerId
      }).get()
      
      if (user.data.length > 0) {
        const currentCredit = user.data[0].creditScore || 0
        const newCredit = Math.min(100, Math.max(0, currentCredit + creditChange))
        
        await usersCollection.where({
          _openid: sellerId
        }).update({
          data: {
            creditScore: newCredit
          }
        })
      }
    }
    
    // 更新订单状态为已评价
    await orderCollection.doc(orderId).update({
      data: {
        rating: rating,
        rated: true
      }
    })
    
    return {
      success: true,
      message: '评价成功',
      data: {
        ratingId: createResult._id,
        creditChange: creditChange
      }
    }
  } catch (error) {
    console.error('提交评分失败:', error)
    return {
      success: false,
      message: '提交评分失败',
      error: error.message
    }
  }
}
