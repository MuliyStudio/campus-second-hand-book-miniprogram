// cloudfunctions/updateMaterialStatus/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

/**
 * 更新资料状态云函数
 * @param {Object} event - 事件对象
 * @param {string} event.materialId - 资料 ID
 * @param {string} event.status - 新状态：available/offline/reserved
 * @param {Object} context - 上下文对象
 * @returns {Object} - 操作结果
 */
exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    
    const { materialId, status } = event
    
    if (!materialId || !status) {
      return {
        success: false,
        message: '缺少必要参数'
      }
    }
    
    // 查询资料详情
    const materialResult = await db.collection('materials').doc(materialId).get()
    if (!materialResult.data) {
      return {
        success: false,
        message: '资料不存在'
      }
    }
    
    const material = materialResult.data
    
    // 验证权限：只能是发布者本人操作
    if (material._openid !== openid) {
      return {
        success: false,
        message: '无权操作此资料'
      }
    }
    
    // 状态映射
    const statusMap = {
      'available': '在售',
      'offline': '已下架',
      'reserved': '预定中'
    }
    
    // 更新资料状态
    await db.collection('materials').doc(materialId).update({
      data: {
        status: status,
        statusText: statusMap[status] || '未知',
        updateTime: db.serverDate()
      }
    })
    
    return {
      success: true,
      message: `资料已${status === 'available' ? '上架' : status === 'offline' ? '下架' : '预定'}`,
      data: {
        materialId: materialId,
        newStatus: status,
        statusText: statusMap[status]
      }
    }
  } catch (error) {
    console.error('更新资料状态失败:', error)
    return {
      success: false,
      message: '更新资料状态失败',
      error: error.message
    }
  }
}
