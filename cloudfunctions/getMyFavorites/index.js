// cloudfunctions/getMyFavorites/index.js
const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  try {
    console.log('=== 云函数调用开始 - getMyFavorites ===');
    
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    const env = wxContext.ENV
    
    console.log('环境信息:', { openid, env });
    console.log('事件参数:', event);
    
    if (!openid) {
      console.error('获取用户 openid 失败');
      return {
        success: false,
        message: '获取用户 openid 失败'
      }
    }
    
    const type = event.type || 'all'
    
    console.log('查询类型:', type);
    
    try {
      let query = db.collection('favorites')
        .where({
          _openid: openid
        })
      
      if (type !== 'all') {
        query = query.where({
          type: type
        })
        console.log('添加类型筛选:', type);
      }
      
    console.log('开始查询收藏数据...');
    let favorites = { data: [] };
    try {
      favorites = await query
        .orderBy('createTime', 'desc')
        .get();
      console.log('查询结果:', favorites);
    } catch (queryError) {
      console.error('查询收藏数据失败，可能是集合不存在:', queryError);
      console.log('返回空收藏列表');
      favorites = { data: [] };
    }
      console.log('收藏数据数量:', favorites.data.length);
      console.log('收藏数据:', favorites.data);
      
      const enrichedFavorites = await Promise.all(favorites.data.map(async (favorite) => {
        const itemData = favorite.itemData || {}
        
        if (favorite.type === 'material') {
          const material = await db.collection('materials').doc(favorite.itemId).get()
          if (material.data) {
            const authorInfo = material.data.author || {}
            
            const existingOrder = await db.collection('material_orders').where({
              materialId: favorite.itemId,
              buyerId: openid
            }).get()
            const isPurchased = existingOrder.data.length > 0
            
            return {
              ...favorite,
              title: material.data.title,
              description: material.data.description,
              price: material.data.price,
              isFree: material.data.isFree,
              format: material.data.format || material.data.type || '未知',
              fileSize: material.data.fileSize || '未知',
              downloadCount: material.data.downloadCount || 0,
              favoriteCount: material.data.favoriteCount || 0,
              sellerId: material.data._openid || authorInfo._id || '',
              sellerName: authorInfo.nickname || '未知卖家',
              sellerAvatar: authorInfo.avatarUrl || '',
              sellerCampus: authorInfo.campus || '',
              sellerDorm: authorInfo.dorm || '',
              sellerCollege: authorInfo.college || '',
              sellerMajor: authorInfo.major || '',
              isPurchased: isPurchased
            }
          }
        } else if (favorite.type === 'book') {
          const book = await db.collection('books').doc(favorite.itemId).get()
          if (book.data) {
            console.log('书籍数据:', book.data);
            console.log('书籍封面:', book.data.image);

            let coverImage = ''
            console.log('开始检查图片链接:', book.data.image);
            if (book.data.image && book.data.image.startsWith('cloud://')) {
              console.log('图片链接是 cloud:// 格式，开始转换...');
              try {
                console.log('调用 cloud.getTempFileURL，参数:', { fileList: [book.data.image] });
                const tempUrlResult = await cloud.getTempFileURL({
                  fileList: [book.data.image]
                })
                console.log('cloud.getTempFileURL 返回结果:', tempUrlResult);
                if (tempUrlResult.fileList && tempUrlResult.fileList.length > 0) {
                  coverImage = tempUrlResult.fileList[0].tempFileURL
                  console.log('✅ 书籍封面临时链接:', coverImage)
                } else {
                  console.error('❌ tempUrlResult.fileList 为空');
                  coverImage = book.data.image
                }
              } catch (err) {
                console.error('❌ 获取封面临时链接失败:', err);
                console.error('错误详情:', JSON.stringify(err));
                coverImage = book.data.image
              }
            } else {
              console.log('图片链接不是 cloud:// 格式，直接使用:', book.data.image);
              coverImage = book.data.image || ''
            }

            let sellerAvatar = book.data.sellerAvatar || ''
            if (sellerAvatar && sellerAvatar.startsWith('cloud://')) {
              try {
                const avatarResult = await cloud.getTempFileURL({
                  fileList: [sellerAvatar]
                })
                if (avatarResult.fileList && avatarResult.fileList.length > 0) {
                  sellerAvatar = avatarResult.fileList[0].tempFileURL
                }
              } catch (err) {
                console.error('获取卖家头像临时链接失败:', err);
              }
            }

            return {
              ...favorite,
              title: book.data.title,
              description: book.data.description,
              price: book.data.price,
              originalPrice: book.data.originalPrice,
              campus: book.data.campus,
              dorm: book.data.dorm,
              createTime: formatTime(book.data.createTime),
              coverImage: coverImage,
              image: coverImage,
              condition: book.data.condition || 8,
              bookStatus: book.data.status || 'available',
              bookStatusText: book.data.statusText || '在售',
              college: book.data.college || '',
              sellerId: book.data.sellerId || '',
              sellerName: book.data.sellerName || '未知卖家',
              sellerAvatar: sellerAvatar,
              sellerDorm: book.data.sellerDorm || book.data.dorm || '',
              sellerMajor: book.data.sellerMajor || book.data.major || ''
            }
          } else {
            // 书籍不存在，标记为失效
            console.log('书籍不存在或已删除，标记为失效:', favorite.itemId);
            const itemData = favorite.itemData || {};
            return {
              ...favorite,
              title: itemData.title || '未知书名',
              image: itemData.image || itemData.coverImage || '',
              price: itemData.price || 0,
              condition: itemData.condition || 8,
              bookStatus: 'offline',
              bookStatusText: '已失效',
              college: itemData.college || '',
              sellerId: itemData.sellerId || '',
              sellerName: itemData.sellerName || '未知卖家',
              sellerAvatar: itemData.sellerAvatar || '',
              sellerDorm: itemData.sellerDorm || '',
              sellerMajor: itemData.sellerMajor || ''
            }
          }
        } else if (favorite.type === 'post') {
          const post = await db.collection('posts').doc(favorite.itemId).get()
          if (post.data) {
            const authorInfo = await getUserInfo(post.data._openid)
            return {
              ...favorite,
              title: post.data.title,
              content: post.data.content,
              tags: post.data.tags || [],
              likeCount: post.data.likeCount || 0,
              commentCount: post.data.commentCount || 0,
              createTime: formatTime(post.data.createTime),
              author: {
                nickname: authorInfo.nickname || '未知用户',
                avatarUrl: authorInfo.avatarUrl || '',
                college: authorInfo.college || '',
                studentId: authorInfo.studentId || ''
              }
            }
          }
        }
        
        return favorite
      }))
      
      console.log('enrichment 后的收藏数据:', enrichedFavorites);
      
      return {
        success: true,
        message: '获取收藏成功',
        data: {
          favorites: enrichedFavorites
        }
      }
    } catch (dbError) {
      console.error('数据库操作失败:', dbError);
      console.error('数据库错误堆栈:', dbError.stack);
      
      try {
        console.log('尝试创建 favorites 集合...');
        await db.createCollection('favorites');
        console.log('集合创建成功');
        return {
          success: true,
          message: '获取收藏成功',
          data: {
            favorites: []
          }
        };
      } catch (createError) {
        console.error('创建集合失败:', createError);
        return {
          success: false,
          message: '获取收藏失败',
          error: createError.message
        };
      }
    }
  } catch (error) {
    console.error('获取收藏失败:', error);
    console.error('错误堆栈:', error.stack);
    return {
      success: false,
      message: '获取收藏失败',
      error: error.message
    }
  } finally {
    console.log('=== 云函数调用结束 - getMyFavorites ===');
  }
}

async function getUserInfo(openid) {
  try {
    const db = cloud.database();
    const user = await db.collection('users').doc(openid).get();
    if (user.data) {
      return {
        nickname: user.data.nickname,
        avatarUrl: user.data.avatarUrl,
        college: user.data.college,
        studentId: user.data.studentId
      }
    }
    return {}
  } catch (error) {
    console.error('获取用户信息失败:', error)
    return {}
  }
}

function formatTime(date) {
  if (!date) return ''
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
