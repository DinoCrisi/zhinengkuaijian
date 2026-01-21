"""
视频合成服务
使用 FFmpeg 将多个分镜视频合并为完整视频
支持视频转录功能
"""

import os
import json
import uuid
import subprocess
import urllib.request
import urllib.parse
import shutil
from pathlib import Path
from typing import List, Dict
from http.server import HTTPServer, BaseHTTPRequestHandler
import threading
import time

# 解决 OpenMP 库冲突问题
os.environ['KMP_DUPLICATE_LIB_OK'] = 'TRUE'

# 配置
TEMP_DIR = Path("temp_videos")
OUTPUT_DIR = Path("output_videos")
TEMP_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)

_FFMPEG_BIN_CACHE = None

def get_ffmpeg_bin() -> str:
    """获取 FFmpeg 可执行文件路径"""
    global _FFMPEG_BIN_CACHE
    if _FFMPEG_BIN_CACHE:
        return _FFMPEG_BIN_CACHE

    env_bin = os.environ.get('FFMPEG_PATH') or os.environ.get('FFMPEG_BIN')
    if env_bin and Path(env_bin).exists():
        _FFMPEG_BIN_CACHE = env_bin
        return env_bin

    which_bin = shutil.which('ffmpeg')
    if which_bin:
        _FFMPEG_BIN_CACHE = which_bin
        return which_bin

    candidates = [
        Path(__file__).resolve().parent / 'ffmpeg' / 'bin' / 'ffmpeg.exe',
        Path(__file__).resolve().parent.parent / 'ffmpeg' / 'bin' / 'ffmpeg.exe',
        Path(__file__).resolve().parent / 'ffmpeg.exe',
        Path(__file__).resolve().parent.parent / 'ffmpeg.exe',
        Path.home() / 'Desktop' / 'ffmpeg.exe',
    ]
    for p in candidates:
        if p.exists():
            _FFMPEG_BIN_CACHE = str(p)
            return str(p)

    desktop_dir = Path.home() / 'Desktop'
    if desktop_dir.exists():
        try:
            for p in desktop_dir.rglob('ffmpeg.exe'):
                if p.exists():
                    _FFMPEG_BIN_CACHE = str(p)
                    return str(p)
        except Exception:
            pass

    raise FileNotFoundError('未找到 FFmpeg：请安装 ffmpeg 并加入 PATH，或设置环境变量 FFMPEG_PATH 指向 ffmpeg.exe')

# 任务状态存储
tasks = {}

