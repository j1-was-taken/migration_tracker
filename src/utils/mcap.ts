import { Connection, PublicKey } from "@solana/web3.js";

export async function getTokenSupply(
  mintAddress: string,
  connection: Connection
): Promise<number> {
  const mintPubkey = new PublicKey(mintAddress);
  const mintInfo = await connection.getParsedAccountInfo(mintPubkey);

  if (!mintInfo.value) throw new Error("Mint not found");

  const data = (mintInfo.value.data as any).parsed.info;
  const supply = Number(data.supply) / Math.pow(10, data.decimals);
  return supply;
}

async function getTokenPriceUsd(mint: string): Promise<number> {
  try {
    const url = `https://api.dexscreener.com/latest/dex/tokens/${mint}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("DexScreener price fetch failed");
    const data = await res.json();
    return parseFloat(data.pairs?.[0]?.priceUsd || "0");
  } catch {
    // 🔹 Fallback to other APIs like Jupiter or Pyth
    return 0;
  }
}

export async function getMarketCap(
  mintAddress: string,
  connection: Connection
): Promise<number> {
  const [priceUsd, supply] = await Promise.all([
    getTokenPriceUsd(mintAddress),
    getTokenSupply(mintAddress, connection),
  ]);

  if (!priceUsd || !supply) return 0;

  return priceUsd * supply;
}
