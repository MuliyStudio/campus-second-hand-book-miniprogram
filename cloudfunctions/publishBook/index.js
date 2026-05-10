// cloudfunctions/publishBook/index.js
const cloud = require('wx-server-sdk')
cloud.init({
  env: 'xiaowen-env-0gdw907s2b9957d2'
})

const db = cloud.database()

const SERVICE_ID = 'wx79ac3de8be320b'

async function checkImageWithCloudFunction(fileUrl, logId) {
  console.log(`[${logId}] 开始图片审核, fileUrl: ${fileUrl}`)
  
  try {
    const result = await cloud.callFunction({
      name: 'checkImage',
      data: {
        fileUrl: fileUrl
      },
      timeout: 10000 // 10秒超时（增加超时时间）
    })
    
    console.log(`[${logId}] 图片审核原始结果:`, JSON.stringify(result.result))
    
    if (!result.result) {
      console.error(`[${logId}] 图片审核返回结果为空`)
      return { 
        success: false, 
        message: '图片审核服务返回异常',
        logId: logId
      }
    }
    
    // 检查结果中是否包含错误信息
    if (result.result.message && result.result.message.includes('临时文件路径')) {
      console.error(`[${logId}] 检测到临时文件路径错误`)
      return {
        success: false,
        message: '图片路径无效，请重新上传图片',
        logId: logId,
        invalidPath: true
      }
    }
    
    return result.result
  } catch (error) {
    console.error(`[${logId}] 调用图片审核云函数失败:`, error)
    
    let errorMessage = '图片审核服务异常: ' + error.message
    
    // 检查是否是超时错误
    const isTimeout = error.message && error.message.includes('timeout')
    
    // 检查是否是临时文件路径错误
    if (error.message && error.message.includes('ENOTFOUND tmp')) {
      errorMessage = '图片路径无效，请重新上传图片'
      console.error(`[${logId}] 检测到ENOTFOUND tmp错误`)
    }
    
    return { 
      success: false, 
      message: errorMessage,
      logId: logId,
      timeout: isTimeout,
      invalidPath: error.message && error.message.includes('ENOTFOUND tmp')
    }
  }
}

async function getTempFileUrl(fileId, logId) {
  console.log(`[${logId}] 获取云存储临时链接: ${fileId}`)
  
  try {
    const result = await cloud.getTempFileURL({
      fileList: [fileId]
    })
    
    console.log(`[${logId}] getTempFileURL结果:`, JSON.stringify(result))
    
    if (result.fileList && result.fileList[0] && result.fileList[0].tempFileURL) {
      return result.fileList[0].tempFileURL
    }
    
    console.error(`[${logId}] 获取临时链接失败: fileList为空或格式错误`)
    return null
  } catch (error) {
    console.error(`[${logId}] 获取临时链接异常:`, error)
    return null
  }
}

async function saveAuditLog(db, data) {
  try {
    await db.collection('audit_logs').add({
      data: {
        ...data,
        createTime: new Date()
      }
    })
  } catch (error) {
    console.error('保存审核日志失败:', error)
  }
}

