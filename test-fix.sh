#!/bin/bash
# Bug 修复验证脚本

echo "=========================================="
echo "Bug 修复验证测试"
echo "=========================================="
echo ""

# 检查 Docker 服务
echo "1. 检查 Docker 服务状态..."
docker-compose ps

echo ""
echo "2. 检查 MinIO 服务..."
MINIO_STATUS=$(docker-compose ps minio | grep "Up" | wc -l)
if [ $MINIO_STATUS -gt 0 ]; then
    echo "✅ MinIO 服务运行中"
else
    echo "❌ MinIO 服务未运行"
    echo "   运行: docker-compose up -d minio"
fi

echo ""
echo "3. 检查视频存储服务..."
STORAGE_STATUS=$(docker-compose ps video-storage | grep "Up" | wc -l)
if [ $STORAGE_STATUS -gt 0 ]; then
    echo "✅ 视频存储服务运行中"
else
    echo "❌ 视频存储服务未运行"
    echo "   运行: docker-compose up -d video-storage"
fi

echo ""
echo "4. 检查代码修改..."

# 检查 videoStorageService.ts
if grep -q "console.log(\`📥 下载并存储视频" services/videoStorageService.ts; then
    echo "✅ videoStorageService.ts 已修复"
else
    echo "⚠️  videoStorageService.ts 可能未正确修复"
fi

# 检查 App.tsx - 缓存破坏
if grep -q "Date.now()" App.tsx; then
    echo "✅ App.tsx 缓存破坏已添加"
else
    echo "⚠️  App.tsx 缓存破坏可能未添加"
fi

# 检查 App.tsx - 清空状态
if grep -q "setComposedVideos(\[\])" App.tsx; then
    echo "✅ App.tsx 清空状态已添加"
else
    echo "⚠️  App.tsx 清空状态可能未添加"
fi

echo ""
echo "=========================================="
echo "测试建议"
echo "=========================================="
echo ""
echo "问题 1 测试（视频存储）:"
echo "  1. 访问 http://localhost:5173"
echo "  2. 上传视频进行爆款分析"
echo "  3. 检查素材库是否显示视频"
echo "  4. 访问 http://localhost:9001 检查 MinIO"
echo ""
echo "问题 2 测试（视频缓存）:"
echo "  1. 完成一次爆款复刻"
echo "  2. 重新开始爆款复刻（不同商品）"
echo "  3. 验证显示的是新视频"
echo ""
echo "查看日志:"
echo "  docker-compose logs -f video-storage"
echo "  docker-compose logs -f video-composer"
echo ""
