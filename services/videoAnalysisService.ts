
import { DeconstructedVideo, VideoScriptSegment } from '../types';
import { callProxy } from './proxyClient';

const _frameCache = new Map<string, { frames: string[], duration: number }>();

// Configuration
const API_CONFIG = {
  // Using the Python proxy server as in the source project
  PROXY_URL: 'http://127.0.0.1:8888/api/chat',
  // Using configuration from window.FORCE_API_CONFIG in video_analyzer.html
  MODEL_NAME: 'doubao-seed-1-8-251228', 
  MAX_TOKENS: 65535
};

// Types for Source Analysis Result
interface SourceShot {
  shot_id: number;
  time_range: string;
  module_tags: {
    l1_category: string;
    l2_visual: string;
    info_density: string;
  };
  content_desc: string;
  seedance_prompt: string;
  rationale: string;
}

interface SourceAnalysisResult {
  video_analysis_summary: {
    total_duration: string;
    video_style: string;
  };
  shots: SourceShot[];
  sellingPoints?: string[];
  coreElements?: {
    visualPackaging: { color: string; style: string; position: string; function: string };
    visualGuiding: { element: string; direction: string; dynamic: string };
    editingRhythm: { timing: string; transition: string; emotion: string };
    shotFocus: { shotType: string; object: string; purpose: string };
  };
  videoFormula?: {
    visualEffect: string;
    productStyle: string;
    effectDemo: string;
    productPower: string;
  };
  thinking?: string;
}

/**
 * Extracts frames and duration from a video file using Canvas.
 * Ported from video_analyzer.js
 */
export async function extractVideoFrames(file: File): Promise<{ frames: string[], duration: number }> {
  const cacheKey = `${file.name}-${file.size}-${file.lastModified}`;
  const cached = _frameCache.get(cacheKey);
  if (cached) return cached;

  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.src = URL.createObjectURL(file);
    video.muted = true;

    const videoFrames: string[] = [];

    video.addEventListener('loadeddata', async function() {
      try {
        const duration = video.duration;
        const minInterval = 0.4;
        const maxFrames = 80;
        const frameInterval = Math.max(minInterval, duration / maxFrames);
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
        }

        const actualFrameCount = Math.max(1, Math.min(Math.ceil(duration / frameInterval), maxFrames));

        for (let i = 0; i < actualFrameCount; i++) {
            const time = Math.min(duration, i * frameInterval);
            video.currentTime = time;

            await new Promise<void>(resolveSeek => {
                const onSeeked = () => {
                    const maxWidth = 640;
                    const scale = video.videoWidth > maxWidth ? (maxWidth / video.videoWidth) : 1;
                    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
                    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    const frameData = canvas.toDataURL('image/jpeg', 0.65);
                    videoFrames.push(frameData);
                    video.removeEventListener('seeked', onSeeked);
                    resolveSeek();
                };
                video.addEventListener('seeked', onSeeked);
            });
        }

        console.log(`Extracted ${videoFrames.length} frames (Duration: ${duration.toFixed(1)}s)`);
        const result = { frames: videoFrames, duration };
        _frameCache.set(cacheKey, result);
        resolve(result);
      } catch (err) {
        reject(err);
      } finally {
        URL.revokeObjectURL(video.src); // Cleanup
      }
    });

    video.addEventListener('error', (e) => {
      reject(new Error('Error loading video'));
    });
  });
}

/**
 * Builds the analysis prompt.
 * Ported from video_analyzer.js
 */
