/**
 * 标签验证服务测试
 * 用于验证标签清理和验证逻辑是否正确
 */

import { 
  validateAndCleanTag, 
  smartCleanTag, 
  mapTag, 
  isValidTag,
  getAllowedTags 
} from './tagValidationService';

// 测试用例
const testCases = [
  // 正常的中文标签
  { input: '钩子', expected: '钩子', description: '正常的中文标签' },
  { input: '卖点', expected: '卖点', description: '正常的中文标签' },
  { input: '证明', expected: '证明', description: '正常的中文标签' },
  { input: '转化', expected: '转化', description: '正常的中文标签' },
  { input: '场景', expected: '场景', description: '正常的中文标签' },
  
  // 组合标签（应该拆分为第一个标签）
  { input: '卖点+证明', expected: '卖点', description: '组合标签（+连接）' },
  { input: '钩子+场景', expected: '钩子', description: '组合标签（+连接）' },
  { input: '卖点、证明', expected: '卖点', description: '组合标签（、连接）' },
  { input: '钩子和场景', expected: '钩子', description: '组合标签（和连接）' },
  { input: '证明+卖点+转化', expected: '证明', description: '多重组合标签' },
  
  // 英文标签（应该映射为中文）
  { input: 'hook', expected: '钩子', description: '英文标签' },
  { input: 'selling_point', expected: '卖点', description: '英文标签' },
  { input: 'proof', expected: '证明', description: '英文标签' },
  { input: 'cta', expected: '转化', description: '英文标签' },
  { input: 'scene', expected: '场景', description: '英文标签' },
  
  // 混合标签（应该移除英文部分）
  { input: 'hook钩子', expected: '钩子', description: '混合标签（英文+中文）' },
  { input: '卖点selling_point', expected: '卖点', description: '混合标签（中文+英文）' },
  { input: 'proof 证明', expected: '证明', description: '混合标签（英文 空格 中文）' },
  
  // 旧标签（应该映射为新标签）
  { input: '痛点', expected: '钩子', description: '旧标签映射' },
  { input: '产品', expected: '卖点', description: '旧标签映射' },
  { input: '场景化', expected: '场景', description: '旧标签映射' },
  
  // 带空格的标签
  { input: ' 钩子 ', expected: '钩子', description: '带空格的标签' },
  { input: '卖 点', expected: '卖点', description: '中间有空格的标签' },
  
  // 无效标签（应该返回 null）
  { input: '', expected: null, description: '空字符串' },
  { input: '   ', expected: null, description: '只有空格' },
  { input: 'invalid', expected: null, description: '无效的英文标签' },
  { input: '无效标签', expected: null, description: '不在白名单中的中文标签' },
  { input: '123', expected: null, description: '数字标签' },
  { input: '!!!', expected: null, description: '特殊字符标签' },
];

// 运行测试
console.log('🧪 开始测试标签验证服务...\n');
console.log(`允许的标签白名单: ${getAllowedTags().join(', ')}\n`);

let passedCount = 0;
let failedCount = 0;

testCases.forEach((testCase, index) => {
  const result = smartCleanTag(testCase.input);
  const passed = result === testCase.expected;
  
  if (passed) {
    passedCount++;
    console.log(`✅ 测试 ${index + 1}: ${testCase.description}`);
    console.log(`   输入: "${testCase.input}" → 输出: "${result}"`);
  } else {
    failedCount++;
    console.log(`❌ 测试 ${index + 1}: ${testCase.description}`);
    console.log(`   输入: "${testCase.input}"`);
    console.log(`   期望: "${testCase.expected}"`);
    console.log(`   实际: "${result}"`);
  }
  console.log('');
});

// 测试总结
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`测试总结: ${passedCount + failedCount} 个测试`);
console.log(`✅ 通过: ${passedCount}`);
console.log(`❌ 失败: ${failedCount}`);
console.log(`成功率: ${((passedCount / (passedCount + failedCount)) * 100).toFixed(1)}%`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// 额外测试：验证函数
console.log('\n🔍 额外测试：isValidTag() 函数');
getAllowedTags().forEach(tag => {
  console.log(`   isValidTag("${tag}"): ${isValidTag(tag)}`);
});
console.log(`   isValidTag("无效标签"): ${isValidTag('无效标签')}`);

// 导出测试结果
export const testResults = {
  total: passedCount + failedCount,
  passed: passedCount,
  failed: failedCount,
  successRate: (passedCount / (passedCount + failedCount)) * 100
};
