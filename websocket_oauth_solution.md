# OAuth WebSocket通信方案

## 概述
使用WebSocket在桌面端和OAuth网页之间建立实时双向通信，解决OAuth认证后的数据传输问题。

## 工作流程

### 1. 桌面端启动
- 用户点击GitHub认证按钮
- 桌面端主进程启动WebSocket服务器（随机冷门端口：49152-65535）
- 打开OAuth窗口，传递WebSocket端口参数

### 2. OAuth网页端
- OAuth网页接收到WebSocket端口参数
- 自动连接到桌面端的WebSocket服务器
- 完成GitHub OAuth认证流程
- 认证成功后通过WebSocket发送token到桌面端
- 显示成功消息并关闭窗口

### 3. 桌面端接收
- WebSocket服务器收到token消息
- 主进程调用GitHub API获取用户信息
- 通过IPC发送认证数据到渲染进程
- 保存到localStorage，GUI显示已登录状态
- 关闭WebSocket服务器

## 关键实现

### 端口选择
```javascript
const port = Math.floor(Math.random() * (65535 - 49152 + 1)) + 49152;
```
使用49152-65535范围的随机端口，避免冲突。

### 消息格式
```javascript
{
  type: 'oauth_token',
  token: '40位十六进制GitHub token'
}
```

### 错误处理
- WebSocket连接失败时的降级方案
- 连接超时处理
- 资源清理（窗口关闭时）

## 安全考虑

1. **端口随机化**：避免固定端口被恶意利用
2. **本地连接**：只允许localhost连接
3. **自动清理**：连接完成后自动关闭服务器
4. **Token处理**：认证完成后立即处理并清理

## 优势

- **实时性**：无轮询延迟，消息即时传递
- **可靠性**：基于TCP协议，传输可靠
- **安全性**：本地连接，无需网络暴露
- **简单性**：实现相对简单，易于调试

## 调试日志

关键日志信息：
```
OAuth WebSocket服务器已启动，端口: [端口号]
已连接到桌面端WebSocket服务器
Token已通过WebSocket发送到桌面端
WebSocket连接已关闭
OAuth WebSocket服务器已关闭
```