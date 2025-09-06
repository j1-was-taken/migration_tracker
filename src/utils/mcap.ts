import axios from "axios";
import { Connection, PublicKey } from "@solana/web3.js";
import { fetchFromMoralis } from "./metadata";

/**
 * 🔹 Fetch token supply
 * Tries RPC first, then falls back to Moralis
 */
export async function getTokenSupply(
  mintAddress: string,
  connection: Connection
): Promise<number> {
  // 1️⃣ Try RPC
  try {
    const mintPubkey = new PublicKey(mintAddress);
    const mintInfo = await connection.getParsedAccountInfo(mintPubkey);

    if (mintInfo.value) {
      const data = (mintInfo.value.data as any).parsed.info;
      const supply = Number(data.supply) / Math.pow(10, data.decimals);
      console.log(`[SUPPLY][RPC] ${mintAddress}: ${supply}`);
      return supply;
    }
  } catch (err: any) {
    console.warn(`[SUPPLY][RPC] Failed for ${mintAddress}: ${err.message}`);
  }

  // 2️⃣ Fallback: Moralis
  try {
    const moralisData = await fetchFromMoralis(mintAddress);
    if (moralisData?.totalSupplyFormatted) {
      const supply = Number(moralisData.totalSupplyFormatted);
      console.log(`[SUPPLY][Moralis] ${mintAddress}: ${supply}`);
      return supply;
    }
  } catch (err: any) {
    console.warn(`[SUPPLY][Moralis] Failed for ${mintAddress}: ${err.message}`);
  }

  console.error(`[SUPPLY] Could not resolve supply for ${mintAddress}`);
  return 0;
}

/**
 * 🔹 Fetch token price in USD
 * Tries Jupiter v3 first, then falls back to Moralis FDV
 */
async function getTokenPriceUsd(mint: string): Promise<number> {
  // 1️⃣ Jupiter v3
  try {
    const res = await axios.get("https://lite-api.jup.ag/price/v3", {
      params: { ids: mint },
      headers: { Accept: "application/json" },
    });

    const entry = res.data?.[mint];
    if (entry?.usdPrice) {
      const price = parseFloat(entry.usdPrice);
      console.log(`[PRICE][Jupiter] ${mint}: $${price}`);
      return price;
    }
    console.warn(`[PRICE][Jupiter] No USD price for ${mint}`);
  } catch (err: any) {
    console.error(`[PRICE][Jupiter] Failed for ${mint}: ${err.message}`);
  }

  // 2️⃣ Fallback: Moralis FDV / supply
  try {
    const moralisData = await fetchFromMoralis(mint);
    if (moralisData?.fullyDilutedValue && moralisData?.totalSupplyFormatted) {
      const fdv = Number(moralisData.fullyDilutedValue);
      const supply = Number(moralisData.totalSupplyFormatted);
      if (fdv > 0 && supply > 0) {
        const impliedPrice = fdv / supply;
        console.log(`[PRICE][Moralis FDV] ${mint}: $${impliedPrice}`);
        return impliedPrice;
      }
    }
  } catch (err: any) {
    console.warn(`[PRICE][Moralis FDV] Failed for ${mint}: ${err.message}`);
  }

  console.error(`[PRICE] Could not resolve price for ${mint}`);
  return 0;
}

/**
 * 🔹 Calculate token market cap
 * Uses price * supply, with Moralis FDV as fallback
 */
export async function getMarketCap(
  mintAddress: string,
  connection: Connection
): Promise<number> {
  const [priceUsd, supply] = await Promise.all([
    getTokenPriceUsd(mintAddress),
    getTokenSupply(mintAddress, connection),
  ]);

  // 1️⃣ Price * supply
  if (priceUsd > 0 && supply > 0) {
    const mcap = priceUsd * supply;
    console.log(`[MCAP][Calc] ${mintAddress}: $${mcap.toLocaleString()}`);
    return mcap;
  }

  // 2️⃣ Fallback: Moralis FDV
  try {
    const moralisData = await fetchFromMoralis(mintAddress);
    if (moralisData?.fullyDilutedValue) {
      const fdv = Number(moralisData.fullyDilutedValue);
      console.log(
        `[MCAP][Moralis FDV] ${mintAddress}: $${fdv.toLocaleString()}`
      );
      return fdv;
    }
  } catch (err: any) {
    console.warn(
      `[MCAP][Moralis FDV] Failed for ${mintAddress}: ${err.message}`
    );
  }

  console.error(`[MCAP] Could not resolve market cap for ${mintAddress}`);
  return 0;
}
