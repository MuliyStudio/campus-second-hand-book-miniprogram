// cloudfunctions/addPostLike/index.js
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const likesCollection = db.collection('likes');
const postsCollection = db.collection('posts');

exports.main = async (event, context) => {
  try {
    console.log('=== 云函数调用开始 - addPostLike ===');
    
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    const { postId, postData } = event;
    
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
    
    // 检查帖子是否存在
    try {
      const postResult = await postsCollection.doc(postId).get();
      if (!postResult.data) {
        console.error('帖子不存在:', postId);
        return {
          success: false,
          message: '帖子不存在'
        };
      }
    } catch (error) {
      console.error('检查帖子存在失败:', error);
      return {
        success: false,
        message: '检查帖子存在失败'
      };
    }
    
    // 检查是否已经点赞
    try {
      const existingLike = await likesCollection
        .where({
          _openid: openid,
          itemId: postId,
          type: 'post',
          status: 'active'
        })
        .get();
      
      if (existingLike.data && existingLike.data.length > 0) {
        console.log('帖子已经点赞过:', postId);
        return {
          success: true,
          message: '帖子已经点赞过',
          data: existingLike.data[0]
        };
      }
    } catch (error) {
      console.error('检查点赞状态失败:', error);
    }
    
    // 创建点赞记录
    const likeData = {
      _openid: openid,
      itemId: postId,
      type: 'post',
      itemData: postData || {},
      status: 'active',
      createTime: new Date().toISOString()
    };
    
    console.log('创建点赞记录:', likeData);
    
    const result = await likesCollection.add({
      data: likeData
    });
    
    console.log('点赞成功，结果:', result);
    
    // 更新帖子的点赞数
    try {
      // 直接使用 set 方法来确保字段存在，同时增加点赞数
      // 使用 { merge: true } 来只更新指定字段，不覆盖其他字段
      await postsCollection.doc(postId).set({
        likeCount: db.command.inc(1)
      }, { merge: true });
      console.log('更新帖子点赞数成功');
    } catch (error) {
      console.error('更新帖子点赞数失败:', error);
      // 不影响点赞操作的结果
    }
    
    console.log('=== 云函数调用结束 - addPostLike ===');
    
    return {
      success: true,
      data: {
        _id: result._id,
        ...likeData
      },
      message: '点赞成功'
    };
    
  } catch (error) {
    console.error('添加帖子点赞失败:', error);
    console.error('错误堆栈:', error.stack);
    return {
      success: false,
      message: '添加帖子点赞失败，请重试',
      error: error.message
    };
  }
};