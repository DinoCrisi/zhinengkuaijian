"""
后端服务全局配置
与前端 config/apiConfig.ts 保持同步
"""

# 基础配置
BASE_HOST = '127.0.0.1'

# 服务端口配置
SERVICE_PORTS = {
    'PROXY': 8888,           # 代理服务（AI API 调用）
    'VIDEO_COMPOSER': 8889,  # 视频合成服务
    'JIANYING_EXPORT': 8890, # 剪映导出服务
    'VIDEO_SPLITTER': 8891,  # 视频分割服务
    'VIDEO_STORAGE': 8892,   # 视频存储服务（MinIO）
}

# 生成完整的服务 URL
def get_service_url(service_name: str) -> str:
    """获取服务的完整 URL"""
    port = SERVICE_PORTS.get(service_name)
    if not port:
        raise ValueError(f"未知的服务名称: {service_name}")
    return f"http://{BASE_HOST}:{port}"

# 导出常用的 URL
PROXY_URL = get_service_url('PROXY')
VIDEO_COMPOSER_URL = get_service_url('VIDEO_COMPOSER')
JIANYING_EXPORT_URL = get_service_url('JIANYING_EXPORT')
VIDEO_SPLITTER_URL = get_service_url('VIDEO_SPLITTER')
VIDEO_STORAGE_URL = get_service_url('VIDEO_STORAGE')

if __name__ == '__main__':
    print("=" * 60)
    print("后端服务配置:")
    print("=" * 60)
    print(f"  BASE_HOST: {BASE_HOST}")
    print(f"  代理服务: {PROXY_URL}")
    print(f"  视频合成: {VIDEO_COMPOSER_URL}")
    print(f"  剪映导出: {JIANYING_EXPORT_URL}")
    print(f"  视频分割: {VIDEO_SPLITTER_URL}")
    print(f"  视频存储: {VIDEO_STORAGE_URL}")
    print("=" * 60)
