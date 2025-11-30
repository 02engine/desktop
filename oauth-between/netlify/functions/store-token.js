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
    const supabase = getSupabaseClient();
    if (!supabase) {
      console.error('[Store-Token] Missing SUPABASE_URL or SUPABASE_ANON_KEY');
      return {
        statusCode: 500,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Supabase credentials not configured' })
      };
    }

    const { hash, token } = JSON.parse(event.body);
    
    if (!hash || !token) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: '缺少hash或token参数' })
      };
    }

    // 将 token 存储到 Supabase
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 分钟过期
    
    const { data, error } = await supabase
      .from('oauth_tokens')
      .upsert({
        hash: hash,
        token: token,
        created_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString()
      }, { onConflict: 'hash' });

    if (error) {
      console.error('[Store-Token] Supabase error:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: '存储失败', message: error.message }),
        headers: { 'Access-Control-Allow-Origin': '*' }
      };
    }

    console.log(`[Store-Token] Stored token to Supabase: hash=${hash.substring(0, 10)}... expires at ${expiresAt.toISOString()}`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        message: 'Token已存储到Supabase',
        hash: hash
      })
    };

  } catch (error) {
    console.error('[Store-Token] 存储token失败:', error);
    
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
