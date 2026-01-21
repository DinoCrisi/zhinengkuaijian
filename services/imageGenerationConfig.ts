// 图片生成配置文件
export interface ImageGenerationSettings {
  // 并发控制
  maxConcurrency: number;
  batchSize: number;
  batchDelay: number; // 批次间延迟（毫秒）
  
  // 重试设置
  maxRetries: number;
  retryDelay: number; // 重试延迟（毫秒）
  
  // 敏感内容处理
  enableContentSanitization: boolean;
  fallbackPrompts: string[];
}

// 默认配置
export const DEFAULT_IMAGE_SETTINGS: ImageGenerationSettings = {
  maxConcurrency: 4, // 降低默认并发数
  batchSize: 8, // 每批处理8个任务
  batchDelay: 0, // 批次间延迟1秒
  
  maxRetries: 2,
  retryDelay: 500,
  
  enableContentSanitization: true,
  fallbackPrompts: [
    '商业产品摄影, 简洁风格, 专业拍摄',
    '产品展示, 商业摄影',
    '高品质商品图片'
  ]
};

// 获取当前配置（可以从环境变量或用户设置中读取）
export function getImageGenerationSettings(): ImageGenerationSettings {
  const settings = { ...DEFAULT_IMAGE_SETTINGS };
  
  // 从环境变量读取配置
  if (typeof window !== 'undefined') {
    const envConcurrency = (import.meta as any)?.env?.VITE_IMAGE_CONCURRENCY;
    if (envConcurrency) {
      settings.maxConcurrency = Math.max(1, Math.min(10, Number(envConcurrency)));
    }
    
    const envBatchSize = (import.meta as any)?.env?.VITE_IMAGE_BATCH_SIZE;
    if (envBatchSize) {
      settings.batchSize = Math.max(1, Math.min(20, Number(envBatchSize)));
    }
  }
  
  return settings;
}

// 动态调整并发数（基于成功率）
export class ConcurrencyController {
  private successCount = 0;
  private totalCount = 0;
  private currentConcurrency: number;
  private readonly minConcurrency = 1;
  private readonly maxConcurrency: number;
  
  constructor(initialConcurrency: number, maxConcurrency: number = 8) {
    this.currentConcurrency = initialConcurrency;
    this.maxConcurrency = maxConcurrency;
  }
  
  recordResult(success: boolean) {
    this.totalCount++;
    if (success) this.successCount++;
    
    // 每10次请求调整一次并发数
    if (this.totalCount % 10 === 0) {
      this.adjustConcurrency();
    }
  }
  
  private adjustConcurrency() {
    const successRate = this.successCount / this.totalCount;
    
    if (successRate > 0.9 && this.currentConcurrency < this.maxConcurrency) {
      // 成功率高，增加并发
      this.currentConcurrency = Math.min(this.maxConcurrency, this.currentConcurrency + 1);
      console.log(`📈 Increasing concurrency to ${this.currentConcurrency} (success rate: ${(successRate * 100).toFixed(1)}%)`);
    } else if (successRate < 0.7 && this.currentConcurrency > this.minConcurrency) {
      // 成功率低，降低并发
      this.currentConcurrency = Math.max(this.minConcurrency, this.currentConcurrency - 1);
      console.log(`📉 Decreasing concurrency to ${this.currentConcurrency} (success rate: ${(successRate * 100).toFixed(1)}%)`);
    }
  }
  
  getCurrentConcurrency(): number {
    return this.currentConcurrency;
  }
  
  getStats() {
    return {
      successRate: this.totalCount > 0 ? this.successCount / this.totalCount : 0,
      totalRequests: this.totalCount,
      currentConcurrency: this.currentConcurrency
    };
  }
}