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
import subprocess
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse
import urllib.request

# 导入全局配置
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(PROJECT_ROOT, 'server'))
from config import BASE_HOST, SERVICE_PORTS

# 尝试导入 pyJianYingDraft，如果失败则自动安装
JIANYING_AVAILABLE = False
try:
    import pyJianYingDraft as draft
    from pyJianYingDraft import trange, tim
    JIANYING_AVAILABLE = True
except ImportError:
    print("正在安装 pyJianYingDraft 库...")
    try:
        # 获取项目根目录
        jianying_path = os.path.join(PROJECT_ROOT, 'pyJianYingDraft')
        
        # 尝试安装
        result = subprocess.run(
            [sys.executable, '-m', 'pip', 'install', '-e', jianying_path],
            capture_output=True,
            text=True,
            timeout=120
        )
        
        if result.returncode == 0:
            # 清除导入缓存并重新导入
            if 'pyJianYingDraft' in sys.modules:
                del sys.modules['pyJianYingDraft']
            
            import importlib
            import pyJianYingDraft as draft
            importlib.reload(draft)
            from pyJianYingDraft import trange, tim
            JIANYING_AVAILABLE = True
            print("✅ pyJianYingDraft 库安装成功")
        else:
            print(f"❌ 安装失败: {result.stderr}")
            print(f"标准输出: {result.stdout}")
    except Exception as e:
        print(f"❌ 安装异常: {e}")
        import traceback
        traceback.print_exc()

if not JIANYING_AVAILABLE:
    print("警告: pyJianYingDraft 库未安装，部分功能将不可用")

# 配置
OUTPUT_DIR = Path(__file__).parent / 'output_drafts'
TEMP_DIR = Path(tempfile.gettempdir()) / 'smartclip_drafts'

# 剪映草稿目录
JIANYING_DRAFTS_DIR = Path.home() / 'AppData' / 'Local' / 'JianyingPro' / 'User Data' / 'Projects' / 'com.lveditor.draft'

# 确保输出目录存在
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
TEMP_DIR.mkdir(parents=True, exist_ok=True)


