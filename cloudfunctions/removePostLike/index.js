// cloudfunctions/removePostLike/index.js
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const likesCollection = db.collection('likes');
const postsCollection = db.collection('posts');

exports.main = async (event, context) => {
  try {
    console.log('=== 云函数调用开始 - removePostLike ===');
    
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    const { postId } = event;
    
    console.log('环境信息:', { openid });
    console.log('事件参数:', event);
    
    if (!openid) {
      console.error('获取用户openid失败');
      return {
        success: false,
        message: '获取用户openid失败'
      };
    }
    
    if (!postId) {
      console.error('缺少帖子ID');
      return {
        success: false,
        message: '缺少帖子ID'
      };
    }
    
    // 查找点赞记录
    try {
      const likeResult = await likesCollection
        .where({
          _openid: openid,
          itemId: postId,
          type: 'post',
          status: 'active'
        })
        .get();
      
      if (!likeResult.data || likeResult.data.length === 0) {
        console.log('帖子未点赞:', postId);
        return {
          success: true,
          message: '帖子未点赞'
        };
      }
      
      const likeId = likeResult.data[0]._id;
      console.log('找到点赞记录:', likeId);
      
      // 删除点赞记录
      await likesCollection.doc(likeId).update({
        data: {
          status: 'inactive',
          updateTime: new Date().toISOString()
        }
      });
      
      console.log('删除点赞记录成功');
      
      // 更新帖子的点赞数
    try {
      // 先获取当前帖子数据
      const postResult = await postsCollection.doc(postId).get();
      const currentLikeCount = postResult.data.likeCount || 0;
      
      // 确保点赞数不会小于0
      if (currentLikeCount > 0) {
        // 直接使用 set 方法来确保字段存在，同时减少点赞数
        // 使用 { merge: true } 来只更新指定字段，不覆盖其他字段
        await postsCollection.doc(postId).set({
          likeCount: db.command.inc(-1)
        }, { merge: true });
        console.log('更新帖子点赞数成功');
      } else {
        console.log('点赞数已经为0，无需更新');
      }
    } catch (error) {
      console.error('更新帖子点赞数失败:', error);
      // 不影响取消点赞操作的结果
    }
      
      console.log('=== 云函数调用结束 - removePostLike ===');
      
      return {
        success: true,
        message: '取消点赞成功'
      };
      
    } catch (error) {
      console.error('查找或删除点赞记录失败:', error);
      return {
        success: false,
        message: '取消点赞失败，请重试',
        error: error.message
      };
    }
    
  } catch (error) {
    console.error('移除帖子点赞失败:', error);
    console.error('错误堆栈:', error.stack);
    return {
      success: false,
      message: '移除帖子点赞失败，请重试',
      error: error.message
    };
  }
};