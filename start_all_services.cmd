@echo off
chcp 65001 >nul
echo ========================================
echo SmartClip AI - 启动所有服务
echo ========================================
echo.

REM 检查依赖
echo 🔍 检查环境...
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 未找到Python，请先安装Python
    echo 💡 下载地址: https://www.python.org/downloads/
    pause & exit /b 1
)

node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 未找到Node.js，请先安装Node.js
    echo 💡 下载地址: https://nodejs.org/
    pause & exit /b 1
)

REM 检查npm依赖
if not exist "node_modules" (
    echo 📦 安装前端依赖中...
    npm install
    if errorlevel 1 (
        echo ❌ 前端依赖安装失败
        pause & exit /b 1
    )
)

REM 检查Python依赖
echo 🔍 检查Python依赖...
python -c "import whisper" >nul 2>&1
if errorlevel 1 (
    echo 📦 安装Python依赖中...
    pip install -r word/requirements.txt
    if errorlevel 1 (
        echo ❌ Python依赖安装失败
        echo 💡 请手动运行: pip install -r word/requirements.txt
        pause & exit /b 1
    )
)

REM 检查FFmpeg
echo 🔍 检查FFmpeg...
ffmpeg -version >nul 2>&1
if errorlevel 1 (
    echo ⚠️  FFmpeg未安装，视频合成功能将不可用
    echo 💡 下载地址: https://ffmpeg.org/download.html
    echo 💡 或运行诊断脚本: python check_transcribe.py
    echo.
)

echo ✅ 环境检查完成
echo.

echo [1/3] 启动视频合成服务 (端口 8889)...
start "SmartClip - Video Composer" cmd /k "cd /d %~dp0server && python video_composer.py"
timeout /t 3 /nobreak >nul

echo [2/3] 启动代理服务 (端口 8888)...
start "SmartClip - Proxy Server" cmd /k "cd /d %~dp0server && python proxy_server.py"
timeout /t 3 /nobreak >nul

echo [3/3] 启动前端服务 (端口 5173)...
start "SmartClip - Frontend" cmd /k "cd /d %~dp0 && npm run dev"

echo.
echo 等待服务启动...
timeout /t 8 /nobreak >nul

echo.
echo ========================================
echo 🎉 SmartClip AI 已启动！
echo ========================================
echo.
echo 📍 服务地址：
echo   🌐 前端界面：http://localhost:5173
echo   🔗 代理服务：http://127.0.0.1:8888
echo   🎬 视频合成：http://127.0.0.1:8889
echo   📦 剪映导出：http://127.0.0.1:8890
echo.
echo 📋 主要功能：
echo   ✨ 视频分析 → 🎯 脚本生成 → 🖼️ 首帧生成
echo   🎥 视频生成 → 🎬 视频合成 → 🎤 字幕识别
echo.
echo 🔧 故障排除：
echo   - 如果字幕识别失败，运行: python check_transcribe.py
echo   - 如果服务无法启动，检查端口是否被占用
echo   - 查看各服务窗口的错误信息
echo.

echo 正在打开浏览器...
start http://localhost:5173

echo.
echo ✅ 浏览器已打开！
echo 💡 关闭时请关闭所有服务窗口
echo.
echo 按任意键关闭此窗口...
pause >nul

