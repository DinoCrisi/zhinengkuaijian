#!/usr/bin/env python3
"""
MinIO 自动配置脚本
自动在 server/.env 中添加 MinIO 配置
"""
import os
from pathlib import Path

def setup_minio_config():
    """设置 MinIO 配置"""
    print("=" * 60)
    print("MinIO 自动配置工具")
    print("=" * 60)
    print()
    
    # 配置文件路径
    server_dir = Path(__file__).parent / 'server'
    env_file = server_dir / '.env'
    
    # 确保 server 目录存在
    server_dir.mkdir(exist_ok=True)
    
    # MinIO 配置
    minio_config = """
# MinIO 对象存储配置
MINIO_ENDPOINT=8.163.24.184:9000
MINIO_ACCESS_KEY=prod-minio-user
MINIO_SECRET_KEY=MyStr0ng!Passw0rd@2026
MINIO_SECURE=false
MINIO_ENABLED=true
"""
    
    # 检查文件是否存在
    if env_file.exists():
        print(f"✅ 找到配置文件: {env_file}")
        
        # 读取现有内容
        with open(env_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 检查是否已有 MinIO 配置
        if 'MINIO_ENDPOINT' in content:
            print("⚠️  配置文件中已存在 MinIO 配置")
            print()
            response = input("是否覆盖现有配置？(y/N): ").strip().lower()
            
            if response != 'y':
                print("❌ 取消配置")
                return False
            
            # 移除旧的 MinIO 配置
            lines = content.split('\n')
            new_lines = []
            skip_next = False
            
            for line in lines:
                if line.strip().startswith('# MinIO'):
                    skip_next = True
                    continue
                if skip_next and line.strip().startswith('MINIO_'):
                    continue
                if skip_next and not line.strip():
                    skip_next = False
                    continue
                new_lines.append(line)
            
            content = '\n'.join(new_lines)
        
        # 添加 MinIO 配置
        if not content.endswith('\n'):
            content += '\n'
        content += minio_config
        
        # 写入文件
        with open(env_file, 'w', encoding='utf-8') as f:
            f.write(content)
        
        print("✅ MinIO 配置已更新")
    else:
        print(f"📝 创建新配置文件: {env_file}")
        
        # 创建新文件
        with open(env_file, 'w', encoding='utf-8') as f:
            f.write(minio_config.lstrip())
        
        print("✅ MinIO 配置已创建")
    
    print()
    print("=" * 60)
    print("配置内容:")
    print("=" * 60)
    print(minio_config)
    print("=" * 60)
    print()
    print("✅ 配置完成！")
    print()
    print("📋 下一步:")
    print("  1. 确保 MinIO 服务器正在运行")
    print("  2. 运行诊断脚本: python diagnose_minio.py")
    print("  3. 启动服务: start_all_services_minio.cmd")
    print()
    
    return True


if __name__ == '__main__':
    try:
        setup_minio_config()
    except Exception as e:
        print(f"❌ 配置失败: {str(e)}")
        import traceback
        traceback.print_exc()
