// cloudfunctions/updateUserInfo/index.js
const cloud = require('wx-server-sdk')
cloud.init()

const db = cloud.database()

async function checkTextWithCloudFunction(texts, logId) {
  try {
    console.log(`[${logId}] 开始文本审核，共 ${texts.length} 条文本`);

    const result = await cloud.callFunction({
      name: 'checkText',
      data: {
        texts: texts
      },
      timeout: 10000 // 10秒超时
    });

    console.log(`[${logId}] 文本审核完成:`, JSON.stringify(result.result));

    if (!result.result || !result.result.success) {
      console.error(`[${logId}] 文本审核失败:`, result.result);
      return {
        success: false,
        message: result.result?.message || '文本审核失败',
        hasBlockedText: result.result?.hasBlockedText
      };
    }

    return result.result;
  } catch (error) {
    console.error(`[${logId}] 调用文本审核云函数失败:`, error);
    return {
      success: false,
      message: '文本审核服务异常，请重试'
    };
  }
}

async function saveAuditLog(db, data) {
  try {
    await db.collection('audit_logs').add({
      data: {
        ...data,
        createTime: new Date()
      }
    });
  } catch (error) {
    console.error('保存审核日志失败:', error);
  }
}

/**
 * 更新用户信息云函数
 * @param {Object} event - 事件对象，包含用户信息
 * @param {Object} event.userInfo - 用户信息
 * @param {Object} context - 上下文对象
 * @returns {Object} - 操作结果
 */
exports.main = async (event, context) => {
  const logId = 'user_update_' + Date.now();
  console.log(`[${logId}] ========== 开始更新用户信息 ==========`);

  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID

    if (!openid) {
      return {
        success: false,
        message: '获取用户openid失败'
      }
    }

    if (!event.userInfo) {
      return {
        success: false,
        message: '用户信息不能为空'
      }
    }

    // 文本审核：昵称和个性签名（bio）
    const { userInfo } = event;
    const textsToCheck = [];

    if (userInfo.nickname && userInfo.nickname.trim()) {
      textsToCheck.push({ fieldName: 'nickname', text: userInfo.nickname });
    }

    // 同时检查 signature 和 bio 字段（兼容不同版本的命名）
    const signatureText = userInfo.signature || userInfo.bio || '';
    if (signatureText && signatureText.trim()) {
      textsToCheck.push({ fieldName: 'signature', text: signatureText });
    }

    if (textsToCheck.length > 0) {
      console.log(`[${logId}] 开始文本审核`);
      const textCheckResult = await checkTextWithCloudFunction(textsToCheck, logId);

      if (!textCheckResult.success) {
        const errorMessage = textCheckResult.message || '文本审核失败';
        console.error(`[${logId}] 文本审核失败: ${errorMessage}`);

        // 异步保存审核日志
        saveAuditLog(db, {
          type: 'user_info',
          openid: openid,
          nickname: userInfo.nickname,
          signature: userInfo.signature,
          result: textCheckResult,
          status: 'rejected',
          reason: errorMessage,
          texts: textsToCheck.map(t => ({ field: t.fieldName, text: t.text.substring(0, 50) }))
        }).catch(err => console.error(`[${logId}] 保存审核日志失败:`, err));

        return {
          success: false,
          message: errorMessage,
          logId: logId,
          textCheckResult: textCheckResult
        };
      }

      // 异步保存文本审核通过的日志
      saveAuditLog(db, {
        type: 'user_info',
        openid: openid,
        nickname: userInfo.nickname,
        signature: userInfo.signature,
        result: textCheckResult,
        status: 'passed'
      }).catch(err => console.error(`[${logId}] 保存审核日志失败:`, err));

      console.log(`[${logId}] 文本审核通过`);
    }

    // 构建更新数据
    const updateData = {
      ...event.userInfo,
      updateTime: new Date(),
      // 确保dormitory字段存在
      dormitory: event.userInfo.dorm || event.userInfo.dormitory || ''
    }

    // 删除可能导致问题的字段
    delete updateData._id

    // 更新用户信息
    const result = await db.collection('users')
      .where({ _openid: openid })
      .update({
        data: updateData
      })

    console.log(`[${logId}] 用户信息更新成功`);

    if (result.stats.updated === 0) {
      // 如果没有更新到记录，可能是新用户，尝试添加
      try {
        await db.collection('users').add({
          data: {
            ...updateData,
            _openid: openid,
            createTime: new Date(),
            isAdmin: false,
            creditScore: 100
          }
        })
        console.log(`[${logId}] 用户信息添加成功`);

        return {
          success: true,
          message: '用户信息添加成功'
        }
      } catch (addError) {
        console.error(`[${logId}] 添加用户信息失败:`, addError);
        return {
          success: false,
          message: '添加用户信息失败',
          error: addError.message
        }
      }
    }

    console.log(`[${logId}] ========== 用户信息更新成功 ==========`);

    return {
      success: true,
      message: '用户信息更新成功',
      data: result
    }
  } catch (error) {
    console.error(`[${logId}] 更新用户信息失败:`, error)
    return {
      success: false,
      message: '更新用户信息失败',
      error: error.message,
      logId: logId
    }
  }
}