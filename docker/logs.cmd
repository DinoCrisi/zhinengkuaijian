@echo off
REM 查看 Docker 日志 (Windows)

if "%1"=="" (
    echo 查看所有服务日志...
    docker-compose logs -f
) else (
    echo 查看 %1 服务日志...
    docker-compose logs -f %1
)
