"""
视频存储服务
负责持久化存储视频文件到本地文件系统
"""

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
import json
import shutil
from datetime import datetime
from pathlib import Path
import requests
import cv2
import base64

app = Flask(__name__)
CORS(app)

# 存储目录配置
STORAGE_BASE_DIR = os.path.join(os.path.dirname(__file__), 'stored_videos')
THUMBNAILS_DIR = os.path.join(STORAGE_BASE_DIR, 'thumbnails')
ARCHIVE_DIR = os.path.join(STORAGE_BASE_DIR, 'archive')  # 归档目录，用于保护超出阈值的素材
METADATA_FILE = os.path.join(STORAGE_BASE_DIR, 'metadata.json')
CONFIG_FILE = os.path.join(os.path.dirname(__file__), 'storage_config.json')

# 加载存储配置
def load_storage_config():
    """加载存储配置"""
    default_config = {
        'max_active_videos': 5000,
        'max_total_size_gb': 500,
        'archive_enabled': True,
        'auto_archive_threshold_percent': 95
    }
    
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                config = json.load(f)
                return {
                    'max_active_videos': config.get('max_active_videos', default_config['max_active_videos']),
                    'max_total_size_gb': config.get('max_total_size_gb', default_config['max_total_size_gb']),
                    'archive_enabled': config.get('archive_enabled', default_config['archive_enabled']),
                    'auto_archive_threshold_percent': config.get('auto_archive_threshold_percent', default_config['auto_archive_threshold_percent'])
                }
        except Exception as e:
            print(f"加载配置文件失败，使用默认配置: {str(e)}")
            return default_config
    return default_config

# 加载配置
storage_config = load_storage_config()
MAX_ACTIVE_VIDEOS = storage_config['max_active_videos']
MAX_TOTAL_SIZE_GB = storage_config['max_total_size_gb']
ARCHIVE_ENABLED = storage_config['archive_enabled']
AUTO_ARCHIVE_THRESHOLD = storage_config['auto_archive_threshold_percent']

# 确保存储目录存在
os.makedirs(STORAGE_BASE_DIR, exist_ok=True)
os.makedirs(THUMBNAILS_DIR, exist_ok=True)
os.makedirs(ARCHIVE_DIR, exist_ok=True)

