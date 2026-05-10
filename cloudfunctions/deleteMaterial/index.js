// cloudfunctions/deleteMaterial/index.js
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    
    if (!openid) {
      return {
        success: false,
        message: '获取用户openid失败'
      };
    }
    
    if (!event.materialId) {
      return {
        success: false,
        message: '资料ID不能为空'
      };
    }
    
    // 检查资料是否存在且属于当前用户
    const material = await db.collection('materials')
      .where({
        _id: event.materialId,
        _openid: openid
      })
      .get();
    
    if (material.data.length === 0) {
      return {
        success: false,
        message: '资料不存在或无权限删除'
      };
    }
    
    // 删除资料
    await db.collection('materials')
      .doc(event.materialId)
      .remove();
    
    // 先获取所有收藏该资料的用户
    const favorites = await db.collection('favorites')
      .where({
        itemId: event.materialId,
        type: 'material'
      })
      .get();
    
    // 删除相关的收藏记录
    await db.collection('favorites')
      .where({
        itemId: event.materialId,
        type: 'material'
      })
      .remove();
    
    // 如果有收藏记录，更新相关用户的收藏计数
    if (favorites.data.length > 0) {
      // 对每个用户减少收藏计数
      for (const favorite of favorites.data) {
        await db.collection('users').doc(favorite._openid).update({
          data: {
            favoritesCount: db.command.inc(-1)
          }
        });
      }
    }
    
    // 创建删除成功的系统通知到 notices
    try {
      await db.collection('notices').add({
        data: {
          _openid: openid,
          type: 'system',
          title: '删除成功',
          content: `您的资料已成功删除`,
          relatedId: event.materialId,
          relatedType: 'material',
          isRead: false,
          createTime: new Date(),
          updateTime: new Date()
        }
      });
    } catch (error) {
      console.error('创建系统通知失败:', error);
      // 继续执行，不影响资料删除
    }
    
    return {
      success: true,
      message: '删除资料成功'
    };
    
  } catch (error) {
    console.error('删除资料失败:', error);
    return {
      success: false,
      message: '删除资料失败，请重试'
    };
  }
};