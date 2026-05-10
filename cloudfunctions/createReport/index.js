// cloudfunctions/createReport/index.js
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

// 举报类型枚举
const REPORT_TYPES = {
  COPYRIGHT: '版权侵权',
  VIOLATION: '内容违规', 
  FALSE_INFO: '虚假信息',
  SPAM: '垃圾广告',
  OTHER: '其他原因'
};

// 被举报内容类型枚举
const TARGET_TYPES = {
  MATERIAL: 'material',
  BOOK: 'book',
  POST: 'post',
  USER: 'user'
};

exports.main = async (event, context) => {
  try {
    console.log('=== 云函数调用开始 - createReport ===');
    console.log('原始event参数:', JSON.stringify(event));
    
    const wxContext = cloud.getWXContext();
    const reporterOpenid = wxContext.OPENID;
    
    console.log('OPENID:', reporterOpenid);
    
// 手动提取参数，避免解构可能的问题
const targetType = event.targetType;
const targetId = event.targetId; 
const reportType = event.reportType;
const reason = event.reason;
const evidence = event.evidence || '';
const contact = event.contact || '';

// 重要：保存原始的举报者openid，防止被意外修改
const originalReporterOpenid = reporterOpenid;

console.log('提取的参数:', { 
  targetType: targetType, 
  targetId: targetId, 
  reportType: reportType, 
  reason: reason, 
  reporterOpenid: reporterOpenid,
  evidence: evidence,
  contact: contact
});
console.log('参数类型检查:', {
  targetType_type: typeof targetType,
  targetId_type: typeof targetId,
  reportType_type: typeof reportType,
  reason_type: typeof reason
});
console.log('原始举报者openid:', originalReporterOpenid);

    // 参数验证 - 更严格的检查
    if (targetType === undefined || targetType === null || targetType === '') {
      console.log('targetType为空:', targetType);
      return {
        success: false,
        message: '缺少必要参数：targetType不能为空'
      };
    }
    
    if (targetId === undefined || targetId === null || targetId === '') {
      console.log('targetId为空:', targetId);
      return {
        success: false,
        message: '缺少必要参数：targetId不能为空'
      };
    }
    
    if (reportType === undefined || reportType === null || reportType === '') {
      console.log('reportType为空:', reportType);
      return {
        success: false,
        message: '缺少必要参数：reportType不能为空'
      };
    }
    
    if (reason === undefined || reason === null || reason === '') {
      console.log('reason为空:', reason);
      return {
        success: false,
        message: '缺少必要参数：reason不能为空'
      };
    }

    if (!Object.values(TARGET_TYPES).includes(targetType)) {
      return {
        success: false,
        message: '无效的targetType，支持：material/book/post/user'
      };
    }

    if (!Object.values(REPORT_TYPES).includes(reportType)) {
      return {
        success: false,
        message: '无效的reportType'
      };
    }

    // 获取举报者信息
    let reporterInfo = {
      nickName: '匿名用户',
      avatarUrl: ''
    };

    try {
      const userResult = await db.collection('users').where({
        _openid: reporterOpenid
      }).field({
        nickName: true,
        avatarUrl: true
      }).get();

      if (userResult.data.length > 0) {
        reporterInfo = userResult.data[0];
      }
    } catch (error) {
      console.error('获取举报者信息失败:', error);
    }

    // 检查是否已经举报过相同内容
    const existingReport = await db.collection('reports').where({
      reporterOpenid: reporterOpenid,
      targetType: targetType,
      targetId: targetId,
      status: _.neq('resolved')
    }).get();

    if (existingReport.data.length > 0) {
      return {
        success: false,
        message: '您已经举报过此内容，请勿重复举报'
      };
    }

    // 创建举报记录 - 使用原始的举报者openid，确保不被修改
    const reportData = {
      reporterOpenid: originalReporterOpenid, // 使用保存的原始值，防止被意外修改
      reporterInfo: reporterInfo,
      targetType: targetType,
      targetId: targetId,
      reportType: reportType,
      reason: reason,
      evidence: evidence,
      contact: contact,
      status: 'pending', // pending: 待处理, reviewed: 已审核, resolved: 已解决, dismissed: 已驳回
      priority: 'normal', // low: 低, normal: 普通, high: 高, urgent: 紧急
      adminNotes: '',
      handlerOpenid: '', // 初始化为空，只有管理员处理时才设置
      createTime: db.serverDate(),
      updateTime: db.serverDate()
    };

    // 重要：验证举报者openid不为空且不是管理员（防止误操作）
    if (!originalReporterOpenid) {
      console.error('举报者openid为空');
      return {
        success: false,
        message: '无法获取举报者身份信息'
      };
    }

    // 检查当前用户是否为管理员，如果是管理员举报可能需要特殊处理
    const currentUserCheck = await db.collection('users').where({
      _openid: originalReporterOpenid,
      isAdmin: true
    }).get();

    if (currentUserCheck.data.length > 0) {
      console.log('警告：管理员用户发起举报，openid:', originalReporterOpenid);
      // 管理员也可以举报，但需要记录这个特殊情况
      reportData.isAdminReport = true;
    } else {
      reportData.isAdminReport = false;
    }

    // 根据举报类型设置优先级
    if (reportType === REPORT_TYPES.COPYRIGHT) {
      reportData.priority = 'high';
    } else if (reportType === REPORT_TYPES.VIOLATION) {
      reportData.priority = 'urgent';
    }

    const result = await db.collection('reports').add({
      data: reportData
    });

    console.log('举报记录创建成功:', result._id);

    // 获取管理员列表并发送系统消息
    await sendReportNotificationToAdmins(result._id, reportData);

    console.log('=== 云函数调用结束 - createReport ===');

    return {
      success: true,
      data: {
        reportId: result._id,
        message: '举报提交成功，我们会尽快处理'
      },
      message: '举报提交成功'
    };

  } catch (error) {
    console.error('创建举报记录失败:', error);
    console.error('错误堆栈:', error.stack);
    return {
      success: false,
      message: '举报提交失败，请重试',
      error: error.message
    };
  }
};

