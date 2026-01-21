# 智能快剪 AI 视频架构师 - 项目打包说明

本文件夹包含“智能快剪 AI 视频架构师”的完整可执行环境。

## 环境要求

1.  **Python 3.8+**: 确保已安装 Python 并加入系统环境变量 PATH。
2.  **Node.js**: 仅在需要重新构建前端时需要。
3.  **FFmpeg**: 必须安装 FFmpeg。
    *   **重要**: 请确保 `ffmpeg.exe` 已加入系统环境变量 PATH，或者放在桌面。
    *   后端会自动尝试在常见位置（桌面、项目根目录、PATH）寻找 FFmpeg。

## 启动步骤

1.  **一键启动**: 双击运行根目录下的 `start.bat`。
    *   脚本会自动安装 Python 依赖（首次运行较慢）。
    *   脚本会同时启动三个服务：
        *   **代理服务器**: 处理 API 转发和跨域。
        *   **视频合成服务器**: 处理视频拼接、语音识别。
        *   **前端静态服务**: 提供 Web 界面。
2.  **访问界面**: 脚本启动完成后，在浏览器访问 `http://localhost:8000` 即可开始使用。

## 目录结构

*   `dist/`: 前端生产环境代码（由 `npm run build` 生成）。
*   `server/`: 后端核心代码。
    *   `proxy_server.py`: API 代理。
    *   `video_composer.py`: 视频合成与识别服务。
*   `word/`: 语音识别模块。
*   `requirements.txt`: Python 依赖清单。
*   `start.bat`: Windows 一键启动脚本。

## 常见问题

*   **识别失败**: 请确保已安装 FFmpeg。
*   **API 报错**: 请检查 `services/videoAnalysisService.ts` 中的 API Key 是否有效。
*   **端口冲突**: 如果 8888、8889 或 8000 端口被占用，请先关闭相关程序。
