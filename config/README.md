# API 配置说明

## 概述

`apiConfig.ts` 是全局 API 配置文件，统一管理所有后端服务的 URL、端口和 AI 模型配置。

## 配置结构

### 1. 服务端口配置

```typescript
export const SERVICE_PORTS = {
  PROXY: 8888,           // 代理服务（AI API 调用）
  VIDEO_COMPOSER: 8889,  // 视频合成服务
  JIANYING_EXPORT: 8890, // 剪映导出服务
  VIDEO_SPLITTER: 8891,  // 视频分割服务
  VIDEO_STORAGE: 8892,   // 视频存储服务（MinIO）
}
```

### 2. 服务 URL 配置

```typescript
export const API_URLS = {
  // 代理服务
  PROXY: 'http://127.0.0.1:8888',
  PROXY_CHAT: 'http://127.0.0.1:8888/api/chat',
  
  // 视频合成服务
  VIDEO_COMPOSER: 'http://127.0.0.1:8889',
  VIDEO_COMPOSER_API: 'http://127.0.0.1:8889/api/compose-video',
  
  // 剪映导出服务
  JIANYING_EXPORT_API: 'http://127.0.0.1:8890/api/generate-draft',
  JIANYING_OUTPUT: 'http://127.0.0.1:8890/output',
  
  // 视频分割服务
  VIDEO_SPLITTER_API: 'http://127.0.0.1:8891/api/split-video',
  VIDEO_SEGMENTS: 'http://127.0.0.1:8891/segments',
  
  // 视频存储服务
  VIDEO_STORAGE_API: 'http://127.0.0.1:8892/api',
}
```

### 3. AI 模型配置

```typescript
export const AI_MODELS = {
  VIDEO_ANALYSIS: 'doubao-seed-1-8-251228',      // 视频分析模型
  SCRIPT_GENERATION: 'doubao-seed-1-8-251228',   // 脚本生成模型
  IMAGE_GENERATION: 'doubao-seedream-4-5-251128', // 图片生成模型
  VIDEO_GENERATION: 'doubao-seedance-1-5-pro-251215', // 视频生成模型
}
```

### 4. API 通用配置

```typescript
export const API_CONFIG = {
  MAX_TOKENS: 65535,
  TIMEOUT: 300000, // 5 分钟
}
```

## 使用方法

### 方法 1：直接导入常量

```typescript
import { API_URLS, AI_MODELS } from '../config/apiConfig';

// 使用服务 URL
const response = await fetch(API_URLS.VIDEO_SPLITTER_API, {
  method: 'POST',
  body: formData
});

// 使用 AI 模型
const config = {
  model: AI_MODELS.VIDEO_ANALYSIS,
  max_tokens: API_CONFIG.MAX_TOKENS
};
```

### 方法 2：使用便捷函数

```typescript
import { getServiceUrl, getApiUrl } from '../config/apiConfig';

// 获取服务 URL
const proxyUrl = getServiceUrl('PROXY'); // 'http://127.0.0.1:8888'

// 获取 API 端点
const splitterApi = getApiUrl('VIDEO_SPLITTER_API'); // 'http://127.0.0.1:8891/api/split-video'
```

## 修改配置

### 全局配置系统（推荐）

项目现在支持前后端统一的全局配置管理。

#### 1. 修改服务地址

你只需要修改两个文件：

**前端配置**：`config/apiConfig.ts`
```typescript
const BASE_HOST = '127.0.0.1';  // 修改这里
```

**后端配置**：`server/config.py`
```python
BASE_HOST = '127.0.0.1'  # 修改这里
```

#### 2. 检查配置一致性

运行配置检查工具：
```bash
python check_config.py
```

输出示例：
```
✅ 配置一致！前后端使用相同的 BASE_HOST
```

#### 3. 查看后端配置

```bash
python server/config.py
```

#### 4. 重启服务

修改配置后，需要重启所有后端服务才能生效。

详细说明请查看：
- 后端配置文档：`config/BACKEND_CONFIG.md`

### 修改端口

如果需要修改服务端口，只需修改 `SERVICE_PORTS` 对象：

```typescript
export const SERVICE_PORTS = {
  PROXY: 9000,           // 修改为 9000
  VIDEO_COMPOSER: 9001,  // 修改为 9001
  // ...
}
```

所有使用该端口的 URL 会自动更新。

### 修改主机地址

如果需要修改主机地址（例如部署到服务器），修改 `BASE_HOST` 常量：

```typescript
const BASE_HOST = '192.168.1.100'; // 修改为服务器 IP
// 或
const BASE_HOST = 'api.example.com'; // 修改为域名
```

### 修改 AI 模型

如果需要切换 AI 模型，修改 `AI_MODELS` 对象：

```typescript
export const AI_MODELS = {
  VIDEO_ANALYSIS: 'doubao-seed-2-0-260101', // 升级到新版本
  // ...
}
```

## 已更新的文件

以下文件已更新为使用全局配置：

1. ✅ `services/videoAnalysisService.ts` - 视频分析服务
2. ✅ `services/videoStorageService.ts` - 视频存储服务
3. ✅ `services/videoSplittingService.ts` - 视频分割服务
4. ✅ `services/videoReplicationService.ts` - 脚本重构服务
5. ✅ `services/videoGenerationService.ts` - 视频生成服务
6. ✅ `services/videoCompositionService.ts` - 视频合成服务
7. ✅ `services/jianyingExportService.ts` - 剪映导出服务
8. ✅ `services/imageGenerationService.ts` - 图片生成服务
9. ✅ `App.tsx` - 主应用组件

## 优势

### 1. 集中管理

所有服务 URL 和配置集中在一个文件中，便于维护和修改。

### 2. 类型安全

使用 TypeScript 的类型系统，确保配置的正确性。

### 3. 易于部署

部署到不同环境时，只需修改一个文件即可。

### 4. 避免硬编码

消除了代码中的硬编码 URL，提高了代码质量。

### 5. 便于测试

可以轻松切换到测试环境的 URL。

## 环境变量支持（未来）

未来可以扩展为支持环境变量：

```typescript
const BASE_HOST = process.env.REACT_APP_API_HOST || '127.0.0.1';
const PROXY_PORT = process.env.REACT_APP_PROXY_PORT || 8888;
```

然后在 `.env` 文件中配置：

```env
REACT_APP_API_HOST=api.example.com
REACT_APP_PROXY_PORT=8888
```

## 故障排查

### 问题 1：服务连接失败

**检查**：
1. 确认服务是否启动
2. 确认端口是否正确
3. 确认主机地址是否正确

**解决**：
```bash
# 检查端口占用
netstat -ano | findstr "8888"

# 启动服务
cd server
python proxy_server.py
```

### 问题 2：配置未生效

**检查**：
1. 确认已保存 `apiConfig.ts` 文件
2. 确认已重新构建前端
3. 确认浏览器缓存已清除

**解决**：
```bash
# 重新构建
npm run build

# 清除浏览器缓存
Ctrl+Shift+Delete
```

## 相关文档

- [API 文档](../API_DOCUMENTATION.md)
- [快速修复指南](../QUICK_FIX_GUIDE.md)
- [开发日志](../cloud/cloud.md)

---

**最后更新**：2026-01-28
**版本**：v1.0
