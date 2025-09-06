// utils/websocket.ts
import WebSocket from "ws";

export const createSolanaWs = (
  programIds: string[],
  onLogs: (programId: string, signature: string, logs: string[]) => void
) => {
  let ws: WebSocket | null = null;
  let reconnectTimeout = 1000;
  let pingInterval: NodeJS.Timeout | null = null;

  const connect = () => {
    const endpoint =
      process.env.SOLANA_WS_URL || "wss://api.mainnet-beta.solana.com/";
    ws = new WebSocket(endpoint);

    ws.on("open", () => {
      console.log("[Solana WS] Connected");

      // subscribe to all programs
      programIds.forEach((programId, idx) => {
        ws!.send(
          JSON.stringify({
            jsonrpc: "2.0",
            id: idx + 1,
            method: "logsSubscribe",
            params: [{ mentions: [programId] }, { commitment: "confirmed" }],
          })
        );
        console.log(`[Solana WS] Subscribed to logs for ${programId}`);
      });

      // start heartbeat
      if (pingInterval) clearInterval(pingInterval);
      pingInterval = setInterval(() => {
        if (ws?.readyState === WebSocket.OPEN) {
          ws.ping(); // low-level ping frame
          ws.send(
            JSON.stringify({ jsonrpc: "2.0", id: "ping", method: "ping" })
          );
        }
      }, 15000); // every 15s
    });

    ws.on("pong", () => {
      console.log("[Solana WS] Pong received");
    });

    ws.on("message", (msg) => {
      try {
        const data = JSON.parse(msg.toString());
        if (data.params?.result?.value?.logs) {
          const logs: string[] = data.params.result.value.logs;
          const signature: string = data.params.result.value.signature;
          const programId =
            data.params.result.value.programId || "unknown-program";

          onLogs(programId, signature, logs);
        }
      } catch (err) {
        console.error("[Solana WS] Failed to parse message:", err);
      }
    });

    ws.on("close", (code, reason) => {
      console.warn(
        `[Solana WS] Connection closed (code ${code}): ${reason.toString()}`
      );
      cleanup();
      scheduleReconnect();
    });

    ws.on("error", (err) => {
      console.error("[Solana WS] Error:", err);
      ws?.close();
    });
  };

  const cleanup = () => {
    if (pingInterval) {
      clearInterval(pingInterval);
      pingInterval = null;
    }
  };

  const scheduleReconnect = () => {
    console.log(`[Solana WS] Reconnecting in ${reconnectTimeout / 1000}s...`);
    setTimeout(connect, reconnectTimeout);
    reconnectTimeout = Math.min(reconnectTimeout * 2, 30000);
  };

  connect();
};
