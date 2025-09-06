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
 * Fetch token name and symbol from Helius RPC
 */
async function fetchTokenNameAndSymbol(mintAddress: string) {
  try {
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
  } catch {
    return { name: mintAddress, symbol: mintAddress };
  }
}

/**
 * Fallback fetch via Moralis API
 */
async function fetchFromMoralis(mintAddress: string) {
  try {
    const response = await fetch(
      `https://solana-gateway.moralis.io/token/mainnet/${mintAddress}/metadata`,
      {
        method: "GET",
        headers: {
          accept: "application/json",
          "X-API-Key": String(process.env.MORALIS_API_KEY),
        },
      }
    );

    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
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

  // 2️⃣ Try Metaplex + Helius
  try {
    const mintPubkey = new PublicKey(mintAddress);
    const metaplex = Metaplex.make(connection);

    const nft = await metaplex
      .nfts()
      .findByMint({ mintAddress: mintPubkey })
      .catch(() => null);

    const { name, symbol } = await fetchTokenNameAndSymbol(mintAddress);

    let jsonData: any = {};
    if (nft?.uri) {
      try {
        const res = await fetch(nft.uri);
        if (res.ok) jsonData = await res.json();
      } catch {
        // ignore
      }
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
    // ignore
  }

  console.log(
    `Metadata fetch via Metaplex failed for ${mintAddress}, trying Moralis...`
  );

  // 3️⃣ Final fallback: Moralis
  const moralisData = await fetchFromMoralis(mintAddress);
  if (moralisData?.name || moralisData?.symbol) {
    return {
      name: moralisData.name || mintAddress,
      symbol: moralisData.symbol || mintAddress,
      image: moralisData.image || "",
      description: moralisData.description || "",
      website: moralisData.website || moralisData.external_url || "",
      twitter: moralisData.twitter || "",
      telegram: moralisData.telegram || "",
      discord: moralisData.discord || "",
      rawJson: moralisData,
    };
  }

  // 4️⃣ If everything fails
  return defaultMeta;
}
