/**
 * 全局 API 配置
 * 统一管理所有后端服务的 URL 和端口
 */

// 基础配置
const BASE_HOST = '127.0.0.1';

// 服务端口配置
export const SERVICE_PORTS = {
  PROXY: 8888,           // 代理服务（AI API 调用）
  VIDEO_COMPOSER: 8889,  // 视频合成服务
  JIANYING_EXPORT: 8890, // 剪映导出服务
  VIDEO_SPLITTER: 8891,  // 视频分割服务
  VIDEO_STORAGE: 8892,   // 视频存储服务（MinIO）
} as const;

// 服务 URL 配置
export const API_URLS = {
  // 代理服务
  PROXY: `http://${BASE_HOST}:${SERVICE_PORTS.PROXY}`,
  PROXY_CHAT: `http://${BASE_HOST}:${SERVICE_PORTS.PROXY}/api/chat`,
  
  // 视频合成服务
  VIDEO_COMPOSER: `http://${BASE_HOST}:${SERVICE_PORTS.VIDEO_COMPOSER}`,
  VIDEO_COMPOSER_API: `http://${BASE_HOST}:${SERVICE_PORTS.VIDEO_COMPOSER}/api/compose-video`,
  VIDEO_COMPOSER_OUTPUT: `http://${BASE_HOST}:${SERVICE_PORTS.VIDEO_COMPOSER}/output`,
  
  // 剪映导出服务
  JIANYING_EXPORT: `http://${BASE_HOST}:${SERVICE_PORTS.JIANYING_EXPORT}`,
  JIANYING_EXPORT_API: `http://${BASE_HOST}:${SERVICE_PORTS.JIANYING_EXPORT}/api/generate-draft`,
  JIANYING_OUTPUT: `http://${BASE_HOST}:${SERVICE_PORTS.JIANYING_EXPORT}/output`,
  
  // 视频分割服务
  VIDEO_SPLITTER: `http://${BASE_HOST}:${SERVICE_PORTS.VIDEO_SPLITTER}`,
  VIDEO_SPLITTER_API: `http://${BASE_HOST}:${SERVICE_PORTS.VIDEO_SPLITTER}/api/split-video`,
  VIDEO_SEGMENTS: `http://${BASE_HOST}:${SERVICE_PORTS.VIDEO_SPLITTER}/segments`,
  
  // 视频存储服务
  VIDEO_STORAGE: `http://${BASE_HOST}:${SERVICE_PORTS.VIDEO_STORAGE}`,
  VIDEO_STORAGE_API: `http://${BASE_HOST}:${SERVICE_PORTS.VIDEO_STORAGE}/api`,
} as const;

// AI 模型配置
export const AI_MODELS = {
  // 视频分析模型
  VIDEO_ANALYSIS: 'doubao-seed-1-8-251228',
  
  // 脚本生成模型
  SCRIPT_GENERATION: 'doubao-seed-1-8-251228',
  
  // 图片生成模型
  IMAGE_GENERATION: 'doubao-seedream-4-5-251128',
  
  // 视频生成模型
  VIDEO_GENERATION: 'doubao-seedance-1-5-pro-251215',
} as const;

// API 通用配置
export const API_CONFIG = {
  MAX_TOKENS: 65535,
  TIMEOUT: 300000, // 5 分钟
} as const;

// 导出便捷访问函数
export function getServiceUrl(service: keyof typeof SERVICE_PORTS): string {
  return `http://${BASE_HOST}:${SERVICE_PORTS[service]}`;
}

export function getApiUrl(endpoint: keyof typeof API_URLS): string {
  return API_URLS[endpoint];
}

// 类型导出
export type ServiceName = keyof typeof SERVICE_PORTS;
export type ApiEndpoint = keyof typeof API_URLS;
export type ModelName = keyof typeof AI_MODELS;
