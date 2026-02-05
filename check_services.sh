#!/bin/bash
# SmartClip AI - 检查服务状态

echo "========================================"
echo "SmartClip AI - 服务状态检查"
echo "========================================"
echo ""

# 检查端口是否被占用
check_port() {
    local port=$1
    local name=$2
    
    if netstat -tuln 2>/dev/null | grep -q ":$port " || ss -tuln 2>/dev/null | grep -q ":$port "; then
        echo "✅ $name (端口 $port): 运行中"
        
        # 尝试访问健康检查接口
        if curl -s "http://127.0.0.1:$port/api/health" > /dev/null 2>&1; then
            echo "   └─ 健康检查: 正常"
        fi
    else
        echo "❌ $name (端口 $port): 未运行"
    fi
}

echo "🔍 检查服务端口..."
echo ""

check_port 8888 "代理服务"
check_port 8889 "视频合成"
check_port 8890 "剪映导出"
check_port 8891 "视频分割"
check_port 8892 "视频存储"

echo ""
echo "========================================"
echo "🔍 检查进程..."
echo "========================================"
echo ""

# 检查进程
if pgrep -f 'python3.*proxy_server.py' > /dev/null; then
    echo "✅ proxy_server.py 运行中 (PID: $(pgrep -f 'python3.*proxy_server.py'))"
else
    echo "❌ proxy_server.py 未运行"
fi

if pgrep -f 'python3.*video_composer.py' > /dev/null; then
    echo "✅ video_composer.py 运行中 (PID: $(pgrep -f 'python3.*video_composer.py'))"
else
    echo "❌ video_composer.py 未运行"
fi

if pgrep -f 'python3.*jianying_draft_generator.py' > /dev/null; then
    echo "✅ jianying_draft_generator.py 运行中 (PID: $(pgrep -f 'python3.*jianying_draft_generator.py'))"
else
    echo "❌ jianying_draft_generator.py 未运行"
fi

if pgrep -f 'python3.*video_splitter.py' > /dev/null; then
    echo "✅ video_splitter.py 运行中 (PID: $(pgrep -f 'python3.*video_splitter.py'))"
else
    echo "❌ video_splitter.py 未运行"
fi

if pgrep -f 'python3.*video_storage_server' > /dev/null; then
    echo "✅ video_storage_server 运行中 (PID: $(pgrep -f 'python3.*video_storage_server'))"
else
    echo "❌ video_storage_server 未运行"
fi

echo ""
echo "========================================"
echo "🔍 MinIO 存储状态"
echo "========================================"
echo ""

# 检查视频存储服务的 MinIO 状态
if curl -s "http://127.0.0.1:8892/api/health" > /dev/null 2>&1; then
    response=$(curl -s "http://127.0.0.1:8892/api/health")
    echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
else
    echo "❌ 无法连接到视频存储服务"
fi

echo ""
