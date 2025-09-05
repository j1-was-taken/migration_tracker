import { Connection, PublicKey } from "@solana/web3.js";
import { Metaplex } from "@metaplex-foundation/js";

// Cache Solana Token List
let solanaTokenListCache: any[] = [];

async function loadSolanaTokenList() {
  if (solanaTokenListCache.length > 0) return solanaTokenListCache;

  try {
    const res = await fetch(
      "https://raw.githubusercontent.com/solana-labs/token-list/main/src/tokens/solana.tokenlist.json"
    );
    const data = await res.json();
    solanaTokenListCache = data.tokens;
  } catch (err) {
    console.warn("Failed to load Solana token list:", err);
  }

  return solanaTokenListCache;
}

/**
 * Fetch token name and symbol from Helius RPC (or any JSON-RPC endpoint)
 */
async function fetchTokenNameAndSymbol(mintAddress: string) {
  const response = await fetch(String(process.env.SOLANA_HTTP_URL), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "text",
      method: "getAsset",
      params: { id: mintAddress },
    }),
  });

  const data = await response.json();
  const metadata = data.result?.content?.metadata;
  if (!metadata) return { name: mintAddress, symbol: mintAddress };

  return { name: metadata.name, symbol: metadata.symbol };
}

/**
 * Unified token metadata fetcher
 */
export async function getTokenMetadata(
  mintAddress: string,
  connection: Connection
) {
  const defaultMeta = {
    name: mintAddress,
    symbol: mintAddress,
    image: "",
    description: "",
    website: "",
    twitter: "",
    telegram: "",
    discord: "",
    rawJson: null,
  };

  // 1️⃣ Try Solana Token List first
  try {
    const tokenList = await loadSolanaTokenList();
    const tokenInfo = tokenList.find((t) => t.address === mintAddress);
    if (tokenInfo) {
      return {
        name: tokenInfo.name || mintAddress,
        symbol: tokenInfo.symbol || mintAddress,
        image: tokenInfo.logoURI || "",
        description: "",
        website: tokenInfo.extensions?.website || "",
        twitter: tokenInfo.extensions?.twitter || "",
        telegram: tokenInfo.extensions?.telegram || "",
        discord: tokenInfo.extensions?.discord || "",
        rawJson: tokenInfo,
      };
    }
  } catch {
    // ignore
  }

  // 2️⃣ Try Metaplex + Helius for NFTs / new tokens
  try {
    const mintPubkey = new PublicKey(mintAddress);
    const metaplex = Metaplex.make(connection);

    // Get NFT data if it exists
    const nft = await metaplex
      .nfts()
      .findByMint({ mintAddress: mintPubkey })
      .catch(() => null);

    // Get name and symbol from Helius RPC as fallback
    const { name, symbol } = await fetchTokenNameAndSymbol(mintAddress);

    // Fetch JSON metadata if URI exists
    let jsonData: any = {};
    if (nft?.uri) {
      try {
        const res = await fetch(nft.uri);
        if (res.ok) jsonData = await res.json();
      } catch {
        // ignore fetch errors
      }
    }

    if (!jsonData.name && !nft?.name && name != mintAddress) {
      console.log(`[DEBUG] Name found via Helius: ${name} for ${mintAddress}`);
    }

    return {
      name: jsonData.name || nft?.name || name || mintAddress,
      symbol: jsonData.symbol || nft?.symbol || symbol || mintAddress,
      image: jsonData.image || nft?.json?.image || "",
      description: jsonData.description || nft?.json?.description || "",
      website:
        jsonData.website || jsonData.external_url || nft?.json?.website || "",
      twitter: jsonData.twitter || nft?.json?.twitter || "",
      telegram: jsonData.telegram || nft?.json?.telegram || "",
      discord: jsonData.discord || nft?.json?.discord || "",
      rawJson: jsonData,
    };
  } catch {
    // ignore errors and continue
  }

  // 3️⃣ Fallback to mint address only
  return defaultMeta;
}
