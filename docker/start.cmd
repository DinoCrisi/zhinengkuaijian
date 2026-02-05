@echo off
REM Docker 启动脚本 (Windows)

echo ==========================================
echo SmartClip AI - Docker 启动脚本
echo ==========================================
echo.

REM 检查 Docker 是否安装
docker --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 错误: Docker 未安装
    echo 请访问 https://docs.docker.com/get-docker/ 安装 Docker Desktop
    pause
    exit /b 1
)

REM 检查 Docker Compose 是否安装
docker-compose --version >nul 2>&1
if errorlevel 1 (
    docker compose version >nul 2>&1
    if errorlevel 1 (
        echo ❌ 错误: Docker Compose 未安装
        pause
        exit /b 1
    )
)

REM 检查 .env 文件
if not exist ".env" (
    echo ⚠️  警告: .env 文件不存在
    echo 正在从示例文件创建...
    copy docker\.env.example .env
    echo ✅ 已创建 .env 文件
    echo ⚠️  请编辑 .env 文件，填入您的 API Key
    echo.
    pause
)

echo 🔨 构建 Docker 镜像...
docker-compose build

echo.
echo 🚀 启动服务...
docker-compose up -d

echo.
echo ⏳ 等待服务启动...
timeout /t 5 /nobreak >nul

echo.
echo ✅ 服务已启动！
echo.
echo 访问地址:
echo   前端: http://localhost:5173
echo   MinIO 控制台: http://localhost:9001
echo.
echo 查看日志:
echo   docker-compose logs -f
echo.
echo 停止服务:
echo   docker-compose down
echo.
pause
