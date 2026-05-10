// cloudfunctions/getMaterialDetail/index.js
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const materialsCollection = db.collection('materials');
const usersCollection = db.collection('users');

exports.main = async (event, context) => {
  try {
    const { materialId } = event;
    
    // 验证必填字段
    if (!materialId) {
      return {
        success: false,
        message: '缺少资料ID'
      };
    }
    
    // 获取资料详情
    const materialResult = await materialsCollection.doc(materialId).get();
    
    if (!materialResult.data) {
      return {
        success: false,
        message: '资料不存在'
      };
    }
    
    let material = materialResult.data;
    
    // 获取上传者的完整用户信息
    if (material.author) {
      try {
        let userResult;
        if (material.author._id) {
          // 通过用户ID获取信息
          userResult = await usersCollection.doc(material.author._id).get();
        } else if (material._openid) {
          // 通过openid获取信息
          userResult = await usersCollection.where({ _openid: material._openid }).get();
          userResult = { data: userResult.data && userResult.data.length > 0 ? [userResult.data[0]] : [] };
        }
        
        if (userResult && userResult.data && userResult.data.length > 0) {
          material.author = {
            ...material.author,
            _id: userResult.data[0]._id,
            college: userResult.data[0].college || '',
            major: userResult.data[0].major || '',
            campus: userResult.data[0].campus || '',
            dorm: userResult.data[0].dorm || ''
          };
        }
      } catch (error) {
        console.error('获取用户信息失败:', error);
        // 不影响获取资料详情的结果
      }
    }
    
    // 格式化时间
    function formatTime(date) {
      if (!date) return '';
      const d = new Date(date);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day} ${hours}:${minutes}`;
    }
    
    // 构建完整的资料数据
    const materialData = {
      ...material,
      downloads: material.downloadCount || 0,
      downloadCount: material.downloadCount || 0,
      favoriteCount: material.favoritesCount || material.favoriteCount || 0,
      uploadTime: formatTime(material.createTime),
      size: material.fileSize,
      uploaderId: material.author._id,
      uploaderAvatar: material.author.avatarUrl,
      uploaderName: material.author.nickname,
      uploaderStudentId: material.studentId,
      uploaderCollege: material.author.college || '',
      uploaderMajor: material.author.major || '',
      uploaderCampus: material.author.campus || '',
      uploaderDorm: material.author.dorm || '',
      typeText: material.type,
      type: material.type.toLowerCase()
    };
    
    return {
      success: true,
      data: materialData,
      message: '获取资料详情成功'
    };
    
  } catch (error) {
    console.error('获取资料详情失败:', error);
    return {
      success: false,
      message: '获取资料详情失败，请重试'
    };
  }
};