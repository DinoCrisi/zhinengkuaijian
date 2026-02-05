@echo off
REM Docker 停止脚本 (Windows)

echo ==========================================
echo SmartClip AI - 停止服务
echo ==========================================
echo.

echo 🛑 停止所有服务...
docker-compose down

echo.
echo ✅ 服务已停止
echo.
echo 如需删除所有数据卷，运行:
echo   docker-compose down -v
echo.
pause
