# OAuth剪切板认证测试指南

## 概述
实现了通过系统剪切板传递GitHub OAuth token的桌面端认证解决方案。

## 实现原理
1. **OAuth网站端**：认证成功后自动将token写入系统剪切板
2. **桌面端监控**：主进程每秒轮询剪切板，检测GitHub token
3. **认证集成**：检测到token后获取用户信息并传递给渲染进程
4. **GUI处理**：渲染进程接收认证数据并保存到localStorage

## 测试步骤

### 1. 准备测试环境
- 确保桌面端应用可以正常启动
- 确认网络连接正常，能够访问GitHub API

### 2. 启动桌面端应用
```bash
npm run start
# 或者
electron .
```

### 3. 启动OAuth认证流程
1. 在桌面端应用中触发GitHub认证
2. 认证页面将在浏览器中打开
3. 完成GitHub授权登录

### 4. 验证剪切板写入
在OAuth网站端认证成功后：
1. 打开系统剪切板查看器
2. 确认剪切板中包含40位十六进制字符的token
3. 验证成功消息显示"Token已写入剪切板"

### 5. 验证桌面端检测
在桌面端应用中：
1. 检查控制台输出应显示"检测到新的GitHub Token"
2. 验证控制台显示"开始处理GitHub OAuth token"
3. 确认控制台输出"OAuth认证信息已发送给渲染进程"

### 6. 验证渲染进程集成
1. 检查localStorage中是否包含：
   - `github_token`: GitHub token
   - `github_user`: 用户信息JSON
   - `github_email`: 用户邮箱
2. 验证应用程序中的认证状态更新

## 预期结果
- ✅ OAuth网站端显示"认证成功"和指示信息
- ✅ GitHub token自动写入系统剪切板
- ✅ 桌面端检测到token并获取用户信息
- ✅ 认证数据保存到localStorage
- ✅ GUI显示用户已登录状态
- ✅ 剪切板中的token被清除

## 故障排除

### 问题1：桌面端未检测到剪切板中的token
- **检查**：控制台是否有"检测到新的GitHub Token"消息
- **解决**：确认剪切板轮询机制已启动，检查token格式

### 问题2：GitHub API调用失败
- **检查**：网络连接和GitHub API访问权限
- **解决**：检查token有效性，确认API限制

### 问题3：渲染进程未收到认证数据
- **检查**：主进程和渲染进程间的IPC通信
- **解决**：确认oauth-completed事件正确发送

### 问题4：localStorage中未保存认证信息
- **检查**：localStorage权限和存储限制
- **解决**：确认浏览器环境支持localStorage

## 监控日志
关键日志消息：
```
OAuth剪切板监控已启动
检测到新的GitHub Token: [token]
开始处理GitHub OAuth token
OAuth认证信息已发送给渲染进程
Desktop OAuth module loaded
```

## 安全考虑
1. Token自动从剪切板清除，避免泄露
2. 仅处理符合GitHub token格式的内容
3. 超时机制防止长时间监控
4. 错误处理和资源清理

## 技术细节
- 轮询间隔：1秒
- Token格式：40位十六进制字符
- 超时时间：40秒
- 存储方式：localStorage
- 通信机制：IPC + CustomEvent