import axios from "axios";

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
      console.warn(`[NAME] No data returned for token ${mint}`);
      return { jupName: mint, jupSymbol: mint };
    }

    const token = data[0];
    if (!token.name || !token.symbol) {
      console.warn(`[NAME] Missing name or symbol for token ${mint}`);
      return { jupName: mint, jupSymbol: mint };
    }

    return { jupName: token.name, jupSymbol: token.symbol };
  } catch (err: any) {
    console.error(`[NAME] Request failed for ${mint}:`, err.message);
    return { jupName: mint, jupSymbol: mint };
  }
}

// ----------------------------
// Wrap top-level await in async function
// ----------------------------
(async () => {
  const { jupName, jupSymbol } = await fetchTokenNameFromJup(
    "B6EsaZS2WLny87sXWxwU3XzgCdcu4vkaxvvdPZ5Lpump"
  );

  console.log("Jupiter Name:", jupName, "Symbol:", jupSymbol);
})();