function buildAnalysisPrompt(productName: string, productDesc: string = '', srtContent: string = ''): string {
    // 使用模板字符串构建提示词，避免复杂的双引号转义问题
    let prompt = `# Role 
 你是一位精通短视频算法与内容营销的专家分析师。你需要基于提供的视频帧序列（定间隔抽帧，最长约80帧）和对应的OCR/ASR文本内容，对视频进行"结构化拆解"与"营销要素提取"。 
 
 # Analysis Logic (Chain of Thought) 
 在生成结果前，请将你的思考过程（Thinking Process）以<Thinking_Block>标签包裹后输出，然后再输出最终的JSON结果： 
 
 ## 一级标签 (L1 Modules) 

### 1. 钩子 (Hook) 
 *   **判定范围**：视频前 **0-5秒**。 
 *   **核心逻辑**：【文案优先】 + 【视觉辅助】。 
     *   *文案*：出现“别划走”、“注意看”、“结果惊人”、“把价格打下来”等强留人语气的。 
     *   *视觉*：画面切换频率极高（<1秒/镜），或出现视觉奇观/强冲突画面。 
 *   **处理规则 (Action)**：无论视觉切了多少次，只要在0-5秒内且服务于吸引注意力，在最终输出中只合并为一个“钩子”模块。 
 
### 2. 卖点 (Selling Point) 
 *   **判定范围**：通常作为产品介绍。 
 *   **核心逻辑**：【文案优先】。 
     *   *文案*：包含“功能描述”、“价格优势”、“解决痛点”、“成分解析”等关键词。 
     *   *边界*：以完整的一句文案（ASR句子）结束点为拆分边界。 
 *   **处理规则 (Action)**：按照镜头内的产品介绍计算权重判断是否为卖点。 
 
### 3. 证明 (Proof) 
 *   **判定范围**：通常作为功能展示。 
 *   **核心逻辑**：【图像优先】。 
     *   *视觉*：必须出现明显的 **“特写(Close-up)”**、**“左右/上下对比(Split Screen)”**、**“第三方检测报告”**、**“显微镜视角”**。 
     *   *文案*：辅助说明（如“看这个对比”、“效果立竿见影”）。 
 *   **处理规则 (Action)**：按照画面中的展示含量多少来计算权重判断是否为证明。 
 
### 4. 场景 (Scene) 
 *   **判定范围**：中段内容，通常作为铺垫或使用场景展示。 
 *   **核心逻辑**：【视觉稳定性】。 
     *   *文案*：环境词（“在家里”、“办公室”）、代词/频率词（“每次...的时候”、“姐妹们”、“如果你也...”）。 
     *   *视觉*：中远景为主，背景环境相对固定。 
 *   **处理规则 (Action)**：**去噪合并**。只要背景场景 (Context) 没有发生剧烈空间切换，即使中间穿插了 1-2 帧短暂的手部特写也保持权重，描述重点放在氛围营造上。 
 
### 5. 转化 (CTA) 
 *   **判定范围**：通常作为引导用户进行购买的行为。 
 *   **核心逻辑**：【文案优先】。 
     *   *文案*：强引导词汇（“点击下方”、“左下角”、“下单”、“链接”、“抢”）或者指引（如指向链接，产品或引导购买）。 
 *   **处理规则 (Action)**：按照镜头内是否有引导购买的行为来计算权重。 
 
 
 ## 二级标签 (L2 Tags) 
 
 ### 1. 【信息密度】 (Pacing) 
 *   **高密度**: 快切、画面元素多、无废帧 (通常用于钩子/快节奏展示) 
 *   **中密度**: 有适当留白，便于理解信息 (通常用于卖点讲解) 
 *   **低密度**: 情绪铺垫、氛围感空镜 (通常用于场景/收尾) 
 
 ### 2. 【视觉语言】 (Visual Language) 
 *   **人脸直出**: 主播/KOL口播 
 *   **产品特写**: 手持展示、材质细节、微距 
 *   **行为演示**: 涂抹、按压、清洗等使用动作 
 *   **对比镜头**: 使用前后分屏、左右对比 
 *   **场景空镜**: 卧室、街道、桌面等环境 
 *   **情绪反应**: 惊讶、享受、痛苦等表情 
 
 ## 思维链处理步骤 
 
 1.  **合并与分段 (Segmentation)**: 
     *   基于 0.4s 的切片，将视觉相似且语义连贯的帧合并为一个 "Shot" (镜头)。 
     *   **规则**: 只要背景和主要动作没变（例如一直是手在涂抹），即使有轻微位移，也视为同一个 Shot。 
 
 2.  **标签匹配 (Tagging)**: 
     *   判断该 Shot 属于 **唯一一个** **一级标签** (如卖点)。每个镜头只能分配一个一级标签，不能是多个标签的组合（如【证明】+【卖点】）。 
     *   评估该 Shot 的 **视觉语言** (如产品特写) 和 **信息密度** (如中密度)。 
     *   根据各标签的判定规则和权重计算，选择最符合的单一一级标签。 
 
 3.  **提示词生成 (Prompt Construction)**: 
     *   将该镜头转化为 AI 生成提示词。 
     *   **格式**: "prompt_text"："主体描述 + 场景环境 + 运镜构图 + 光影色彩 + 动效氛围 + 质量词" 
     *   **主体 (Subject)**: 核心人物/物品，描述外观、衣着、材质、颜色。 
     *   **场景 (Environment)**: 背景细节、地点、空间感（如：模糊的卧室背景）。 
     *   **运镜 (Composition)**: 景别（特写/中景/全景）、拍摄角度（俯拍/平视）、镜头运动（推拉摇移/静态）。 
     *   **光影 (Light)**: 光线类型（自然光/演播室光/伦勃朗光）、色调（暖色/冷色/低饱和）。 
     *   **动效 (Motion)**: 主体动作（微笑/涂抹/奔跑）、速度（慢动作/快速剪辑）。 
     *   **示例**: "特写镜头，一只白皙细腻的手背，滴管滴下一滴透明精华液，液体呈现流动的水状质地，晶莹剔透。背景纯净明亮，演播室布光，强调产品的高级质感和水润感，超高清，8k分辨率。" 
 
 4.  **模块化脚本拆解**: 
     - 基于豆包规范进行模块化拆解 
     - 确保覆盖视频的完整时长 
 
 5.  **爆款公式提炼**: 
     - 纵观全片，分析其美术风格（光线、构图）和产品呈现方式 
 
 6.  **核心元素分析**: 
     - 分析视频的整体核心元素，严格按照四个特定类别进行分析 
 
 # Output Definitions (详细定义) 
 
 ## 1. 视频爆款公式 (Video Formula) 
 *   **主体视觉效果**: 描述整体的"高级感"来源。例如：纯色背景、自然光拍摄、微距特写流。重点描述场景氛围。（注：如果是纯产品展示，侧重描述材质光泽；如果是真人，侧重描述环境代入感）。 
 *   **商品款式**: 客观描述产品的外观、包装、颜色、质地。 
 *   **商品效果演示**: 视频是如何展示"好用"的？例如：涂抹在手上看流动性、用纸巾擦拭看残留等。 
 *   **商品产品力验证**: 视频用了什么"硬核"手段证明效果？例如：左右脸对比、显微镜观察、第三方检测报告。 
 
 ## 2. 结构化脚本 (Structured Script) 
 *   不要输出一段笼统的长文本。请严格按照时间线逻辑，输出带有完整时间节点的详细描述，覆盖视频的全部时长。 
 *   请为每个模块打上一级标签和二级标签，格式：'[一级标签][信息密度][视觉语言] 时间范围: 详细描述' 
 *   示例：'[钩子][高密度][对比镜头] 00:00-00:03: 左右分屏展示使用前后效果对比，快切展示' 
 *   确保每个关键部分都有对应的时间节点，不要遗漏任何重要内容。 
 
 ## 3. 核心元素 (Core Elements) 
 *   分析视频的整体核心元素，严格按照以下四个特定类别进行分析：
 
 ### 3.1 视觉包装 (Visual Packaging) - "高饱和度花字"
 *   **识别目标**: 画面上是否叠加了醒目的文字或贴纸？
 *   **分析细项**:
     *   **色彩**: 是否使用了高饱和度颜色（如亮黄、荧光绿、鲜红）？
     *   **样式**: 字体是否夸张、加粗、有描边或发光效果？
     *   **位置**: 文字是否占据了视觉中心或特定的黄金分割点？
     *   **功能**: 文字是强调痛点（如“烂脸救星”）还是强调利益（如“9.9包邮”）？
 
 ### 3.2 视觉引导 (Visual Guiding) - "醒目指示箭头"
 *   **识别目标**: 画面中是否有辅助图形引导用户视线？
 *   **分析细项**:
     *   **元素**: 是否出现箭头、圆圈圈选、手指贴纸、放大镜效果？
     *   **指向**: 引导指向哪里？（指向产品瑕疵？指向购买链接？指向对比效果？）
     *   **动态**: 这些引导元素是否有闪烁、缩放等动态效果？
 
 ### 3.3 剪辑节奏 (Editing Rhythm) - "动感BGM节奏点"
 *   **识别目标**: *注：由于你是基于分镜图分析，请通过画面切换频率和视觉密度来推断节奏。*
 *   **分析细项**:
     *   **卡点**: 画面切换是否频繁（如0.5秒一切）？这通常对应“动感BGM节奏点”。
     *   **转场**: 是否使用了推拉、甩镜头、白闪等硬切转场？
     *   **情绪**: 画面是平铺直叙（低节奏）还是高频信息轰炸（高节奏）？
 
 ### 3.4 镜头焦点 (Shot Focus) - "产品局部特写"
 *   **识别目标**: 摄影机具体在拍什么？
 *   **分析细项**:
     *   **景别**: 是否使用了微距（Macro）或极致特写（ECU）？
     *   **对象**: 聚焦于产品的哪个细节？（如：面霜的质地、瓶身的Logo、手机的按键反馈）。
     *   **目的**: 该特写是为了展示材质高级感，还是为了证明真实性？
 
 # Output Format 
 请严格按照以下格式输出，先输出思考过程，再输出JSON结果： 
 <Thinking_Block> 
 你的思考过程... 
 </Thinking_Block> 
 { 
   "video_analysis_summary": { 
     "total_duration": "视频总时长", 
     "video_style": "整体视频风格描述（如：生活化Vlog，高亮通透，快节奏）" 
   }, 
   "shots": [ 
     { 
       "shot_id": 1, 
       "time_range": "00:00-00:04", 
       "module_tags": { 
         "l1_category": "钩子", // 注意：每个镜头只能有一个一级标签，不能是多个标签的组合（如【证明】+【卖点】）
         "l2_visual": "对比镜头", 
         "info_density": "高密度" 
       }, 
       "content_desc": "画面左右分屏，左边烂脸，右边好皮肤", 
       "seedance_prompt": "分屏效果，(左侧)极度清晰的女性面部特写，皮肤泛红有痘印，表情痛苦，暗沉光线；(右侧)极度清晰的女性面部特写，皮肤白皙水嫩，无瑕疵，表情自信微笑，柔和高光。静态镜头，高对比度，真实感摄影，4k画质，细节丰富。", 
       "rationale": "通过强烈的视觉对比制造钩子，吸引用户停留。" 
     } 
   ],
   "coreElements": { 
     "visualPackaging": { 
       "color": "分析结果", 
       "style": "分析结果", 
       "position": "分析结果", 
       "function": "分析结果" 
     }, 
     "visualGuiding": { 
       "element": "分析结果", 
       "direction": "分析结果", 
       "dynamic": "分析结果" 
     }, 
     "editingRhythm": { 
       "timing": "分析结果", 
       "transition": "分析结果", 
       "emotion": "分析结果" 
     }, 
     "shotFocus": { 
       "shotType": "分析结果", 
       "object": "分析结果", 
       "purpose": "分析结果" 
     } 
   } 
 }`;

    if (productName) {
        prompt += "\n\n【商品信息】\n商品名称：" + productName;
    }
    if (productDesc) {
        prompt += "\n商品描述：" + productDesc;
    }
    
    // 添加SRT字幕内容
    if (srtContent) {
        prompt += "\n\n【视频字幕信息】\n";
        prompt += "详细字幕内容：\n";
        prompt += srtContent;
    }

    return prompt;
}