async function checkAndAuditImage(imageUrl, bookData, db, openid, logId) {
  console.log(`[${logId}] 开始审核图片...`)
  
  if (!imageUrl) {
    console.log(`[${logId}] 无图片，跳过审核`)
    return
  }
  
  let checkUrl = imageUrl
  let isCloudStorage = false
  
  // 验证URL格式
  if (!imageUrl || typeof imageUrl !== 'string' || imageUrl.trim() === '') {
    console.error(`[${logId}] 错误: 图片URL为空`)

    // 异步保存日志
    saveAuditLog(db, {
      type: 'book_image',
      openid: openid,
      imageUrl: imageUrl,
      status: 'error',
      error: '图片URL为空',
      bookTitle: bookData.title
    }).catch(err => console.error(`[${logId}] 保存审核日志失败:`, err))

    throw new Error('图片URL无效，请重新上传图片')
  }
  
  // 检查是否是无效的临时路径
  if (imageUrl.startsWith('http://tmp/') || imageUrl.startsWith('https://tmp/') ||
      imageUrl.startsWith('tmp/') || imageUrl.startsWith('wxfile://')) {
    console.error(`[${logId}] 错误: 检测到无效的临时文件路径: ${imageUrl}`)

    // 异步保存日志
    saveAuditLog(db, {
      type: 'book_image',
      openid: openid,
      imageUrl: imageUrl,
      status: 'error',
      error: '检测到无效的临时文件路径',
      bookTitle: bookData.title
    }).catch(err => console.error(`[${logId}] 保存审核日志失败:`, err))

    throw new Error('图片路径无效，请重新上传图片')
  }
  
  if (imageUrl.indexOf('cloud://') === 0) {
    isCloudStorage = true
    console.log(`[${logId}] 检测到云存储路径，获取临时链接...`)
    checkUrl = await getTempFileUrl(imageUrl, logId)
    console.log(`[${logId}] 临时链接: ${checkUrl}`)
  }
  
  if (!checkUrl) {
    console.error(`[${logId}] 错误: 无法获取图片访问链接，拒绝发布`)

    // 异步保存日志
    saveAuditLog(db, {
      type: 'book_image',
      openid: openid,
      imageUrl: imageUrl,
      isCloudStorage: isCloudStorage,
      status: 'error',
      error: '无法获取图片访问链接',
      bookTitle: bookData.title
    }).catch(err => console.error(`[${logId}] 保存审核日志失败:`, err))

    throw new Error('图片链接无效，请重新上传图片')
  }
  
  console.log(`[${logId}] 开始调用图片审核...`)
  console.log(`CODEBUDDY_DEBUG publishBook checkImageStart timestamp=${Date.now()} totalDuration=${Date.now() - startTime}ms`)
  
  // 带重试机制的图片审核
  let checkResult = null
  let retryCount = 0
  const maxRetries = 2
  const retryDelay = 1000 // 1秒延迟
  
  while (retryCount <= maxRetries) {
    checkResult = await checkImageWithCloudFunction(checkUrl, logId)
    console.log(`[${logId}] 审核结果 (尝试 ${retryCount + 1}): success=${checkResult.success}, message=${checkResult.message}`)
    
    if (checkResult.data) {
      console.log(`[${logId}] 审核详情: Suggestion=${checkResult.data.Suggestion}, Label=${checkResult.data.Label}`)
    }
    
    // 如果是无效路径错误，不重试，直接返回
    if (checkResult.invalidPath) {
      console.log(`[${logId}] 检测到无效路径错误，不进行重试`)
      break
    }
    
    if (checkResult.success || !checkResult.timeout) {
      break // 成功或者不是超时错误，退出循环
    }
    
    if (retryCount < maxRetries) {
      console.log(`[${logId}] 图片审核超时，准备重试 (${retryCount + 1}/${maxRetries})`)
      await new Promise(resolve => setTimeout(resolve, retryDelay))
    }
    
    retryCount++
  }
  
  if (!checkResult.success) {
    console.error(`[${logId}] 图片审核失败: ${checkResult.message}`)

    // 异步保存日志
    saveAuditLog(db, {
      type: 'book_image',
      openid: openid,
      imageUrl: imageUrl,
      checkUrl: checkUrl,
      isCloudStorage: isCloudStorage,
      result: checkResult,
      status: 'rejected',
      reason: checkResult.message,
      bookTitle: bookData.title
    }).catch(err => console.error(`[${logId}] 保存审核日志失败:`, err))

    const error = new Error(checkResult.message || '图片审核失败，请更换图片')
    error.auditResult = checkResult
    throw error
  }
  
  if (checkResult.data) {
    const suggestion = checkResult.data.Suggestion
    const label = checkResult.data.Label
    
    if (suggestion === 'Block') {
      let reason = '图片内容不合规'
      if (label === 'Porn') {
        reason = '图片包含色情内容，禁止发布'
      } else if (label === 'Abuse') {
        reason = '图片包含谩骂内容，禁止发布'
      } else if (label === 'Ad') {
        reason = '图片包含广告内容，禁止发布'
      } else if (label === 'Custom') {
        reason = '图片包含违规内容，禁止发布'
      }

      console.error(`[${logId}] 图片被拦截: ${reason}, Label: ${label}`)

      // 异步保存日志
      saveAuditLog(db, {
        type: 'book_image',
        openid: openid,
        imageUrl: imageUrl,
        checkUrl: checkUrl,
        isCloudStorage: isCloudStorage,
        result: checkResult,
        status: 'blocked',
        reason: reason,
        label: label,
        bookTitle: bookData.title
      }).catch(err => console.error(`[${logId}] 保存审核日志失败:`, err))

      const error = new Error(reason)
      error.auditResult = checkResult
      throw error
    }
    
    if (suggestion === 'Review') {
      bookData.needReview = true
      bookData.reviewReason = label
      bookData.auditStatus = 'pending_review'
      console.log(`[${logId}] 图片需要人工复审`)
    }
  }
  
  // 异步保存审核日志
  saveAuditLog(db, {
    type: 'book_image',
    openid: openid,
    imageUrl: imageUrl,
    checkUrl: checkUrl,
    isCloudStorage: isCloudStorage,
    result: checkResult,
    status: 'passed',
    bookTitle: bookData.title
  }).catch(err => console.error(`[${logId}] 保存审核日志失败:`, err))

  console.log(`[${logId}] 图片审核通过`)
  console.log(`CODEBUDDY_DEBUG publishBook imageCheckPassed imageUrl=${imageUrl}`)
}

