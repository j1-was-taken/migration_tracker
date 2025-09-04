import { Connection, PublicKey } from "@solana/web3.js";
import { Metaplex } from "@metaplex-foundation/js";
import { programs } from "@metaplex/js";

export async function getTokenMetadata(mint: string, connection: Connection) {
  try {
    const metaplex = Metaplex.make(connection);
    const mintAddress = new PublicKey(mint);

    const metadataAccount = metaplex
      .nfts()
      .pdas()
      .metadata({ mint: mintAddress });

    const metadataAccountInfo = await connection.getAccountInfo(
      metadataAccount
    );

    if (!metadataAccountInfo) return null;

    // 🔹 Get token metadata
    const token = await metaplex.nfts().findByMint({ mintAddress });

    const metadata = {
      name: token.name,
      symbol: token.symbol,
      image: token.json?.image || "",
      description: token.json?.description || "",
      website:
        token.json?.website ||
        token.json?.external_url ||
        token.json?.createdOn ||
        "",
      twitter: token.json?.twitter || "",
      telegram: token.json?.telegram || "",
      discord: token.json?.discord || "",
      rawJson: token.json, // in case you want to see all fields
    };

    return metadata;
  } catch (error) {
    console.error("Error fetching token metadata:", error);
    return null;
  }
}

const {
  metadata: { Metadata },
} = programs;

// Fetch Solana Token List once (you can cache this)
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
 * Bulletproof function to get token name and symbol
 */
export async function getTokenMetadataV2(
  mintAddress: string,
  connection: Connection
): Promise<{ name: string; symbol: string }> {
  const mintPubkey = new PublicKey(mintAddress);

  // 1️⃣ Try on-chain Metaplex metadata
  try {
    const metadataPDA = await Metadata.getPDA(mintPubkey);
    const metadataAccount = await Metadata.load(connection, metadataPDA);

    // 2️⃣ Try fetching name/symbol from URI JSON
    const uri = metadataAccount.data.data.uri;
    if (uri) {
      try {
        const res = await fetch(uri);
        if (res.ok) {
          const json = await res.json();
          return {
            name: json.name || metadataAccount.data.data.name || mintAddress,
            symbol:
              json.symbol || metadataAccount.data.data.symbol || mintAddress,
          };
        }
      } catch {
        // Ignore fetch errors, fallback to on-chain metadata
      }
    }

    return {
      name: metadataAccount.data.data.name || mintAddress,
      symbol: metadataAccount.data.data.symbol || mintAddress,
    };
  } catch {
    // Ignore errors, try token list
  }

  // 3️⃣ Try Solana token list
  const tokenList = await loadSolanaTokenList();
  const tokenInfo = tokenList.find((t) => t.address === mintAddress);
  if (tokenInfo) {
    return {
      name: tokenInfo.name || mintAddress,
      symbol: tokenInfo.symbol || mintAddress,
    };
  }

  // 4️⃣ Fallback: return mint address
  return { name: mintAddress, symbol: mintAddress };
}
