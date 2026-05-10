// cloudfunctions/addDownload/index.js
const cloud = require('wx-server-sdk')
cloud.init()

const db = cloud.database()

/**
 * 添加下载记录云函数
 * @param {Object} event - 事件对象
 * @param {string} event.materialId - 资料ID
 * @param {string} event.title - 资料标题
 * @param {string} event.type - 资料类型
 * @param {string} event.fileSize - 文件大小
 * @param {number} event.price - 资料价格
 * @param {string} event.uploaderId - 上传者ID
 * @param {string} event.uploaderName - 上传者名称
 * @param {Object} context - 上下文对象
 * @returns {Object} - 操作结果
 */
exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    
    if (!openid) {
      return {
        success: false,
        message: '获取用户openid失败'
      }
    }
    
    if (!event.materialId || !event.title) {
      return {
        success: false,
        message: '资料ID和标题不能为空'
      }
    }
    
    // 创建下载记录
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const formattedTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    
    const downloadData = {
      _openid: openid,
      materialId: event.materialId,
      title: event.title,
      type: event.type || '',
      fileSize: event.fileSize || '',
      price: event.price || 0,
      uploaderId: event.uploaderId || '',
      uploaderName: event.uploaderName || '',
      downloadTime: formattedTime,
      status: 'completed'
    }
    
    // 添加到数据库
    const result = await db.collection('downloads').add({
      data: downloadData
    })
    
    // 更新资料的下载次数
    try {
      await db.collection('materials')
        .where({ _id: event.materialId })
        .update({
          data: {
            downloadCount: db.command.inc(1),
            updateTime: new Date()
          }
        })
    } catch (updateError) {
      console.error('更新下载次数失败:', updateError)
      // 不影响主流程，继续执行
    }
    
    return {
      success: true,
      message: '下载记录添加成功',
      data: {
        _id: result._id,
        ...downloadData
      }
    }
  } catch (error) {
    console.error('添加下载记录失败:', error)
    return {
      success: false,
      message: '添加下载记录失败',
      error: error.message
    }
  }
}