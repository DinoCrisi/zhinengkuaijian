/**
 * 视频存储服务
 * 负责将视频文件持久化存储到服务器，并提供访问URL
 */

import { API_URLS } from '../config/apiConfig';

const STORAGE_API_BASE = API_URLS.VIDEO_STORAGE_API;

export interface StoredVideo {
  id: string;
  filename: string;
  url: string;
  thumbnail: string;
  duration: number;
  createdAt: string;
}

/**
 * 上传视频到服务器存储
 * @param videoBlob 视频Blob对象
 * @param metadata 视频元数据
 * @returns 存储后的视频信息
 */
export async function uploadVideoToStorage(
  videoBlob: Blob,
  metadata: {
    segmentId: string;
    mainTag: string;
    voiceoverText: string;
    visualPrompt: string;
  }
): Promise<StoredVideo> {
  const formData = new FormData();
  
  // 生成唯一文件名
  const timestamp = Date.now();
  const filename = `${metadata.segmentId}_${timestamp}.mp4`;
  
  formData.append('video', videoBlob, filename);
  formData.append('metadata', JSON.stringify(metadata));

  const response = await fetch(`${STORAGE_API_BASE}/store-video`, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    throw new Error(`视频存储失败: ${response.status}`);
  }

  const result = await response.json();
  
  if (!result.success) {
    throw new Error(result.message || '视频存储失败');
  }

  return result.data;
}

/**
 * 从URL下载视频并存储
 * @param videoUrl 视频URL
 * @param metadata 视频元数据
 * @returns 存储后的视频信息
 */
export async function downloadAndStoreVideo(
  videoUrl: string,
  metadata: {
    segmentId: string;
    mainTag: string;
    voiceoverText: string;
    visualPrompt: string;
  }
): Promise<StoredVideo> {
  console.log(`📥 下载并存储视频: ${videoUrl}`);
  console.log(`📋 元数据:`, metadata);

  const response = await fetch(`${STORAGE_API_BASE}/download-and-store`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      videoUrl,
      metadata
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ 视频下载存储失败:', errorText);
    throw new Error(`视频下载存储失败: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  
  if (!result.success) {
    throw new Error(result.message || '视频下载存储失败');
  }

  console.log(`✅ 视频存储成功:`, result.data);
  return result.data;
}

/**
 * 获取所有已存储的视频列表
 */
export async function listStoredVideos(): Promise<StoredVideo[]> {
  const response = await fetch(`${STORAGE_API_BASE}/list-videos`);

  if (!response.ok) {
    throw new Error(`获取视频列表失败: ${response.status}`);
  }

  const result = await response.json();
  
  if (!result.success) {
    throw new Error(result.message || '获取视频列表失败');
  }

  return result.data;
}

/**
 * 删除存储的视频
 */
export async function deleteStoredVideo(videoId: string): Promise<void> {
  const response = await fetch(`${STORAGE_API_BASE}/delete-video/${videoId}`, {
    method: 'DELETE'
  });

  if (!response.ok) {
    throw new Error(`删除视频失败: ${response.status}`);
  }

  const result = await response.json();
  
  if (!result.success) {
    throw new Error(result.message || '删除视频失败');
  }
}

/**
 * 生成视频缩略图
 */
export async function generateThumbnail(videoUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.src = videoUrl;
    video.muted = true;

    video.addEventListener('loadeddata', () => {
      // 跳到视频的1秒处或中间位置
      video.currentTime = Math.min(1, video.duration / 2);
    });

    video.addEventListener('seeked', () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('无法创建canvas context'));
        return;
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const thumbnail = canvas.toDataURL('image/jpeg', 0.8);
      resolve(thumbnail);
    });

    video.addEventListener('error', (e) => {
      reject(new Error('视频加载失败'));
    });
  });
}
