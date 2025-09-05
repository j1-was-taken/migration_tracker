// bot.ts
import dotenv from "dotenv";
import { Client, GatewayIntentBits } from "discord.js";
import { Connection, clusterApiUrl } from "@solana/web3.js";
import { createTxProcessor } from "./utils/txProcessor";
import { createQueue } from "./utils/queue";
import { createSolanaWs } from "./utils/websocket";
import { registerInteractionHandler } from "./utils/interactionHandler";

dotenv.config();

const discordClient = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

// register the global interaction handler ONCE (before or after login is fine)
registerInteractionHandler(discordClient);

const connection = new Connection(
  process.env.SOLANA_HTTP_URL || clusterApiUrl("mainnet-beta")
);
const txProcessor = createTxProcessor(connection, discordClient);

// bot.ts
const pumpfunMigrationQueue = createQueue(
  (sig: string) =>
    txProcessor(sig, {
      title: "PUMP.FUN Migration Detected",
      discordChannelEnv: "DISCORD_CHANNEL_ID_PUMPFUN_MIGRATION",
      filterFn: (inner) =>
        inner.parsed?.type === "getAccountDataSize" &&
        inner.parsed.info.mint.endsWith("pump") &&
        inner.program === "spl-token",
      launchPad: "PumpFun",
      programId: "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",
    }),
  5000
);

const letsbonkMigrationQueue = createQueue(
  (sig: string) =>
    txProcessor(sig, {
      title: "BONK Migration Detected",
      discordChannelEnv: "DISCORD_CHANNEL_ID_BONK_MIGRATION",
      filterFn: (inner) =>
        inner.parsed?.type === "initializeAccount3" &&
        inner.parsed.info.owner ===
          "GpMZbSM2GgvTKHJirzeGfMFoaZ8UR2X7F4v8vHTvxFbL" &&
        inner.parsed.info.mint !==
          "So11111111111111111111111111111111111111112",
      launchPad: "LetsBonk",
      programId: "LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj",
    }),
  5000
);

letsbonkMigrationQueue.add(
  "4rXabMYW6hNtTbJHP1kGS1mxsQZM8rF6FKS3yTpFVbBCTvrUWXmJXNEaj6rb4pSA6AqadYi2bv58nTA176dwr6Vv"
);

// Discord login
discordClient.once("clientReady", () => {
  console.log(`Logged in as ${discordClient.user?.tag}`);
});
discordClient.login(process.env.DISCORD_BOT_TOKEN);
