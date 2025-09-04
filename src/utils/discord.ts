import {
  Client,
  TextChannel,
  NewsChannel,
  ThreadChannel,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
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

    // 🔹 Create a clean embed with emojis
    const embed = new EmbedBuilder()
      .setColor("#5865F2") // Discord blurple
      .setTitle(`  🚨   ${token.launchPad} Migration   🚨`)
      .addFields(
        {
          name: "🚀 Token",
          value: `**${token.name}** (${token.symbol})`,
          inline: true,
        },
        {
          name: "💎 Market Cap",
          value: `${
            token.marketCap
              ? numberFormatter.format(Number(token.marketCap))
              : "-"
          }`,
          inline: true,
        },
        {
          name: "Mint Address",
          value: `\`${token.mint}\``,
          inline: false,
        }
      )
      .setTimestamp()
      .setFooter({
        text: "Crypto Migration Tracker",
        iconURL: client.user?.avatarURL() || undefined,
      });

    // 🔹 Buttons row: Copy + Delete
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("copy_contract")
        .setLabel("📋 Copy Contract")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("delete_message")
        .setLabel("🗑️ Delete Message")
        .setStyle(ButtonStyle.Danger)
    );

    // 🔹 Send embed with buttons
    const sentMessage = await textChannel.send({
      embeds: [embed],
      components: [row],
    });

    // 🔹 Collector for interactions
    const collector = sentMessage.createMessageComponentCollector({
      time: 10 * 60 * 1000,
    });

    collector.on("collect", async (interaction) => {
      if (interaction.customId === "copy_contract") {
        await interaction.reply({
          content: `${token.mint}`,
          ephemeral: true,
        });
      }

      if (interaction.customId === "delete_message") {
        const member = interaction.member;
        if (
          "permissions" in member &&
          member.permissions.has(PermissionsBitField.Flags.ManageMessages)
        ) {
          // ✅ Acknowledge interaction immediately
          await interaction.deferUpdate(); // prevents "This interaction failed"

          // Delete the message
          await sentMessage.delete();

          // Optional: send ephemeral confirmation
          await interaction.followUp({
            content: "Message deleted ✅",
            ephemeral: true,
          });
        } else {
          await interaction.reply({
            content: "You do not have permission to delete this message ❌",
            ephemeral: true,
          });
        }
      }
    });
  } catch (err) {
    console.error(`[Discord] Failed to send alert:`, err);
  }
}