def load_metadata():
    """加载视频元数据"""
    if os.path.exists(METADATA_FILE):
        try:
            with open(METADATA_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            return {}
    return {}

def save_metadata(metadata):
    """保存视频元数据"""
    with open(METADATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, ensure_ascii=False, indent=2)

def get_storage_stats():
    """获取存储统计信息"""
    all_metadata = load_metadata()
    total_videos = len(all_metadata)
    
    # 计算总存储大小
    total_size = 0
    for video_id, video_info in all_metadata.items():
        filepath = video_info.get('filepath', '')
        if os.path.exists(filepath):
            total_size += os.path.getsize(filepath)
        
        # 计算缩略图大小
        thumbnail_path = video_info.get('thumbnail', '')
        if thumbnail_path:
            thumbnail_filename = os.path.basename(thumbnail_path.split('/')[-1])
            thumbnail_full_path = os.path.join(THUMBNAILS_DIR, thumbnail_filename)
            if os.path.exists(thumbnail_full_path):
                total_size += os.path.getsize(thumbnail_full_path)
    
    total_size_gb = total_size / (1024 ** 3)
    
    # 检查归档目录
    archived_count = 0
    if os.path.exists(ARCHIVE_DIR):
        archived_count = len([f for f in os.listdir(ARCHIVE_DIR) if f.endswith('.mp4')])
    
    return {
        'total_videos': total_videos,
        'total_size_bytes': total_size,
        'total_size_gb': round(total_size_gb, 2),
        'archived_videos': archived_count,
        'max_videos': MAX_ACTIVE_VIDEOS,
        'max_size_gb': MAX_TOTAL_SIZE_GB,
        'usage_percent': round((total_videos / MAX_ACTIVE_VIDEOS) * 100, 2),
        'size_usage_percent': round((total_size_gb / MAX_TOTAL_SIZE_GB) * 100, 2)
    }

def archive_old_videos(count_to_archive):
    """
    归档最旧的视频而不是删除
    将视频移动到archive目录，保留元数据标记为已归档
    """
    if not ARCHIVE_ENABLED:
        print("归档功能未启用")
        return 0
    
    all_metadata = load_metadata()
    
    # 按创建时间排序，找出最旧的视频
    sorted_videos = sorted(
        all_metadata.items(),
        key=lambda x: x[1].get('createdAt', ''),
    )
    
    archived_count = 0
    for video_id, video_info in sorted_videos[:count_to_archive]:
        try:
            filepath = video_info.get('filepath', '')
            filename = video_info.get('filename', '')
            
            if os.path.exists(filepath):
                # 移动视频文件到归档目录
                archive_path = os.path.join(ARCHIVE_DIR, filename)
                shutil.move(filepath, archive_path)
                
                # 移动缩略图
                thumbnail_url = video_info.get('thumbnail', '')
                if thumbnail_url:
                    thumbnail_filename = os.path.basename(thumbnail_url.split('/')[-1])
                    thumbnail_path = os.path.join(THUMBNAILS_DIR, thumbnail_filename)
                    if os.path.exists(thumbnail_path):
                        archive_thumbnail_path = os.path.join(ARCHIVE_DIR, thumbnail_filename)
                        shutil.move(thumbnail_path, archive_thumbnail_path)
                
                # 更新元数据标记为已归档
                all_metadata[video_id]['archived'] = True
                all_metadata[video_id]['archivedAt'] = datetime.now().isoformat()
                all_metadata[video_id]['archivePath'] = archive_path
                
                archived_count += 1
                print(f"已归档视频: {filename}")
        
        except Exception as e:
            print(f"归档视频失败 {video_id}: {str(e)}")
    
    if archived_count > 0:
        save_metadata(all_metadata)
        print(f"成功归档 {archived_count} 个视频到 {ARCHIVE_DIR}")
    
    return archived_count

def check_and_manage_storage():
    """
    检查存储使用情况，如果超出阈值则归档旧视频
    """
    stats = get_storage_stats()
    
    # 检查是否超出数量阈值
    if stats['total_videos'] > MAX_ACTIVE_VIDEOS:
        excess_count = stats['total_videos'] - MAX_ACTIVE_VIDEOS
        print(f"⚠️ 素材库视频数量 ({stats['total_videos']}) 超出阈值 ({MAX_ACTIVE_VIDEOS})")
        print(f"正在归档 {excess_count} 个最旧的视频...")
        archived = archive_old_videos(excess_count)
        print(f"✅ 已归档 {archived} 个视频，原素材已安全保存到归档目录")
        return True
    
    # 检查是否超出存储空间阈值
    if stats['total_size_gb'] > MAX_TOTAL_SIZE_GB:
        print(f"⚠️ 素材库存储空间 ({stats['total_size_gb']}GB) 超出阈值 ({MAX_TOTAL_SIZE_GB}GB)")
        # 归档10%的视频
        count_to_archive = max(10, int(stats['total_videos'] * 0.1))
        print(f"正在归档 {count_to_archive} 个最旧的视频...")
        archived = archive_old_videos(count_to_archive)
        print(f"✅ 已归档 {archived} 个视频，原素材已安全保存到归档目录")
        return True
    
    return False

def generate_thumbnail(video_path, output_path):
    """生成视频缩略图"""
    try:
        # 使用OpenCV读取视频
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
            
            # 保存缩略图
            cv2.imwrite(output_path, frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
            return True
        return False
    except Exception as e:
        print(f"生成缩略图失败: {str(e)}")
        return False

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
        filepath = os.path.join(STORAGE_BASE_DIR, filename)
        
        # 保存视频文件
        video_file.save(filepath)
        
        # 生成缩略图
        thumbnail_filename = f"{segment_id}_{timestamp}.jpg"
        thumbnail_path = os.path.join(THUMBNAILS_DIR, thumbnail_filename)
        thumbnail_url = ''
        if generate_thumbnail(filepath, thumbnail_path):
            thumbnail_url = f'http://127.0.0.1:8892/api/thumbnails/{thumbnail_filename}'
        
        # 保存元数据
        all_metadata = load_metadata()
        video_id = f"{segment_id}_{timestamp}"
        all_metadata[video_id] = {
            'id': video_id,
            'filename': filename,
            'filepath': filepath,
            'url': f'http://127.0.0.1:8892/api/videos/{filename}',
            'thumbnail': thumbnail_url,
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
                'url': f'http://127.0.0.1:8892/api/videos/{filename}',
                'thumbnail': thumbnail_url,
                'duration': 0,
                'createdAt': all_metadata[video_id]['createdAt']
            }
        })
    
    except Exception as e:
        print(f"存储视频失败: {str(e)}")
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
        filepath = os.path.join(STORAGE_BASE_DIR, filename)
        
        # 保存视频文件
        with open(filepath, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        
        # 生成缩略图
        thumbnail_filename = f"{segment_id}_{timestamp}.jpg"
        thumbnail_path = os.path.join(THUMBNAILS_DIR, thumbnail_filename)
        thumbnail_url = ''
        if generate_thumbnail(filepath, thumbnail_path):
            thumbnail_url = f'http://127.0.0.1:8892/api/thumbnails/{thumbnail_filename}'
        
        # 保存元数据
        all_metadata = load_metadata()
        video_id = f"{segment_id}_{timestamp}"
        all_metadata[video_id] = {
            'id': video_id,
            'filename': filename,
            'filepath': filepath,
            'url': f'http://127.0.0.1:8892/api/videos/{filename}',
            'thumbnail': thumbnail_url,
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
                'url': f'http://127.0.0.1:8892/api/videos/{filename}',
                'thumbnail': thumbnail_url,
                'duration': 0,
                'createdAt': all_metadata[video_id]['createdAt']
            }
        })
    
    except Exception as e:
        print(f"下载存储视频失败: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/videos/<filename>', methods=['GET'])
def serve_video(filename):
    """提供视频文件访问"""
    try:
        return send_from_directory(STORAGE_BASE_DIR, filename)
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 404

@app.route('/api/thumbnails/<filename>', methods=['GET'])
def serve_thumbnail(filename):
    """提供缩略图文件访问"""
    try:
        return send_from_directory(THUMBNAILS_DIR, filename)
    except Exception as e:
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

@app.route('/api/restore-video/<video_id>', methods=['POST'])
def restore_video(video_id):
    """从归档恢复视频到活跃素材库"""
    try:
        all_metadata = load_metadata()
        
        if video_id not in all_metadata:
            return jsonify({'success': False, 'message': '视频不存在'}), 404
        
        video_info = all_metadata[video_id]
        
        if not video_info.get('archived', False):
            return jsonify({'success': False, 'message': '视频未被归档'}), 400
        
        # 恢复视频文件
        archive_path = video_info.get('archivePath', '')
        if os.path.exists(archive_path):
            original_path = video_info.get('filepath', '')
            shutil.move(archive_path, original_path)
            
            # 恢复缩略图
            filename = video_info.get('filename', '')
            thumbnail_filename = filename.replace('.mp4', '.jpg')
            archive_thumbnail = os.path.join(ARCHIVE_DIR, thumbnail_filename)
            if os.path.exists(archive_thumbnail):
                thumbnail_path = os.path.join(THUMBNAILS_DIR, thumbnail_filename)
                shutil.move(archive_thumbnail, thumbnail_path)
            
            # 更新元数据
            video_info['archived'] = False
            video_info['restoredAt'] = datetime.now().isoformat()
            del video_info['archivePath']
            
            all_metadata[video_id] = video_info
            save_metadata(all_metadata)
            
            return jsonify({
                'success': True,
                'message': '视频已恢复到活跃素材库',
                'data': video_info
            })
        else:
            return jsonify({'success': False, 'message': '归档文件不存在'}), 404
    
    except Exception as e:
        print(f"恢复视频失败: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/delete-video/<video_id>', methods=['DELETE'])
def delete_video(video_id):
    """删除存储的视频"""
    try:
        all_metadata = load_metadata()
        
        if video_id not in all_metadata:
            return jsonify({'success': False, 'message': '视频不存在'}), 404
        
        # 删除文件
        filepath = all_metadata[video_id]['filepath']
        if os.path.exists(filepath):
            os.remove(filepath)
        
        # 删除元数据
        del all_metadata[video_id]
        save_metadata(all_metadata)
        
        return jsonify({'success': True})
    
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

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

@app.route('/api/storage-config', methods=['GET'])
def get_storage_config():
    """获取存储配置"""
    try:
        config = load_storage_config()
        return jsonify({
            'success': True,
            'data': config
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/storage-config', methods=['PUT'])
def update_storage_config():
    """更新存储配置"""
    try:
        new_config = request.json
        
        # 验证配置
        if 'max_active_videos' in new_config and new_config['max_active_videos'] < 100:
            return jsonify({'success': False, 'message': '最大视频数量不能小于100'}), 400
        
        if 'max_total_size_gb' in new_config and new_config['max_total_size_gb'] < 10:
            return jsonify({'success': False, 'message': '最大存储空间不能小于10GB'}), 400
        
        # 读取现有配置
        if os.path.exists(CONFIG_FILE):
            with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                config = json.load(f)
        else:
            config = {}
        
        # 更新配置
        if 'max_active_videos' in new_config:
            config['max_active_videos'] = new_config['max_active_videos']
        if 'max_total_size_gb' in new_config:
            config['max_total_size_gb'] = new_config['max_total_size_gb']
        if 'archive_enabled' in new_config:
            config['archive_enabled'] = new_config['archive_enabled']
        if 'auto_archive_threshold_percent' in new_config:
            config['auto_archive_threshold_percent'] = new_config['auto_archive_threshold_percent']
        
        # 保存配置
        with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(config, f, ensure_ascii=False, indent=2)
        
        return jsonify({
            'success': True,
            'message': '配置已更新，请重启服务使配置生效',
            'data': config
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
        'storage_dir': STORAGE_BASE_DIR,
        'video_count': stats['total_videos'],
        'archived_count': stats['archived_videos'],
        'storage_usage': f"{stats['total_size_gb']}GB / {MAX_TOTAL_SIZE_GB}GB",
        'archive_enabled': ARCHIVE_ENABLED
    })

if __name__ == '__main__':
    print(f"视频存储服务启动中...")
    print(f"存储目录: {STORAGE_BASE_DIR}")
    print(f"归档目录: {ARCHIVE_DIR}")
    print(f"配置文件: {CONFIG_FILE}")
    print(f"")
    print(f"存储配置:")
    print(f"  - 最大视频数量: {MAX_ACTIVE_VIDEOS}")
    print(f"  - 最大存储空间: {MAX_TOTAL_SIZE_GB}GB")
    print(f"  - 归档功能: {'启用' if ARCHIVE_ENABLED else '禁用'}")
    print(f"  - 自动归档阈值: {AUTO_ARCHIVE_THRESHOLD}%")
    print(f"")
    stats = get_storage_stats()
    print(f"当前状态:")
    print(f"  - 活跃视频数量: {stats['total_videos']}")
    print(f"  - 已归档视频: {stats['archived_videos']}")
    print(f"  - 存储空间使用: {stats['total_size_gb']}GB")
    print(f"  - 容量使用率: {stats['usage_percent']}%")
    print(f"")
    app.run(host='127.0.0.1', port=8892, debug=True)
