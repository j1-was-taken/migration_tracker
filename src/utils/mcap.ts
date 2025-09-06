import axios from "axios";
import { Connection, PublicKey } from "@solana/web3.js";
import { fetchFromMoralis } from "./metadata";

/**
 * 🔹 Fetch token supply
 */
export async function getTokenSupply(
  mintAddress: string,
  connection: Connection
): Promise<number> {
  const sourcesTried: string[] = [];
  let supply = 0;
  let source = "";

  // RPC
  try {
    const mintPubkey = new PublicKey(mintAddress);
    const mintInfo = await connection.getParsedAccountInfo(mintPubkey);

    if (mintInfo.value) {
      const data = (mintInfo.value.data as any).parsed.info;
      supply = Number(data.supply) / Math.pow(10, data.decimals);
      source = "RPC";
    } else {
      sourcesTried.push("RPC (no data)");
    }
  } catch {
    sourcesTried.push("RPC (failed)");
  }

  // Moralis fallback
  if (!supply) {
    try {
      const moralisData = await fetchFromMoralis(mintAddress);
      if (moralisData?.totalSupplyFormatted) {
        supply = Number(moralisData.totalSupplyFormatted);
        source = "Moralis";
      } else {
        sourcesTried.push("Moralis (no data)");
      }
    } catch {
      sourcesTried.push("Moralis (failed)");
    }
  }

  console.log(
    `[SUPPLY] ${mintAddress} => ${supply} (source: ${supply ? source : "none"}${
      sourcesTried.length ? ", tried: " + sourcesTried.join(", ") : ""
    })`
  );

  return supply;
}

/**
 * 🔹 Fetch token price in USD
 */
async function getTokenPriceUsd(mint: string): Promise<number> {
  const sourcesTried: string[] = [];
  let price = 0;
  let source = "";

  // Jupiter v3
  try {
    const res = await axios.get("https://lite-api.jup.ag/price/v3", {
      params: { ids: mint },
      headers: { Accept: "application/json" },
    });

    const entry = res.data?.[mint];
    if (entry?.usdPrice) {
      price = parseFloat(entry.usdPrice);
      source = "Jupiter v3";
    } else {
      sourcesTried.push("Jupiter v3 (no data)");
    }
  } catch {
    sourcesTried.push("Jupiter v3 (failed)");
  }

  // Moralis FDV fallback
  if (!price) {
    try {
      const moralisData = await fetchFromMoralis(mint);
      if (moralisData?.fullyDilutedValue && moralisData?.totalSupplyFormatted) {
        const fdv = Number(moralisData.fullyDilutedValue);
        const supply = Number(moralisData.totalSupplyFormatted);
        if (fdv > 0 && supply > 0) {
          price = fdv / supply;
          source = "Moralis FDV";
        } else {
          sourcesTried.push("Moralis FDV (invalid data)");
        }
      } else {
        sourcesTried.push("Moralis FDV (no data)");
      }
    } catch {
      sourcesTried.push("Moralis FDV (failed)");
    }
  }

  console.log(
    `[PRICE] ${mint} => $${price} (source: ${price ? source : "none"}${
      sourcesTried.length ? ", tried: " + sourcesTried.join(", ") : ""
    })`
  );

  return price;
}

/**
 * 🔹 Calculate token market cap
 */
export async function getMarketCap(
  mintAddress: string,
  connection: Connection
): Promise<number> {
  const [priceUsd, supply] = await Promise.all([
    getTokenPriceUsd(mintAddress),
    getTokenSupply(mintAddress, connection),
  ]);

  let mcap = 0;
  let source = "";

  if (priceUsd > 0 && supply > 0) {
    mcap = priceUsd * supply;
    source = "Calculated (price * supply)";
  } else {
    try {
      const moralisData = await fetchFromMoralis(mintAddress);
      if (moralisData?.fullyDilutedValue) {
        mcap = Number(moralisData.fullyDilutedValue);
        source = "Moralis FDV fallback";
      }
    } catch {}
  }

  console.log(
    `[MCAP] ${mintAddress} => $${mcap.toLocaleString()} (source: ${
      source || "none"
    })`
  );

  return mcap;
}
