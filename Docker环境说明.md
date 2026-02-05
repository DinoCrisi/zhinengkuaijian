# Docker 环境说明

## ✅ 已完全封装的环境

Docker 已经为你封装好了所有运行环境，**无需手动安装任何依赖**。

### 📦 包含的环境和工具

#### 前端环境
- ✅ Node.js 20
- ✅ npm 包管理器
- ✅ Vite 构建工具
- ✅ React 19.2.3
- ✅ TypeScript
- ✅ Nginx Web 服务器

#### 后端环境
- ✅ Python 3.11
- ✅ pip 包管理器
- ✅ Flask Web 框架
- ✅ 所有 Python 依赖（requirements.txt）

#### 视频处理工具
- ✅ FFmpeg（完整版）
- ✅ OpenCV（图像处理）
- ✅ Whisper（语音识别）
- ✅ pyJianYingDraft（剪映导出）

#### 存储和网络
- ✅ MinIO 对象存储
- ✅ Docker 网络配置
- ✅ 数据持久化卷
- ✅ 端口映射

---

## 🏗️ Docker 架构

```
┌─────────────────────────────────────────────┐
│          Docker 容器环境                     │
│                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │  前端    │  │  代理    │  │  视频    │ │
│  │ Nginx    │  │  服务    │  │  合成    │ │
│  │  :80     │  │  :8888   │  │  :8889   │ │
│  └──────────┘  └──────────┘  └──────────┘ │
│                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │  剪映    │  │  视频    │  │  视频    │ │
│  │  导出    │  │  分割    │  │  存储    │ │
│  │  :8890   │  │  :8891   │  │  :8892   │ │
│  └──────────┘  └──────────┘  └──────────┘ │
│                                              │
│  ┌────────────────────────────────────────┐ │
│  │         MinIO 对象存储                  │ │
│  │    :9000 (API)  :9001 (控制台)         │ │
│  └────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
         ↓ 端口映射到主机
┌─────────────────────────────────────────────┐
│              你的电脑                        │
│  http://localhost:5173  - 前端界面          │
│  http://localhost:9001  - MinIO 控制台      │
└─────────────────────────────────────────────┘
```

---

## 🚀 使用步骤

### 前提条件
- 已安装 Docker Desktop（Windows/Mac）或 Docker Engine（Linux）
- 已安装 Docker Compose

### 步骤 1: 配置环境变量
```bash
# 编辑 .env 文件
DOUBAO_API_KEY=your_api_key_here
```

### 步骤 2: 启动服务
```bash
# Windows
docker\start.cmd

# Linux/Mac
./docker/start.sh

# 或直接使用 docker-compose
docker-compose up -d
```

### 步骤 3: 等待启动
首次启动需要：
- 下载基础镜像（~2GB）
- 构建自定义镜像（~5 分钟）
- 安装依赖（自动完成）

### 步骤 4: 访问应用
- 前端：http://localhost:5173
- MinIO：http://localhost:9001

---

## 📊 容器列表

| 容器名 | 服务 | 状态 |
|--------|------|------|
| smartclip-frontend | 前端 Web 界面 | ✅ 运行中 |
| smartclip-proxy | AI API 代理 | ✅ 运行中 |
| smartclip-video-composer | 视频合成 | ✅ 运行中 |
| smartclip-jianying | 剪映导出 | ✅ 运行中 |
| smartclip-video-splitter | 视频分割 | ✅ 运行中 |
| smartclip-video-storage | 视频存储 | ✅ 运行中 |
| smartclip-minio | 对象存储 | ✅ 运行中 |

查看状态：`docker-compose ps`

---

## 🔍 验证环境

### 检查 Docker 安装
```bash
docker --version
# 应输出: Docker version 20.10.x 或更高

docker-compose --version
# 应输出: Docker Compose version 2.x.x 或更高
```

### 检查容器运行
```bash
docker-compose ps
# 所有服务应显示 "Up" 状态
```

### 检查日志
```bash
docker-compose logs -f
# 应看到各服务的启动日志，无错误信息
```

---

## 🎯 环境特点

### 1. 完全隔离
- 每个服务运行在独立容器中
- 不会污染主机环境
- 不会与其他软件冲突

### 2. 一键部署
- 无需手动安装 Node.js、Python、FFmpeg
- 无需配置环境变量（除了 API Key）
- 无需担心依赖版本冲突

### 3. 数据持久化
- 视频文件保存在 Docker 卷中
- 停止容器不会丢失数据
- 可以备份和恢复

### 4. 自动重启
- 容器崩溃自动重启
- 系统重启后自动启动
- 保证服务高可用

---

## 🔧 常见操作

### 查看日志
```bash
# 所有服务
docker-compose logs -f

# 特定服务
docker-compose logs -f proxy-server
```

### 重启服务
```bash
# 重启所有
docker-compose restart

# 重启特定服务
docker-compose restart proxy-server
```

### 停止服务
```bash
docker-compose down
```

### 更新代码后重新构建
```bash
docker-compose build --no-cache
docker-compose up -d
```

---

## ❓ 常见问题

### Q: 需要安装 Node.js 吗？
**A**: 不需要。Docker 镜像已包含 Node.js 20。

### Q: 需要安装 Python 吗？
**A**: 不需要。Docker 镜像已包含 Python 3.11 和所有依赖。

### Q: 需要安装 FFmpeg 吗？
**A**: 不需要。Docker 镜像已包含 FFmpeg。

### Q: 如何更新依赖？
**A**: 修改 `package.json` 或 `requirements.txt` 后，运行 `docker-compose build --no-cache`。

### Q: 数据存在哪里？
**A**: 数据存储在 Docker 卷中，可以通过 `docker volume ls` 查看。

### Q: 如何备份数据？
**A**: 参考 `DOCKER使用指南.md` 中的备份章节。

---

## 📚 相关文档

- `快速开始.md` - 3 步启动指南
- `DOCKER使用指南.md` - 详细使用文档
- `docker/README.md` - 完整技术文档

---

**总结**：Docker 已经为你准备好了一切，你只需要：
1. 安装 Docker
2. 配置 API Key
3. 运行 `docker-compose up -d`

就可以开始使用了！🎉
