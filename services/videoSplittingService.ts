/**
 * 视频分割服务
 * 根据分析结果将原视频按分镜拆分成多个片段
 * 使用英文命名：hook_001.mp4, selling_point_001.mp4 等
 */

import { DeconstructedVideo } from '../types';
import { API_URLS } from '../config/apiConfig';

const VIDEO_SPLITTING_API = API_URLS.VIDEO_SPLITTER_API;

export interface VideoSegmentFile {
  segmentId: string;
  narrativeType: string;
  filename: string;
  url: string;
  duration: number;
  timeRange: string;
}

export interface VideoSplittingResult {
  originalVideoUrl: string;
  analysisId: string;
  segments: VideoSegmentFile[];
  totalDuration: number;
  createdAt: string;
}

/**
 * 获取分镜类型的英文名称
 */
function getNarrativeTypeEnglish(narrativeType: string): string {
  const typeMap: Record<string, string> = {
    'hook': 'hook',
    'selling_point': 'selling_point',
    'proof': 'proof',
    'cta': 'cta',
    '钩子': 'hook',
    '卖点': 'selling_point',
    '证明': 'proof',
    '转化': 'cta'
  };
  return typeMap[narrativeType] || 'segment';
}

/**
 * 解析时间范围字符串
 * 格式: "0-3s" -> { start: 0, end: 3, duration: 3 }
 */
function parseTimeRange(timeStr: string): { start: number; end: number; duration: number } {
  const match = timeStr.match(/(\d+)-(\d+)s/);
  if (!match) {
    return { start: 0, end: 0, duration: 0 };
  }
  const start = parseInt(match[1]);
  const end = parseInt(match[2]);
  return { start, end, duration: end - start };
}

/**
 * 生成分镜文件名
 * 格式: hook_001.mp4, selling_point_002.mp4 等
 */
function generateSegmentFilename(narrativeType: string, index: number): string {
  const typeEnglish = getNarrativeTypeEnglish(narrativeType);
  const paddedIndex = String(index + 1).padStart(3, '0');
  return `${typeEnglish}_${paddedIndex}.mp4`;
}

/**
 * 分割视频
 */
export async function splitVideoByAnalysis(
  videoFile: File,
  analysis: DeconstructedVideo
): Promise<VideoSplittingResult> {
  console.log('🎬 开始分割视频...');
  console.log(`原视频: ${videoFile.name}`);
  console.log(`分镜数: ${analysis.segments.length}`);

  // 创建 FormData
  const formData = new FormData();
  formData.append('video', videoFile);
  formData.append('analysis', JSON.stringify(analysis));

  try {
    // 调用后端 API
    const response = await fetch(VIDEO_SPLITTING_API, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `API 错误: ${response.status}`);
    }

    const result = await response.json();

    console.log('✅ 视频分割成功');
    console.log(`生成 ${result.segments.length} 个分镜文件`);
    result.segments.forEach((seg: VideoSegmentFile) => {
      console.log(`  - ${seg.filename} (${seg.duration}s)`);
    });

    return result;
  } catch (error) {
    console.error('❌ 视频分割失败:', error);
    throw error;
  }
}

/**
 * 本地生成分镜文件名列表（不实际分割，仅用于预览）
 */
export function generateSegmentFilenames(analysis: DeconstructedVideo): VideoSegmentFile[] {
  return analysis.segments.map((segment, index) => {
    const filename = generateSegmentFilename(segment.main_tag, index);
    const timeRange = parseTimeRange(segment.time);
    
    return {
      segmentId: segment.id,
      narrativeType: segment.main_tag,
      filename,
      url: '', // 实际 URL 由后端生成
      duration: timeRange.duration,
      timeRange: segment.time
    };
  });
}

/**
 * 获取分镜文件的本地 Blob URL（用于预览）
 */
export async function getSegmentBlobUrl(
  videoFile: File,
  timeRange: { start: number; end: number }
): Promise<string> {
  // 这是一个简化的实现，实际需要使用 FFmpeg 或后端服务
  // 返回原视频的 Blob URL 作为占位符
  return URL.createObjectURL(videoFile);
}
