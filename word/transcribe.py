import whisper
import os
import sys
import numpy as np
import soundfile as sf

def transcribe_audio(file_path, model_name="base"):
    """
    使用 OpenAI Whisper 模型转录音频文件。
    """
    if not os.path.exists(file_path):
        print(f"错误: 文件 {file_path} 不存在。")
        return None

    print(f"正在加载 Whisper 模型 '{model_name}'...")
    model = whisper.load_model(model_name)
    
    print(f"正在读取音频文件: {file_path}...")
    # 使用 soundfile 读取音频，避免对 ffmpeg 的依赖 (针对 wav)
    audio_data, samplerate = sf.read(file_path)
    
    # Whisper 期望 16000Hz 的采样率
    if samplerate != 16000:
        import scipy.signal
        num_samples = int(len(audio_data) * 16000 / samplerate)
        audio_data = scipy.signal.resample(audio_data, num_samples)
    
    # 确保是单声道
    if len(audio_data.shape) > 1:
        audio_data = audio_data.mean(axis=1)
    
    # 确保是 float32
    audio_data = audio_data.astype(np.float32)

    print(f"正在转录...")
    result = model.transcribe(audio_data)
    
    return result["text"]

def transcribe_audio_detailed(file_path, model_name="base"):
    """
    使用 OpenAI Whisper 模型转录音频文件，返回详细结果包括时间戳。
    """
    if not os.path.exists(file_path):
        print(f"错误: 文件 {file_path} 不存在。")
        return None

    print(f"正在加载 Whisper 模型 '{model_name}'...")
    try:
        model = whisper.load_model(model_name)
    except Exception as e:
        print(f"加载模型失败: {e}")
        return None
    
    print(f"正在读取音频文件: {file_path}...")
    try:
        # 直接使用 whisper 的音频加载功能
        audio = whisper.load_audio(file_path)
        audio = whisper.pad_or_trim(audio)
    except Exception as e:
        print(f"读取音频文件失败: {e}")
        return None

    print(f"正在转录...")
    try:
        result = model.transcribe(audio, verbose=True)
        
        # 构建 SRT 格式字幕
        srt_content = build_srt_from_segments(result.get('segments', []))
        
        return {
            'text': result.get('text', ''),
            'srt': srt_content,
            'segments': result.get('segments', []),
            'language': result.get('language', 'unknown')
        }
    except Exception as e:
        print(f"转录失败: {e}")
        return None

def build_srt_from_segments(segments, offset_seconds=0):
    """
    从 Whisper 的 segments 构建 SRT 格式字幕
    """
    if not segments:
        return ""
    
    srt_lines = []
    for i, segment in enumerate(segments, 1):
        start_time = segment.get('start', 0) + offset_seconds
        end_time = segment.get('end', 0) + offset_seconds
        text = segment.get('text', '').strip()
        
        if not text:
            continue
        
        # 格式化时间戳为 SRT 格式 (HH:MM:SS,mmm)
        start_srt = format_timestamp_srt(start_time)
        end_srt = format_timestamp_srt(end_time)
        
        srt_lines.append(f"{i}")
        srt_lines.append(f"{start_srt} --> {end_srt}")
        srt_lines.append(text)
        srt_lines.append("")  # 空行分隔
    
    return "\n".join(srt_lines)

def format_timestamp_srt(seconds):
    """
    将秒数格式化为 SRT 时间戳格式 (HH:MM:SS,mmm)
    """
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    milliseconds = int((seconds % 1) * 1000)
    
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{milliseconds:03d}"

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("用法: python transcribe.py <audio_file_path> [model_name]")
        sys.exit(1)
    
    audio_file = sys.argv[1]
    model = sys.argv[2] if len(sys.argv) > 2 else "base"
    
    # 使用详细转录功能
    result = transcribe_audio_detailed(audio_file, model)
    
    if result:
        print("\n--- 转录结果 ---")
        print(result['text'])
        print("----------------")
        
        # 将结果保存到文本文件
        output_file = os.path.splitext(audio_file)[0] + ".txt"
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(result['text'])
        print(f"转录结果已保存至: {output_file}")
        
        # 保存 SRT 字幕文件
        if result['srt']:
            srt_file = os.path.splitext(audio_file)[0] + ".srt"
            with open(srt_file, "w", encoding="utf-8") as f:
                f.write(result['srt'])
            print(f"SRT 字幕已保存至: {srt_file}")
    else:
        print("\n未能识别出任何文字。")