class JianYingDraftHandler(BaseHTTPRequestHandler):
    """处理剪映工程文件生成请求"""

    def _sanitize_filename(self, filename):
        """清理文件名：移除特殊字符，限制长度"""
        import re
        # 第一步：移除 Windows 非法字符
        safe_name = re.sub(r'[<>:"/\\|?*]', '', filename)
        # 第二步：移除中文省略号和其他特殊符号
        safe_name = safe_name.replace('…', '').replace('...', '').replace('，', '_').replace('。', '_')
        # 第三步：将空格和连字符替换为下划线
        safe_name = safe_name.replace(' ', '_').replace('-', '_')
        # 第四步：移除其他特殊字符，保留字母数字、下划线和中文
        safe_name = re.sub(r'[^\w\u4e00-\u9fff]', '', safe_name, flags=re.UNICODE)
        # 第五步：限制长度（Windows 路径限制 256 字符，预留空间）
        safe_name = safe_name[:30]  # 更短的长度限制
        # 第六步：如果为空或以点开头，使用默认名称
        if not safe_name or safe_name.startswith('.'):
            safe_name = f'project_{uuid.uuid4().hex[:8]}'
        # 第七步：确保不以下划线结尾
        safe_name = safe_name.rstrip('_')
        if not safe_name:
            safe_name = f'project_{uuid.uuid4().hex[:8]}'
        return safe_name

    def do_POST(self):
        """处理 POST 请求"""
        print(f'[JianYing] 收到 POST 请求: {self.path}')
        if self.path == '/api/generate-draft':
            print(f'[JianYing] 路由到 handle_generate_draft')
            self.handle_generate_draft()
        else:
            print(f'[JianYing] 路径不匹配，返回 404')
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
            print(f'[JianYing] 检查库可用性: JIANYING_AVAILABLE = {JIANYING_AVAILABLE}')
            if not JIANYING_AVAILABLE:
                print(f'[JianYing] 错误: 库不可用')
                self.send_json_response(400, {
                    'error': 'pyJianYingDraft 库未安装',
                    'message': '请先安装 pyJianYingDraft 库'
                })
                return
            
            print(f'[JianYing] 库可用，继续处理请求')

            # 提取数据
            project_name = request_data.get('projectName', f'SmartClip_{uuid.uuid4().hex[:8]}')
            width = request_data.get('width', 1920)
            height = request_data.get('height', 1080)
            fps = request_data.get('fps', 30)
            segments = request_data.get('segments', [])
            videos = request_data.get('videos', [])
            custom_draft_path = request_data.get('draftPath', '')  # 新增：自定义草稿路径

            # 清理项目名称：移除特殊字符，限制长度
            safe_project_name = self._sanitize_filename(project_name)
            
            print(f'[JianYing] 生成工程: {project_name}')
            print(f'[JianYing] 安全名称: {safe_project_name}')
            print(f'[JianYing] 分辨率: {width}x{height}, FPS: {fps}')
            print(f'[JianYing] 分镜数: {len(segments)}, 视频数: {len(videos)}')
            
            # 确定草稿目录
            if custom_draft_path and custom_draft_path.strip():
                # 使用自定义路径
                draft_base_dir = Path(custom_draft_path.strip())
                print(f'[JianYing] 使用自定义草稿路径: {draft_base_dir}')
                if not draft_base_dir.exists():
                    print(f'[JianYing] 警告: 自定义路径不存在，尝试创建: {draft_base_dir}')
                    try:
                        draft_base_dir.mkdir(parents=True, exist_ok=True)
                    except Exception as e:
                        print(f'[JianYing] 创建自定义路径失败: {e}')
                        print(f'[JianYing] 回退到默认路径')
                        draft_base_dir = TEMP_DIR
            elif JIANYING_DRAFTS_DIR.exists():
                # 使用默认剪映草稿目录
                draft_base_dir = JIANYING_DRAFTS_DIR
                print(f'[JianYing] 使用默认剪映草稿目录: {draft_base_dir}')
            else:
                # 使用临时目录
                print(f'[JianYing] 警告: 剪映草稿目录不存在: {JIANYING_DRAFTS_DIR}')
                print(f'[JianYing] 将使用临时目录: {TEMP_DIR}')
                draft_base_dir = TEMP_DIR

            # 确保目标目录存在
            draft_base_dir.mkdir(parents=True, exist_ok=True)
            
            # 预先创建项目目录
            project_dir = draft_base_dir / safe_project_name
            if project_dir.exists():
                shutil.rmtree(project_dir)
            project_dir.mkdir(parents=True, exist_ok=True)
            print(f'[JianYing] 项目目录已创建: {project_dir}')

            # 创建剪映草稿（直接在目标目录中）
            try:
                draft_folder = draft.DraftFolder(str(draft_base_dir))
                script = draft_folder.create_draft(
                    safe_project_name,
                    width,
                    height,
                    fps,
                    allow_replace=True
                )
                print(f'[JianYing] 草稿创建成功')
            except Exception as e:
                print(f'[JianYing] 创建草稿失败: {e}')
                import traceback
                traceback.print_exc()
                raise

            # 添加轨道（视频轨道和音频轨道）
            script.add_track(draft.TrackType.video)
            script.add_track(draft.TrackType.audio)

            # 添加视频片段
            if videos and len(videos) > 0:
                print(f'[JianYing] 开始添加 {len(videos)} 个视频片段...')
                
                # 跟踪当前时间偏移，确保视频片段按顺序排列不重叠
                current_time_offset = 0.0
                
                for i, video_url in enumerate(videos):
                    try:
                        # 创建临时视频文件
                        temp_video_file = TEMP_DIR / f'temp_video_{i}_{uuid.uuid4().hex[:8]}.mp4'
                        print(f'[JianYing] [{i+1}/{len(videos)}] 下载视频: {video_url[:100]}...')
                        
                        # 下载或复制视频文件
                        try:
                            if video_url.startswith(f'http://{BASE_HOST}:{SERVICE_PORTS["VIDEO_SPLITTER"]}/segments/'):
                                # 这是来自视频分割服务的 URL，直接下载
                                print(f'[JianYing] 从视频分割服务下载: {video_url}')
                                
                                # 使用 requests 替代 urlretrieve，支持超时
                                import requests
                                response = requests.get(video_url, timeout=300)
                                response.raise_for_status()
                                
                                with open(temp_video_file, 'wb') as f:
                                    f.write(response.content)
                                    
                            elif video_url.startswith('http'):
                                # 直接下载 HTTP/HTTPS URL
                                print(f'[JianYing] 下载视频: {video_url}')
                                
                                import requests
                                response = requests.get(video_url, timeout=300)
                                response.raise_for_status()
                                
                                with open(temp_video_file, 'wb') as f:
                                    f.write(response.content)
                                    
                            else:
                                # 如果是本地路径，直接复制
                                print(f'[JianYing] 复制本地视频: {video_url}')
                                if os.path.exists(video_url):
                                    shutil.copy(video_url, str(temp_video_file))
                                else:
                                    raise Exception(f'本地视频文件不存在: {video_url}')
                        except Exception as download_error:
                            print(f'[JianYing] 下载失败: {download_error}')
                            raise

                        # 检查文件是否存在和有效
                        if not temp_video_file.exists():
                            raise Exception(f'视频文件不存在: {temp_video_file}')
                        
                        file_size = temp_video_file.stat().st_size
                        print(f'[JianYing] 视频文件大小: {file_size} bytes')
                        
                        if file_size < 1000:  # 小于1KB可能有问题
                            print(f'[JianYing] 警告: 视频文件很小，可能损坏')
                            continue  # 跳过这个视频
                        
                        # 验证视频文件是否有效（简化版本）
                        try:
                            # 简单检查：文件存在且大小合理
                            if file_size > 100000:  # 大于100KB认为是有效的
                                print(f'[JianYing] 视频文件验证通过: {file_size} bytes')
                            else:
                                print(f'[JianYing] 视频文件太小，跳过: {temp_video_file}')
                                continue
                                
                        except Exception as verify_error:
                            print(f'[JianYing] 视频验证失败: {verify_error}')
                            # 不跳过，继续尝试处理
                            print(f'[JianYing] 继续尝试处理视频文件...')

                        # 使用分镜的实际时长，并计算在时间轴上的正确位置
                        # pyJianYingDraft 需要的是在时间轴上的绝对位置
                        
                        # 使用简化的时间范围设置
                        # 由于分镜文件已经是按时间切分的，直接使用整个文件的长度
                        try:
                            # 尝试获取视频时长，如果失败就使用默认值
                            probe_cmd = [
                                'ffprobe', '-v', 'quiet', '-print_format', 'json', 
                                '-show_format', str(temp_video_file)
                            ]
                            probe_result = subprocess.run(probe_cmd, capture_output=True, text=True, timeout=10)
                            
                            if probe_result.returncode == 0:
                                probe_data = json.loads(probe_result.stdout)
                                actual_duration = float(probe_data['format']['duration'])
                                print(f'[JianYing] 视频实际时长: {actual_duration:.2f}秒')
                                
                                # 关键修复：使用当前时间偏移作为起始时间，避免重叠
                                start_time = current_time_offset
                                end_time = start_time + actual_duration
                                
                                # 重要：确保 time_range 的持续时间不超过视频实际时长
                                # 减去一个小的容差值（50毫秒）作为安全边界
                                safe_duration = max(0.1, actual_duration - 0.05)
                                time_range = trange(f'{start_time:.1f}s', f'{safe_duration:.2f}s')
                                
                                # 更新时间偏移为下一个片段做准备
                                current_time_offset = end_time
                                
                                print(f'[JianYing] 片段时间轴位置: {start_time:.1f}s - {end_time:.1f}s (安全时长: {safe_duration:.2f}s)')
                            else:
                                print(f'[JianYing] 无法获取视频时长，使用默认值')
                                default_duration = 10.0
                                start_time = current_time_offset
                                end_time = start_time + default_duration
                                time_range = trange(f'{start_time:.1f}s', f'{default_duration:.1f}s')
                                current_time_offset = end_time
                                print(f'[JianYing] 片段时间轴位置: {start_time:.1f}s - {end_time:.1f}s (默认时长: {default_duration:.1f}s)')
                                
                        except Exception as probe_error:
                            print(f'[JianYing] 探测视频时长失败: {probe_error}')
                            default_duration = 10.0
                            start_time = current_time_offset
                            end_time = start_time + default_duration
                            time_range = trange(f'{start_time:.1f}s', f'{default_duration:.1f}s')
                            current_time_offset = end_time
                            print(f'[JianYing] 片段时间轴位置: {start_time:.1f}s - {end_time:.1f}s (默认时长: {default_duration:.1f}s)')
                        
                        # 创建视频片段
                        print(f'[JianYing] 创建视频片段: {str(temp_video_file)}')
                        video_segment = draft.VideoSegment(
                            str(temp_video_file),
                            time_range
                        )
                        
                        # 添加到轨道
                        print(f'[JianYing] 添加视频片段到轨道...')
                        script.add_segment(video_segment)

                        print(f'[JianYing] ✅ 视频 {i+1} 添加成功')

                    except Exception as e:
                        print(f'[JianYing] ❌ 添加视频 {i+1} 失败: {e}')
                        import traceback
                        traceback.print_exc()
                        continue

                print(f'[JianYing] 所有视频添加完成')
            else:
                print(f'[JianYing] 没有视频文件，创建空的工程结构')
                
                # 即使没有视频，也要添加一些占位符内容
                # 这样用户打开工程时能看到分镜结构
                current_time_offset = 0.0
                for i, segment in enumerate(segments):
                    try:
                        # 创建文本片段作为占位符，使用顺序时间轴
                        placeholder_duration = 5.0
                        start_time = current_time_offset
                        end_time = start_time + placeholder_duration
                        time_range = trange(f'{start_time:.1f}s', f'{placeholder_duration:.1f}s')
                        current_time_offset = end_time
                        
                        # 添加文本注释（如果支持的话）
                        print(f'[JianYing] 添加分镜占位符 {i+1}: {segment.get("narrative_type", "segment")} (时间轴: {start_time:.1f}s - {end_time:.1f}s)')
                        
                        # 注意：这里我们不添加实际的片段，因为没有视频文件
                        # 但我们确保工程结构是完整的
                        
                    except Exception as e:
                        print(f'[JianYing] 添加占位符 {i+1} 失败: {e}')
                        continue

            # 保存草稿
            print(f'[JianYing] 保存草稿...')
            script.save()
            print(f'[JianYing] 草稿保存成功')

            # 打包为 ZIP 文件
            draft_zip = OUTPUT_DIR / f'{safe_project_name}.zip'
            work_dir = draft_base_dir / safe_project_name
            shutil.make_archive(
                str(draft_zip.with_suffix('')),
                'zip',
                str(draft_base_dir),
                safe_project_name
            )

            # 返回成功响应
            self.send_json_response(200, {
                'success': True,
                'projectName': safe_project_name,
                'draftFile': f'/output/{safe_project_name}.zip',
                'message': f'工程文件生成成功: {safe_project_name}'
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
            import urllib.parse
            
            # 提取文件名并进行 URL 解码
            encoded_filename = self.path.split('/output/')[-1]
            filename = urllib.parse.unquote(encoded_filename)
            
            print(f'[JianYing] 下载请求 - 编码文件名: {encoded_filename}')
            print(f'[JianYing] 下载请求 - 解码文件名: {filename}')
            
            file_path = OUTPUT_DIR / filename

            if not file_path.exists():
                # 如果文件不存在，尝试列出目录中的文件
                print(f'[JianYing] 文件不存在: {file_path}')
                print(f'[JianYing] 输出目录内容:')
                if OUTPUT_DIR.exists():
                    for f in OUTPUT_DIR.iterdir():
                        print(f'  - {f.name}')
                self.send_error(404, 'File not found')
                return

            # 读取文件
            with open(file_path, 'rb') as f:
                content = f.read()

            # 返回文件
            self.send_response(200)
            self.send_header('Content-Type', 'application/zip')
            self.send_header('Content-Length', str(len(content)))
            # 使用 RFC 5987 格式处理中文文件名
            self.send_header('Content-Disposition', f"attachment; filename*=UTF-8''{urllib.parse.quote(filename)}")
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(content)

            print(f'[JianYing] 下载成功: {filename} ({len(content)} bytes)')

        except Exception as e:
            print(f'[JianYing] 下载错误: {e}')
            import traceback
            traceback.print_exc()
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
    port = SERVICE_PORTS['JIANYING_EXPORT']
    server_address = ('', port)
    httpd = HTTPServer(server_address, JianYingDraftHandler)
    print(f'[JianYing] 剪映工程文件生成服务启动在 http://{BASE_HOST}:{port}')
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