class VideoComposerHandler(BaseHTTPRequestHandler):
    """视频合成 API 处理器"""
    
    def _set_headers(self, status=200, content_type='application/json'):
        """设置响应头"""
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def do_OPTIONS(self):
        """处理 OPTIONS 请求（CORS 预检）"""
        self._set_headers()
    
    def do_HEAD(self):
        """处理 HEAD 请求（用于检查文件是否存在）"""
        if self.path.startswith('/output/'):
            try:
                from urllib.parse import urlparse
                parsed = urlparse(self.path)
                path_part = parsed.path
                encoded_filename = path_part.split('/output/')[-1]
                filename = urllib.parse.unquote(encoded_filename)
                file_path = OUTPUT_DIR / filename
                
                if not file_path.exists():
                    self._set_headers(404)
                    return
                
                file_size = file_path.stat().st_size
                self.send_response(200)
                self.send_header('Content-Type', 'video/mp4')
                self.send_header('Content-Length', str(file_size))
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
                self.send_header('Access-Control-Allow-Headers', 'Content-Type')
                self.end_headers()
            except Exception as e:
                print(f"Error handling HEAD request: {e}")
                self._set_headers(500)
        else:
            self._set_headers(404)
    
    def do_POST(self):
        """处理 POST 请求"""
        if self.path == '/api/compose-video':
            self._handle_compose_video()
        elif self.path == '/api/transcribe-video':
            self._handle_transcribe_video()
        else:
            self._set_headers(404)
            self.wfile.write(json.dumps({'error': 'Not Found'}).encode())
    
    def do_GET(self):
        """处理 GET 请求"""
        if self.path.startswith('/api/compose-video/'):
            self._handle_query_task()
        elif self.path.startswith('/output/'):
            self._handle_download_file()
        else:
            self._set_headers(404)
            self.wfile.write(json.dumps({'error': 'Not Found'}).encode())
    
    def _handle_compose_video(self):
        """处理视频合成请求"""
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            request_data = json.loads(post_data.decode('utf-8'))
            
            if 'videoUrls' not in request_data or 'productName' not in request_data:
                self._set_headers(400)
                self.wfile.write(json.dumps({'error': '缺少必要参数：videoUrls 和 productName'}).encode())
                return
            
            video_urls = request_data['videoUrls']
            product_name = request_data['productName']
            version = request_data.get('version', 1)
            
            task_id = str(uuid.uuid4())
            tasks[task_id] = {
                'id': task_id,
                'status': 'pending',
                'progress': 0,
                'videoUrls': video_urls,
                'productName': product_name,
                'version': version,
                'outputUrl': None,
                'error': None,
                'createdAt': time.time()
            }
            
            thread = threading.Thread(
                target=self._compose_video,
                args=(task_id, video_urls, product_name, version)
            )
            thread.daemon = True
            thread.start()
            
            self._set_headers(200)
            self.wfile.write(json.dumps({
                'taskId': task_id,
                'status': 'pending',
                'message': '视频合成任务已创建'
            }).encode())
            
        except Exception as e:
            print(f"Error creating task: {e}")
            self._set_headers(500)
            self.wfile.write(json.dumps({'error': f'创建任务失败: {str(e)}'}).encode())
    
    def _handle_query_task(self):
        """处理任务查询请求"""
        try:
            task_id = self.path.split('/')[-1]
            
            if task_id not in tasks:
                self._set_headers(404)
                self.wfile.write(json.dumps({'error': '任务不存在'}).encode())
                return
            
            task = tasks[task_id]
            self._set_headers(200)
            self.wfile.write(json.dumps({
                'taskId': task['id'],
                'status': task['status'],
                'progress': task['progress'],
                'outputUrl': task['outputUrl'],
                'error': task['error']
            }).encode())
            
        except Exception as e:
            print(f"Error querying task: {e}")
            self._set_headers(500)
            self.wfile.write(json.dumps({'error': f'查询任务失败: {str(e)}'}).encode())
    
    def _handle_download_file(self):
        """处理文件下载请求"""
        try:
            from urllib.parse import urlparse, parse_qs
            parsed = urlparse(self.path)
            path_part = parsed.path
            query_params = parse_qs(parsed.query)
            
            encoded_filename = path_part.split('/output/')[-1]
            filename = urllib.parse.unquote(encoded_filename)
            file_path = OUTPUT_DIR / filename
            
            is_download = 'download' in query_params
            
            print(f"[File] Requested: {filename}, Download: {is_download}")
            
            if not file_path.exists():
                self._set_headers(404)
                self.wfile.write(json.dumps({'error': 'File not found'}).encode())
                return
            
            file_size = file_path.stat().st_size
            self.send_response(200)
            self.send_header('Content-Type', 'video/mp4')
            self.send_header('Content-Length', str(file_size))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
            self.send_header('Accept-Ranges', 'bytes')
            
            if is_download:
                encoded_name = urllib.parse.quote(filename)
                self.send_header('Content-Disposition', f'attachment; filename*=UTF-8\'\'{encoded_name}')
            
            self.end_headers()
            
            with open(file_path, 'rb') as f:
                self.wfile.write(f.read())
                
        except Exception as e:
            print(f"Error serving file: {e}")
            self._set_headers(500)
            self.wfile.write(json.dumps({'error': 'Error serving file'}).encode())
    
    def _handle_transcribe_video(self):
        """处理视频转录请求"""
        video_path = None
        wav_path = None
        try:
            import sys
            
            print(f"[Transcribe] 收到转录请求")
            
            content_type = self.headers.get('Content-Type', '')
            print(f"[Transcribe] Content-Type: {content_type}")
            
            if 'multipart/form-data' not in content_type:
                print(f"[Transcribe] 错误: 不正确的Content-Type")
                self._set_headers(400)
                self.wfile.write(json.dumps({'error': '请求必须使用 multipart/form-data'}).encode())
                return
            
            # 提取 boundary
            boundary_str = content_type.split("boundary=")[-1].strip('"').strip()
            boundary = boundary_str.encode()
            print(f"[Transcribe] Boundary: {boundary_str}")
            
            # 读取请求体
            content_length = int(self.headers.get('Content-Length', 0))
            print(f"[Transcribe] Content-Length: {content_length}")
            
            if content_length == 0:
                self._set_headers(400)
                self.wfile.write(json.dumps({'error': '请求体为空'}).encode())
                return
            
            body = self.rfile.read(content_length)
            print(f"[Transcribe] 读取请求体: {len(body)} bytes")
            
            # 解析 multipart 数据
            parts = body.split(b'--' + boundary)
            print(f"[Transcribe] 分割为 {len(parts)} 个部分")
            
            file_data = None
            model_name = 'base'
            offset_ms = 0
            
            for part in parts:
                if not part or part == b'--\r\n' or part == b'--' or part == b'\r\n':
                    continue
                
                # 分离 headers 和 content
                if b'\r\n\r\n' in part:
                    headers_section, content = part.split(b'\r\n\r\n', 1)
                elif b'\n\n' in part:
                    headers_section, content = part.split(b'\n\n', 1)
                else:
                    continue
                
                # 移除末尾的 \r\n 或 \n
                content = content.rstrip(b'\r\n').rstrip(b'\n')
                
                # 解析 headers
                headers_text = headers_section.decode('utf-8', errors='ignore')
                
                if 'name="file"' in headers_text:
                    file_data = content
                    print(f"[Transcribe] ✓ 获取文件数据，大小: {len(file_data)} bytes")
                elif 'name="model"' in headers_text:
                    model_name = content.decode('utf-8', errors='ignore').strip()
                    print(f"[Transcribe] ✓ 模型: {model_name}")
                elif 'name="offsetMs"' in headers_text:
                    try:
                        offset_ms = int(content.decode('utf-8', errors='ignore').strip())
                        print(f"[Transcribe] ✓ 时间偏移: {offset_ms}ms")
                    except:
                        offset_ms = 0
            
            if not file_data:
                print(f"[Transcribe] 错误: 缺少file字段")
                self._set_headers(400)
                self.wfile.write(json.dumps({'error': '缺少字段：file'}).encode())
                return
            
            print(f"[Transcribe] 参数: model={model_name}, offset={offset_ms}ms")
            
            # 保存视频文件
            task_id = str(uuid.uuid4())
            video_path = TEMP_DIR / f"transcribe_{task_id}.mp4"
            wav_path = TEMP_DIR / f"transcribe_{task_id}.wav"
            
            print(f"[Transcribe] 保存视频文件: {video_path}")
            with open(video_path, 'wb') as f:
                f.write(file_data)
            print(f"[Transcribe] ✓ 视频文件已保存")
            
            # 使用 FFmpeg 提取音频
            print(f"[Transcribe] 使用FFmpeg提取音频...")
            ffmpeg_bin = get_ffmpeg_bin()
            print(f"[Transcribe] FFmpeg路径: {ffmpeg_bin}")
            
            cmd = [
                ffmpeg_bin,
                '-y',
                '-i', str(video_path.absolute()),
                '-vn',
                '-ac', '1',
                '-ar', '16000',
                '-af', 'aresample=async=1:first_pts=0',
                str(wav_path.absolute())
            ]
            
            print(f"[Transcribe] 执行FFmpeg...")
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=False,
                timeout=600
            )
            
            if result.returncode != 0:
                error_msg = result.stderr.decode('utf-8', errors='ignore') if result.stderr else 'Unknown error'
                print(f"[Transcribe] FFmpeg错误: {error_msg}")
                raise Exception(f"FFmpeg 抽取音频失败: {error_msg}")
            
            print(f"[Transcribe] ✓ 音频提取成功")
            
            # 导入转录模块
            print(f"[Transcribe] 导入转录模块...")
            root_dir = Path(__file__).resolve().parent.parent
            
            if str(root_dir) not in sys.path:
                sys.path.insert(0, str(root_dir))
            
            from word.transcribe import transcribe_audio_detailed, build_srt_from_segments
            print(f"[Transcribe] ✓ 模块导入成功")
            
            # 语音识别
            print(f"[Transcribe] 开始语音识别...")
            res = transcribe_audio_detailed(str(wav_path.absolute()), model_name)
            if not res:
                raise Exception("语音识别失败")
            
            print(f"[Transcribe] ✓ 识别成功，文本长度: {len(res.get('text', ''))} 字符")
            
            if offset_ms:
                print(f"[Transcribe] 应用时间偏移: {offset_ms}ms")
                offset_seconds = offset_ms / 1000.0
                segments = res.get('segments') or []
                res['srt'] = build_srt_from_segments(segments, offset_seconds)
            
            print(f"[Transcribe] ✓ 转录完成，返回结果")
            self._set_headers(200)
            response_data = {
                'text': res.get('text', ''),
                'srt': res.get('srt', ''),
            }
            self.wfile.write(json.dumps(response_data).encode())
            print(f"[Transcribe] ✓ 响应已发送")
            
        except Exception as e:
            print(f"[Transcribe] ❌ 异常: {e}")
            import traceback
            traceback.print_exc()
            self._set_headers(500)
            self.wfile.write(json.dumps({'error': str(e)}).encode())
        finally:
            try:
                if video_path and Path(video_path).exists():
                    Path(video_path).unlink()
                    print(f"[Transcribe] ✓ 已清理视频文件")
            except Exception as e:
                print(f"[Transcribe] 清理视频文件失败: {e}")
            try:
                if wav_path and Path(wav_path).exists():
                    Path(wav_path).unlink()
                    print(f"[Transcribe] ✓ 已清理音频文件")
            except Exception as e:
                print(f"[Transcribe] 清理音频文件失败: {e}")
    
    def _compose_video(self, task_id: str, video_urls: List[str], product_name: str, version: int):
        """合成视频（在后台线程中执行）"""
        try:
            print(f"[Task {task_id}] Starting video composition...")
            tasks[task_id]['status'] = 'processing'
            tasks[task_id]['progress'] = 10
            
            # 1. 下载所有视频
            print(f"[Task {task_id}] Downloading {len(video_urls)} videos...")
            video_files = []
            for i, url in enumerate(video_urls):
                try:
                    file_path = TEMP_DIR / f"{task_id}_segment_{i}.mp4"
                    urllib.request.urlretrieve(url, file_path)
                    video_files.append(file_path)
                    
                    progress = 10 + int((i + 1) / len(video_urls) * 40)
                    tasks[task_id]['progress'] = progress
                    print(f"[Task {task_id}] Downloaded {i+1}/{len(video_urls)} videos ({progress}%)")
                    
                except Exception as e:
                    print(f"[Task {task_id}] Error downloading video {i}: {e}")
                    raise Exception(f"下载视频 {i+1} 失败: {str(e)}")
            
            tasks[task_id]['progress'] = 50
            
            # 2. 创建 FFmpeg concat 文件
            print(f"[Task {task_id}] Creating concat file...")
            concat_file = TEMP_DIR / f"{task_id}_concat.txt"
            with open(concat_file, 'w', encoding='utf-8') as f:
                for video_file in video_files:
                    abs_path = video_file.absolute()
                    f.write(f"file '{abs_path}'\n")
            
            tasks[task_id]['progress'] = 60
            
            # 3. 使用 FFmpeg 合并视频
            print(f"[Task {task_id}] Composing video with FFmpeg...")
            output_filename = f"{product_name}_版本{version}_{task_id[:8]}.mp4"
            output_path = OUTPUT_DIR / output_filename
            
            ffmpeg_bin = get_ffmpeg_bin()
            cmd = [
                ffmpeg_bin,
                '-f', 'concat',
                '-safe', '0',
                '-i', str(concat_file.absolute()),
                '-c', 'copy',
                '-y',
                str(output_path.absolute())
            ]
            
            print(f"[Task {task_id}] Running FFmpeg command...")
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=False,
                timeout=300
            )
            
            if result.returncode != 0:
                error_msg = result.stderr.decode('utf-8', errors='ignore') if result.stderr else 'Unknown error'
                print(f"[Task {task_id}] FFmpeg error: {error_msg}")
                raise Exception(f"FFmpeg 合成失败: {error_msg}")
            
            tasks[task_id]['progress'] = 90
            
            # 4. 清理临时文件
            print(f"[Task {task_id}] Cleaning up temporary files...")
            for video_file in video_files:
                try:
                    video_file.unlink()
                except:
                    pass
            try:
                concat_file.unlink()
            except:
                pass
            
            # 5. 完成
            output_url = f"http://127.0.0.1:8889/output/{output_filename}"
            tasks[task_id]['status'] = 'completed'
            tasks[task_id]['progress'] = 100
            tasks[task_id]['outputUrl'] = output_url
            
            print(f"[Task {task_id}] Video composition completed!")
            print(f"[Task {task_id}] Output URL: {output_url}")
            
        except Exception as e:
            print(f"[Task {task_id}] Error: {e}")
            tasks[task_id]['status'] = 'failed'
            tasks[task_id]['error'] = str(e)
    
    def log_message(self, format, *args):
        """自定义日志格式"""
        print(f"[{self.log_date_time_string()}] {format % args}")


def run_server(port=8889):
    """启动视频合成服务器"""
    server_address = ('', port)
    httpd = HTTPServer(server_address, VideoComposerHandler)
    print(f"🎬 Video Composer Server running on http://127.0.0.1:{port}")
    print(f"📁 Temp directory: {TEMP_DIR.absolute()}")
    print(f"📁 Output directory: {OUTPUT_DIR.absolute()}")
    print(f"\nAPI Endpoints:")
    print(f"  POST /api/compose-video - 创建视频合成任务")
    print(f"  GET  /api/compose-video/<task_id> - 查询任务状态")
    print(f"  POST /api/transcribe-video - 转录视频字幕")
    print(f"  GET  /output/<filename> - 下载合成视频")
    print(f"\n等待请求...\n")
    httpd.serve_forever()


if __name__ == '__main__':
    run_server()
