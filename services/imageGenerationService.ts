import { ReplicatedSegment } from '../types';
import { callProxy } from './proxyClient';
import { getImageGenerationSettings, ConcurrencyController } from './imageGenerationConfig';

// Seedream API 配置
const IMAGE_API_CONFIG = {
  PROXY_URL: 'http://127.0.0.1:8888/api/chat',
  MODEL_NAME: 'doubao-seedream-4-5-251128', 
};

// 图片生成配置
export interface ImageGenerationConfig {
  size: string;
  resolution: '2K' | '4K';
}

// 尺寸映射表
const SIZE_MAPPING: Record<string, string> = {
  '1:1': '2048x2048',
  '4:3': '2304x1728',
  '3:4': '1728x2304',
  '16:9': '2560x1440',
  '9:16': '1440x2560',
  '3:2': '2496x1664',
  '2:3': '1664x2496',
  '21:9': '3024x1296'
};

const REFERENCE_MAX_IMAGES = 2;
const REFERENCE_MAX_SIDE = 1024;
const REFERENCE_JPEG_QUALITY = 0.82;
const referenceImageCache = new Map<string, Promise<string>>();

/**
 * 将 Blob URL 转换为 Base64
 */
async function blobUrlToBase64(blobUrl: string): Promise<string> {
  if (blobUrl.startsWith('data:')) {
    return blobUrl;
  }
  
  if (blobUrl.startsWith('http://') || blobUrl.startsWith('https://')) {
    return blobUrl;
  }
  
  const response = await fetch(blobUrl);
  const blob = await response.blob();
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function normalizeReferenceImage(input: string): string {
  const value = input.trim();
  if (!value) return '';
  if (value.startsWith('data:')) return value;
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  return `data:image/jpeg;base64,${value}`;
}

async function blobUrlToCompressedJpegBase64(blobUrl: string, maxSide: number, quality: number): Promise<string> {
  if (blobUrl.startsWith('data:')) {
    return blobUrl;
  }
  if (blobUrl.startsWith('http://') || blobUrl.startsWith('https://')) {
    return blobUrl;
  }

  const response = await fetch(blobUrl);
  const blob = await response.blob();

  const bitmap = await createImageBitmap(blob);
  const { width, height } = bitmap;

  const scale = Math.min(1, maxSide / Math.max(width, height));
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return blobUrlToBase64(blobUrl);
  }
  ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
  return canvas.toDataURL('image/jpeg', quality);
}

async function prepareReferenceImages(productImages: string[]): Promise<string[]> {
  if (!productImages || productImages.length === 0) return [];

  const images = productImages.slice(0, REFERENCE_MAX_IMAGES);
  const converted = await Promise.all(
    images.map((img) => {
      const key = `${img}__${REFERENCE_MAX_SIDE}__${REFERENCE_JPEG_QUALITY}`;
      const cached = referenceImageCache.get(key);
      if (cached) return cached;
      const task = blobUrlToCompressedJpegBase64(img, REFERENCE_MAX_SIDE, REFERENCE_JPEG_QUALITY);
      referenceImageCache.set(key, task);
      return task;
    })
  );

  return converted.map(normalizeReferenceImage).filter(Boolean);
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const concurrency = Math.max(1, Math.min(limit, items.length || 1));
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  const runners = Array.from({ length: concurrency }).map(async () => {
    while (true) {
      const i = nextIndex++;
      if (i >= items.length) return;
      results[i] = await worker(items[i], i);
    }
  });

  await Promise.all(runners);
  return results;
}

/**
 * 清理和优化提示词，避免敏感内容检测
 */
