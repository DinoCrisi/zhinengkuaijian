@echo off
REM SmartClip AI - 启动所有服务（MinIO 版本）
REM 在单个窗口中启动所有后台服务和前端

chcp 65001 >nul
setlocal enabledelayedexpansion

cls
echo ========================================
echo SmartClip AI - 启动所有服务（MinIO 版本）
echo ========================================
echo.

REM 检查 Python
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 未找到 Python
    echo 💡 请先安装 Python: https://www.python.org/downloads/
    pause
    exit /b 1
)

REM 检查 Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 未找到 Node.js
    echo 💡 请先安装 Node.js: https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Python 和 Node.js 已安装
echo.

REM 检查并安装依赖
if not exist "node_modules" (
    echo 📦 安装前端依赖...
    call npm install
)

echo 🔍 检查 Python 依赖...
python -c "import whisper" >nul 2>&1
if errorlevel 1 (
    echo 📦 安装 Python 依赖...
    call pip install -r word/requirements.txt
)

python -c "import pyJianYingDraft" >nul 2>&1
if errorlevel 1 (
    echo 📦 安装 pyJianYingDraft...
    call pip install -e pyJianYingDraft/
)

REM 检查 MinIO 依赖
python -c "import minio" >nul 2>&1
if errorlevel 1 (
    echo 📦 安装 MinIO 依赖...
    cd server
    call pip install -r requirements_minio.txt
    cd ..
)

echo ✅ 依赖检查完成
echo.

echo ========================================
echo 🚀 启动所有服务...
echo ========================================
echo.

REM 启动后台服务
echo [1/5] 启动代理服务 (8888)...
start /b cmd /c "cd server && python proxy_server.py"
timeout /t 1 /nobreak >nul

echo [2/5] 启动视频合成 (8889)...
start /b cmd /c "cd server && python video_composer.py"
timeout /t 1 /nobreak >nul

echo [3/5] 启动剪映导出 (8890)...
start /b cmd /c "cd server && python jianying_draft_generator.py"
timeout /t 1 /nobreak >nul

echo [4/5] 启动视频分割 (8891)...
start /b cmd /c "cd server && python video_splitter.py"
timeout /t 1 /nobreak >nul

echo [5/5] 启动视频存储 - MinIO 模式 (8892)...
start /b cmd /c "cd server && python video_storage_server_minio.py"
timeout /t 1 /nobreak >nul

echo.
echo ========================================
echo ✅ 后台服务已启动（MinIO 模式）
echo ========================================
echo.
echo 📍 服务地址：
echo   🔗 代理服务：http://127.0.0.1:8888
echo   🎬 视频合成：http://127.0.0.1:8889
echo   📦 剪映导出：http://127.0.0.1:8890
echo   ✂️  视频分割：http://127.0.0.1:8891
echo   💾 视频存储：http://127.0.0.1:8892 (MinIO)
echo.
echo 🌐 启动前端服务 (5173)...
echo.

REM 等待 2 秒后自动打开浏览器
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:5173"

REM 启动前端
call npm run dev

echo.
echo ========================================
echo 🎉 SmartClip AI 已停止
echo ========================================
echo.
pause
