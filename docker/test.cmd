@echo off
REM Docker 配置测试脚本 (Windows)

echo ==========================================
echo Docker 配置测试
echo ==========================================
echo.

REM 检查 Docker
echo 1. 检查 Docker...
docker --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker 未安装
    pause
    exit /b 1
) else (
    echo ✅ Docker 已安装
    docker --version
)

echo.

REM 检查 Docker Compose
echo 2. 检查 Docker Compose...
docker-compose --version >nul 2>&1
if errorlevel 1 (
    docker compose version >nul 2>&1
    if errorlevel 1 (
        echo ❌ Docker Compose 未安装
        pause
        exit /b 1
    ) else (
        echo ✅ Docker Compose 已安装
        docker compose version
    )
) else (
    echo ✅ Docker Compose 已安装
    docker-compose --version
)

echo.

REM 检查 .env 文件
echo 3. 检查 .env 文件...
if exist ".env" (
    echo ✅ .env 文件存在
    
    findstr /C:"DOUBAO_API_KEY=your_api_key_here" .env >nul 2>&1
    if not errorlevel 1 (
        echo ⚠️  警告: 请修改 .env 文件中的 API Key
    ) else (
        echo ✅ API Key 已配置
    )
) else (
    echo ⚠️  .env 文件不存在
    echo    运行: copy docker\.env.example .env
)

echo.

REM 检查 Dockerfile
echo 4. 检查 Dockerfile...
if exist "Dockerfile.frontend" (
    if exist "Dockerfile.backend" (
        echo ✅ Dockerfile 文件存在
    ) else (
        echo ❌ Dockerfile.backend 缺失
        pause
        exit /b 1
    )
) else (
    echo ❌ Dockerfile.frontend 缺失
    pause
    exit /b 1
)

echo.

REM 检查 docker-compose.yml
echo 5. 检查 docker-compose.yml...
if exist "docker-compose.yml" (
    echo ✅ docker-compose.yml 存在
    
    docker-compose config >nul 2>&1
    if errorlevel 1 (
        echo ❌ docker-compose.yml 配置无效
        docker-compose config
        pause
        exit /b 1
    ) else (
        echo ✅ docker-compose.yml 配置有效
    )
) else (
    echo ❌ docker-compose.yml 不存在
    pause
    exit /b 1
)

echo.

REM 检查必要的目录
echo 6. 检查项目结构...
if exist "server\" (
    echo ✅ server\ 目录存在
) else (
    echo ❌ server\ 目录缺失
    pause
    exit /b 1
)

if exist "config\" (
    echo ✅ config\ 目录存在
) else (
    echo ❌ config\ 目录缺失
    pause
    exit /b 1
)

if exist "services\" (
    echo ✅ services\ 目录存在
) else (
    echo ❌ services\ 目录缺失
    pause
    exit /b 1
)

if exist "components\" (
    echo ✅ components\ 目录存在
) else (
    echo ❌ components\ 目录缺失
    pause
    exit /b 1
)

echo.
echo ==========================================
echo ✅ 所有检查通过！
echo ==========================================
echo.
echo 下一步:
echo   1. 确保 .env 文件中的 API Key 已配置
echo   2. 运行: docker\start.cmd
echo.
pause
