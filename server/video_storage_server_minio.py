"""
视频存储服务 - MinIO 版本
支持将视频存储到 MinIO 对象存储
同时保持与原有 API 的兼容性
"""

from flask import Flask, request, jsonify, send_from_directory, Response
from flask_cors import CORS
import os
import sys
import json
import shutil
from datetime import datetime
from pathlib import Path
import requests
import cv2
import tempfile
import io
from minio_client import get_minio_client, MinIOClient
from minio_config import get_minio_config, get_metadata_config, get_storage_policy, is_minio_enabled

# 导入全局配置
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(PROJECT_ROOT, 'server'))
from config import BASE_HOST, SERVICE_PORTS

app = Flask(__name__)
CORS(app)

# 存储目录配置（本地备份）
STORAGE_BASE_DIR = os.path.join(os.path.dirname(__file__), 'stored_videos')
THUMBNAILS_DIR = os.path.join(STORAGE_BASE_DIR, 'thumbnails')
ARCHIVE_DIR = os.path.join(STORAGE_BASE_DIR, 'archive')
METADATA_FILE = os.path.join(STORAGE_BASE_DIR, 'metadata.json')

# 加载配置
storage_policy = get_storage_policy()
MAX_ACTIVE_VIDEOS = storage_policy['max_active_videos']
MAX_TOTAL_SIZE_GB = storage_policy['max_total_size_gb']
ARCHIVE_ENABLED = storage_policy['archive_enabled']
AUTO_ARCHIVE_THRESHOLD = storage_policy['auto_archive_threshold_percent']

# 确保本地目录存在（用于备份和临时文件）
os.makedirs(STORAGE_BASE_DIR, exist_ok=True)
os.makedirs(THUMBNAILS_DIR, exist_ok=True)
os.makedirs(ARCHIVE_DIR, exist_ok=True)

# 初始化 MinIO 客户端
try:
    minio_client = get_minio_client()
    MINIO_ENABLED = minio_client.enabled
except Exception as e:
    print(f"MinIO 初始化失败，将使用本地存储: {str(e)}")
    MINIO_ENABLED = False
    minio_client = None


