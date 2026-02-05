"""
MinIO 客户端封装
提供统一的文件存储接口
"""
from minio import Minio
from minio.error import S3Error
import io
import os
import json
from datetime import timedelta
from pathlib import Path
import logging
from typing import Optional, Dict, Any, BinaryIO
from minio_config import get_minio_config, is_minio_enabled

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class MinIOClient:
    """MinIO 客户端封装类"""
    
    def __init__(self):
        """初始化 MinIO 客户端"""
        self.config = get_minio_config()
        self.enabled = is_minio_enabled()
        
        if not self.enabled:
            logger.warning("MinIO 未启用，将使用本地文件系统")
            return
        
        try:
            self.client = Minio(
                self.config['endpoint'],
                access_key=self.config['access_key'],
                secret_key=self.config['secret_key'],
                secure=self.config['secure']
            )
            logger.info(f"MinIO 客户端初始化成功: {self.config['endpoint']}")
            
            # 确保必要的 bucket 存在
            self._ensure_buckets()
            
        except Exception as e:
            logger.error(f"MinIO 客户端初始化失败: {str(e)}")
            self.enabled = False
            raise
    
    def _ensure_buckets(self):
        """确保所有必要的 bucket 存在"""
        for bucket_name in self.config['buckets'].values():
            try:
                if not self.client.bucket_exists(bucket_name):
                    self.client.make_bucket(bucket_name)
                    logger.info(f"创建 bucket: {bucket_name}")
                    
                    # 设置 bucket 策略（允许公开读取）
                    policy = {
                        "Version": "2012-10-17",
                        "Statement": [
                            {
                                "Effect": "Allow",
                                "Principal": {"AWS": "*"},
                                "Action": ["s3:GetObject"],
                                "Resource": [f"arn:aws:s3:::{bucket_name}/*"]
                            }
                        ]
                    }
                    self.client.set_bucket_policy(bucket_name, json.dumps(policy))
                    
            except S3Error as e:
                logger.error(f"创建 bucket {bucket_name} 失败: {str(e)}")
    
    def upload_file(self, file_path: str, object_name: str, bucket_type: str = 'videos') -> Optional[str]:
        """
        上传文件到 MinIO
        
        Args:
            file_path: 本地文件路径
            object_name: MinIO 中的对象名称
            bucket_type: bucket 类型 ('videos', 'archive', 'temp')
        
        Returns:
            文件的访问 URL，失败返回 None
        """
        if not self.enabled:
            return None
        
        try:
            bucket_name = self.config['buckets'].get(bucket_type, self.config['buckets']['videos'])
            
            # 上传文件
            self.client.fput_object(
                bucket_name,
                object_name,
                file_path,
            )
            
            logger.info(f"文件上传成功: {bucket_name}/{object_name}")
            
            # 生成访问 URL
            url = self.get_presigned_url(object_name, bucket_type)
            return url
            
        except S3Error as e:
            logger.error(f"上传文件失败: {str(e)}")
            return None
    
    def upload_fileobj(self, file_obj: BinaryIO, object_name: str, 
                       length: int, bucket_type: str = 'videos',
                       content_type: str = 'application/octet-stream') -> Optional[str]:
        """
        上传文件对象到 MinIO
        
        Args:
            file_obj: 文件对象
            object_name: MinIO 中的对象名称
            length: 文件大小（字节）
            bucket_type: bucket 类型
            content_type: 文件 MIME 类型
        
        Returns:
            文件的访问 URL，失败返回 None
        """
        if not self.enabled:
            return None
        
        try:
            bucket_name = self.config['buckets'].get(bucket_type, self.config['buckets']['videos'])
            
            # 上传文件对象
            self.client.put_object(
                bucket_name,
                object_name,
                file_obj,
                length,
                content_type=content_type
            )
            
            logger.info(f"文件对象上传成功: {bucket_name}/{object_name}")
            
            # 生成访问 URL
            url = self.get_presigned_url(object_name, bucket_type)
            return url
            
        except S3Error as e:
            logger.error(f"上传文件对象失败: {str(e)}")
            return None
    
    def download_file(self, object_name: str, file_path: str, bucket_type: str = 'videos') -> bool:
        """
        从 MinIO 下载文件
        
        Args:
            object_name: MinIO 中的对象名称
            file_path: 本地保存路径
            bucket_type: bucket 类型
        
        Returns:
            是否成功
        """
        if not self.enabled:
            return False
        
        try:
            bucket_name = self.config['buckets'].get(bucket_type, self.config['buckets']['videos'])
            
            # 确保目录存在
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            
            # 下载文件
            self.client.fget_object(bucket_name, object_name, file_path)
            logger.info(f"文件下载成功: {bucket_name}/{object_name} -> {file_path}")
            return True
            
        except S3Error as e:
            logger.error(f"下载文件失败: {str(e)}")
            return False
    
    def get_object(self, object_name: str, bucket_type: str = 'videos') -> Optional[bytes]:
        """
        获取对象内容
        
        Args:
            object_name: MinIO 中的对象名称
            bucket_type: bucket 类型
        
        Returns:
            文件内容（字节），失败返回 None
        """
        if not self.enabled:
            return None
        
        try:
            bucket_name = self.config['buckets'].get(bucket_type, self.config['buckets']['videos'])
            
            response = self.client.get_object(bucket_name, object_name)
            data = response.read()
            response.close()
            response.release_conn()
            
            return data
            
        except S3Error as e:
            logger.error(f"获取对象失败: {str(e)}")
            return None
    
    def delete_object(self, object_name: str, bucket_type: str = 'videos') -> bool:
        """
        删除对象
        
        Args:
            object_name: MinIO 中的对象名称
            bucket_type: bucket 类型
        
        Returns:
            是否成功
        """
        if not self.enabled:
            return False
        
        try:
            bucket_name = self.config['buckets'].get(bucket_type, self.config['buckets']['videos'])
            self.client.remove_object(bucket_name, object_name)
            logger.info(f"对象删除成功: {bucket_name}/{object_name}")
            return True
            
        except S3Error as e:
            logger.error(f"删除对象失败: {str(e)}")
            return False
    
    def move_object(self, object_name: str, from_bucket: str, to_bucket: str) -> bool:
        """
        移动对象（从一个 bucket 到另一个）
        
        Args:
            object_name: 对象名称
            from_bucket: 源 bucket 类型
            to_bucket: 目标 bucket 类型
        
        Returns:
            是否成功
        """
        if not self.enabled:
            return False
        
        try:
            from_bucket_name = self.config['buckets'].get(from_bucket)
            to_bucket_name = self.config['buckets'].get(to_bucket)
            
            # 复制对象
            from minio.commonconfig import CopySource
            self.client.copy_object(
                to_bucket_name,
                object_name,
                CopySource(from_bucket_name, object_name)
            )
            
            # 删除原对象
            self.client.remove_object(from_bucket_name, object_name)
            
            logger.info(f"对象移动成功: {from_bucket_name}/{object_name} -> {to_bucket_name}/{object_name}")
            return True
            
        except S3Error as e:
            logger.error(f"移动对象失败: {str(e)}")
            return False
    
    def get_presigned_url(self, object_name: str, bucket_type: str = 'videos', 
                          expiry: Optional[int] = None) -> str:
        """
        获取预签名 URL
        
        Args:
            object_name: 对象名称
            bucket_type: bucket 类型
            expiry: 过期时间（秒），默认使用配置中的值
        
        Returns:
            预签名 URL
        """
        if not self.enabled:
            return ""
        
        try:
            bucket_name = self.config['buckets'].get(bucket_type, self.config['buckets']['videos'])
            expiry_seconds = expiry or self.config['presigned_url_expiry']
            
            url = self.client.presigned_get_object(
                bucket_name,
                object_name,
                expires=timedelta(seconds=expiry_seconds)
            )
            
            return url
            
        except S3Error as e:
            logger.error(f"生成预签名 URL 失败: {str(e)}")
            return ""
    
    def list_objects(self, prefix: str = "", bucket_type: str = 'videos') -> list:
        """
        列出对象
        
        Args:
            prefix: 对象名称前缀
            bucket_type: bucket 类型
        
        Returns:
            对象列表
        """
        if not self.enabled:
            return []
        
        try:
            bucket_name = self.config['buckets'].get(bucket_type, self.config['buckets']['videos'])
            objects = self.client.list_objects(bucket_name, prefix=prefix, recursive=True)
            
            result = []
            for obj in objects:
                result.append({
                    'name': obj.object_name,
                    'size': obj.size,
                    'last_modified': obj.last_modified,
                    'etag': obj.etag
                })
            
            return result
            
        except S3Error as e:
            logger.error(f"列出对象失败: {str(e)}")
            return []
    
    def get_object_stat(self, object_name: str, bucket_type: str = 'videos') -> Optional[Dict[str, Any]]:
        """
        获取对象统计信息
        
        Args:
            object_name: 对象名称
            bucket_type: bucket 类型
        
        Returns:
            对象信息字典
        """
        if not self.enabled:
            return None
        
        try:
            bucket_name = self.config['buckets'].get(bucket_type, self.config['buckets']['videos'])
            stat = self.client.stat_object(bucket_name, object_name)
            
            return {
                'size': stat.size,
                'last_modified': stat.last_modified,
                'etag': stat.etag,
                'content_type': stat.content_type
            }
            
        except S3Error as e:
            logger.error(f"获取对象信息失败: {str(e)}")
            return None
    
    def object_exists(self, object_name: str, bucket_type: str = 'videos') -> bool:
        """
        检查对象是否存在
        
        Args:
            object_name: 对象名称
            bucket_type: bucket 类型
        
        Returns:
            是否存在
        """
        return self.get_object_stat(object_name, bucket_type) is not None


# 全局单例
_minio_client = None

def get_minio_client() -> MinIOClient:
    """获取 MinIO 客户端单例"""
    global _minio_client
    if _minio_client is None:
        _minio_client = MinIOClient()
    return _minio_client
