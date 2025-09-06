import { Connection, PublicKey } from "@solana/web3.js";
import { Metaplex } from "@metaplex-foundation/js";
import axios from "axios";

// ----------------------------
// Cache for Solana Token List
// ----------------------------
let solanaTokenListCache: any[] = [];

async function loadSolanaTokenList(): Promise<any[]> {
  if (solanaTokenListCache.length) return solanaTokenListCache;

  try {
    const res = await fetch(
      "https://raw.githubusercontent.com/solana-labs/token-list/main/src/tokens/solana.tokenlist.json"
    );
    const data = await res.json();
    solanaTokenListCache = data.tokens || [];
    console.log(
      `[SOLANA TOKEN LIST] Loaded ${solanaTokenListCache.length} tokens`
    );
  } catch (err) {
    console.warn("Failed to load Solana token list:", err);
  }

  return solanaTokenListCache;
}

// ----------------------------
// Fetch token metadata via Helius RPC
// ----------------------------
async function fetchTokenNameAndSymbol(mintAddress: string) {
  try {
    const res = await fetch(String(process.env.SOLANA_HTTP_URL), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "text",
        method: "getAsset",
        params: { id: mintAddress },
      }),
    });

    const data = await res.json();
    const metadata = data.result?.content?.metadata;

    if (!metadata) return { name: mintAddress, symbol: mintAddress };

    console.log(`[HELIUS] Found metadata for ${mintAddress}`);
    return { name: metadata.name, symbol: metadata.symbol };
  } catch {
    console.warn(`[HELIUS] Failed to fetch metadata for ${mintAddress}`);
    return { name: mintAddress, symbol: mintAddress };
  }
}

// ----------------------------
// Fallback fetch via Moralis API
// ----------------------------
export async function fetchFromMoralis(mintAddress: string) {
  try {
    const res = await fetch(
      `https://solana-gateway.moralis.io/token/mainnet/${mintAddress}/metadata`,
      {
        method: "GET",
        headers: {
          accept: "application/json",
          "X-API-Key": String(process.env.MORALIS_API_KEY),
        },
      }
    );

    if (!res.ok) return null;
    console.log(`[MORALIS] Metadata fetched for ${mintAddress}`);
    return await res.json();
  } catch {
    console.warn(`[MORALIS] Failed to fetch metadata for ${mintAddress}`);
    return null;
  }
}

// ----------------------------
// Fetch token info via Jupiter API
// ----------------------------
export async function fetchTokenNameFromJup(
  mint: string
): Promise<{ jupName: string; jupSymbol: string }> {
  try {
    const res = await axios.get("https://lite-api.jup.ag/tokens/v2/search", {
      params: { query: mint },
      headers: { Accept: "application/json" },
      maxBodyLength: Infinity,
    });

    const data = res.data;
    if (!Array.isArray(data) || !data.length) {
      console.warn(`[JUPITER] No data returned for ${mint}`);
      return { jupName: mint, jupSymbol: mint };
    }

    const token = data[0];
    if (!token.name || !token.symbol) {
      console.warn(`[JUPITER] Missing name/symbol for ${mint}`);
      return { jupName: mint, jupSymbol: mint };
    }

    console.log(`[JUPITER] Found token info for ${mint}`);
    return { jupName: token.name, jupSymbol: token.symbol };
  } catch (err: any) {
    console.error(`[JUPITER] Request failed for ${mint}:`, err.message);
    return { jupName: mint, jupSymbol: mint };
  }
}

// ----------------------------
// Unified token metadata fetcher
// ----------------------------
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

  // 1️⃣ Solana Token List
  try {
    const tokenList = await loadSolanaTokenList();
    const tokenInfo = tokenList.find((t) => t.address === mintAddress);

    if (tokenInfo) {
      console.log(`[SOURCE] Solana Token List`);
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

  // 2️⃣ Metaplex + Helius + Moralis + Jupiter
  try {
    const mintPubkey = new PublicKey(mintAddress);
    const metaplex = Metaplex.make(connection);

    const nft = await metaplex
      .nfts()
      .findByMint({ mintAddress: mintPubkey })
      .catch(() => null);
    const { name: heliusName, symbol: heliusSymbol } =
      await fetchTokenNameAndSymbol(mintAddress);
    const moralisData = await fetchFromMoralis(mintAddress);
    const { jupName, jupSymbol } = await fetchTokenNameFromJup(mintAddress);

    let jsonData: any = {};
    if (nft?.uri) {
      try {
        const res = await fetch(nft.uri);
        if (res.ok) jsonData = await res.json();
      } catch {
        // ignore
      }
    }

    console.log(
      `[SOURCE] ${nft?.uri ? "NFT Metadata" : "Helius/Moralis/Jupiter"}`
    );

    return {
      name:
        jsonData.name ||
        nft?.name ||
        heliusName ||
        moralisData?.name ||
        jupName ||
        mintAddress,
      symbol:
        jsonData.symbol ||
        nft?.symbol ||
        heliusSymbol ||
        moralisData?.symbol ||
        jupSymbol ||
        mintAddress,
      image: jsonData.image || nft?.json?.image || "",
      description: jsonData.description || nft?.json?.description || "",
      website:
        jsonData.website ||
        jsonData.external_url ||
        nft?.json?.website ||
        moralisData?.external_url ||
        "",
      twitter: jsonData.twitter || nft?.json?.twitter || "",
      telegram: jsonData.telegram || nft?.json?.telegram || "",
      discord: jsonData.discord || nft?.json?.discord || "",
      rawJson: jsonData,
    };
  } catch {
    // ignore
  }

  console.log(`[SOURCE] Default metadata`);
  return defaultMeta;
}
