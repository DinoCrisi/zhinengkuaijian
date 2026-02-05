"""
将现有本地视频迁移到 MinIO
"""
import os
import json
from minio_client import get_minio_client
from pathlib import Path
import sys

def migrate_videos(dry_run=False):
    """
    迁移视频到 MinIO
    
    Args:
        dry_run: 如果为 True，只显示将要迁移的文件，不实际迁移
    """
    # 加载元数据
    metadata_file = 'stored_videos/metadata.json'
    if not os.path.exists(metadata_file):
        print("❌ 没有找到元数据文件")
        return
    
    with open(metadata_file, 'r', encoding='utf-8') as f:
        metadata = json.load(f)
    
    total_videos = len(metadata)
    already_migrated = sum(1 for v in metadata.values() if v.get('storage_type') == 'minio')
    to_migrate = total_videos - already_migrated
    
    print(f"📊 迁移统计:")
    print(f"  总视频数: {total_videos}")
    print(f"  已迁移: {already_migrated}")
    print(f"  待迁移: {to_migrate}")
    print(f"")
    
    if to_migrate == 0:
        print("✅ 所有视频已迁移到 MinIO")
        return
    
    if dry_run:
        print("🔍 预览模式 - 将要迁移的文件:")
        for video_id, video_info in metadata.items():
            if video_info.get('storage_type') != 'minio':
                filename = video_info.get('filename')
                filepath = video_info.get('filepath', f"stored_videos/{filename}")
                if os.path.exists(filepath):
                    size_mb = os.path.getsize(filepath) / (1024 * 1024)
                    print(f"  - {filename} ({size_mb:.2f} MB)")
        print(f"\n运行 'python migrate_to_minio.py --execute' 开始实际迁移")
        return
    
    # 初始化 MinIO 客户端
    try:
        minio_client = get_minio_client()
        if not minio_client.enabled:
            print("❌ MinIO 未启用，请检查配置")
            return
    except Exception as e:
        print(f"❌ MinIO 客户端初始化失败: {str(e)}")
        return
    
    # 迁移每个视频
    migrated = 0
    failed = 0
    skipped = 0
    
    print(f"🚀 开始迁移...")
    print(f"")
    
    for idx, (video_id, video_info) in enumerate(metadata.items(), 1):
        if video_info.get('storage_type') == 'minio':
            skipped += 1
            continue
        
        filename = video_info.get('filename')
        filepath = video_info.get('filepath', f"stored_videos/{filename}")
        
        print(f"[{idx}/{total_videos}] 处理: {filename}")
        
        if not os.path.exists(filepath):
            print(f"  ⚠️  文件不存在: {filepath}")
            failed += 1
            continue
        
        try:
            # 上传视频
            object_name = f"videos/{filename}"
            print(f"  📤 上传视频...")
            url = minio_client.upload_file(filepath, object_name, 'videos')
            
            if url:
                # 更新元数据
                video_info['storage_type'] = 'minio'
                video_info['minio_object'] = object_name
                video_info['url'] = url
                
                # 迁移缩略图
                thumbnail_filename = filename.replace('.mp4', '.jpg')
                thumbnail_path = f"stored_videos/thumbnails/{thumbnail_filename}"
                if os.path.exists(thumbnail_path):
                    print(f"  📤 上传缩略图...")
                    thumbnail_object = f"thumbnails/{thumbnail_filename}"
                    thumbnail_url = minio_client.upload_file(
                        thumbnail_path, 
                        thumbnail_object, 
                        'videos'
                    )
                    if thumbnail_url:
                        video_info['thumbnail'] = thumbnail_url
                        video_info['thumbnail_object'] = thumbnail_object
                
                migrated += 1
                print(f"  ✅ 迁移成功")
            else:
                failed += 1
                print(f"  ❌ 上传失败")
        
        except Exception as e:
            failed += 1
            print(f"  ❌ 迁移失败: {str(e)}")
        
        print(f"")
    
    # 保存更新后的元数据
    print(f"💾 保存元数据...")
    with open(metadata_file, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, ensure_ascii=False, indent=2)
    
    print(f"")
    print(f"✨ 迁移完成:")
    print(f"  ✅ 成功: {migrated}")
    print(f"  ❌ 失败: {failed}")
    print(f"  ⏭️  跳过: {skipped}")
    print(f"  📊 总计: {total_videos}")
    print(f"")
    
    if failed > 0:
        print(f"⚠️  有 {failed} 个文件迁移失败，请检查日志")
    else:
        print(f"🎉 所有文件迁移成功！")
        print(f"")
        print(f"💡 提示:")
        print(f"  - 可以在 MinIO 控制台查看上传的文件")
        print(f"  - 访问 http://localhost:9001")
        print(f"  - 查看 smartclip-videos bucket")

if __name__ == '__main__':
    # 检查命令行参数
    if len(sys.argv) > 1 and sys.argv[1] == '--execute':
        migrate_videos(dry_run=False)
    else:
        migrate_videos(dry_run=True)
