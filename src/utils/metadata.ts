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
    return solanaTokenListCache;
  } catch (err) {
    console.warn("Failed to load Solana token list:", err);
    return [];
  }
}

/**
 * Unified, bulletproof token metadata fetcher.
 */
export async function getTokenMetadata(
  mintAddress: string,
  connection: Connection
) {
  const mintPubkey = new PublicKey(mintAddress);
  const metaplex = Metaplex.make(connection);

  // 1️⃣ Try Metaplex on-chain metadata
  try {
    const nft = await metaplex.nfts().findByMint({ mintAddress: mintPubkey });

    // 2️⃣ Try JSON URI metadata
    if (nft.uri) {
      try {
        const res = await fetch(nft.uri);
        if (res.ok) {
          const json = await res.json();
          return {
            name: json.name || nft.name || mintAddress,
            symbol: json.symbol || nft.symbol || mintAddress,
            image: json.image || "",
            description: json.description || "",
            website: json.website || json.external_url || "",
            twitter: json.twitter || "",
            telegram: json.telegram || "",
            discord: json.discord || "",
            rawJson: json,
          };
        }
      } catch {
        // ignore fetch errors
      }
    }

    return {
      name: nft.name || mintAddress,
      symbol: nft.symbol || mintAddress,
      image: nft.json?.image || "",
      description: nft.json?.description || "",
      website: nft.json?.website || nft.json?.external_url || "",
      twitter: nft.json?.twitter || "",
      telegram: nft.json?.telegram || "",
      discord: nft.json?.discord || "",
      rawJson: nft.json,
    };
  } catch {
    // fallback to token list
  }

  // 3️⃣ Fallback: Solana Token List
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

  // 4️⃣ Final fallback: just mint
  return {
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
}