def load_metadata():
    """加载视频元数据"""
    metadata_config = get_metadata_config()
    
    # 优先从本地加载
    if os.path.exists(METADATA_FILE):
        try:
            with open(METADATA_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            return {}
    
    # 如果启用了 MinIO，尝试从 MinIO 加载
    if MINIO_ENABLED and metadata_config['storage_type'] == 'minio':
        try:
            data = minio_client.get_object(
                metadata_config['minio_key'],
                metadata_config['minio_bucket']
            )
            if data:
                return json.loads(data.decode('utf-8'))
        except Exception as e:
            print(f"从 MinIO 加载元数据失败: {str(e)}")
    
    return {}


def save_metadata(metadata):
    """保存视频元数据"""
    # 保存到本地
    with open(METADATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, ensure_ascii=False, indent=2)
    
    # 如果启用了 MinIO，同步到 MinIO
    metadata_config = get_metadata_config()
    if MINIO_ENABLED and metadata_config['storage_type'] == 'minio':
        try:
            metadata_bytes = json.dumps(metadata, ensure_ascii=False, indent=2).encode('utf-8')
            metadata_io = io.BytesIO(metadata_bytes)
            minio_client.upload_fileobj(
                metadata_io,
                metadata_config['minio_key'],
                len(metadata_bytes),
                metadata_config['minio_bucket'],
                content_type='application/json'
            )
        except Exception as e:
            print(f"同步元数据到 MinIO 失败: {str(e)}")


def generate_thumbnail(video_source, output_path=None):
    """
    生成视频缩略图
    
    Args:
        video_source: 视频文件路径或 URL
        output_path: 输出路径（可选）
    
    Returns:
        缩略图字节数据或保存成功的布尔值
    """
    temp_video = None
    try:
        # 如果是 URL，先下载
        if video_source.startswith('http'):
            temp_video = tempfile.NamedTemporaryFile(delete=False, suffix='.mp4')
            response = requests.get(video_source, stream=True)
            for chunk in response.iter_content(chunk_size=8192):
                temp_video.write(chunk)
            temp_video.close()
            video_path = temp_video.name
        else:
            video_path = video_source
        
        # 使用 OpenCV 读取视频
        cap = cv2.VideoCapture(video_path)
        
        # 获取视频总帧数
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        # 跳到视频的1秒处或中间位置
        fps = cap.get(cv2.CAP_PROP_FPS)
        target_frame = min(int(fps * 1), total_frames // 2) if fps > 0 else total_frames // 2
        cap.set(cv2.CAP_PROP_POS_FRAMES, target_frame)
        
        # 读取帧
        ret, frame = cap.read()
        cap.release()
        
        if ret:
            # 调整大小为合适的缩略图尺寸
            height, width = frame.shape[:2]
            max_width = 640
            if width > max_width:
                scale = max_width / width
                new_width = max_width
                new_height = int(height * scale)
                frame = cv2.resize(frame, (new_width, new_height))
            
            # 如果指定了输出路径，保存到文件
            if output_path:
                cv2.imwrite(output_path, frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
                return True
            else:
                # 否则返回字节数据
                success, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
                if success:
                    return buffer.tobytes()
        
        return None if output_path is None else False
        
    except Exception as e:
        print(f"生成缩略图失败: {str(e)}")
        return None if output_path is None else False
    finally:
        # 清理临时文件
        if temp_video and os.path.exists(temp_video.name):
            os.unlink(temp_video.name)


@app.route('/api/store-video', methods=['POST'])
def store_video():
    """存储上传的视频文件"""
    try:
        if 'video' not in request.files:
            return jsonify({'success': False, 'message': '没有上传视频文件'}), 400
        
        video_file = request.files['video']
        metadata_str = request.form.get('metadata', '{}')
        metadata = json.loads(metadata_str)
        
        # 生成唯一文件名
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S_%f')
        segment_id = metadata.get('segmentId', 'unknown')
        filename = f"{segment_id}_{timestamp}.mp4"
        thumbnail_filename = f"{segment_id}_{timestamp}.jpg"
        
        video_url = ''
        thumbnail_url = ''
        
        if MINIO_ENABLED:
            # 上传到 MinIO
            # 1. 上传视频
            video_file.seek(0)
            video_data = video_file.read()
            video_io = io.BytesIO(video_data)
            
            object_name = f"videos/{filename}"
            video_url = minio_client.upload_fileobj(
                video_io,
                object_name,
                len(video_data),
                'videos',
                content_type='video/mp4'
            )
            
            # 2. 生成并上传缩略图
            video_io.seek(0)
            temp_video = tempfile.NamedTemporaryFile(delete=False, suffix='.mp4')
            temp_video.write(video_data)
            temp_video.close()
            
            thumbnail_data = generate_thumbnail(temp_video.name)
            if thumbnail_data:
                thumbnail_io = io.BytesIO(thumbnail_data)
                thumbnail_object_name = f"thumbnails/{thumbnail_filename}"
                thumbnail_url = minio_client.upload_fileobj(
                    thumbnail_io,
                    thumbnail_object_name,
                    len(thumbnail_data),
                    'videos',
                    content_type='image/jpeg'
                )
            
            os.unlink(temp_video.name)
            
        else:
            # 保存到本地文件系统
            filepath = os.path.join(STORAGE_BASE_DIR, filename)
            video_file.save(filepath)
            video_url = f'http://{BASE_HOST}:{SERVICE_PORTS["VIDEO_STORAGE"]}/api/videos/{filename}'
            
            # 生成缩略图
            thumbnail_path = os.path.join(THUMBNAILS_DIR, thumbnail_filename)
            if generate_thumbnail(filepath, thumbnail_path):
                thumbnail_url = f'http://{BASE_HOST}:{SERVICE_PORTS["VIDEO_STORAGE"]}/api/thumbnails/{thumbnail_filename}'
        
        # 保存元数据
        all_metadata = load_metadata()
        video_id = f"{segment_id}_{timestamp}"
        all_metadata[video_id] = {
            'id': video_id,
            'filename': filename,
            'storage_type': 'minio' if MINIO_ENABLED else 'local',
            'minio_object': f"videos/{filename}" if MINIO_ENABLED else None,
            'url': video_url,
            'thumbnail': thumbnail_url,
            'thumbnail_object': f"thumbnails/{thumbnail_filename}" if MINIO_ENABLED else None,
            'mainTag': metadata.get('mainTag', ''),
            'voiceoverText': metadata.get('voiceoverText', ''),
            'visualPrompt': metadata.get('visualPrompt', ''),
            'createdAt': datetime.now().isoformat()
        }
        save_metadata(all_metadata)
        
        # 检查并管理存储空间
        check_and_manage_storage()
        
        return jsonify({
            'success': True,
            'data': {
                'id': video_id,
                'filename': filename,
                'url': video_url,
                'thumbnail': thumbnail_url,
                'storage_type': 'minio' if MINIO_ENABLED else 'local',
                'duration': 0,
                'createdAt': all_metadata[video_id]['createdAt']
            }
        })
    
    except Exception as e:
        print(f"存储视频失败: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/download-and-store', methods=['POST'])
def download_and_store():
    """从URL下载视频并存储"""
    try:
        data = request.json
        video_url = data.get('videoUrl')
        metadata = data.get('metadata', {})
        
        if not video_url:
            return jsonify({'success': False, 'message': '缺少视频URL'}), 400
        
        # 下载视频
        response = requests.get(video_url, stream=True, timeout=60)
        if response.status_code != 200:
            return jsonify({'success': False, 'message': f'下载视频失败: {response.status_code}'}), 500
        
        # 生成唯一文件名
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S_%f')
        segment_id = metadata.get('segmentId', 'unknown')
        filename = f"{segment_id}_{timestamp}.mp4"
        thumbnail_filename = f"{segment_id}_{timestamp}.jpg"
        
        stored_video_url = ''
        thumbnail_url = ''
        
        if MINIO_ENABLED:
            # 下载到内存
            video_data = response.content
            video_io = io.BytesIO(video_data)
            
            # 上传到 MinIO
            object_name = f"videos/{filename}"
            stored_video_url = minio_client.upload_fileobj(
                video_io,
                object_name,
                len(video_data),
                'videos',
                content_type='video/mp4'
            )
            
            # 生成并上传缩略图
            thumbnail_data = generate_thumbnail(video_url)
            if thumbnail_data:
                thumbnail_io = io.BytesIO(thumbnail_data)
                thumbnail_object_name = f"thumbnails/{thumbnail_filename}"
                thumbnail_url = minio_client.upload_fileobj(
                    thumbnail_io,
                    thumbnail_object_name,
                    len(thumbnail_data),
                    'videos',
                    content_type='image/jpeg'
                )
        else:
            # 保存到本地文件系统
            filepath = os.path.join(STORAGE_BASE_DIR, filename)
            with open(filepath, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            
            stored_video_url = f'http://{BASE_HOST}:{SERVICE_PORTS["VIDEO_STORAGE"]}/api/videos/{filename}'
            
            # 生成缩略图
            thumbnail_path = os.path.join(THUMBNAILS_DIR, thumbnail_filename)
            if generate_thumbnail(filepath, thumbnail_path):
                thumbnail_url = f'http://{BASE_HOST}:{SERVICE_PORTS["VIDEO_STORAGE"]}/api/thumbnails/{thumbnail_filename}'
        
        # 保存元数据
        all_metadata = load_metadata()
        video_id = f"{segment_id}_{timestamp}"
        all_metadata[video_id] = {
            'id': video_id,
            'filename': filename,
            'storage_type': 'minio' if MINIO_ENABLED else 'local',
            'minio_object': f"videos/{filename}" if MINIO_ENABLED else None,
            'url': stored_video_url,
            'thumbnail': thumbnail_url,
            'thumbnail_object': f"thumbnails/{thumbnail_filename}" if MINIO_ENABLED else None,
            'mainTag': metadata.get('mainTag', ''),
            'voiceoverText': metadata.get('voiceoverText', ''),
            'visualPrompt': metadata.get('visualPrompt', ''),
            'sourceUrl': video_url,
            'createdAt': datetime.now().isoformat()
        }
        save_metadata(all_metadata)
        
        # 检查并管理存储空间
        check_and_manage_storage()
        
        return jsonify({
            'success': True,
            'data': {
                'id': video_id,
                'filename': filename,
                'url': stored_video_url,
                'thumbnail': thumbnail_url,
                'storage_type': 'minio' if MINIO_ENABLED else 'local',
                'duration': 0,
                'createdAt': all_metadata[video_id]['createdAt']
            }
        })
    
    except Exception as e:
        print(f"下载存储视频失败: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/videos/<filename>', methods=['GET'])
def serve_video(filename):
    """提供视频文件访问"""
    try:
        # 先检查元数据
        all_metadata = load_metadata()
        video_info = None
        for vid, info in all_metadata.items():
            if info.get('filename') == filename:
                video_info = info
                break
        
        if video_info and video_info.get('storage_type') == 'minio' and MINIO_ENABLED:
            # 从 MinIO 获取预签名 URL 并重定向
            object_name = video_info.get('minio_object', f"videos/{filename}")
            presigned_url = minio_client.get_presigned_url(object_name, 'videos')
            
            if presigned_url:
                from flask import redirect
                return redirect(presigned_url)
        
        # 否则从本地文件系统提供
        return send_from_directory(STORAGE_BASE_DIR, filename)
    
    except Exception as e:
        print(f"提供视频失败: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 404


@app.route('/api/thumbnails/<filename>', methods=['GET'])
def serve_thumbnail(filename):
    """提供缩略图文件访问"""
    try:
        # 先检查元数据
        all_metadata = load_metadata()
        video_info = None
        for vid, info in all_metadata.items():
            thumbnail_url = info.get('thumbnail', '')
            if filename in thumbnail_url:
                video_info = info
                break
        
        if video_info and video_info.get('storage_type') == 'minio' and MINIO_ENABLED:
            # 从 MinIO 获取预签名 URL 并重定向
            object_name = video_info.get('thumbnail_object', f"thumbnails/{filename}")
            presigned_url = minio_client.get_presigned_url(object_name, 'videos')
            
            if presigned_url:
                from flask import redirect
                return redirect(presigned_url)
        
        # 否则从本地文件系统提供
        return send_from_directory(THUMBNAILS_DIR, filename)
    
    except Exception as e:
        print(f"提供缩略图失败: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 404


@app.route('/api/list-videos', methods=['GET'])
def list_videos():
    """获取所有已存储的视频列表（不包括已归档的）"""
    try:
        all_metadata = load_metadata()
        # 只返回未归档的视频
        active_videos = [v for v in all_metadata.values() if not v.get('archived', False)]
        return jsonify({
            'success': True,
            'data': active_videos
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/list-archived-videos', methods=['GET'])
def list_archived_videos():
    """获取所有已归档的视频列表"""
    try:
        all_metadata = load_metadata()
        # 只返回已归档的视频
        archived_videos = [v for v in all_metadata.values() if v.get('archived', False)]
        return jsonify({
            'success': True,
            'data': archived_videos
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/delete-video/<video_id>', methods=['DELETE'])
def delete_video(video_id):
    """删除存储的视频"""
    try:
        all_metadata = load_metadata()
        
        if video_id not in all_metadata:
            return jsonify({'success': False, 'message': '视频不存在'}), 404
        
        video_info = all_metadata[video_id]
        
        # 删除文件
        if video_info.get('storage_type') == 'minio' and MINIO_ENABLED:
            # 从 MinIO 删除
            if video_info.get('minio_object'):
                minio_client.delete_object(video_info['minio_object'], 'videos')
            if video_info.get('thumbnail_object'):
                minio_client.delete_object(video_info['thumbnail_object'], 'videos')
        else:
            # 从本地删除
            filepath = video_info.get('filepath', os.path.join(STORAGE_BASE_DIR, video_info['filename']))
            if os.path.exists(filepath):
                os.remove(filepath)
        
        # 删除元数据
        del all_metadata[video_id]
        save_metadata(all_metadata)
        
        return jsonify({'success': True})
    
    except Exception as e:
        print(f"删除视频失败: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500


def get_storage_stats():
    """获取存储统计信息"""
    all_metadata = load_metadata()
    total_videos = len([v for v in all_metadata.values() if not v.get('archived', False)])
    archived_videos = len([v for v in all_metadata.values() if v.get('archived', False)])
    
    # 计算总存储大小（简化版，实际应该查询 MinIO）
    total_size = 0
    if MINIO_ENABLED:
        # 从 MinIO 获取统计
        try:
            objects = minio_client.list_objects('', 'videos')
            for obj in objects:
                total_size += obj.get('size', 0)
        except:
            pass
    else:
        # 从本地文件系统计算
        for video_id, video_info in all_metadata.items():
            if not video_info.get('archived', False):
                filepath = video_info.get('filepath', os.path.join(STORAGE_BASE_DIR, video_info['filename']))
                if os.path.exists(filepath):
                    total_size += os.path.getsize(filepath)
    
    total_size_gb = total_size / (1024 ** 3)
    
    return {
        'total_videos': total_videos,
        'total_size_bytes': total_size,
        'total_size_gb': round(total_size_gb, 2),
        'archived_videos': archived_videos,
        'max_videos': MAX_ACTIVE_VIDEOS,
        'max_size_gb': MAX_TOTAL_SIZE_GB,
        'usage_percent': round((total_videos / MAX_ACTIVE_VIDEOS) * 100, 2) if MAX_ACTIVE_VIDEOS > 0 else 0,
        'size_usage_percent': round((total_size_gb / MAX_TOTAL_SIZE_GB) * 100, 2) if MAX_TOTAL_SIZE_GB > 0 else 0,
        'storage_backend': 'minio' if MINIO_ENABLED else 'local'
    }


def check_and_manage_storage():
    """检查存储使用情况，如果超出阈值则归档旧视频"""
    if not ARCHIVE_ENABLED:
        return False
    
    stats = get_storage_stats()
    
    # 检查是否超出数量阈值
    if stats['total_videos'] > MAX_ACTIVE_VIDEOS:
        excess_count = stats['total_videos'] - MAX_ACTIVE_VIDEOS
        print(f"⚠️ 素材库视频数量 ({stats['total_videos']}) 超出阈值 ({MAX_ACTIVE_VIDEOS})")
        print(f"正在归档 {excess_count} 个最旧的视频...")
        # TODO: 实现归档逻辑
        return True
    
    return False


@app.route('/api/storage-stats', methods=['GET'])
def storage_stats():
    """获取存储统计信息"""
    try:
        stats = get_storage_stats()
        return jsonify({
            'success': True,
            'data': stats
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/health', methods=['GET'])
def health_check():
    """健康检查"""
    stats = get_storage_stats()
    return jsonify({
        'success': True,
        'message': '视频存储服务运行正常',
        'storage_backend': 'minio' if MINIO_ENABLED else 'local',
        'minio_enabled': MINIO_ENABLED,
        'video_count': stats['total_videos'],
        'archived_count': stats['archived_videos'],
        'storage_usage': f"{stats['total_size_gb']}GB / {MAX_TOTAL_SIZE_GB}GB"
    })


if __name__ == '__main__':
    print(f"视频存储服务启动中...")
    print(f"存储后端: {'MinIO' if MINIO_ENABLED else '本地文件系统'}")
    if MINIO_ENABLED:
        config = get_minio_config()
        print(f"MinIO 端点: {config['endpoint']}")
        print(f"Buckets: {config['buckets']}")
    else:
        print(f"本地存储目录: {STORAGE_BASE_DIR}")
    
    print(f"")
    print(f"存储配置:")
    print(f"  - 最大视频数量: {MAX_ACTIVE_VIDEOS}")
    print(f"  - 最大存储空间: {MAX_TOTAL_SIZE_GB}GB")
    print(f"  - 归档功能: {'启用' if ARCHIVE_ENABLED else '禁用'}")
    print(f"")
    
    stats = get_storage_stats()
    print(f"当前状态:")
    print(f"  - 活跃视频数量: {stats['total_videos']}")
    print(f"  - 已归档视频: {stats['archived_videos']}")
    print(f"  - 存储空间使用: {stats['total_size_gb']}GB")
    print(f"  - 容量使用率: {stats['usage_percent']}%")
    print(f"")
    
    port = SERVICE_PORTS['VIDEO_STORAGE']
    app.run(host='', port=port, debug=True)
