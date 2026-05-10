// pages/complete-info.js
const db = wx.cloud.database();
const _ = db.command;

Page({
  data: {
    studentId: '',
    campus: '',
    grade: '',
    college: '',
    major: '',
    dormitory: '',
    dormOptions: [],
    gender: '',
    hasSubmitted: false,
    _openid: '',
    _id: ''
  },

  async onLoad() {
    try {
      const loginRes = await wx.login();
      const cloudRes = await wx.cloud.callFunction({
        name: 'login',
        data: { code: loginRes.code }
      });

      if (!cloudRes.result?.openid) throw new Error('未获取到 openid');
      const openid = cloudRes.result.openid;
      this.setData({ _openid: openid });

      const res = await db.collection('users').where({ _openid: openid }).get();
      if (res.data.length > 0) {
        const user = res.data[0];
        this.setData({
          studentId: user.studentId || '',
          campus: user.campus === '西校区' ? 'west' : 'east',
          grade: String(user.grade || ''),
          college: user.college || '',
          major: user.major || '',
          dormitory: user.dormitory || '',
          dormOptions: user.campus === '西校区' ? ['北苑', '南苑', '西苑'] : [],
          gender: user.gender === '男' ? 'male' : 'female',
          hasSubmitted: true,
          _id: user._id
        });
      }
    } catch (err) {
      console.error('[onLoad] 错误:', err);
      wx.showToast({ title: '初始化失败', icon: 'none' });
    }
  },

  onStudentIdInput(e) { this.setData({ studentId: e.detail.value }); },
  onCampusChange(e) {
    const campus = e.detail.value;
    this.setData({
      campus,
      dormitory: '',
      dormOptions: campus === 'west' ? ['北苑', '南苑', '西苑'] : []
    });
  },
  onGradeInput(e) { this.setData({ grade: e.detail.value }); },
  onCollegeInput(e) { this.setData({ college: e.detail.value }); },
  onMajorInput(e) { this.setData({ major: e.detail.value }); },
  onDormChange(e) {
    const selected = this.data.dormOptions[e.detail.value];
    this.setData({ dormitory: selected });
  },
  onGenderChange(e) { this.setData({ gender: e.detail.value }); },

  async submitForm() {
    const { studentId, campus, grade, college, major, dormitory, gender, _openid, hasSubmitted, _id } = this.data;

    if (!studentId.trim()) return wx.showToast({ title: '请填写学号', icon: 'none' });
    if (!campus || !grade || !college.trim() || !major.trim() || !gender) {
      return wx.showToast({ title: '请填写完整信息', icon: 'none' });
    }
    if (campus === 'west' && !dormitory) {
      return wx.showToast({ title: '请选择宿舍', icon: 'none' });
    }

    wx.showLoading({ title: '保存中...' });

    try {
      const userData = {
        _openid,
        studentId: studentId.trim(),
        campus: campus === 'west' ? '西校区' : '东校区',
        grade: parseInt(grade) || grade,
        college: college.trim(),
        major: major.trim(),
        dormitory: dormitory || null,
        gender: gender === 'male' ? '男' : '女'
      };

      // 唯一性校验：排除自己
      const existing = await db.collection('users')
        .where({
          studentId: studentId.trim(),
          _openid: _.neq(_openid)
        })
        .get();

      if (existing.data.length > 0) {
        wx.hideLoading();
        return wx.showToast({ title: '该学号已被他人使用', icon: 'none' });
      }

      if (hasSubmitted) {
        await db.collection('users').doc(_id).update({ data: userData });
      } else {
        const res = await db.collection('users').add({ data: userData });
        this.setData({ hasSubmitted: true, _id: res._id });
      }

      wx.hideLoading();
      wx.showToast({ title: '保存成功' });
      setTimeout(() => wx.switchTab({ url: '/pages/index/index' }), 1000);
    } catch (err) {
      console.error('提交失败:', err);
      wx.hideLoading();
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  }
});