
export enum ProjectStatus {
  IDLE = 'IDLE',
  UPLOADING = 'UPLOADING',
  ANALYZING = 'ANALYZING',
  GENERATING = 'GENERATING',
  DONE = 'DONE'
}

export enum ViewType {
  HOME = 'HOME',
  UPLOAD = 'UPLOAD',
  ANALYSIS = 'ANALYSIS',
  SETUP = 'SETUP',
  SUCCESS = 'SUCCESS',
  HISTORY = 'HISTORY',
  ASSETS = 'ASSETS',
  DIRECT_GENERATION = 'DIRECT_GENERATION',    // 直接生成阶段
  SCRIPT_GENERATION = 'SCRIPT_GENERATION',    // 脚本生成阶段
  FRAME_GENERATION = 'FRAME_GENERATION',      // 首帧生成阶段  
  VIDEO_GENERATION = 'VIDEO_GENERATION',      // 分镜生成阶段
  VIDEO_COMPOSITION = 'VIDEO_COMPOSITION'     // 视频合成阶段
}

export interface VideoScriptSegment {
  id: string;
  time: string;
  main_tag: string;
  info_density?: string;
  l2_visual?: string;
  visual_prompt: string;
  voiceover_text: string;
  retention_strategy: string;
  thumbnail?: string;
  sourceTitle?: string;
  niche?: string;
}

export interface DeconstructedVideo {
  id: string;
  title: string;
  niche: string;
  formula_name: string;
  visual_effect?: string;
  product_style?: string;
  effect_demo?: string;
  product_power?: string;
  structure: string;
  pace: string;
  core_elements: string;
  segments: VideoScriptSegment[];
  total_duration?: string;
  createdAt: string;
}

export interface ProductInfo {
  name: string;
  sellingPoints: string[];
  images: string[];
}

export interface GeneratedVideo {
  id: string;
  version: string;
  sellingPoint: string;
  thumbnail: string;
}

export interface AppState {
  currentView: ViewType;
  status: ProjectStatus;
  analysis: DeconstructedVideo | null;
  productInfo: ProductInfo;
  genCount: number;
  results: GeneratedVideo[];
  history: DeconstructedVideo[];
  assets: VideoScriptSegment[];
  // 新增：视频复刻相关状态
  replicationStatus: VideoGenerationStatus;
  currentReplication: ScriptReplicationResult | null;
  // 新增：图片生成配置
  imageConfig: ImageGenerationConfig;
}

// 图片生成配置
export interface ImageGenerationConfig {
  size: string; // 例如: '9:16', '16:9', '1:1' 等
  resolution: '2K' | '4K'; // 分辨率
}

// 视频生成状态
export enum VideoGenerationStatus {
  IDLE = 'IDLE',
  GENERATING_SCRIPT = 'GENERATING_SCRIPT',
  GENERATING_FRAMES = 'GENERATING_FRAMES', 
  GENERATING_VIDEOS = 'GENERATING_VIDEOS',
  COMPOSING_VIDEOS = 'COMPOSING_VIDEOS',
  COMPLETED = 'COMPLETED'
}

// 重构后的分镜脚本
export interface ReplicatedSegment {
  id: string;
  time: string;
  narrative_type: 'hook' | 'selling_point' | 'proof' | 'cta';
  script_content: string;
  video_prompt: string;
  frame_prompt: string;
  voiceover_text: string;
  generated_frames?: string[]; // 生成的首帧图片数组（数量 = genCount）
  generated_videos?: string[]; // 生成的视频数组（数量 = genCount）
}

// 脚本重构结果
export interface ScriptReplicationResult {
  id: string;
  original_analysis_id: string;
  product_info: ProductInfo;
  narrative_structure: string;
  visual_rhythm: string;
  core_elements: string;
  segments: ReplicatedSegment[];
  total_duration: string;
  createdAt: string;
}
