// cloudfunctions/updateDownloadCount/index.js
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const materialsCollection = db.collection('materials');

exports.main = async (event, context) => {
  try {
    const { materialId } = event;
    
    if (!materialId) {
      return {
        success: false,
        message: '缺少资料ID'
      };
    }
    
    // 更新下载计数
    const result = await materialsCollection.doc(materialId).update({
      data: {
        downloads: db.command.inc(1),
        downloadCount: db.command.inc(1)
      }
    });
    
    return {
      success: true,
      data: result
    };
  } catch (error) {
    console.error('更新下载计数失败:', error);
    return {
      success: false,
      message: '更新下载计数失败'
    };
  }
};