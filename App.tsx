import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ChevronLeft, Plus, Zap, Play, Download, Trash2, 
  Upload as UploadIcon, History as HistoryIcon, Layout, CheckCircle2,
  ArrowRight, Settings, Image as ImageIcon, ExternalLink, Sparkles,
  FileJson, Search, Filter, Layers, Clock, MoreHorizontal, Copy
} from 'lucide-react';
import { ViewType, ProjectStatus, AppState, DeconstructedVideo, GeneratedVideo, VideoScriptSegment, VideoGenerationStatus, ScriptReplicationResult, ReplicatedSegment, ImageGenerationConfig } from './types';
import { analyzeVideoReal } from './services/videoAnalysisService';
import { GlassCard } from './components/GlassCard';
import { StepIndicator } from './components/StepIndicator';

// --- Main App ---

export default function App() {
  // --- States ---
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [srtContent, setSrtContent] = useState<string>('');
  const [srtFileName, setSrtFileName] = useState<string>('');
  const [isSrtTranscribing, setIsSrtTranscribing] = useState<boolean>(false);
  const [productDesc, setProductDesc] = useState<string>('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'segments' | 'formula'>('segments');
  const [assetSearch, setAssetSearch] = useState('');
  const [assetFilter, setAssetFilter] = useState('全部');
  const [assetSort, setAssetSort] = useState<'time' | 'tag'>('time');
  const [historySearch, setHistorySearch] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [toasts, setToasts] = useState<Array<{ id: string; type: 'success' | 'error' | 'info'; message: string }>>([]);
  
  // 直接生成相关状态
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedStructure, setSelectedStructure] = useState<string | null>(null);
  
  // 素材详情卡片显示状态
  const [expandedAsset, setExpandedAsset] = useState<string | null>(null);

  const pushToast = (type: 'success' | 'error' | 'info', message: string) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts(prev => [...prev, { id, type, message }]);
    window.setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4200);
  };

  const formatErrorMessage = (error: unknown) => (error instanceof Error ? error.message : '未知错误');

  // --- Effects ---
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // 视频合成状态
  const [compositionStatus, setCompositionStatus] = useState<'idle' | 'composing' | 'completed'>('idle');
  const [composedVideos, setComposedVideos] = useState<Array<{
    id: string;
    version: number;
    outputUrl: string;
    progress: number;
    status: 'pending' | 'processing' | 'completed' | 'failed';
  }>>([]);

  const [state, setState] = useState<AppState>(() => {
    // 临时清除旧数据，确保使用新的初始素材库数据
    localStorage.removeItem('smartclip_v2_data');
    const saved = localStorage.getItem('smartclip_v2_data');
    
    // 从素材库.txt导入的初始数据
    const rawAssets = [
      { "product_name": "厨房刷", "segments": [
        { "primary_tag": "钩子", "secondary_tags": ["高密度", "产品特写+行为演示"], "timecode": "00:00-00:04", "description": "展示按压出液式锅刷，往手柄加洗洁精后按压出液", "prompt": "厨房水槽场景，白色按压式锅刷特写，手往手柄倒入透明洗洁精，按压手柄刷头出液，水流清晰，背景是整洁厨房，自然光，静态镜头，4k画质，细节丰富。", "first_frame_prompt": "特写构图，画面主体为白色按压式锅刷，手握着锅刷手柄，另一只手往手柄倒入透明洗洁精，背景是厨房水槽，光线明亮柔和，4K超高清，照片级真实感，细节丰富，专业商业摄影。" },
        { "primary_tag": "证明", "secondary_tags": ["中密度", "行为演示+对比镜头"], "timecode": "00:04-00:08", "description": "对比展示锅刷和钢丝球刷锅的效果，锅刷不脏手不烫手，钢丝球伤锅掉渣", "prompt": "厨房水槽场景，左边手用白色锅刷快速刷洗热锅，泡沫丰富；右边手用钢丝球刷锅，锅具表面有划痕，钢丝球掉渣，分屏对比，自然光，动态镜头，4k画质，细节清晰。", "first_frame_prompt": "分屏构图，左右对称，左边画面是手握着白色锅刷刷洗热锅，泡沫丰富；右边画面是手握着钢丝球刷锅，锅具表面有划痕，背景是厨房水槽，光线明亮，4K超高清，照片级真实感，细节丰富，专业商业摄影。" },
        { "primary_tag": "卖点", "secondary_tags": ["中密度", "产品特写"], "timecode": "00:08-00:11", "description": "展示锅刷的可旋转刷头，强调使用灵活性与方便性", "prompt": "厨房水槽场景，手握着白色锅刷，旋转刷头展示多角度灵活性，背景整洁，自然光，静态特写，4k画质，细节清晰。", "first_frame_prompt": "特写构图，画面主体为白色锅刷的刷头，手正在旋转刷头，展示其可多角度转动的特性，背景是厨房水槽，光线明亮，4K超高清，照片级真实感，细节丰富，专业商业摄影。" },
        { "primary_tag": "证明", "secondary_tags": ["中密度", "行为演示"], "timecode": "00:11-00:17", "description": "演示锅刷直立状态下刷洗水壶、破壁机壶底的效果，展示多功能性", "prompt": "厨房场景，手握着白色锅刷，切换手柄为直立状态，深入玻璃水壶和破壁机内部刷洗壶底，泡沫丰富，背景整洁，自然光，动态镜头，4k画质，细节清晰。", "first_frame_prompt": "中景构图，画面主体为手握着白色锅刷，将手柄切换为直立状态，深入玻璃水壶内部，背景是厨房台面，光线明亮，4K超高清，照片级真实感，细节丰富，专业商业摄影。" },
        { "primary_tag": "卖点", "secondary_tags": ["中密度", "产品特写+行为演示"], "timecode": "00:17-00:21", "description": "介绍锅刷的PET刷毛材质，演示其清洁不同锅具且不伤锅的效果", "prompt": "厨房场景，手触摸白色锅刷的灰色PET刷毛，展示刷毛软硬适中，然后用锅刷分别刷洗黑色炒锅和浅色炖锅，泡沫丰富，锅具无划痕，自然光，动态镜头，4k画质，细节清晰。", "first_frame_prompt": "特写构图，画面主体为白色锅刷的灰色PET刷毛，手正在触摸刷毛，展示其软硬适中的质感，背景是厨房水槽，光线明亮，4K超高清，照片级真实感，细节丰富，专业商业摄影。" },
        { "primary_tag": "证明", "secondary_tags": ["中密度", "行为演示"], "timecode": "00:21-00:28", "description": "演示按压出液功能，并用锅刷清洁煎锅、碗、菜板、水槽，展示多场景使用", "prompt": "厨房场景，手按压白色锅刷手柄出液，分别刷洗浅色煎锅、带图案的碗、粉色菜板、不锈钢水槽，泡沫丰富，清洁效果明显，自然光，动态镜头，4k画质，细节清晰。", "first_frame_prompt": "中景构图，画面主体为手按压白色锅刷手柄出液，下方是浅色煎锅，背景是厨房台面，光线明亮，4K超高清，照片级真实感，细节丰富，专业商业摄影。" },
        { "primary_tag": "卖点", "secondary_tags": ["低密度", "产品特写+行为演示"], "timecode": "00:28-00:34", "description": "介绍锅刷手柄的易清洁、不发霉特性，展示悬挂收纳和两款颜色", "prompt": "厨房场景，手握着白色锅刷在水龙头下冲洗，水流冲净刷毛，然后将锅刷悬挂在挂架上，最后双手分别拿着白色和米白绿色两款锅刷，背景整洁，自然光，静态镜头，4k画质，细节清晰。", "first_frame_prompt": "中景构图，画面主体为手握着白色锅刷在水龙头下冲洗，水流清晰，背景是厨房水槽，光线明亮，4K超高清，照片级真实感，细节丰富，专业商业摄影。" }
      ]},
      { "product_name": "电饭煲", "segments": [
        { "primary_tag": "钩子", "secondary_tags": ["高密度", "产品特写+行为演示"], "timecode": "00:00-00:04", "description": "展示迷你电饭锅的分层内胆结构，取出装有汤的内胆，露出下方电饭锅内的米饭和香肠，同时口播介绍是给婆婆的迷你电饭锅，适合一两口人", "prompt": "俯视角度，木质桌面，白色迷你电饭锅，双手取出分层不锈钢内胆，内胆装有黄色汤品，下方锅内是米饭和香肠切片，暖色调自然光，静态镜头，真实家庭场景，4k画质，细节丰富", "first_frame_prompt": "俯视构图，画面比例16:9，暖色调柔和自然光，明亮清晰。主体为白色迷你电饭锅，一只手正在取出上层不锈钢内胆，内胆装有少量液体，左侧是粉色同款电饭锅，背景是灰色窗帘与木质桌面。4K超高清，照片级真实感，细节丰富，生活化场景拍摄" },
        { "primary_tag": "卖点", "secondary_tags": ["中密度", "产品特写+行为演示"], "timecode": "00:04-00:08", "description": "展示印有“Rainbow piggy”的白色便携收纳袋，从袋中取出白色迷你电饭锅，口播说明操作简单，适合1-2人使用", "prompt": "中景，木质桌面，双手从白色便携袋中取出白色迷你电饭锅，袋身印有“Rainbow piggy”字样，背景是灰色窗帘与绿植，暖色调自然光，静态镜头，4k画质，细节丰富", "first_frame_prompt": "中景构图，画面比例16:9，暖色调柔和自然光，明亮清晰。主体为白色便携袋与白色迷你电饭锅，双手正在从袋中取出电饭锅，背景是灰色窗帘、绿植与木质桌面。4K超高清，照片级真实感，细节丰富，生活化场景拍摄" },
        { "primary_tag": "证明", "secondary_tags": ["中密度", "行为演示"], "timecode": "00:08-00:10", "description": "双手持透明量杯，往白色迷你电饭锅内倒入两杯米，直观证明容量刚好适合1-2人", "prompt": "俯视角度，木质桌面，双手持两个装米的透明量杯，往白色迷你电饭锅内倒米，米粒流动清晰可见，暖色调自然光，动态镜头，4k画质，细节丰富", "first_frame_prompt": "俯视构图，画面比例16:9，暖色调柔和自然光，明亮清晰。主体为白色迷你电饭锅与两个装米的透明量杯，双手正在往锅内倒米，米粒呈流动状，背景是木质桌面。4K超高清，照片级真实感，细节丰富，生活化场景拍摄" },
        { "primary_tag": "证明", "secondary_tags": ["中密度", "行为演示+产品特写"], "timecode": "00:10-00:12", "description": "一只手拿着装有米饭的白色小碗，另一只手用木勺从白色迷你电饭锅里盛出冒着热气的南瓜汤，口播说明熬粥煲汤不会溢锅，煮的米饭好吃", "prompt": "中景，木质桌面，手持装米饭的白色小碗，木勺盛出电饭锅内的南瓜块汤品，汤面冒着热气，暖色调自然光，动态镜头，4k画质，细节丰富", "first_frame_prompt": "中景构图，画面比例16:9，暖色调柔和自然光，明亮清晰。主体为白色迷你电饭锅、木勺与装米饭的白色小碗，木勺盛出带南瓜块的汤品，汤面有热气，背景是灰色窗帘与木质桌面。4K超高清，照片级真实感，细节丰富，生活化场景拍摄" },
        { "primary_tag": "证明", "secondary_tags": ["中密度", "行为演示+产品特写"], "timecode": "00:12-00:13", "description": "双手把装有南瓜盅（内含食材）的白色内胆，放进粉色迷你电饭锅内，证明产品具备蒸制功能", "prompt": "俯视角度，木质桌面，双手将装着南瓜盅的白色内胆放进粉色迷你电饭锅，南瓜盅内有红枣等食材，暖色调自然光，静态镜头，4k画质，细节丰富", "first_frame_prompt": "俯视构图，画面比例16:9，暖色调柔和自然光，明亮清晰。主体为粉色迷你电饭锅与装南瓜盅的白色内胆，双手正在将内胆放进锅内，南瓜盅内有食材，背景是木质桌面。4K超高清，照片级真实感，细节丰富，生活化场景拍摄" },
        { "primary_tag": "证明", "secondary_tags": ["中密度", "行为演示"], "timecode": "00:13-00:15", "description": "在厨房水槽前，双手拿着浅绿色迷你电饭锅在水流下冲洗，锅体一冲即净，证明清洗方便", "prompt": "中景，厨房水槽，双手持浅绿色迷你电饭锅在水流下冲洗，水流清澈，锅体表面无残留，冷色调自然光，动态镜头，4k画质，细节丰富", "first_frame_prompt": "中景构图，画面比例16:9，冷色调明亮自然光，清晰干净。主体为浅绿色迷你电饭锅与厨房水槽，双手拿着锅在水流下冲洗，水流冲击锅体，背景是洗手台与镜子。4K超高清，照片级真实感，细节丰富，生活化场景拍摄" }
      ]},
      { "product_name": "一次性拖把", "segments": [
        { "primary_tag": "钩子", "secondary_tags": ["高密度", "行为演示+对比镜头"], "timecode": "00:00-00:05", "description": "演示将透明无纺布扫把套套在扫把上清扫地面垃圾，对比展示普通扫把粘头发需用手抠的家务痛点", "prompt": "中景+特写结合，(前半段)双手将透明无纺布扫把套套在浅棕手柄的扫把上，清扫大理石地面的纸屑垃圾；(后半段)一只手抠普通扫把上粘缠的头发，室内明亮自然光，真实家居场景，4k画质，细节丰富。", "first_frame_prompt": "中景构图，画面比例16:9，双手拿着透明无纺布扫把套准备套在浅棕手柄扫把上，背景是浅灰大理石地面和灰色柜子，光线明亮柔和，来自顶部的室内自然光。主体为透明轻薄的扫把套和浅棕扫把，材质纹理清晰可见。4K超高清，照片级真实感，细节丰富，生活化摄影。" },
        { "primary_tag": "卖点", "secondary_tags": ["中密度", "产品特写+行为演示"], "timecode": "00:05-00:16", "description": "介绍扫把套为无纺布材质，透明有弹性，可随意拉伸套在扫把上，弹力收缩好不易滑落", "prompt": "特写镜头，双手拉扯扫把套的弹性带展示拉伸性，将透明扫把套套在扫把上展示贴合度，背景有黄色仿真植物和白色台面，室内明亮光线，4k画质，清晰呈现材质纹理。", "first_frame_prompt": "特写构图，画面比例16:9，一只手戴着透明无纺布扫把套展示轻薄通透的材质，背景是白色台面和黄色仿真植物，光线明亮柔和，来自侧上方的散射光。扫把套纹理清晰，手部皮肤细节可见。4K超高清，照片级真实感，细节丰富，商业产品摄影。" },
        { "primary_tag": "证明", "secondary_tags": ["中密度", "行为演示+场景空镜"], "timecode": "00:16-00:22", "description": "展示用套有扫把套的扫把清扫柜子底下的垃圾、地面碎屑以及墙壁灰尘，清洁效果干净彻底", "prompt": "中景拍摄，用套好扫把套的扫把清扫电视柜底下的垃圾、大理石地面的瓜子壳碎屑、浅灰墙面的灰尘，室内家居场景，明亮自然光，4k画质，真实还原清洁场景。", "first_frame_prompt": "中景构图，画面比例16:9，扫把清扫电视柜底下的垃圾，背景是浅灰大理石地面和灰色电视柜，光线明亮，来自室内顶部光源。垃圾细节清晰，扫把套贴合扫把的状态可见。4K超高清，照片级真实感，细节丰富，生活化摄影。" },
        { "primary_tag": "转化", "secondary_tags": ["中密度", "行为演示+产品特写"], "timecode": "00:22-00:26", "description": "演示将脏了的扫把套摘下直接丢进垃圾桶，随后展示一堆扫把套，引导用户囤货购买", "prompt": "特写+中景结合，将脏扫把套从红色扫把上摘下丢进绿色壁挂垃圾桶，接着双手捧着一堆白色扫把套放在白色台面上，室内明亮光线，4k画质，传递便捷性和高性价比。", "first_frame_prompt": "特写构图，画面比例16:9，手将脏扫把套丢进绿色壁挂垃圾桶，背景是白色台面和仿真花草，光线明亮柔和。垃圾桶和扫把套的细节清晰可见。4K超高清，照片级真实感，细节丰富，商业产品摄影。" }
      ]},
      { "product_name": "充电线", "segments": [
        { "primary_tag": "钩子", "secondary_tags": ["高密度", "对比镜头+产品特写"], "timecode": "00:00-00:05", "description": "画面快速切换，先展示暖水壶水开自动断电，再抛出疑问“为什么充电线不能”，搭配普通充电线特写", "prompt": "快切镜头，(00:00-00:02)红色电热水壶特写，底座指示灯熄灭；(00:02-00:05)黑色Type-C充电线特写，白色加粗文字“不能？”叠加画面中心，冷调光线，高对比度，动态剪辑，4k画质，冲击力强", "first_frame_prompt": "特写构图，画面左侧是红色电热水壶，底座橙色指示灯亮起，背景是蓝色墙面模糊人影；光线偏暖，电热水壶金属质感反光明显，画面比例16:9，4K超高清，照片级真实感，细节丰富" },
        { "primary_tag": "场景", "secondary_tags": ["低密度", "行为演示+产品特写"], "timecode": "00:05-00:10", "description": "演示用户日常场景：手机充电到100%仍未拔线，随后展示手机电池健康仅80%，传递过充痛点", "prompt": "中景镜头，黑色手机放置在支架上充电，电量从54%跳转到100%；随后特写手机屏幕显示“电池健康 最大容量80%”，暖调室内光线，静态镜头，真实感摄影，4k画质，细节清晰", "first_frame_prompt": "中景构图，画面中心是黑色手机支架，手机屏幕显示电量54%正在充电，背景是浅紫色墙面与桌面台灯；光线柔和，来自右侧的散射光，手机屏幕亮度适中，画面比例16:9，4K超高清，照片级真实感，细节丰富" },
        { "primary_tag": "卖点", "secondary_tags": ["中密度", "产品特写+行为演示"], "timecode": "00:10-00:17", "description": "展示黑色编织数据线，插入手机后蓝色呼吸灯亮起；演示快充效果，手机电量快速从13%上升，文案说明支持120W闪充、适配华为苹果", "prompt": "特写镜头，黑色编织数据线插入黑色手机接口，蓝色呼吸灯亮起；随后快切手机充电界面，电量从13%快速跳转到76%，暖调桌面光线，动态镜头，科技感氛围，4k画质，细节丰富", "first_frame_prompt": "特写构图，画面中心是黑色Type-C数据线接口插入手机，蓝色呼吸灯亮起4颗；手机放置在浅木色桌面，背景有白色台灯与宇航员摆件；光线明亮，呼吸灯蓝色光清晰，画面比例16:9，4K超高清，照片级真实感，细节丰富" },
        { "primary_tag": "卖点", "secondary_tags": ["中密度", "场景空镜+行为演示"], "timecode": "00:17-00:22", "description": "展示1.8米数据线的长度优势：床上用户伸手接手机，沙发上用户以不同姿势边充边玩，文案说明“任你什么姿势都能边充边玩不受限”", "prompt": "多场景镜头切换，(00:17-00:19)卧室场景，用户坐在床上伸手接充电的手机；(00:19-00:22)沙发场景，用户躺着、半躺着用手机充电，暖调室内光线，动态镜头，生活化氛围，4k画质，细节丰富", "first_frame_prompt": "中景构图，画面中心是用户坐在酒店床上伸手接充电的手机，数据线长度覆盖床与镜头的距离；背景是灰色床头板与暖黄台灯，光线柔和，画面比例16:9，4K超高清，照片级真实感，细节丰富" },
        { "primary_tag": "证明", "secondary_tags": ["中密度", "产品特写+对比镜头"], "timecode": "00:22-00:29", "description": "特写数据线呼吸灯，充电时亮起4颗蓝色灯，充满后灯熄灭；通过动画演示智能功能：满电断电，2小时后自动检测电量并补电", "prompt": "特写+动画结合镜头，(00:22-00:24)数据线接口蓝色呼吸灯从4颗逐渐熄灭；(00:24-00:29)动画演示：手机满电100%后断电，2小时后电量降至98%，数据线自动重启充电，冷调科技感光线，动态动画，4k画质，细节清晰", "first_frame_prompt": "特写构图，画面中心是黑色数据线接口，4颗蓝色呼吸灯亮起；背景是浅木色桌面，光线明亮，呼吸灯蓝色光均匀，画面比例16:9，4K超高清，照片级真实感，细节丰富" },
        { "primary_tag": "场景", "secondary_tags": ["低密度", "行为演示+场景空镜"], "timecode": "00:29-00:32", "description": "展示不同用户场景：咖啡厅用户边充边玩，卧室用户放心休息，传递“不再有过充焦虑，安全感拉满”的感受", "prompt": "多场景镜头切换，(00:29-00:30)咖啡厅场景，用户手持手机边充边玩；(00:30-00:32)卧室场景，手机放在床头柜充电，背景用户伸懒腰起床，暖调自然光，静态镜头，安心氛围，4k画质，细节丰富", "first_frame_prompt": "中景构图，画面中心是用户在咖啡厅手持手机，数据线连接手机；背景是白色瓷砖桌面与模糊的咖啡厅环境，光线明亮柔和，画面比例16:9，4K超高清，照片级真实感，细节丰富" },
        { "primary_tag": "转化", "secondary_tags": ["中密度", "产品特写+人脸直出"], "timecode": "00:32-00:35.5", "description": "展示数据线特写，竖大拇指手势传递认可；文案说明“3C大厂迅即出品”“多备几条也不心疼”，引导用户购买", "prompt": "特写+中景镜头，(00:32-00:33)黑色编织数据线特写，用户竖大拇指手势；(00:33-00:35.5)画面叠加白色文字“迅即XUNJI 出品”，暖调光线，静态镜头，信任氛围，4k画质，细节清晰", "first_frame_prompt": "中景构图，画面中心是用户手持黑色编织数据线，另一只手竖大拇指；背景是蓝色墙面，光线明亮，用户手势清晰，画面比例16:9，4K超高清，照片级真实感，细节丰富" }
      ]},
      { "product_name": "脱毛膏", "segments": [
        { "primary_tag": "钩子", "secondary_tags": ["高密度", "行为演示+产品特写"], "timecode": "00:00-00:06", "description": "以“蜂蜜也能用来脱毛？”的疑问开场，展示刀头淋蜂蜜，快速呈现新款紫色脱毛刀遇水起泡、高效无痛脱毛的核心特性，吸引用户停留", "prompt": "特写镜头，一只手拿着紫色手柄的脱毛刀，蜂蜜从上方淋在刀头，刀头遇水后产生绵密泡沫，背景为浴室洗手台，明亮自然光，真实感摄影，4k画质，细节丰富", "first_frame_prompt": "特写构图，刀头居中，蜂蜜从上方淋在白色刀头，手柄为紫色，背景是灰色洗手台，光线明亮，蜂蜜呈琥珀色，刀头细节清晰，4K超高清，照片级真实感，细节丰富" },
        { "primary_tag": "卖点", "secondary_tags": ["中密度", "人脸直出+对比镜头"], "timecode": "00:06-00:21", "description": "主播口播介绍线上专属紫色款，清洁时拆刀头水冲即净；对比线下超市69元1刀头，线上59.9元含1手柄2刀头；说明添加天然蜂蜜成分，温和不刺激", "prompt": "中景镜头，主播手持紫色脱毛刀，身后画面分屏展示线下超市价格标签与线上订单页面，主播表情生动，室内柔和灯光，生活化场景，4k画质", "first_frame_prompt": "中景构图，主播位于画面右侧，手持紫色脱毛刀，左侧分屏展示线下超市69元的价格标签，背景为室内沙发，光线柔和，主播表情自然，4K超高清，照片级真实感，细节丰富" },
        { "primary_tag": "证明", "secondary_tags": ["高密度", "行为演示+对比镜头+特写"], "timecode": "00:21-00:38", "description": "演示刀头上下左右伸缩贴合皮肤；用鸡蛋模拟皮肤，展示刀头防护网设计不刮伤皮肤；刀头遇水起绵密泡沫；展示胳膊、腋下、腿的大面积脱毛效果，验证产品贴合性、安全性、高效性", "prompt": "多镜头切换：特写刀头伸缩结构，特写刀头刮鸡蛋（鸡蛋无破损），中景演示刀头在手上起泡，分屏展示胳膊、腋下、腿脱毛前后对比，明亮自然光，真实感摄影，4k画质", "first_frame_prompt": "特写构图，刀头居中，手指按压刀头展示伸缩结构，刀头细节清晰，背景为灰色台面，光线明亮，4K超高清，照片级真实感，细节丰富" },
        { "primary_tag": "场景", "secondary_tags": ["低密度", "行为演示+场景空镜"], "timecode": "00:38-00:48", "description": "演示使用后扣好刀头倒放控水，模拟日常使用后的收纳场景，展示产品使用后的卫生收纳方式", "prompt": "中景镜头，手拿着扣好刀头的紫色脱毛刀，倒放在洗手台控水，背景为浴室场景，明亮自然光，生活化场景，4k画质", "first_frame_prompt": "中景构图，脱毛刀倒放在洗手台，刀头朝下控水，背景为灰色洗手台，光线明亮，4K超高清，照片级真实感，细节丰富" },
        { "primary_tag": "转化", "secondary_tags": ["中密度", "人脸直出+场景空镜"], "timecode": "00:48-00:56", "description": "主播手持脱毛刀号召用户趁着旺季前囤货，强调产品早晚都能用，天热露胳膊露腿需求大，促使用户立即下单", "prompt": "中景镜头，主播手持两支紫色脱毛刀，身后画面展示穿吊带、短裤的皮肤光滑的身体，主播表情急切，室内柔和灯光，4k画质", "first_frame_prompt": "中景构图，主播位于画面左侧，手持两支紫色脱毛刀，右侧展示穿白色吊带的光滑胳膊，背景为室内沙发，光线柔和，主播表情生动，4K超高清，照片级真实感，细节丰富" }
      ]}
    ];
    
    // 转换素材库数据为应用所需的VideoScriptSegment格式
    const convertToAsset = (segment: any, index: number, productIndex: number): VideoScriptSegment => {
      // 解析timecode为秒数格式，如"0-4s"
      const parseTimecode = (timecode: string): string => {
        const [start, end] = timecode.split('-');
        const parseTime = (time: string): number => {
          const [minutes, seconds] = time.split(':').map(Number);
          return minutes * 60 + seconds;
        };
        return `${parseTime(start)}-${parseTime(end)}s`;
      };
      
      return {
        id: `asset-${productIndex}-${index}`,
        time: parseTimecode(segment.timecode),
        main_tag: segment.primary_tag,
        info_density: segment.secondary_tags[0],
        l2_visual: segment.secondary_tags[1],
        visual_prompt: segment.prompt,
        voiceover_text: segment.description,
        retention_strategy: segment.description,
        thumbnail: `https://ui-avatars.com/api/?name=${encodeURIComponent(segment.primary_tag || 'Asset')}&background=4338ca&color=fff`,
        sourceTitle: segment.product_name || '',
        niche: '' // 可以根据需要从product_name推导
      };
    };
    
    // 转换所有素材
    const initialAssets: VideoScriptSegment[] = rawAssets.flatMap((product, productIndex) => 
      product.segments.map((segment: any, index: number) => 
        convertToAsset({ ...segment, product_name: product.product_name }, index, productIndex)
      )
    );
    
    // 初始历史数据（保持不变）
    const initialHistory: DeconstructedVideo[] = [
      {
        id: 'h-1',
        title: '某爆款美妆精华测评 - 100w+点赞',
        niche: '美妆/个护',
        formula_name: '痛点对比式',
        structure: '糟糕现状 -> 产品切入 -> 惊人反差',
        pace: '1.2s/镜头',
        core_elements: '大字幕, 极速卡点',
        createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
        segments: [
          { id: 's1', time: '0-2s', main_tag: '痛点', info_density: '高', l2_visual: '糟糕现状', visual_prompt: 'Close up skin problems', voiceover_text: '你以为你的脸真的洗干净了吗？', retention_strategy: 'Fear of missing out', thumbnail: 'https://ui-avatars.com/api/?name=Skincare&background=4338ca&color=fff' },
          { id: 's2', time: '2-5s', main_tag: '产品', info_density: '中', l2_visual: '产品特写', visual_prompt: 'Product aesthetic shot', voiceover_text: '其实你需要的是这款氨基酸洁面', retention_strategy: 'Visual satisfaction', thumbnail: 'https://ui-avatars.com/api/?name=Product&background=4338ca&color=fff' }
        ]
      },
      {
        id: 'h-2',
        title: '智能家居好物分享 - 50w+点赞',
        niche: '家居/数码',
        formula_name: '生活场景式',
        structure: '懒人需求 -> 自动操作 -> 优雅生活',
        pace: '2.5s/镜头',
        core_elements: '柔和光影, 暖色调',
        createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
        segments: [
          { id: 's3', time: '0-3s', main_tag: '钩子', info_density: '高', l2_visual: '场景钩子', visual_prompt: 'Person tired after work', voiceover_text: '下班回家最累的就是打扫卫生', retention_strategy: 'Empathy', thumbnail: 'https://ui-avatars.com/api/?name=Home&background=4338ca&color=fff' }
        ]
      }
    ];

    const initial: AppState = {
      currentView: ViewType.HOME,
      status: ProjectStatus.IDLE,
      analysis: null,
      productInfo: { name: '', sellingPoints: [''], images: [] },
      genCount: 3,
      results: [],
      history: initialHistory,
      assets: initialAssets.filter(a => a.main_tag), // Filter out assets without tags
      // 新增：视频复刻相关状态
      replicationStatus: VideoGenerationStatus.IDLE,
      currentReplication: null,
      // 新增：图片生成配置（默认竖屏 9:16，2K分辨率）
      imageConfig: {
        size: '9:16',
        resolution: '2K'
      }
    };

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        
        // 直接使用保存的assets，如果没有则使用initialAssets
        // 不再从history重新生成assets，确保素材库数据正确显示
        const restoredAssets = parsed.assets || initialAssets;
        const restoredHistory = parsed.history || initialHistory;
        
        // 强制重置 productInfo.sellingPoints 为空，避免加载旧的原视频特征
        return { 
          ...initial, 
          ...parsed,
          history: restoredHistory,
          assets: restoredAssets.filter(a => a.main_tag), // 使用保存的assets或initialAssets
          productInfo: { 
            name: '', 
            sellingPoints: [''], 
            images: [] 
          },
          currentView: ViewType.HOME, 
          status: ProjectStatus.IDLE 
        };
      } catch (e) { return initial; }
    }
    return initial;
  });

  useEffect(() => {
    try {
      // 只存储必要的文本数据，不存储 Blob URLs 和生成的图片
      const dataToSave = {
        history: state.history.map(h => ({
          ...h,
          segments: h.segments.map(s => ({
            ...s,
            thumbnail: undefined // 不存储缩略图 URLs
          }))
        })),
        assets: state.assets.map(a => ({
          ...a,
          thumbnail: undefined // 不存储缩略图 URLs
        })),
        productInfo: {
          name: state.productInfo.name,
          sellingPoints: [''], // 不保存 sellingPoints，始终重置为空
          images: [] // Blob URLs 不持久化
        },
        genCount: state.genCount,
        imageConfig: state.imageConfig
        // 注意：不存储 currentReplication，因为它包含生成的图片 URLs
      };
      
      localStorage.setItem('smartclip_v2_data', JSON.stringify(dataToSave));
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
      // 如果存储失败，清除旧数据重试
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        console.warn('LocalStorage quota exceeded, clearing old data...');
        localStorage.removeItem('smartclip_v2_data');
      }
    }
  }, [state.history, state.assets, state.productInfo, state.genCount, state.imageConfig]);

  useEffect(() => {
    setState(s => {
      const seen = new Map<string, number>();
      const assets = s.assets.map((a, i) => {
        const id = a.id || `seg-${i}`;
        const count = (seen.get(id) || 0) + 1;
        seen.set(id, count);
        return count > 1 ? { ...a, id: `${id}-${i}` } : a;
      });
      return { ...s, assets };
    });
  }, []);
  // Cleanup preview URL
  useEffect(() => {
    const currentUrl = previewUrl;
    return () => {
      if (currentUrl && currentUrl.startsWith('blob:')) {
        URL.revokeObjectURL(currentUrl);
      }
    };
  }, [previewUrl]);

  // Navigation logic
  const navigate = (view: ViewType) => setState(prev => ({ ...prev, currentView: view }));

  // Actions
  const onUploadStart = (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent<HTMLDivElement>) => {
    let file: File | null = null;
    console.log('Upload event triggered:', e.type);

    if (e.type === 'change') {
        const target = (e as React.ChangeEvent<HTMLInputElement>).target;
        if (target.files && target.files.length > 0) {
            file = target.files[0];
        }
    } else if (e.type === 'drop') {
        const transfer = (e as React.DragEvent<HTMLDivElement>).dataTransfer;
        if (transfer.files && transfer.files.length > 0) {
            file = transfer.files[0];
        }
    }

    if (file) {
        console.log('File selected:', file.name);
        setSelectedFile(file);
        
        // 生成预览 URL
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);

        setState(prev => ({ ...prev, status: ProjectStatus.UPLOADING }));
        setTimeout(() => {
          setState(prev => ({ ...prev, status: ProjectStatus.IDLE }));
        }, 1200);
    } else {
        console.warn('No file found in event');
    }
  };

  const onSrtUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSrtFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setSrtContent(content);
      };
      reader.readAsText(file);
    }
  };

  const handleAutoTranscribeSrt = async () => {
    if (!selectedFile) {
      pushToast('error', '请先上传视频文件');
      return;
    }
    
    // 检查文件大小（建议不超过100MB）
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (selectedFile.size > maxSize) {
      pushToast('error', `视频文件过大（${(selectedFile.size / 1024 / 1024).toFixed(1)}MB），建议不超过100MB`);
      return;
    }
    
    // 检查文件格式
    const supportedFormats = ['video/mp4', 'video/avi', 'video/mov', 'video/mkv'];
    if (!supportedFormats.includes(selectedFile.type) && !selectedFile.name.toLowerCase().match(/\.(mp4|avi|mov|mkv)$/)) {
      pushToast('error', '不支持的视频格式，请使用MP4、AVI、MOV或MKV格式');
      return;
    }
    
    setIsSrtTranscribing(true);
    pushToast('info', '开始识别字幕，请耐心等待...');
    
    try {
      const { transcribeVideoToSrt } = await import('./services/videoCompositionService');
      
      console.log(`开始转录视频: ${selectedFile.name}`);
      console.log(`文件大小: ${(selectedFile.size / 1024 / 1024).toFixed(2)}MB`);
      
      const res = await transcribeVideoToSrt(selectedFile, 'base', 0);
      
      if (!res.srt || res.srt.trim() === '') {
        pushToast('error', '未能识别出字幕内容，请检查视频是否包含清晰的语音');
        return;
      }
      
      setSrtContent(res.srt);
      setSrtFileName('自动识别.srt');
      
      // 统计字幕信息
      const lines = res.srt.split('\n').filter(line => line.trim() && !line.match(/^\d+$/) && !line.includes('-->'));
      const wordCount = res.text ? res.text.length : 0;
      
      pushToast('success', `字幕识别完成！共识别 ${lines.length} 条字幕，${wordCount} 个字符`);
      
      console.log(`转录完成: ${lines.length} 条字幕, ${wordCount} 个字符`);
      
    } catch (error) {
      console.error('字幕识别失败:', error);
      
      let errorMessage = '字幕识别失败';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      pushToast('error', `字幕识别失败：${errorMessage}`);
    } finally {
      setIsSrtTranscribing(false);
    }
  };

  const handleStartAnalysis = async () => {
    if (!selectedFile) {
        pushToast('info', '请先上传视频文件');
        return;
    }
    setState(prev => ({ ...prev, status: ProjectStatus.ANALYZING }));
    
    try {
        // 注意：sellingPoints 是从原视频分析中提取的特征描述，不是新商品卖点
        // 因此不应该自动填充到 productInfo.sellingPoints
        const { analysis } = await analyzeVideoReal(selectedFile, '', productDesc, srtContent);
        
        const normalizedSegments = (analysis.segments || [])
          .map((s, i) => ({
            ...s,
            id: `${analysis.id || 'analysis'}-${s.id || 'seg'}-${i}-${Date.now()}`,
            main_tag: (s.main_tag || '').trim()
          }))
          .filter(s => s.main_tag);

        setState(prev => ({ 
          ...prev, 
          status: ProjectStatus.IDLE, 
          analysis: { ...analysis, segments: normalizedSegments }, 
          // 不自动填充 sellingPoints，保持为空让用户手动填写
          // sellingPoints 从视频分析中提取的是原视频特征，不是新商品卖点
          currentView: ViewType.ANALYSIS,
          history: [analysis, ...prev.history],
          assets: [...normalizedSegments, ...prev.assets]
        }));
    } catch (error) {
        console.error('Analysis failed:', error);
        pushToast('error', `分析失败：${formatErrorMessage(error)}`);
        setState(prev => ({ ...prev, status: ProjectStatus.IDLE }));
    }
  };

  const handleExportJianying = async (video: DeconstructedVideo) => {
    try {
      pushToast('info', '正在生成剪映工程文件...');

      // 检查是否有复刻的分镜和视频
      if (!state.currentReplication || !state.currentReplication.segments || state.currentReplication.segments.length === 0) {
        pushToast('error', '请先完成视频复刻流程');
        return;
      }

      // 收集所有视频 URLs
      const videoUrls: string[] = [];
      for (const segment of state.currentReplication.segments) {
        if (segment.generated_videos && segment.generated_videos.length > 0) {
          videoUrls.push(...segment.generated_videos.filter(v => v));
        }
      }

      if (videoUrls.length === 0) {
        pushToast('error', '没有找到生成的视频，请先完成视频生成');
        return;
      }

      // 动态导入剪映导出服务
      const { generateAndDownloadJianyingDraft } = await import('./services/jianyingExportService');

      // 生成并下载剪映工程文件
      await generateAndDownloadJianyingDraft(
        state.currentReplication.segments,
        videoUrls,
        state.productInfo.name || video.title,
        {
          width: 1920,
          height: 1080,
          fps: 30
        }
      );

      pushToast('success', `已导出《${state.productInfo.name || video.title}》剪映工程文件`);
    } catch (error) {
      console.error('导出剪映工程文件失败:', error);
      pushToast('error', `导出失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files) as File[];
      const newImages = files.map(file => URL.createObjectURL(file));
      setState(s => ({
        ...s,
        productInfo: {
          ...s.productInfo,
          images: [...s.productInfo.images, ...newImages].slice(0, 10)
        }
      }));
    }
  };

  const removeImage = (index: number) => {
    setState(s => {
      const newImages = [...s.productInfo.images];
      URL.revokeObjectURL(newImages[index]);
      newImages.splice(index, 1);
      return {
        ...s,
        productInfo: {
          ...s.productInfo,
          images: newImages
        }
      };
    });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      pushToast('success', `${label}已复制到剪贴板`);
    }).catch(err => {
      console.error('Copy failed:', err);
      pushToast('error', '复制失败');
    });
  };

  const handleReplicate = (video: DeconstructedVideo) => {
    console.log('Replicating video:', video.title);
    setState(prev => ({ 
      ...prev, 
      analysis: video, 
      productInfo: { name: '', sellingPoints: [''], images: [] },
      currentView: ViewType.SETUP 
    }));
  };

  const handleDeleteHistory = (id: string) => {
    setState(prev => ({
      ...prev,
      history: prev.history.filter(h => h.id !== id)
    }));
  };

  const handleGenerate = async () => {
    // 跳转到脚本生成阶段
    setState(prev => ({ 
      ...prev, 
      currentView: ViewType.SCRIPT_GENERATION,
      replicationStatus: VideoGenerationStatus.GENERATING_SCRIPT
    }));
    
    try {
      // 调用脚本重构服务
      const { generateReplicatedScript } = await import('./services/videoReplicationService');
      
      if (!state.analysis) {
        throw new Error('没有可用的分析结果');
      }
      
      const replicationResult = await generateReplicatedScript(
        state.analysis,
        state.productInfo
      );
      
      // 脚本生成完成后，停留在脚本查看页面，不自动跳转
      setState(prev => ({ 
        ...prev, 
        currentReplication: replicationResult,
        replicationStatus: VideoGenerationStatus.IDLE,
        currentView: ViewType.SCRIPT_GENERATION // 保持在脚本生成页面
      }));
      
      console.log('Script generation completed:', replicationResult);
    } catch (error) {
      console.error('Script generation failed:', error);
      pushToast('error', `脚本生成失败：${formatErrorMessage(error)}`);
      setState(prev => ({ 
        ...prev, 
        replicationStatus: VideoGenerationStatus.IDLE,
        currentView: ViewType.SETUP
      }));
    }
  };

  // --- View Renderers ---

  const renderHome = () => (
    <div className="max-w-5xl mx-auto py-12 px-6">
      <div className="flex items-center justify-between mb-12">
        <div className="space-y-1">
          <h1 className="text-4xl font-black tracking-tight">Hi, 创作专家 👋</h1>
          <p className="text-gray-500 text-sm font-medium">今天想拆解哪条爆款视频？</p>
        </div>
        <div className="flex gap-4">
           <button onClick={() => navigate(ViewType.ASSETS)} className="px-5 py-2.5 bg-white/5 border border-white/10 rounded-2xl text-sm font-bold hover:bg-white/10 transition-all flex items-center gap-2 group">
             <Layers size={18} className="text-violet-400 group-hover:scale-110 transition-transform" /> 素材库
           </button>
           <button onClick={() => navigate(ViewType.HISTORY)} className="w-11 h-11 rounded-2xl bg-violet-600/10 border border-violet-500/20 flex items-center justify-center text-violet-400 hover:bg-violet-600/20 transition-all group">
             <HistoryIcon size={22} className="group-hover:rotate-[-12deg] transition-transform" />
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
        <button 
          onClick={() => navigate(ViewType.UPLOAD)}
          className="group relative overflow-hidden h-72 rounded-[3rem] bg-gradient-to-br from-violet-600 via-violet-700 to-indigo-800 p-10 text-left transition-all hover:scale-[1.02] active:scale-95 shadow-2xl shadow-violet-900/40"
        >
          <div className="relative z-10 flex flex-col h-full justify-between">
            <div className="w-16 h-16 bg-white/20 rounded-[1.5rem] flex items-center justify-center backdrop-blur-xl border border-white/20 shadow-inner">
              <Zap className="text-white fill-white group-hover:animate-pulse" size={36} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-3xl font-black text-white">开始分析</h2>
                <div className="px-2 py-0.5 bg-white/20 rounded-full text-[10px] font-bold text-white backdrop-blur-md uppercase tracking-wider">AI Powered</div>
              </div>
              <p className="text-white/80 text-sm font-medium max-w-[240px]">上传任意短视频，AI 自动拆解黄金流量公式</p>
            </div>
          </div>
          <div className="absolute -top-12 -right-12 w-64 h-64 bg-white/10 rounded-full blur-[80px] group-hover:bg-white/20 transition-all duration-700"></div>
          <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-indigo-500/20 rounded-full blur-[60px] group-hover:bg-indigo-500/30 transition-all duration-700"></div>
        </button>

        <button 
          onClick={() => navigate(ViewType.DIRECT_GENERATION)}
          className="group relative overflow-hidden h-72 p-10 rounded-[3rem] border-2 border-dashed border-white/10 hover:border-violet-500/40 hover:bg-violet-600/5 transition-all text-left flex flex-col justify-between"
        >
          <div className="w-16 h-16 bg-white/5 rounded-[1.5rem] flex items-center justify-center border border-white/10 group-hover:bg-violet-600/10 group-hover:border-violet-500/20 transition-all">
            <Sparkles className="text-gray-400 group-hover:text-violet-400 group-hover:scale-110 transition-all" size={36} />
          </div>
          <div>
            <h3 className="text-2xl font-black mb-2 text-white/90">直接生成</h3>
            <p className="text-gray-500 text-sm font-medium">选择爆款结构，AI 自动生成视频脚本</p>
          </div>
          <div className="absolute top-8 right-8 text-gray-700 group-hover:text-violet-500/20 transition-colors">
            <Sparkles size={80} strokeWidth={1} />
          </div>
        </button>
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-6 bg-violet-600 rounded-full"></div>
            <h3 className="text-xl font-black">最近拆解</h3>
          </div>
          <button onClick={() => navigate(ViewType.HISTORY)} className="text-sm font-bold text-gray-500 hover:text-violet-400 transition-colors flex items-center gap-1 group">
            查看全部 <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
        
        <div className="grid grid-cols-1 gap-4">
          {state.history.slice(0, 3).map((item, i) => (
            <div key={item.id} className="glass-panel p-5 rounded-3xl flex items-center gap-6 group hover:bg-white/[0.07] transition-all border border-white/5 hover:border-white/10">
              <div className="w-24 h-24 bg-gray-900 rounded-2xl overflow-hidden relative border border-white/10 shadow-2xl group-hover:scale-105 transition-transform shrink-0">
                <img src={item.segments[0]?.thumbnail} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                <Play className="absolute inset-0 m-auto text-white drop-shadow-lg" size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 bg-violet-600/20 text-violet-400 text-[10px] font-black rounded-md uppercase tracking-wider">{item.niche}</span>
                  <span className="text-[10px] text-gray-500 font-bold">{new Date(item.createdAt).toLocaleDateString()}</span>
                </div>
                <h4 className="font-bold text-lg mb-1 line-clamp-1 group-hover:text-violet-400 transition-colors">{item.title}</h4>
                <div className="flex items-center gap-4 text-xs text-gray-400 font-medium">
                  <span className="flex items-center gap-1"><Sparkles size={12} className="text-amber-500" /> {item.formula_name}</span>
                  <span className="w-1 h-1 bg-gray-700 rounded-full"></span>
                  <span>{item.segments.length} 个分镜</span>
                </div>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => { setState(s => ({ ...s, analysis: item })); navigate(ViewType.ANALYSIS); }}
                  className="px-6 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold transition-all border border-white/5"
                >
                  详情
                </button>
                <button 
                  onClick={() => handleReplicate(item)}
                  className="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 rounded-xl text-xs font-bold transition-all shadow-lg shadow-violet-600/20 active:scale-95"
                >
                  复刻
                </button>
              </div>
            </div>
          ))}
        </div>
        
        {state.history.length === 0 && (
          <div className="py-20 text-center flex flex-col items-center justify-center glass-panel border-dashed border-white/10 rounded-[2.5rem]">
            <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-4 text-gray-600">
              <UploadIcon size={32} />
            </div>
            <p className="text-gray-500 font-bold mb-1">暂无拆解记录</p>
            <p className="text-gray-600 text-sm">点击“开始分析”开启爆款之路</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderHistory = () => {
    const filteredHistory = state.history.filter(item => 
      item.title.toLowerCase().includes(historySearch.toLowerCase()) || 
      item.niche.toLowerCase().includes(historySearch.toLowerCase()) ||
      item.formula_name.toLowerCase().includes(historySearch.toLowerCase())
    );

    return (
      <div className="max-w-5xl mx-auto py-12 px-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-10">
          <div className="flex items-center gap-5">
            <button onClick={() => navigate(ViewType.HOME)} className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all group">
              <ChevronLeft size={24} className="group-hover:translate-x-[-2px] transition-transform" />
            </button>
            <div>
              <h2 className="text-3xl font-black tracking-tight">我的历史分析</h2>
              <p className="text-gray-500 text-sm font-medium mt-1">回顾并复刻您之前的爆款视频拆解</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-violet-400 transition-colors" size={18} />
              <input 
                type="text" 
                placeholder="搜索历史分析..." 
                className="bg-white/5 border border-white/10 rounded-2xl pl-12 pr-6 py-3 text-sm focus:ring-2 focus:ring-violet-600/50 outline-none w-72 transition-all hover:bg-white/[0.07]" 
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
              />
            </div>
            <button className="w-12 h-12 rounded-2xl border border-white/10 flex items-center justify-center text-gray-400 hover:bg-white/5 hover:text-white transition-all">
              <Filter size={20}/>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {filteredHistory.length > 0 ? (
            filteredHistory.map((item) => (
              <div key={item.id} className="glass-panel p-6 rounded-[2.5rem] flex flex-col md:flex-row items-center gap-8 group hover:bg-white/[0.04] transition-all border border-white/5 hover:border-white/10">
                <div 
                  onClick={() => { setState(s => ({ ...s, analysis: item })); navigate(ViewType.ANALYSIS); }}
                  className="w-full md:w-48 aspect-video bg-gray-900 rounded-2xl overflow-hidden relative border border-white/10 shadow-2xl group-hover:scale-[1.02] transition-transform shrink-0 cursor-pointer"
                >
                  <img 
                    src={item.segments[0]?.thumbnail} 
                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" 
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(item.title)}&background=1e1b4b&color=fff&size=512`;
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"></div>
                  <div className="absolute inset-0 flex items-center justify-center transition-all duration-300">
                    <div className="w-12 h-12 bg-white/30 backdrop-blur-md rounded-full flex items-center justify-center border border-white/40 shadow-lg group-hover:scale-110 group-hover:bg-violet-600/80 group-hover:border-violet-400/50 transition-all duration-300">
                      <Play fill="white" size={24} className="ml-1" />
                    </div>
                  </div>
                </div>

                <div className="flex-1 w-full">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <span className="px-3 py-1 rounded-full bg-violet-500/10 text-violet-400 text-[10px] font-bold uppercase tracking-wider border border-violet-500/20">
                          {item.niche}
                        </span>
                        <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold uppercase tracking-wider border border-emerald-500/20">
                          {item.formula_name}
                        </span>
                      </div>
                      <h3 
                        onClick={() => { setState(s => ({ ...s, analysis: item })); navigate(ViewType.ANALYSIS); }}
                        className="text-xl font-bold text-white group-hover:text-violet-400 transition-colors cursor-pointer"
                      >
                        {item.title}
                      </h3>
                    </div>

                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => handleExportJianying(item)}
                        className="px-4 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-gray-300 hover:text-white transition-all flex items-center gap-2 text-sm font-bold border border-white/5"
                      >
                        <FileJson size={16} className="text-blue-400" /> 导出剪映
                      </button>
                      <button 
                        onClick={() => handleDeleteHistory(item.id)} 
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-500/5 text-gray-500 hover:bg-red-500 hover:text-white transition-all border border-white/5 hover:border-red-500/50"
                      >
                        <Trash2 size={18}/>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mt-8">
                    <div className="bg-white/5 rounded-2xl p-4 border border-white/5 hover:bg-white/[0.07] transition-colors">
                      <div className="text-[10px] text-gray-500 font-bold uppercase mb-1 tracking-widest">分镜数量</div>
                      <div className="text-lg font-black font-mono tracking-tight text-white">{item.segments.length}</div>
                    </div>
                    <div className="bg-white/5 rounded-2xl p-4 border border-white/5 hover:bg-white/[0.07] transition-colors">
                      <div className="text-[10px] text-gray-500 font-bold uppercase mb-1 tracking-widest">节奏评分</div>
                      <div className="text-sm font-bold tracking-tight text-emerald-400 leading-snug line-clamp-2">{item.pace}</div>
                    </div>
                    <div className="bg-white/5 rounded-2xl p-4 border border-white/5 hover:bg-white/[0.07] transition-colors">
                      <div className="text-[10px] text-gray-500 font-bold uppercase mb-1 tracking-widest">分析日期</div>
                      <div className="text-sm font-bold flex items-center gap-2 mt-1">
                        <Clock size={14} className="text-violet-400" /> 
                        {new Date(item.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-row md:flex-col gap-3 w-full md:w-auto shrink-0">
                  <button 
                    onClick={() => { setState(s => ({ ...s, analysis: item })); navigate(ViewType.ANALYSIS); }}
                    className="flex-1 md:w-32 py-4 bg-white text-black rounded-2xl font-bold hover:bg-gray-200 transition-all shadow-lg hover:shadow-white/10"
                  >
                    查看详情
                  </button>
                  <button 
                    onClick={() => handleReplicate(item)}
                    className="flex-1 md:w-32 py-4 bg-violet-600/10 border border-violet-500/30 text-violet-400 rounded-2xl font-bold hover:bg-violet-600 hover:text-white transition-all"
                  >
                    立即复刻
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="glass-panel rounded-[3rem] p-20 flex flex-col items-center justify-center text-center border border-white/5">
              <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-8">
                <HistoryIcon size={48} className="text-gray-600" />
              </div>
              <h3 className="text-2xl font-bold mb-3">暂无历史记录</h3>
              <p className="text-gray-500 max-w-sm mb-10">
                您还没有进行过视频拆解分析。现在就开始上传一段爆款视频，开启您的创作之旅吧！
              </p>
              <button 
                onClick={() => navigate(ViewType.UPLOAD)}
                className="px-8 py-4 bg-violet-600 hover:bg-violet-500 text-white rounded-2xl font-bold transition-all shadow-xl shadow-violet-600/30 flex items-center gap-3"
              >
                立即开始分析 <ArrowRight size={20} />
              </button>
            </div>
          )}
        </div>
    </div>
  );
};

  const tags = useMemo(() => ['全部', ...Array.from(new Set(state.assets.map(a => a.main_tag).filter(Boolean)))], [state.assets]);

  const filteredAssets = useMemo(() => state.assets
    .filter(asset => {
      const search = assetSearch.trim().toLowerCase();
      const mainTag = (asset.main_tag || '').trim();
      const tagParts = mainTag.split('+').map(t => t.trim()).filter(Boolean);

      const matchesSearch = !search
        || (asset.voiceover_text || '').toLowerCase().includes(search)
        || (asset.sourceTitle || '').toLowerCase().includes(search);

      const matchesFilter = assetFilter === '全部'
        || mainTag === assetFilter
        || tagParts.includes(assetFilter);

      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      if (assetSort === 'tag') {
        return (a.main_tag || '').localeCompare(b.main_tag || '');
      }
      return 0; // Default order
    }), [state.assets, assetSearch, assetFilter, assetSort]);

  // 定义五个一级标签
  const primaryTags = ['钩子', '证明', '卖点', '场景', '转化'];

  // 定义品类列表和各品类的top3结构
  const categories = [
    { id: 'home-storage', name: '家居收纳', top3Structures: [
      { id: 'home-1', structure: '钩子+卖点+证明+场景', description: '从钩子切入，展示产品卖点和证明，最后通过场景强化' },
      { id: 'home-2', structure: '钩子+卖点+证明+卖点+场景', description: '钩子+多重卖点+证明+场景' },
      { id: 'home-3', structure: '钩子+卖点+证明', description: '简洁的钩子+卖点+证明结构' }
    ]},
    { id: 'kitchen-tools', name: '厨房工具', top3Structures: [
      { id: 'kitchen-1', structure: '钩子+卖点+证明', description: '直接展示厨房工具的使用效果' },
      { id: 'kitchen-2', structure: '钩子+卖点+证明+场景+卖点+证明+场景+转化', description: '多重场景和证明的复杂结构' },
      { id: 'kitchen-3', structure: '钩子+卖点+证明+卖点+卖点+证明+卖点+转化', description: '突出多个卖点的结构' }
    ]},
    { id: 'pet-supplies', name: '宠物用品', top3Structures: [
      { id: 'pet-1', structure: '钩子+卖点+证明', description: '从宠物场景切入，展示产品效果' },
      { id: 'pet-2', structure: '钩子+卖点+证明+卖点+证明+卖点', description: '多重卖点和证明' },
      { id: 'pet-3', structure: '场景+卖点+证明+场景+卖点', description: '通过宠物场景展示产品' }
    ]},
    { id: 'beauty-tools', name: '美妆工具', top3Structures: [
      { id: 'beauty-1', structure: '钩子+卖点+证明', description: '展示美妆工具的使用效果' },
      { id: 'beauty-2', structure: '钩子+证明+卖点+证明+卖点+证明+卖点+证明+卖点+证明', description: '多重证明和卖点' },
      { id: 'beauty-3', structure: '钩子+卖点+证明+卖点+证明+场景', description: '卖点+证明+场景的结合' }
    ]},
    { id: 'digital-accessories', name: '数码配件', top3Structures: [
      { id: 'digital-1', structure: '钩子+场景+卖点+证明+场景+证明+场景+卖点', description: '通过场景展示数码配件' },
      { id: 'digital-2', structure: '钩子+卖点+卖点+证明+卖点', description: '突出数码配件的功能卖点' },
      { id: 'digital-3', structure: '钩子+卖点+证明+卖点+场景', description: '卖点+证明+场景的简洁结构' }
    ]},
    { id: 'personal-care-tools', name: '个护小工具', top3Structures: [
      { id: 'personal-care-1', structure: '钩子+卖点+证明+场景+卖点+卖点+证明', description: '钩子+卖点+证明+场景+多重卖点+证明' },
      { id: 'personal-care-2', structure: '钩子+卖点+证明+卖点+转化', description: '钩子+卖点+证明+卖点+转化' },
      { id: 'personal-care-3', structure: '钩子+证明+场景+卖点+证明+卖点+场景', description: '钩子+证明+场景+卖点+证明+卖点+场景' }
    ]},
    { id: 'low-cost-creative', name: '低价创意好物', top3Structures: [
      { id: 'low-cost-1', structure: '钩子+卖点', description: '简洁的钩子+卖点结构' },
      { id: 'low-cost-2', structure: '钩子+场景+卖点+证明+卖点', description: '钩子+场景+卖点+证明+卖点' },
      { id: 'low-cost-3', structure: '钩子+场景+钩子+卖点+证明+场景+证明', description: '钩子+场景+钩子+卖点+证明+场景+证明' }
    ]},
    { id: 'office-supplies', name: '办公好物', top3Structures: [
      { id: 'office-1', structure: '钩子+卖点+证明+卖点', description: '钩子+卖点+证明+卖点' },
      { id: 'office-2', structure: '钩子+卖点', description: '简洁的钩子+卖点结构' },
      { id: 'office-3', structure: '钩子+场景+卖点+证明+卖点+证明', description: '钩子+场景+卖点+证明+卖点+证明' }
    ]},
    { id: 'home-appliances', name: '家用小电器', top3Structures: [
      { id: 'appliances-1', structure: '钩子+卖点+证明', description: '直接展示家用小电器的使用效果' },
      { id: 'appliances-2', structure: '钩子+场景+卖点+证明+场景', description: '通过场景展示家用小电器的功能' },
      { id: 'appliances-3', structure: '钩子+卖点+证明+卖点+转化', description: '钩子+卖点+证明+卖点+转化' }
    ]},
    { id: 'outdoor-camping', name: '户外露营小物', top3Structures: [
      { id: 'camping-1', structure: '钩子+场景+卖点+证明', description: '从户外场景切入，展示露营小物的功能' },
      { id: 'camping-2', structure: '钩子+卖点+证明+场景+转化', description: '钩子+卖点+证明+场景+转化' },
      { id: 'camping-3', structure: '场景+卖点+证明+卖点+证明', description: '场景+卖点+证明+卖点+证明' }
    ]},
    { id: 'skincare-products', name: '护肤功能品', top3Structures: [
      { id: 'skincare-1', structure: '钩子+卖点+证明+场景', description: '展示护肤功能品的使用效果' },
      { id: 'skincare-2', structure: '钩子+证明+卖点+证明+卖点', description: '多重证明和卖点的结合' },
      { id: 'skincare-3', structure: '钩子+卖点+证明+卖点+证明+场景', description: '卖点+证明+场景的结合' }
    ]},
    { id: 'daily-necessities', name: '日用百货小工具', top3Structures: [
      { id: 'daily-1', structure: '钩子+卖点+证明', description: '直接展示日用百货小工具的使用效果' },
      { id: 'daily-2', structure: '钩子+场景+卖点+证明', description: '通过场景展示日用百货小工具的功能' },
      { id: 'daily-3', structure: '钩子+卖点+证明+转化', description: '钩子+卖点+证明+转化' }
    ]},
    { id: 'basic-clothing', name: '服饰（基础款）', top3Structures: [
      { id: 'clothing-1', structure: '钩子+卖点+证明', description: '展示基础款服饰的特点和优势' },
      { id: 'clothing-2', structure: '钩子+场景+卖点+证明', description: '通过场景展示基础款服饰的搭配效果' },
      { id: 'clothing-3', structure: '钩子+卖点+证明+场景+转化', description: '钩子+卖点+证明+场景+转化' }
    ]},
    { id: 'car-accessories', name: '汽车小用品', top3Structures: [
      { id: 'car-1', structure: '钩子+卖点+证明', description: '直接展示汽车小用品的使用效果' },
      { id: 'car-2', structure: '钩子+场景+卖点+证明+场景', description: '通过汽车场景展示产品功能' },
      { id: 'car-3', structure: '钩子+卖点+证明+卖点+转化', description: '钩子+卖点+证明+卖点+转化' }
    ]},
    { id: 'cleaning-products', name: '清洁用品', top3Structures: [
      { id: 'cleaning-1', structure: '钩子+卖点+证明', description: '直接展示清洁用品的清洁效果' },
      { id: 'cleaning-2', structure: '钩子+场景+卖点+证明+场景', description: '通过场景展示清洁用品的使用效果' },
      { id: 'cleaning-3', structure: '钩子+卖点+证明+卖点+证明', description: '多重卖点和证明的结合' }
    ]}
  ];

  const renderDirectGeneration = () => {
    const handleGenerate = async () => {
      if (!selectedCategory || !selectedStructure) {
        pushToast('error', '请选择品类和生成结构');
        return;
      }

      setState(prev => ({ 
        ...prev, 
        status: ProjectStatus.GENERATING
      }));

      try {
        // 获取选中的品类和结构
        const category = categories.find(c => c.id === selectedCategory);
        const structure = category?.top3Structures.find(s => s.id === selectedStructure);
        if (!category || !structure) {
          throw new Error('未找到选中的品类或结构');
        }

        // 解析结构中的标签
        const tags = structure.structure.split('+').map(tag => tag.trim());

        // 从素材库中随机获取对应标签的分镜
        const generatedSegments: VideoScriptSegment[] = tags.map((tag, index) => {
          // 过滤出对应标签的分镜
          const tagAssets = state.assets.filter(asset => asset.main_tag === tag);
          // 如果没有对应标签的分镜，使用默认值
          if (tagAssets.length === 0) {
            return {
              id: `direct-${Date.now()}-${index}`,
              time: `${index*3}-${(index+1)*3}s`,
              main_tag: tag,
              visual_prompt: `Default ${tag} visual prompt`,
              voiceover_text: `Default ${tag} voiceover text`,
              retention_strategy: 'Default retention strategy',
              sourceTitle: '直接生成',
              niche: category.name
            };
          }
          // 随机选择一个分镜
          const randomAsset = tagAssets[Math.floor(Math.random() * tagAssets.length)];
          return {
            ...randomAsset,
            id: `direct-${Date.now()}-${index}`,
            niche: category.name
          };
        });

        // 创建分析结果对象
        const analysis: DeconstructedVideo = {
          id: `direct-analysis-${Date.now()}`,
          title: '直接生成视频',
          niche: category.name,
          formula_name: structure.structure,
          structure: structure.structure,
          pace: '1.5s/镜头',
          core_elements: 'AI生成',
          segments: generatedSegments,
          createdAt: new Date().toISOString()
        };

        // 直接进入设置界面，跳过AI生成脚本步骤
        setState(prev => ({ 
          ...prev, 
          status: ProjectStatus.IDLE,
          analysis: analysis,
          history: [analysis, ...prev.history],
          assets: [...generatedSegments, ...prev.assets],
          currentView: ViewType.SETUP,
          replicationStatus: VideoGenerationStatus.IDLE
        }));

      } catch (error) {
        console.error('直接生成失败:', error);
        pushToast('error', `生成失败：${formatErrorMessage(error)}`);
        setState(prev => ({ ...prev, status: ProjectStatus.IDLE }));
      }
    };

    // 获取选中品类的结构
    const currentCategory = categories.find(c => c.id === selectedCategory);
    const availableStructures = currentCategory?.top3Structures || [];

    return (
      <div className="max-w-5xl mx-auto py-12 px-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-10">
          <div className="flex items-center gap-5">
            <button onClick={() => navigate(ViewType.HOME)} className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all group">
              <ChevronLeft size={24} className="group-hover:translate-x-[-2px] transition-transform" />
            </button>
            <div>
              <h2 className="text-3xl font-black tracking-tight">直接生成</h2>
              <p className="text-gray-500 text-sm font-medium mt-1">选择品类和爆款结构，AI 自动生成视频脚本</p>
            </div>
          </div>
        </div>

        {/* 品类选择 */}
        <div className="mb-10">
          <h3 className="text-xl font-bold mb-6">选择品类</h3>
          <div className="flex flex-wrap gap-4">
            {categories.map(category => (
              <button
                key={category.id}
                onClick={() => {
                  setSelectedCategory(category.id);
                  setSelectedStructure(null); // 重置结构选择
                }}
                className={`px-6 py-3 rounded-2xl text-sm font-bold transition-all border ${selectedCategory === category.id ? 'border-violet-600 bg-violet-600/5' : 'border-white/10 bg-white/5 hover:border-violet-500/30 hover:bg-violet-600/3'}`}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>

        {/* 结构选择 */}
        {selectedCategory && (
          <div className="mb-10">
            <h3 className="text-xl font-bold mb-6">选择{currentCategory?.name}的爆款结构</h3>
            {/* TOP2在左，TOP1在中，TOP3在右的布局 */}
            <div className="flex flex-col md:flex-row items-center justify-center gap-6">
              {/* TOP2 - 左边 */}
              {availableStructures[1] && (
                <div
                  key={availableStructures[1].id}
                  onClick={() => setSelectedStructure(availableStructures[1].id)}
                  className={`glass-panel rounded-[2.5rem] p-6 cursor-pointer transition-all border w-full md:w-1/3 ${selectedStructure === availableStructures[1].id ? 'border-violet-600 bg-violet-600/5' : 'border-white/5 hover:border-violet-500/30 hover:bg-violet-600/3'}`}
                >
                  <div className="w-12 h-12 rounded-xl bg-violet-600/10 flex items-center justify-center text-violet-400 border border-violet-500/20 mb-4">
                    <Sparkles size={24} />
                  </div>
                  <h4 className="text-lg font-bold mb-2">TOP2</h4>
                  <p className="text-gray-500 text-sm mb-3 line-clamp-2">{availableStructures[1].description}</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                  {availableStructures[1].structure.split('+').map((tag, index) => (
                    <span key={`${tag}-${index}`} className="px-3 py-1 bg-white/5 rounded-full text-xs font-bold text-gray-400">{tag.trim()}</span>
                  ))}
                </div>
                  <div className="text-xs text-gray-600 font-mono">{availableStructures[1].structure}</div>
                </div>
              )}
              
              {/* TOP1 - 中间，放大显示 */}
              {availableStructures[0] && (
                <div
                  key={availableStructures[0].id}
                  onClick={() => setSelectedStructure(availableStructures[0].id)}
                  className={`glass-panel rounded-[2.5rem] p-6 cursor-pointer transition-all border w-full md:w-1/3 scale-110 md:scale-110 ${selectedStructure === availableStructures[0].id ? 'border-violet-600 bg-violet-600/5' : 'border-white/5 hover:border-violet-500/30 hover:bg-violet-600/3'}`}
                >
                  <div className="w-12 h-12 rounded-xl bg-violet-600/10 flex items-center justify-center text-violet-400 border border-violet-500/20 mb-4">
                    <Sparkles size={24} />
                  </div>
                  <h4 className="text-lg font-bold mb-2">TOP1</h4>
                  <p className="text-gray-500 text-sm mb-3 line-clamp-2">{availableStructures[0].description}</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                  {availableStructures[0].structure.split('+').map((tag, index) => (
                    <span key={`${tag}-${index}`} className="px-3 py-1 bg-white/5 rounded-full text-xs font-bold text-gray-400">{tag.trim()}</span>
                  ))}
                </div>
                  <div className="text-xs text-gray-600 font-mono">{availableStructures[0].structure}</div>
                </div>
              )}
              
              {/* TOP3 - 右边 */}
              {availableStructures[2] && (
                <div
                  key={availableStructures[2].id}
                  onClick={() => setSelectedStructure(availableStructures[2].id)}
                  className={`glass-panel rounded-[2.5rem] p-6 cursor-pointer transition-all border w-full md:w-1/3 ${selectedStructure === availableStructures[2].id ? 'border-violet-600 bg-violet-600/5' : 'border-white/5 hover:border-violet-500/30 hover:bg-violet-600/3'}`}
                >
                  <div className="w-12 h-12 rounded-xl bg-violet-600/10 flex items-center justify-center text-violet-400 border border-violet-500/20 mb-4">
                    <Sparkles size={24} />
                  </div>
                  <h4 className="text-lg font-bold mb-2">TOP3</h4>
                  <p className="text-gray-500 text-sm mb-3 line-clamp-2">{availableStructures[2].description}</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                  {availableStructures[2].structure.split('+').map((tag, index) => (
                    <span key={`${tag}-${index}`} className="px-3 py-1 bg-white/5 rounded-full text-xs font-bold text-gray-400">{tag.trim()}</span>
                  ))}
                </div>
                  <div className="text-xs text-gray-600 font-mono">{availableStructures[2].structure}</div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-center">
          <button
            onClick={handleGenerate}
            disabled={!selectedCategory || !selectedStructure}
            className={`px-12 py-4 rounded-2xl text-white font-bold text-lg transition-all shadow-lg active:scale-95 ${selectedCategory && selectedStructure ? 'bg-violet-600 hover:bg-violet-500 shadow-violet-600/30' : 'bg-gray-700 cursor-not-allowed opacity-50'}`}
          >
            开始生成
          </button>
        </div>
      </div>
    );
  };

  // 计算片段持续时间（秒）
  const calculateDuration = (timeStr: string): number => {
    // 处理格式如"0-4s"或"10-20s"的时间字符串
    const match = timeStr.match(/^(\d+)-(\d+)s$/);
    if (match) {
      const start = Number(match[1]);
      const end = Number(match[2]);
      return end - start;
    }
    // 兼容原始格式如"00:00-00:04"
    const [start, end] = timeStr.split('-');
    const parseTime = (time: string): number => {
      if (time.includes(':')) {
        const [min, sec] = time.split(':').map(Number);
        return min * 60 + sec;
      }
      return Number(time.replace('s', ''));
    };
    return parseTime(end) - parseTime(start);
  };

  // 从素材生成视频
  const handleGenerateFromAssets = (asset: VideoScriptSegment) => {
    // 创建一个临时的DeconstructedVideo对象
    const tempVideo: DeconstructedVideo = {
      id: 'temp-' + Date.now(),
      title: asset.sourceTitle || '未命名素材',
      niche: asset.niche || '通用',
      formula_name: '自定义',
      structure: '自定义结构',
      pace: '1.5s',
      core_elements: '自定义',
      segments: [asset],
      total_duration: `${calculateDuration(asset.time)}s`,
      createdAt: new Date().toISOString()
    };
    
    handleReplicate(tempVideo);
  };

  const renderAssets = () => {
    // 定义五个一级标签
    const primaryTags = ['钩子', '卖点', '证明', '场景', '转化'];
    
    // 过滤出正确的一级标签
    const filteredTags = ['全部', ...primaryTags];

    return (
      <div className="max-w-7xl mx-auto py-12 px-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-10">
          <div className="flex items-center gap-5">
            <button onClick={() => navigate(ViewType.HOME)} className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all group">
              <ChevronLeft size={24} className="group-hover:translate-x-[-2px] transition-transform" />
            </button>
            <div>
              <h2 className="text-3xl font-black tracking-tight">直接生成</h2>
              <p className="text-gray-500 text-sm font-medium mt-1">已为您保存 <span className="text-violet-400 font-bold">{state.assets.length}</span> 个爆款分镜素材</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-violet-400 transition-colors" size={18} />
              <input 
                type="text" 
                placeholder="搜索分镜或关键词..." 
                className="bg-white/5 border border-white/10 rounded-2xl pl-12 pr-6 py-3 text-sm focus:ring-2 focus:ring-violet-600/50 outline-none w-72 transition-all hover:bg-white/[0.07]" 
                value={assetSearch}
                onChange={e => setAssetSearch(e.target.value)}
              />
            </div>
            <div className="flex bg-white/5 p-1.5 rounded-2xl border border-white/5">
              <button 
                onClick={() => setAssetSort('time')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${assetSort === 'time' ? 'bg-white/10 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
              >
                <Clock size={16}/> 最新
              </button>
              <button 
                onClick={() => setAssetSort('tag')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${assetSort === 'tag' ? 'bg-white/10 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
              >
                <Filter size={16}/> 标签
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-8 custom-scrollbar scroll-smooth">
          {filteredTags.map(tag => (
            <button 
              key={tag}
              onClick={() => setAssetFilter(tag)}
              className={`px-5 py-2 rounded-full text-xs font-black transition-all whitespace-nowrap border-2 ${assetFilter === tag ? 'bg-violet-600 border-violet-600 text-white shadow-lg shadow-violet-600/30' : 'bg-white/5 border-transparent text-gray-500 hover:bg-white/10 hover:text-gray-300'}`}
            >
              {tag}
            </button>
          ))}
        </div>

        {/* 添加点击外部关闭卡片的遮罩层 */}
        {expandedAsset && (
          <div 
            className="fixed inset-0 z-20 bg-black/30 backdrop-blur-sm" 
            onClick={() => setExpandedAsset(null)}
          />
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
          {filteredAssets.map((asset, idx) => (
            <div 
              key={`${asset.id}-${idx}`} 
              className="group relative flex flex-col gap-4 cursor-pointer"
            >
              {/* 预览图和操作按钮 */}
              <div className="aspect-[3/4] bg-gray-900 rounded-3xl overflow-hidden border border-white/5 group-hover:border-violet-500/50 group-hover:scale-[1.02] transition-all duration-500 shadow-xl group-hover:shadow-violet-600/20">
                <img 
                  src={asset.thumbnail} 
                  className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-all duration-500" 
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(asset.main_tag || 'Asset')}&background=1e1b4b&color=fff&size=512`;
                  }}
                  // 点击图片显示详情卡片
                  onClick={() => setExpandedAsset(expandedAsset === asset.id ? null : asset.id)}
                  style={{ cursor: 'pointer' }}
                />
                {/* 左上角显示计算后的时长（秒） */}
                <div className="absolute top-4 left-4 px-2.5 py-1.5 bg-black/70 backdrop-blur-md rounded-lg text-[10px] font-mono font-bold border border-white/10">
                  {calculateDuration(asset.time)}s
                </div>
                
                {/* 右上角操作按钮 - 放在图片右上角 */}
                <div className="absolute top-4 right-4 flex gap-2 z-30">
                  {/* 复制全部内容按钮 */}
                  <button 
                    onClick={(e) => {
                      e.stopPropagation(); // 阻止事件冒泡，避免触发图片点击事件
                      const allContent = `视频提示词: ${asset.visual_prompt}\n首帧提示词: ${asset.visual_prompt}\n文案: ${asset.voiceover_text}`;
                      copyToClipboard(allContent, '全部内容');
                    }}
                    className="p-2 bg-black/70 backdrop-blur-md hover:bg-violet-600/70 rounded-lg text-gray-400 hover:text-violet-400 transition-all"
                    title="复制全部内容"
                  >
                    <Copy size={14}/>
                  </button>
                  {/* 删除按钮 */}
                  <button 
                    onClick={(e) => {
                      e.stopPropagation(); // 阻止事件冒泡，避免触发图片点击事件
                      if (confirm('确定要删除这个素材吗？')) {
                        setState(prev => ({
                          ...prev,
                          assets: prev.assets.filter(a => a.id !== asset.id)
                        }));
                        pushToast('success', '素材已删除');
                      }
                    }}
                    className="p-2 bg-black/70 backdrop-blur-md hover:bg-red-600/70 rounded-lg text-gray-400 hover:text-red-400 transition-all"
                    title="删除素材"
                  >
                    <Trash2 size={14}/>
                  </button>
                </div>
              </div>

              {/* 标签和留存策略 */}
              <div className="space-y-3">
                {/* 标签部分 */}
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-[9px] font-black text-violet-400 uppercase tracking-tighter bg-violet-400/10 px-2 py-0.5 rounded-md border border-violet-400/20">
                    {asset.main_tag}
                  </span>
                  {/* 二级标签 */}
                  {asset.info_density && (
                    <span className="text-[9px] font-black text-emerald-400 uppercase tracking-tighter bg-emerald-400/10 px-2 py-0.5 rounded-md border border-emerald-400/20">
                      {asset.info_density}
                    </span>
                  )}
                  {asset.l2_visual && (
                    <span className="text-[9px] font-black text-blue-400 uppercase tracking-tighter bg-blue-400/10 px-2 py-0.5 rounded-md border border-blue-400/20">
                      {asset.l2_visual}
                    </span>
                  )}
                </div>
                
                {/* 留存策略 */}
                <p className="text-[11px] text-gray-400 line-clamp-2 leading-relaxed font-medium">
                  {asset.retention_strategy}
                </p>
              </div>
              
              {/* 点击显示的磨砂卡片 - 以图片中心为中心点，竖版4:3比例 */}
              {expandedAsset === asset.id && (
                <div className="absolute left-1/2 top-1/2 z-40 bg-white/5 backdrop-blur-lg rounded-2xl p-6 border border-white/10 shadow-xl transform -translate-x-1/2 -translate-y-1/2 w-[400px] aspect-[3/4] max-h-[80vh] overflow-y-auto">
                  <div className="space-y-5">
                    {/* 视频提示词 */}
                    <div>
                      <h5 className="text-[10px] text-gray-500 font-bold mb-2 uppercase tracking-wider">视频提示词</h5>
                      <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap break-words">{asset.visual_prompt}</p>
                    </div>
                    {/* 首帧提示词 - 如果没有则显示视频提示词 */}
                    <div>
                      <h5 className="text-[10px] text-gray-500 font-bold mb-2 uppercase tracking-wider">首帧提示词</h5>
                      <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap break-words">{asset.visual_prompt}</p>
                    </div>
                    {/* 文案 */}
                    <div>
                      <h5 className="text-[10px] text-gray-500 font-bold mb-2 uppercase tracking-wider">文案</h5>
                      <p className="text-xs text-gray-300 leading-relaxed break-words">{asset.voiceover_text}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        
        {/* 空状态单独处理，避免影响网格布局 */}
        {filteredAssets.length === 0 && (
          <div className="mt-16 py-32 flex flex-col items-center justify-center text-gray-600 glass-panel border-dashed border-white/10 rounded-[3rem]">
            <Search size={64} className="mb-6 opacity-10" />
            <p className="text-xl font-bold">未找到匹配的素材</p>
            <p className="text-sm mt-2">试试搜索其他关键词或更换筛选标签</p>
          </div>
        )}
      </div>
    );
  };

  const renderUpload = () => (
    <div className="max-w-3xl mx-auto py-12 px-6">
      <div className="flex items-center justify-between mb-8">
        <button onClick={() => navigate(ViewType.HOME)} className="group flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
          <div className="p-2 rounded-lg group-hover:bg-white/5 transition-colors">
            <ChevronLeft size={20} />
          </div>
          <span className="text-sm font-bold">返回首页</span>
        </button>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-violet-500/10 rounded-full border border-violet-500/20">
          <Sparkles size={14} className="text-violet-400" />
          <span className="text-[10px] font-bold text-violet-400 uppercase tracking-widest">AI 强力驱动</span>
        </div>
      </div>
      
      <StepIndicator step={1} />

      <div className="text-center mb-10">
        <h2 className="text-3xl font-bold mb-3">分析爆款视频</h2>
        <p className="text-gray-500 text-sm max-w-md mx-auto">上传你想复刻的爆款视频，AI 将自动拆解其脚本结构、视觉逻辑和带货公式</p>
      </div>

      <div 
        className={`relative border-2 border-dashed rounded-[2.5rem] p-4 transition-all flex flex-col items-center justify-center min-h-[440px] overflow-hidden group/upload ${
          state.status === ProjectStatus.UPLOADING 
            ? 'border-violet-600 bg-violet-600/5' 
            : 'border-white/10 bg-white/5 hover:border-violet-500/30 hover:bg-violet-500/5'
        }`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); onUploadStart(e); }}
      >
        {previewUrl ? (
          <div className="absolute inset-2 rounded-[2rem] overflow-hidden bg-black shadow-2xl">
            <video 
              key={previewUrl}
              src={previewUrl} 
              className="w-full h-full object-contain" 
              controls 
            />
          </div>
        ) : (
          <div className="flex flex-col items-center py-12">
            <div className="w-24 h-24 bg-gradient-to-br from-violet-600/20 to-indigo-600/20 rounded-3xl flex items-center justify-center mb-8 text-violet-500 shadow-inner group-hover/upload:scale-110 group-hover/upload:rotate-3 transition-all duration-500">
              <UploadIcon size={44} className="group-hover/upload:animate-bounce" />
            </div>
            <h3 className="text-xl font-bold mb-3 text-center">点击上传或拖拽视频至此</h3>
            <div className="flex flex-wrap justify-center gap-3 mb-10">
              {['MP4/MOV', '建议 < 60秒', '支持 4K'].map(tag => (
                <span key={tag} className="px-3 py-1 bg-white/5 rounded-full text-[10px] text-gray-400 border border-white/5">{tag}</span>
              ))}
            </div>
            
            <input type="file" className="hidden" id="file-upload" accept="video/*" onChange={onUploadStart} />
            <label htmlFor="file-upload" className="group/btn relative px-10 py-4 bg-white text-black font-bold rounded-2xl cursor-pointer hover:bg-gray-100 transition-all overflow-hidden shadow-xl">
              <span className="relative z-10 flex items-center gap-2">选择视频文件 <Plus size={18} /></span>
              <div className="absolute inset-0 bg-gradient-to-r from-violet-100 to-white opacity-0 group-hover/btn:opacity-100 transition-opacity" />
            </label>
          </div>
        )}

        {state.status === ProjectStatus.UPLOADING && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md rounded-[2.5rem] flex flex-col items-center justify-center z-10 animate-in fade-in duration-300">
            <div className="relative w-16 h-16 mb-6">
              <div className="absolute inset-0 border-4 border-violet-600/20 rounded-full" />
              <div className="absolute inset-0 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="font-bold text-xl text-white mb-2">正在安全传输...</p>
            <p className="text-violet-400 font-mono text-sm">65% · 4.2MB/s</p>
          </div>
        )}
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="glass-panel p-6 rounded-[2rem] border border-white/5 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-xl bg-violet-600/10 flex items-center justify-center text-violet-400 border border-violet-500/20">
              <Layout size={16} />
            </div>
            <h4 className="text-sm font-bold text-white">补充商品描述 (可选)</h4>
          </div>
          <textarea 
            placeholder="输入商品名称、卖点或目标人群，帮助 AI 更精准地提取爆款逻辑..."
            className="w-full h-32 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-violet-600 outline-none resize-none placeholder:text-gray-600"
            value={productDesc}
            onChange={e => setProductDesc(e.target.value)}
          />
        </div>

        <div className="glass-panel p-6 rounded-[2rem] border border-white/5 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-xl bg-blue-600/10 flex items-center justify-center text-blue-400 border border-blue-500/20">
                <FileJson size={16} />
              </div>
              <h4 className="text-sm font-bold text-white">上传 SRT 字幕 (可选)</h4>
            </div>
            <p className="text-[11px] text-gray-500 leading-relaxed mb-4">
              上传视频对应的 SRT 字幕文件，AI 将结合语音文本内容进行更深度的语义分析。
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAutoTranscribeSrt}
              disabled={!selectedFile || state.status === ProjectStatus.ANALYZING || isSrtTranscribing}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-blue-500/10 text-blue-300 border border-blue-500/20 hover:bg-blue-500/15 hover:border-blue-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {isSrtTranscribing ? '正在识别字幕…' : '从视频自动识别字幕'}
            </button>
          </div>

          <div className="relative">
            <input 
              type="file" 
              id="srt-upload" 
              accept=".srt" 
              className="hidden" 
              onChange={onSrtUpload} 
            />
            {srtFileName ? (
              <div className="flex items-center justify-between p-4 bg-blue-500/5 rounded-2xl border border-blue-500/20">
                <div className="flex items-center gap-3 truncate">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  <span className="text-xs font-bold text-blue-400 truncate">{srtFileName}</span>
                </div>
                <button 
                  onClick={() => { setSrtContent(''); setSrtFileName(''); }}
                  className="p-1.5 hover:bg-red-500/10 text-gray-500 hover:text-red-500 rounded-lg transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ) : (
              <label 
                htmlFor="srt-upload"
                className="flex items-center justify-center gap-2 w-full py-4 border-2 border-dashed border-white/10 rounded-2xl text-xs font-bold text-gray-500 hover:border-blue-500/30 hover:bg-blue-500/5 hover:text-blue-400 cursor-pointer transition-all"
              >
                <Plus size={16} /> 选择 .srt 文件
              </label>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4">
        {selectedFile ? (
          <div className="flex items-center justify-between p-5 bg-white/5 rounded-3xl border border-white/10 hover:bg-white/[0.07] transition-all group animate-in slide-in-from-bottom-2">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-violet-600/10 rounded-2xl flex items-center justify-center text-violet-400 border border-violet-500/20 group-hover:scale-105 transition-transform">
                <Play size={24} fill="currentColor" className="ml-0.5" />
              </div>
              <div>
                <div className="text-sm font-bold truncate max-w-[280px] mb-0.5">{selectedFile.name}</div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-500 font-mono">{(selectedFile.size / (1024 * 1024)).toFixed(1)} MB</span>
                  <div className="w-1 h-1 bg-gray-700 rounded-full" />
                  <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-tighter flex items-center gap-1">
                    <CheckCircle2 size={10} /> 准备就绪
                  </span>
                </div>
              </div>
            </div>
            <button 
              onClick={() => {
                setSelectedFile(null);
                setPreviewUrl(null);
              }}
              className="p-3 bg-white/5 hover:bg-red-500/10 text-gray-500 hover:text-red-500 rounded-2xl transition-all"
              title="移除文件"
            >
              <Trash2 size={20} />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between p-5 bg-white/[0.02] rounded-3xl border border-white/5 opacity-40 grayscale italic">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-800 rounded-2xl flex items-center justify-center text-gray-600"><Play size={24} /></div>
              <div>
                <div className="text-sm font-bold">尚未选择任何视频</div>
                <div className="text-[10px] text-gray-600 font-mono">0.0 MB · 待命</div>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between py-2 px-1">
          <label className="flex items-center gap-3 cursor-pointer group">
            <div className="relative flex items-center">
              <input type="checkbox" className="peer hidden" defaultChecked />
              <div className="w-5 h-5 border-2 border-white/20 rounded-md peer-checked:bg-violet-600 peer-checked:border-violet-600 transition-all" />
              <CheckCircle2 className="absolute text-white scale-0 peer-checked:scale-100 transition-transform left-0.5" size={16} />
            </div>
            <span className="text-sm text-gray-400 group-hover:text-white transition-colors">同步保存分镜到我的私有素材库</span>
          </label>
        </div>

        <button 
          onClick={handleStartAnalysis}
          disabled={state.status === ProjectStatus.ANALYZING || !selectedFile}
          className={`group/go w-full font-bold py-5 rounded-3xl transition-all shadow-2xl flex items-center justify-center gap-3 text-lg ${
            (state.status === ProjectStatus.ANALYZING || !selectedFile) 
            ? 'bg-white/5 text-gray-500 cursor-not-allowed border border-white/5' 
            : 'bg-violet-600 hover:bg-violet-500 text-white shadow-violet-600/30'
          }`}
        >
          {state.status === ProjectStatus.ANALYZING ? (
            <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> AI 深度分析中...</>
          ) : (
            <>开始智能分析 <ArrowRight size={22} className="group-hover/go:translate-x-1 transition-transform" /></>
          )}
        </button>
      </div>
    </div>
  );
  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const renderAnalysis = () => (
    <div className="max-w-6xl mx-auto py-12 px-6">
      <div className="flex items-center justify-between mb-10">
        <button onClick={() => navigate(ViewType.UPLOAD)} className="group flex items-center gap-3 text-gray-400 hover:text-white transition-all bg-white/5 hover:bg-white/10 px-5 py-2.5 rounded-2xl border border-white/5">
          <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          <span className="font-bold text-sm">重新分析</span>
        </button>
        
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-xs font-bold text-emerald-400">分析已完成</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Preview Column */}
        <div className="lg:col-span-5 xl:col-span-4">
          <div className="sticky top-8">
            <div className="aspect-[9/16] bg-gray-900 rounded-[3rem] border-[12px] border-gray-800 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] overflow-hidden relative group ring-1 ring-white/10">
              {previewUrl ? (
                <video 
                  key={previewUrl}
                  ref={videoRef}
                  src={previewUrl} 
                  className="w-full h-full object-cover"
                  onClick={togglePlay}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                />
              ) : (
                <img 
                  src={state.analysis?.segments[0]?.thumbnail} 
                  className="w-full h-full object-cover" 
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(state.analysis?.title || 'Video')}&background=1e1b4b&color=fff&size=512`;
                  }}
                />
              )}
              
              {!isPlaying && (
                <div 
                  className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center transition-all cursor-pointer group-hover:bg-black/30"
                  onClick={togglePlay}
                >
                  <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30 scale-100 group-hover:scale-110 transition-transform">
                    <Play fill="white" size={40} className="ml-1" />
                  </div>
                </div>
              )}
              
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white text-[10px] font-black tracking-widest bg-black/60 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 pointer-events-none uppercase">
                {state.analysis?.total_duration || "00:15"}
              </div>
            </div>
            
            <div className="mt-8 glass-panel p-6 rounded-[2.5rem] border border-white/5">
              <h4 className="text-sm font-bold text-gray-400 mb-4 flex items-center gap-2">
                <Sparkles size={16} className="text-violet-400" />
                视频核心分析
              </h4>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">内容赛道</span>
                  <span className="text-xs font-bold px-2 py-1 bg-violet-500/10 text-violet-400 rounded-lg border border-violet-500/20">{state.analysis?.niche}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">分镜数量</span>
                  <span className="text-xs font-bold text-white font-mono">{state.analysis?.segments.length}个</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">建议节奏</span>
                  <span className="text-xs font-bold text-emerald-400">{state.analysis?.pace}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content Column */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col">
          <div className="flex bg-white/5 p-1.5 rounded-2xl mb-8 self-start border border-white/5">
            <button 
              onClick={() => setActiveTab('segments')}
              className={`px-8 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'segments' ? 'bg-white text-black shadow-lg shadow-white/10' : 'text-gray-500 hover:text-gray-300'}`}
            >
              分镜深度拆解
            </button>
            <button 
              onClick={() => setActiveTab('formula')}
              className={`px-8 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'formula' ? 'bg-white text-black shadow-lg shadow-white/10' : 'text-gray-500 hover:text-gray-300'}`}
            >
              爆款带货公式
            </button>
          </div>

          <div className="flex-1">
            {activeTab === 'segments' ? (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {state.analysis?.segments.map((seg, i) => (
                  <div key={i} className="glass-panel p-5 rounded-[2rem] border border-white/5 hover:border-white/10 transition-all group/seg hover:bg-white/[0.04]">
                    <div className="aspect-video bg-gray-900 rounded-2xl overflow-hidden relative border border-white/10 mb-4 group-hover/seg:scale-[1.02] transition-transform">
                       <img 
                         src={seg.thumbnail} 
                         className="w-full h-full object-cover opacity-80 group-hover/seg:opacity-100 transition-opacity" 
                         onError={(e) => {
                           (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=Segment+${i+1}&background=1e1b4b&color=fff&size=512`;
                         }}
                       />
                       <div className="absolute top-3 left-3 px-3 py-1 bg-black/60 backdrop-blur-md rounded-xl text-[10px] font-black font-mono border border-white/10">{seg.time}</div>
                       <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover/seg:opacity-100 transition-opacity"></div>
                    </div>
                    <div>
                      <div className="flex flex-wrap gap-2 mb-4">
                        <span className="text-[10px] font-black text-violet-400 uppercase tracking-widest bg-violet-400/10 px-2.5 py-1 rounded-lg border border-violet-400/20">
                          {seg.main_tag}
                        </span>
                        {seg.info_density && (
                          <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-400/10 px-2.5 py-1 rounded-lg border border-emerald-400/20">
                            {seg.info_density}
                          </span>
                        )}
                        {seg.l2_visual && (
                          <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest bg-blue-400/10 px-2.5 py-1 rounded-lg border border-blue-400/20">
                            {seg.l2_visual}
                          </span>
                        )}
                      </div>
                      <div className="bg-white/5 rounded-2xl p-4 border border-white/5 group-hover/seg:bg-white/10 transition-colors">
                        <p className="text-sm text-gray-300 leading-relaxed font-medium line-clamp-3 italic">"{seg.voiceover_text}"</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass-panel rounded-[3rem] p-10 border border-white/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-violet-600/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-600/5 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2"></div>
                
                <div className="relative z-10 space-y-12">
                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-6 bg-violet-600 rounded-full"></div>
                      <h4 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em]">内容叙事结构</h4>
                    </div>
                    <div className="bg-white/5 rounded-[2rem] p-8 border border-white/10">
                      <div className="flex flex-wrap gap-4 items-center">
                        {(state.analysis?.structure || "暂无信息").split(' + ').map((part, idx) => {
                          const match = part.match(/(.*)\[(.*)\]/);
                          if (match) {
                            const [_, label, time] = match;
                            return (
                              <div key={idx} className="flex items-center gap-2">
                                {idx > 0 && <span className="text-gray-600 font-bold">+</span>}
                                <div className="flex flex-col">
                                  <span className="text-lg font-black text-white">{label}</span>
                                  <span className="text-[10px] font-mono text-violet-400 font-bold">{time}</span>
                                </div>
                              </div>
                            );
                          }
                          return (
                            <div key={idx} className="flex items-center gap-2">
                              {idx > 0 && <span className="text-gray-600 font-bold">+</span>}
                              <span className="text-lg font-black text-white">{part}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-6">
                      <div className="flex items-center gap-3">
                        <div className="w-1.5 h-6 bg-emerald-600 rounded-full"></div>
                        <h4 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em]">视觉节奏感</h4>
                      </div>
                      <div className="bg-white/5 rounded-[2rem] p-8 border border-white/10 hover:bg-white/[0.07] transition-colors">
                        <p className="text-xl font-black text-emerald-400 leading-relaxed tracking-tight">
                          {state.analysis?.pace || "暂无信息"}
                        </p>
                        <p className="text-xs text-gray-500 mt-4 font-bold">建议每秒镜头切换频率</p>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="flex items-center gap-3">
                        <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
                        <h4 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em]">核心爆款元素</h4>
                      </div>
                      <div className="bg-white/5 rounded-[2rem] p-8 border border-white/10 space-y-4">
                        {(state.analysis?.core_elements || "暂无信息").split(' | ').map((item, idx) => (
                           <div key={idx} className="flex items-center gap-4 group/item">
                             <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20 group-hover/item:scale-110 transition-transform">
                               <CheckCircle2 size={16} />
                             </div>
                             <span className="text-base font-bold text-white tracking-tight">{item}</span>
                           </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-12 flex flex-col sm:flex-row gap-5">
            <button 
              onClick={() => state.analysis && handleExportJianying(state.analysis)}
              className="flex-1 px-8 py-5 border border-white/10 rounded-3xl text-sm font-black hover:bg-white/5 transition-all flex items-center justify-center gap-3 group"
            >
              <FileJson size={20} className="text-blue-400 group-hover:scale-110 transition-transform" /> 
              <span>导出剪映工程</span>
            </button>
            <button 
              onClick={() => navigate(ViewType.SETUP)}
              className="flex-1 px-8 py-5 bg-violet-600 hover:bg-violet-500 rounded-3xl text-sm font-black text-white transition-all shadow-2xl shadow-violet-600/40 flex items-center justify-center gap-3 group"
            >
              <span>下一步：开始复刻</span>
              <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSetup = () => (
    <div className="max-w-3xl mx-auto py-12 px-6">
      <button onClick={() => navigate(ViewType.ANALYSIS)} className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors">
        <ChevronLeft size={20} /> 调整分析
      </button>

      <StepIndicator step={2} />

      <div className="space-y-8">
        <section>
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">原分镜参考 (我们将保留骨架进行替换)</h3>
          <div className="flex gap-3 overflow-x-auto pb-4 custom-scrollbar">
            {state.analysis?.segments.map((seg, i) => (
              <div key={i} className="min-w-[140px] aspect-video rounded-xl bg-gray-800 border border-white/5 overflow-hidden flex-shrink-0 relative">
                <img src={seg.thumbnail} className="w-full h-full object-cover opacity-40" />
                <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">分镜 {i+1}</div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-violet-400 mt-2 font-medium italic">"系统将自动保留爆款节奏，替换分镜中的产品特写"</p>
        </section>

        <section className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-bold block">1. 商品名称</label>
            <input 
              type="text" 
              placeholder="例如：极光黑 智能降噪耳机"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:ring-2 focus:ring-violet-600 outline-none"
              value={state.productInfo.name}
              onChange={e => setState(s => ({ ...s, productInfo: { ...s.productInfo, name: e.target.value } }))}
            />
          </div>

          <div className="space-y-4">
            <label className="text-sm font-bold block">2. 商品卖点 (1-3个)</label>
            <div className="space-y-2">
              {state.productInfo.sellingPoints.map((sp, idx) => (
                <input 
                  key={idx}
                  type="text" 
                  placeholder={`卖点 ${idx + 1}，如“持久防水”`}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:ring-2 focus:ring-violet-600 outline-none"
                  value={sp}
                  onChange={e => {
                    const newSps = [...state.productInfo.sellingPoints];
                    newSps[idx] = e.target.value;
                    setState(s => ({ ...s, productInfo: { ...s.productInfo, sellingPoints: newSps } }));
                  }}
                />
              ))}
              {state.productInfo.sellingPoints.length < 3 && (
                <button 
                  onClick={() => setState(s => ({ ...s, productInfo: { ...s.productInfo, sellingPoints: [...s.productInfo.sellingPoints, ''] } }))}
                  className="text-xs text-violet-400 font-bold flex items-center gap-1 hover:text-violet-300"
                >
                  <Plus size={14} /> 添加卖点
                </button>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-sm font-bold block">3. 商品图片 (支持 0-10 张)</label>
            <div className="grid grid-cols-5 gap-3">
              <input 
                type="file" 
                multiple 
                accept="image/*" 
                className="hidden" 
                ref={imageInputRef}
                onChange={handleImageUpload}
              />
              <button 
                onClick={() => imageInputRef.current?.click()}
                className="aspect-square bg-white/5 border border-dashed border-white/20 rounded-xl flex flex-col items-center justify-center gap-1 text-gray-500 hover:border-violet-500/50 hover:bg-violet-600/5 transition-all"
              >
                <Plus size={20} />
                <span className="text-[10px]">添加图片</span>
              </button>
              {state.productInfo.images.map((img, i) => (
                <div key={i} className="aspect-square bg-gray-800 rounded-xl overflow-hidden relative border border-white/10 group">
                   <img 
                     src={img} 
                     className="w-full h-full object-cover" 
                     onError={(e) => {
                       (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=Image+${i+1}&background=1e1b4b&color=fff&size=512`;
                     }}
                   />
                   <button 
                     onClick={() => removeImage(i)}
                     className="absolute top-1 right-1 p-1 bg-black/50 rounded-full text-white/50 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                   >
                     <Trash2 size={10}/>
                   </button>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4 pt-4">
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-bold">4. 生成视频数量</label>
              <span className="text-sm font-mono text-violet-400">{state.genCount} 个版本</span>
            </div>
            <input 
              type="range" min="1" max="5" 
              className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-violet-600"
              value={state.genCount}
              onChange={e => setState(s => ({ ...s, genCount: parseInt(e.target.value) }))}
            />
            <div className="flex justify-between text-[10px] text-gray-500 font-bold">
              <span>1</span>
              <span>2</span>
              <span>3</span>
              <span>4</span>
              <span>5</span>
            </div>
          </div>
        </section>

        <button 
          onClick={handleGenerate}
          disabled={!state.productInfo.name || state.status === ProjectStatus.GENERATING}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-5 rounded-2xl transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {state.status === ProjectStatus.GENERATING ? (
            <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> AI 正在极速生成多版本中...</>
          ) : (
            <>一键复刻爆款视频 <Sparkles size={20} /></>
          )}
        </button>
      </div>
    </div>
  );

  const renderSuccess = () => (
    <div className="max-w-4xl mx-auto py-12 px-6 text-center">
      <div className="w-20 h-20 bg-emerald-600/20 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-500">
        <CheckCircle2 size={48} />
      </div>
      <h2 className="text-3xl font-bold mb-2">生成成功！</h2>
      <p className="text-gray-500 mb-12">系统已根据您的产品卖点生成了 {state.results.length} 个爆款复刻版本</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {state.results.map((res, i) => (
          <div key={res.id} className="glass-panel p-4 rounded-[2rem] text-left border border-white/5 hover:border-violet-500/20 transition-all flex flex-col gap-4 group">
            <div className="aspect-[9/16] bg-gray-900 rounded-2xl overflow-hidden relative">
              <img 
                src={res.thumbnail} 
                className="w-full h-full object-cover" 
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=Version+${i+1}&background=1e1b4b&color=fff&size=512`;
                }}
              />
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center transition-opacity group-hover:bg-black/40">
                 <div className="w-12 h-12 bg-white/30 backdrop-blur-md rounded-full flex items-center justify-center border border-white/40 shadow-lg group-hover:scale-110 group-hover:bg-violet-600/80 group-hover:border-violet-400/50 transition-all duration-300">
                   <Play fill="white" size={24} className="ml-1" />
                 </div>
               </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-bold">{res.version}</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold">Ready</span>
              </div>
              <p className="text-[10px] text-gray-500">卖点：{res.sellingPoint}</p>
            </div>
            <div className="flex gap-2">
              <button className="flex-1 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold transition-all">播放</button>
              <button className="flex-1 py-2 bg-violet-600 hover:bg-violet-500 rounded-xl text-xs font-bold transition-all"><Download size={14} className="inline mr-1"/> 下载</button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-center gap-4">
        <button className="px-8 py-4 border border-white/10 rounded-2xl text-sm font-bold hover:bg-white/5 transition-all">批量打包下载 (ZIP)</button>
        <button onClick={() => navigate(ViewType.SETUP)} className="px-8 py-4 border border-violet-500/20 text-violet-400 rounded-2xl text-sm font-bold hover:bg-violet-500/10 transition-all">再次生成</button>
        <button onClick={() => navigate(ViewType.HOME)} className="px-8 py-4 bg-white text-black rounded-2xl text-sm font-bold hover:bg-gray-200 transition-all">返回首页</button>
      </div>
    </div>
  );

  // 新增：脚本生成阶段视图
  // 新增：脚本生成阶段视图
  const renderScriptGeneration = () => {
    // 如果脚本已生成，显示脚本详情
    if (state.currentReplication && state.replicationStatus === VideoGenerationStatus.IDLE) {
      return (
        <div className="max-w-7xl mx-auto py-12 px-6">
          <div className="flex items-center justify-between mb-10">
            <button 
              onClick={() => navigate(ViewType.SETUP)} 
              className="group flex items-center gap-3 text-gray-400 hover:text-white transition-all bg-white/5 hover:bg-white/10 px-5 py-2.5 rounded-2xl border border-white/5"
            >
              <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
              <span className="font-bold text-sm">返回修改</span>
            </button>
            
            <div className="flex items-center gap-3">
              <div className="px-4 py-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20 flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-400" />
                <span className="text-xs font-bold text-emerald-400">脚本生成完成</span>
              </div>
            </div>
          </div>

          {/* 进度指示器 */}
          <div className="flex items-center justify-center gap-4 mb-12">
            {[
              { n: 1, l: "脚本生成", done: true },
              { n: 2, l: "首帧生成", done: false },
              { n: 3, l: "分镜生成", done: false },
              { n: 4, l: "视频合成", done: false }
            ].map((s, idx) => (
              <React.Fragment key={s.n}>
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${s.done ? 'bg-emerald-600 text-white' : s.n === 2 ? 'bg-violet-600 text-white' : 'bg-white/10 text-gray-500'}`}>
                    {s.done ? <CheckCircle2 size={16} /> : s.n}
                  </div>
                  <span className={`text-sm font-medium ${s.done || s.n === 2 ? 'text-white' : 'text-gray-500'}`}>{s.l}</span>
                </div>
                {idx < 3 && <div className={`w-16 h-[2px] ${s.done ? 'bg-emerald-600' : 'bg-white/10'}`} />}
              </React.Fragment>
            ))}
          </div>

          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold mb-3">新脚本已生成</h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              系统已为"{state.currentReplication.product_info.name}"生成了 {state.currentReplication.segments.length} 个分镜脚本。
              请查看脚本内容，确认无误后进入下一步生成首帧图片。
            </p>
          </div>

          {/* 脚本概览 */}
          <div className="glass-panel rounded-[2.5rem] p-8 border border-white/5 mb-10">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-3xl font-black text-violet-400 mb-2">{state.currentReplication.segments.length}</div>
                <div className="text-xs text-gray-500 font-bold uppercase tracking-widest">分镜数量</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-black text-emerald-400 mb-2">{state.currentReplication.total_duration}</div>
                <div className="text-xs text-gray-500 font-bold uppercase tracking-widest">总时长</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-black text-blue-400 mb-2">{state.currentReplication.visual_rhythm}</div>
                <div className="text-xs text-gray-500 font-bold uppercase tracking-widest">视觉节奏</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-black text-amber-400 mb-2 line-clamp-1">{state.currentReplication.narrative_structure}</div>
                <div className="text-xs text-gray-500 font-bold uppercase tracking-widest">叙事结构</div>
              </div>
            </div>
          </div>

          {/* 分镜脚本列表 */}
          <div className="space-y-6 mb-10">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-6 bg-violet-600 rounded-full"></div>
              <h3 className="text-xl font-black">分镜脚本详情</h3>
            </div>

            <div className="grid grid-cols-1 gap-6">
              {state.currentReplication.segments.map((seg, idx) => (
                <div key={seg.id} className="glass-panel p-6 rounded-[2rem] border border-white/5 hover:border-white/10 transition-all">
                  <div className="flex items-start gap-6">
                    <div className="flex-shrink-0">
                      <div className="w-16 h-16 bg-violet-600/20 rounded-2xl flex items-center justify-center border border-violet-500/30">
                        <span className="text-2xl font-black text-violet-400">{idx + 1}</span>
                      </div>
                    </div>
                    
                    <div className="flex-1 space-y-4">
                      <div className="flex items-center gap-3">
                        <span className="px-3 py-1 bg-violet-500/10 text-violet-400 text-xs font-bold rounded-lg border border-violet-500/20 uppercase">
                          {seg.narrative_type}
                        </span>
                        <span className="text-xs text-gray-500 font-mono">{seg.time}</span>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <div className="text-xs text-gray-500 font-bold mb-2">配音文案</div>
                          <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                            <p className="text-sm text-white leading-relaxed">"{seg.voiceover_text}"</p>
                          </div>
                        </div>

                        <div>
                          <div className="text-xs text-gray-500 font-bold mb-2">画面描述</div>
                          <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                            <p className="text-xs text-gray-400 leading-relaxed">{seg.script_content}</p>
                          </div>
                        </div>

                        <div>
                          <div className="text-xs text-gray-500 font-bold mb-2 flex items-center gap-2">
                            <Layers size={12} className="text-blue-400" />
                            视频提示词
                          </div>
                          <div className="bg-blue-500/5 rounded-xl p-4 border border-blue-500/20">
                            <p className="text-xs text-blue-300/80 leading-relaxed font-mono">{seg.video_prompt || seg.script_content}</p>
                          </div>
                        </div>

                        <div>
                          <div className="text-xs text-gray-500 font-bold mb-2 flex items-center gap-2">
                            <Sparkles size={12} className="text-amber-400" />
                            首帧生图提示词
                          </div>
                          <div className="bg-amber-500/5 rounded-xl p-4 border border-amber-500/20">
                            <p className="text-xs text-amber-300/80 leading-relaxed font-mono">{seg.frame_prompt}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center justify-center gap-6">
            <button 
              onClick={() => navigate(ViewType.SETUP)}
              className="px-8 py-4 border border-white/10 rounded-2xl text-sm font-bold hover:bg-white/5 transition-all"
            >
              返回修改脚本
            </button>
            <button 
              onClick={() => navigate(ViewType.FRAME_GENERATION)}
              className="px-8 py-4 bg-violet-600 hover:bg-violet-500 rounded-2xl text-sm font-bold text-white transition-all shadow-2xl shadow-violet-600/40 flex items-center justify-center gap-3"
            >
              <span>确认脚本，生成首帧</span>
              <ArrowRight size={20} />
            </button>
          </div>
        </div>
      );
    }

    // 如果正在生成，显示加载动画
    return (
      <div className="max-w-4xl mx-auto py-12 px-6">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-violet-600/20 rounded-full flex items-center justify-center mx-auto mb-6 relative">
            <Sparkles className="text-violet-400 animate-pulse" size={40} />
            <div className="absolute inset-0 border-4 border-violet-600/30 border-t-violet-600 rounded-full animate-spin" />
          </div>
          <h2 className="text-3xl font-bold mb-3">AI 正在生成新脚本</h2>
          <p className="text-gray-500 max-w-md mx-auto">
            系统正在基于爆款视频结构，为您的产品"{state.productInfo.name}"重新创作脚本...
          </p>
        </div>

        <div className="glass-panel rounded-[2.5rem] p-8 border border-white/5">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">原视频结构</span>
              <span className="text-sm font-bold text-violet-400">{state.analysis?.structure}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">分镜数量</span>
              <span className="text-sm font-bold text-white">{state.analysis?.segments.length} 个</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">视觉节奏</span>
              <span className="text-sm font-bold text-emerald-400">{state.analysis?.pace}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">新产品</span>
              <span className="text-sm font-bold text-white">{state.productInfo.name}</span>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-white/10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-2 h-2 bg-violet-500 rounded-full animate-pulse" />
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">生成进度</span>
            </div>
            <div className="space-y-3">
              {[
                '分析原视频结构...',
                '提取核心爆款元素...',
                '融入新产品卖点...',
                '生成分镜脚本...',
                '优化首帧提示词...'
              ].map((step, idx) => (
                <div key={idx} className="flex items-center gap-3 text-sm">
                  <div className="w-5 h-5 rounded-full bg-violet-600/20 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
                  </div>
                  <span className="text-gray-400">{step}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-xs text-gray-600">预计需要 30-60 秒，请耐心等待...</p>
        </div>
      </div>
    );
  };

  // 新增：首帧生成阶段视图
  const renderFrameGeneration = () => {
    if (!state.currentReplication) {
      return (
        <div className="max-w-4xl mx-auto py-12 px-6 text-center">
          <p className="text-gray-500">脚本数据加载中...</p>
        </div>
      );
    }

    // 获取叙事类型的中文标签
    const getNarrativeLabel = (type: string) => {
      const labels: Record<string, string> = {
        hook: '钩子',
        selling_point: '卖点',
        proof: '证明',
        cta: '转化'
      };
      return labels[type] || type;
    };

    // 处理首帧生成
    const handleGenerateFrames = async () => {
      setState(prev => ({ ...prev, replicationStatus: VideoGenerationStatus.GENERATING_FRAMES }));
      
      try {
        const { generateAllFrames } = await import('./services/imageGenerationService');
        
        // 准备商品图片
        const productImages = state.productInfo.images;
        
        // 根据用户选择的数量生成多个版本的首帧
        const frameMap = await generateAllFrames(
          state.currentReplication!.segments,
          productImages,
          state.imageConfig,
          state.genCount, // 传递用户选择的数量
          (current, total) => {
            console.log(`Generating frames: ${current}/${total}`);
          }
        );
        
        // 更新分镜数据，添加生成的首帧数组
        const updatedSegments = state.currentReplication!.segments.map(seg => ({
          ...seg,
          generated_frames: frameMap.get(seg.id) || seg.generated_frames || []
        }));
        
        setState(prev => ({
          ...prev,
          currentReplication: prev.currentReplication ? {
            ...prev.currentReplication,
            segments: updatedSegments
          } : null,
          replicationStatus: VideoGenerationStatus.IDLE
        }));
        
        pushToast('success', `所有首帧生成完成：共 ${state.currentReplication!.segments.length * state.genCount} 张`);
      } catch (error) {
        console.error('Frame generation failed:', error);
        pushToast('error', `首帧生成失败：${formatErrorMessage(error)}`);
        setState(prev => ({ ...prev, replicationStatus: VideoGenerationStatus.IDLE }));
      }
    };

    // 重新生成单个首帧
    const handleRegenerateFrame = async (segmentId: string, groupIndex: number) => {
      const segment = state.currentReplication!.segments.find(s => s.id === segmentId);
      if (!segment) {
        pushToast('error', '找不到对应的分镜');
        return;
      }

      const confirmed = confirm(`确定要重新生成第 ${groupIndex + 1} 组的这个首帧吗？`);
      if (!confirmed) return;

      try {
        setState(prev => ({ ...prev, replicationStatus: VideoGenerationStatus.GENERATING_FRAMES }));
        
        const { generateSingleFrame } = await import('./services/imageGenerationService');
        
        const productImages = state.productInfo.images;
        
        console.log(`Regenerating frame for segment ${segmentId}, group ${groupIndex}`);
        const newFrameUrl = await generateSingleFrame(segment, productImages, state.imageConfig);
        
        // 更新该分镜的首帧
        const updatedSegments = state.currentReplication!.segments.map(seg => {
          if (seg.id === segmentId && seg.generated_frames) {
            const newFrames = [...seg.generated_frames];
            newFrames[groupIndex] = newFrameUrl;
            return { ...seg, generated_frames: newFrames };
          }
          return seg;
        });
        
        setState(prev => ({
          ...prev,
          currentReplication: prev.currentReplication ? {
            ...prev.currentReplication,
            segments: updatedSegments
          } : null,
          replicationStatus: VideoGenerationStatus.IDLE
        }));
        
        pushToast('success', '首帧重新生成完成');
      } catch (error) {
        console.error('Frame regeneration failed:', error);
        pushToast('error', `首帧重新生成失败：${formatErrorMessage(error)}`);
        setState(prev => ({ ...prev, replicationStatus: VideoGenerationStatus.IDLE }));
      }
    };

    // 尺寸和分辨率选项（直接定义，避免动态导入问题）
    const sizeOptions = [
      { value: '9:16', label: '竖屏 (9:16)', dimensions: '1440x2560' },
      { value: '16:9', label: '横屏 (16:9)', dimensions: '2560x1440' },
      { value: '1:1', label: '方形 (1:1)', dimensions: '2048x2048' },
      { value: '4:3', label: '标准 (4:3)', dimensions: '2304x1728' },
      { value: '3:4', label: '竖版 (3:4)', dimensions: '1728x2304' },
      { value: '3:2', label: '宽屏 (3:2)', dimensions: '2496x1664' },
      { value: '2:3', label: '竖版宽屏 (2:3)', dimensions: '1664x2496' },
      { value: '21:9', label: '超宽屏 (21:9)', dimensions: '3024x1296' }
    ];

    const resolutionOptions = [
      { value: '2K' as const, label: '2K (标准)' },
      { value: '4K' as const, label: '4K (高清)' }
    ];

    // 检查是否已生成首帧（检查数组而不是单个）
    const hasGeneratedFrames = state.currentReplication.segments.some(seg => seg.generated_frames && seg.generated_frames.length > 0);

    return (
      <div className="max-w-7xl mx-auto py-12 px-6">
        <div className="flex items-center justify-between mb-10">
          <button 
            onClick={() => navigate(ViewType.SETUP)} 
            className="group flex items-center gap-3 text-gray-400 hover:text-white transition-all bg-white/5 hover:bg-white/10 px-5 py-2.5 rounded-2xl border border-white/5"
          >
            <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
            <span className="font-bold text-sm">返回修改</span>
          </button>
          
          <div className="flex items-center gap-3">
            <div className="px-4 py-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20 flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-400" />
              <span className="text-xs font-bold text-emerald-400">脚本生成完成</span>
            </div>
          </div>
        </div>

        {/* 进度指示器 */}
        <div className="flex items-center justify-center gap-4 mb-12">
          {[
            { n: 1, l: "脚本生成", done: true },
            { n: 2, l: "首帧生成", done: hasGeneratedFrames },
            { n: 3, l: "分镜生成", done: false },
            { n: 4, l: "视频合成", done: false }
          ].map((s, idx) => (
            <React.Fragment key={s.n}>
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${s.done ? 'bg-emerald-600 text-white' : s.n === 2 ? 'bg-violet-600 text-white' : 'bg-white/10 text-gray-500'}`}>
                  {s.done ? <CheckCircle2 size={16} /> : s.n}
                </div>
                <span className={`text-sm font-medium ${s.done || s.n === 2 ? 'text-white' : 'text-gray-500'}`}>{s.l}</span>
              </div>
              {idx < 3 && <div className={`w-16 h-[2px] ${s.done ? 'bg-emerald-600' : 'bg-white/10'}`} />}
            </React.Fragment>
          ))}
        </div>

        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold mb-3">{hasGeneratedFrames ? '首帧已生成' : '配置首帧生成参数'}</h2>
          <p className="text-gray-500 max-w-2xl mx-auto">
            {hasGeneratedFrames 
              ? `已为 ${state.currentReplication.segments.length} 个分镜生成 ${state.genCount} 组首帧图片，共 ${state.currentReplication.segments.length * state.genCount} 张。`
              : `请选择图片尺寸和分辨率，系统将为 ${state.currentReplication.segments.length} 个分镜各生成 ${state.genCount} 个版本的首帧图片。`
            }
          </p>
        </div>

        {/* 图片生成配置 */}
        {!hasGeneratedFrames && (
          <div className="glass-panel rounded-[2.5rem] p-8 border border-white/5 mb-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* 尺寸选择 */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-4">
                  <Layout size={20} className="text-violet-400" />
                  <h3 className="text-lg font-bold">图片尺寸</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {sizeOptions.map((option: any) => (
                    <button
                      key={option.value}
                      onClick={() => setState(s => ({ ...s, imageConfig: { ...s.imageConfig, size: option.value } }))}
                      className={`p-4 rounded-2xl border-2 transition-all text-left ${
                        state.imageConfig.size === option.value
                          ? 'border-violet-500 bg-violet-500/10'
                          : 'border-white/10 bg-white/5 hover:border-white/20'
                      }`}
                    >
                      <div className="font-bold text-sm mb-1">{option.label}</div>
                      <div className="text-xs text-gray-500 font-mono">{option.dimensions}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 分辨率选择 */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-4">
                  <Sparkles size={20} className="text-amber-400" />
                  <h3 className="text-lg font-bold">图片分辨率</h3>
                </div>
                <div className="space-y-3">
                  {resolutionOptions.map((option: any) => (
                    <button
                      key={option.value}
                      onClick={() => setState(s => ({ ...s, imageConfig: { ...s.imageConfig, resolution: option.value } }))}
                      className={`w-full p-4 rounded-2xl border-2 transition-all text-left ${
                        state.imageConfig.resolution === option.value
                          ? 'border-amber-500 bg-amber-500/10'
                          : 'border-white/10 bg-white/5 hover:border-white/20'
                      }`}
                    >
                      <div className="font-bold">{option.label}</div>
                    </button>
                  ))}
                </div>

                {/* 当前配置预览 */}
                <div className="mt-6 p-4 bg-white/5 rounded-xl border border-white/5">
                  <div className="text-xs text-gray-500 font-bold mb-2 uppercase tracking-widest">当前配置</div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">尺寸比例</span>
                      <span className="font-bold text-white">{state.imageConfig.size}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">分辨率</span>
                      <span className="font-bold text-amber-400">{state.imageConfig.resolution}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">生成数量</span>
                      <span className="font-bold text-violet-400">{state.currentReplication.segments.length * state.genCount} 张（{state.genCount} 组）</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 首帧展示网格 - 按组显示 */}
        {hasGeneratedFrames && (
          <div className="mb-10 space-y-8">
            {Array.from({ length: state.genCount }).map((_, groupIndex) => (
              <div key={groupIndex} className="glass-panel rounded-3xl p-8 border border-white/5">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-8 bg-violet-600 rounded-full"></div>
                    <h3 className="text-2xl font-black">第 {groupIndex + 1} 组首帧</h3>
                    <span className="px-3 py-1 bg-violet-500/10 text-violet-400 text-xs font-bold rounded-lg border border-violet-500/20">
                      {state.currentReplication.segments.length} 个分镜
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                  {state.currentReplication.segments.map((seg, segIdx) => {
                    const frameUrl = seg.generated_frames?.[groupIndex];
                    return (
                      <div key={`${seg.id}-${groupIndex}`} className="bg-white/5 p-3 rounded-2xl border border-white/10 hover:border-white/20 transition-all group">
                        <div className="aspect-[9/16] bg-gray-900 rounded-xl overflow-hidden relative border border-white/10 mb-3">
                          {frameUrl ? (
                            <img src={frameUrl} className="w-full h-full object-cover" alt={`Group ${groupIndex + 1} Frame ${segIdx + 1}`} />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-600">
                              <ImageIcon size={32} />
                            </div>
                          )}
                          <div className="absolute top-2 left-2 px-2 py-1 bg-black/70 backdrop-blur-md rounded-lg text-[10px] font-black border border-white/10">
                            #{segIdx + 1}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center gap-1">
                            <span className={`px-2 py-0.5 text-[9px] font-bold rounded-md ${
                              seg.narrative_type === 'hook' ? 'bg-red-500/20 text-red-400' :
                              seg.narrative_type === 'selling_point' ? 'bg-blue-500/20 text-blue-400' :
                              seg.narrative_type === 'proof' ? 'bg-green-500/20 text-green-400' :
                              'bg-purple-500/20 text-purple-400'
                            }`}>
                              {getNarrativeLabel(seg.narrative_type)}
                            </span>
                            <span className="text-[9px] text-gray-500 font-mono">{seg.time}</span>
                          </div>
                          <p className="text-[10px] text-gray-400 line-clamp-2 leading-relaxed">{seg.voiceover_text}</p>
                          
                          {/* 重新生成按钮 */}
                          {frameUrl && (
                            <button
                              onClick={() => handleRegenerateFrame(seg.id, groupIndex)}
                              disabled={state.replicationStatus === VideoGenerationStatus.GENERATING_FRAMES}
                              className="w-full py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] font-bold transition-all border border-white/5 flex items-center justify-center gap-1 disabled:opacity-50"
                            >
                              <Sparkles size={10} /> 重新生成
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex items-center justify-center gap-6">
          {!hasGeneratedFrames ? (
            <>
              <button 
                onClick={() => navigate(ViewType.SETUP)}
                className="px-8 py-4 border border-white/10 rounded-2xl text-sm font-bold hover:bg-white/5 transition-all"
              >
                返回修改脚本
              </button>
              <button 
                onClick={handleGenerateFrames}
                disabled={state.replicationStatus === VideoGenerationStatus.GENERATING_FRAMES}
                className="px-8 py-4 bg-violet-600 hover:bg-violet-500 rounded-2xl text-sm font-bold text-white transition-all shadow-2xl shadow-violet-600/40 flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {state.replicationStatus === VideoGenerationStatus.GENERATING_FRAMES ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>AI 正在生成首帧...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={20} />
                    <span>开始生成首帧</span>
                    <ArrowRight size={20} />
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <button 
                onClick={handleGenerateFrames}
                className="px-8 py-4 border border-white/10 rounded-2xl text-sm font-bold hover:bg-white/5 transition-all"
              >
                重新生成全部首帧
              </button>
              <button 
                onClick={() => navigate(ViewType.VIDEO_GENERATION)}
                className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 rounded-2xl text-sm font-bold text-white transition-all shadow-2xl shadow-emerald-600/40 flex items-center justify-center gap-3"
              >
                <span>确认首帧，生成分镜视频</span>
                <ArrowRight size={20} />
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  // 新增：分镜视频生成阶段视图
  const renderVideoGeneration = () => {
    if (!state.currentReplication) {
      return (
        <div className="max-w-3xl mx-auto py-12 px-6 text-center">
          <p className="text-gray-500">没有可用的复刻数据</p>
          <button onClick={() => navigate(ViewType.HOME)} className="mt-4 px-6 py-3 bg-violet-600 rounded-xl">
            返回首页
          </button>
        </div>
      );
    }

    // 处理分镜视频生成（为每个分镜的所有首帧版本生成视频）
    const handleGenerateVideos = async () => {
      setState(prev => ({ ...prev, replicationStatus: VideoGenerationStatus.GENERATING_VIDEOS }));
      
      try {
        const { generateAllSegmentVideos, getDefaultVideoConfig } = await import('./services/videoGenerationService');
        
        const videoConfig = getDefaultVideoConfig();
        
        const videoMap = await generateAllSegmentVideos(
          state.currentReplication!.segments,
          videoConfig,
          (current, total, segmentId) => {
            console.log(`Generating videos: ${current}/${total} (segment: ${segmentId})`);
          }
        );
        
        // 更新分镜数据，添加生成的视频数组
        const updatedSegments = state.currentReplication!.segments.map(seg => ({
          ...seg,
          generated_videos: videoMap.get(seg.id) || seg.generated_videos || []
        }));
        
        setState(prev => ({
          ...prev,
          currentReplication: prev.currentReplication ? {
            ...prev.currentReplication,
            segments: updatedSegments
          } : null,
          replicationStatus: VideoGenerationStatus.IDLE
        }));
        
        const totalVideos = state.currentReplication!.segments.length * state.genCount;
        pushToast('success', `所有分镜视频生成完成：共 ${totalVideos} 个`);
      } catch (error) {
        console.error('Video generation failed:', error);
        pushToast('error', `视频生成失败：${formatErrorMessage(error)}`);
        setState(prev => ({ ...prev, replicationStatus: VideoGenerationStatus.IDLE }));
      }
    };

    // 重新生成单个视频
    const handleRegenerateVideo = async (segmentId: string, groupIndex: number) => {
      const segment = state.currentReplication!.segments.find(s => s.id === segmentId);
      if (!segment || !segment.generated_frames || !segment.generated_frames[groupIndex]) {
        pushToast('error', '找不到对应的首帧图片');
        return;
      }

      const confirmed = confirm(`确定要重新生成第 ${groupIndex + 1} 组的这个分镜视频吗？`);
      if (!confirmed) return;

      try {
        setState(prev => ({ ...prev, replicationStatus: VideoGenerationStatus.GENERATING_VIDEOS }));
        
        const { generateSingleVideo, getDefaultVideoConfig } = await import('./services/videoGenerationService');
        
        const videoConfig = getDefaultVideoConfig();
        const frameImageUrl = segment.generated_frames[groupIndex];
        
        console.log(`Regenerating video for segment ${segmentId}, group ${groupIndex}`);
        const newVideoUrl = await generateSingleVideo(segment, frameImageUrl, videoConfig);
        
        // 更新该分镜的视频
        const updatedSegments = state.currentReplication!.segments.map(seg => {
          if (seg.id === segmentId && seg.generated_videos) {
            const newVideos = [...seg.generated_videos];
            newVideos[groupIndex] = newVideoUrl;
            return { ...seg, generated_videos: newVideos };
          }
          return seg;
        });
        
        setState(prev => ({
          ...prev,
          currentReplication: prev.currentReplication ? {
            ...prev.currentReplication,
            segments: updatedSegments
          } : null,
          replicationStatus: VideoGenerationStatus.IDLE
        }));
        
        pushToast('success', '视频重新生成完成');
      } catch (error) {
        console.error('Video regeneration failed:', error);
        pushToast('error', `视频重新生成失败：${formatErrorMessage(error)}`);
        setState(prev => ({ ...prev, replicationStatus: VideoGenerationStatus.IDLE }));
      }
    };

    // 检查是否已生成视频
    const hasGeneratedVideos = state.currentReplication.segments.some(seg => seg.generated_videos && seg.generated_videos.length > 0);

    // 获取叙事类型的中文标签
    const getNarrativeLabel = (type: string) => {
      const labels: Record<string, string> = {
        hook: '钩子',
        selling_point: '卖点',
        proof: '证明',
        cta: '转化'
      };
      return labels[type] || type;
    };

    return (
      <div className="max-w-7xl mx-auto py-12 px-6">
        <button onClick={() => setState(s => ({ ...s, currentView: ViewType.FRAME_GENERATION }))} className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors">
          <ChevronLeft size={20} /> 返回首帧生成
        </button>

        {/* 进度指示器 */}
        <div className="flex items-center justify-center gap-4 mb-10">
          {[
            { n: 1, l: "脚本生成", done: true },
            { n: 2, l: "首帧生成", done: true },
            { n: 3, l: "分镜生成", done: hasGeneratedVideos },
            { n: 4, l: "视频合成", done: false }
          ].map((s, i) => (
            <React.Fragment key={s.n}>
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${s.done ? 'bg-emerald-600 text-white' : s.n === 3 ? 'bg-violet-600 text-white' : 'bg-white/10 text-gray-500'}`}>
                  {s.done ? <CheckCircle2 size={16} /> : s.n}
                </div>
                <span className={`text-sm font-medium ${s.done || s.n === 3 ? 'text-white' : 'text-gray-500'}`}>{s.l}</span>
              </div>
              {i < 3 && <div className={`w-16 h-[2px] ${s.done ? 'bg-emerald-600' : 'bg-white/10'}`} />}
            </React.Fragment>
          ))}
        </div>

        <div className="space-y-8">
          {!hasGeneratedVideos ? (
            /* 配置和生成界面 */
            <div className="glass-panel rounded-3xl p-8">
              <h2 className="text-2xl font-black mb-6">生成分镜视频</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                  <div className="text-xs text-gray-500 font-bold uppercase mb-2">分镜数量</div>
                  <div className="text-3xl font-black">{state.currentReplication.segments.length}</div>
                </div>
                <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                  <div className="text-xs text-gray-500 font-bold uppercase mb-2">视频版本数</div>
                  <div className="text-3xl font-black">{state.genCount} 组</div>
                </div>
                <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                  <div className="text-xs text-gray-500 font-bold uppercase mb-2">总视频数量</div>
                  <div className="text-3xl font-black text-violet-400">{state.currentReplication.segments.length * state.genCount} 个</div>
                </div>
              </div>

              <div className="bg-violet-600/10 border border-violet-500/20 rounded-2xl p-6 mb-8">
                <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                  <Settings size={16} className="text-violet-400" />
                  生成配置
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">分辨率：</span>
                    <span className="text-white font-bold">720p</span>
                  </div>
                  <div>
                    <span className="text-gray-500">宽高比：</span>
                    <span className="text-white font-bold">自适应（根据首帧）</span>
                  </div>
                  <div>
                    <span className="text-gray-500">音频：</span>
                    <span className="text-emerald-400 font-bold">✓ 有声视频（基于配音文案）</span>
                  </div>
                  <div>
                    <span className="text-gray-500">水印：</span>
                    <span className="text-emerald-400 font-bold">✓ 无水印</span>
                  </div>
                </div>
              </div>

              <div className="bg-blue-600/10 border border-blue-500/20 rounded-2xl p-4 mb-8">
                <p className="text-sm text-blue-400">
                  <strong>说明：</strong>系统将为每个分镜的 {state.genCount} 个首帧版本各生成 1 个视频，共 {state.currentReplication.segments.length * state.genCount} 个视频。最终合成时会将同一组的 {state.currentReplication.segments.length} 个分镜视频按顺序合成为完整视频。
                </p>
              </div>

              <button 
                onClick={handleGenerateVideos}
                disabled={state.replicationStatus === VideoGenerationStatus.GENERATING_VIDEOS}
                className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold py-5 rounded-2xl transition-all shadow-lg shadow-violet-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {state.replicationStatus === VideoGenerationStatus.GENERATING_VIDEOS ? (
                  <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> AI 正在生成分镜视频...</>
                ) : (
                  <>开始生成分镜视频 <Play size={20} /></>
                )}
              </button>
            </div>
          ) : (
            /* 视频展示界面 - 按组显示 */
            <>
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold mb-3">分镜视频已生成</h2>
                <p className="text-gray-400">共生成 {state.genCount} 组视频，每组包含 {state.currentReplication.segments.length} 个分镜</p>
              </div>

              <div className="space-y-8">
                {Array.from({ length: state.genCount }).map((_, groupIndex) => (
                  <div key={groupIndex} className="glass-panel rounded-3xl p-8">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-1.5 h-8 bg-emerald-600 rounded-full"></div>
                        <h3 className="text-2xl font-black">第 {groupIndex + 1} 组视频</h3>
                        <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-bold rounded-lg border border-emerald-500/20">
                          {state.currentReplication.segments.length} 个分镜
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {state.currentReplication.segments.map((segment, segIdx) => {
                        const videoUrl = segment.generated_videos?.[groupIndex];
                        return (
                          <div key={`${segment.id}-${groupIndex}`} className="bg-white/5 rounded-2xl p-4 border border-white/10">
                            {/* 视频预览 */}
                            <div className="aspect-video rounded-xl overflow-hidden bg-black mb-4">
                              {videoUrl ? (
                                <video 
                                  key={videoUrl}
                                  src={videoUrl} 
                                  className="w-full h-full object-contain"
                                  controls
                                  preload="metadata"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-500">
                                  <p className="text-sm">视频生成中...</p>
                                </div>
                              )}
                            </div>

                            {/* 分镜信息 */}
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-lg font-black text-gray-600">#{segIdx + 1}</span>
                                  <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                                    segment.narrative_type === 'hook' ? 'bg-red-500/20 text-red-400' :
                                    segment.narrative_type === 'selling_point' ? 'bg-blue-500/20 text-blue-400' :
                                    segment.narrative_type === 'proof' ? 'bg-green-500/20 text-green-400' :
                                    'bg-purple-500/20 text-purple-400'
                                  }`}>
                                    {getNarrativeLabel(segment.narrative_type)}
                                  </span>
                                </div>
                                <span className="text-xs text-gray-500 font-mono">{segment.time}</span>
                              </div>

                              <div>
                                <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">配音文案</div>
                                <p className="text-xs text-white line-clamp-2">{segment.voiceover_text}</p>
                              </div>
                              <div>
                                <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">画面描述</div>
                                <p className="text-xs text-gray-400 line-clamp-2">{segment.script_content}</p>
                              </div>

                              {/* 重新生成按钮 */}
                              {videoUrl && (
                                <button
                                  onClick={() => handleRegenerateVideo(segment.id, groupIndex)}
                                  disabled={state.replicationStatus === VideoGenerationStatus.GENERATING_VIDEOS}
                                  className="w-full py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold transition-all border border-white/5 flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                  <Sparkles size={12} /> 重新生成
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <button 
                onClick={() => navigate(ViewType.VIDEO_COMPOSITION)}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-5 rounded-2xl transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2"
              >
                确认分镜，合成 {state.genCount} 个完整视频 <ArrowRight size={20} />
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  // Phase 5: 视频合成阶段视图
  const renderVideoComposition = () => {
    if (!state.currentReplication) {
      return (
        <div className="max-w-3xl mx-auto py-12 px-6 text-center">
          <p className="text-gray-500">没有可用的复刻数据</p>
        </div>
      );
    }

    const genCount = state.genCount;
    const segments = state.currentReplication.segments;

    // 检查是否所有分镜都已生成视频
    const hasAllVideos = segments.every(seg => 
      seg.generated_videos && seg.generated_videos.length === genCount
    );

    if (!hasAllVideos) {
      return (
        <div className="max-w-3xl mx-auto py-12 px-6 text-center">
          <p className="text-gray-500">请先完成所有分镜视频的生成</p>
          <button 
            onClick={() => navigate(ViewType.VIDEO_GENERATION)}
            className="mt-6 px-8 py-4 bg-violet-600 hover:bg-violet-500 rounded-2xl text-sm font-bold text-white transition-all"
          >
            返回视频生成
          </button>
        </div>
      );
    }

    // 开始合成视频
    const handleStartComposition = async () => {
      setCompositionStatus('composing');
      
      try {
        const { composeAllVideos } = await import('./services/videoCompositionService');
        
        // 准备数据：每组分镜视频的 URLs
        const segmentVideos = Array.from({ length: genCount }).map((_, groupIndex) =>
          segments.map(seg => seg.generated_videos![groupIndex])
        );
        
        // 初始化状态
        const initialVideos = segmentVideos.map((_, index) => ({
          id: `composed-${index}`,
          version: index + 1,
          outputUrl: '',
          progress: 0,
          status: 'pending' as const
        }));
        setComposedVideos(initialVideos);
        
        // 批量合成
        const outputUrls = await composeAllVideos(
          segmentVideos,
          state.productInfo.name || '爆款视频',
          (videoIndex, progress) => {
            // 更新进度
            setComposedVideos(prev => prev.map((v, i) => 
              i === videoIndex 
                ? { ...v, progress, status: progress === 100 ? 'completed' : 'processing' }
                : v
            ));
          }
        );
        
        // 更新最终结果
        setComposedVideos(prev => prev.map((v, i) => ({
          ...v,
          outputUrl: outputUrls[i],
          progress: 100,
          status: outputUrls[i] ? 'completed' : 'failed'
        })));
        
        setCompositionStatus('completed');
        
      } catch (error) {
        console.error('Video composition failed:', error);
        pushToast('error', `视频合成失败：${formatErrorMessage(error)}`);
        setCompositionStatus('idle');
      }
    };

    // 下载单个视频
    const handleDownloadVideo = (videoIndex: number) => {
      const video = composedVideos[videoIndex];
      if (!video.outputUrl) {
        pushToast('info', '视频尚未合成完成');
        return;
      }
      
      // 添加 ?download=true 参数强制下载
      const downloadUrl = video.outputUrl + '?download=true';
      
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${state.productInfo.name || '爆款视频'}_版本${video.version}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    };

    // 批量打包下载
    const handleBatchDownload = () => {
      const completedVideos = composedVideos.filter(v => v.outputUrl);
      if (completedVideos.length === 0) {
        pushToast('info', '没有可下载的视频');
        return;
      }
      
      // 逐个下载
      completedVideos.forEach((video, index) => {
        setTimeout(() => {
          handleDownloadVideo(composedVideos.indexOf(video));
        }, index * 1000); // 间隔 1 秒
      });
    };

    // 播放视频
    const handlePlayVideo = (videoIndex: number) => {
      const video = composedVideos[videoIndex];
      if (!video.outputUrl) {
        pushToast('info', '视频尚未合成完成');
        return;
      }
      window.open(video.outputUrl, '_blank');
    };

    // 如果还未开始合成，显示准备界面
    if (compositionStatus === 'idle') {
      return (
        <div className="max-w-5xl mx-auto py-12 px-6">
          <div className="flex items-center justify-between mb-10">
            <button 
              onClick={() => navigate(ViewType.VIDEO_GENERATION)} 
              className="group flex items-center gap-3 text-gray-400 hover:text-white transition-all bg-white/5 hover:bg-white/10 px-5 py-2.5 rounded-2xl border border-white/5"
            >
              <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
              <span className="font-bold text-sm">返回修改</span>
            </button>
          </div>

          <div className="text-center mb-12">
            <div className="w-20 h-20 bg-violet-600/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Sparkles className="text-violet-400" size={48} />
            </div>
            <h2 className="text-3xl font-bold mb-3">准备合成完整视频</h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              所有分镜视频已生成完成，点击下方按钮开始合成 {genCount} 个完整视频
            </p>
          </div>

          <div className="glass-panel rounded-[2.5rem] p-8 border border-white/5 mb-10">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-3xl font-black text-violet-400 mb-2">{genCount}</div>
                <div className="text-xs text-gray-500 font-bold uppercase tracking-widest">完整视频数量</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-black text-emerald-400 mb-2">{segments.length}</div>
                <div className="text-xs text-gray-500 font-bold uppercase tracking-widest">每个视频分镜数</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-black text-blue-400 mb-2">{state.currentReplication.total_duration}</div>
                <div className="text-xs text-gray-500 font-bold uppercase tracking-widest">预计时长</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-black text-amber-400 mb-2 line-clamp-1">{state.currentReplication.narrative_structure}</div>
                <div className="text-xs text-gray-500 font-bold uppercase tracking-widest">叙事结构</div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-6">
            <button 
              onClick={() => navigate(ViewType.VIDEO_GENERATION)}
              className="px-8 py-4 border border-white/10 rounded-2xl text-sm font-bold hover:bg-white/5 transition-all"
            >
              返回修改分镜
            </button>
            <button 
              onClick={handleStartComposition}
              className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 rounded-2xl text-sm font-bold text-white transition-all shadow-2xl shadow-emerald-600/40 flex items-center justify-center gap-3"
            >
              <Sparkles size={20} />
              <span>开始合成 {genCount} 个完整视频</span>
            </button>
          </div>
        </div>
      );
    }

    // 如果正在合成，显示进度界面
    if (compositionStatus === 'composing') {
      return (
        <div className="max-w-5xl mx-auto py-12 px-6">
          <div className="text-center mb-12">
            <div className="w-20 h-20 bg-violet-600/20 rounded-full flex items-center justify-center mx-auto mb-6 relative">
              <Sparkles className="text-violet-400 animate-pulse" size={48} />
              <div className="absolute inset-0 border-4 border-violet-600/30 border-t-violet-600 rounded-full animate-spin" />
            </div>
            <h2 className="text-3xl font-bold mb-3">正在合成视频...</h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              使用 FFmpeg 合并分镜视频，预计需要 2-5 分钟，请耐心等待
            </p>
          </div>

          <div className="space-y-6">
            {composedVideos.map((video, index) => (
              <div key={video.id} className="glass-panel rounded-[2rem] p-6 border border-white/5">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-lg font-bold">版本 {video.version}</span>
                  <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                    video.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                    video.status === 'processing' ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30' :
                    video.status === 'failed' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                    'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                  }`}>
                    {video.status === 'completed' ? 'Ready' :
                     video.status === 'processing' ? 'Processing' :
                     video.status === 'failed' ? 'Failed' :
                     'Pending'}
                  </span>
                </div>
                
                <div className="relative">
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-violet-600 to-emerald-600 transition-all duration-500"
                      style={{ width: `${video.progress}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-400 mt-2 text-center">{video.progress}%</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // 如果已完成，显示成功界面
    return (
      <div className="max-w-5xl mx-auto py-12 px-6">
        <div className="flex items-center justify-between mb-10">
          <button 
            onClick={() => navigate(ViewType.VIDEO_GENERATION)} 
            className="group flex items-center gap-3 text-gray-400 hover:text-white transition-all bg-white/5 hover:bg-white/10 px-5 py-2.5 rounded-2xl border border-white/5"
          >
            <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
            <span className="font-bold text-sm">返回修改</span>
          </button>
        </div>

        <div className="text-center mb-12">
          <div className="w-20 h-20 bg-emerald-600/20 rounded-full flex items-center justify-center mx-auto mb-6 relative">
            <CheckCircle2 className="text-emerald-400" size={48} />
            <div className="absolute inset-0 border-4 border-emerald-600/30 rounded-full animate-ping" />
          </div>
          <h2 className="text-3xl font-bold mb-3">生成成功！</h2>
          <p className="text-gray-500 max-w-2xl mx-auto">
            系统已为您生成了 {genCount} 个爆款复刻版本，每个版本包含 {segments.length} 个分镜
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {composedVideos.map((video, idx) => (
            <div key={video.id} className="glass-panel rounded-[2rem] p-6 border border-white/5 hover:border-violet-500/20 transition-all group">
              <div className="aspect-[9/16] bg-gray-900 rounded-2xl overflow-hidden relative mb-4 border border-white/10">
                <video 
                  key={video.outputUrl}
                  src={video.outputUrl} 
                  className="w-full h-full object-cover"
                  poster={state.currentReplication!.segments[0].generated_frames?.[idx]}
                  muted
                  loop
                  playsInline
                />
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center transition-opacity group-hover:bg-black/40">
                    <button 
                      onClick={() => handlePlayVideo(idx)}
                      className="w-16 h-16 bg-white/30 backdrop-blur-md rounded-full flex items-center justify-center border border-white/40 shadow-lg group-hover:scale-110 group-hover:bg-violet-600/80 group-hover:border-violet-400/50 transition-all duration-300"
                    >
                      <Play fill="white" size={28} className="ml-1" />
                    </button>
                  </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold">版本 {video.version}</span>
                  <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-full border border-emerald-500/30">
                    Ready
                  </span>
                </div>

                <div className="space-y-2 text-xs text-gray-400">
                  <div className="flex items-center justify-between">
                    <span>分镜数量</span>
                    <span className="font-bold text-white">{segments.length} 个</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>预计时长</span>
                    <span className="font-bold text-white">{state.currentReplication.total_duration}</span>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button 
                    onClick={() => handlePlayVideo(idx)}
                    className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-bold transition-all border border-white/5 flex items-center justify-center gap-2"
                  >
                    <Play size={16} /> 播放
                  </button>
                  <button 
                    onClick={() => handleDownloadVideo(idx)}
                    className="flex-1 py-3 bg-violet-600 hover:bg-violet-500 rounded-xl text-sm font-bold transition-all shadow-lg shadow-violet-600/20 flex items-center justify-center gap-2"
                  >
                    <Download size={16} /> 下载
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-center gap-6">
          <button 
            onClick={handleBatchDownload}
            className="px-8 py-4 border border-white/10 rounded-2xl text-sm font-bold hover:bg-white/5 transition-all flex items-center gap-3"
          >
            <Download size={20} />
            批量打包下载 (ZIP)
          </button>
          <button 
            onClick={() => navigate(ViewType.SETUP)}
            className="px-8 py-4 border border-violet-500/20 text-violet-400 rounded-2xl text-sm font-bold hover:bg-violet-500/10 transition-all"
          >
            再次生成
          </button>
          <button 
            onClick={() => navigate(ViewType.HOME)}
            className="px-8 py-4 bg-white text-black rounded-2xl text-sm font-bold hover:bg-gray-200 transition-all"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-violet-600/30">
      {/* Navigation Header */}
      <header className="h-20 border-b border-white/5 backdrop-blur-xl sticky top-0 z-50 px-8 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate(ViewType.HOME)}>
          <div className="w-10 h-10 bg-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-600/30 group-hover:scale-110 transition-transform">
            <Zap className="text-white fill-white" size={24} />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">SmartClip AI</span>
            <span className="text-[10px] text-violet-400 font-bold tracking-[0.2em] uppercase leading-none">Pro Edition</span>
          </div>
        </div>
        
        <nav className="hidden md:flex items-center gap-1 bg-white/5 p-1 rounded-2xl border border-white/5">
          {[
            { id: ViewType.HOME, label: '首页', icon: Layout },
            { id: ViewType.HISTORY, label: '历史记录', icon: HistoryIcon },
            { id: ViewType.ASSETS, label: '素材库', icon: Layers }
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => navigate(tab.id)} 
              className={`px-6 py-2 text-sm font-bold rounded-xl transition-all flex items-center gap-2 relative group/nav ${
                state.currentView === tab.id 
                  ? 'bg-white/10 text-white shadow-lg' 
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
              }`}
            >
              <tab.icon size={16} className={state.currentView === tab.id ? 'text-violet-400' : 'text-gray-600 group-hover/nav:text-gray-400'} />
              {tab.label}
              {state.currentView === tab.id && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-violet-500 rounded-full shadow-[0_0_8px_rgba(139,92,246,0.6)]" />
              )}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-4">
           <button 
             onClick={() => navigate(ViewType.UPLOAD)}
             className="hidden lg:flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-violet-600/30 active:scale-95"
           >
             <Plus size={18} /> 新建分析
           </button>
           <div className="h-8 w-[1px] bg-white/10 hidden lg:block mx-2"></div>
           <button className="p-2.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-all relative group">
             <Settings size={20} className="group-hover:rotate-45 transition-transform duration-500" />
             <div className="absolute top-2.5 right-2.5 w-2 h-2 bg-violet-500 rounded-full border-2 border-[#050505]"></div>
           </button>
           <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 border border-white/10 shadow-inner flex items-center justify-center font-bold text-xs cursor-pointer hover:scale-105 transition-transform">
             JD
           </div>
        </div>
      </header>

      <div className="fixed top-24 right-6 z-[60] space-y-3">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`min-w-[260px] max-w-[360px] px-4 py-3 rounded-2xl border backdrop-blur-xl shadow-2xl ${
              t.type === 'success' ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-200' :
              t.type === 'error' ? 'bg-red-500/15 border-red-500/30 text-red-200' :
              'bg-white/10 border-white/10 text-gray-200'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="flex-1 text-sm font-bold leading-relaxed">{t.message}</div>
              <button
                onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
                className="text-xs font-black opacity-60 hover:opacity-100 transition-opacity"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Area */}
      <main className="transition-all duration-500 animate-in fade-in slide-in-from-bottom-4">
        {state.currentView === ViewType.HOME && renderHome()}
        {state.currentView === ViewType.UPLOAD && renderUpload()}
        {state.currentView === ViewType.ANALYSIS && renderAnalysis()}
        {state.currentView === ViewType.SETUP && renderSetup()}
        {state.currentView === ViewType.SUCCESS && renderSuccess()}
        {state.currentView === ViewType.HISTORY && renderHistory()}
        {state.currentView === ViewType.ASSETS && renderAssets()}
        {state.currentView === ViewType.DIRECT_GENERATION && renderDirectGeneration()}
        {state.currentView === ViewType.SCRIPT_GENERATION && renderScriptGeneration()}
        {state.currentView === ViewType.FRAME_GENERATION && renderFrameGeneration()}
        {state.currentView === ViewType.VIDEO_GENERATION && renderVideoGeneration()}
        {state.currentView === ViewType.VIDEO_COMPOSITION && renderVideoComposition()}
      </main>

      <footer className="py-12 px-8 border-t border-white/5 mt-20 text-center">
        <p className="text-gray-600 text-xs">© 2025 SmartClip AI. Powered by Gemini Core 3.0</p>
      </footer>
    </div>
  );
}
