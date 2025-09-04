// utils/websocket.ts
import WebSocket from "ws";

export const createSolanaWs = (
  programId: string,
  onLogs: (signature: string, logs: string[]) => void
) => {
  const ws = new WebSocket(
    process.env.SOLANA_WS_URL || "wss://api.mainnet-beta.solana.com/"
  );

  ws.on("open", () => {
    console.log("WebSocket connected");

    ws.send(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "logsSubscribe",
        params: [{ mentions: [programId] }, { commitment: "confirmed" }],
      })
    );
  });

  ws.on("message", (msg) => {
    const data = JSON.parse(msg.toString());
    if (data.params?.result?.value?.logs) {
      const logs: string[] = data.params.result.value.logs;
      const signature: string = data.params.result.value.signature;
      onLogs(signature, logs);
    }
  });

  return ws;
};
