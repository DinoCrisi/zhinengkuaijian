# CDN 资源下载脚本 (Windows PowerShell)

Write-Host "=========================================="
Write-Host "SmartClip AI - CDN 资源下载"
Write-Host "=========================================="
Write-Host ""

# 创建目录
Write-Host "创建目录..."
New-Item -ItemType Directory -Force -Path public/vendor | Out-Null
New-Item -ItemType Directory -Force -Path public/fonts | Out-Null
Write-Host "✅ 目录创建完成"
Write-Host ""

# 下载 Tailwind CSS
Write-Host "[1/7] 下载 Tailwind CSS..."
try {
    Invoke-WebRequest -Uri "https://cdn.tailwindcss.com/3.4.1" -OutFile "public/tailwind.min.js"
    Write-Host "✅ Tailwind CSS 下载完成"
} catch {
    Write-Host "❌ Tailwind CSS 下载失败: $_"
}
Write-Host ""

# 下载 React
Write-Host "[2/7] 下载 React..."
try {
    Invoke-WebRequest -Uri "https://esm.sh/react@19.2.3" -OutFile "public/vendor/react.js"
    Invoke-WebRequest -Uri "https://esm.sh/react@19.2.3/jsx-runtime" -OutFile "public/vendor/react-jsx-runtime.js"
    Write-Host "✅ React 下载完成"
} catch {
    Write-Host "❌ React 下载失败: $_"
}
Write-Host ""

# 下载 React DOM
Write-Host "[3/7] 下载 React DOM..."
try {
    Invoke-WebRequest -Uri "https://esm.sh/react-dom@19.2.3" -OutFile "public/vendor/react-dom.js"
    Invoke-WebRequest -Uri "https://esm.sh/react-dom@19.2.3/client" -OutFile "public/vendor/react-dom-client.js"
    Write-Host "✅ React DOM 下载完成"
} catch {
    Write-Host "❌ React DOM 下载失败: $_"
}
Write-Host ""

# 下载 Google Generative AI
Write-Host "[4/7] 下载 Google Generative AI..."
try {
    Invoke-WebRequest -Uri "https://esm.sh/@google/genai@1.34.0" -OutFile "public/vendor/genai.js"
    Write-Host "✅ Google Generative AI 下载完成"
} catch {
    Write-Host "❌ Google Generative AI 下载失败: $_"
}
Write-Host ""

# 下载 Lucide React
Write-Host "[5/7] 下载 Lucide React (图标库)..."
try {
    Invoke-WebRequest -Uri "https://esm.sh/lucide-react@0.562.0" -OutFile "public/vendor/lucide-react.js"
    Write-Host "✅ Lucide React 下载完成"
} catch {
    Write-Host "❌ Lucide React 下载失败: $_"
}
Write-Host ""

# 下载 Inter 字体 CSS
Write-Host "[6/7] 下载 Inter 字体 CSS..."
try {
    Invoke-WebRequest -Uri "https://fonts.bunny.net/css?family=inter:300,400,500,600,700" -OutFile "public/fonts/inter.css"
    Write-Host "✅ Inter 字体 CSS 下载完成"
} catch {
    Write-Host "❌ Inter 字体 CSS 下载失败: $_"
}
Write-Host ""

# 下载字体文件
Write-Host "[7/7] 下载 Inter 字体文件..."
Write-Host "⚠️  注意: 需要手动从 inter.css 中提取字体文件 URL"
Write-Host "   或使用 npm 安装字体: npm install @fontsource/inter"
Write-Host ""

# 显示下载结果
Write-Host "=========================================="
Write-Host "下载完成！"
Write-Host "=========================================="
Write-Host ""
Write-Host "已下载的文件:"
Get-ChildItem -Path public -Recurse -File | ForEach-Object {
    $size = [math]::Round($_.Length / 1KB, 2)
    Write-Host "  $($_.FullName.Replace($PWD, '.')) - ${size} KB"
}
Write-Host ""
Write-Host "下一步:"
Write-Host "  1. 检查所有文件是否下载成功"
Write-Host "  2. 更新 index.html 使用本地资源"
Write-Host "  3. 查看 CDN_DOWNLOAD_GUIDE.md 了解详情"
Write-Host ""
