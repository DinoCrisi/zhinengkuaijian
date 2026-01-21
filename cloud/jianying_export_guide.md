# 剪映工程文件导出功能指南

## 功能概述

SmartClip AI 现在支持导出真正的剪映工程文件（.draft 格式），可以直接导入到剪映中进行编辑。

## 系统架构

```
前端 (React)
  ↓ 调用
jianyingExportService.ts
  ↓ HTTP POST
jianying_draft_generator.py (Python 服务，端口 8890)
  ↓ 使用
pyJianYingDraft 库
  ↓ 生成
剪映工程文件 (.draft)
  ↓ 打包
ZIP 文件
  ↓ 下载
用户本地
```

## 安装依赖

### 1. 安装 pyJianYingDraft

```bash
# 进入项目根目录
cd pyJianYingDraft

# 安装库
pip install -e .

# 或者直接安装
pip install pyJianYingDraft
```

### 2. 验证安装

```bash
python -c "import pyJianYingDraft; print('✅ pyJianYingDraft 安装成功')"
```

## 启动服务

### 方式 1：使用启动脚本（推荐）

```bash
# Windows
start_all_services.cmd

# 这会自动启动所有服务，包括剪映导出服务（端口 8890）
```

### 方式 2：手动启动

```bash
# 终端 1：启动剪映导出服务
python server/jianying_draft_generator.py

# 终端 2：启动代理服务
python server/proxy_server.py

# 终端 3：启动视频合成服务
python server/video_composer.py

# 终端 4：启动前端
npm run dev
```

## 使用流程

### 1. 完成视频复刻

1. 上传爆款视频进行分析
2. 填写商品信息和卖点
3. 生成脚本
4. 生成首帧图片
5. 生成分镜视频
6. 合成完整视频

### 2. 导出剪映工程

1. 在视频分析结果页面，点击"导出剪映"按钮
2. 系统会自动：
   - 收集所有生成的视频
   - 创建剪映工程文件
   - 打包为 ZIP 文件
   - 下载到本地

### 3. 导入到剪映

1. 解压下载的 ZIP 文件
2. 将文件夹复制到剪映的草稿目录：
   - **Windows**: `C:\Users\[用户名]\AppData\Local\ByteDance\Jianying\User Data\Projects`
   - **Mac**: `~/Library/Application Support/com.bytedance.jianying/User Data/Projects`
3. 打开剪映，在"我的项目"中找到导入的工程
4. 开始编辑

## API 端点

### POST /api/generate-draft

生成剪映工程文件

**请求体：**
```json
{
  "projectName": "我的视频",
  "width": 1920,
  "height": 1080,
  "fps": 30,
  "segments": [
    {
      "time": "0-3s",
      "narrative_type": "hook",
      "voiceover_text": "配音文案",
      "script_content": "画面描述"
    }
  ],
  "videos": [
    "http://example.com/video1.mp4",
    "http://example.com/video2.mp4"
  ]
}
```

**响应：**
```json
{
  "success": true,
  "projectName": "我的视频",
  "draftFile": "/output/我的视频.zip",
  "message": "工程文件生成成功"
}
```

### GET /output/{filename}

下载工程文件

## 工程文件结构

生成的剪映工程文件包含以下结构：

```
项目名称/
├── draft_meta_info.json      # 工程元数据
├── draft_content.json        # 工程内容（轨道、片段等）
├── video_0.mp4              # 视频片段 1
├── video_1.mp4              # 视频片段 2
└── ...
```

## 功能特性

### ✅ 已实现

- [x] 生成剪映工程文件
- [x] 自动下载视频
- [x] 添加视频轨道
- [x] 添加文本轨道
- [x] 打包为 ZIP 文件
- [x] 浏览器下载

### ⏳ 计划中

- [ ] 自动添加转场效果
- [ ] 自动添加音乐
- [ ] 自动添加字幕
- [ ] 自动添加特效
- [ ] 自定义工程参数
- [ ] 批量导出

## 故障排除

### 问题 1：pyJianYingDraft 库未安装

**错误信息：**
```
Error: pyJianYingDraft 库未安装
```

**解决方案：**
```bash
pip install -e pyJianYingDraft/
```

### 问题 2：剪映服务无法启动

**错误信息：**
```
Address already in use
```

**解决方案：**
1. 检查端口 8890 是否被占用
2. 关闭占用该端口的程序
3. 或修改 `jianying_draft_generator.py` 中的 PORT 变量

### 问题 3：视频下载失败

**错误信息：**
```
Failed to download video
```

**解决方案：**
1. 检查视频 URL 是否有效
2. 检查网络连接
3. 检查服务器磁盘空间

### 问题 4：导入到剪映后无法打开

**解决方案：**
1. 确保文件夹名称与工程名称一致
2. 确保 `draft_meta_info.json` 和 `draft_content.json` 存在
3. 尝试重新启动剪映
4. 检查剪映版本是否最新

## 技术细节

### pyJianYingDraft 库

pyJianYingDraft 是一个用于生成剪映工程文件的 Python 库，提供以下功能：

- **DraftFolder**: 管理草稿文件夹
- **ScriptFile**: 编辑工程内容
- **VideoSegment**: 添加视频片段
- **TextSegment**: 添加文本片段
- **AudioSegment**: 添加音频片段
- **Track**: 管理轨道

### 工程文件格式

剪映工程文件是一个包含以下文件的文件夹：

- `draft_meta_info.json`: 工程元数据（分辨率、FPS 等）
- `draft_content.json`: 工程内容（轨道、片段、效果等）
- 媒体文件（视频、音频、图片等）

## 性能指标

| 操作 | 时间 | 备注 |
|------|------|------|
| 生成工程文件 | 5-10秒 | 取决于视频数量和大小 |
| 下载视频 | 10-30秒 | 取决于网络速度 |
| 打包 ZIP | 2-5秒 | 取决于文件大小 |
| 总耗时 | 20-50秒 | 端到端时间 |

## 最佳实践

1. **确保网络稳定**：下载视频需要稳定的网络连接
2. **检查磁盘空间**：确保有足够的磁盘空间存储临时文件
3. **使用最新版本**：确保使用最新版本的剪映
4. **备份工程**：导出后建议备份工程文件
5. **逐步编辑**：导入后逐步调整和优化

## 常见问题

**Q: 导出的工程文件可以在其他设备上打开吗？**
A: 可以。将 ZIP 文件解压后复制到剪映的草稿目录即可。

**Q: 可以导出多个版本吗？**
A: 可以。每个版本会生成一个独立的工程文件。

**Q: 导出的工程文件大小是多少？**
A: 取决于视频数量和质量，通常在 100MB-1GB 之间。

**Q: 可以自定义工程参数吗？**
A: 目前支持分辨率、FPS 等基本参数，后续会支持更多自定义选项。

## 相关文档

- [pyJianYingDraft 官方文档](https://github.com/HaujetZhao/pyJianYingDraft)
- [剪映官方文档](https://www.jianying.com/)
- [SmartClip AI 完整指南](./README.md)

## 更新日志

### v2.11.6 (2026-01-20)

- ✅ 实现剪映工程文件导出功能
- ✅ 创建后端剪映服务（端口 8890）
- ✅ 创建前端导出服务
- ✅ 支持自动下载视频
- ✅ 支持打包为 ZIP 文件
- ✅ 支持浏览器下载

## 支持

如有问题或建议，请提交 Issue 或联系开发团队。
