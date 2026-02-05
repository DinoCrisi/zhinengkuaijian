#!/usr/bin/env python3
"""
MinIO 诊断脚本
用于检查 MinIO 配置和连接状态
"""
import os
import sys
import json
import requests
from pathlib import Path

def check_env_file():
    """检查 .env 文件"""
    print("=" * 60)
    print("1. 检查 .env 配置文件")
    print("=" * 60)
    
    env_path = Path(__file__).parent / '.env'
    server_env_path = Path(__file__).parent / 'server' / '.env'
    
    minio_keys = [
        'MINIO_ENDPOINT',
        'MINIO_ACCESS_KEY',
        'MINIO_SECRET_KEY',
        'MINIO_SECURE',
        'MINIO_ENABLED'
    ]
    
    found_config = False
    
    # 检查根目录 .env
    if env_path.exists():
        print(f"✅ 找到配置文件: {env_path}")
        with open(env_path, 'r', encoding='utf-8') as f:
            content = f.read()
            for key in minio_keys:
                if key in content:
                    found_config = True
                    value = [line for line in content.split('\n') if line.startswith(key)]
                    if value:
                        print(f"  ✓ {value[0]}")
    else:
        print(f"⚠️  未找到: {env_path}")
    
    # 检查 server/.env
    if server_env_path.exists():
        print(f"\n✅ 找到配置文件: {server_env_path}")
        with open(server_env_path, 'r', encoding='utf-8') as f:
            content = f.read()
            for key in minio_keys:
                if key in content:
                    found_config = True
                    value = [line for line in content.split('\n') if line.startswith(key)]
                    if value:
                        print(f"  ✓ {value[0]}")
    else:
        print(f"⚠️  未找到: {server_env_path}")
    
    if not found_config:
        print("\n❌ 未找到 MinIO 配置！")
        print("\n💡 解决方案：在 server/.env 文件中添加以下配置：")
        print("""
MINIO_ENDPOINT=8.163.24.184:9000
MINIO_ACCESS_KEY=prod-minio-user
MINIO_SECRET_KEY=MyStr0ng!Passw0rd@2026
MINIO_SECURE=false
MINIO_ENABLED=true
        """)
        return False
    
    return True


def check_services():
    """检查服务状态"""
    print("\n" + "=" * 60)
    print("2. 检查服务运行状态")
    print("=" * 60)
    
    services = {
        '视频分割服务': 'http://127.0.0.1:8891/api/health',
        '视频存储服务': 'http://127.0.0.1:8892/api/health'
    }
    
    all_ok = True
    
    for name, url in services.items():
        try:
            response = requests.get(url, timeout=3)
            if response.status_code == 200:
                data = response.json()
                print(f"✅ {name}: 运行正常")
                
                if name == '视频存储服务':
                    storage_backend = data.get('storage_backend', 'unknown')
                    minio_enabled = data.get('minio_enabled', False)
                    
                    if storage_backend == 'minio' and minio_enabled:
                        print(f"  ✓ 存储后端: MinIO ✅")
                    else:
                        print(f"  ⚠️  存储后端: {storage_backend} (应该是 minio)")
                        all_ok = False
                
                print(f"  响应: {json.dumps(data, ensure_ascii=False, indent=2)}")
            else:
                print(f"❌ {name}: HTTP {response.status_code}")
                all_ok = False
        except requests.exceptions.ConnectionError:
            print(f"❌ {name}: 无法连接 (服务未启动)")
            all_ok = False
        except Exception as e:
            print(f"❌ {name}: {str(e)}")
            all_ok = False
    
    return all_ok


def check_minio_connection():
    """检查 MinIO 连接"""
    print("\n" + "=" * 60)
    print("3. 检查 MinIO 连接")
    print("=" * 60)
    
    try:
        # 尝试导入 minio_client
        sys.path.insert(0, str(Path(__file__).parent / 'server'))
        from minio_client import get_minio_client
        
        client = get_minio_client()
        
        if not client.enabled:
            print("❌ MinIO 未启用")
            return False
        
        print(f"✅ MinIO 客户端初始化成功")
        print(f"  端点: {client.config['endpoint']}")
        print(f"  Buckets: {client.config['buckets']}")
        
        # 测试连接
        try:
            buckets = client.client.list_buckets()
            print(f"\n✅ MinIO 连接成功！")
            print(f"  可用 Buckets:")
            for bucket in buckets:
                print(f"    - {bucket.name}")
            return True
        except Exception as e:
            print(f"\n❌ MinIO 连接失败: {str(e)}")
            return False
            
    except ImportError as e:
        print(f"❌ 无法导入 minio_client: {str(e)}")
        print("💡 请确保已安装 MinIO 依赖: pip install minio")
        return False
    except Exception as e:
        print(f"❌ MinIO 初始化失败: {str(e)}")
        return False


def main():
    """主函数"""
    print("\n" + "=" * 60)
    print("MinIO 诊断工具")
    print("=" * 60 + "\n")
    
    # 1. 检查配置文件
    config_ok = check_env_file()
    
    # 2. 检查服务状态
    services_ok = check_services()
    
    # 3. 检查 MinIO 连接
    minio_ok = check_minio_connection()
    
    # 总结
    print("\n" + "=" * 60)
    print("诊断总结")
    print("=" * 60)
    
    if config_ok and services_ok and minio_ok:
        print("✅ 所有检查通过！MinIO 配置正常")
        print("\n💡 如果爆款分析仍然无法上传到 MinIO，请检查：")
        print("  1. 浏览器控制台是否有错误")
        print("  2. 服务器日志是否有错误信息")
        print("  3. 网络是否畅通")
    else:
        print("❌ 发现问题，请根据上述提示修复")
        
        if not config_ok:
            print("\n🔧 步骤 1: 配置 MinIO")
            print("  在 server/.env 文件中添加 MinIO 配置")
        
        if not services_ok:
            print("\n🔧 步骤 2: 启动服务")
            print("  运行: start_all_services_minio.cmd")
        
        if not minio_ok:
            print("\n🔧 步骤 3: 检查 MinIO 服务器")
            print("  确保 MinIO 服务器正在运行并可访问")


if __name__ == '__main__':
    main()
