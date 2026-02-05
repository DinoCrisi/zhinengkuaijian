/**
 * 剪映工程文件导出服务
 * 使用后端 pyJianYingDraft 库生成真正的剪映工程文件
 * 支持导出分割后的视频分镜
 */

import { API_URLS } from '../config/apiConfig';

const JIANYING_API_URL = API_URLS.JIANYING_EXPORT_API;
const JIANYING_OUTPUT_URL = API_URLS.JIANYING_OUTPUT;
const VIDEO_SEGMENTS_URL = API_URLS.VIDEO_SEGMENTS;

export interface JianyingExportConfig {
  projectName: string;
  width: number;
  height: number;
  fps: number;
  draftPath?: string; // 可选的剪映草稿路径
}

export interface JianyingExportData {
  projectName: string;
  width: number;
  height: number;
  fps: number;
  segments: Array<{
    time: string;
    narrative_type: string;
    voiceover_text: string;
    script_content: string;
  }>;
  videos: string[];
  draftPath?: string; // 可选的剪映草稿路径
}

/**
 * 生成剪映工程文件（使用分割后的视频）
 */
export async function generateJianyingDraft(
  segments: any[],
  videoUrls: string[],
  config: JianyingExportConfig
): Promise<string> {
  console.log('🎬 开始生成剪映工程文件...');
  console.log(`项目名称: ${config.projectName}`);
  console.log(`分辨率: ${config.width}x${config.height}, FPS: ${config.fps}`);
  console.log(`分镜数: ${segments.length}, 视频数: ${videoUrls.length}`);

  // 构建导出数据
  const exportData: JianyingExportData = {
    projectName: config.projectName,
    width: config.width,
    height: config.height,
    fps: config.fps,
    segments: segments.map(seg => ({
      time: seg.time,
      narrative_type: seg.narrative_type || seg.main_tag,
      voiceover_text: seg.voiceover_text || '',
      script_content: seg.script_content || ''
    })),
    videos: videoUrls,
    ...(config.draftPath && { draftPath: config.draftPath }) // 如果提供了草稿路径，则添加到请求中
  };

  try {
    // 调用后端 API
    const response = await fetch(JIANYING_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(exportData)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `API 错误: ${response.status}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || '生成工程文件失败');
    }

    console.log('✅ 剪映工程文件生成成功');
    console.log(`下载链接: ${result.draftFile}`);

    return result.draftFile;
  } catch (error) {
    console.error('❌ 生成剪映工程文件失败:', error);
    throw error;
  }
}

/**
 * 下载剪映工程文件
 */
export async function downloadJianyingDraft(draftFile: string): Promise<void> {
  try {
    // draftFile 格式: "/output/filename.zip"
    // 需要进行 URL 编码以支持中文文件名
    const filename = draftFile.split('/').pop() || 'jianying_draft.zip';
    const encodedFilename = encodeURIComponent(filename);
    const downloadUrl = `${JIANYING_OUTPUT_URL}/${encodedFilename}`;
    
    console.log(`📥 下载剪映工程文件`);
    console.log(`原始文件名: ${filename}`);
    console.log(`编码文件名: ${encodedFilename}`);
    console.log(`下载链接: ${downloadUrl}`);

    // 创建下载链接
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    console.log('✅ 下载开始');
  } catch (error) {
    console.error('❌ 下载失败:', error);
    throw error;
  }
}

/**
 * 生成并下载剪映工程文件（使用生成的视频 URL）
 */
export async function generateAndDownloadJianyingDraft(
  segments: any[],
  videoUrls: string[],
  projectName: string,
  config?: Partial<JianyingExportConfig>
): Promise<void> {
  const fullConfig: JianyingExportConfig = {
    projectName,
    width: config?.width || 1920,
    height: config?.height || 1080,
    fps: config?.fps || 30
  };

  try {
    console.log('📹 使用生成的视频文件:');
    videoUrls.forEach((url, index) => {
      console.log(`  ${index + 1}. ${url.substring(0, 80)}...`);
    });

    // 生成工程文件（直接使用视频 URL）
    const draftFile = await generateJianyingDraft(segments, videoUrls, fullConfig);

    // 下载文件
    await downloadJianyingDraft(draftFile);
  } catch (error) {
    console.error('❌ 生成并下载剪映工程文件失败:', error);
    throw error;
  }
}

/**
 * 检查剪映服务是否可用
 */
export async function checkJianyingServiceAvailable(): Promise<boolean> {
  try {
    const response = await fetch(JIANYING_API_URL, {
      method: 'OPTIONS'
    });
    return response.ok;
  } catch (error) {
    console.warn('⚠️ 剪映服务不可用:', error);
    return false;
  }
}
