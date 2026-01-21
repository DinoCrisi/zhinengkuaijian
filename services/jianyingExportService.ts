/**
 * 剪映工程文件导出服务
 * 使用后端 pyJianYingDraft 库生成真正的剪映工程文件
 */

import { ReplicatedSegment } from '../types';

const JIANYING_API_URL = 'http://127.0.0.1:8890/api/generate-draft';
const JIANYING_OUTPUT_URL = 'http://127.0.0.1:8890/output';

export interface JianyingExportConfig {
  projectName: string;
  width: number;
  height: number;
  fps: number;
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
}

/**
 * 生成剪映工程文件
 */
export async function generateJianyingDraft(
  segments: ReplicatedSegment[],
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
      narrative_type: seg.narrative_type,
      voiceover_text: seg.voiceover_text,
      script_content: seg.script_content
    })),
    videos: videoUrls
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
    const downloadUrl = `${JIANYING_OUTPUT_URL}/${draftFile.split('/').pop()}`;
    
    console.log(`📥 下载剪映工程文件: ${downloadUrl}`);

    // 创建下载链接
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = draftFile.split('/').pop() || 'jianying_draft.zip';
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
 * 生成并下载剪映工程文件
 */
export async function generateAndDownloadJianyingDraft(
  segments: ReplicatedSegment[],
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
    // 生成工程文件
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
