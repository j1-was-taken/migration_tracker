import { Connection } from "@solana/web3.js";

interface HolderInfo {
  owner: string;
  amount: number;
  percentage: number;
}

export async function findHolders(
  mint: string,
  connection: Connection
): Promise<{ totalHolders: string; topHolders: HolderInfo[] }> {
  let page = 1;
  let allAccounts: { owner: string; amount: number }[] = [];

  const url = process.env.SOLANA_HTTP_URL || "";
  if (!url) throw new Error("SOLANA_HTTP_URL not set in environment");

  while (true) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "getTokenAccounts",
        id: "helius-test",
        params: {
          page,
          limit: 1000,
          displayOptions: {},
          mint,
        },
      }),
    });

    if (!response.ok) {
      console.log(`Error: ${response.status}, ${response.statusText}`);
      break;
    }

    const data = await response.json();
    const tokenAccounts = data.result?.token_accounts;
    if (!tokenAccounts || tokenAccounts.length === 0) break;

    // Store owner and amount
    tokenAccounts.forEach((acc: any) => {
      allAccounts.push({
        owner: acc.owner,
        amount: Number(acc.amount),
      });
    });

    page++;
  }

  // Total unique holders
  const uniqueHolders = new Set(allAccounts.map((a) => a.owner));

  // Calculate total amount
  const totalAmount = allAccounts.reduce((sum, a) => sum + a.amount, 0);

  // Compute top holder percentages
  const holdersAggregated: Record<string, number> = {};
  allAccounts.forEach((a) => {
    holdersAggregated[a.owner] = (holdersAggregated[a.owner] || 0) + a.amount;
  });

  const topHolders: HolderInfo[] = Object.entries(holdersAggregated)
    .map(([owner, amount]) => ({
      owner,
      amount,
      percentage: (amount / totalAmount) * 100,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5); // top 10 holders

  return {
    totalHolders: uniqueHolders.size.toString(),
    topHolders,
  };
}
