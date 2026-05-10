// cloudfunctions/initDatabase/index.js
const cloud = require('wx-server-sdk')
cloud.init({
  env: 'xiaowen-env-0gdw907s2b9957d2'
})

exports.main = async (event, context) => {
  const db = cloud.database()
  const logId = 'init_' + Date.now()
  console.log(`[${logId}] 开始初始化数据库`)
  
  try {
    // 创建 books 集合（如果不存在）
    console.log(`[${logId}] 创建 books 集合`)
    const booksCollection = db.collection('books')
    const booksCount = await booksCollection.count()
    console.log(`[${logId}] books 集合现有记录数: ${booksCount.total}`)
    
    // 创建 audit_logs 集合（如果不存在）
    console.log(`[${logId}] 创建 audit_logs 集合`)
    const auditLogsCollection = db.collection('audit_logs')
    const auditLogsCount = await auditLogsCollection.count()
    console.log(`[${logId}] audit_logs 集合现有记录数: ${auditLogsCount.total}`)
    
    // 创建 posts 集合（如果不存在）
    console.log(`[${logId}] 创建 posts 集合`)
    const postsCollection = db.collection('posts')
    const postsCount = await postsCollection.count()
    console.log(`[${logId}] posts 集合现有记录数: ${postsCount.total}`)
    
    // 创建 materials 集合（如果不存在）
    console.log(`[${logId}] 创建 materials 集合`)
    const materialsCollection = db.collection('materials')
    const materialsCount = await materialsCollection.count()
    console.log(`[${logId}] materials 集合现有记录数: ${materialsCount.total}`)
    
    // 创建 orders 集合（如果不存在）
    console.log(`[${logId}] 创建 orders 集合`)
    const ordersCollection = db.collection('orders')
    const ordersCount = await ordersCollection.count()
    console.log(`[${logId}] orders 集合现有记录数: ${ordersCount.total}`)
    
    // 创建 users 集合（如果不存在）
    console.log(`[${logId}] 创建 users 集合`)
    const usersCollection = db.collection('users')
    const usersCount = await usersCollection.count()
    console.log(`[${logId}] users 集合现有记录数: ${usersCount.total}`)
    
    console.log(`[${logId}] 数据库初始化完成`)
    
    return {
      success: true,
      message: '数据库初始化成功',
      collections: {
        books: booksCount.total,
        audit_logs: auditLogsCount.total,
        posts: postsCount.total,
        materials: materialsCount.total,
        orders: ordersCount.total,
        users: usersCount.total
      },
      logId: logId
    }
    
  } catch (error) {
    console.error(`[${logId}] 数据库初始化失败:`, error)
    return {
      success: false,
      message: '数据库初始化失败: ' + error.message,
      error: error.message,
      logId: logId
    }
  }
}