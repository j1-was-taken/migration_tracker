import axios from "axios";

async function getTokenPriceUsd(mint: string): Promise<number> {
  try {
    const res = await axios.get("https://lite-api.jup.ag/price/v3", {
      params: { ids: mint },
      headers: { Accept: "application/json" },
    });

    console.log(
      `[DEBUG] Full Jupiter v3 response for ${mint}:`,
      JSON.stringify(res.data, null, 2)
    );

    const entry = res.data?.[mint];
    if (!entry) {
      console.warn(`[PRICE] No data for token ${mint} in response`);
      return 0;
    }

    const price = entry?.usdPrice ? parseFloat(entry.usdPrice) : 0;
    if (price > 0) {
      console.log(`[PRICE] Jupiter v3 price for ${mint}: $${price}`);
      return price;
    }

    console.warn(`[PRICE] Jupiter v3 returned no usdPrice field for ${mint}`);
  } catch (err: any) {
    console.error(
      `[PRICE] Jupiter v3 request failed for ${mint}: ${err.message}`
    );
  }

  return 0;
}

// Test token
getTokenPriceUsd("65ZUssMzaDEEVrD87rqG2tZNWZ5fX6mpsYn172Hbbonk").then(
  (price) => {
    console.log("Resolved Price:", price);
  }
);
