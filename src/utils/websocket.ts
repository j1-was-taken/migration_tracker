// utils/websocket.ts
import WebSocket from "ws";

export const createSolanaWs = (
  programId: string,
  onLogs: (signature: string, logs: string[]) => void
) => {
  let ws: WebSocket | null = null;
  let reconnectTimeout = 1000; // start at 1s

  const connect = () => {
    const endpoint =
      process.env.SOLANA_WS_URL || "wss://api.mainnet-beta.solana.com/";
    ws = new WebSocket(endpoint);

    ws.on("open", () => {
      console.log("[Solana WS] Connected to websocket");
      reconnectTimeout = 1000; // reset backoff on successful connect

      ws!.send(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "logsSubscribe",
          params: [{ mentions: [programId] }, { commitment: "confirmed" }],
        })
      );
    });

    ws.on("message", (msg) => {
      try {
        const data = JSON.parse(msg.toString());
        if (data.params?.result?.value?.logs) {
          const logs: string[] = data.params.result.value.logs;
          const signature: string = data.params.result.value.signature;
          onLogs(signature, logs);
        }
      } catch (err) {
        console.error("[Solana WS] Failed to parse message:", err);
      }
    });

    ws.on("close", (code, reason) => {
      console.warn(
        `[Solana WS] Connection closed (code ${code}): ${reason.toString()}`
      );
      scheduleReconnect();
    });

    ws.on("error", (err) => {
      console.error("[Solana WS] Error:", err);
      ws?.close();
    });
  };

  const scheduleReconnect = () => {
    console.log(`[Solana WS] Reconnecting in ${reconnectTimeout / 1000}s...`);
    setTimeout(connect, reconnectTimeout);
    reconnectTimeout = Math.min(reconnectTimeout * 2, 30000); // cap at 30s
  };

  connect();
};
