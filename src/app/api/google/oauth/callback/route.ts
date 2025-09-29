// OAuth callback: exchanges authorization code for an access token and relays it to opener via postMessage.
// Uses your existing Google OAuth credentials from .env.local

interface GoogleTokenResponse { 
  access_token?: string; 
  expires_in?: number; 
  refresh_token?: string; 
  scope?: string; 
  token_type?: string; 
  error?: string; 
  error_description?: string;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const err = url.searchParams.get('error');
    
    if (err) {
      return html(`window.opener && window.opener.postMessage({ type: 'google-oauth-failure', error: ${JSON.stringify(err)} }, '*'); window.close();`);
    }
    if (!code) {
      return html(`window.opener && window.opener.postMessage({ type: 'google-oauth-failure', error: 'missing_code' }, '*'); window.close();`);
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return html(`window.opener && window.opener.postMessage({ type: 'google-oauth-failure', error: 'missing_env' }, '*'); window.close();`);
    }

    // Use request origin to construct redirect URI (matches what client sent)
    const origin = url.origin;
    const redirectUri = `${origin}/api/google/oauth/callback`;
    
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });

    const json = await tokenRes.json() as GoogleTokenResponse;
    if (!tokenRes.ok || !json.access_token) {
      return html(`window.opener && window.opener.postMessage({ type: 'google-oauth-failure', error: ${JSON.stringify(json.error || 'token_exchange_failed')} }, '*'); window.close();`);
    }

    // Relay token to opener and close popup
    return html(`window.opener && window.opener.postMessage({ type: 'google-oauth-success', token: ${JSON.stringify(json.access_token)}, expiresIn: ${JSON.stringify(json.expires_in)} }, '*'); window.close();`);
  } catch {
    return html(`window.opener && window.opener.postMessage({ type: 'google-oauth-failure', error: 'unexpected' }, '*'); window.close();`);
  }
}function html(script: string) {
  return new Response(`<!DOCTYPE html><html><head><title>Google OAuth</title></head><body><script>${script}</script><p style="font-family:system-ui;">You can close this window.</p></body></html>`, { headers: { 'Content-Type': 'text/html' } });
}
