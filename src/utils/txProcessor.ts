// utils/txProcessor.ts
import {
  Connection,
  PublicKey,
  GetVersionedTransactionConfig,
} from "@solana/web3.js";
import { sendDiscordAlert } from "./discord";
import { getTokenMetadata } from "./metadata";
import { getBestPairAddress } from "./getPair";
import { Client } from "discord.js";
import { TokenAlert } from "../types";
import { fetchDexData } from "./fetchDexData";

// Global set to track mints already sent to Discord
const sentMints = new Set<string>();

export type ProcessorConfig = {
  title: string; // title for Discord alert
  discordChannelEnv: string; // env var for Discord channel
  filterFn: (inner: any) => boolean; // custom filter function for inner instruction
  launchPad: string;
};

export const createTxProcessor =
  (connection: Connection, discordClient: Client) =>
  async (signature: string, config: ProcessorConfig) => {
    try {
      const tx = await connection.getParsedTransaction(signature, {
        maxSupportedTransactionVersion: 0,
        commitment: "confirmed",
      } as GetVersionedTransactionConfig);

      if (!tx) return;

      const launchpadProgramId = new PublicKey(
        "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"
      );

      const launchpadInstructions = tx.transaction.message.instructions.filter(
        (ix) => ix.programId.equals(launchpadProgramId)
      );
      if (!launchpadInstructions.length) return;

      for (const ix of tx.meta?.innerInstructions || []) {
        for (const inner of ix.instructions) {
          if ("parsed" in inner && config.filterFn(inner)) {
            const mintAddress = inner.parsed.info.mint;

            // Skip if already sent
            if (sentMints.has(mintAddress)) continue;

            // Optional: Fetch price, volume, liquidity, FDV, etc. via APIs
            const tokenAlert = await fetchDexData(
              mintAddress,
              config.launchPad,
              connection
            );

            await sendDiscordAlert(
              discordClient,
              process.env[config.discordChannelEnv] || "",
              tokenAlert
            );

            sentMints.add(mintAddress);
            console.log(`${config.title}:`, mintAddress);
          }
        }
      }
    } catch (err) {
      console.error("Failed to process transaction:", err);
    }
  };
