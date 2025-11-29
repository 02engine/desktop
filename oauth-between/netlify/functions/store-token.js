exports.handler = async (event, context) => {
  // 处理CORS预检请求
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: '只支持POST请求' }),
      headers: {
        'Access-Control-Allow-Origin': '*'
      }
    };
  }

  try {
    const { hash, token } = JSON.parse(event.body);
    
    if (!hash || !token) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: '缺少hash或token参数' })
      };
    }

    // 初始化全局存储
    if (!global.tempTokens) {
      global.tempTokens = new Map();
    }

    // 存储token数据
    const tokenData = {
      token: token,
      timestamp: Date.now()
    };
    
    global.tempTokens.set(hash, tokenData);

    console.log(`存储token: hash=${hash.substring(0, 10)}...`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        message: 'Token已存储',
        hash: hash
      })
    };

  } catch (error) {
    console.error('存储token失败:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: '存储失败',
        message: error.message
      }),
      headers: {
        'Access-Control-Allow-Origin': '*'
      }
    };
  }
};
