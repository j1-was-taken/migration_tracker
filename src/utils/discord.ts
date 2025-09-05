// src/utils/discord.ts (replace sendDiscordAlert)
import {
  Client,
  TextChannel,
  NewsChannel,
  ThreadChannel,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
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

    const embed = new EmbedBuilder()
      .setColor("#5865F2")
      .setTitle(`🚨 ${token.launchPad} Migration 🚨`)
      .addFields(
        {
          name: "🚀 Token",
          value: `**${token.name}** (${token.symbol})`,
          inline: true,
        },
        {
          name: "💎 Market Cap",
          value: token.marketCap
            ? `$${numberFormatter.format(Number(token.marketCap))}`
            : "-",
          inline: true,
        },
        { name: "Mint Address", value: `\`${token.mint}\``, inline: false }
      )
      .setTimestamp()
      .setFooter({
        text: "Crypto Migration Tracker",
        iconURL: client.user?.avatarURL() || undefined,
      });

    // IMPORTANT: encode the mint into the customId so global handler can read it
    // customId length max is ~100 characters; solana mint is ~44 so it's safe
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`copy_contract:${token.mint}`)
        .setLabel("📋 Copy Contract")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`delete_message`) // we will delete interaction.message in handler
        .setLabel("🗑️ Delete Message")
        .setStyle(ButtonStyle.Danger)
    );

    await textChannel.send({
      embeds: [embed],
      components: [row],
    });
  } catch (err) {
    console.error("[Discord] Failed to send alert:", err);
  }
}
