// cloudfunctions/checkText/index.js
const cloud = require('wx-server-sdk')
const https = require('https')

cloud.init({
  env: 'xiaowen-env-0gdw907s2b9957d2'
})

const APPID = 'wx11c832adf2cf1c6d'
const APPSECRET = '2baf2d2aa2d9b0ab66f62af8211b1ff2'

// 获取 access_token
async function getAccessToken() {
  console.log('CODEBUDDY_DEBUG checkText 开始获取 access_token')
  try {
    const startTime = Date.now()
    const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${APPID}&secret=${APPSECRET}`

    const result = await new Promise((resolve, reject) => {
      https.get(url, (res) => {
        let data = ''
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => {
          try {
            const result = JSON.parse(data)
            if (result.errcode) {
              reject(new Error(`获取 access_token 失败: ${result.errmsg}`))
            } else {
              resolve(result)
            }
          } catch (e) {
            reject(new Error('JSON解析失败: ' + data))
          }
        })
      }).on('error', reject)
    })

    const duration = Date.now() - startTime

    console.log('CODEBUDDY_DEBUG checkText getAccessToken 调用完成 duration=' + duration + 'ms success=', !!(result && result.access_token))

    if (result && result.access_token) {
      console.log('CODEBUDDY_DEBUG checkText 获取 access_token 成功')
      return result.access_token
    }

    throw new Error('获取 access_token 失败')
  } catch (error) {
    console.error('CODEBUDDY_DEBUG checkText 获取 access_token 失败 error=', error.message)
    throw error
  }
}

async function checkTextWithTianYu(text, logId) {
  const accessToken = await getAccessToken()

  // 使用微信官方的文本安全检测 API
  // 注意：正确的路径是 /wxa/msg_sec_check，不是 /wxa/sec/msg_sec_check
  const apiUrl = `https://api.weixin.qq.com/wxa/msg_sec_check?access_token=${accessToken}`

  const requestData = {
    content: text
  }

  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(requestData)

    const options = {
      hostname: 'api.weixin.qq.com',
      port: 443,
      path: '/wxa/msg_sec_check?access_token=' + accessToken,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 5000 // 5秒超时
    }

    const req = https.request(options, (res) => {
      let data = ''

      res.on('data', (chunk) => {
        data += chunk
      })

      res.on('end', () => {
        try {
          const result = JSON.parse(data)
          resolve(result)
        } catch (error) {
          reject(new Error('解析响应失败：' + data))
        }
      })
    })

    req.on('error', (error) => {
      reject(error)
    })

    req.on('timeout', () => {
      req.destroy()
      reject(new Error('文本审核API请求超时'))
    })

    req.write(postData)
    req.end()
  })
}

exports.main = async (event, context) => {
  const logId = 'text_check_' + Date.now()
  console.log(`[${logId}] ========== 开始文本审核 ==========`)
  console.log(`[${logId}] 参数:`, JSON.stringify(event))
  console.log('CODEBUDDY_DEBUG checkText main 开始 logId=', logId)

  try {
    const { texts, fieldName } = event
    
    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      console.error(`[${logId}] 错误：未提供需要审核的文本`)
      return {
        success: false,
        message: '请提供需要审核的文本内容',
        logId: logId
      }
    }
    
    console.log(`[${logId}] 使用天御文本审核 API 检测文本，共 ${texts.length} 条文本`)
    
    const results = []
    
    for (let i = 0; i < texts.length; i++) {
      const textItem = texts[i]
      const text = typeof textItem === 'string' ? textItem : textItem.text
      const currentFieldName = textItem.fieldName || fieldName || `字段${i + 1}`
      
      if (!text || text.trim() === '') {
        console.log(`[${logId}] 跳过空文本: ${currentFieldName}`)
        results.push({
          fieldName: currentFieldName,
          text: text,
          success: true,
          message: '文本为空，跳过审核'
        })
        continue
      }
      
      console.log(`[${logId}] 审核文本 [${currentFieldName}]: ${text.substring(0, 50)}...`)
      console.log(`CODEBUDDY_DEBUG checkText 开始审核字段 fieldName=${currentFieldName} textLength=${text.length}`)

      try {
        const startTime = Date.now()
        const result = await checkTextWithTianYu(text, logId)
        const duration = Date.now() - startTime

        console.log(`CODEBUDDY_DEBUG checkText 字段审核完成 fieldName=${currentFieldName} duration=${duration}ms`)

        console.log(`[${logId}] 文本审核结果:`, JSON.stringify(result))

        // security.msgSecCheck API 的返回格式：
        // errcode=0: 内容安全
        // errcode=87014: 内容包含违规信息
        if (result.errcode === 0) {
          console.log(`[${logId}] 文本审核通过`)
          results.push({
            fieldName: currentFieldName,
            text: text.substring(0, 100),
            success: true,
            message: '文本审核通过',
            data: {
              Suggestion: 'Pass',
              Label: 'Normal'
            }
          })
        } else if (result.errcode === 87014) {
          console.error(`[${logId}] 文本被拦截：errcode=87014`)

          results.push({
            fieldName: currentFieldName,
            text: text.substring(0, 100),
            success: false,
            message: '文本内容不合规，禁止发布',
            data: {
              Suggestion: 'Block',
              Label: 'Custom'
            },
            blocked: true
          })
        } else {
          console.error(`[${logId}] 文本审核失败：errcode=${result.errcode}, errmsg=${result.errmsg}`)

          results.push({
            fieldName: currentFieldName,
            text: text.substring(0, 100),
            success: false,
            message: '文本审核失败：' + (result.errmsg || '未知错误'),
            errCode: result.errcode,
            failed: true
          })
        }
      } catch (error) {
        console.error(`[${logId}] 文本审核异常:`, error)

        results.push({
          fieldName: currentFieldName,
          text: text.substring(0, 100),
          success: false,
          message: '文本审核服务异常：' + error.message,
          error: true
        })
      }
    }
    
    // 检查是否有被拦截的文本
    const hasBlockedText = results.some(result => result.blocked)
    const hasFailedText = results.some(result => result.failed || result.error)
    
    console.log(`[${logId}] ========== 文本审核完成 ==========`)
    console.log(`[${logId}] 总计 ${results.length} 条文本`)
    console.log(`[${logId}] 被拦截: ${results.filter(r => r.blocked).length}`)
    console.log(`[${logId}] 失败: ${results.filter(r => r.failed || r.error).length}`)
    
    return {
      success: !hasBlockedText && !hasFailedText,
      message: hasBlockedText ? '文本内容不合规，禁止发布' : (hasFailedText ? '文本审核失败，请重试' : '文本审核通过'),
      results: results,
      hasBlockedText: hasBlockedText,
      hasFailedText: hasFailedText,
      logId: logId
    }
    
  } catch (error) {
    console.error(`[${logId}] 文本审核异常:`, error)
    console.error(`[${logId}] 错误堆栈:`, error.stack)
    
    return {
      success: false,
      message: '文本审核服务异常：' + error.message,
      logId: logId,
      error: true
    }
  }
}