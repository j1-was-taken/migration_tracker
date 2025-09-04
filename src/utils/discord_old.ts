import { Client, TextChannel, NewsChannel, ThreadChannel } from "discord.js";
import { TokenAlert } from "../types.js";

export async function sendDiscordAlert(
  client: Client,
  channelId: string,
  token: TokenAlert
) {
  try {
    const channel = await client.channels.fetch(channelId);

    if (!channel?.isTextBased()) return;
    const textChannel = channel as TextChannel | NewsChannel | ThreadChannel;

    const numberFormatter = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    const topHoldersMessage =
      token.topHoldersPercentages && token.topHoldersPercentages.length
        ? token.topHoldersPercentages
            .map((p, i) => `\n     • ${i + 1}) ${p}`)
            .join("") + `\n     • Total: ${token.topHoldersTotalPercentage}`
        : "-";

    // Nicely formatted message
    const message = `
    🚨  🚨  🚨    **${token.launchPad} Migration**    🚨  🚨  🚨

    🚀 **${token.name}** ($${token.symbol})
    🔗 [DEXSCREENER](${token.link})
    🆔 Mint: \`${token.mint}\`

    ---

    💰 **Price**: $${token.priceUsd || "-"}

    💎 **FDV**: $${
      token.fdv ? numberFormatter.format(Number(token.fdv)) : "-"
    } | **MCap**: $${
      token.marketCap ? numberFormatter.format(Number(token.marketCap)) : "-"
    }

    💦 **Liquidity**: $${
      token.liquidity ? numberFormatter.format(Number(token.liquidity)) : "-"
    }

    📊 **Volume**:
         • 24H: $${
           token.vol24h ? numberFormatter.format(Number(token.vol24h)) : "-"
         }
         • 6H: $${
           token.vol6h ? numberFormatter.format(Number(token.vol6h)) : "-"
         }
         • 1H: $${
           token.vol1h ? numberFormatter.format(Number(token.vol1h)) : "-"
         }
         • 5M: $${
           token.vol5min ? numberFormatter.format(Number(token.vol5min)) : "-"
         }

    📈 **Price Change**:
         • 24H: ${token.priceChange24h || "-"}%
         • 6H: ${token.priceChange6h || "-"}%
         • 1H: ${token.priceChange1h || "-"}%
         • 5M: ${token.priceChange5min || "-"}%

    👥 **Buyers/Sellers**:
         • 24H: 🅑 ${token.buyers24hr || "-"} | Ⓢ ${token.sellers24hr || "-"}
         • 6H: 🅑 ${token.buyers6hr || "-"} | Ⓢ ${token.sellers6hr || "-"}
         • 1H: 🅑 ${token.buyers1hr || "-"} | Ⓢ ${token.sellers1hr || "-"}
         • 5M: 🅑 ${token.buyers5min || "-"} | Ⓢ ${token.sellers5min || "-"}

    💎 **Top Holders**: ${topHoldersMessage}

    📦 **Holders**: ${token.numHolders || "-"}
    ⏳ **Age**: ${token.age || "-"}

    ---

    🌍 **Links**:
            ${token.website ? `🌐 [Website](${token.website})` : ""}
            ${token.twitter ? `🐦 [Twitter](${token.twitter})` : ""}
            ${token.telegram ? `📢 [Telegram](${token.telegram})` : ""}
            ${token.discord ? `💬 [Discord](${token.discord})` : ""}
        `.trim();

    await textChannel.send(message);
  } catch (err) {
    console.error(`[Discord] Failed to send alert:`, err);
  }
}
