# 02Engine 依赖库和外部资源完整清单

## 项目基本信息
- **项目名称**: 02Engine Desktop
- **版本**: 1.1.11
- **基于**: TurboWarp (Scratch 的改进版本)
- **许可证**: GPL-3.0
- **作者**: 02Studio (ericmu20101103@163.com)

## 运行时依赖 (Runtime Dependencies)

### 核心依赖
- **semver**: ^7.7.2
  - 用途: 语义版本比较，用于更新检查功能
  - 路径: `node_modules/semver/`
  - 使用位置: `src-main/update-checker.js`

- **ws**: ^8.14.0
  - 用途: WebSocket 支持，用于实时通信
  - 路径: `node_modules/ws/`
  - 使用位置: Scratch GUI 内部通信

## 开发依赖 (Development Dependencies)

### 构建工具
- **webpack**: 4.47.0
- **webpack-cli**: ^4.10.0
- **babel-loader**: ^8.4.1
- **css-loader**: ^1.0.1
- **style-loader**: ^0.23.0
- **postcss**: ^8.4.13
- **postcss-loader**: ^4.2.0
- **postcss-import**: ^14.0.0
- **postcss-simple-vars**: ^6.0.3
- **autoprefixer**: ^9.8.8
- **copy-webpack-plugin**: ^6.4.1
- **file-loader**: ^6.2.0
- **url-loader**: ^4.1.1

### JavaScript 转译
- **@babel/core**: ^7.28.0
- **@babel/preset-env**: ^7.12.16
- **@babel/preset-react**: ^7.13.13

### Electron 相关
- **electron**: ^37.10.3
- **electron-builder**: ^26.0.19
- **@electron/fuses**: ^1.7.0

### 工具库
- **adm-zip**: ^0.5.16 (ZIP 文件处理)
- **cross-env**: ^7.0.3 (跨平台环境变量)

## 外部资源和服务

### TurboWarp 生态系统
- **@turbowarp/extensions**: github:TurboWarp/extensions#master
  - 用途: TurboWarp 扩展集合
  - 路径: `node_modules/@turbowarp/extensions/`
  - 下载位置: `dist-extensions/`

- **scratch-gui**: github:02engine/scratch-gui#main
  - 用途: 02Engine 自定义的 Scratch GUI 分支
  - 路径: `node_modules/scratch-gui/`
  - 构建输出: `dist-renderer-webpack/`

### 网络服务端点
- **版本检查**: https://desktop.turbowarp.org/version.json
- **更新页面**: https://desktop.turbowarp.org/update_available
- **文档站点**: https://desktop.turbowarp.org/

### 文件下载脚本 (package.json scripts.fetch)
- **download-library-files.js**: 下载 Scratch 库文件
- **download-packager.js**: 下载打包工具
- **prepare-extensions.js**: 准备扩展文件

## 系统依赖

### 操作系统支持
- **Windows**: NSIS 安装包 + 便携版
- **macOS**: DMG 安装包，支持 Apple Silicon 和 Intel
- **Linux**: DEB 包、AppImage、tar.gz

### 文件关联
- **.sb3**: Scratch 3 项目文件
- **.sb2**: Scratch 2 项目文件
- **.sb**: Scratch 1 项目文件

## 安全和隐私特性

### 禁用的功能
- **自动更新检查**: 已在代码中禁用 (`src-main/update-checker.js:16`)
- **遥测和分析**: 无任何遥测数据收集
- **后台网络请求**: 仅用户主动操作时发起

### 隐私保护措施
- 更新检查器默认禁用
- 无用户数据收集
- 无分析或追踪
- 所有网络请求都有明确的用户意图

## 构建输出目录

- **dist-renderer-webpack/**: Webpack 构建的渲染进程代码
- **dist-library-files/**: Scratch 库文件
- **dist-extensions/**: TurboWarp 扩展文件
- **node_modules/**: 所有 NPM 依赖

## 许可证兼容性

所有依赖的许可证都是开源兼容的：
- 大多数使用 MIT 或 Apache-2.0 许可证
- 项目使用 GPL-3.0 许可证
- 符合开源项目要求

## 版本控制

- **主仓库**: https://github.com/02engine/desktop.git
- **问题追踪**: https://github.com/02engine/desktop/issues
- **更新日志**: changelog.md

## 注意事项

1. **更新功能已禁用**: 此版本故意禁用了自动更新功能以提高隐私性
2. **最小网络依赖**: 仅在必要时连接 TurboWarp 服务器
3. **离线友好**: 大部分功能可离线使用
4. **隐私优先**: 无任何遥测或数据收集功能