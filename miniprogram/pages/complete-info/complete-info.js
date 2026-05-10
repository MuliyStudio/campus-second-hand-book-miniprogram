// pages/complete-info/complete-info.js
Page({
  data: {
    statusBarHeight: 0,
    campus: '',
    college: '',
    major: '',
    grade: '',
    studentId: '',
    dormitory: '',
    avatarUrl: '/images/default-avatar.png',
    isGettingUserInfo: false,
    isAvatarLoaded: false,
    showTime: '14:30',  // 示例时间
    // 年级选项
    gradeOptions: [],
    gradeIndex: 0,
    // 学院选项
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
    // 专业选项（根据学院动态变化）
    majorOptions: [],
    majorIndex: 0,
    // 宿舍选项
    dormOptions: [],
    dormIndex: 0,
    isDormDisabled: false,
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

  onLoad(options) {
    // 获取状态栏高度
    const res = wx.getSystemInfoSync();
    this.setData({
      statusBarHeight: res.statusBarHeight
    });

    // 从登录页面传递过来的微信头像和昵称
    if (options.avatarUrl) {
      this.setData({
        avatarUrl: decodeURIComponent(options.avatarUrl),
        isAvatarLoaded: true
      });
    }

    if (options.nickName) {
      this.setData({
        nickname: decodeURIComponent(options.nickName)
      });
    }

    // 生成年级选项
    this.generateGradeOptions();

    // 初始化专业选项（不默认选择学院）
    this.setData({
      majorOptions: [],
      college: ''
    });

    // 初始化宿舍选项
    this.setData({
      dormOptions: ['南苑', '西苑', '北苑']
    });
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

  // 获取微信用户信息
  getUserProfile() {
    if (this.data.isGettingUserInfo) return;
    
    this.setData({ isGettingUserInfo: true });
    
    wx.showLoading({ title: '获取中...', mask: true });
    
    wx.getUserProfile({
      desc: '用于完善个人信息',
      success: (res) => {
        console.log('获取用户信息成功');
        const tempAvatarUrl = res.userInfo.avatarUrl;
        const nickname = res.userInfo.nickName || '';
        
        this.setData({
          nickname: nickname
        });
        
        // 下载头像图片并上传到云存储
        this.downloadAndUploadAvatar(tempAvatarUrl, nickname);
      },
      fail: (err) => {
        console.error('获取用户信息失败:', err);
        this.setData({ isGettingUserInfo: false });
        wx.hideLoading();
        wx.showToast({
          title: '获取失败，请手动输入',
          icon: 'none',
          duration: 1500
        });
      }
    });
  },

  // 下载并上传头像到云存储（带审核）
  downloadAndUploadAvatar: async function(tempAvatarUrl, nickname) {
    wx.showLoading({ title: '上传头像中...', mask: true });

    try {
      // 先下载头像到本地临时文件
      const downloadRes = await new Promise((resolve, reject) => {
        wx.downloadFile({
          url: tempAvatarUrl,
          success: resolve,
          fail: reject
        });
      });

      if (downloadRes.statusCode !== 200) {
        wx.hideLoading();
        this.setData({
          isGettingUserInfo: false,
          avatarUrl: tempAvatarUrl
        });
        wx.showToast({
          title: '头像下载失败，使用临时头像',
          icon: 'none',
          duration: 2000
        });
        return;
      }

      const tempFilePath = downloadRes.tempFilePath;

      // 对头像进行审核
      wx.showLoading({ title: '正在审核头像...', mask: true });

      const checkRes = await wx.cloud.callFunction({
        name: 'checkImage',
        data: {
          fileUrl: tempFilePath
        }
      });

      console.log('头像审核结果:', checkRes.result);

      if (!checkRes.result.success) {
        // 审核不通过
        wx.hideLoading();
        this.setData({
          isGettingUserInfo: false,
          avatarUrl: tempAvatarUrl
        });
        wx.showModal({
          title: '头像审核不通过',
          content: checkRes.result.message || '头像包含违规内容，请更换后重试',
          showCancel: false,
          confirmText: '确定',
          confirmColor: '#FA5151'
        });
        return;
      }

      wx.showLoading({ title: '上传头像中...', mask: true });

      // 上传到云存储
      const cloudPath = `user-avatars/${Date.now()}_${Math.floor(Math.random() * 10000)}.jpg`;

      const uploadRes = await new Promise((resolve, reject) => {
        wx.cloud.uploadFile({
          cloudPath: cloudPath,
          filePath: tempFilePath,
          success: resolve,
          fail: reject
        });
      });

      wx.hideLoading();
      this.setData({
        avatarUrl: uploadRes.fileID,
        isGettingUserInfo: false,
        isAvatarLoaded: true
      });
      wx.showToast({
        title: '获取成功',
        icon: 'success',
        duration: 1500
      });

    } catch (error) {
      wx.hideLoading();
      console.error('头像上传失败:', error);
      this.setData({
        isGettingUserInfo: false,
        avatarUrl: tempAvatarUrl
      });
      wx.showToast({
        title: '头像上传失败，使用临时头像',
        icon: 'none',
        duration: 2000
      });
    }
  },

  onCampusChange(e) {
    const campus = e.currentTarget.dataset.value;
    this.setData({ campus: campus });
    
    // 根据校区设置宿舍选项
    if (campus === '东校区') {
      this.setData({
        dormitory: '东苑',
        dormOptions: ['东苑'],
        dormIndex: 0,
        isDormDisabled: true
      });
    } else if (campus === '西校区') {
      this.setData({
        dormitory: '',
        dormOptions: ['南苑', '西苑', '北苑'],
        dormIndex: 0,
        isDormDisabled: false
      });
    }
  },

  onInput(e) {
    const { name } = e.currentTarget.dataset;
    const { value } = e.detail;
    this.setData({ [name]: value });
  },

  onCollegeChange(e) {
    const index = e.detail.value;
    const college = this.data.collegeOptions[index];
    this.setData({
      collegeIndex: index,
      college: college,
      // 更新专业选项
      majorOptions: this.data.collegeMajorMap[college] || [],
      majorIndex: 0,
      major: ''
    });
  },

  onMajorChange(e) {
    const index = e.detail.value;
    const major = this.data.majorOptions[index];
    this.setData({
      majorIndex: index,
      major: major
    });
  },

  onDormChange(e) {
    const index = e.detail.value;
    const dorm = this.data.dormOptions[index];
    this.setData({
      dormIndex: index,
      dormitory: dorm
    });
  },

  // 年级变化
  onGradeChange(e) {
    const index = e.detail.value;
    const grade = this.data.gradeOptions[index];
    this.setData({
      gradeIndex: index,
      grade: grade
    });
  },

  onSubmit(e) {
    const formData = e.detail.value;
    const { nickname, studentId } = formData;
    const { campus, avatarUrl, dormitory, college, major, grade } = this.data;

    // 必填校验
    if (!this.validateForm(nickname, campus, college, major, grade, studentId)) {
      return;
    }

    wx.showLoading({ title: '校验学号中...', mask: true });

    // 先检查学号是否已存在
    this.checkStudentIdUnique(studentId.trim()).then(isUnique => {
      if (!isUnique) {
        wx.hideLoading();
        wx.showModal({
          title: '学号已存在',
          content: '该学号已被注册，请确认后重新输入',
          showCancel: false,
          confirmText: '确定',
          confirmColor: '#FA5151'
        });
        return;
      }

      wx.showLoading({ title: '提交中...', mask: true });

      // 构建用户数据
      const userData = {
        nickname: nickname.trim(),
        avatarUrl: avatarUrl,
        campus: campus,
        college: college.trim(),
        major: major.trim(),
        grade: Number(grade),
        studentId: studentId.trim(),
        dormitory: dormitory ? dormitory.trim() : '',
        dorm: dormitory ? dormitory.trim() : '',
        isAdmin: false,
        creditScore: 100,
        createTime: new Date(),
        updateTime: new Date(),
        bio: '这个人很懒，还没有写个人简介~',
        booksCount: 0,
        favoritesCount: 0,
        isVerified: true,
        level: 1,
        likesCount: 0,
        materialsCount: 0,
        postsCount: 0
      };

      // 存储到数据库
      wx.cloud.database().collection('users').add({
        data: userData,
        success: (res) => {
          wx.hideLoading();
          wx.showToast({
            title: '提交成功',
            icon: 'success',
            duration: 1500,
            success: () => {
              const app = getApp();
              const userInfoWithId = { _id: res._id, ...userData };
              app.globalData.userInfo = userInfoWithId;
              app.globalData.isLoggedIn = true;
              
              // 同时保存到本地存储
              wx.setStorageSync('userInfo', userInfoWithId);
              
              setTimeout(() => {
                wx.switchTab({ url: '/pages/index/index' });
              }, 1500);
            }
          });
        },
        fail: (err) => {
          wx.hideLoading();
          // 即使云数据库失败，也保存到本地存储
          const app = getApp();
          const userInfoWithId = { _id: 'local_' + Date.now(), ...userData };
          app.globalData.userInfo = userInfoWithId;
          app.globalData.isLoggedIn = true;
          wx.setStorageSync('userInfo', userInfoWithId);
          
          wx.showToast({
            title: '已保存到本地',
            icon: 'success',
            duration: 2000,
            success: () => {
              setTimeout(() => {
                wx.switchTab({ url: '/pages/index/index' });
              }, 1500);
            }
          });
        }
      });
    }).catch(err => {
      wx.hideLoading();
      console.error('学号校验失败:', err);
      wx.showModal({
        title: '校验失败',
        content: '学号校验失败，请稍后重试',
        showCancel: false,
        confirmText: '确定'
      });
    });
  },

  // 检查学号唯一性
  checkStudentIdUnique(studentId) {
    return new Promise((resolve, reject) => {
      wx.cloud.database().collection('users')
        .where({
          studentId: studentId
        })
        .count()
        .then(res => {
          // 如果 count 为 0，说明学号可用
          resolve(res.total === 0);
        })
        .catch(err => {
          console.error('检查学号唯一性失败:', err);
          reject(err);
        });
    });
  },

  // 表单验证
  validateForm(nickname, campus, college, major, grade, studentId) {
    if (!nickname || nickname.trim() === '') {
      wx.showToast({ title: '请填写昵称', icon: 'none' });
      return false;
    }
    if (!campus) {
      wx.showToast({ title: '请选择校区', icon: 'none' });
      return false;
    }
    if (!college || !major || !grade || !studentId) {
      wx.showToast({ title: '请填写完整信息', icon: 'none' });
      return false;
    }
    if (!/^\d{10}$/.test(studentId)) {
      wx.showModal({
        title: '学号格式错误',
        content: '学号必须是10位数字',
        showCancel: false,
        confirmText: '确定',
        confirmColor: '#FA5151'
      });
      return false;
    }
    return true;
  },

  onAvatarLoad() {
    this.setData({ isAvatarLoaded: true });
  }
});