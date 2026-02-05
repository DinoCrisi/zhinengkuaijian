#!/bin/bash
# CDN 资源下载脚本 (Linux/Mac)

echo "=========================================="
echo "SmartClip AI - CDN 资源下载"
echo "=========================================="
echo ""

# 创建目录
echo "创建目录..."
mkdir -p public/vendor
mkdir -p public/fonts
echo "✅ 目录创建完成"
echo ""

# 下载 Tailwind CSS
echo "[1/7] 下载 Tailwind CSS..."
if curl -f -o public/tailwind.min.js https://cdn.tailwindcss.com/3.4.1; then
    echo "✅ Tailwind CSS 下载完成"
else
    echo "❌ Tailwind CSS 下载失败"
fi
echo ""

# 下载 React
echo "[2/7] 下载 React..."
if curl -f -o public/vendor/react.js https://esm.sh/react@19.2.3 && \
   curl -f -o public/vendor/react-jsx-runtime.js https://esm.sh/react@19.2.3/jsx-runtime; then
    echo "✅ React 下载完成"
else
    echo "❌ React 下载失败"
fi
echo ""

# 下载 React DOM
echo "[3/7] 下载 React DOM..."
if curl -f -o public/vendor/react-dom.js https://esm.sh/react-dom@19.2.3 && \
   curl -f -o public/vendor/react-dom-client.js https://esm.sh/react-dom@19.2.3/client; then
    echo "✅ React DOM 下载完成"
else
    echo "❌ React DOM 下载失败"
fi
echo ""

# 下载 Google Generative AI
echo "[4/7] 下载 Google Generative AI..."
if curl -f -o public/vendor/genai.js https://esm.sh/@google/genai@1.34.0; then
    echo "✅ Google Generative AI 下载完成"
else
    echo "❌ Google Generative AI 下载失败"
fi
echo ""

# 下载 Lucide React
echo "[5/7] 下载 Lucide React (图标库)..."
if curl -f -o public/vendor/lucide-react.js https://esm.sh/lucide-react@0.562.0; then
    echo "✅ Lucide React 下载完成"
else
    echo "❌ Lucide React 下载失败"
fi
echo ""

# 下载 Inter 字体 CSS
echo "[6/7] 下载 Inter 字体 CSS..."
if curl -f -o public/fonts/inter.css "https://fonts.bunny.net/css?family=inter:300,400,500,600,700"; then
    echo "✅ Inter 字体 CSS 下载完成"
else
    echo "❌ Inter 字体 CSS 下载失败"
fi
echo ""

# 下载字体文件
echo "[7/7] 下载 Inter 字体文件..."
echo "⚠️  注意: 需要手动从 inter.css 中提取字体文件 URL"
echo "   或使用 npm 安装字体: npm install @fontsource/inter"
echo ""

# 显示下载结果
echo "=========================================="
echo "下载完成！"
echo "=========================================="
echo ""
echo "已下载的文件:"
find public -type f -exec ls -lh {} \; | awk '{print "  " $9 " - " $5}'
echo ""
echo "下一步:"
echo "  1. 检查所有文件是否下载成功"
echo "  2. 更新 index.html 使用本地资源"
echo "  3. 查看 CDN_DOWNLOAD_GUIDE.md 了解详情"
echo ""
