export async function getBestPairAddress(
  mintAddress: string
): Promise<{ pairAddress: string; chainId: string } | null> {
  const url = `https://api.dexscreener.com/latest/dex/tokens/${mintAddress}`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    const pairs = data.pairs || [];

    if (pairs.length === 0) return null;

    // You can sort by liquidity, volume, or however you define "best"
    pairs.sort((a: any, b: any) => b.liquidityUsd - a.liquidityUsd);
    const pairAddress = pairs[0].pairAddress;
    const chainId = pairs[0].chainId;
    return { pairAddress, chainId };
  } catch (err) {
    console.error("Error fetching Dexscreener data:", err);
    return null;
  }
}
