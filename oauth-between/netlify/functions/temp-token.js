exports.handler = async (event, context) => {
  // 处理CORS预检请求
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    };
  }

  // 只允许GET请求
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: '只支持GET请求' }),
      headers: {
        'Access-Control-Allow-Origin': '*'
      }
    };
  }

  const path = event.path;
  
  // 从URL路径中提取hash (如 /temp-token/abc123_timestamp)
  const hashMatch = path.match(/\/temp-token\/(.+)$/);
  
  if (!hashMatch) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: '缺少hash参数' })
    };
  }
  
  const requestedHash = hashMatch[1];
  
  // 临时存储（实际中应该使用数据库或缓存）
  // 这里使用内存存储，生产环境需要持久化存储
  if (!global.tempTokens) {
    global.tempTokens = new Map();
  }
  
  // 查找对应的token
  const tokenData = global.tempTokens.get(requestedHash);
  
  if (tokenData) {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        token: tokenData.token,
        timestamp: tokenData.timestamp
      })
    };
  } else {
    return {
      statusCode: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: 'Token未找到或已过期'
      })
    };
  }
};