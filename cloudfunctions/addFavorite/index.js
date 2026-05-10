// cloudfunctions/addFavorite/index.js
const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

/**
 * 添加收藏云函数
 * @param {Object} event - 事件对象
 * @param {string} event.itemId - 收藏项ID
 * @param {string} event.type - 收藏类型 (material, post, book)
 * @param {Object} event.itemData - 收藏项数据
 * @param {Object} context - 上下文对象
 * @returns {Object} - 操作结果
 */
exports.main = async (event, context) => {
  try {
    console.log('=== 云函数调用开始 - addFavorite ===');
    
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    const env = wxContext.ENV
    
    console.log('环境信息:', { openid, env });
    console.log('事件参数:', event);
    
    if (!openid) {
      console.error('获取用户openid失败');
      return {
        success: false,
        message: '获取用户openid失败'
      }
    }
    
    if (!event.itemId || !event.type) {
      console.error('收藏项ID和类型不能为空:', { itemId: event.itemId, type: event.type });
      return {
        success: false,
        message: '收藏项ID和类型不能为空'
      }
    }
    
    try {
      // 检查是否已经收藏
      console.log('检查是否已经收藏...');
      const existingFavorite = await db.collection('favorites')
        .where({
          _openid: openid,
          itemId: event.itemId,
          type: event.type,
          status: 'active'
        })
        .get();
      
      console.log('检查是否已收藏:', existingFavorite.data.length > 0);
      
      if (existingFavorite.data.length > 0) {
        return {
          success: false,
          message: '已经收藏过该内容'
        }
      }
      
      // 检查是否是自己发布的内容（书籍和资料不能收藏自己的，帖子可以）
      if (event.type === 'book' || event.type === 'material') {
        const collectionName = event.type === 'book' ? 'books' : 'materials';
        const itemData = await db.collection(collectionName).doc(event.itemId).get();
        
        if (itemData.data && itemData.data._openid === openid) {
          return {
            success: false,
            message: '不能收藏自己发布的内容'
          }
        }
      }
      
      // 获取完整的物品信息
      let fullItemData = event.itemData || {};
      
      if (event.type === 'book') {
        const bookData = await db.collection('books').doc(event.itemId).get();
        if (bookData.data) {
          fullItemData = {
            ...fullItemData,
            title: bookData.data.title || fullItemData.title,
            image: bookData.data.image || bookData.data.coverUrl || fullItemData.image,
            price: bookData.data.price || fullItemData.price,
            condition: bookData.data.condition || fullItemData.condition,
            status: bookData.data.status || fullItemData.status,
            statusText: bookData.data.statusText || fullItemData.statusText,
            college: bookData.data.college || fullItemData.college,
            sellerId: bookData.data._openid || fullItemData.sellerId,
            sellerName: bookData.data.author || fullItemData.sellerName,
            sellerAvatar: fullItemData.sellerAvatar,
            campus: bookData.data.campus || fullItemData.campus,
            dorm: bookData.data.dorm || fullItemData.dorm
          };
        }
      } else if (event.type === 'material') {
        const materialData = await db.collection('materials').doc(event.itemId).get();
        if (materialData.data) {
          fullItemData = {
            ...fullItemData,
            title: materialData.data.title || fullItemData.title,
            image: materialData.data.image || fullItemData.image,
            price: materialData.data.price || fullItemData.price,
            format: materialData.data.format || fullItemData.format,
            fileSize: materialData.data.fileSize || fullItemData.fileSize,
            college: materialData.data.college || fullItemData.college
          };
        }
      } else if (event.type === 'post') {
        const postData = await db.collection('posts').doc(event.itemId).get();
        if (postData.data) {
          fullItemData = {
            ...fullItemData,
            title: postData.data.title || fullItemData.title,
            image: postData.data.image || fullItemData.image
          };
        }
      }
      
      // 创建收藏记录
      const favoriteData = {
        _openid: openid,
        itemId: event.itemId,
        type: event.type,
        itemData: fullItemData,
        createTime: new Date(),
        status: 'active'
      }
      
      console.log('准备添加的收藏数据:', favoriteData);
      
      // 添加到数据库
      console.log('开始添加收藏数据...');
      const result = await db.collection('favorites').add({
        data: favoriteData
      })
      
      console.log('添加收藏结果:', result);
      
      // 更新对应类型的收藏数
      if (event.type === 'post') {
        await db.collection('posts').doc(event.itemId).update({
          data: {
            favoritesCount: _.inc(1)
          }
        })
      } else if (event.type === 'material') {
        await db.collection('materials').doc(event.itemId).update({
          data: {
            favoritesCount: _.inc(1)
          }
        })
      } else if (event.type === 'book') {
        await db.collection('books').doc(event.itemId).update({
          data: {
            favoritesCount: _.inc(1)
          }
        })
      }
      
      // 更新用户信息中的收藏计数
      await db.collection('users').doc(openid).update({
        data: {
          favoritesCount: _.inc(1)
        }
      })

      // 发送系统消息给发布者（仅书籍和资料，不发送给自己的收藏）
      if ((event.type === 'book' || event.type === 'material') && fullItemData.sellerId && fullItemData.sellerId !== openid) {
        try {
          // 获取收藏者信息
          const userResult = await db.collection('users').where({
            _openid: openid
          }).get()

          const favoriterName = userResult.data[0]?.nickname || '用户'
          const itemType = event.type === 'book' ? '书籍' : '资料'

          await cloud.callFunction({
            name: 'sendSystemMessage',
            data: {
              receiverOpenid: fullItemData.sellerId,
              title: '收到新收藏',
              content: `${favoriterName} 收藏了你的${itemType}《${fullItemData.title}》`,
              type: 'favorite',
              relatedId: event.itemId,
              relatedType: event.type
            }
          })
          console.log('已发送收藏通知给发布者')
        } catch (msgError) {
          console.warn('发送收藏通知失败:', msgError)
        }
      }

      return {
        success: true,
        message: '收藏成功',
        data: {
          _id: result._id,
          ...favoriteData
        }
      }
    } catch (dbError) {
      console.error('数据库操作失败:', dbError);
      console.error('数据库错误堆栈:', dbError.stack);
      
      // 尝试创建集合
      try {
        console.log('尝试创建favorites集合...');
        await db.createCollection('favorites');
        console.log('集合创建成功');
        
        // 再次尝试添加收藏
        console.log('再次尝试添加收藏...');
        const favoriteData = {
          _openid: openid,
          itemId: event.itemId,
          type: event.type,
          itemData: event.itemData || {},
          createTime: new Date(),
          status: 'active'
        };
        
        const result = await db.collection('favorites').add({
          data: favoriteData
        });
        
        console.log('添加收藏结果:', result);
        
        // 更新对应类型的收藏数
        if (event.type === 'post') {
          await db.collection('posts').doc(event.itemId).update({
            data: {
              favoritesCount: _.inc(1)
            }
          })
        } else if (event.type === 'material') {
          await db.collection('materials').doc(event.itemId).update({
            data: {
              favoritesCount: _.inc(1)
            }
          })
        } else if (event.type === 'book') {
          await db.collection('books').doc(event.itemId).update({
            data: {
              favoritesCount: _.inc(1)
            }
          })
        }
        
        // 更新用户信息中的收藏计数
        await db.collection('users').doc(openid).update({
          data: {
            favoritesCount: _.inc(1)
          }
        })

        // 发送系统消息给发布者（仅书籍和资料，不发送给自己的收藏）
        if ((event.type === 'book' || event.type === 'material') && favoriteData.itemData.sellerId && favoriteData.itemData.sellerId !== openid) {
          try {
            // 获取收藏者信息
            const userResult = await db.collection('users').where({
              _openid: openid
            }).get()

            const favoriterName = userResult.data[0]?.nickname || '用户'
            const itemType = event.type === 'book' ? '书籍' : '资料'

            await cloud.callFunction({
              name: 'sendSystemMessage',
              data: {
                receiverOpenid: favoriteData.itemData.sellerId,
                title: '收到新收藏',
                content: `${favoriterName} 收藏了你的${itemType}《${favoriteData.itemData.title}》`,
                type: 'favorite',
                relatedId: event.itemId,
                relatedType: event.type
              }
            })
            console.log('已发送收藏通知给发布者')
          } catch (msgError) {
            console.warn('发送收藏通知失败:', msgError)
          }
        }

        return {
          success: true,
          message: '收藏成功',
          data: {
            _id: result._id,
            ...favoriteData
          }
        };
      } catch (createError) {
        console.error('创建集合失败:', createError);
        return {
          success: false,
          message: '添加收藏失败',
          error: createError.message
        };
      }
    }
  } catch (error) {
    console.error('添加收藏失败:', error);
    console.error('错误堆栈:', error.stack);
    return {
      success: false,
      message: '添加收藏失败',
      error: error.message
    }
  } finally {
    console.log('=== 云函数调用结束 - addFavorite ===');
  }
}