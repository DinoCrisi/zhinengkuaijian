# pyJianYingDraft
### 轻量、灵活、易上手的Python剪映草稿生成及导出工具，构建全自动视频剪辑/混剪流水线！

> 🧪 本项目的**CapCut版本**正在开发中，欢迎关注[CapCut版本仓库](https://github.com/GuanYixuan/pyCapCut)

> 📢 欢迎加入[Discord服务器](https://discord.gg/WfHgGQvhyW)进行用法或新功能的讨论

## 功能清单

- ☑️ 添加本地视频/图片素材
- ☑️ 添加本地音频素材
- ☑️ 添加文本、设置字体及样式
- ☑️ 导入`.srt`文件生成字幕
- ☑️ 添加贴纸、花字等元素
- ☑️ 添加特效、滤镜和转场
- ☑️ 设置关键帧动画
- ☑️ 多轨道操作
- ☑️ 模板模式（加载已有草稿作为模板）
- ☑️ 批量导出草稿

## 安装

```bash
pip install pyJianYingDraft
```

## 快速开始

```python
import pyJianYingDraft as draft

# 创建草稿
draft_folder = draft.DraftFolder("<剪映草稿文件夹>")
script = draft_folder.create_draft("我的视频", 1920, 1080)

# 添加视频轨道
script.add_track(draft.TrackType.video)

# 添加视频片段
video_segment = draft.VideoSegment("video.mp4", draft.trange("0s", "5s"))
script.add_segment(video_segment)

# 保存草稿
script.save()
```

## 文档

详细文档请参见 [GitHub 仓库](https://github.com/GuanYixuan/pyJianYingDraft)

## 许可证

MIT License
