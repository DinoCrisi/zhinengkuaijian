#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AI API 代理服务器
解决浏览器 CORS 跨域问题
只保留视频分析所需的聊天代理功能
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import urllib.request
import urllib.error
import ssl
import socket
import os
import time
import urllib.parse
import sys

# ==================== 配置 ====================
# 获取项目根目录
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 导入全局配置
sys.path.insert(0, os.path.join(PROJECT_ROOT, 'server'))
from config import BASE_HOST, SERVICE_PORTS

def load_env():
    """手动加载 .env 文件，避免依赖 python-dotenv"""
    env_path = os.path.join(PROJECT_ROOT, '.env')
    if not os.path.exists(env_path):
        env_path = os.path.join(PROJECT_ROOT, '.env.local')
    
    if os.path.exists(env_path):
        print(f"正在从 {env_path} 加载环境变量...")
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                if '=' in line:
                    key, value = line.split('=', 1)
                    key = key.strip()
                    value = value.strip().strip('"').strip("'")
                    if key and value:
                        os.environ[key] = value
                        # print(f"设置环境变量: {key}")

# 启动时加载
load_env()

class ProxyHandler(BaseHTTPRequestHandler):
    def _allowed_origins(self):
        env_val = os.environ.get('PROXY_ALLOWED_ORIGINS', '').strip()
        if not env_val:
            return {"http://127.0.0.1:5173", "http://localhost:5173", "http://127.0.0.1:8000", "http://localhost:8000"}
        return {o.strip() for o in env_val.split(',') if o.strip()}

    def _request_origin(self):
        return (self.headers.get('Origin') or '').strip()

    def _set_headers(self, status_code=200):
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        origin = self._request_origin()
        allowed = self._allowed_origins()
        if origin and origin in allowed:
            self.send_header('Access-Control-Allow-Origin', origin)
            self.send_header('Vary', 'Origin')
        else:
            self.send_header('Access-Control-Allow-Origin', 'http://127.0.0.1:5173')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Proxy-Token')
        self.end_headers()

    def do_OPTIONS(self):
        self._set_headers(200)

    def do_GET(self):
        if self.path == '/health':
            self.handle_health_check()
        else:
            self.send_json_response(404, {"error": "未找到路径"})

    def do_POST(self):
        if self.path == '/api/chat':
            self.handle_chat_request()
        else:
            self.send_json_response(404, {"error": "未找到路径"})

    def send_json_response(self, status_code, data):
        self._set_headers(status_code)
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))

    def handle_health_check(self):
        """处理健康检查请求"""
        self.send_json_response(200, {
            "status": "ok",
            "timestamp": time.time()
        })

    def handle_chat_request(self):
        """处理聊天请求"""
        try:
            max_bytes = int(os.environ.get('PROXY_MAX_BODY_BYTES', '26214400'))
            content_length = int(self.headers.get('Content-Length', '0'))
            if content_length <= 0:
                self.send_json_response(400, {'error': '缺少请求体'})
                return
            if content_length > max_bytes:
                self.send_json_response(413, {'error': '请求体过大'})
                return

            token_required = (os.environ.get('PROXY_TOKEN') or '').strip()
            if token_required:
                incoming = (self.headers.get('X-Proxy-Token') or '').strip()
                if not incoming or incoming != token_required:
                    self.send_json_response(401, {'error': '未授权'})
                    return

            post_data = self.rfile.read(content_length)
            request_data = json.loads(post_data.decode('utf-8'))

            target = (request_data.get('target') or '').strip()
            request_body = request_data.get('body')
            http_method = (request_data.get('method') or 'POST').upper()
            path = (request_data.get('path') or '').strip()
            query = request_data.get('query') or {}

            allowed_targets = {
                'doubao_chat': {
                    'base_url': 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
                    'key_env': 'DOUBAO_CHAT_API_KEY'
                },
                'doubao_images': {
                    'base_url': 'https://ark.cn-beijing.volces.com/api/v3/images/generations',
                    'key_env': 'DOUBAO_IMAGE_API_KEY'
                },
                'doubao_video_tasks': {
                    'base_url': 'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks',
                    'key_env': 'DOUBAO_VIDEO_API_KEY'
                }
            }

            target_cfg = allowed_targets.get(target)
            if not target_cfg:
                self.send_json_response(400, {'error': '非法 target'})
                return

            api_key = (os.environ.get(target_cfg['key_env']) or os.environ.get('DOUBAO_API_KEY') or '').strip()
            if not api_key:
                self.send_json_response(500, {'error': '代理服务器未配置 API Key'})
                return

            if http_method not in ('GET', 'POST'):
                self.send_json_response(400, {'error': '非法 method'})
                return

            if http_method == 'POST' and request_body is None:
                self.send_json_response(400, {'error': '缺少 body'})
                return

            base_url = target_cfg['base_url']
            target_url = base_url
            if path:
                if '://' in path or path.startswith('//') or '..' in path or '\\' in path:
                    self.send_json_response(400, {'error': '非法 path'})
                    return
                if not path.startswith('/'):
                    path = '/' + path
                target_url = base_url.rstrip('/') + path

            if query and isinstance(query, dict):
                qs = urllib.parse.urlencode(query, doseq=True)
                if qs:
                    sep = '&' if ('?' in target_url) else '?'
                    target_url = target_url + sep + qs

            # 创建请求
            headers = {
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {api_key}',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json',
                'Connection': 'close'
            }
            
            # 根据 HTTP 方法决定是否包含 body
            if http_method == 'GET':
                req = urllib.request.Request(
                    target_url,
                    headers=headers,
                    method='GET'
                )
            else:
                req_data = json.dumps(request_body).encode('utf-8')
                req = urllib.request.Request(
                    target_url,
                    data=req_data,
                    headers=headers,
                    method='POST'
                )

            # 创建 SSL 上下文,禁用证书验证并设置协议
            context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
            context.check_hostname = False
            context.verify_mode = ssl.CERT_NONE
            context.minimum_version = ssl.TLSVersion.TLSv1_2
            context.maximum_version = ssl.TLSVersion.TLSv1_3

            # 发送请求（视频分析需要更长的超时时间，因为要处理大量图片帧）
            try:
                with urllib.request.urlopen(req, context=context, timeout=600) as response:
                    response_data = response.read()
                    response_json = json.loads(response_data.decode('utf-8'))
                    self.send_json_response(200, response_json)
            except urllib.error.HTTPError as e:
                error_body = e.read().decode('utf-8')
                try:
                    error_json = json.loads(error_body)
                except:
                    error_json = {'error': error_body}
                self.send_json_response(e.code, error_json)
            except urllib.error.URLError as e:
                error_msg = str(e.reason) if hasattr(e, 'reason') else str(e)
                print(f"网络错误详情: {error_msg}")
                self.send_json_response(500, {
                    'error': f'网络连接错误: {error_msg}',
                    'suggestion': '请检查: 1) API地址是否正确 2) 网络连接是否正常 3) 防火墙或代理设置'
                })
            except ssl.SSLError as e:
                print(f"SSL错误详情: {str(e)}")
                self.send_json_response(500, {
                    'error': f'SSL连接错误: {str(e)}',
                    'suggestion': '请检查: 1) API服务器是否可访问 2) 网络连接是否稳定 3) 尝试使用VPN或更换网络'
                })
            except socket.timeout:
                self.send_json_response(500, {
                    'error': '请求超时',
                    'suggestion': 'API响应过慢,请稍后重试或检查网络连接'
                })

        except Exception as e:
            print(f"错误: {str(e)}")
            self.send_json_response(500, {'error': str(e)})

    def log_message(self, format, *args):
        """自定义日志格式"""
        print(f"[{self.log_date_time_string()}] {format % args}")

def run_server(port=None):
    """运行代理服务器"""
    if port is None:
        port = SERVICE_PORTS['PROXY']
    server_address = ('', port)
    httpd = HTTPServer(server_address, ProxyHandler)
    print(f"=" * 60)
    print(f"  AI API 代理服务器 (视频分析版) 已启动")
    print(f"  监听端口: http://{BASE_HOST}:{port}")
    print(f"  代理地址: http://{BASE_HOST}:{port}/api/chat")
    print(f"=" * 60)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n服务器已停止")

if __name__ == '__main__':
    run_server()
