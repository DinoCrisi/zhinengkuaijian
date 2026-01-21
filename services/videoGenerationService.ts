import { ReplicatedSegment } from '../types';
import { callProxy } from './proxyClient';

// Seedance API 配置
const VIDEO_API_CONFIG = {
  PROXY_URL: 'http://127.0.0.1:8888/api/chat',
  MODEL_NAME: 'doubao-seedance-1-5-pro-251215',
};

// 视频生成配置
export interface VideoGenerationConfig {
  resolution: '720p' | '1080p'; // 分辨率
  ratio: 'adaptive' | '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '21:9'; // 宽高比
  generateAudio: boolean; // 是否生成音频
  watermark: boolean; // 是否添加水印
}

// 视频生成任务状态
export interface VideoTask {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'succeeded';
  video_url?: string;
  error?: string;
}

/**
 * 解析分镜时间，返回秒数
 */
function parseSegmentDuration(timeStr: string): number {
  // 时间格式：0-3s, 3-6s 等
  const match = timeStr.match(/(\d+)-(\d+)s/);
  if (match) {
    const start = parseInt(match[1]);
    const end = parseInt(match[2]);
    return end - start;
  }
  return 5; // 默认 5 秒
}

function buildSeedancePrompt(segment: ReplicatedSegment, config: VideoGenerationConfig, duration: number): string {
  const quality = '(最佳画质, 4k, 8k, 杰作:1.2), 超高细节, (照片级真实感:1.37), 专业商业摄影';
  const constraints =
    '无模特、纯产品展示。产品必须与参考图完全一致（颜色、材质、尺寸不得偏差）。画面中不出现任何文字、字幕、UI元素。';
  const style = 'commercial product video, cinematic lighting, ultra detailed, photorealistic, masterpiece';
  const main = `旁白：${segment.voiceover_text}。画面：${segment.video_prompt || segment.script_content}`;
  // 注意：不要在提示词中包含 --ratio 和 --dur 参数，这些应该在 requestBody 中单独指定
  return `${quality}。${constraints}${main}。${style}`.trim();
}

/**
 * 创建视频生成任务
 */
async function createVideoTask(
  segment: ReplicatedSegment,
  frameImageUrl: string,
  config: VideoGenerationConfig
): Promise<string> {
  // 计算视频时长
  const duration = parseSegmentDuration(segment.time);
  
  // 构建文本提示词（包含配音文案和画面描述）
  const textPrompt = buildSeedancePrompt(segment, config, duration);
  
  const requestBody = {
    model: VIDEO_API_CONFIG.MODEL_NAME,
    content: [
      {
        type: 'text',
        text: textPrompt
      },
      {
        type: 'image_url',
        image_url: {
          url: frameImageUrl
        }
      }
    ],
    generate_audio: config.generateAudio,
    watermark: config.watermark,
    resolution: config.resolution,
    ratio: config.ratio,
    duration: duration
  };

  console.log(`Creating video task for segment: ${segment.id}`);
  console.log('Video generation config:', {
    duration: `${duration}s`,
    resolution: config.resolution,
    ratio: config.ratio,
    generateAudio: config.generateAudio,
    watermark: config.watermark
  });
  console.log('Text prompt:', textPrompt);

  const data = await callProxy<any>(VIDEO_API_CONFIG.PROXY_URL, {
    target: 'doubao_video_tasks',
    body: requestBody
  });
  
  if (!data.id) {
    throw new Error('Invalid video task response: missing task ID');
  }

  console.log(`Video task created: ${data.id}`);
  return data.id;
}

/**
 * 查询视频生成任务状态
 */
async function queryVideoTask(taskId: string): Promise<VideoTask> {
  const data = await callProxy<any>(VIDEO_API_CONFIG.PROXY_URL, {
    method: 'GET',
    target: 'doubao_video_tasks',
    path: `/${taskId}`
  });
  
  return {
    id: taskId,
    status: data.status || 'pending',
    video_url: data.content?.video_url,
    error: data.error?.message
  };
}

/**
 * 轮询等待视频生成完成
 */
async function waitForVideoCompletion(
  taskId: string,
  maxAttempts: number = 120,  // 增加到120次（10分钟）
  intervalMs: number = 5000    // 5秒间隔
): Promise<string> {
  console.log(`Waiting for video task ${taskId} to complete...`);
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const task = await queryVideoTask(taskId);
      
      console.log(`Attempt ${attempt}/${maxAttempts}: Task status = ${task.status}`);
      
      // 检查多种成功状态
      if ((task.status === 'succeeded' || task.status === 'completed') && task.video_url) {
        console.log(`✅ Video generation completed: ${task.video_url}`);
        return task.video_url;
      }
      
      // 检查失败状态
      if (task.status === 'failed') {
        throw new Error(`Video generation failed: ${task.error || 'Unknown error'}`);
      }
      
      // 等待后重试
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
    } catch (error) {
      // 如果是查询错误，记录但继续重试
      console.warn(`Query attempt ${attempt} failed:`, error);
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      } else {
        throw error;
      }
    }
  }
  
  throw new Error(`Video generation timeout after ${maxAttempts * intervalMs / 1000} seconds`);
}