/**
 * Calls the Volcano Engine API via Proxy.
 */
async function callVolcanoAPI(frames: string[], prompt: string): Promise<any> {
    const content: any[] = [
        {
            type: "text",
            text: prompt
        }
    ];

    // Add video frames with timestamps
    frames.forEach((frame, index) => {
        const timestamp = (index * 0.4).toFixed(1);
        content.push({
            type: "text",
            text: `[时间戳: ${timestamp}秒]`
        });
        content.push({
            type: "image_url",
            image_url: {
                url: frame,
                detail: "low"
            }
        });
    });

    const requestBody = {
        model: API_CONFIG.MODEL_NAME,
        messages: [
            {
                role: "user",
                content: content
            }
        ],
        max_completion_tokens: API_CONFIG.MAX_TOKENS,
        reasoning_effort: "medium",
        temperature: 0.7
    };

    console.log('Calling API via Proxy:', API_CONFIG.PROXY_URL);

    const data = await callProxy<any>(API_CONFIG.PROXY_URL, {
        target: 'doubao_chat',
        body: requestBody
    });
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid API Response Format');
    }

    const contentText = data.choices[0].message.content;
    
    // Parse Thinking and JSON
    const thinkingMatch = contentText.match(/<Thinking_Block>([\s\S]*?)<\/Thinking_Block>/);
    const thinking = thinkingMatch ? thinkingMatch[1].trim() : '';
    
    const jsonMatch = contentText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        try {
            const jsonResponse = JSON.parse(jsonMatch[0]);
            return { ...jsonResponse, thinking };
        } catch (e) {
            console.error('JSON Parse Error:', e);
            throw new Error('Failed to parse analysis result JSON');
        }
    } else {
        throw new Error('No JSON found in analysis result');
    }
}

