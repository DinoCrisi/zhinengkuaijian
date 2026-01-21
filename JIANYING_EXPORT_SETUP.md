# 剪映工程文件导出功能 - 快速设置指南

## 🚀 快速开始

### 第 1 步：安装 pyJianYingDraft

```bash
# 进入项目根目录
cd pyJianYingDraft

# 安装库
pip install -e .
```

### 第 2 步：启动所有服务

```bash
# Windows
start_all_services.cmd

# 或手动启动各个服务
# 终端 1
python server/jianying_draft_generator.py

# 终端 2
python server/proxy_server.py

# 终端 3
python server/video_composer.py

# 终端 4
npm run dev
```

### 第 3 步：使用导出功能

1. 打开 http://localhost:5173
2. 上传爆款视频进行分析
3. 完成视频复刻流程（脚本 → 首帧 → 视频 → 合成）
4. 点击"导出剪映"按钮
5. 等待工程文件生成并下载

### 第 4 步：导入到剪映

1. 解压下载的 ZIP 文件
2. 复制文件夹到剪映草稿目录：
   - **Windows**: `C:\Users\[用户名]\AppData\Local\ByteDance\Jianying\User Data\Projects`
   - **Mac**: `~/Library/Application Support/com.bytedance.jianying/User Data/Projects`
3. 打开剪映，在"我的项目"中找到导入的工程

## 📋 系统要求

- Python 3.8+
- Node.js 14+
- 剪映最新版本
- 2GB+ 磁盘空间

## 🔧 故障排除

### 问题：pyJianYingDraft 库未安装

```bash
# 解决方案
pip install -e pyJianYingDraft/
```

### 问题：端口 8890 被占用

```bash
# 查找占用端口的进程
netstat -ano | findstr :8890

# 杀死进程
taskkill /PID [PID] /F
```

### 问题：视频下载失败

- 检查网络连接
- 检查磁盘空间
- 查看服务器日志

### 问题：导入到剪映后无法打开

- 确保文件夹名称正确
- 确保 `draft_meta_info.json` 和 `draft_content.json` 存在
- 重启剪映
- 检查剪映版本

## 📊 服务状态

启动后，所有服务应该在以下地址运行：

| 服务 | 地址 | 端口 | 状态 |
|------|------|------|------|
| 前端 | http://localhost:5173 | 5173 | ✅ |
| 代理 | http://127.0.0.1:8888 | 8888 | ✅ |
| 视频合成 | http://127.0.0.1:8889 | 8889 | ✅ |
| 剪映导出 | http://127.0.0.1:8890 | 8890 | ✅ |

## 📚 详细文档

- [完整使用指南](./cloud/jianying_export_guide.md)
- [API 文档](./cloud/jianying_export_guide.md#api-端点)
- [故障排除](./cloud/jianying_export_guide.md#故障排除)

## 💡 提示

- 确保所有服务都已启动
- 导出前确保视频生成完成
- 导出过程中不要关闭浏览器
- 导出的工程文件可以在其他设备上打开

## 🎉 完成！

现在你可以使用 SmartClip AI 生成爆款视频，并直接导出到剪映进行编辑了！

有问题？查看[完整文档](./cloud/jianying_export_guide.md)或提交 Issue。
