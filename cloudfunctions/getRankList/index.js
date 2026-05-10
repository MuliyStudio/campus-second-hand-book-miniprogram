// 云函数入口文件
const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})
const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const { type = 'materials', limit = 10 } = event
  
  try {
    let result = []
    
    if (type === 'materials') {
      // 获取资料排行榜，按收藏量降序排序
      // 注意：排行榜专属于资料，不包含书籍
      const materialsResult = await db.collection('materials')
        .orderBy('favoritesCount', 'desc')  // 按收藏量降序
        .orderBy('createTime', 'desc')  // 收藏量相同时按时间降序
        .limit(limit)
        .get()
      
      // 格式化返回数据，确保包含所有必要字段
      result = materialsResult.data.map((item, index) => {
        // 确保有author信息
        let author = item.author || {};
        if (!author.nickname) {
          author = {
            _openid: item._openid,
            nickname: '未知作者',
            avatarUrl: ''
          };
        }
        
        return {
          _id: item._id,
          rank: index + 1,  // 排名
          title: item.title,
          type: item.type || '资料',  // 资料类型
          format: item.format || '',
          fileSize: item.fileSize || '',
          price: item.price || 0,
          isFree: item.isFree || false,
          fileId: item.fileId || '',
          coverUrl: item.coverUrl || '',
          favoritesCount: item.favoritesCount || 0,  // 收藏量
          downloadCount: item.downloadCount || 0,  // 下载量
          createTime: item.createTime,
          author: author
        }
      })
    }
    
    return {
      success: true,
      data: result
    }
  } catch (err) {
    console.error('获取排行榜失败:', err)
    return {
      success: false,
      message: err.message
    }
  }
}
