// cloudfunctions/publishMaterial/index.js
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const materialsCollection = db.collection('materials');
const usersCollection = db.collection('users');

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

exports.main = async (event, context) => {
  const logId = 'material_publish_' + Date.now();
  console.log(`[${logId}] ========== 开始发布资料 ==========`);

  try {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    const { title, description, type, price, studentId, author, fileSize, format, fileId, previewFileId } = event;

    // 验证必填字段
    if (!title || !type || !studentId || !author) {
      return {
        success: false,
        message: '缺少必填字段'
      };
    }

  // 验证字段长度
  if (title.length < 2 || title.length > 50) {
    return {
      success: false,
      message: '标题长度应在2-50字之间'
    };
  }

  // 描述长度不再限制，只做基本验证
  if (description && description.length > 1000) {
    return {
      success: false,
      message: '描述过长，请控制在1000字以内'
    };
  }

    // 验证价格
    const priceNum = parseFloat(price) || 0;
    if (priceNum < 0 || priceNum > 999.99) {
      return {
        success: false,
        message: '价格应在0-999.99之间'
      };
    }

    // 文本审核
    console.log(`[${logId}] 开始文本审核`);
    const textsToCheck = [
      { fieldName: 'title', text: title }
    ];

    if (description && description.trim()) {
      textsToCheck.push({ fieldName: 'description', text: description });
    }

    const textCheckResult = await checkTextWithCloudFunction(textsToCheck, logId);

    if (!textCheckResult.success) {
      const errorMessage = textCheckResult.message || '文本审核失败';
      console.error(`[${logId}] 文本审核失败: ${errorMessage}`);

      // 异步保存审核日志
      saveAuditLog(db, {
        type: 'material_text',
        openid: openid,
        title: title,
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
      type: 'material_text',
      openid: openid,
      title: title,
      result: textCheckResult,
      status: 'passed'
    }).catch(err => console.error(`[${logId}] 保存审核日志失败:`, err));

    console.log(`[${logId}] 文本审核通过`);

    // 生成文件访问链接
    let fileUrl = '';
    if (fileId) {
      try {
        const fileList = [fileId];
        const result = await cloud.getTempFileURL({
          fileList: fileList
        });
        if (result.fileList && result.fileList[0]) {
          fileUrl = result.fileList[0].tempFileURL;
        }
      } catch (error) {
        console.error('获取文件链接失败:', error);
        // 继续执行，文件链接为空不影响资料发布
      }
    }

    // 生成预览图访问链接
    let previewFileUrl = '';
    if (previewFileId) {
      try {
        const previewFileList = [previewFileId];
        const previewResult = await cloud.getTempFileURL({
          fileList: previewFileList
        });
        if (previewResult.fileList && previewResult.fileList[0]) {
          previewFileUrl = previewResult.fileList[0].tempFileURL;
        }
      } catch (error) {
        console.error('获取预览图链接失败:', error);
        // 继续执行，预览图链接为空不影响资料发布
      }
    }

    // 获取用户完整信息
    let userInfo = author;
    try {
      const userResult = await usersCollection.where({ _openid: openid }).get();
      if (userResult.data && userResult.data.length > 0) {
        userInfo = {
          ...author,
          _id: userResult.data[0]._id,
          college: userResult.data[0].college || '',
          major: userResult.data[0].major || '',
          campus: userResult.data[0].campus || '',
          dorm: userResult.data[0].dorm || ''
        };
      }
    } catch (error) {
      console.error('获取用户信息失败:', error);
      // 继续执行，使用前端传递的用户信息
    }

    // 创建资料数据
    const materialData = {
      _openid: openid,
      title: title.trim(),
      description: (description || '').trim(),
      type,
      fileSize: fileSize || '未知',
      format: format || type.toUpperCase(),
      price: priceNum,
      isFree: priceNum === 0,
      author: userInfo,
      downloadCount: 0,
      favoritesCount: 0,
      createTime: new Date(),
      studentId: studentId.trim(),
      fileUrl: fileUrl,
      fileId: fileId,
      previewFileUrl: previewFileUrl,
      previewFileId: previewFileId
    };

    // 保存到数据库
    const result = await materialsCollection.add({
      data: materialData
    });

    console.log(`[${logId}] 资料保存成功，ID:`, result._id);

    // 异步创建系统通知，不阻塞主流程
    db.collection('notices').add({
      data: {
        _openid: openid,
        type: 'system',
        title: '发布成功',
        content: `您发布的资料《${materialData.title}》已成功上架`,
        relatedId: result._id,
        relatedType: 'material',
        isRead: false,
        createTime: new Date(),
        updateTime: new Date()
      }
    }).then(() => {
      console.log('创建系统通知成功')
    }).catch(error => {
      console.error('创建系统通知失败:', error)
    });

    console.log(`[${logId}] ========== 发布成功 ==========`);

    return {
      success: true,
      data: {
        ...materialData,
        _id: result._id
      },
      message: '上传成功'
    };

  } catch (error) {
    console.error(`[${logId}] 上传资料失败:`, error);
    return {
      success: false,
      message: '上传失败，请重试',
      logId: logId
    };
  }
};