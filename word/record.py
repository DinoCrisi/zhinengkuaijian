import sounddevice as sd
from scipy.io.wavfile import write
import numpy as np
import time

def record_audio(filename, duration=5, fs=44100):
    """
    录制音频并保存为 wav 文件。
    
    参数:
    filename: 保存的文件名
    duration: 录音时长（秒）
    fs: 采样率
    """
    print(f"准备录音 {duration} 秒...")
    print("请开始说话...")
    
    # 开始录音
    recording = sd.rec(int(duration * fs), samplerate=fs, channels=1)
    
    # 等待录音结束
    for i in range(duration, 0, -1):
        print(f"剩余时间: {i} 秒", end="\r")
        time.sleep(1)
    
    sd.wait()
    print("\n录音结束。")
    
    # 保存为 wav 文件
    write(filename, fs, recording)
    print(f"录音已保存至: {filename}")

if __name__ == "__main__":
    import sys
    
    duration = 5
    if len(sys.argv) > 1:
        try:
            duration = int(sys.argv[1])
        except ValueError:
            print("时长必须是整数。")
            
    output_file = "input.wav"
    record_audio(output_file, duration)
