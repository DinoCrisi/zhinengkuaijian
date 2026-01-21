/**
 * 视频合成服务
 * 调用后端 FFmpeg API 合成完整视频
 */

// API 配置
const COMPOSER_API_URL = 'http://127.0.0.1:8889';

export interface ComposeVideoRequest {
  videoUrls: string[];
  productName: string;
  version: number;
}

export interface ComposeVideoResponse {
  taskId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  outputUrl?: string;
  error?: string;
}

export interface TranscribeVideoResponse {
  text: string;
  srt: string;
}

/**
 * 创建视频合成任务
 */
export async function createComposeTask(
  videoUrls: string[],
  productName: string,
  version: number
): Promise<string> {
  console.log(`Creating compose task for ${videoUrls.length} videos...`);
  console.log(`Product: ${productName}, Version: ${version}`);

  const response = await fetch(`${COMPOSER_API_URL}/api/compose-video`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      videoUrls,
      productName,
      version
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }

  const data = await response.json();
  console.log(`Task created: ${data.taskId}`);
  
  return data.taskId;
}

/**
 * 查询视频合成任务状态
 */
export async function queryComposeTask(taskId: string): Promise<ComposeVideoResponse> {
  const response = await fetch(`${COMPOSER_API_URL}/api/compose-video/${taskId}`);

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return {
    taskId: data.taskId,
    status: data.status,
    progress: data.progress,
    outputUrl: data.outputUrl,
    error: data.error
  };
}

/**
 * 等待视频合成完成
 */
export async function waitForComposition(
  taskId: string,
  onProgress?: (progress: number) => void
): Promise<string> {
  console.log(`Waiting for composition task ${taskId}...`);

  const maxAttempts = 120; // 10 分钟（每 5 秒查询一次）
  const interval = 5000; // 5 秒

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const result = await queryComposeTask(taskId);

      // 更新进度
      if (onProgress) {
        onProgress(result.progress);
      }

      console.log(`Task ${taskId} status: ${result.status} (${result.progress}%)`);

      // 检查状态
      if (result.status === 'completed') {
        if (!result.outputUrl) {
          throw new Error('合成完成但未返回视频 URL');
        }
        console.log(`✅ Composition completed: ${result.outputUrl}`);
        return result.outputUrl;
      }

      if (result.status === 'failed') {
        throw new Error(result.error || '视频合成失败');
      }

      // 等待下一次查询
      await new Promise(resolve => setTimeout(resolve, interval));

    } catch (error) {
      console.error(`Error querying task ${taskId}:`, error);
      throw error;
    }
  }

  throw new Error('视频合成超时（10 分钟）');
}

/**
 * 合成单个完整视频
 */
export async function composeSingleVideo(
  videoUrls: string[],
  productName: string,
  version: number,
  onProgress?: (progress: number) => void
): Promise<string> {
  console.log(`\n=== Composing video version ${version} ===`);
  console.log(`Segments: ${videoUrls.length}`);
  console.log(`Product: ${productName}`);

  // 1. 创建任务
  const taskId = await createComposeTask(videoUrls, productName, version);

  // 2. 等待完成
  const outputUrl = await waitForComposition(taskId, onProgress);

  console.log(`=== Video version ${version} composition completed ===\n`);
  
  return outputUrl;
}

/**
 * 批量合成多个完整视频
 */
export async function composeAllVideos(
  segmentVideos: string[][], // 每个元素是一组分镜视频 URLs
  productName: string,
  onProgress?: (videoIndex: number, progress: number) => void
): Promise<string[]> {
  console.log(`\n🎬 Starting batch video composition`);
  console.log(`Videos to compose: ${segmentVideos.length}`);
  console.log(`Segments per video: ${segmentVideos[0]?.length || 0}`);

  const outputUrls: string[] = [];

  // 串行合成（避免服务器负载过高）
  for (let i = 0; i < segmentVideos.length; i++) {
    const videoUrls = segmentVideos[i];
    const version = i + 1;

    try {
      const outputUrl = await composeSingleVideo(
        videoUrls,
        productName,
        version,
        (progress) => {
          if (onProgress) {
            onProgress(i, progress);
          }
        }
      );

      outputUrls.push(outputUrl);
      console.log(`✅ Video ${version}/${segmentVideos.length} completed`);

    } catch (error) {
      console.error(`❌ Failed to compose video ${version}:`, error);
      // 使用占位 URL
      outputUrls.push('');
    }
  }

  console.log(`\n🎉 Batch composition completed!`);
  console.log(`Success: ${outputUrls.filter(url => url).length}/${segmentVideos.length}`);

  return outputUrls;
}

export async function transcribeVideoToSrt(
  file: File,
  model: string = 'base',
  offsetMs: number = 0
): Promise<TranscribeVideoResponse> {
  console.log(`开始转录视频: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
  console.log(`使用模型: ${model}, 时间偏移: ${offsetMs}ms`);

  const formData = new FormData();
  formData.append('file', file);
  if (model) {
    formData.append('model', model);
  }
  if (offsetMs) {
    formData.append('offsetMs', String(offsetMs));
  }

  try {
    const response = await fetch(`${COMPOSER_API_URL}/api/transcribe-video`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      let message = `HTTP ${response.status}`;
      try {
        const err = await response.json();
        message = err?.error || message;
      } catch {
        // 如果无法解析JSON，使用状态码
        if (response.status === 404) {
          message = '转录服务不可用，请确保后端服务已启动';
        } else if (response.status === 413) {
          message = '视频文件过大，请选择较小的文件';
        } else if (response.status === 415) {
          message = '不支持的视频格式，请使用MP4格式';
        } else if (response.status >= 500) {
          message = '服务器内部错误，请稍后重试';
        }
      }
      throw new Error(message);
    }

    const data = await response.json();
    
    console.log(`转录完成: 文本长度 ${data.text?.length || 0} 字符`);
    console.log(`SRT字幕: ${data.srt ? '已生成' : '未生成'}`);
    
    return {
      text: data.text || '',
      srt: data.srt || ''
    };
  } catch (error) {
    console.error('视频转录失败:', error);
    
    // 提供更友好的错误信息
    if (error instanceof Error) {
      if (error.message.includes('Failed to fetch')) {
        throw new Error('无法连接到转录服务，请检查网络连接或确保后端服务已启动');
      } else if (error.message.includes('timeout')) {
        throw new Error('转录超时，请尝试较短的视频或稍后重试');
      } else {
        throw error;
      }
    } else {
      throw new Error('转录过程中发生未知错误');
    }
  }
}
