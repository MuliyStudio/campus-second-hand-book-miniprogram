const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    
    const { itemId, type } = event
    
    if (!itemId || !type) {
      return {
        success: false,
        message: '缺少必要参数'
      }
    }
    
    const result = await db.collection('favorites').where({
      _openid: openid,
      itemId: itemId,
      type: type
    }).get()
    
    const isFavorite = result.data.length > 0
    const favoriteId = isFavorite ? result.data[0]._id : null
    
    return {
      success: true,
      data: {
        isFavorite,
        favoriteId
      }
    }
  } catch (error) {
    console.error('检查收藏状态失败:', error)
    return {
      success: false,
      message: '检查收藏状态失败',
      error: error.message
    }
  }
}
