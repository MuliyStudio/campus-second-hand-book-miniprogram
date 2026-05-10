const cloud = require('wx-server-sdk')
cloud.init()

const db = cloud.database()

/**
 * 获取学习资料列表云函数
 * @param {Object} event - 事件对象
 * @param {number} event.page - 页码，默认1
 * @param {number} event.pageSize - 每页数量，默认10
 * @param {string} event.type - 查询类型，默认'all'，'user'表示查询当前用户的资料
 * @param {boolean} event.showFreeOnly - 是否只显示免费资料
 * @param {Object} context - 上下文对象
 * @returns {Object} - 操作结果
 */
exports.main = async (event, context) => {
  try {
    const page = event.page || 1
    const pageSize = event.pageSize || 10
    const type = event.type || 'all'
    const showFreeOnly = event.showFreeOnly || false

    // 获取当前用户的openid
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID

    // 构建查询条件
    let filter = {}

    // 添加免费筛选
    if (showFreeOnly) {
      filter.isFree = true
    }

    // 查询总数
    const countResult = await db.collection('materials')
      .where(filter)
      .count()
    const total = countResult.total

    // 计算跳过的记录数
    const skip = (page - 1) * pageSize

    // 根据类型查询资料
    let materialsResult
    
    if (type === 'user') {
      // 查询当前用户的所有资料
      materialsResult = await db.collection('materials')
        .where({
          _openid: openid,
          ...filter
        })
        .orderBy('createTime', 'desc')
        .skip(skip)
        .limit(pageSize)
        .get()
    } else if (type !== 'all') {
      // 按类型筛选，按收藏量降序排序
      materialsResult = await db.collection('materials')
        .where({
          type: type,
          ...filter
        })
        .orderBy('favoritesCount', 'desc')
        .orderBy('createTime', 'desc')
        .skip(skip)
        .limit(pageSize)
        .get()
    } else {
      // 查询所有资料，按收藏数降序排序
      materialsResult = await db.collection('materials')
        .where(filter)
        .orderBy('favoritesCount', 'desc')
        .skip(skip)
        .limit(pageSize)
        .get()
    }

    // 处理数据，添加isOwner字段
    const materials = materialsResult.data.map(material => ({
      ...material,
      isOwner: material._openid === openid
    }))

    return {
      success: true,
      message: '获取成功',
      data: {
        materials: materials,
        total,
        page,
        pageSize,
        hasMore: skip + materials.length < total
      }
    }
  } catch (error) {
    console.error('获取资料列表失败:', error)
    return {
      success: false,
      message: '获取资料列表失败',
      error: error.message
    }
  }
}
