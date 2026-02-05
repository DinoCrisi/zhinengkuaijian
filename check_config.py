#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
配置检查工具
检查前端和后端配置是否一致
"""

import sys
import os
import re

def read_frontend_config():
    """读取前端配置"""
    config_path = os.path.join('config', 'apiConfig.ts')
    if not os.path.exists(config_path):
        return None
    
    with open(config_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 提取 BASE_HOST
    match = re.search(r"const BASE_HOST = ['\"]([^'\"]+)['\"]", content)
    if match:
        return match.group(1)
    return None

def read_backend_config():
    """读取后端配置"""
    sys.path.insert(0, 'server')
    try:
        from config import BASE_HOST
        return BASE_HOST
    except ImportError:
        return None

def main():
    print("=" * 60)
    print("配置检查工具")
    print("=" * 60)
    
    frontend_host = read_frontend_config()
    backend_host = read_backend_config()
    
    print(f"\n前端配置 (config/apiConfig.ts):")
    print(f"  BASE_HOST = '{frontend_host}'")
    
    print(f"\n后端配置 (server/config.py):")
    print(f"  BASE_HOST = '{backend_host}'")
    
    print("\n" + "=" * 60)
    
    if frontend_host is None or backend_host is None:
        print("❌ 错误: 无法读取配置文件")
        return 1
    
    if frontend_host == backend_host:
        print("✅ 配置一致！前后端使用相同的 BASE_HOST")
        print(f"\n所有服务将运行在: {backend_host}")
        return 0
    else:
        print("⚠️  警告: 配置不一致！")
        print(f"\n前端会向 {frontend_host} 发送请求")
        print(f"但后端监听在 {backend_host}")
        print("\n这会导致：")
        print("  1. 前端无法连接到后端服务")
        print("  2. 所有功能都会失败")
        print("\n建议：")
        print("  1. 修改 config/apiConfig.ts 中的 BASE_HOST")
        print("  2. 修改 server/config.py 中的 BASE_HOST")
        print("  3. 确保两者一致")
        return 1

if __name__ == '__main__':
    sys.exit(main())
