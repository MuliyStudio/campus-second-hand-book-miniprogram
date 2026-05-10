// cloudfunctions/getAccessToken/index.js
const cloud = require('wx-server-sdk')
cloud.init()

const https = require('https')

const APPID = 'wx11c832adf2cf1c6d'
const APPSECRET = '2baf2d2aa2d9b0ab66f62af8211b1ff2'

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    console.log(`CODEBUDDY_DEBUG getAccessToken 开始HTTPS请求 url=${url.substring(0, 50)}...`)

    const req = https.get(url, (res) => {
      console.log(`CODEBUDDY_DEBUG getAccessToken HTTPS响应状态 statusCode=${res.statusCode}`)

      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          const result = JSON.parse(data)
          console.log(`CODEBUDDY_DEBUG getAccessToken HTTPS请求完成 success=${!!result.access_token}`)
          resolve(result)
        } catch (e) {
          console.error(`CODEBUDDY_DEBUG getAccessToken JSON解析失败 error=${e.message}`)
          reject(new Error('JSON解析失败: ' + data))
        }
      })
    }).on('error', (error) => {
      console.error(`CODEBUDDY_DEBUG getAccessToken HTTPS请求失败 error=${error.message}`)
      reject(error)
    })

    // 设置5秒超时
    req.setTimeout(5000, () => {
      console.error(`CODEBUDDY_DEBUG getAccessToken HTTPS请求超时5秒`)
      req.destroy()
      reject(new Error('HTTPS请求超时'))
    })
  })
}

exports.main = async (event, context) => {
  const logId = 'token_' + Date.now()
  console.log(`[${logId}] 开始获取access_token`)
  
  try {
    if (!APPSECRET || APPSECRET === '你的AppSecret') {
      console.error(`[${logId}] 错误: 未配置AppSecret`)
      return {
        success: false,
        message: '请在云函数中配置正确的AppSecret'
      }
    }
    
    const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${APPID}&secret=${APPSECRET}`
    
    console.log(`[${logId}] 请求微信API...`)
    
    const result = await httpsGet(url)
    
    console.log(`[${logId}] API响应:`, JSON.stringify(result))
    
    if (result.errcode) {
      console.error(`[${logId}] API错误: errcode=${result.errcode}, errmsg=${result.errmsg}`)
      return {
        success: false,
        message: result.errmsg || '获取access_token失败',
        errcode: result.errcode
      }
    }
    
    if (!result.access_token) {
      console.error(`[${logId}] 错误: access_token为空`)
      return {
        success: false,
        message: 'access_token为空'
      }
    }
    
    console.log(`[${logId}] access_token获取成功`)
    
    return {
      success: true,
      access_token: result.access_token,
      expires_in: result.expires_in || 7200
    }
  } catch (error) {
    console.error(`[${logId}] 获取access_token异常:`, error)
    return {
      success: false,
      message: '获取access_token失败: ' + error.message
    }
  }
}