// 发送举报通知给所有管理员
async function sendReportNotificationToAdmins(reportId, reportData) {
  try {
    // 查找所有管理员用户
    const adminResult = await db.collection('users').where({
      isAdmin: true
    }).field({
      _openid: true,
      nickName: true,
      avatarUrl: true
    }).get();

    console.log(`找到 ${adminResult.data.length} 个管理员`);

    if (adminResult.data.length === 0) {
      console.log('没有找到管理员用户');
      return;
    }

    // 获取被举报内容的基本信息
    const targetInfo = await getTargetInfo(reportData.targetType, reportData.targetId);

    // 为每个管理员创建系统消息
    const messagePromises = adminResult.data.map(async (admin) => {
      const messageData = {
        _openid: admin._openid,
        type: 'system',
        subType: 'report',
        title: '新的举报通知',
        content: `收到一条新的举报：\n举报类型：${reportData.reportType}\n被举报内容：${targetInfo.title || '未知'}\n举报理由：${reportData.reason}`,
        relatedId: reportId,
        relatedType: 'report',
        reportInfo: {
          reportId: reportId,
          reportType: reportData.reportType,
          targetType: reportData.targetType,
          targetId: reportData.targetId,
          reason: reportData.reason,
          reporterInfo: reportData.reporterInfo,
          priority: reportData.priority,
          targetInfo: targetInfo
        },
        isRead: false,
        createTime: db.serverDate()
      };

      return db.collection('notices').add({
        data: messageData
      });
    });

    await Promise.all(messagePromises);
    console.log('管理员通知发送完成');

  } catch (error) {
    console.error('发送管理员通知失败:', error);
  }
}

// 获取被举报内容的信息
async function getTargetInfo(targetType, targetId) {
  try {
    let collection, title = '', uploaderName = '', status = '';

    switch (targetType) {
      case TARGET_TYPES.MATERIAL:
        collection = 'materials';
        const materialResult = await db.collection(collection).doc(targetId).get();
        if (materialResult.data) {
          title = materialResult.data.title || '未知资料';
          uploaderName = materialResult.data.uploaderName || '未知用户';
          status = materialResult.data.status || 'unknown';
        }
        break;

      case TARGET_TYPES.BOOK:
        collection = 'books';
        const bookResult = await db.collection(collection).doc(targetId).get();
        if (bookResult.data) {
          title = bookResult.data.title || '未知书籍';
          uploaderName = bookResult.data.uploaderName || '未知用户';
          status = bookResult.data.status || 'unknown';
        }
        break;

      case TARGET_TYPES.POST:
        collection = 'posts';
        const postResult = await db.collection(collection).doc(targetId).get();
        if (postResult.data) {
          title = postResult.data.content.substring(0, 50) + '...' || '未知帖子';
          uploaderName = postResult.data.authorName || '未知用户';
          status = 'published';
        }
        break;

      case TARGET_TYPES.USER:
        collection = 'users';
        const userResult = await db.collection(collection).doc(targetId).get();
        if (userResult.data) {
          title = userResult.data.nickName || '未知用户';
          uploaderName = userResult.data.nickName || '未知用户';
          status = 'active';
        }
        break;
    }

    return {
      title: title,
      uploaderName: uploaderName,
      status: status,
      type: targetType
    };
  } catch (error) {
    console.error('获取被举报内容信息失败:', error);
    return {
      title: '未知内容',
      uploaderName: '未知用户',
      status: 'unknown',
      type: targetType
    };
  }
}