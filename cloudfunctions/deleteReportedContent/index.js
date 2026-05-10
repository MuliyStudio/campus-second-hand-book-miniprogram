// cloudfunctions/deleteReportedContent/index.js
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  try {
    console.log('=== 云函数调用开始 - deleteReportedContent ===');
    console.log('参数:', JSON.stringify(event));
    
    const wxContext = cloud.getWXContext();
    const adminOpenid = wxContext.OPENID;
    
    const { reportId, targetType, targetId, deleteReason } = event;
    
    // 参数验证
    if (!reportId || !targetType || !targetId) {
      console.error('参数验证失败:', { reportId, targetType, targetId });
      return {
        success: false,
        message: '缺少必要参数'
      };
    }
    
    console.log('管理员openid:', adminOpenid);
    
    // 检查调用者是否为管理员
    const adminCheck = await db.collection('users').where({
      _openid: adminOpenid,
      isAdmin: true
    }).get();
    
    console.log('管理员检查结果:', adminCheck.data);
    
    if (adminCheck.data.length === 0) {
      return {
        success: false,
        message: '无权限操作，仅限管理员'
      };
    }
    
    console.log('管理员验证通过');
    
    // 根据目标类型删除内容（硬删除，与 deleteMaterial/deleteBook 保持一致）
    let deleteResult = null;
    let targetInfo = null;
    let fileIds = []; // 需要删除的云存储文件
    
    console.log('开始删除内容，目标类型:', targetType, '目标ID:', targetId);
    
    switch (targetType) {
      case 'material':
        // 删除资料
        console.log('查询资料:', targetId);
        const materialResult = await db.collection('materials').doc(targetId).get();
        console.log('资料查询结果:', materialResult.data);
        
        if (materialResult.data) {
          targetInfo = materialResult.data;
          // 收集需要删除的文件
          if (targetInfo.fileId) {
            fileIds.push(targetInfo.fileId);
          }
          if (targetInfo.coverImage) {
            fileIds.push(targetInfo.coverImage);
          }
          if (targetInfo.images && Array.isArray(targetInfo.images)) {
            fileIds = fileIds.concat(targetInfo.images);
          }
          
          console.log('准备硬删除资料:', targetId);
          deleteResult = await db.collection('materials').doc(targetId).remove();
          console.log('资料删除结果:', deleteResult);
        } else {
          console.error('未找到资料:', targetId);
        }
        break;
        
      case 'book':
        // 删除书籍
        console.log('查询书籍:', targetId);
        const bookResult = await db.collection('books').doc(targetId).get();
        console.log('书籍查询结果:', bookResult.data);
        
        if (bookResult.data) {
          targetInfo = bookResult.data;
          // 收集需要删除的图片
          if (targetInfo.images && Array.isArray(targetInfo.images)) {
            fileIds = fileIds.concat(targetInfo.images);
          }
          if (targetInfo.coverImage) {
            fileIds.push(targetInfo.coverImage);
          }
          
          console.log('准备硬删除书籍:', targetId);
          deleteResult = await db.collection('books').doc(targetId).remove();
          console.log('书籍删除结果:', deleteResult);
        } else {
          console.error('未找到书籍:', targetId);
        }
        break;
        
      case 'post':
        // 删除帖子
        console.log('查询帖子:', targetId);
        const postResult = await db.collection('posts').doc(targetId).get();
        console.log('帖子查询结果:', postResult.data);
        
        if (postResult.data) {
          targetInfo = postResult.data;
          // 收集需要删除的图片
          if (postResult.data.images && Array.isArray(postResult.data.images)) {
            fileIds = fileIds.concat(postResult.data.images);
          }
          
          console.log('准备硬删除帖子:', targetId);
          deleteResult = await db.collection('posts').doc(targetId).remove();
          console.log('帖子删除结果:', deleteResult);
        } else {
          console.error('未找到帖子:', targetId);
        }
        break;
        
      case 'user':
        // 封禁用户（用户不硬删除，改为封禁）
        const userResult = await db.collection('users').doc(targetId).get();
        if (userResult.data) {
          targetInfo = userResult.data;
          deleteResult = await db.collection('users').doc(targetId).update({
            data: {
              status: 'banned',
              banReason: deleteReason || '管理员封禁违规用户',
              banTime: db.serverDate(),
              bannedBy: adminOpenid
            }
          });
        }
        break;
        
      default:
        return {
          success: false,
          message: '无效的目标类型'
        };
    }
    
    if (!targetInfo) {
      return {
        success: false,
        message: '目标内容不存在'
      };
    }
    
    // 检查删除是否实际生效
    if (deleteResult && deleteResult.stats && deleteResult.stats.removed === 0 && targetType !== 'user') {
      console.error('删除操作未实际生效，stats:', deleteResult.stats);
      return {
        success: false,
        message: '删除操作未生效，请重试'
      };
    }
    
    // 删除关联的云存储文件
    if (fileIds.length > 0) {
      try {
        console.log('准备删除云存储文件:', fileIds);
        await cloud.deleteFile({
          fileList: fileIds
        });
        console.log('云存储文件删除成功');
      } catch (err) {
        console.error('云存储文件删除失败:', err);
        // 文件删除失败不影响整体结果
      }
    }
    
    // 更新举报记录状态
    await db.collection('reports').doc(reportId).update({
      data: {
        status: 'resolved',
        adminNotes: deleteReason || '管理员删除违规内容',
        handlerOpenid: adminOpenid,
        updateTime: db.serverDate(),
        actionTaken: 'delete'
      }
    });
    
    // 更新通知消息中的举报状态（让消息弹窗正确显示"已删除"并隐藏删除按钮）
    try {
      const { data: relatedNotices } = await db.collection('notices').where({
        'reportInfo.reportId': reportId,
        subType: 'report'
      }).limit(100).get();
      
      if (relatedNotices.length > 0) {
        console.log('找到', relatedNotices.length, '条相关通知消息，更新举报状态为deleted');
        const updatePromises = relatedNotices.map(notice => {
          return db.collection('notices').doc(notice._id).update({
            data: {
              'reportInfo.targetInfo.status': 'deleted',
              'reportInfo.targetInfo.deleteTime': db.serverDate(),
              'reportInfo.targetInfo.deletedBy': adminOpenid
            }
          });
        });
        await Promise.all(updatePromises);
        console.log('通知消息状态更新完成');
      }
    } catch (noticeErr) {
      console.error('更新通知消息状态失败:', noticeErr);
      // 通知更新失败不影响主流程
    }
    
    // 发送处理结果通知给举报人
    const reportRecord = await db.collection('reports').doc(reportId).get();
    if (reportRecord.data && reportRecord.data.reporterOpenid) {
      // 获取举报者信息用于个性化通知
      const reporterInfo = reportRecord.data.reporterInfo || {};
      const reporterNickName = reporterInfo.nickName || '举报人';
      
      await db.collection('notices').add({
        data: {
          _openid: reportRecord.data.reporterOpenid, // 使用举报者的openid，确保反馈给正确的举报人
          type: 'system',
          subType: 'content_deleted',
          title: '举报处理结果反馈',
          content: `尊敬的${reporterNickName}，您举报的"${targetInfo.title || '内容'}"已被管理员处理。处理结果：${deleteReason || '删除违规内容'}。感谢您的监督！`,
          relatedId: reportId,
          relatedType: 'report',
          reportInfo: {
            reportId: reportId,
            reportType: reportRecord.data.reportType,
            targetType: reportRecord.data.targetType,
            targetId: reportRecord.data.targetId,
            originalReason: reportRecord.data.reason,
            processedBy: adminOpenid,
            processTime: db.serverDate()
          },
          isRead: false,
          createTime: db.serverDate()
        }
      });

      console.log('已向举报者发送处理结果通知:', {
        reporterOpenid: reportRecord.data.reporterOpenid,
        reporterNickName: reporterNickName,
        targetTitle: targetInfo.title || '内容'
      });
    } else {
      console.warn('无法发送处理结果通知：举报记录中缺少举报者信息');
    }
    
    // 记录审核日志
    await db.collection('audit_logs').add({
      data: {
        adminOpenid: adminOpenid,
        action: 'delete_content',
        targetType: targetType,
        targetId: targetId,
        targetTitle: targetInfo.title || targetInfo.nickName || '未知',
        reportId: reportId,
        reason: deleteReason || '管理员删除违规内容',
        createTime: db.serverDate()
      }
    });
    
    console.log('=== 云函数调用结束 - deleteReportedContent ===');
    console.log('删除成功:', {
      targetType: targetType,
      targetId: targetId,
      title: targetInfo.title || targetInfo.nickName || '未知'
    });
    
    return {
      success: true,
      message: '删除成功',
      data: {
        targetType: targetType,
        targetId: targetId,
        title: targetInfo.title || targetInfo.nickName || '未知'
      }
    };
    
  } catch (error) {
    console.error('删除举报内容失败:', error);
    console.error('错误堆栈:', error.stack);
    return {
      success: false,
      message: '删除失败：' + error.message
    };
  }
};