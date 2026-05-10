// cloudfunctions/checkImage/index.js
const cloud = require('wx-server-sdk')
const https = require('https')
const http = require('http')

cloud.init({
  env: 'xiaowen-env-0gdw907s2b9957d2'
})

const APPID = 'wx11c832adf2cf1c6d'
const APPSECRET = '2baf2d2aa2d9b0ab66f62af8211b1ff2'

// 获取 access_token
async function getAccessToken() {
  return new Promise((resolve, reject) => {
    const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${APPID}&secret=${APPSECRET}`
    https.get(url, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          const result = JSON.parse(data)
          if (result.errcode) {
            reject(new Error(`获取 access_token 失败: ${result.errmsg}`))
          } else {
            resolve(result.access_token)
          }
        } catch (e) {
          reject(new Error('JSON解析失败: ' + data))
        }
      })
    }).on('error', reject)
  })
}

// 调用微信图片安全检测 API（使用 access_token）
async function checkImageWithTianYu(fileUrl, fileContent, logId) {
  // 1. 获取 access_token
  const accessToken = await getAccessToken()

  // 2. 下载图片（返回 Buffer，不转 Base64）
  const imageBuffer = await downloadImageAsBuffer(fileUrl, fileContent, logId)

  // 3. 调用微信图片安全检测 API（使用 multipart/form-data）
  // API 文档：https://developers.weixin.qq.com/miniprogram/dev/api-backend/open-api/sec-check/security.imgSecCheck.html
  const apiUrl = `https://api.weixin.qq.com/wxa/img_sec_check?access_token=${accessToken}`

  // 手动构造 multipart/form-data 请求体
  const boundary = '----WebKitFormBoundary' + Date.now()
  const filename = 'image.jpg'
  const contentType = 'image/jpeg'

  // 构造请求体
  const CRLF = '\r\n'
  const header = '--' + boundary + CRLF +
                'Content-Disposition: form-data; name="media"; filename="' + filename + '"' + CRLF +
                'Content-Type: ' + contentType + CRLF + CRLF
  const footer = CRLF + '--' + boundary + '--' + CRLF

  const bodyBuffer = Buffer.concat([
    Buffer.from(header),
    imageBuffer,
    Buffer.from(footer)
  ])

  const result = await new Promise((resolve, reject) => {
    const options = {
      method: 'POST',
      hostname: 'api.weixin.qq.com',
      path: '/wxa/img_sec_check?access_token=' + accessToken,
      headers: {
        'Content-Type': 'multipart/form-data; boundary=' + boundary,
        'Content-Length': bodyBuffer.length
      }
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
        } catch (e) {
          reject(new Error('响应解析失败: ' + data))
        }
      })
    })

    req.on('error', (err) => {
      reject(err)
    })

    req.setTimeout(10000, () => {
      req.destroy()
      reject(new Error('API 调用超时'))
    })

    // 写入请求体并结束请求
    req.write(bodyBuffer)
    req.end()
  })

  // 4. 处理返回结果
  if (result.errcode === 0) {
    // 审核通过
    return {
      errcode: 0,
      data: JSON.stringify({
        Suggestion: 'Pass',
        Label: 'Normal',
        errCode: 0,
        errMsg: 'OK'
      })
    }
  } else if (result.errcode === 87014) {
    // 内容违规
    console.log(`[${logId}] 图片被拦截: errcode=87014`)
    return {
      errcode: 87014,
      data: JSON.stringify({
        Suggestion: 'Block',
        Label: 'Custom',
        errCode: 87014,
        errMsg: '内容违规'
      })
    }
  } else {
    // 其他错误
    console.error(`[${logId}] 图片安全检测失败: errcode=${result.errcode}, errmsg=${result.errmsg}`)
    throw new Error(`图片安全检测失败: ${result.errmsg}`)
  }
}

