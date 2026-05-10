// cloudfunctions/updateFilePermission/index.js
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

exports.main = async (event, context) => {
  try {
    const { fileID } = event;
    
    if (!fileID) {
      return {
        success: false,
        message: '缺少文件ID'
      };
    }
    
    // 获取文件信息
    const fileInfo = await cloud.getTempFileURL({
      fileList: [fileID]
    });
    
    if (!fileInfo.fileList || fileInfo.fileList.length === 0) {
      return {
        success: false,
        message: '文件不存在'
      };
    }
    
    // 这里我们无法直接修改文件权限，因为微信云开发的wx-server-sdk不支持直接修改文件权限
    // 但我们可以返回文件的临时URL，这个URL是公开可访问的
    
    return {
      success: true,
      data: {
        fileID: fileID,
        tempFileURL: fileInfo.fileList[0].tempFileURL
      }
    };
  } catch (error) {
    console.error('更新文件权限失败:', error);
    return {
      success: false,
      message: '更新文件权限失败'
    };
  }
};