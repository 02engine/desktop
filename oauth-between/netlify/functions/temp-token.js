const { createClient } = require('@supabase/supabase-js');

function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

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
      body: JSON.stringify({ error: '缺少hash参数' }),
      headers: {
        'Access-Control-Allow-Origin': '*'
      }
    };
  }
  
  const requestedHash = hashMatch[1];
  
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      console.error('[Temp-Token] Missing SUPABASE_URL or SUPABASE_ANON_KEY');
      return {
        statusCode: 500,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ success: false, error: 'Supabase credentials not configured' })
      };
    }

    // 从 Supabase 查询 token
    const { data, error } = await supabase
      .from('oauth_tokens')
      .select('token, expires_at')
      .eq('hash', requestedHash)
      .single();

    if (error || !data) {
      console.log(`[Temp-Token] Token not found for hash: ${requestedHash.substring(0, 20)}...`);
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

    // 检查是否过期
    const expiresAt = new Date(data.expires_at);
    if (new Date() > expiresAt) {
      console.log(`[Temp-Token] Token expired for hash: ${requestedHash.substring(0, 20)}...`);
      // 删除过期的 token
      await supabase
        .from('oauth_tokens')
        .delete()
        .eq('hash', requestedHash);
      
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          error: 'Token已过期'
        })
      };
    }

    console.log(`[Temp-Token] Found token for hash: ${requestedHash.substring(0, 20)}...`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        token: data.token,
        expires_at: data.expires_at
      })
    };
  } catch (error) {
    console.error('[Temp-Token] Supabase error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: '服务器错误',
        message: error.message
      })
    };
  }
};