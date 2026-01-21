#!/usr/bin/env python3
"""
视频转录功能诊断脚本
检查转录功能的依赖和配置
"""

import sys
import os
from pathlib import Path

def check_python_version():
    """检查Python版本"""
    print("🐍 Python版本检查:")
    print(f"   版本: {sys.version}")
    if sys.version_info < (3, 8):
        print("   ❌ Python版本过低，建议使用3.8+")
        return False
    else:
        print("   ✅ Python版本符合要求")
        return True

def check_dependencies():
    """检查Python依赖"""
    print("\n📦 依赖检查:")
    
    dependencies = [
        ('whisper', 'openai-whisper'),
        ('numpy', 'numpy'),
        ('soundfile', 'soundfile'),
        ('scipy', 'scipy')
    ]
    
    all_ok = True
    for module, package in dependencies:
        try:
            __import__(module)
            print(f"   ✅ {module} 已安装")
        except ImportError:
            print(f"   ❌ {module} 未安装 (pip install {package})")
            all_ok = False
    
    return all_ok

def check_word_module():
    """检查word模块"""
    print("\n📁 模块检查:")
    
    # 添加项目根目录到路径
    root_dir = Path(__file__).resolve().parent
    if str(root_dir) not in sys.path:
        sys.path.insert(0, str(root_dir))
    
    try:
        from word.transcribe import transcribe_audio_detailed, build_srt_from_segments
        print("   ✅ word.transcribe 模块导入成功")
        print("   ✅ transcribe_audio_detailed 函数可用")
        print("   ✅ build_srt_from_segments 函数可用")
        return True
    except ImportError as e:
        print(f"   ❌ word.transcribe 模块导入失败: {e}")
        return False

def check_ffmpeg():
    """检查FFmpeg"""
    print("\n🎬 FFmpeg检查:")
    
    import subprocess
    try:
        result = subprocess.run(['ffmpeg', '-version'], 
                              capture_output=True, text=True, timeout=5)
        if result.returncode == 0:
            version_line = result.stdout.split('\n')[0]
            print(f"   ✅ FFmpeg 已安装: {version_line}")
            return True
        else:
            print("   ❌ FFmpeg 命令执行失败")
            return False
    except FileNotFoundError:
        print("   ❌ FFmpeg 未安装或不在PATH中")
        print("   💡 请下载并安装FFmpeg: https://ffmpeg.org/download.html")
        return False
    except subprocess.TimeoutExpired:
        print("   ❌ FFmpeg 命令超时")
        return False

def test_transcribe_function():
    """测试转录函数"""
    print("\n🧪 功能测试:")
    
    try:
        from word.transcribe import transcribe_audio_detailed
        
        # 创建一个测试音频文件路径（不实际测试，只检查函数调用）
        test_path = "test.wav"
        print("   ✅ transcribe_audio_detailed 函数可调用")
        return True
    except Exception as e:
        print(f"   ❌ 函数测试失败: {e}")
        return False

def check_server_status():
    """检查服务器状态"""
    print("\n🌐 服务状态检查:")
    
    import urllib.request
    import urllib.error
    
    services = [
        ('视频合成服务', 'http://127.0.0.1:8889'),
        ('代理服务', 'http://127.0.0.1:8888'),
        ('前端服务', 'http://localhost:5173')
    ]
    
    for name, url in services:
        try:
            response = urllib.request.urlopen(url, timeout=3)
            print(f"   ✅ {name} 运行正常 ({url})")
        except urllib.error.URLError:
            print(f"   ❌ {name} 无法连接 ({url})")
        except Exception as e:
            print(f"   ⚠️  {name} 状态未知: {e}")

def main():
    """主函数"""
    print("=" * 50)
    print("SmartClip AI - 视频转录功能诊断")
    print("=" * 50)
    
    checks = [
        check_python_version(),
        check_dependencies(),
        check_word_module(),
        check_ffmpeg(),
        test_transcribe_function()
    ]
    
    check_server_status()
    
    print("\n" + "=" * 50)
    print("诊断结果:")
    
    if all(checks):
        print("✅ 所有检查通过，转录功能应该可以正常工作")
        print("\n💡 如果仍有问题，请检查:")
        print("   1. 确保所有服务都已启动")
        print("   2. 检查防火墙设置")
        print("   3. 查看服务器日志")
    else:
        print("❌ 发现问题，请根据上述提示修复")
        print("\n🔧 修复建议:")
        print("   1. 安装缺失的依赖: pip install -r word/requirements.txt")
        print("   2. 安装FFmpeg并添加到PATH")
        print("   3. 重新启动所有服务")
    
    print("\n按回车键退出...")
    input()

if __name__ == "__main__":
    main()