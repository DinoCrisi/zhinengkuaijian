#!/usr/bin/env python3
"""
快速修复转录服务问题
"""

import subprocess
import sys
import os
from pathlib import Path

def check_and_install_dependencies():
    """检查并安装依赖"""
    print("🔍 检查Python依赖...")
    
    # 检查关键依赖
    dependencies = [
        ('whisper', 'openai-whisper'),
        ('soundfile', 'soundfile'),
        ('numpy', 'numpy'),
        ('scipy', 'scipy')
    ]
    
    missing = []
    for module, package in dependencies:
        try:
            __import__(module)
            print(f"   ✅ {module}")
        except ImportError:
            print(f"   ❌ {module} (缺失)")
            missing.append(package)
    
    if missing:
        print(f"\n📦 安装缺失的依赖: {', '.join(missing)}")
        try:
            subprocess.run([sys.executable, '-m', 'pip', 'install'] + missing, check=True)
            print("✅ 依赖安装完成")
            return True
        except subprocess.CalledProcessError as e:
            print(f"❌ 依赖安装失败: {e}")
            return False
    else:
        print("✅ 所有依赖已安装")
        return True

def test_service_connection():
    """测试服务连接"""
    print("\n🌐 测试服务连接...")
    
    import urllib.request
    import urllib.error
    
    services = [
        ('视频合成服务', 'http://127.0.0.1:8889'),
        ('代理服务', 'http://127.0.0.1:8888')
    ]
    
    for name, url in services:
        try:
            response = urllib.request.urlopen(url, timeout=3)
            print(f"   ✅ {name} 运行正常")
        except urllib.error.URLError:
            print(f"   ❌ {name} 无法连接")
            return False
        except Exception as e:
            print(f"   ⚠️  {name} 状态未知: {e}")
    
    return True

def start_video_composer():
    """启动视频合成服务"""
    print("\n🚀 启动视频合成服务...")
    
    server_dir = Path(__file__).parent / "server"
    if not server_dir.exists():
        print(f"❌ server目录不存在: {server_dir}")
        return False
    
    composer_file = server_dir / "video_composer.py"
    if not composer_file.exists():
        print(f"❌ video_composer.py不存在: {composer_file}")
        return False
    
    try:
        # 在新窗口中启动服务
        if os.name == 'nt':  # Windows
            subprocess.Popen([
                'cmd', '/c', 'start', 'cmd', '/k', 
                f'cd /d {server_dir} && python video_composer.py'
            ])
        else:  # Linux/Mac
            subprocess.Popen([
                'gnome-terminal', '--', 'bash', '-c',
                f'cd {server_dir} && python video_composer.py; read'
            ])
        
        print("✅ 服务启动命令已执行")
        print("💡 请检查新打开的窗口中的服务状态")
        return True
        
    except Exception as e:
        print(f"❌ 启动失败: {e}")
        return False

def main():
    """主函数"""
    print("=" * 50)
    print("SmartClip AI - 转录服务快速修复")
    print("=" * 50)
    
    # 1. 检查并安装依赖
    if not check_and_install_dependencies():
        print("\n❌ 依赖安装失败，请手动安装:")
        print("   pip install openai-whisper soundfile numpy scipy")
        input("\n按回车键退出...")
        return
    
    # 2. 测试服务连接
    if test_service_connection():
        print("\n✅ 服务运行正常，问题可能在其他地方")
        print("💡 请尝试重新使用转录功能")
    else:
        print("\n⚠️  服务未运行，尝试启动...")
        start_video_composer()
        
        print("\n⏳ 等待服务启动...")
        import time
        time.sleep(5)
        
        if test_service_connection():
            print("✅ 服务启动成功！")
        else:
            print("❌ 服务启动失败")
            print("💡 请手动运行: cd server && python video_composer.py")
    
    print("\n" + "=" * 50)
    print("修复完成！")
    print("💡 如果问题仍然存在，请:")
    print("   1. 检查防火墙设置")
    print("   2. 确保端口8889未被占用")
    print("   3. 查看服务窗口的错误信息")
    
    input("\n按回车键退出...")

if __name__ == "__main__":
    main()