/**
 * Main analysis function.
 */
export async function analyzeVideoReal(file: File, productName: string = '', productDesc: string = '', srtContent: string = ''): Promise<{ analysis: DeconstructedVideo, sellingPoints: string[] }> {
    // 1. Extract Frames and Duration
    const { frames, duration } = await extractVideoFrames(file);
    if (frames.length === 0) {
        throw new Error('Failed to extract video frames');
    }

    // Format duration to MM:SS
    const minutes = Math.floor(duration / 60);
    const seconds = Math.floor(duration % 60);
    const formattedDuration = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    // 2. Build Prompt
    const prompt = buildAnalysisPrompt(productName, productDesc, srtContent);

    // 3. Call API
    const result: SourceAnalysisResult = await callVolcanoAPI(frames, prompt);

    // 4. Map to DeconstructedVideo
    
    // Extract video formula details
    let visualEffect = result.video_analysis_summary.video_style || '暂无信息';
    let productStyle = '暂无信息';
    let effectDemo = '暂无信息';
    let productPower = '暂无信息';
    
    // Try to extract from shots if tags exist
    const productShots = result.shots.filter(s => s.module_tags?.l2_visual === '产品特写');
    if (productShots.length > 0) productStyle = productShots[0].content_desc;
    
    const demoShots = result.shots.filter(s => s.module_tags?.l2_visual === '行为演示');
    if (demoShots.length > 0) effectDemo = demoShots[0].content_desc;
    
    const proofShots = result.shots.filter(s => s.module_tags?.l1_category === '证明' || s.module_tags?.l2_visual === '对比镜头');
    if (proofShots.length > 0) productPower = proofShots[0].content_desc;
    
    if (result.videoFormula) {
        visualEffect = result.videoFormula.visualEffect || visualEffect;
        productStyle = result.videoFormula.productStyle || productStyle;
        effectDemo = result.videoFormula.effectDemo || effectDemo;
        productPower = result.videoFormula.productPower || productPower;
    }

    const sellingPoints: string[] = result.sellingPoints || [];

    // Transform coreElements to sellingPoints if present
    if (result.coreElements) {
        const coreElements = result.coreElements;
        sellingPoints.push(`视觉包装: 色彩 - ${coreElements.visualPackaging?.color || '未检测'}, 样式 - ${coreElements.visualPackaging?.style || '未检测'}, 位置 - ${coreElements.visualPackaging?.position || '未检测'}, 功能 - ${coreElements.visualPackaging?.function || '未检测'}`);
        sellingPoints.push(`视觉引导: 元素 - ${coreElements.visualGuiding?.element || '未检测'}, 指向 - ${coreElements.visualGuiding?.direction || '未检测'}, 动态 - ${coreElements.visualGuiding?.dynamic || '未检测'}`);
        sellingPoints.push(`剪辑节奏: 卡点 - ${coreElements.editingRhythm?.timing || '未检测'}, 转场 - ${coreElements.editingRhythm?.transition || '未检测'}, 情绪 - ${coreElements.editingRhythm?.emotion || '未检测'}`);
        sellingPoints.push(`镜头焦点: 景别 - ${coreElements.shotFocus?.shotType || '未检测'}, 对象 - ${coreElements.shotFocus?.object || '未检测'}, 目的 - ${coreElements.shotFocus?.purpose || '未检测'}`);
    }

    const segments: VideoScriptSegment[] = result.shots.map(shot => {
        // Calculate frame index for thumbnail
        const startTimeStr = shot.time_range.split('-')[0];
        const [min, sec] = startTimeStr.split(':').map(Number);
        const totalSeconds = min * 60 + sec;
        const frameIndex = Math.floor(totalSeconds / 0.4);
        
        const thumbnail = frames[Math.min(frameIndex, frames.length - 1)];

        return {
            id: `shot-${shot.shot_id}`,
            time: shot.time_range,
            main_tag: shot.module_tags.l1_category,
            info_density: shot.module_tags.info_density,
            l2_visual: shot.module_tags.l2_visual,
            visual_prompt: shot.seedance_prompt,
            voiceover_text: shot.content_desc,
            retention_strategy: shot.rationale,
            thumbnail: thumbnail,
            niche: '爆款分析',
            sourceTitle: result.video_analysis_summary.video_style
        };
    });

    // Construct a meaningful structure from shots with timestamps
    const groupedShots: { category: string, start: string, end: string }[] = [];
    result.shots.forEach(shot => {
        const lastGroup = groupedShots[groupedShots.length - 1];
        const currentCategory = shot.module_tags.l1_category || '其他';
        const [startTime, endTime] = shot.time_range.split('-');
        
        if (lastGroup && lastGroup.category === currentCategory) {
            lastGroup.end = endTime;
        } else {
            groupedShots.push({
                category: currentCategory,
                start: startTime,
                end: endTime
            });
        }
    });

    const structure = groupedShots
        .map(g => `${g.category}[${g.start}-${g.end}]`)
        .join(' + ') || result.video_analysis_summary.video_style;

    // Refine core_elements display for high-quality viral analysis
    let coreElementsText = '';
    let paceText = '';

    if (result.coreElements) {
        const ce = result.coreElements;
        // Pacing: Editing Rhythm
        paceText = `${ce.editingRhythm.timing}, ${ce.editingRhythm.transition}, ${ce.editingRhythm.emotion}`;

        // Core Elements: Packaging + Guiding + Focus
        coreElementsText = [
            `【视觉包装】${ce.visualPackaging.style} (${ce.visualPackaging.color})`,
            `【视觉引导】${ce.visualGuiding.element} -> ${ce.visualGuiding.direction}`,
            `【镜头焦点】${ce.shotFocus.shotType}聚焦${ce.shotFocus.object}`
        ].join(' | ');
    } else {
        coreElementsText = sellingPoints.join(', ');
        paceText = '暂无节奏分析';
    }

    const analysis: DeconstructedVideo = {
        id: Math.random().toString(36).substr(2, 9),
        title: `爆款分析 - ${result.video_analysis_summary.video_style.substring(0, 10)}...`,
        niche: '全品类',
        formula_name: visualEffect.substring(0, 20),
        visual_effect: visualEffect,
        product_style: productStyle,
        effect_demo: effectDemo,
        product_power: productPower,
        structure: structure,
        pace: paceText,
        core_elements: coreElementsText,
        segments: segments,
        total_duration: formattedDuration,
        createdAt: new Date().toISOString()
    };

    return {
        analysis,
        sellingPoints: sellingPoints
    };
}
