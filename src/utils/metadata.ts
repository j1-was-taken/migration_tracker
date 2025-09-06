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
  } catch {
    // ignore
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
    const metadata = (await res.json()).result?.content?.metadata;
    return metadata ? { name: metadata.name, symbol: metadata.symbol } : null;
  } catch {
    return null;
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
    return await res.json();
  } catch {
    return null;
  }
}

// ----------------------------
// Fetch token info via Jupiter API
// ----------------------------
export async function fetchTokenNameFromJup(
  mint: string
): Promise<{ jupName: string; jupSymbol: string } | null> {
  try {
    const res = await axios.get("https://lite-api.jup.ag/tokens/v2/search", {
      params: { query: mint },
      headers: { Accept: "application/json" },
      maxBodyLength: Infinity,
    });
    const token = res.data?.[0];
    if (!token?.name || !token?.symbol) return null;
    return { jupName: token.name, jupSymbol: token.symbol };
  } catch {
    return null;
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

  let source = "Default";
  let jsonData: any = {};

  // 1️⃣ Solana Token List
  try {
    const tokenList = await loadSolanaTokenList();
    const tokenInfo = tokenList.find((t) => t.address === mintAddress);
    if (tokenInfo) {
      source = "Solana Token List";
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

  // 2️⃣ Metaplex NFT + Helius + Moralis + Jupiter
  try {
    const mintPubkey = new PublicKey(mintAddress);
    const metaplex = Metaplex.make(connection);

    const nft = await metaplex
      .nfts()
      .findByMint({ mintAddress: mintPubkey })
      .catch(() => null);
    const heliusData = await fetchTokenNameAndSymbol(mintAddress);
    const moralisData = await fetchFromMoralis(mintAddress);
    const jupiterData = await fetchTokenNameFromJup(mintAddress);

    if (nft?.uri) {
      try {
        const res = await fetch(nft.uri);
        if (res.ok) jsonData = await res.json();
      } catch {
        // ignore
      }
      source = "NFT Metadata";
    } else if (heliusData) {
      source = "Helius RPC";
    } else if (moralisData) {
      source = "Moralis API";
    } else if (jupiterData) {
      source = "Jupiter API";
    }

    const name =
      jsonData.name ||
      nft?.name ||
      heliusData?.name ||
      moralisData?.name ||
      jupiterData?.jupName ||
      mintAddress;
    const symbol =
      jsonData.symbol ||
      nft?.symbol ||
      heliusData?.symbol ||
      moralisData?.symbol ||
      jupiterData?.jupSymbol ||
      mintAddress;

    console.log(`[SOURCE] ${source} provided metadata for ${mintAddress}`);

    return {
      name,
      symbol,
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

  console.log(`[SOURCE] ${source} (default metadata) used for ${mintAddress}`);
  return defaultMeta;
}
