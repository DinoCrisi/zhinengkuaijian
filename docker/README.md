# SmartClip AI - Docker 部署指南

## 📋 目录

- [快速开始](#快速开始)
- [系统要求](#系统要求)
- [安装步骤](#安装步骤)
- [配置说明](#配置说明)
- [服务管理](#服务管理)
- [故障排查](#故障排查)
- [高级配置](#高级配置)

## 🚀 快速开始

### Windows

```cmd
# 1. 启动所有服务
docker\start.cmd

# 2. 查看日志
docker\logs.cmd

# 3. 停止服务
docker\stop.cmd
```

### Linux/Mac

```bash
# 1. 给脚本添加执行权限
chmod +x docker/*.sh

# 2. 启动所有服务
./docker/start.sh

# 3. 查看日志
./docker/logs.sh

# 4. 停止服务
./docker/stop.sh
```

## 💻 系统要求

### 硬件要求

- **CPU**: 4 核心或以上
- **内存**: 8GB 或以上（推荐 16GB）
- **磁盘**: 20GB 可用空间

### 软件要求

- **Docker**: 20.10 或以上
- **Docker Compose**: 2.0 或以上

### 安装 Docker

#### Windows

1. 下载 [Docker Desktop for Windows](https://docs.docker.com/desktop/install/windows-install/)
2. 运行安装程序
3. 重启计算机
4. 启动 Docker Desktop

#### Mac

1. 下载 [Docker Desktop for Mac](https://docs.docker.com/desktop/install/mac-install/)
2. 运行安装程序
3. 启动 Docker Desktop

#### Linux

```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# 安装 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

## 📦 安装步骤

### 1. 克隆项目

```bash
git clone <your-repo-url>
cd smartclip-ai
```

### 2. 配置环境变量

复制示例配置文件：

```bash
# Windows
copy docker\.env.example .env

# Linux/Mac
cp docker/.env.example .env
```

编辑 `.env` 文件，填入你的 API Key：

```env
DOUBAO_API_KEY=your_api_key_here
```

### 3. 构建并启动服务

```bash
# Windows
docker\start.cmd

# Linux/Mac
./docker/start.sh
```

### 4. 访问应用

- **前端界面**: http://localhost:5173
- **MinIO 控制台**: http://localhost:9001
  - 用户名: `minioadmin`
  - 密码: `minioadmin`

## ⚙️ 配置说明

### 环境变量

在 `.env` 文件中配置：

```env
# AI API 配置
DOUBAO_API_KEY=your_api_key_here
DOUBAO_CHAT_API_KEY=optional_chat_key
DOUBAO_IMAGE_API_KEY=optional_image_key
DOUBAO_VIDEO_API_KEY=optional_video_key

# 代理服务器设置
PROXY_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
PROXY_MAX_BODY_BYTES=104857600

# MinIO 配置
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_SECURE=false
MINIO_ENABLED=true
```

### 端口配置

默认端口映射：

| 服务 | 容器端口 | 主机端口 | 说明 |
|------|---------|---------|------|
| 前端 | 80 | 5173 | Web 界面 |
| 代理服务 | 8888 | 8888 | AI API 代理 |
| 视频合成 | 8889 | 8889 | 视频合成服务 |
| 剪映导出 | 8890 | 8890 | 剪映工程导出 |
| 视频分割 | 8891 | 8891 | 视频分割服务 |
| 视频存储 | 8892 | 8892 | 视频存储服务 |
| MinIO | 9000 | 9000 | 对象存储 API |
| MinIO Console | 9001 | 9001 | MinIO 管理界面 |

如需修改端口，编辑 `docker-compose.yml`：

```yaml
services:
  frontend:
    ports:
      - "8080:80"  # 修改为 8080
```

## 🔧 服务管理

### 启动服务

```bash
# 启动所有服务
docker-compose up -d

# 启动特定服务
docker-compose up -d frontend proxy-server
```

### 停止服务

```bash
# 停止所有服务
docker-compose down

# 停止特定服务
docker-compose stop frontend
```

### 重启服务

```bash
# 重启所有服务
docker-compose restart

# 重启特定服务
docker-compose restart proxy-server
```

### 查看日志

```bash
# 查看所有服务日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs -f proxy-server

# 查看最近 100 行日志
docker-compose logs --tail=100 -f
```

### 查看服务状态

```bash
docker-compose ps
```

### 进入容器

```bash
# 进入后端容器
docker-compose exec proxy-server bash

# 进入前端容器
docker-compose exec frontend sh
```

## 🐛 故障排查

### 问题 1：端口被占用

**错误信息**：
```
Error: bind: address already in use
```

**解决方法**：

1. 查看占用端口的进程：
```bash
# Windows
netstat -ano | findstr "5173"

# Linux/Mac
lsof -i :5173
```

2. 停止占用端口的进程，或修改 `docker-compose.yml` 中的端口映射

### 问题 2：容器启动失败

**解决方法**：

1. 查看容器日志：
```bash
docker-compose logs <service-name>
```

2. 检查 `.env` 文件是否正确配置

3. 重新构建镜像：
```bash
docker-compose build --no-cache
docker-compose up -d
```

### 问题 3：无法访问前端

**解决方法**：

1. 检查容器是否运行：
```bash
docker-compose ps
```

2. 检查防火墙设置

3. 尝试使用 `127.0.0.1:5173` 而不是 `localhost:5173`

### 问题 4：MinIO 连接失败

**解决方法**：

1. 检查 MinIO 容器是否运行：
```bash
docker-compose ps minio
```

2. 检查 `.env` 中的 MinIO 配置：
```env
MINIO_ENDPOINT=minio:9000  # 容器内使用服务名
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
```

3. 访问 MinIO 控制台检查存储桶：http://localhost:9001

### 问题 5：视频处理失败

**解决方法**：

1. 检查 FFmpeg 是否正确安装：
```bash
docker-compose exec video-composer ffmpeg -version
```

2. 检查磁盘空间：
```bash
docker system df
```

3. 清理未使用的数据：
```bash
docker system prune -a
```

## 🔐 安全建议

### 生产环境部署

1. **修改默认密码**：

编辑 `docker-compose.yml`：
```yaml
minio:
  environment:
    MINIO_ROOT_USER: your_secure_username
    MINIO_ROOT_PASSWORD: your_secure_password
```

2. **使用 HTTPS**：

配置 Nginx SSL：
```nginx
server {
    listen 443 ssl;
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    # ...
}
```

3. **限制访问**：

使用防火墙限制端口访问：
```bash
# 只允许本地访问
iptables -A INPUT -p tcp --dport 8888 -s 127.0.0.1 -j ACCEPT
iptables -A INPUT -p tcp --dport 8888 -j DROP
```

4. **环境变量保护**：

不要将 `.env` 文件提交到 Git：
```bash
echo ".env" >> .gitignore
```

## 📊 监控和维护

### 查看资源使用

```bash
# 查看容器资源使用
docker stats

# 查看磁盘使用
docker system df
```

### 清理数据

```bash
# 清理未使用的镜像
docker image prune -a

# 清理未使用的卷
docker volume prune

# 清理所有未使用的资源
docker system prune -a --volumes
```

### 备份数据

```bash
# 备份 MinIO 数据
docker run --rm -v smartclip_minio-data:/data -v $(pwd):/backup alpine tar czf /backup/minio-backup.tar.gz /data

# 备份视频存储
docker run --rm -v smartclip_video-storage:/data -v $(pwd):/backup alpine tar czf /backup/videos-backup.tar.gz /data
```

### 恢复数据

```bash
# 恢复 MinIO 数据
docker run --rm -v smartclip_minio-data:/data -v $(pwd):/backup alpine tar xzf /backup/minio-backup.tar.gz -C /
```

## 🚀 高级配置

### 自定义网络

编辑 `docker-compose.yml`：

```yaml
networks:
  smartclip-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.28.0.0/16
```

### 资源限制

```yaml
services:
  video-composer:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          cpus: '1'
          memory: 2G
```

### 健康检查

```yaml
services:
  proxy-server:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8888/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

### 使用外部 MinIO

如果你已有 MinIO 服务器，可以禁用内置 MinIO：

1. 注释掉 `docker-compose.yml` 中的 `minio` 服务

2. 修改 `.env`：
```env
MINIO_ENDPOINT=your-minio-server.com:9000
MINIO_ACCESS_KEY=your_access_key
MINIO_SECRET_KEY=your_secret_key
MINIO_SECURE=true
```

## 📚 相关文档

- [Docker 官方文档](https://docs.docker.com/)
- [Docker Compose 文档](https://docs.docker.com/compose/)
- [MinIO 文档](https://min.io/docs/minio/linux/index.html)
- [项目主文档](../README.md)

## 🆘 获取帮助

如遇到问题：

1. 查看日志：`docker-compose logs -f`
2. 检查服务状态：`docker-compose ps`
3. 查看本文档的故障排查部分
4. 提交 Issue 到项目仓库

---

**最后更新**：2026-01-29
**版本**：v1.0