async function downloadImageAsBuffer(fileUrl, fileContent, logId) {
  // 如果已经提供了图片内容（Buffer），直接返回
  if (fileContent && Buffer.isBuffer(fileContent)) {
    return fileContent
  }

  console.log(`[${logId}] 准备下载图片: ${fileUrl}`)

  // 验证fileUrl是否有效
  if (!fileUrl || typeof fileUrl !== 'string' || fileUrl.trim() === '') {
    throw new Error('图片URL为空或格式错误')
  }

  // 检查是否是无效的本地临时路径
  if (fileUrl.startsWith('http://tmp/') || fileUrl.startsWith('https://tmp/') || 
      fileUrl.startsWith('tmp/') || fileUrl.startsWith('wxfile://')) {
    console.error(`[${logId}] 检测到无效的临时文件路径: ${fileUrl}`)
    throw new Error('检测到无效的图片路径，请重新上传图片')
  }

  // 检查是否是云存储文件 ID
  if (fileUrl.startsWith('cloud://')) {
    try {
      console.log(`[${logId}] 从云存储下载图片: ${fileUrl}`)
      const downloadRes = await cloud.downloadFile({
        fileID: fileUrl
      })

      if (downloadRes.fileContent && Buffer.isBuffer(downloadRes.fileContent)) {
        if (downloadRes.fileContent.length > 1 * 1024 * 1024) {
          throw new Error('图片大小超过 1MB 限制')
        }

        console.log(`[${logId}] 云存储下载成功，大小: ${downloadRes.fileContent.length} bytes`)
        return downloadRes.fileContent
      } else {
        throw new Error('云存储下载失败：文件内容为空或格式错误')
      }
    } catch (error) {
      console.error(`[${logId}] 云存储下载异常:`, error)
      throw new Error(`云存储下载失败：${error.message}`)
    }
  }

  // 检查是否是有效的HTTP/HTTPS URL
  if (!fileUrl.startsWith('http://') && !fileUrl.startsWith('https://')) {
    console.error(`[${logId}] 无效的图片URL格式: ${fileUrl}`)
    throw new Error('图片URL格式错误，请重新上传图片')
  }

  const protocol = fileUrl.startsWith('https') ? https : http

  console.log(`[${logId}] 从网络下载图片: ${fileUrl}`)
  
  const imageBuffer = await new Promise((resolve, reject) => {
    const chunks = []
    const req = protocol.get(fileUrl, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`图片下载失败，状态码：${res.statusCode}`))
        return
      }

      res.on('data', (chunk) => chunks.push(chunk))
      res.on('end', () => resolve(Buffer.concat(chunks)))
      res.on('error', reject)
    })

    req.on('error', (error) => {
      console.error(`[${logId}] 网络下载失败:`, error)
      reject(error)
    })
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('图片下载超时'))
    })
    req.setTimeout(5000) // 5秒超时
  })

  if (imageBuffer.length > 1 * 1024 * 1024) {
    throw new Error('图片大小超过 1MB 限制')
  }

  console.log(`[${logId}] 网络下载成功，大小: ${imageBuffer.length} bytes`)
  return imageBuffer
}

exports.main = async (event, context) => {
  const logId = 'check_' + Date.now()
  console.log(`CODEBUDDY_DEBUG checkImage ${logId} start event=`, event)

  try {
    const { fileUrl, fileContent } = event

    if (!fileUrl && !fileContent) {
      return {
        success: false,
        message: '请提供图片 URL 或图片内容',
        logId: logId
      }
    }

    console.log(`CODEBUDDY_DEBUG checkImage ${logId} 开始调用checkImageWithTianYu`)

    const result = await checkImageWithTianYu(fileUrl, fileContent, logId)

    console.log(`CODEBUDDY_DEBUG checkImage ${logId} checkImageWithTianYu完成 result=`, result)

    if (result.errcode === 0) {
      const data = JSON.parse(result.data)
      const suggestion = data.Suggestion
      const label = data.Label

      if (suggestion === 'Pass') {
        return {
          success: true,
          message: '图片审核通过',
          data: {
            Suggestion: suggestion,
            Label: label
          },
          logId: logId
        }
      } else if (suggestion === 'Review') {
        return {
          success: true,
          message: '图片需要人工复审',
          data: {
            Suggestion: suggestion,
            Label: label
          },
          logId: logId,
          needReview: true
        }
      }
    } else if (result.errcode === 87014) {
      const data = JSON.parse(result.data)
      const suggestion = data.Suggestion
      const label = data.Label

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

      return {
        success: false,
        message: reason,
        data: {
          Suggestion: suggestion,
          Label: label
        },
        logId: logId
      }
    } else {
      return {
        success: false,
        message: '图片审核失败：' + (result.errmsg || '未知错误'),
        errCode: result.errcode,
        logId: logId
      }
    }
  } catch (error) {
    return {
      success: false,
      message: '图片审核服务异常：' + error.message,
      logId: logId
    }
  }
}

