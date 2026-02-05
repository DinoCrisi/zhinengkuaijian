# 后端全局配置说明

## 配置文件位置

- **前端配置**：`config/apiConfig.ts`
- **后端配置**：`server/config.py`

## 如何修改服务地址

### 方法 1：同时修改前后端（推荐）

1. 修改 `config/apiConfig.ts` 中的 `BASE_HOST`：
```typescript
const BASE_HOST = '127.0.0.1';  // 改为你想要的地址
```

2. 修改 `server/config.py` 中的 `BASE_HOST`：
```python
BASE_HOST = '127.0.0.1'  # 改为相同的地址
```

3. 重启所有服务

### 方法 2：只修改后端监听地址

如果你只想让后端监听在不同的地址（如 `0.0.0.0` 监听所有网卡），但前端仍使用 `127.0.0.1` 访问：

1. 修改 `server/config.py` 中的 `BASE_HOST` 为 `'0.0.0.0'`
2. 前端配置保持 `127.0.0.1` 不变

## 注意事项

### 关于 127.0.0.1 vs 127.0.0.2

- `127.0.0.1` 和 `127.0.0.2` 是**两个不同的域名**
- 浏览器的 `localStorage` 按域名隔离
- 如果修改地址，素材库数据会丢失（因为在另一个域名下）

### 推荐配置

- **开发环境**：使用 `127.0.0.1`（默认）
- **局域网访问**：后端使用 `0.0.0.0`，前端使用实际 IP 地址

## 已更新的服务文件

所有后端服务已更新为使用全局配置：

1. ✅ `server/proxy_server.py` - 代理服务
2. ✅ `server/video_composer.py` - 视频合成服务
3. ✅ `server/jianying_draft_generator.py` - 剪映导出服务
4. ✅ `server/video_splitter.py` - 视频分割服务
5. ✅ `server/video_storage_server_minio.py` - 视频存储服务

## 测试配置

运行以下命令测试配置是否正确：

```bash
python server/config.py
```

应该输出：
```
后端服务配置:
  BASE_HOST: 127.0.0.1
  代理服务: http://127.0.0.1:8888
  视频合成: http://127.0.0.1:8889
  剪映导出: http://127.0.0.1:8890
  视频分割: http://127.0.0.1:8891
  视频存储: http://127.0.0.1:8892
```
