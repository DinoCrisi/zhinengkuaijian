import { DeconstructedVideo, ProductInfo, ScriptReplicationResult, ReplicatedSegment } from '../types';
import { callProxy } from './proxyClient';

// Configuration - 使用与视频分析相同的配置
const API_CONFIG = {
  PROXY_URL: 'http://127.0.0.1:8888/api/chat',
  MODEL_NAME: 'doubao-seed-1-8-251228', 
  MAX_TOKENS: 65535
};

/**
 * 构建脚本重构的提示词（基于专业爆款复刻提示词）
 */
function buildScriptReplicationPrompt(
  originalAnalysis: DeconstructedVideo,
  productInfo: ProductInfo
): string {
  const prompt = `你是一位精通短视频算法与内容营销的专家分析师。现在需要你基于一个爆款视频的分析结果，为新产品重新创作脚本。

# 原视频分析结果

## 基本信息
- **内容赛道**: ${originalAnalysis.niche}
- **叙事结构**: ${originalAnalysis.structure}
- **视觉节奏**: ${originalAnalysis.pace}
- **核心爆款元素**: ${originalAnalysis.core_elements}
- **总时长**: ${originalAnalysis.total_duration || '未知'}

## 原视频分镜脚本（共 ${originalAnalysis.segments.length} 个分镜）
${originalAnalysis.segments.map((seg, idx) => `
### 分镜 ${idx + 1}
- **时间**: ${seg.time}
- **一级标签**: ${seg.main_tag}
- **信息密度**: ${seg.info_density || '未知'}
- **视觉语言**: ${seg.l2_visual || '未知'}
- **画面描述**: ${seg.visual_prompt}
- **配音文案**: ${seg.voiceover_text}
- **留存策略**: ${seg.retention_strategy}
`).join('\n')}

# 新产品信息

- **商品名称**: ${productInfo.name}
- **商品卖点**: 
${productInfo.sellingPoints.filter(sp => sp.trim()).map((sp, idx) => `  ${idx + 1}. ${sp}`).join('\n')}
- **商品图片**: 用户已上传 ${productInfo.images.length} 张商品图片${productInfo.images.length > 0 ? '，生成首帧时会作为参考图' : ''}

# 任务要求

## 1. 保持原视频结构
- 严格保持原视频的叙事结构：${originalAnalysis.structure}
- 分镜数量必须与原视频一致：${originalAnalysis.segments.length} 个分镜
- 每个分镜的时长应与原视频相近

## 2. 替换产品并融入卖点
- 将原脚本中的产品替换为新产品"${productInfo.name}"
- **重要**: 每个卖点都必须在对应的分镜中自然体现：
${productInfo.sellingPoints.filter(sp => sp.trim()).map((sp, idx) => `  - 卖点${idx + 1}（${sp}）应在"selling_point"类型的分镜中重点展示`).join('\n')}

## 3. 保持视觉节奏和爆款元素
- 维持原视频的视觉节奏：${originalAnalysis.pace}
- 保留核心爆款元素的表现手法：${originalAnalysis.core_elements}

## 4. 叙事类型标注
为每个分镜标注准确的叙事类型（必须从以下四种中选择唯一一个）：
- **hook**: 钩子（视频前0-5秒，吸引注意力，强留人语气）
- **selling_point**: 卖点（产品介绍，功能描述，价格优势，解决痛点）
- **proof**: 证明（效果展示，对比镜头，第三方检测，使用演示）
- **cta**: 转化（引导购买，点击下方，下单链接）

## 5. 生成首帧提示词（核心要求）

### 首帧提示词格式
**格式**: "构图 + 光影 + 色彩 + 神态 + 主体 + 场景 + 质量词"

### 详细要求
- **构图 (Composition)**: 详细描述画面构图，包括景别（特写/中景/全景）、拍摄角度（俯拍/平视/仰拍）、主体位置、画面比例
- **光影 (Lighting)**: 详细描述光线条件，包括光源方向、光质（柔和/硬光）、明暗对比、光影效果
- **色彩 (Color)**: 详细描述色彩方案，包括主色调、色彩饱和度、色彩对比、色彩氛围
- **神态 (Expression)**: 如果有人物，描述表情、姿态、动作状态
- **主体 (Subject)**: 描述画面主体的**视觉呈现方式和场景角色**，而不是产品本身的特征。由于用户已上传参考图片，AI 会自动从参考图中学习产品的外观、颜色、材质等特征。因此，提示词应该重点描述：
  * 主体在画面中的**位置和大小**（特写/中景/全景）
  * 主体的**展示方式**（手持/桌面摆放/使用中/悬浮展示）
  * 主体与其他元素的**交互关系**（如：手指指向、液体滴落、对比展示等）
  * 主体的**动作状态**（静止/运动/变形等）
  * 主体周围的**辅助元素**（如：手、工具、装饰物等）
- **场景 (Scene)**: 详细描述背景环境，包括地点、环境元素、氛围营造
- **质量词 (Quality)**: 加入高质量视觉描述词，如"4K超高清"、"照片级真实感"、"细节丰富"、"专业商业摄影"

### 注意事项
- 提示词长度：80-150 字
- **严禁包含字幕或文字元素**，只描述视觉画面
- **重要**: 不要在提示词中详细描述产品的外观特征（如颜色、形状、材质等），因为用户已上传参考图片，AI 会自动学习这些特征
- 提示词应该**聚焦于场景、构图、光影和交互**，而不是产品描述
- 可以包含图案、Logo、装饰元素
- 目的是**还原该分镜的首帧画面**，让 AI 图像生成模型能够准确生成，同时保持与参考图片中商品的一致性

### 首帧提示词示例
"特写镜头，居中构图，一只白皙细腻的手背占据画面主要位置，参考图中的产品从上方滴下一滴液体，液体呈球形悬停状态。光线明亮柔和，来自左上方的散射光，强调手背的细腻质感和液体的透明感。色彩以白色和透明为主，背景为纯净的浅灰色。手背皮肤纹理清晰可见，产品与液体的质感反光清晰。4K超高清，照片级真实感，细节丰富，专业商业摄影。"

## 6. 分镜脚本内容要求

每个分镜的 script_content 应该详细描述：
- **主体描述**: 参考图中产品的**视觉呈现方式**（位置、大小、展示角度），而不是产品本身的特征描述。AI 会从参考图中学习产品的外观
- **场景环境**: 背景细节、地点、空间感
- **运镜构图**: 景别、拍摄角度、镜头运动
- **光影效果**: 光线类型、色调
- **动作动效**: 主体动作、速度、运动轨迹、与其他元素的交互
- **听觉事件**: 画面内的拟音和环境音（不包含BGM和旁白）

# Output Format

请严格按照以下 JSON 格式输出，不要包含任何其他文字、markdown 标记或代码块标记：

{
  "narrative_structure": "叙事结构描述",
  "visual_rhythm": "视觉节奏描述",
  "core_elements": "保留的核心爆款元素",
  "total_duration": "预计总时长",
  "segments": [
    {
      "time": "时间范围（如：0-3s）",
      "narrative_type": "hook/selling_point/proof/cta（必须从这四个中选择唯一一个）",
      "script_content": "分镜脚本内容（详细描述画面、动作、运镜、光影、听觉）",
      "voiceover_text": "配音文案（口播内容，自然流畅，符合短视频风格）",
      "prompt_text": "视频提示词（主体描述+场景环境+运镜构图+光影色彩+动效氛围+质量词，中文，严禁包含字幕）",
      "first_frame_prompt": "首帧生图提示词（严格按照：构图+光影+色彩+神态+主体+场景+质量词 的格式，80-150字，中文，严禁包含字幕）"
    }
  ]
}

# 关键提示
- 输出必须是纯 JSON 格式，不要有任何额外文字
- 分镜数量必须是 ${originalAnalysis.segments.length} 个
- **重要**: 每个 first_frame_prompt 应该聚焦于**场景、构图、光影和交互**，而不是详细描述产品特征。用户已上传参考图片，AI 会自动从参考图中学习产品的外观、颜色、材质等特征，提示词应该帮助 AI 保持这种一致性
- 每个 first_frame_prompt 必须详细且专业，严格遵循"构图+光影+色彩+神态+主体+场景+质量词"格式
- 每个 narrative_type 必须从 hook/selling_point/proof/cta 四个中选择唯一一个
- 配音文案要自然、有感染力、符合短视频口播风格
- 脚本内容要详细、专业、可执行
- **提示词中应该使用"参考图中的产品"、"产品"等通用表述，而不是具体的产品特征描述**`;

  return prompt;
}

