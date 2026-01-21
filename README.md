<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# 智能快剪 AI 视频架构师 (SmartClip AI)

智能快剪是一个基于 AI 的视频创作工具，能够根据产品信息自动生成视频分镜、脚本，并最终合成完整的爆款视频。

## 功能特性

- **爆款复刻**: 分析热门视频逻辑，快速复刻同款风格。
- **智能分镜**: 自动生成分镜脚本与视觉提示词。
- **视频合成**: 自动下载并拼接视频片段，生成完整作品。
- **AI 驱动**: 集成 Google Gemini 等先进大模型进行创意生成。

## 环境要求

1. **Node.js**: 用于运行前端开发环境或构建生产环境代码。
2. **Python 3.8+**: 用于运行后端代理及视频合成服务器。
3. **FFmpeg**: 必须安装。
   - 请确保 `ffmpeg.exe` 已加入系统环境变量 `PATH`。
   - 或者将 `ffmpeg.exe` 放置在项目根目录、`server/` 目录或桌面。

## 快速开始

### 1. 配置 API Key

在项目根目录下找到 `.env.local` 文件（如果没有则复制 `.env` 并重命名），设置你的 Gemini API Key：
```env
VITE_GEMINI_API_KEY=你的_GEMINI_API_KEY
```

### 2. 安装依赖

- **前端依赖**:
  ```bash
  npm install
  ```
- **后端依赖**:
  ```bash
  pip install -r requirements.txt
  ```

### 3. 启动服务

#### 生产模式 (推荐)
直接运行根目录下的启动脚本：
- **Windows**: 双击 `start.bat`

该脚本会自动完成以下操作：
1. 检查并安装 Python 依赖。
2. 启动代理服务器 (Port: 8888)。
3. 启动视频合成服务器 (Port: 8889)。
4. 启动前端展示界面 (Port: 8000)。

启动完成后，在浏览器访问：[http://localhost:8000](http://localhost:8000)

#### 开发模式
如果你需要进行代码修改，可以使用开发模式启动：
- **Windows**: 双击 `start_all_services.cmd`

或者手动启动：
1. 启动前端: `npm run dev` (Port: 5173)
2. 启动代理: `python server/proxy_server.py` (Port: 8888)
3. 启动合成服务: `python server/video_composer.py` (Port: 8889)

## 目录结构

- `dist/`: 前端生产环境构建产物。
- `server/`: 后端核心代码（代理服务器、视频合成逻辑）。
- `services/`: 前端业务逻辑与 AI 接口调用。
- `components/`: UI 组件。
- `output_videos/`: 合成视频的默认输出目录。

## 常见问题

- **FFmpeg 未找到**: 请确保安装了 FFmpeg 并且 `ffmpeg` 命令在终端中可用。
- **跨域问题**: 确保 `proxy_server.py` 正在运行，前端通过代理访问 AI 接口。
- **视频合成失败**: 检查 `server/temp_videos` 权限及网络连接（用于下载分镜素材）。

---
Powered by SmartClip AI Team
