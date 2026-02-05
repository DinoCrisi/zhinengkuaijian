"""
视频分割服务
根据分析结果将原视频按分镜拆分成多个片段
使用英文命名：hook_001.mp4, selling_point_001.mp4 等
"""

import os
import sys
import json
import uuid
import tempfile
import subprocess
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler
import urllib.request
import shutil

# 导入全局配置
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(PROJECT_ROOT, 'server'))
from config import BASE_HOST, SERVICE_PORTS

# 配置
OUTPUT_DIR = Path(__file__).parent / 'output_segments'
TEMP_DIR = Path(tempfile.gettempdir()) / 'smartclip_segments'

# 确保输出目录存在
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
TEMP_DIR.mkdir(parents=True, exist_ok=True)

# 检查 FFmpeg 是否可用
def check_ffmpeg():
    """检查 FFmpeg 是否安装"""
    try:
        result = subprocess.run(['ffmpeg', '-version'], capture_output=True, text=True, timeout=5)
        return result.returncode == 0
    except:
        return False

FFMPEG_AVAILABLE = check_ffmpeg()


class VideoSplitterHandler(BaseHTTPRequestHandler):
    """处理视频分割请求"""

    def do_POST(self):
        """处理 POST 请求"""
        if self.path == '/api/split-video':
            self.handle_split_video()
        else:
            self.send_error(404, 'Not Found')

    def do_GET(self):
        """处理 GET 请求"""
        if self.path.startswith('/segments/'):
            self.handle_serve_segment()
        else:
            self.send_error(404, 'Not Found')

    def handle_serve_segment(self):
        """提供视频分镜文件"""
        try:
            import urllib.parse
            
            # 提取文件名并进行 URL 解码
            encoded_filename = self.path.split('/segments/')[-1]
            filename = urllib.parse.unquote(encoded_filename)
            
            print(f'[VideoSplitter] 请求分镜文件: {filename}')
            
            file_path = OUTPUT_DIR / filename

            if not file_path.exists():
                print(f'[VideoSplitter] 文件不存在: {file_path}')
                print(f'[VideoSplitter] 输出目录内容:')
                if OUTPUT_DIR.exists():
                    for f in OUTPUT_DIR.iterdir():
                        print(f'  - {f.name}')
                self.send_error(404, 'Segment file not found')
                return

            # 读取文件
            with open(file_path, 'rb') as f:
                content = f.read()

            # 返回视频文件
            self.send_response(200)
            self.send_header('Content-Type', 'video/mp4')
            self.send_header('Content-Length', str(len(content)))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Cache-Control', 'public, max-age=3600')
            self.end_headers()
            self.wfile.write(content)

            print(f'[VideoSplitter] 分镜文件提供成功: {filename} ({len(content)} bytes)')

        except Exception as e:
            print(f'[VideoSplitter] 提供分镜文件错误: {e}')
            import traceback
            traceback.print_exc()
            self.send_error(500, 'Internal server error')

    def do_OPTIONS(self):
        """处理 CORS 预检请求"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def handle_split_video(self):
        """分割视频"""
        try:
            if not FFMPEG_AVAILABLE:
                self.send_json_response(400, {
                    'error': 'FFmpeg 未安装',
                    'message': '请先安装 FFmpeg'
                })
                return

            # 解析 multipart/form-data
            content_type = self.headers.get('Content-Type', '')
            if 'multipart/form-data' not in content_type:
                self.send_json_response(400, {
                    'error': '无效的 Content-Type',
                    'message': '请使用 multipart/form-data'
                })
                return

            # 提取 boundary
            boundary = content_type.split('boundary=')[-1].encode()
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)

            # 解析表单数据
            video_data = None
            analysis_data = None
            
            parts = body.split(b'--' + boundary)
            for part in parts:
                if b'Content-Disposition: form-data' not in part:
                    continue
                
                # 提取字段名
                if b'name="video"' in part:
                    # 提取视频文件
                    video_start = part.find(b'\r\n\r\n') + 4
                    video_end = part.rfind(b'\r\n')
                    video_data = part[video_start:video_end]
                
                elif b'name="analysis"' in part:
                    # 提取分析数据
                    analysis_start = part.find(b'\r\n\r\n') + 4
                    analysis_end = part.rfind(b'\r\n')
                    analysis_json = part[analysis_start:analysis_end].decode('utf-8')
                    analysis_data = json.loads(analysis_json)

            if not video_data or not analysis_data:
                self.send_json_response(400, {
                    'error': '缺少必要数据',
                    'message': '请提供视频文件和分析数据'
                })
                return

            # 保存临时视频文件
            temp_video = TEMP_DIR / f'temp_video_{uuid.uuid4().hex[:8]}.mp4'
            with open(temp_video, 'wb') as f:
                f.write(video_data)

            print(f'[VideoSplitter] 接收视频: {temp_video.name} ({len(video_data)} bytes)')
            print(f'[VideoSplitter] 分镜数: {len(analysis_data.get("segments", []))}')

            # 分割视频
            segments = self.split_video_by_analysis(temp_video, analysis_data)

            # 返回成功响应
            self.send_json_response(200, {
                'success': True,
                'analysisId': analysis_data.get('id', ''),
                'segments': segments,
                'totalDuration': analysis_data.get('total_duration', ''),
                'createdAt': str(Path(temp_video).stat().st_mtime)
            })

            print(f'[VideoSplitter] 分割完成: {len(segments)} 个分镜')

        except Exception as e:
            print(f'[VideoSplitter] 错误: {e}')
            import traceback
            traceback.print_exc()
            self.send_json_response(500, {
                'error': str(e),
                'message': '视频分割失败'
            })

    def split_video_by_analysis(self, video_file: Path, analysis: dict) -> list:
        """根据分析结果分割视频"""
        segments = []
        segments_data = analysis.get('segments', [])

        for index, segment in enumerate(segments_data):
            try:
                # 解析时间范围
                time_range = segment.get('time', '0-0s')
                match_result = self._parse_time_range(time_range)
                start_time = match_result['start']
                duration = match_result['duration']

                # 生成输出文件名
                narrative_type = segment.get('main_tag', 'segment')
                filename = self._generate_filename(narrative_type, index)
                output_file = OUTPUT_DIR / filename

                print(f'[VideoSplitter] 分割分镜 {index + 1}/{len(segments_data)}: {filename}')

                # 使用 FFmpeg 分割视频
                cmd = [
                    'ffmpeg',
                    '-i', str(video_file),
                    '-ss', str(start_time),
                    '-t', str(duration),
                    '-c:v', 'libx264',  # 重新编码视频，确保兼容性
                    '-c:a', 'aac',      # 重新编码音频
                    '-preset', 'fast',  # 快速编码
                    '-crf', '23',       # 质量控制
                    '-y',               # 覆盖输出文件
                    str(output_file)
                ]

                print(f'[VideoSplitter] FFmpeg 命令: {" ".join(cmd)}')

                # 设置环境变量避免编码问题
                env = os.environ.copy()
                env['PYTHONIOENCODING'] = 'utf-8'

                result = subprocess.run(
                    cmd, 
                    capture_output=True, 
                    text=True, 
                    timeout=300,
                    env=env,
                    encoding='utf-8',
                    errors='ignore'  # 忽略编码错误
                )

                if result.returncode != 0:
                    print(f'[VideoSplitter] FFmpeg 错误: {result.stderr}')
                    print(f'[VideoSplitter] FFmpeg 输出: {result.stdout}')
                    raise Exception(f'FFmpeg 分割失败: {result.stderr}')

                # 检查输出文件是否存在且有内容
                if not output_file.exists():
                    raise Exception(f'输出文件未生成: {output_file}')
                
                file_size = output_file.stat().st_size
                if file_size < 1000:  # 小于1KB可能有问题
                    print(f'[VideoSplitter] 警告: 输出文件很小 ({file_size} bytes)，可能有问题')
                    
                    # 尝试用更宽松的参数重新分割
                    print(f'[VideoSplitter] 尝试重新分割...')
                    cmd_retry = [
                        'ffmpeg',
                        '-i', str(video_file),
                        '-ss', str(max(0, start_time - 0.5)),  # 提前0.5秒开始
                        '-t', str(duration + 1),               # 延长1秒
                        '-c:v', 'libx264',
                        '-c:a', 'aac',
                        '-preset', 'ultrafast',
                        '-crf', '28',
                        '-y',
                        str(output_file)
                    ]
                    
                    result_retry = subprocess.run(
                        cmd_retry, 
                        capture_output=True, 
                        text=True, 
                        timeout=300,
                        env=env,
                        encoding='utf-8',
                        errors='ignore'
                    )
                    
                    if result_retry.returncode == 0:
                        file_size = output_file.stat().st_size
                        print(f'[VideoSplitter] 重新分割成功: {file_size} bytes')
                    else:
                        print(f'[VideoSplitter] 重新分割也失败: {result_retry.stderr}')

                segments.append({
                    'segmentId': segment.get('id', f'seg_{index}'),
                    'narrativeType': narrative_type,
                    'filename': filename,
                    'url': f'/segments/{filename}',
                    'duration': duration,
                    'timeRange': time_range,
                    'fileSize': file_size
                })

                print(f'[VideoSplitter] 分割成功: {filename} ({file_size} bytes)')

            except Exception as e:
                print(f'[VideoSplitter] 分割分镜 {index + 1} 失败: {e}')
                continue

        return segments

    def _parse_time_range(self, time_str: str) -> dict:
        """解析时间范围字符串"""
        import re
        # 支持多种时间格式
        # "0-3s" → start=0, end=3, duration=3
        # "00:00-00:03" → start=0, end=3, duration=3
        # "0s-3s" → start=0, end=3, duration=3
        
        # 尝试匹配 "数字-数字s" 格式
        match = re.match(r'(\d+)-(\d+)s', time_str)
        if match:
            start = int(match.group(1))
            end = int(match.group(2))
            return {'start': start, 'end': end, 'duration': end - start}
        
        # 尝试匹配 "数字s-数字s" 格式
        match = re.match(r'(\d+)s-(\d+)s', time_str)
        if match:
            start = int(match.group(1))
            end = int(match.group(2))
            return {'start': start, 'end': end, 'duration': end - start}
        
        # 尝试匹配 "MM:SS-MM:SS" 格式
        match = re.match(r'(\d{2}):(\d{2})-(\d{2}):(\d{2})', time_str)
        if match:
            start_min, start_sec, end_min, end_sec = map(int, match.groups())
            start = start_min * 60 + start_sec
            end = end_min * 60 + end_sec
            return {'start': start, 'end': end, 'duration': end - start}
        
        # 默认返回
        print(f'[VideoSplitter] 警告: 无法解析时间格式: {time_str}，使用默认值')
        return {'start': 0, 'end': 5, 'duration': 5}

    def _generate_filename(self, narrative_type: str, index: int) -> str:
        """生成分镜文件名"""
        type_map = {
            'hook': 'hook',
            'selling_point': 'selling_point',
            'proof': 'proof',
            'cta': 'cta',
            '钩子': 'hook',
            '卖点': 'selling_point',
            '证明': 'proof',
            '转化': 'cta'
        }
        type_english = type_map.get(narrative_type, 'segment')
        padded_index = str(index + 1).zfill(3)
        return f'{type_english}_{padded_index}.mp4'

    def send_json_response(self, status_code: int, data: dict):
        """发送 JSON 响应"""
        response = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(response)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(response)

    def log_message(self, format, *args):
        """自定义日志输出"""
        print(f'[{self.client_address[0]}] {format % args}')


def run_server():
    """启动服务器"""
    port = SERVICE_PORTS['VIDEO_SPLITTER']
    server_address = ('', port)
    httpd = HTTPServer(server_address, VideoSplitterHandler)
    print(f'[VideoSplitter] 视频分割服务启动在 http://{BASE_HOST}:{port}')
    print(f'[VideoSplitter] 输出目录: {OUTPUT_DIR}')
    print(f'[VideoSplitter] 临时目录: {TEMP_DIR}')
    print(f'[VideoSplitter] FFmpeg 可用: {FFMPEG_AVAILABLE}')
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\n[VideoSplitter] 服务器已停止')
        httpd.server_close()


if __name__ == '__main__':
    run_server()
