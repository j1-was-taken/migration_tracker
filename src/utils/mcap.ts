import axios from "axios";
import { Connection, PublicKey } from "@solana/web3.js";
import { fetchFromMoralis } from "./metadata";

/**
 * 🔹 Try to get token supply from RPC first, then Moralis if RPC fails
 */
export async function getTokenSupply(
  mintAddress: string,
  connection: Connection
): Promise<number> {
  try {
    const mintPubkey = new PublicKey(mintAddress);
    const mintInfo = await connection.getParsedAccountInfo(mintPubkey);

    if (mintInfo.value) {
      const data = (mintInfo.value.data as any).parsed.info;
      const supply = Number(data.supply) / Math.pow(10, data.decimals);
      console.log(`[SUPPLY] RPC supply for ${mintAddress}: ${supply}`);
      return supply;
    }
  } catch (err: any) {
    console.warn(
      `[SUPPLY] RPC fetch failed for ${mintAddress}: ${err.message}`
    );
  }

  // 🔹 fallback to Moralis
  try {
    const moralisData = await fetchFromMoralis(mintAddress);
    if (moralisData?.totalSupplyFormatted) {
      const supply = Number(moralisData.totalSupplyFormatted);
      console.log(`[SUPPLY] Moralis supply for ${mintAddress}: ${supply}`);
      return supply;
    }
  } catch (err: any) {
    console.warn(
      `[SUPPLY] Moralis fallback failed for ${mintAddress}: ${err.message}`
    );
  }

  console.error(`[SUPPLY] Could not resolve supply for ${mintAddress}`);
  return 0;
}

/**
 * 🔹 Get token price from Jupiter v3 API, fallback Moralis FDV
 */
async function getTokenPriceUsd(mint: string): Promise<number> {
  try {
    const res = await axios.get("https://lite-api.jup.ag/price/v3", {
      params: { ids: mint },
      headers: { Accept: "application/json" },
    });

    const entry = res.data?.[mint];
    if (!entry) {
      console.warn(`[PRICE] No data for token ${mint} in response`);
      return 0;
    }

    const price = entry?.usdPrice ? parseFloat(entry.usdPrice) : 0;
    if (price > 0) {
      console.log(`[PRICE] Jupiter v3 price for ${mint}: $${price}`);
      return price;
    }

    console.warn(`[PRICE] Jupiter v3 returned no usdPrice field for ${mint}`);
  } catch (err: any) {
    console.error(
      `[PRICE] Jupiter v3 request failed for ${mint}: ${err.message}`
    );
  }
  // 🔹 fallback: derive price from Moralis FDV + supply
  try {
    const moralisData = await fetchFromMoralis(mint);
    if (moralisData?.fullyDilutedValue && moralisData?.totalSupplyFormatted) {
      const fdv = Number(moralisData.fullyDilutedValue);
      const supply = Number(moralisData.totalSupplyFormatted);
      if (fdv > 0 && supply > 0) {
        const impliedPrice = fdv / supply;
        console.log(
          `[PRICE] Fallback price from Moralis FDV: $${impliedPrice}`
        );
        return impliedPrice;
      }
    }
  } catch (err: any) {
    console.warn(`[PRICE] Moralis fallback failed for ${mint}: ${err.message}`);
  }

  console.error(`[PRICE] Could not resolve price for ${mint}`);
  return 0;
}

/**
 * 🔹 Market cap calculator
 */
export async function getMarketCap(
  mintAddress: string,
  connection: Connection
): Promise<number> {
  const [priceUsd, supply] = await Promise.all([
    getTokenPriceUsd(mintAddress),
    getTokenSupply(mintAddress, connection),
  ]);

  if (priceUsd > 0 && supply > 0) {
    const mcap = priceUsd * supply;
    console.log(
      `[MCAP] Calculated market cap for ${mintAddress}: $${mcap.toLocaleString()}`
    );
    return mcap;
  }

  // 🔹 fallback: Moralis FDV directly
  try {
    const moralisData = await fetchFromMoralis(mintAddress);
    if (moralisData?.fullyDilutedValue) {
      const fdv = Number(moralisData.fullyDilutedValue);
      console.log(
        `[MCAP] Fallback to Moralis FDV for ${mintAddress}: $${fdv.toLocaleString()}`
      );
      return fdv;
    }
  } catch (err: any) {
    console.warn(
      `[MCAP] Moralis FDV fallback failed for ${mintAddress}: ${err.message}`
    );
  }

  console.error(`[MCAP] Could not resolve market cap for ${mintAddress}`);
  return 0;
}
