/**
 * 标签验证和清理服务
 * 确保素材库中的标签符合规范：
 * 1. 只允许中文标签
 * 2. 不允许组合标签（如"卖点+证明"）
 * 3. 只允许白名单中的标签
 */

// 允许的标签白名单
const ALLOWED_TAGS = ['钩子', '卖点', '证明', '转化', '场景'] as const;

export type AllowedTag = typeof ALLOWED_TAGS[number];

/**
 * 验证标签是否在白名单中
 */
export function isValidTag(tag: string): tag is AllowedTag {
  return ALLOWED_TAGS.includes(tag as AllowedTag);
}

/**
 * 清理和验证标签
 * @param tag 原始标签
 * @returns 清理后的标签，如果无效则返回 null
 */
export function validateAndCleanTag(tag: string | undefined | null): AllowedTag | null {
  if (!tag || typeof tag !== 'string') {
    console.warn('标签为空或类型错误:', tag);
    return null;
  }

  let cleanedTag = tag.trim();

  // 步骤 1: 拆分组合标签（包含+、、和等连接符）
  if (cleanedTag.includes('+') || cleanedTag.includes('、') || cleanedTag.includes('和')) {
    const parts = cleanedTag.split(/[+、和]/);
    cleanedTag = parts[0].trim();
    console.log(`组合标签已拆分: "${tag}" -> "${cleanedTag}"`);
  }

  // 步骤 2: 移除英文字符和空格
  const originalTag = cleanedTag;
  cleanedTag = cleanedTag.replace(/[a-zA-Z\s]/g, '');
  if (originalTag !== cleanedTag) {
    console.log(`英文字符已移除: "${originalTag}" -> "${cleanedTag}"`);
  }

  // 步骤 3: 移除特殊字符（保留中文）
  cleanedTag = cleanedTag.replace(/[^\u4e00-\u9fa5]/g, '');

  // 步骤 4: 验证是否在白名单中
  if (!cleanedTag || cleanedTag.length === 0) {
    console.warn(`标签清理后为空: "${tag}"`);
    return null;
  }

  if (!isValidTag(cleanedTag)) {
    console.warn(`标签不在白名单中: "${cleanedTag}" (原始: "${tag}")`);
    return null;
  }

  return cleanedTag;
}

/**
 * 批量清理标签
 * @param tags 标签数组
 * @returns 清理后的有效标签数组
 */
export function cleanTags(tags: (string | undefined | null)[]): AllowedTag[] {
  return tags
    .map(tag => validateAndCleanTag(tag))
    .filter((tag): tag is AllowedTag => tag !== null);
}

/**
 * 获取允许的标签列表
 */
export function getAllowedTags(): readonly AllowedTag[] {
  return ALLOWED_TAGS;
}

/**
 * 标签映射：将英文标签映射为中文标签
 */
const TAG_MAPPING: Record<string, AllowedTag> = {
  'hook': '钩子',
  'selling_point': '卖点',
  'proof': '证明',
  'cta': '转化',
  'scene': '场景',
  '场景化': '场景',
  '痛点': '钩子', // 将"痛点"映射为"钩子"
  '产品': '卖点', // 将"产品"映射为"卖点"
};

/**
 * 尝试映射标签
 * @param tag 原始标签
 * @returns 映射后的标签，如果无法映射则返回 null
 */
export function mapTag(tag: string): AllowedTag | null {
  const cleanedTag = tag.trim().toLowerCase();
  
  // 先尝试直接映射
  if (cleanedTag in TAG_MAPPING) {
    console.log(`标签已映射: "${tag}" -> "${TAG_MAPPING[cleanedTag]}"`);
    return TAG_MAPPING[cleanedTag];
  }
  
  // 再尝试清理和验证
  return validateAndCleanTag(tag);
}

/**
 * 智能清理标签（结合映射和清理）
 * @param tag 原始标签
 * @returns 清理后的标签，如果无效则返回 null
 */
export function smartCleanTag(tag: string | undefined | null): AllowedTag | null {
  if (!tag) return null;
  
  // 先尝试映射
  const mapped = mapTag(tag);
  if (mapped) return mapped;
  
  // 再尝试清理
  return validateAndCleanTag(tag);
}
