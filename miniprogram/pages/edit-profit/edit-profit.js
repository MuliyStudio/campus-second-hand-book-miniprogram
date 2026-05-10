// pages/edit-profit/edit-profit.js
Page({
  data: {
    isLoading: true,
    isSubmitting: false,
    formData: {},
    gradeOptions: [],
    gradeIndex: 0,
    campusOptions: ['西校区', '东校区'],
    campusIndex: 0,
    dormOptions: [],
    dormIndex: 0,
    isDormDisabled: false,
    collegeOptions: [
      '建筑与电气工程学院',
      '文化与传媒学院（凤凰数字媒体学院）',
      '教师教育学院（师范学院）',
      '旅游与体育健康学院',
      '人工智能学院（现代产业学院）',
      '外国语学院（国际教育学院）',
      '经济与管理学院',
      '设计学院',
      '材料与化学工程学院',
      '食品与生物工程学院',
      '马克思学院'
    ],
    collegeIndex: 0,
    majorOptions: [],
    majorIndex: 0,
    // 学院专业映射
    collegeMajorMap: {
      '建筑与电气工程学院': ['工程管理', '电气自动', '土木工程', '工程造价'],
      '文化与传媒学院（凤凰数字媒体学院）': ['数媒', '编导', '汉本', '播主', '网媒', '播导'],
      '教师教育学院（师范学院）': ['学前教育', '小学教育', '舞蹈学前', '音乐学', '历史学', '数学', '体育教学', '心理学'],
      '旅游与体育健康学院': ['酒店管理', '酒管管理', '旅游管理', '运动康复', '社会体育指导与管理', '公共事业管理'],
      '人工智能学院（现代产业学院）': ['机械', '电子', '集电', '通信', '数据', '人工', '网工', '制造', '软件', '物联', '机器人'],
      '外国语学院（国际教育学院）': ['英语', '电气功能及自动化', '食品质量与安全', '商务英语', '土木工程', '机械设计制造及自动化', '汉语言文学', '人工智能', '跨境电子商务', '软工', '国际经济与贸易'],
      '经济与管理学院': ['数字经济', '金融科技', '财务管理', '国际经济与贸易'],
      '设计学院': ['视觉传达', '服装服饰', '美术学', '环境设计', '产品设计'],
      '材料与化学工程学院': ['分体材料', '高分子材料', '应用化学'],
      '食品与生物工程学院': ['食品科学', '食品质量', '生物工程', '茶学'],
      '马克思学院': ['思政']
    }
  },

  onLoad: function (options) {
    this.checkLoginStatus();
    this.generateGradeOptions();
    this.loadUserData();
  },

  onShow: function () {
    this.checkLoginStatus();
  },

  // 检查登录状态
  checkLoginStatus: function() {
    const app = getApp();
    if (!app.globalData.isLoggedIn || !app.globalData.userInfo) {
      wx.navigateTo({
        url: '../login/login'
      });
      return false;
    }
    return true;
  },

  // 生成年级选项
  generateGradeOptions: function() {
    const currentYear = new Date().getFullYear();
    const gradeOptions = [];
    for (let i = currentYear; i >= currentYear - 10; i--) {
      gradeOptions.push(i);
    }
    this.setData({ gradeOptions });
  },

  // 加载用户数据
  loadUserData: function() {
    const app = getApp();
    const userInfo = app.globalData.userInfo;
    
    if (!userInfo) {
      this.setData({ isLoading: false });
      return;
    }
    
    // 处理字段映射和数据类型转换，并添加默认值，与user-center页面保持一致
    const formData = {
      ...userInfo,
      // 处理宿舍字段名称差异
      dorm: userInfo.dorm || userInfo.dormitory || '',
      // 确保grade是数字类型
      grade: typeof userInfo.grade === 'string' ? parseInt(userInfo.grade) : userInfo.grade,
      // 添加默认值，与user-center页面保持一致
      _id: userInfo._id || 'user_self',
      nickname: userInfo.nickname || '我',
      avatarUrl: userInfo.avatarUrl || '',
      campus: userInfo.campus || '西校区',
      college: userInfo.college || '建筑与电气工程学院',
      major: userInfo.major || '',
      studentId: userInfo.studentId || '20230001',
      bio: userInfo.bio || '这个人很懒，还没有写个人简介~'
    };
    
    // 计算选择器索引
    const gradeIndex = this.data.gradeOptions.indexOf(formData.grade);
    const campusIndex = this.data.campusOptions.indexOf(formData.campus);
    const collegeIndex = this.data.collegeOptions.indexOf(formData.college);
    
    // 初始化专业选项
    const college = formData.college;
    const majorOptions = this.data.collegeMajorMap[college] || [];
    const majorIndex = majorOptions.indexOf(formData.major);
    
    // 初始化宿舍选项
    let dormOptions = ['南苑', '西苑', '北苑'];
    let dormIndex = 0;
    let isDormDisabled = false;
    
    if (formData.campus === '东校区') {
      dormOptions = ['东苑'];
      dormIndex = 0;
      isDormDisabled = true;
      formData.dorm = '东苑';
      formData.dormitory = '东苑';
    } else if (formData.campus === '西校区') {
      dormOptions = ['南苑', '西苑', '北苑'];
      dormIndex = dormOptions.indexOf(formData.dorm);
      if (dormIndex < 0) dormIndex = 0;
    }
    
    this.setData({
      formData: formData,
      gradeIndex: gradeIndex >= 0 ? gradeIndex : 0,
      campusIndex: campusIndex >= 0 ? campusIndex : 0,
      collegeIndex: collegeIndex >= 0 ? collegeIndex : 0,
      majorOptions: majorOptions,
      majorIndex: majorIndex >= 0 ? majorIndex : 0,
      dormOptions: dormOptions,
      dormIndex: dormIndex,
      isDormDisabled: isDormDisabled,
      isLoading: false
    });
  },

  // 选择头像（带审核）
  chooseAvatar: async function() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const tempFilePaths = res.tempFiles;

        if (tempFilePaths && tempFilePaths.length > 0) {
          const tempFilePath = tempFilePaths[0].tempFilePath;

          try {
            // 先上传到云存储
            wx.showLoading({ title: '上传中...', mask: true });

            const cloudPath = `user-avatars/${Date.now()}_${Math.floor(Math.random() * 10000)}.jpg`;

            const uploadRes = await new Promise((resolve, reject) => {
              wx.cloud.uploadFile({
                cloudPath: cloudPath,
                filePath: tempFilePath,
                success: resolve,
                fail: reject
              });
            });

            wx.showLoading({ title: '正在审核头像...', mask: true });

            // 调用图片审核云函数，传入云存储文件 ID
            const checkRes = await wx.cloud.callFunction({
              name: 'checkImage',
              data: {
                fileUrl: uploadRes.fileID
              }
            });

            wx.hideLoading();

            if (!checkRes.result.success) {
              // 审核不通过
              wx.showModal({
                title: '头像审核不通过',
                content: checkRes.result.message || '头像包含违规内容，请更换后重试',
                showCancel: false,
                confirmText: '确定',
                confirmColor: '#FA5151'
              });
              return;
            }

            // 审核通过，保存头像
            this.setData({
              'formData.avatarUrl': uploadRes.fileID
            });

            wx.showToast({
              title: '头像上传成功',
              icon: 'success',
              duration: 1500
            });

          } catch (error) {
            wx.hideLoading();
            wx.showModal({
              title: '操作失败',
              content: '头像上传或审核失败，请稍后重试',
              showCancel: false,
              confirmText: '确定',
              confirmColor: '#FA5151'
            });
          }
        }
      },
      fail: (err) => {
        wx.showToast({
          title: '选择头像失败',
          icon: 'none',
          duration: 1500
        });
      }
    });
  },

  // 昵称变化
  onNicknameChange: function(e) {
    this.setData({
      'formData.nickname': e.detail.value
    });
  },

  // 学号变化
  onStudentIdChange: function(e) {
    this.setData({
      'formData.studentId': e.detail.value
    });
  },

  // 年级变化
  onGradeChange: function(e) {
    const index = e.detail.value;
    this.setData({
      gradeIndex: index,
      'formData.grade': this.data.gradeOptions[index]
    });
  },

  // 校区变化
  onCampusChange: function(e) {
    const index = e.detail.value;
    const campus = this.data.campusOptions[index];
    this.setData({
      campusIndex: index,
      'formData.campus': campus
    });
    
    // 根据校区设置宿舍选项
    if (campus === '东校区') {
      this.setData({
        'formData.dorm': '东苑',
        'formData.dormitory': '东苑',
        dormOptions: ['东苑'],
        dormIndex: 0,
        isDormDisabled: true
      });
    } else if (campus === '西校区') {
      this.setData({
        dormOptions: ['南苑', '西苑', '北苑'],
        dormIndex: 0,
        isDormDisabled: false
      });
    }
  },

  // 宿舍变化
  onDormChange: function(e) {
    const index = e.detail.value;
    const dorm = this.data.dormOptions[index];
    this.setData({
      dormIndex: index,
      'formData.dorm': dorm,
      'formData.dormitory': dorm
    });
  },

  // 学院变化
  onCollegeChange: function(e) {
    const index = e.detail.value;
    const college = this.data.collegeOptions[index];
    this.setData({
      collegeIndex: index,
      'formData.college': college,
      // 更新专业选项
      majorOptions: this.data.collegeMajorMap[college] || [],
      majorIndex: 0,
      'formData.major': ''
    });
  },

  // 专业变化
  onMajorChange: function(e) {
    const index = e.detail.value;
    const major = this.data.majorOptions[index];
    this.setData({
      majorIndex: index,
      'formData.major': major
    });
  },

  // 个人简介变化
  onBioChange: function(e) {
    this.setData({
      'formData.bio': e.detail.value
    });
  },

  // 验证表单
  validateForm: function() {
    const { formData } = this.data;
    
    if (!formData.nickname || formData.nickname.trim() === '') {
      wx.showToast({
        title: '请输入昵称',
        icon: 'none',
        duration: 1500
      });
      return false;
    }
    
    if (!formData.studentId || formData.studentId.trim() === '') {
      wx.showToast({
        title: '请输入学号',
        icon: 'none',
        duration: 1500
      });
      return false;
    }
    
    if (!formData.grade) {
      wx.showToast({
        title: '请选择年级',
        icon: 'none',
        duration: 1500
      });
      return false;
    }
    
    if (!formData.campus) {
      wx.showToast({
        title: '请选择校区',
        icon: 'none',
        duration: 1500
      });
      return false;
    }
    
    if (!formData.college) {
      wx.showToast({
        title: '请选择学院',
        icon: 'none',
        duration: 1500
      });
      return false;
    }
    
    if (!formData.major || formData.major.trim() === '') {
      wx.showToast({
        title: '请输入专业',
        icon: 'none',
        duration: 1500
      });
      return false;
    }
    
    return true;
  },

  // 保存资料
  saveProfile: function() {
    if (!this.validateForm()) {
      return;
    }
    
    this.setData({ isSubmitting: true });
    
    const app = getApp();
    const formData = this.data.formData;
    
    // 构建更新后的用户信息，确保字段名称一致
    const updatedUserInfo = {
      ...app.globalData.userInfo,
      ...formData,
      // 确保同时保存dorm和dormitory字段，保持与complete-info页面的一致性
      dormitory: formData.dorm
    };
    
    // 调用云函数更新用户信息
    wx.cloud.callFunction({
      name: 'updateUserInfo',
      data: {
        userInfo: updatedUserInfo
      },
      success: (res) => {
        console.log('updateUserInfo返回结果:', res.result);

        if (res.result.success) {
          // 更新全局数据
          app.globalData.userInfo = updatedUserInfo;

          // 保存到本地存储
          wx.setStorageSync('userInfo', updatedUserInfo);

          this.setData({ isSubmitting: false });

          wx.showToast({
            title: '保存成功',
            icon: 'success',
            duration: 1500
          });

          // 返回上一页
          setTimeout(() => {
            wx.navigateBack();
          }, 1500);
        } else {
          this.setData({ isSubmitting: false });

          // 显示错误提示，包含logId用于调试
          const errorMsg = res.result.message || '保存失败';
          const logId = res.result.logId || '';

          console.error('保存失败:', { errorMsg, logId, textCheckResult: res.result.textCheckResult });

          wx.showModal({
            title: '保存失败',
            content: errorMsg + (logId ? `\n日志ID: ${logId}` : ''),
            showCancel: false,
            confirmText: '确定',
            confirmColor: '#FA5151'
          });
        }
      },
      fail: (err) => {
        console.error('更新用户信息失败:', err);
        this.setData({ isSubmitting: false });
        wx.showModal({
          title: '保存失败',
          content: '网络错误，请重试',
          showCancel: false,
          confirmText: '确定',
          confirmColor: '#FA5151'
        });
      }
    });
  }
});