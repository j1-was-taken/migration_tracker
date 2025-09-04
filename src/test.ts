import { createTxProcessor } from "./utils/txProcessor";
import { Client, GatewayIntentBits } from "discord.js";
import {
  Connection,
  GetVersionedTransactionConfig,
  PublicKey,
  clusterApiUrl,
} from "@solana/web3.js";
import dotenv from "dotenv";
import { getTokenMetadata } from "./utils/metadata";
import { getBestPairAddress } from "./utils/getPair";
import { sendDiscordAlert } from "./utils/discord";
import { fetchDexData } from "./utils/fetchDexData";
import { sleep } from "./utils/sleep";
dotenv.config();

const connection = new Connection(clusterApiUrl("mainnet-beta"));
const discordClient = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

async function getFirstTxSignatures(
  programId: string,
  connection: Connection,
  limit = 40
) {
  const signatures = await connection.getSignaturesForAddress(
    new PublicKey(programId),
    { limit } // max is usually 1000
  );

  return signatures.map((sig) => sig.signature);
}

// Log in Discord (required if you want alerts to actually send)
discordClient.login(process.env.DISCORD_BOT_TOKEN);

discordClient.once("clientReady", async () => {
  console.log(`Logged in as ${discordClient.user?.tag}`);

  // After ready, run test
  await testSignature();
});

const testSignature = async () => {
  const config = {
    instructionType: "getAccountDataSize", // or "initializeMint2" for mint tx
    program: "spl-token", // optional
    title: "Token Migration Detected",
    discordChannelEnv: "DISCORD_CHANNEL_ID_ALL_MIGRATION",
  };

  const txs = [
    "2TU5rYaxWJvWo663AQAoN1TKBX3c7JTod7LfMpwTdubugcAcjXsbQUmvVnoproA6QJ9P8dtz59BViYfNoU2LNwRj",
    "2NxZP6iKgHnPhrPotviroEavWFMrJgjonj3kLxscSNcqGej3Pr9Kd6rL4vj3zeZuvM2hKSbmfuW9RrNJFxPeyFxF",
    "5R73Z4b2W2c22AqNRn3Xq45BMCNNzm67aXdKVUDbiEr47wD5hWHhXNBYNumgzvTis49PdiToLQYX9Qf1nVDnciqX",
    "oPbodFMDVa72iJD5ZXz4hqR8urkS1qVttNFUwgcpXVLwkzygrES6UUmSF3mZ6P3ZrQjZn2dstFQjuM7emKL9TFB",
    "2T5uN5ZtcYEnr6xozgJn7KtLSimtH6y3fCyRgjH7RY7T9fhAobS58skfPoqmFuZ8rN4vymgDCndSR3rd58LJKsVn",
    "2S6UsS5RzVeTVe148bMt2nYh48QfqP6zUNJtXtBKT3KzKMURZHTEKHzStQqjxchfX3VqTARLjjChdDHWaQEwXKA8",
    "4CYJ7P6CeigdChg97zLidHx11PiCYymrr1r1s1HRhNaZvN2dWsnFuWKzJkbvi5x1DqaLLTPs4a2o2ydTz1V84TRA",
    "4tRMGuctKS5LZbUMfC5ed7o6nBSHJs4xRStv4rehw2eyeAmwXuMF1M4qQT5C9RD6J73tXSj7QrtACNbWWua9Y8op",
    "xKCPagWGLdvWygWgUgbrH7rZrvUPTgB3Ebj7fLc6nWWEYvLRCBMam2Nq1DZPhrgRqx3F2658WJcUQJHbVMx6Uj1",
    "3q7dBGr8CGrnQrdJdKTKmMkpVgeksoc5DCrEX5UZVdYdLmGMDPyKeL3Z2DbVnGKbw4pekyLhi83QHmGZ6SzAS39R",
    "3DMXZWbDafppCoE9Y5F73qAMrfELY25EcYPPRsoSEcGpUopApZKVp3xiKgJoMK5guw9DwMpH4Ry4Yr49QSbMsTL2",
    "3e7QJBPsEfWvVu8Hf6FbZzz4vPrAvEeU4pEbLHvVHZTaeVqoVA4PGH8UBssSvBFrSSGBbnvFhjNvPFWQh6m3aEYf",
    "5yXQ5M5YDcujvopf48HzWdxUN7SCn3YKdWb7RLqr1wYi9Gs1rRb5VfAdfsEFYYQYFNBzciWC6XeMwrHW2rP7eZbk",
    "4a3HruPQSwenAKFkHufvaTfgjfGo9Ya3VqJD3kwtayoUhZL6gZtaXWZFUW57mzGo482L8ETvghA11885LvSw9cvS",
  ];

  for (const signature of txs) {
    console.log("Processing test signature:", signature);

    const tx = await connection.getParsedTransaction(signature, {
      maxSupportedTransactionVersion: 0,
      commitment: "confirmed",
    } as GetVersionedTransactionConfig);

    if (!tx) continue;

    for (const ix of tx.meta?.innerInstructions || []) {
      for (const inner of ix.instructions) {
        if (
          "parsed" in inner &&
          inner.parsed?.type === "initializeAccount3" &&
          inner.parsed.info.owner ===
            "GpMZbSM2GgvTKHJirzeGfMFoaZ8UR2X7F4v8vHTvxFbL" &&
          inner.parsed.info.mint !==
            "So11111111111111111111111111111111111111112"
        ) {
          const mintAddress = inner.parsed.info.mint;

          await getTokenMetadata(mintAddress, connection);

          const tokenAlert = await fetchDexData(
            mintAddress,
            "LetsBonk",
            connection
          );

          await sendDiscordAlert(
            discordClient,
            process.env[config.discordChannelEnv] || "",
            tokenAlert
          );
          console.log(`${config.title}:`, mintAddress);
        }
      }
    }

    console.log("Test transaction processed!");

    // Wait 1 second between each signature (adjust as needed)
    await sleep(5000);
  }
};
