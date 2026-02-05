#!/bin/bash
# Docker 配置测试脚本

echo "=========================================="
echo "Docker 配置测试"
echo "=========================================="
echo ""

# 检查 Docker
echo "1. 检查 Docker..."
if command -v docker &> /dev/null; then
    echo "✅ Docker 已安装"
    docker --version
else
    echo "❌ Docker 未安装"
    exit 1
fi

echo ""

# 检查 Docker Compose
echo "2. 检查 Docker Compose..."
if command -v docker-compose &> /dev/null || docker compose version &> /dev/null; then
    echo "✅ Docker Compose 已安装"
    docker-compose --version 2>/dev/null || docker compose version
else
    echo "❌ Docker Compose 未安装"
    exit 1
fi

echo ""

# 检查 .env 文件
echo "3. 检查 .env 文件..."
if [ -f ".env" ]; then
    echo "✅ .env 文件存在"
    
    # 检查 API Key
    if grep -q "DOUBAO_API_KEY=your_api_key_here" .env; then
        echo "⚠️  警告: 请修改 .env 文件中的 API Key"
    else
        echo "✅ API Key 已配置"
    fi
else
    echo "⚠️  .env 文件不存在"
    echo "   运行: cp docker/.env.example .env"
fi

echo ""

# 检查 Dockerfile
echo "4. 检查 Dockerfile..."
if [ -f "Dockerfile.frontend" ] && [ -f "Dockerfile.backend" ]; then
    echo "✅ Dockerfile 文件存在"
else
    echo "❌ Dockerfile 文件缺失"
    exit 1
fi

echo ""

# 检查 docker-compose.yml
echo "5. 检查 docker-compose.yml..."
if [ -f "docker-compose.yml" ]; then
    echo "✅ docker-compose.yml 存在"
    
    # 验证配置
    if docker-compose config > /dev/null 2>&1; then
        echo "✅ docker-compose.yml 配置有效"
    else
        echo "❌ docker-compose.yml 配置无效"
        docker-compose config
        exit 1
    fi
else
    echo "❌ docker-compose.yml 不存在"
    exit 1
fi

echo ""

# 检查必要的目录
echo "6. 检查项目结构..."
REQUIRED_DIRS=("server" "config" "services" "components")
for dir in "${REQUIRED_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        echo "✅ $dir/ 目录存在"
    else
        echo "❌ $dir/ 目录缺失"
        exit 1
    fi
done

echo ""
echo "=========================================="
echo "✅ 所有检查通过！"
echo "=========================================="
echo ""
echo "下一步:"
echo "  1. 确保 .env 文件中的 API Key 已配置"
echo "  2. 运行: ./docker/start.sh"
echo ""
