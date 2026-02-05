"""
MinIO 配置文件
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# 加载 .env 文件
env_path = os.path.join(os.path.dirname(__file__), '.env')
if os.path.exists(env_path):
    load_dotenv(env_path)
    print(f"✅ 已加载配置文件: {env_path}")
else:
    print(f"⚠️  未找到 .env 文件，使用默认配置")

# MinIO 服务器配置
MINIO_CONFIG = {
    # MinIO 服务器地址（不要包含 http:// 或 https://）
    'endpoint': os.getenv('MINIO_ENDPOINT', 'localhost:9000').replace('http://', '').replace('https://', ''),
    
    # 访问凭证
    'access_key': os.getenv('MINIO_ACCESS_KEY', 'minioadmin'),
    'secret_key': os.getenv('MINIO_SECRET_KEY', 'minioadmin'),
    
    # 是否使用 HTTPS
    'secure': os.getenv('MINIO_SECURE', 'false').lower() == 'true',
    
    # Bucket 配置
    'buckets': {
        'videos': 'smartclip-videos',      # 活跃素材库（所有视频和缩略图都存这里）
    },
    
    # 预签名 URL 过期时间（秒）
    'presigned_url_expiry': 7 * 24 * 3600,  # 7天
    
    # 是否启用 MinIO（可以通过环境变量控制）
    'enabled': os.getenv('MINIO_ENABLED', 'true').lower() == 'true',
    
    # 本地备份目录（可选，用于灾备）
    'local_backup_dir': os.path.join(os.path.dirname(__file__), 'stored_videos_backup')
}

# 元数据存储配置
METADATA_CONFIG = {
    # 元数据存储方式: 'local' 或 'minio'
    'storage_type': os.getenv('METADATA_STORAGE', 'local'),
    
    # 本地元数据文件路径
    'local_path': os.path.join(os.path.dirname(__file__), 'stored_videos', 'metadata.json'),
    
    # MinIO 中的元数据路径
    'minio_bucket': 'smartclip-videos',
    'minio_key': 'metadata/metadata.json'
}

# 存储策略配置
STORAGE_POLICY = {
    # 最大活跃视频数量
    'max_active_videos': 5000,
    
    # 最大存储空间（GB）
    'max_total_size_gb': 500,
    
    # 是否启用自动归档
    'archive_enabled': True,
    
    # 自动归档阈值（百分比）
    'auto_archive_threshold_percent': 95,
    
    # 是否启用本地缓存
    'enable_local_cache': False,
    
    # 本地缓存目录
    'local_cache_dir': os.path.join(os.path.dirname(__file__), 'video_cache'),
    
    # 缓存大小限制（GB）
    'cache_size_limit_gb': 50
}

def get_minio_config():
    """获取 MinIO 配置"""
    return MINIO_CONFIG

def get_metadata_config():
    """获取元数据配置"""
    return METADATA_CONFIG

def get_storage_policy():
    """获取存储策略配置"""
    return STORAGE_POLICY

def is_minio_enabled():
    """检查 MinIO 是否启用"""
    return MINIO_CONFIG['enabled']
