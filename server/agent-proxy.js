// Lightweight local WebSocket proxy for ElevenLabs Conversational Agent.
// Dev-only. Keeps ELEVENLABS_API_KEY on the server side and exposes ws://localhost:8787 to the browser.

import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import url from 'url';
import path from 'path';
import dotenv from 'dotenv';
// Load local env for dev (ignore errors if file missing)
try { dotenv.config({ path: path.join(process.cwd(), '.env.local') }); } catch {}

const ELEVEN_KEY = process.env.ELEVENLABS_API_KEY;
const DEFAULT_AGENT_ID = process.env.ELEVENLABS_AGENT_ID || "";
const PORT = process.env.AGENT_PROXY_PORT ? Number(process.env.AGENT_PROXY_PORT) : 8787;

if (!ELEVEN_KEY) {
  console.error("[agent-proxy] ELEVENLABS_API_KEY is not set in environment.");
}

const server = http.createServer();
const wss = new WebSocketServer({ server });

wss.on("connection", (client, req) => {
  const { query } = url.parse(req.url || "", true);
  const agentId = (query.agent_id || DEFAULT_AGENT_ID || "").toString();
  if (!agentId) {
    client.close(1008, "Missing agent_id");
    return;
  }
  if (!ELEVEN_KEY) {
    client.close(1011, "Server not configured with ELEVENLABS_API_KEY");
    return;
  }

  const upstreamUrl = `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${encodeURIComponent(agentId)}`;
  const upstream = new WebSocket(upstreamUrl, { headers: { "xi-api-key": ELEVEN_KEY } });

  const safeClose = (ws, code, reason) => {
    try { ws.close(code, reason); } catch {}
  };

  upstream.on("open", () => {
    // Bridge client -> upstream (force TEXT frames)
    client.on("message", (data) => {
      if (upstream.readyState === WebSocket.OPEN) {
        try {
          const out = typeof data === 'string' ? data : Buffer.isBuffer(data) ? data.toString() : String(data);
          upstream.send(out);
        } catch (e) {
          console.error('[agent-proxy] forward error:', e?.message || e);
        }
      }
    });
    client.on("close", () => safeClose(upstream, 1000, "client closed"));
    client.on("error", () => safeClose(upstream, 1011, "client error"));

    // Bridge upstream -> client
    upstream.on("message", (data) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
    upstream.on("close", (code, reason) => {
      const r = Buffer.isBuffer(reason) ? reason.toString() : (reason || "");
      console.warn(`[agent-proxy] upstream closed: code=${code} reason=${r}`);
      try {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: "upstream_closed", code, reason: r }));
        }
      } catch {}
      safeClose(client, 1000, "upstream closed");
    });
    upstream.on("error", (err) => {
      console.error("[agent-proxy] upstream error (open phase):", err?.message || err);
      try {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: "upstream_error", message: err?.message || String(err) }));
        }
      } catch {}
      safeClose(client, 1011, "upstream error");
    });
  });

  upstream.on("error", (err) => {
    console.error("[agent-proxy] upstream error:", err?.message || err);
    safeClose(client, 1011, "upstream connect error");
  });
});

server.listen(PORT, () => {
  console.log(`[agent-proxy] listening on ws://localhost:${PORT}`);
});
