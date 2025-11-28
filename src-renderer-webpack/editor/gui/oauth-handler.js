/**
 * OAuth剪切板处理器
 * 负责处理从桌面端剪切板传来的GitHub认证信息
 */

class OAuthHandler {
  constructor() {
    this.oauthData = null;
    this.listeners = [];
    this.init();
  }

  /**
   * 初始化OAuth处理器
   */
  init() {
    // 监听来自主进程的OAuth完成信号
    if (window.EditorPreload) {
      window.EditorPreload.onOAuthCompleted((data) => {
        this.handleOAuthData(data);
      });
    }

    // 检查localStorage中是否已有认证信息
    const existingToken = localStorage.getItem('github_token');
    const existingUser = localStorage.getItem('github_user');
    const existingEmail = localStorage.getItem('github_email');

    if (existingToken && existingUser) {
      this.oauthData = {
        token: existingToken,
        user: JSON.parse(existingUser),
        email: existingEmail
      };
      this.notifyListeners();
    }
  }

  /**
   * 处理OAuth数据
   */
  handleOAuthData(data) {
    console.log('收到OAuth认证数据:', data);

    this.oauthData = data;

    // 保存到localStorage
    localStorage.setItem('github_token', data.token);
    localStorage.setItem('github_user', JSON.stringify(data.user));
    localStorage.setItem('github_email', data.email);

    // 通知所有监听器
    this.notifyListeners();

    // 清除主进程的oauth超时
    if (window.EditorPreload) {
      // 这里可以调用一个通知主进程已收到数据的API
      console.log('OAuth认证已完成，数据已保存');
    }
  }

  /**
   * 添加监听器
   */
  addListener(callback) {
    this.listeners.push(callback);

    // 如果已有数据，立即通知
    if (this.oauthData) {
      callback(this.oauthData);
    }
  }

  /**
   * 移除监听器
   */
  removeListener(callback) {
    const index = this.listeners.indexOf(callback);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * 通知所有监听器
   */
  notifyListeners() {
    this.listeners.forEach(callback => {
      try {
        callback(this.oauthData);
      } catch (error) {
        console.error('OAuth监听器执行错误:', error);
      }
    });
  }

  /**
   * 获取OAuth数据
   */
  getOAuthData() {
    return this.oauthData;
  }

  /**
   * 检查是否已认证
   */
  isAuthenticated() {
    return this.oauthData !== null;
  }

  /**
   * 获取token
   */
  getToken() {
    return this.oauthData?.token || null;
  }

  /**
   * 获取用户信息
   */
  getUser() {
    return this.oauthData?.user || null;
  }

  /**
   * 获取邮箱
   */
  getEmail() {
    return this.oauthData?.email || null;
  }

  /**
   * 清除认证信息
   */
  clear() {
    this.oauthData = null;
    localStorage.removeItem('github_token');
    localStorage.removeItem('github_user');
    localStorage.removeItem('github_email');
    this.notifyListeners();
  }
}

// 创建全局OAuth处理器实例
const oauthHandler = new OAuthHandler();

export default oauthHandler;