"""
剪映工程文件生成服务
使用 pyJianYingDraft 库生成真正的剪映工程文件（.draft 格式）
"""

import os
import sys
import json
import uuid
import tempfile
import shutil
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse
import urllib.request

# 添加 pyJianYingDraft 到路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'pyJianYingDraft'))

try:
    import pyJianYingDraft as draft
    from pyJianYingDraft import trange, tim
    JIANYING_AVAILABLE = True
except ImportError:
    JIANYING_AVAILABLE = False
    print("警告: pyJianYingDraft 库未安装，部分功能将不可用")

# 配置
PORT = 8890
OUTPUT_DIR = Path(__file__).parent / 'output_drafts'
TEMP_DIR = Path(tempfile.gettempdir()) / 'smartclip_drafts'

# 确保输出目录存在
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
TEMP_DIR.mkdir(parents=True, exist_ok=True)


class JianYingDraftHandler(BaseHTTPRequestHandler):
    """处理剪映工程文件生成请求"""

    def do_POST(self):
        """处理 POST 请求"""
        if self.path == '/api/generate-draft':
            self.handle_generate_draft()
        else:
            self.send_error(404, 'Not Found')

    def do_GET(self):
        """处理 GET 请求"""
        if self.path.startswith('/output/'):
            self.handle_download_draft()
        else:
            self.send_error(404, 'Not Found')

    def handle_generate_draft(self):
        """生成剪映工程文件"""
        try:
            # 读取请求体
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            request_data = json.loads(body.decode('utf-8'))

            # 验证必要字段
            if not JIANYING_AVAILABLE:
                self.send_json_response(400, {
                    'error': 'pyJianYingDraft 库未安装',
                    'message': '请先安装 pyJianYingDraft 库'
                })
                return

            # 提取数据
            project_name = request_data.get('projectName', f'SmartClip_{uuid.uuid4().hex[:8]}')
            width = request_data.get('width', 1920)
            height = request_data.get('height', 1080)
            fps = request_data.get('fps', 30)
            segments = request_data.get('segments', [])
            videos = request_data.get('videos', [])

            print(f'[JianYing] 生成工程: {project_name}')
            print(f'[JianYing] 分辨率: {width}x{height}, FPS: {fps}')
            print(f'[JianYing] 分镜数: {len(segments)}, 视频数: {len(videos)}')

            # 创建临时工作目录
            work_dir = TEMP_DIR / project_name
            if work_dir.exists():
                shutil.rmtree(work_dir)
            work_dir.mkdir(parents=True, exist_ok=True)

            # 创建剪映草稿
            draft_folder = draft.DraftFolder(str(work_dir))
            script = draft_folder.create_draft(
                project_name,
                width,
                height,
                fps,
                allow_replace=True
            )

            # 添加轨道
            script.add_track(draft.TrackType.video)
            script.add_track(draft.TrackType.audio)
            script.add_track(draft.TrackType.text)

            # 添加视频片段
            current_time = 0
            for i, video_url in enumerate(videos):
                try:
                    # 下载视频文件
                    video_file = work_dir / f'video_{i}.mp4'
                    print(f'[JianYing] 下载视频 {i+1}/{len(videos)}: {video_url}')
                    
                    # 简单的 URL 下载（实际应该使用更健壮的方法）
                    if video_url.startswith('http'):
                        urllib.request.urlretrieve(video_url, str(video_file))
                    else:
                        # 如果是本地路径，直接复制
                        shutil.copy(video_url, str(video_file))

                    # 获取视频时长（简化处理，假设每个视频 3 秒）
                    duration = 3  # 秒
                    
                    # 创建视频片段
                    video_segment = draft.VideoSegment(
                        str(video_file),
                        trange(f'{current_time}s', f'{duration}s')
                    )
                    
                    # 添加到轨道
                    script.add_segment(video_segment)
                    current_time += duration

                    print(f'[JianYing] 视频 {i+1} 添加成功')

                except Exception as e:
                    print(f'[JianYing] 警告: 添加视频 {i+1} 失败: {e}')
                    continue

            # 添加文本片段（如果有分镜信息）
            current_time = 0
            for i, segment in enumerate(segments):
                try:
                    voiceover = segment.get('voiceover_text', '')
                    if voiceover:
                        # 创建文本片段
                        text_segment = draft.TextSegment(
                            voiceover,
                            trange(f'{current_time}s', '3s'),  # 假设每个分镜 3 秒
                            font=draft.FontType.文轩体
                        )
                        script.add_segment(text_segment)
                    
                    current_time += 3

                except Exception as e:
                    print(f'[JianYing] 警告: 添加文本 {i+1} 失败: {e}')
                    continue

            # 保存草稿
            print(f'[JianYing] 保存草稿...')
            script.save()

            # 打包为 ZIP 文件
            draft_zip = OUTPUT_DIR / f'{project_name}.zip'
            shutil.make_archive(
                str(draft_zip.with_suffix('')),
                'zip',
                str(work_dir),
                project_name
            )

            # 返回成功响应
            self.send_json_response(200, {
                'success': True,
                'projectName': project_name,
                'draftFile': f'/output/{project_name}.zip',
                'message': f'工程文件生成成功: {project_name}'
            })

            print(f'[JianYing] 工程生成完成: {draft_zip}')

        except Exception as e:
            print(f'[JianYing] 错误: {e}')
            import traceback
            traceback.print_exc()
            self.send_json_response(500, {
                'error': str(e),
                'message': '生成工程文件失败'
            })

    def handle_download_draft(self):
        """下载工程文件"""
        try:
            # 提取文件名
            filename = self.path.split('/output/')[-1]
            file_path = OUTPUT_DIR / filename

            if not file_path.exists():
                self.send_error(404, 'File not found')
                return

            # 读取文件
            with open(file_path, 'rb') as f:
                content = f.read()

            # 返回文件
            self.send_response(200)
            self.send_header('Content-Type', 'application/zip')
            self.send_header('Content-Length', str(len(content)))
            self.send_header('Content-Disposition', f'attachment; filename="{filename}"')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(content)

            print(f'[JianYing] 下载文件: {filename}')

        except Exception as e:
            print(f'[JianYing] 下载错误: {e}')
            self.send_error(500, 'Internal server error')

    def send_json_response(self, status_code, data):
        """发送 JSON 响应"""
        response = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(response)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        self.wfile.write(response)

    def do_OPTIONS(self):
        """处理 CORS 预检请求"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def log_message(self, format, *args):
        """自定义日志输出"""
        print(f'[{self.client_address[0]}] {format % args}')


def run_server():
    """启动服务器"""
    server_address = ('127.0.0.1', PORT)
    httpd = HTTPServer(server_address, JianYingDraftHandler)
    print(f'[JianYing] 剪映工程文件生成服务启动在 http://127.0.0.1:{PORT}')
    print(f'[JianYing] 输出目录: {OUTPUT_DIR}')
    print(f'[JianYing] 临时目录: {TEMP_DIR}')
    print(f'[JianYing] pyJianYingDraft 可用: {JIANYING_AVAILABLE}')
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\n[JianYing] 服务器已停止')
        httpd.server_close()


if __name__ == '__main__':
    run_server()