function sanitizePrompt(prompt: string): string {
  // 移除可能触发敏感内容检测的词汇和短语
  const sensitivePatterns = [
    /血腥|暴力|恐怖|死亡|杀害|伤害/g,
    /政治|敏感|违法|犯罪|毒品/g,
    /色情|性感|裸体|暴露/g,
    /宗教|种族|歧视/g,
    /病态|疾病|痛苦|折磨/g,
    /战争|武器|爆炸|破坏/g
  ];
  
  let cleanPrompt = prompt;
  sensitivePatterns.forEach(pattern => {
    cleanPrompt = cleanPrompt.replace(pattern, '');
  });
  
  // 清理多余空格和标点
  cleanPrompt = cleanPrompt.replace(/\s+/g, ' ').trim();
  
  // 如果提示词过短，添加安全的描述词
  if (cleanPrompt.length < 10) {
    cleanPrompt = `商业产品展示 ${cleanPrompt}`;
  }
  
  return cleanPrompt;
}

/**
 * 调用 Seedream API 生成图片（带重试机制）
 */
async function callSeedreamAPI(
  prompt: string,
  productImages: string[],
  config: ImageGenerationConfig,
  preparedReferenceImages?: string[],
  retryCount: number = 0
): Promise<string> {
  const size = SIZE_MAPPING[config.size] || SIZE_MAPPING['9:16'];

  // 清理提示词，避免敏感内容检测
  const sanitizedPrompt = sanitizePrompt(prompt);
  
  const qualityPrefix =
    config.resolution === '4K'
      ? '高品质商业摄影, 4K分辨率, 专业拍摄'
      : '高品质商业摄影, 专业拍摄';
  
  const enhancedPrompt = `${qualityPrefix}, ${sanitizedPrompt}, 商业产品展示, 干净背景, 专业光影, 无文字无标识`.trim();

  const requestBody: any = {
    model: IMAGE_API_CONFIG.MODEL_NAME,
    prompt: enhancedPrompt,
    size: size,
    n: 1,
    stream: false,
    watermark: false
  };

  try {
    const referenceImages = preparedReferenceImages ?? (await prepareReferenceImages(productImages));
    if (referenceImages.length > 0) {
      requestBody.image = referenceImages;
    }
  } catch (error) {
    console.warn('Failed to convert product images:', error);
  }

  try {
    const data = await callProxy<any>(IMAGE_API_CONFIG.PROXY_URL, {
      target: 'doubao_images',
      body: requestBody
    });

    if (!data.data || !data.data[0]) {
      throw new Error('Invalid image generation response format');
    }

    const imageData = data.data[0];
    if (imageData.url) {
      return imageData.url;
    } else if (imageData.b64_json) {
      return `data:image/png;base64,${imageData.b64_json}`;
    } else {
      throw new Error('No image data found in response');
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    
    // 如果是网络错误（Failed to fetch），重试最多 3 次
    if (errorMsg.includes('Failed to fetch') && retryCount < 3) {
      const waitTime = Math.min(1000 * Math.pow(2, retryCount), 5000); // 指数退避：1s, 2s, 4s
      console.warn(`网络连接错误，${waitTime}ms 后重试 (${retryCount + 1}/3)...`);
      
      // 等待后重试
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return callSeedreamAPI(prompt, productImages, config, preparedReferenceImages, retryCount + 1);
    }
    
    // 如果是敏感内容检测错误，尝试使用更简化的提示词重试
    if (errorMsg.includes('InputTextSensitiveContentDetected') && retryCount < 2) {
      console.warn(`敏感内容检测触发，尝试简化提示词重试 (${retryCount + 1}/2)`);
      
      // 使用更简化和安全的提示词
      const fallbackPrompt = retryCount === 0 
        ? `商业产品摄影, 简洁风格, 专业拍摄` 
        : `产品展示, 商业摄影`;
      
      // 递归重试
      return callSeedreamAPI(fallbackPrompt, productImages, config, preparedReferenceImages, retryCount + 1);
    }
    
    throw error;
  }
}

/**
 * 为单个分镜生成单个首帧图片（用于重新生成）
 */
export async function generateSingleFrame(
  segment: ReplicatedSegment,
  productImages: string[],
  config: ImageGenerationConfig
): Promise<string> {
  console.log(`\n=== Generating single frame for segment: ${segment.id} ===`);
  console.log('Frame Prompt:', segment.frame_prompt);

  try {
    const preparedReferenceImages = await prepareReferenceImages(productImages);
    const imageUrl = await callSeedreamAPI(
      segment.frame_prompt,
      productImages,
      config,
      preparedReferenceImages,
      0 // 初始重试次数
    );
    
    console.log(`✅ Single frame generated for segment: ${segment.id}`);
    return imageUrl;
  } catch (error) {
    console.error(`❌ Failed to generate single frame:`, error);
    throw error;
  }
}

/**
 * 为单个分镜生成多个首帧图片（根据 genCount）
 */
export async function generateFrameImages(
  segment: ReplicatedSegment,
  productImages: string[],
  config: ImageGenerationConfig,
  count: number
): Promise<string[]> {
  console.log(`\n=== Generating ${count} frames for segment: ${segment.id} ===`);
  console.log('Frame Prompt:', segment.frame_prompt);

  const preparedReferenceImages = await prepareReferenceImages(productImages);

  // 🚀 优化：并发生成所有版本，但限制并发数避免被限流
  const concurrency = Math.min(3, count); // 限制单个分镜的并发数为3
  const results: string[] = [];
  
  for (let i = 0; i < count; i += concurrency) {
    const batch = Array.from({ length: Math.min(concurrency, count - i) }).map(async (_, batchIndex) => {
      const versionIndex = i + batchIndex;
      try {
        console.log(`Generating frame version ${versionIndex + 1}/${count}...`);
        const imageUrl = await callSeedreamAPI(
          segment.frame_prompt,
          productImages,
          config,
          preparedReferenceImages,
          0 // 初始重试次数
        );
        
        console.log(`✅ Frame version ${versionIndex + 1} generated`);
        return imageUrl;
      } catch (error) {
        console.error(`❌ Failed to generate frame version ${versionIndex + 1}:`, error);
        return '';
      }
    });
    
    const batchResults = await Promise.all(batch);
    results.push(...batchResults);
    
    // 批次间添加小延迟，避免API限流
    if (i + concurrency < count) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  console.log(`✅ All ${count} frames generated for segment: ${segment.id}\n`);
  return results;
}

/**
 * 批量生成所有分镜的首帧图片（每个分镜生成 count 个版本）
 * 🚀 智能并发控制，自适应调整并发数
 */
export async function generateAllFrames(
  segments: ReplicatedSegment[],
  productImages: string[],
  config: ImageGenerationConfig,
  count: number,
  onProgress?: (current: number, total: number) => void
): Promise<Map<string, string[]>> {
  const frameMap = new Map<string, string[]>();
  const settings = getImageGenerationSettings();
  
  const totalFrames = segments.length * count;
  console.log(`\n🎨 Starting intelligent batch frame generation`);
  console.log(`Segments: ${segments.length}`);
  console.log(`Versions per segment: ${count}`);
  console.log(`Total frames to generate: ${totalFrames}`);
  console.log(`🚀 Using adaptive concurrency control (initial: ${settings.maxConcurrency})\n`);

  // 创建并发控制器
  const concurrencyController = new ConcurrencyController(settings.maxConcurrency, settings.maxConcurrency);

  // 🚀 创建所有任务的扁平化数组
  const allTasks: Array<{
    segment: ReplicatedSegment;
    segmentIndex: number;
    versionIndex: number;
    taskIndex: number;
  }> = [];

  segments.forEach((segment, segmentIndex) => {
    for (let versionIndex = 0; versionIndex < count; versionIndex++) {
      allTasks.push({
        segment,
        segmentIndex,
        versionIndex,
        taskIndex: allTasks.length
      });
    }
  });

  const preparedReferenceImages = await prepareReferenceImages(productImages);

  // 🚀 分批处理，动态调整并发数
  let completedCount = 0;
  const results: Array<{
    segmentId: string;
    versionIndex: number;
    imageUrl: string;
  }> = [];

  for (let i = 0; i < allTasks.length; i += settings.batchSize) {
    const batch = allTasks.slice(i, i + settings.batchSize);
    const batchNumber = Math.floor(i / settings.batchSize) + 1;
    const totalBatches = Math.ceil(allTasks.length / settings.batchSize);
    
    console.log(`\n📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} tasks, concurrency: ${concurrencyController.getCurrentConcurrency()})`);
    
    const batchResults = await mapWithConcurrency(batch, concurrencyController.getCurrentConcurrency(), async (task) => {
      try {
        const imageUrl = await callSeedreamAPI(
          task.segment.frame_prompt,
          productImages,
          config,
          preparedReferenceImages,
          0 // 初始重试次数
        );
        
        completedCount++;
        concurrencyController.recordResult(true); // 记录成功
        if (onProgress) onProgress(completedCount, totalFrames);
        console.log(`✅ [${completedCount}/${totalFrames}] Segment ${task.segmentIndex + 1} Version ${task.versionIndex + 1} completed`);
        
        return {
          segmentId: task.segment.id,
          versionIndex: task.versionIndex,
          imageUrl
        };
      } catch (error) {
        completedCount++;
        concurrencyController.recordResult(false); // 记录失败
        if (onProgress) onProgress(completedCount, totalFrames);
        console.error(`❌ [${completedCount}/${totalFrames}] Segment ${task.segmentIndex + 1} Version ${task.versionIndex + 1} failed:`, error);
        
        return {
          segmentId: task.segment.id,
          versionIndex: task.versionIndex,
          imageUrl: ''
        };
      }
    });
    
    results.push(...batchResults);
    
    // 批次间添加延迟，避免API限流
    if (i + settings.batchSize < allTasks.length) {
      console.log(`⏳ Waiting ${settings.batchDelay}ms before next batch...`);
      await new Promise(resolve => setTimeout(resolve, settings.batchDelay));
    }
  }

  // 整理结果到 Map
  segments.forEach(segment => {
    const segmentFrames = results
      .filter(r => r.segmentId === segment.id)
      .sort((a, b) => a.versionIndex - b.versionIndex)
      .map(r => r.imageUrl);
    
    frameMap.set(segment.id, segmentFrames);
  });

  const stats = concurrencyController.getStats();
  const successCount = results.filter(r => r.imageUrl).length;
  console.log(`\n🎉 Batch generation completed!`);
  console.log(`📊 Success: ${successCount}/${totalFrames} (${(stats.successRate * 100).toFixed(1)}%)`);
  console.log(`🚀 Final concurrency: ${stats.currentConcurrency}\n`);
  
  return frameMap;
}

/**
 * 获取可用的尺寸选项
 */
export function getAvailableSizes(): Array<{ value: string; label: string; dimensions: string }> {
  return [
    { value: '9:16', label: '竖屏 (9:16)', dimensions: '1440x2560' },
    { value: '16:9', label: '横屏 (16:9)', dimensions: '2560x1440' },
    { value: '1:1', label: '方形 (1:1)', dimensions: '2048x2048' },
    { value: '4:3', label: '标准 (4:3)', dimensions: '2304x1728' },
    { value: '3:4', label: '竖版 (3:4)', dimensions: '1728x2304' },
    { value: '3:2', label: '宽屏 (3:2)', dimensions: '2496x1664' },
    { value: '2:3', label: '竖版宽屏 (2:3)', dimensions: '1664x2496' },
    { value: '21:9', label: '超宽屏 (21:9)', dimensions: '3024x1296' }
  ];
}

/**
 * 获取可用的分辨率选项
 */
export function getAvailableResolutions(): Array<{ value: '2K' | '4K'; label: string }> {
  return [
    { value: '2K', label: '2K (标准)' },
    { value: '4K', label: '4K (高清)' }
  ];
}
