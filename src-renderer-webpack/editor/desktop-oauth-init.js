/**
 * 渲染进程初始化
 * 在GUI加载时初始化OAuth处理器等
 */

import oauthHandler from './gui/oauth-handler.js';

// 在DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  console.log('桌面端OAuth处理器初始化完成');

  // 为GUI添加OAuth监听器
  if (window.Scratch && window.Scratch.vm) {
    // 如果有Scratch VM实例，可以在这里集成认证逻辑
    oauthHandler.addListener((data) => {
      console.log('OAuth认证状态变更:', data);
      
      // 触发自定义事件，通知GUI认证状态变更
      const event = new CustomEvent('oauth-authenticated', {
        detail: data
      });
      document.dispatchEvent(event);
    });
  }

  // 监听认证状态变更事件
  document.addEventListener('oauth-authenticated', (event) => {
    console.log('GUI收到OAuth认证事件:', event.detail);
    
    // 这里可以添加GUI特定的认证处理逻辑
    // 例如更新用户界面、启用需要认证的功能等
  });
});

// 暴露OAuth处理器到全局作用域（如果需要）
window.oauthHandler = oauthHandler;

console.log('Desktop OAuth module loaded');