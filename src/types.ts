export interface TokenAlert {
  title: string;
  name: string;
  symbol: string;
  mint: string;
  marketCap: string;
  priceUsd: string;
  fdv: string;
  liquidity: string;
  vol24h: string;
  vol6h: string;
  vol1h: string;
  vol5min: string;
  priceChange24h: string;
  priceChange6h: string;
  priceChange1h: string;
  priceChange5min: string;
  buyers24hr: string;
  buyers6hr: string;
  buyers1hr: string;
  buyers5min: string;
  sellers24hr: string;
  sellers6hr: string;
  sellers1hr: string;
  sellers5min: string;
  age: string;
  numHolders: string;
  topHoldersPercentages: string[];
  topHoldersTotalPercentage: string;
  link: string;
  website?: string;
  twitter?: string;
  telegram?: string;
  discord?: string;
  launchPad?: string;
}

export interface Launchpad {
  name: string;
  fetchNewTokens: () => Promise<TokenAlert[]>;
}