/**
 * 为单个分镜的单个首帧生成视频（用于重新生成）
 */
export async function generateSingleVideo(
  segment: ReplicatedSegment,
  frameImageUrl: string,
  config: VideoGenerationConfig
): Promise<string> {
  console.log(`\n=== Generating single video for segment: ${segment.id} ===`);
  
  try {
    // 创建任务
    const taskId = await createVideoTask(segment, frameImageUrl, config);
    
    // 等待完成
    const videoUrl = await waitForVideoCompletion(taskId);
    
    console.log(`✅ Single video completed: ${videoUrl}`);
    return videoUrl;
  } catch (error) {
    console.error(`❌ Failed to generate single video:`, error);
    throw error;
  }
}

/**
 * 为单个分镜的多个首帧生成视频
 */
export async function generateSegmentVideos(
  segment: ReplicatedSegment,
  frameImageUrls: string[],
  config: VideoGenerationConfig
): Promise<string[]> {
  console.log(`\n=== Generating ${frameImageUrls.length} videos for segment: ${segment.id} ===`);
  
  const videoUrls: string[] = [];
  
  for (let i = 0; i < frameImageUrls.length; i++) {
    try {
      console.log(`\nGenerating video version ${i + 1}/${frameImageUrls.length}...`);
      
      // 创建任务
      const taskId = await createVideoTask(segment, frameImageUrls[i], config);
      
      // 等待完成
      const videoUrl = await waitForVideoCompletion(taskId);
      
      videoUrls.push(videoUrl);
      console.log(`✅ Video version ${i + 1} completed: ${videoUrl}`);
      
      // 添加延迟避免 API 限流
      if (i < frameImageUrls.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error(`❌ Failed to generate video version ${i + 1}:`, error);
      videoUrls.push('');
    }
  }
  
  console.log(`=== Segment ${segment.id} video generation completed ===\n`);
  return videoUrls;
}

/**
 * 批量生成所有分镜的视频（每个分镜根据首帧数量生成对应数量的视频）
 * 优化：使用并发生成提高速度
 */
export async function generateAllSegmentVideos(
  segments: ReplicatedSegment[],
  config: VideoGenerationConfig,
  onProgress?: (current: number, total: number, segmentId: string) => void
): Promise<Map<string, string[]>> {
  const videoMap = new Map<string, string[]>();
  
  console.log(`\n🎬 Starting batch video generation for ${segments.length} segments`);
  
  // 计算总任务数
  const totalTasks = segments.reduce((sum, seg) => sum + (seg.generated_frames?.length || 0), 0);
  console.log(`Total videos to generate: ${totalTasks}`);
  
  let completedTasks = 0;
  
  // 并发生成所有分镜的视频
  const promises = segments.map(async (segment, i) => {
    if (!segment.generated_frames || segment.generated_frames.length === 0) {
      console.warn(`⚠️ Segment ${segment.id} has no generated frames, skipping...`);
      return;
    }
    
    try {
      const videoUrls = await generateSegmentVideos(
        segment,
        segment.generated_frames,
        config
      );
      
      videoMap.set(segment.id, videoUrls);
      completedTasks += videoUrls.length;
      
      // 调用进度回调
      if (onProgress) {
        onProgress(i + 1, segments.length, segment.id);
      }
      
      console.log(`✅ Segment ${i + 1}/${segments.length} completed (${completedTasks}/${totalTasks} videos)`);
    } catch (error) {
      console.error(`❌ Failed to generate videos for segment ${i + 1}:`, error);
      videoMap.set(segment.id, segment.generated_frames!.map(() => ''));
      
      if (onProgress) {
        onProgress(i + 1, segments.length, segment.id);
      }
    }
  });
  
  // 等待所有分镜完成
  await Promise.all(promises);
  
  console.log('🎬 Batch video generation completed\n');
  return videoMap;
}

/**
 * 获取默认视频生成配置
 */
export function getDefaultVideoConfig(): VideoGenerationConfig {
  return {
    resolution: '720p',
    ratio: 'adaptive', // 自动根据首帧图片比例选择
    generateAudio: true, // 生成有声视频
    watermark: false // 不添加水印
  };
}
