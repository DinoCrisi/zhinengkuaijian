# Docker 使用指南

## 🚀 快速开始（3 步）

### 步骤 1: 配置环境变量

```bash
# 复制环境变量示例文件
copy .env.example .env

# 编辑 .env 文件，填入你的 API Key
# DOUBAO_API_KEY=your_api_key_here
```

### 步骤 2: 启动所有服务

```bash
# Windows
docker\start.cmd

# Linux/Mac
chmod +x docker/*.sh
./docker/start.sh

# 或直接使用 docker-compose
docker-compose up -d
```

### 步骤 3: 访问应用

- **前端界面**: http://localhost:5173
- **MinIO 控制台**: http://localhost:9001 (用户名/密码: minioadmin/minioadmin)

---

## 📋 Docker 已封装的环境

### ✅ 前端环境
- Node.js 20
- Vite 构建工具
- React 19
- Nginx 服务器

### ✅ 后端环境
- Python 3.11
- FFmpeg（视频处理）
- OpenCV（图像处理）
- Whisper（语音识别）
- Flask（Web 服务）
- pyJianYingDraft（剪映导出）

### ✅ 存储环境
- MinIO 对象存储
- 数据持久化卷

### ✅ 网络环境
- 内部网络隔离
- 端口映射配置
- 服务间通信

---

## 🔧 常用命令

### 查看服务状态
```bash
docker-compose ps
```

### 查看日志
```bash
# 所有服务
docker-compose logs -f

# 特定服务
docker-compose logs -f proxy-server
docker-compose logs -f frontend
```

### 停止服务
```bash
# Windows
docker\stop.cmd

# Linux/Mac
./docker/stop.sh

# 或使用 docker-compose
docker-compose down
```

### 重启服务
```bash
docker-compose restart

# 重启特定服务
docker-compose restart proxy-server
```

### 重新构建
```bash
# 重新构建所有镜像
docker-compose build --no-cache

# 重新构建并启动
docker-compose up -d --build
```

---

## 🐛 常见问题

### 1. 端口被占用
**错误**: `bind: address already in use`

**解决**:
```bash
# Windows - 查看占用端口的进程
netstat -ano | findstr "5173"

# Linux/Mac
lsof -i :5173

# 修改 docker-compose.yml 中的端口映射
ports:
  - "8080:80"  # 将 5173 改为 8080
```

### 2. 容器启动失败
**解决**:
```bash
# 查看日志
docker-compose logs <service-name>

# 重新构建
docker-compose build --no-cache
docker-compose up -d
```

### 3. 无法访问前端
**解决**:
- 检查容器是否运行: `docker-compose ps`
- 尝试使用 `127.0.0.1:5173` 而不是 `localhost:5173`
- 检查防火墙设置

### 4. API Key 未生效
**解决**:
- 检查 `.env` 文件是否存在
- 确认 `DOUBAO_API_KEY` 已正确填写
- 重启服务: `docker-compose restart`

---

## 📊 服务端口

| 服务 | 端口 | 说明 |
|------|------|------|
| 前端 | 5173 | Web 界面 |
| 代理服务 | 8888 | AI API 代理 |
| 视频合成 | 8889 | 视频合成服务 |
| 剪映导出 | 8890 | 剪映工程导出 |
| 视频分割 | 8891 | 视频分割服务 |
| 视频存储 | 8892 | 视频存储服务 |
| MinIO API | 9000 | 对象存储 API |
| MinIO 控制台 | 9001 | MinIO 管理界面 |

---

## 🔍 检查 Docker 环境

### 检查 Docker 是否安装
```bash
docker --version
docker-compose --version
```

### 检查配置是否正确
```bash
# Windows
docker\test.cmd

# Linux/Mac
./docker/test.sh
```

### 查看资源使用
```bash
docker stats
```

---

## 📦 数据管理

### 备份数据
```bash
# 备份 MinIO 数据
docker run --rm -v smartclip_minio-data:/data -v $(pwd):/backup alpine tar czf /backup/minio-backup.tar.gz /data

# 备份视频存储
docker run --rm -v smartclip_video-storage:/data -v $(pwd):/backup alpine tar czf /backup/videos-backup.tar.gz /data
```

### 清理数据
```bash
# 停止并删除所有容器和卷
docker-compose down -v

# 清理未使用的镜像
docker image prune -a
```

---

## ⚙️ 高级配置

### 修改服务端口
编辑 `docker-compose.yml`:
```yaml
services:
  frontend:
    ports:
      - "8080:80"  # 修改为你想要的端口
```

### 禁用 MinIO
如果不需要 MinIO，注释掉 `docker-compose.yml` 中的 `minio` 服务，并修改 `.env`:
```env
MINIO_ENABLED=false
```

### 资源限制
编辑 `docker-compose.yml` 添加资源限制:
```yaml
services:
  video-composer:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
```

---

## 📚 相关文档

- `docker/README.md` - 详细的 Docker 文档
- `CDN_LINKS.txt` - CDN 资源链接（如需离线部署）
- `README.md` - 项目主文档

---

## ✅ 环境已完全封装

Docker 已经封装了以下所有环境：

- ✅ Node.js 和前端构建工具
- ✅ Python 和所有后端依赖
- ✅ FFmpeg 视频处理工具
- ✅ OpenCV 图像处理库
- ✅ Whisper 语音识别模型
- ✅ MinIO 对象存储
- ✅ Nginx Web 服务器
- ✅ 所有 Python 包（requirements.txt）
- ✅ pyJianYingDraft 剪映库
- ✅ 网络配置和端口映射
- ✅ 数据持久化卷

**你只需要**：
1. 安装 Docker 和 Docker Compose
2. 配置 `.env` 文件（填入 API Key）
3. 运行 `docker-compose up -d`

就可以使用了！无需手动安装任何依赖。

---

**最后更新**: 2026-01-29
