# SmartClip AI - Makefile

.PHONY: help build up down restart logs clean ps shell

# 默认目标
help:
	@echo "SmartClip AI - Docker 管理命令"
	@echo ""
	@echo "使用方法: make [命令]"
	@echo ""
	@echo "可用命令:"
	@echo "  build      - 构建所有 Docker 镜像"
	@echo "  up         - 启动所有服务"
	@echo "  down       - 停止所有服务"
	@echo "  restart    - 重启所有服务"
	@echo "  logs       - 查看所有服务日志"
	@echo "  ps         - 查看服务状态"
	@echo "  clean      - 清理所有容器和卷"
	@echo "  shell      - 进入后端容器 shell"
	@echo ""
	@echo "简化版（不含 MinIO）:"
	@echo "  up-simple  - 启动简化版服务"
	@echo ""

# 构建镜像
build:
	@echo "🔨 构建 Docker 镜像..."
	docker-compose build

# 启动服务
up:
	@echo "🚀 启动所有服务..."
	docker-compose up -d
	@echo "✅ 服务已启动"
	@echo "前端: http://localhost:5173"
	@echo "MinIO: http://localhost:9001"

# 启动简化版
up-simple:
	@echo "🚀 启动简化版服务（不含 MinIO）..."
	docker-compose -f docker-compose.simple.yml up -d
	@echo "✅ 服务已启动"
	@echo "前端: http://localhost:5173"

# 停止服务
down:
	@echo "🛑 停止所有服务..."
	docker-compose down

# 重启服务
restart:
	@echo "🔄 重启所有服务..."
	docker-compose restart

# 查看日志
logs:
	docker-compose logs -f

# 查看状态
ps:
	docker-compose ps

# 清理
clean:
	@echo "🧹 清理所有容器和卷..."
	docker-compose down -v
	docker system prune -f

# 进入容器
shell:
	docker-compose exec proxy-server bash

# 查看特定服务日志
logs-frontend:
	docker-compose logs -f frontend

logs-proxy:
	docker-compose logs -f proxy-server

logs-composer:
	docker-compose logs -f video-composer

logs-jianying:
	docker-compose logs -f jianying-export

logs-splitter:
	docker-compose logs -f video-splitter

logs-storage:
	docker-compose logs -f video-storage

logs-minio:
	docker-compose logs -f minio
