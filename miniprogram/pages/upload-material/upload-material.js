// pages/upload-material/upload-material.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    selectedFile: null,
    materialInfo: {
      title: '',
      description: '',
      type: '',
      price: 0,
      college: '',
      major: '',
      studentId: ''
    },
    materialTypes: [
      { value: 'pdf', label: 'PDF', icon: '📄' },
      { value: 'word', label: 'Word', icon: '📝' },
      { value: 'ppt', label: 'PPT', icon: '📊' },
      { value: 'video', label: '视频', icon: '🎥' },
      { value: 'other', label: '其他', icon: '📁' }
    ],
    colleges: [
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
      '马克思主义学院'
    ],
    majors: {
      '建筑与电气工程学院': ['工程管理', '电气自动化', '土木工程', '工程造价'],
      '文化与传媒学院（凤凰数字媒体学院）': ['数字媒体艺术', '广播电视编导', '汉语言文学', '播音与主持艺术', '网络与新媒体', '播音与编导'],
      '教师教育学院（师范学院）': ['学前教育', '小学教育', '舞蹈学前教育', '音乐学', '历史学', '数学', '体育教学', '心理学'],
      '旅游与体育健康学院': ['酒店管理', '旅游管理', '运动康复', '社会体育指导与管理', '公共事业管理'],
      '人工智能学院（现代产业学院）': ['机械设计制造及其自动化', '电子信息工程', '集成电路设计与集成系统', '通信工程', '数据科学与大数据技术', '人工智能', '网络工程', '智能制造工程', '软件工程', '物联网工程', '机器人工程'],
      '外国语学院（国际教育学院）': ['英语', '电气功能及自动化', '食品质量与安全', '商务英语', '土木工程', '机械设计制造及自动化', '汉语言文学', '人工智能', '跨境电子商务', '软件工程', '国际经济与贸易'],
      '经济与管理学院': ['数字经济', '金融科技', '财务管理', '国际经济与贸易'],
      '设计学院': ['视觉传达设计', '服装与服饰设计', '美术学', '环境设计', '产品设计'],
      '材料与化学工程学院': ['复合材料与工程', '高分子材料与工程', '应用化学'],
      '食品与生物工程学院': ['食品科学与工程', '食品质量与安全', '生物工程', '茶学'],
      '马克思主义学院': ['思想政治教育']
    },
    collegeIndex: 0,
    majorIndex: 0,
    currentMajors: [],
    copyrightAgree: false,
    isUploading: false,
    canUpload: false
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad() {
    // 初始化数据
    this.updateCanUpload();
    // 初始化专业列表
    this.updateMajors();
    // 自动读取用户个人信息
    this.loadUserInfo();
  },

  /**
   * 自动读取用户个人信息
   */
  loadUserInfo() {
    // 在实际应用中，这里应该从本地缓存或登录接口获取用户信息
    // 模拟读取用户信息
    const userInfo = {
      college: '人工智能学院（现代产业学院）',
      studentId: '2022010101'
    };
    
    // 设置用户信息到表单
    if (userInfo.college) {
      const collegeIndex = this.data.colleges.indexOf(userInfo.college);
      if (collegeIndex !== -1) {
        this.setData({
          collegeIndex: collegeIndex,
          'materialInfo.college': userInfo.college
        });
        // 更新专业列表
        this.updateMajors();
      }
    }
    
    if (userInfo.studentId) {
      this.setData({
        'materialInfo.studentId': userInfo.studentId
      });
    }
    
    this.updateCanUpload();
  },

  /**
   * 更新专业列表
   */
  updateMajors() {
    const college = this.data.materialInfo.college;
    if (college && this.data.majors[college]) {
      const majors = this.data.majors[college];
      this.setData({
        currentMajors: majors,
        majorIndex: 0,
        'materialInfo.major': majors[0] || ''
      });
    } else {
      this.setData({
        currentMajors: [],
        majorIndex: 0,
        'materialInfo.major': ''
      });
    }
  },

  /**
   * 选择文件
   */
  chooseFile() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'mp4', 'avi', 'mov'],
      success: (res) => {
        const file = res.tempFiles[0];
        this.setData({
          selectedFile: file
        });
        // 根据文件扩展名自动设置资料类型
        this.autoSetMaterialType(file.name);
        this.updateCanUpload();
      },
      fail: (err) => {
        console.error('选择文件失败:', err);
        wx.showToast({
          title: '选择文件失败',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },

  /**
   * 根据文件扩展名自动设置资料类型
   */
  autoSetMaterialType(fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    let type = 'other';
    
    if (['pdf'].includes(ext)) {
      type = 'pdf';
    } else if (['doc', 'docx'].includes(ext)) {
      type = 'word';
    } else if (['ppt', 'pptx'].includes(ext)) {
      type = 'ppt';
    } else if (['mp4', 'avi', 'mov'].includes(ext)) {
      type = 'video';
    }
    
    this.setData({
      'materialInfo.type': type
    });
  },

  /**
   * 格式化文件大小
   */
  formatFileSize(size) {
    if (size < 1024) {
      return size + ' B';
    } else if (size < 1024 * 1024) {
      return (size / 1024).toFixed(2) + ' KB';
    } else {
      return (size / (1024 * 1024)).toFixed(2) + ' MB';
    }
  },

  /**
   * 表单输入处理
   */
  bindInput(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    
    this.setData({
      [`materialInfo.${field}`]: value
    });
    
    this.updateCanUpload();
  },

  /**
   * 选择资料类型
   */
  selectType(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({
      'materialInfo.type': type
    });
    this.updateCanUpload();
  },

  /**
   * 选择学院
   */
  bindCollegeChange(e) {
    const index = e.detail.value;
    const college = this.data.colleges[index];
    this.setData({
      collegeIndex: index,
      'materialInfo.college': college
    });
    // 更新专业列表
    this.updateMajors();
    this.updateCanUpload();
  },

  /**
   * 选择专业
   */
  bindMajorChange(e) {
    const index = e.detail.value;
    const major = this.data.currentMajors[index];
    this.setData({
      majorIndex: index,
      'materialInfo.major': major
    });
    this.updateCanUpload();
  },

  /**
   * 切换版权承诺勾选
   */
  toggleCopyrightAgree() {
    this.setData({
      copyrightAgree: !this.data.copyrightAgree
    });
    this.updateCanUpload();
  },

  /**
   * 更新是否可以上传
   */
  updateCanUpload() {
    const { selectedFile, materialInfo, copyrightAgree } = this.data;
    const canUpload = selectedFile && 
                     materialInfo.title.trim() && 
                     materialInfo.type && 
                     materialInfo.college && 
                     materialInfo.studentId.trim() && 
                     copyrightAgree;
    
    this.setData({ canUpload });
  },

  /**
   * 上传资料
   */
  uploadMaterial() {
    if (!this.data.canUpload) return;
    
    this.setData({ isUploading: true });
    
    // 模拟上传过程
    setTimeout(() => {
      this.setData({ isUploading: false });
      
      // 创建新上传的资料对象
      const materialType = this.data.materialInfo.type;
      let typeText = '复习资料'; // 默认类型，与 discover.js 中的类型筛选逻辑匹配
      let typeCode = 'review'; // 默认类型代码
      
      switch (materialType) {
        case 'pdf':
          typeText = 'PDF';
          typeCode = 'all';
          break;
        case 'word':
          typeText = 'Word';
          typeCode = 'all';
          break;
        case 'ppt':
          typeText = 'PPT';
          typeCode = 'all';
          break;
        case 'video':
          typeText = '视频';
          typeCode = 'all';
          break;
        default:
          typeText = '其他';
          typeCode = 'all';
      }
      
      const newMaterial = {
        _id: 'material_' + Date.now(),
        title: this.data.materialInfo.title,
        author: {
          _id: 'current_user',
          nickname: '当前用户',
          avatarUrl: 'https://via.placeholder.com/100x100/667eea/ffffff?text=用户'
        },
        downloadCount: 0,
        favoriteCount: 0,
        type: typeText,
        typeCode: typeCode, // 用于筛选
        fileSize: this.data.selectedFile ? this.formatFileSize(this.data.selectedFile.size) : '未知',
        format: materialType.toUpperCase(),
        isFree: parseFloat(this.data.materialInfo.price) === 0,
        price: parseFloat(this.data.materialInfo.price) || 0,
        isFavorited: false,
        createTime: new Date().toISOString().split('T')[0],
        description: this.data.materialInfo.description,
        college: this.data.materialInfo.college,
        major: this.data.materialInfo.major,
        studentId: this.data.materialInfo.studentId
      };
      
      // 获取全局应用实例
      const app = getApp();
      // 将新资料添加到全局数据中，以便其他页面可以访问
      if (!app.globalData.uploadedMaterials) {
        app.globalData.uploadedMaterials = [];
      }
      app.globalData.uploadedMaterials.unshift(newMaterial);
      
      wx.showModal({
        title: '上传成功',
        content: `资料上传成功！建议您在分享资料前自行添加水印（含学号等标识），以更好地保护您的版权。`,
        showCancel: false,
        confirmText: '确定',
        success: (res) => {
          if (res.confirm) {
            // 跳转到资料详情页或返回上一页
            wx.navigateBack({
              delta: 1
            });
          }
        }
      });
    }, 3000);
  },

  /**
   * 返回上一页
   */
  goBack() {
    wx.navigateBack({
      delta: 1
    });
  }
})