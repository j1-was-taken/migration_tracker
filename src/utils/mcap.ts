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
 * 🔹 Get price from DexScreener (fallbacks could be added here too)
 */
async function getTokenPriceUsd(mint: string): Promise<number> {
  try {
    const url = `https://api.dexscreener.com/latest/dex/tokens/${mint}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("DexScreener price fetch failed");

    const data = await res.json();
    const price = parseFloat(data.pairs?.[0]?.priceUsd || "0");
    if (price > 0) {
      console.log(`[PRICE] DexScreener price for ${mint}: $${price}`);
    } else {
      console.warn(`[PRICE] DexScreener returned no price for ${mint}`);
    }
    return price;
  } catch (err: any) {
    console.warn(`[PRICE] DexScreener failed for ${mint}: ${err.message}`);
    return 0;
  }
}

/**
 * 🔹 Market cap calculator with logging and Moralis FDV fallback
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
    console.log(`[MCAP] Calculated from RPC+Dex: $${mcap.toLocaleString()}`);
    return mcap;
  }

  // 🔹 fallback to Moralis FDV
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
