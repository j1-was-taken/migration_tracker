import { Connection } from "@solana/web3.js";
import { getTokenMetadata } from "./metadata";
import { getBestPairAddress } from "./getPair";
import { TokenAlert } from "../types";
import { findHolders } from "./getHolders";
import { sleep } from "./sleep";
import { getMarketCap } from "./mcap";

function formatAge(ageMs: number): string {
  const seconds = Math.floor(ageMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years > 0) return `${years}y ${months % 12}mo`;
  if (months > 0) return `${months}mo ${weeks % 4}w`;
  if (weeks > 0) return `${weeks}w ${days % 7}d`;
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

async function getBestPairWithRetry(
  mintAddress: string,
  retries = 5,
  delayS = 30 // 20 seconds
) {
  const delayMs = delayS * 1000;
  let attempt = 0;
  while (attempt <= retries) {
    try {
      const pairData = await getBestPairAddress(mintAddress);
      if (!pairData) throw new Error("No trading pair found for this token");
      return pairData;
    } catch (err) {
      attempt++;
      if (attempt >= retries) {
        throw new Error(
          `Failed to fetch best pair for ${mintAddress} after ${retries} attempts: ${err}`
        );
      }
      console.log(
        `Attempt ${attempt} failed for ${mintAddress}. Retrying in ${
          delayMs / 1000
        } seconds...`
      );
      await sleep(delayMs);
    }
  }
}

export async function fetchDexData(
  mintAddress: string,
  launchPad: string,
  connection: Connection
): Promise<TokenAlert> {
  // 🔹 Get on-chain/off-chain metadata
  const metadataV2 = await getTokenMetadata(mintAddress, connection);
  const tokenName = metadataV2?.name || mintAddress;
  const tokenSymbol = metadataV2?.symbol || mintAddress;

  // 🔹 Attempt to get best pair info
  let pairData;
  try {
    pairData = await getBestPairWithRetry(mintAddress, 30);
  } catch (err) {
    console.log(`No pair data found for ${mintAddress}, using default values.`);
    pairData = null;
  }

  // 🔹 Default values
  let pairAddress = "";
  let marketCap = "0";
  let priceUsd = "0";
  let fdv = "0";
  let liquidity = "0";

  let vol24h = "0";
  let vol6h = "0";
  let vol1h = "0";
  let vol5min = "0";

  let priceChange24h = "0";
  let priceChange6h = "0";
  let priceChange1h = "0";
  let priceChange5min = "0";

  let buyers24hr = "0";
  let buyers6hr = "0";
  let buyers1hr = "0";
  let buyers5min = "0";

  let sellers24hr = "0";
  let sellers6hr = "0";
  let sellers1hr = "0";
  let sellers5min = "0";

  let ageString = "N/A";

  // 🔹 Fetch holders
  const holdersData = await findHolders(mintAddress, connection);
  const numHolders = holdersData.totalHolders || "0";
  const topHoldersPercentages = holdersData.topHolders
    ? holdersData.topHolders.map((h) => h.percentage.toFixed(2) + "%")
    : [];
  const topHoldersTotalPercentage = holdersData.topHolders
    ? holdersData.topHolders
        .reduce((sum, h) => sum + h.percentage, 0)
        .toFixed(2) + "%"
    : "0%";

  // 🔹 Only fetch Dex data if pair exists
  if (pairData) {
    const { pairAddress: addr, chainId } = pairData;
    pairAddress = addr;

    const dexUrl = `https://api.dexscreener.com/latest/dex/pairs/${chainId}/${pairAddress}`;

    try {
      const [tokenResponse] = await Promise.all([fetch(dexUrl)]);
      if (tokenResponse.ok) {
        const tokenData = await tokenResponse.json();
        const pair = tokenData?.pair;
        if (pair) {
          priceUsd = pair.priceUsd || "0";
          fdv = pair.fdv?.toString() || "0";

          liquidity = pair.liquidity?.usd?.toString() || "0";

          vol24h = pair.volume?.h24?.toString() || "0";
          vol6h = pair.volume?.h6?.toString() || "0";
          vol1h = pair.volume?.h1?.toString() || "0";
          vol5min = pair.volume?.m5?.toString() || "0";

          priceChange24h = pair.priceChange?.h24?.toString() || "0";
          priceChange6h = pair.priceChange?.h6?.toString() || "0";
          priceChange1h = pair.priceChange?.h1?.toString() || "0";
          priceChange5min = pair.priceChange?.m5?.toString() || "0";

          buyers24hr = pair.txns?.h24?.buys?.toString() || "0";
          buyers6hr = pair.txns?.h6?.buys?.toString() || "0";
          buyers1hr = pair.txns?.h1?.buys?.toString() || "0";
          buyers5min = pair.txns?.m5?.buys?.toString() || "0";

          sellers24hr = pair.txns?.h24?.sells?.toString() || "0";
          sellers6hr = pair.txns?.h6?.sells?.toString() || "0";
          sellers1hr = pair.txns?.h1?.sells?.toString() || "0";
          sellers5min = pair.txns?.m5?.sells?.toString() || "0";

          ageString = formatAge(
            Date.now() - (pair.pairCreatedAt || Date.now())
          );
        }
      }
    } catch (err) {
      console.log(
        `Failed to fetch Dex data for ${mintAddress}, using defaults.`
      );
    }
  }

  marketCap =
    (await getMarketCap(mintAddress, connection)).toFixed(2) || "0.00";

  const metadata = await getTokenMetadata(mintAddress, connection);

  // 🔹 Get socials from metadata
  const website = String(
    metadata?.website ||
      metadata?.rawJson?.website ||
      metadata?.rawJson?.external_url ||
      ""
  );
  const twitter = String(metadata?.twitter || metadata?.rawJson?.twitter || "");
  const telegram = String(
    metadata?.telegram || metadata?.rawJson?.telegram || ""
  );
  const discord = String(metadata?.discord || metadata?.rawJson?.discord || "");

  // 🔹 Return formatted TokenAlert
  return {
    title: "New Token Alert",
    name: tokenName,
    symbol: tokenSymbol,
    mint: mintAddress,
    marketCap,
    priceUsd,
    fdv,
    liquidity,
    vol24h,
    vol6h,
    vol1h,
    vol5min,
    priceChange24h,
    priceChange6h,
    priceChange1h,
    priceChange5min,
    buyers24hr,
    buyers6hr,
    buyers1hr,
    buyers5min,
    sellers24hr,
    sellers6hr,
    sellers1hr,
    sellers5min,
    age: ageString,
    numHolders,
    topHoldersPercentages,
    topHoldersTotalPercentage,
    link: pairAddress ? `https://dexscreener.com/solana/${pairAddress}` : "",
    website,
    twitter,
    telegram,
    discord,
    launchPad,
  };
}
