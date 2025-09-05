// src/utils/interactionHandler.ts
import {
  Client,
  ButtonInteraction,
  PermissionsBitField,
  GuildMember,
  Interaction,
  MessageFlags,
} from "discord.js";

/**
 * Call this once after Client creation (before/after login is fine).
 * It installs a global interaction handler to handle all button presses.
 */
export function registerInteractionHandler(client: Client) {
  client.on("interactionCreate", async (interaction: Interaction) => {
    if (!interaction.isButton()) return;

    const btn = interaction as ButtonInteraction;

    try {
      // customId format examples:
      // copy_contract:<mint>
      // delete_message  (we will delete the message the button lives on)

      const [action, payload] = btn.customId.split(":", 2);

      // COPY CONTRACT
      if (action === "copy_contract") {
        const mint = payload ?? "";
        // Always reply (or defer) quickly
        if (!btn.replied && !btn.deferred) {
          await btn.reply({
            content: mint || "No contract provided",
            flags: MessageFlags.Ephemeral,
          });
        }
        return;
      }

      // DELETE MESSAGE
      if (action === "delete_message") {
        // Fetch guild member for robust permissions check
        let guildMember: GuildMember | null = null;
        if (btn.guild) {
          try {
            guildMember = await btn.guild.members.fetch(btn.user.id);
          } catch (err) {
            // ignore fetch error, guildMember stays null
            console.warn(
              "[InteractionHandler] failed to fetch guild member:",
              err
            );
          }
        }

        // Authorize: allow if the user has ManageMessages OR if they are the guild owner
        const isAuthorized =
          !!guildMember &&
          guildMember.permissions.has(PermissionsBitField.Flags.ManageMessages);

        if (!isAuthorized) {
          if (!btn.replied && !btn.deferred) {
            await btn.reply({
              content: "You do not have permission to delete this message ❌",
              flags: MessageFlags.Ephemeral,
            });
          }
          return;
        }

        // Acknowledge interaction quickly, then delete the message
        // Use deferUpdate() because we want to update nothing in the channel
        if (!btn.deferred) await btn.deferUpdate();

        // Delete the message that the button belongs to (the bot's message)
        try {
          await btn.message.delete();
        } catch (err) {
          console.error("[InteractionHandler] failed to delete message:", err);
          // inform user
          await btn.followUp({
            content: "Failed to delete message (missing permissions?) ❌",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        // Confirmation
        await btn.followUp({
          content: "Message deleted ✅",
          flags: MessageFlags.Ephemeral,
        });

        return;
      }

      // unknown action: just ignore or reply
    } catch (err) {
      console.error("[InteractionHandler] error handling button:", err);
      if (!btn.replied && !btn.deferred) {
        try {
          await btn.reply({
            content: "Something went wrong ❌",
            flags: MessageFlags.Ephemeral,
          });
        } catch (e) {
          // swallow
        }
      }
    }
  });
}
