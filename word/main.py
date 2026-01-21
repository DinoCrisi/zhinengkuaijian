import os
from record import record_audio
from transcribe import transcribe_audio

def main():
    # 1. 录音
    audio_file = "voice_input.wav"
    duration = 5  # 默认录音5秒
    
    print("=== 语音转文字项目 ===")
    try:
        duration_str = input("请输入录音时长 (秒，默认5): ").strip()
        if duration_str:
            duration = int(duration_str)
    except ValueError:
        print("输入无效，使用默认时长 5 秒。")

    record_audio(audio_file, duration)
    
    # 2. 转录
    print("\n=== 开始转录 ===")
    text = transcribe_audio(audio_file, model_name="base")
    
    if text:
        print("\n最终识别结果:")
        print("-" * 20)
        print(text.strip())
        print("-" * 20)
    else:
        print("转录失败。")

if __name__ == "__main__":
    main()