exports.main = async (event, context) => {
  const logId = 'publish_' + Date.now()
  const startTime = Date.now()
  console.log(`[${logId}] ========== 开始发布书籍 ==========`)
  console.log(`[${logId}] 事件数据:`, JSON.stringify({
    bookData: event.bookData ? '有数据' : '无数据',
    hasCoverUrl: event.bookData ? !!event.bookData.coverUrl : false,
    hasImage: event.bookData ? !!event.bookData.image : false
  }))

  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID

    console.log(`CODEBUDDY_DEBUG publishBook openid=${openid}`)

    if (!openid) {
      console.error(`[${logId}] 错误: 获取用户openid失败`)
      return {
        success: false,
        message: '获取用户openid失败',
        logId: logId
      }
    }

    if (!event.bookData) {
      console.error(`[${logId}] 错误: 书籍数据为空`)
      return {
        success: false,
        message: '书籍数据不能为空',
        logId: logId
      }
    }

    const bookData = {
      ...event.bookData,
      _openid: openid,
      sellerId: openid,
      createTime: new Date(),
      updateTime: new Date(),
      status: 'available',
      statusText: '在售',
      viewCount: 0,
      likeCount: 0,
      favoritesCount: 0
    }

    console.log(`CODEBUDDY_DEBUG publishBook bookData defined title=${bookData.title} author=${bookData.author}`)

    // 文本审核
    console.log(`[${logId}] 开始文本审核`)
    const textsToCheck = [
      { fieldName: 'title', text: bookData.title },
      { fieldName: 'author', text: bookData.author },
      { fieldName: 'publisher', text: bookData.publisher },
      { fieldName: 'course', text: bookData.course },
      { fieldName: 'description', text: bookData.description }
    ]

    console.log(`CODEBUDDY_DEBUG publishBook textsToCheck fields=${textsToCheck.map(t => t.fieldName).join(',')}`)
    
    console.log(`[${logId}] 需要审核的文本字段:`, textsToCheck.map(t => t.fieldName).join(', '))
    
    try {
      console.log(`CODEBUDDY_DEBUG publishBook 开始调用checkText云函数`)
      const startTime = Date.now()

      const textCheckResult = await cloud.callFunction({
        name: 'checkText',
        data: {
          texts: textsToCheck
        },
        timeout: 10000 // 10秒超时
      })

      const duration = Date.now() - startTime

      console.log(`CODEBUDDY_DEBUG publishBook checkText调用完成 duration=${duration}ms`)
      console.log(`[${logId}] 文本审核结果:`, JSON.stringify(textCheckResult.result))
      console.log(`CODEBUDDY_DEBUG publishBook textCheckResult success=${textCheckResult.result?.success} message=${textCheckResult.result?.message}`)
      
      if (!textCheckResult.result || !textCheckResult.result.success) {
        const errorMessage = textCheckResult.result && textCheckResult.result.message ? textCheckResult.result.message : '文本审核失败'
        console.error(`[${logId}] 文本审核失败: ${errorMessage}`)

        // 异步保存文本审核失败的日志（不等待）
        saveAuditLog(db, {
          type: 'book_text',
          openid: openid,
          bookTitle: bookData.title,
          result: textCheckResult.result,
          status: 'rejected',
          reason: errorMessage,
          texts: textsToCheck.map(t => ({ field: t.fieldName, text: t.text.substring(0, 50) }))
        }).catch(err => console.error(`[${logId}] 保存审核日志失败:`, err))

        console.log(`[${logId}] 立即返回，总耗时: ${Date.now() - startTime}ms`)
        return {
          success: false,
          message: errorMessage,
          logId: logId,
          textCheckResult: textCheckResult.result
        }
      }
      
      // 检查是否有需要人工复审的文本
      const needsReview = textCheckResult.result.results && textCheckResult.result.results.some(r => r.needReview)
      if (needsReview) {
        bookData.needReview = true
        bookData.reviewReason = '文本需要人工复审'
        bookData.auditStatus = 'pending_review'
        console.log(`[${logId}] 文本需要人工复审`)
      }
      
      // 异步保存文本审核通过的日志
      saveAuditLog(db, {
        type: 'book_text',
        openid: openid,
        bookTitle: bookData.title,
        result: textCheckResult.result,
        status: 'passed'
      }).catch(err => console.error(`[${logId}] 保存审核日志失败:`, err))

      console.log(`[${logId}] 文本审核通过`)
    } catch (error) {
      console.error(`[${logId}] 文本审核异常:`, error)
      
      // 文本审核失败也拒绝发布，异步保存日志
      saveAuditLog(db, {
        type: 'book_text',
        openid: openid,
        bookTitle: bookData.title,
        error: error.message,
        status: 'error',
        reason: '文本审核服务异常'
      }).catch(err => console.error(`[${logId}] 保存审核日志失败:`, err))

      return {
        success: false,
        message: '文本审核服务异常，请重试',
        logId: logId,
        error: error.message
      }
    }
  
  try {
    
    const imageUrl = bookData.coverUrl || bookData.image
    console.log(`[${logId}] 图片URL: ${imageUrl}`)
    console.log(`CODEBUDDY_DEBUG publishBook imageUrl=${imageUrl} coverUrl=${bookData.coverUrl} image=${bookData.image}`)
    
    // 检查是否已经在上传时审核过图片
    const imagesChecked = event.bookData && event.bookData.imagesChecked === true
    const checkTime = event.bookData && event.bookData.checkTime || 0
    
    console.log(`CODEBUDDY_DEBUG publishBook imagesChecked=${imagesChecked} checkTime=${checkTime}`)
    
    if (imagesChecked && checkTime > 0) {
      // 检查审核时间是否在有效期内（24小时内）
      const checkAge = Date.now() - checkTime
      const isValidCheck = checkAge < 24 * 60 * 60 * 1000 // 24小时
      
      console.log(`[${logId}] 图片已在上传时审核过，审核时间: ${new Date(checkTime).toLocaleString()}，距离现在: ${Math.floor(checkAge / 1000)}秒`)
      
      if (isValidCheck) {
        console.log(`[${logId}] 跳过图片审核（24小时内已审核）`)
        console.log(`CODEBUDDY_DEBUG publishBook skipImageCheck reason=already_checked age=${checkAge}ms`)

        // 异步保存审核日志
        saveAuditLog(db, {
          type: 'book_image',
          openid: openid,
          imageUrl: imageUrl,
          isCloudStorage: imageUrl.indexOf('cloud://') === 0,
          status: 'passed',
          skipped: true,
          reason: '上传时已审核（24小时内）',
          bookTitle: bookData.title
        }).catch(err => console.error(`[${logId}] 保存审核日志失败:`, err))

        console.log(`[${logId}] 图片审核通过（跳过）`)
      } else {
        console.log(`[${logId}] 审核结果已过期，重新审核`)
        // 继续执行下面的审核逻辑
        await checkAndAuditImage(imageUrl, bookData, db, openid, logId)
      }
    } else {
      // 未审核或标记无效，执行正常审核流程
      console.log(`[${logId}] 图片未审核，开始审核流程`)
      await checkAndAuditImage(imageUrl, bookData, db, openid, logId)
    }
  } catch (error) {
    console.error(`[${logId}] 图片审核异常:`, error)
    console.error(`[${logId}] 错误堆栈:`, error.stack)

    // 如果是审核失败或被拦截的错误，直接返回
    if (error.auditResult) {
      return {
        success: false,
        message: error.message,
        logId: logId,
        auditResult: error.auditResult
      }
    }

    // 异步保存图片审核异常的日志
    saveAuditLog(db, {
      type: 'book_image',
      openid: openid,
      imageUrl: bookData.coverUrl || bookData.image,
      error: error.message,
      status: 'error',
      reason: '图片审核服务异常',
      bookTitle: bookData.title
    }).catch(err => console.error(`[${logId}] 保存审核日志失败:`, err))

    return {
      success: false,
      message: '图片审核服务异常，请重试',
      logId: logId,
      error: error.message
    }
  }

  // 保存书籍数据到数据库
  const result = await db.collection('books').add({
    data: bookData
  })
  
  console.log(`[${logId}] 书籍保存成功, _id: ${result._id}`)
  console.log(`CODEBUDDY_DEBUG publishBook saveSuccess bookId=${result._id} title=${bookData.title}`)
  
  // 异步发送系统消息（不等待，避免超时）
  Promise.resolve().then(async () => {
    try {
      await cloud.callFunction({
        name: 'sendSystemMessage',
        data: {
          receiverOpenid: openid,
          title: '发布成功',
          content: `您发布的书籍《${bookData.title}》已成功上架`,
          type: 'publish',
          relatedId: result._id,
          relatedType: 'book'
        },
        timeout: 2000 // 限制消息发送超时
      })
      console.log(`[${logId}] 创建系统消息成功`)
    } catch (error) {
      console.error(`[${logId}] 创建系统消息失败（不影响发布结果）:`, error)
    }
  }).catch(err => {
    console.error(`[${logId}] 系统消息发送异常:`, err)
  })
  
  console.log(`[${logId}] ========== 发布成功 ==========`)
  
  // 立即返回结果，避免超时
  return {
    success: true,
    message: '发布成功',
    data: {
      _id: result._id,
      ...bookData
    },
    logId: logId
  }
  } catch (error) {
    console.error(`[${logId}] 发布书籍失败:`, error)
    console.error(`[${logId}] 错误堆栈:`, error.stack)
    
    return {
      success: false,
      message: '发布书籍失败: ' + error.message,
      error: error.message,
      logId: logId
    }
  }
}
