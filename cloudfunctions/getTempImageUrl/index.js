// 云函数：getTempImageUrl - 利用管理员权限获取云存储文件的临时URL
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

exports.main = async (event, context) => {
  try {
    const { fileList = [] } = event

    if (!fileList || fileList.length === 0) {
      return {
        success: true,
        fileList: []
      }
    }

    // 过滤出 cloud:// 开头的文件ID
    const cloudFileIds = fileList.filter(id => id && typeof id === 'string' && id.startsWith('cloud://'))

    if (cloudFileIds.length === 0) {
      return {
        success: true,
        fileList: []
      }
    }

    const result = await cloud.getTempFileURL({
      fileList: cloudFileIds
    })

    return {
      success: true,
      fileList: result.fileList || []
    }
  } catch (error) {
    console.error('getTempImageUrl 云函数执行失败:', error)
    return {
      success: false,
      message: error.message || '获取临时URL失败',
      fileList: []
    }
  }
}
