export type ProxyTarget = 'doubao_chat' | 'doubao_images' | 'doubao_video_tasks';

export type ProxyMethod = 'GET' | 'POST';

export interface ProxyRequest {
  target: ProxyTarget;
  method?: ProxyMethod;
  path?: string;
  query?: Record<string, string | number | boolean | Array<string | number | boolean>>;
  body?: unknown;
}

export async function callProxy<T>(proxyUrl: string, req: ProxyRequest): Promise<T> {
  const response = await fetch(proxyUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(req)
  });

  if (!response.ok) {
    const text = await response.text();
    let errorMessage = `Proxy Request Failed: ${response.status} - ${text}`;
    
    // 尝试解析错误信息，提供更友好的错误提示
    try {
      const errorData = JSON.parse(text);
      if (errorData.error && errorData.error.message) {
        if (errorData.error.code === 'InputTextSensitiveContentDetected') {
          errorMessage = `内容检测失败：输入内容可能包含敏感信息，请尝试使用更简洁的描述`;
        } else {
          errorMessage = `API错误：${errorData.error.message}`;
        }
      }
    } catch (parseError) {
      // 如果无法解析错误信息，使用原始错误
    }
    
    throw new Error(errorMessage);
  }

  return response.json() as Promise<T>;
}