/**
 * 调用豆包 API 生成重构脚本
 */
async function callVolcanoAPI(prompt: string): Promise<any> {
  const requestBody = {
    model: API_CONFIG.MODEL_NAME,
    messages: [
      {
        role: "user",
        content: prompt
      }
    ],
    max_completion_tokens: API_CONFIG.MAX_TOKENS,
    reasoning_effort: "medium",
    temperature: 0.7
  };

  console.log('Calling Script Replication API via Proxy:', API_CONFIG.PROXY_URL);

  const data = await callProxy<any>(API_CONFIG.PROXY_URL, {
    target: 'doubao_chat',
    body: requestBody
  });
  
  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    throw new Error('Invalid API Response Format');
  }

  const contentText = data.choices[0].message.content;
  
  // 尝试解析 JSON
  const jsonMatch = contentText.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const jsonResponse = JSON.parse(jsonMatch[0]);
      return jsonResponse;
    } catch (e) {
      console.error('JSON Parse Error:', e);
      throw new Error('Failed to parse script replication result JSON');
    }
  } else {
    throw new Error('No JSON found in script replication result');
  }
}

/**
 * 生成重构脚本
 */
export async function generateReplicatedScript(
  originalAnalysis: DeconstructedVideo,
  productInfo: ProductInfo
): Promise<ScriptReplicationResult> {
  console.log('Starting script replication...');
  console.log('Original Analysis:', originalAnalysis.title);
  console.log('New Product:', productInfo.name);

  // 1. 构建提示词
  const prompt = buildScriptReplicationPrompt(originalAnalysis, productInfo);

  // 2. 调用 API
  const result = await callVolcanoAPI(prompt);

  // 3. 构建返回结果
  const replicatedSegments: ReplicatedSegment[] = result.segments.map((seg: any, idx: number) => ({
    id: `rep-${Date.now()}-${idx}`,
    time: seg.time,
    narrative_type: seg.narrative_type,
    script_content: seg.script_content || seg.prompt_text || seg.video_prompt || '',
    voiceover_text: seg.voiceover_text,
    frame_prompt: seg.frame_prompt || seg.first_frame_prompt || seg.firstFramePrompt || '',
    video_prompt: seg.prompt_text || seg.video_prompt || seg.script_content || ''
  }));

  const scriptReplication: ScriptReplicationResult = {
    id: `replication-${Date.now()}`,
    original_analysis_id: originalAnalysis.id,
    product_info: productInfo,
    narrative_structure: result.narrative_structure || originalAnalysis.structure,
    visual_rhythm: result.visual_rhythm || originalAnalysis.pace,
    core_elements: result.core_elements || originalAnalysis.core_elements,
    segments: replicatedSegments,
    total_duration: result.total_duration || originalAnalysis.total_duration || '00:30',
    createdAt: new Date().toISOString()
  };

  console.log('Script replication completed:', scriptReplication.segments.length, 'segments');
  
  return scriptReplication;
}
