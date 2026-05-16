import { Events, Interaction } from 'discord.js';
import type { BotEvent } from '../../types/handlers';
import type { BotClient } from '../../client';
import { logger } from '../../utils/logger';
import { handleButtonInteraction } from '../../middlewares/buttonHandler';
import { handleSelectInteraction } from '../../middlewares/selectHandler';
import { GuildConfigModel } from '../../models/GuildConfig.model';

const event: BotEvent = {
  name: Events.InteractionCreate,
  once: false,

  async execute(client: BotClient, interaction: Interaction) {
    // ── Slash Commands ────────────────────────────────────────────────────────
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;

      // Verificar se guild está ativa
      if (interaction.guildId) {
        const config = await GuildConfigModel.findOne({ guildId: interaction.guildId });
        if (config && !config.active && !command.adminOnly) {
          await interaction.reply({
            content: '❌ O bot está desativado neste servidor.',
            ephemeral: true,
          });
          return;
        }
      }

      // Cooldown
      if (command.cooldown) {
        if (!client.cooldowns.has(command.data.name)) {
          client.cooldowns.set(command.data.name, new Map());
        }
        const now = Date.now();
        const timestamps = client.cooldowns.get(command.data.name)!;
        const cooldownMs = command.cooldown * 1000;
        const userId = interaction.user.id;

        if (timestamps.has(userId)) {
          const expiry = timestamps.get(userId)! + cooldownMs;
          if (now < expiry) {
            const remaining = ((expiry - now) / 1000).toFixed(1);
            await interaction.reply({
              content: `⏳ Aguarde **${remaining}s** para usar este comando novamente.`,
              ephemeral: true,
            });
            return;
          }
        }
        timestamps.set(userId, now);
        setTimeout(() => timestamps.delete(userId), cooldownMs);
      }

      try {
        await command.execute(client, interaction);
      } catch (error) {
        logger.error('Erro ao executar comando', { command: interaction.commandName, error });
        const errorMsg = { content: '❌ Ocorreu um erro ao executar este comando.', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(errorMsg);
        } else {
          await interaction.reply(errorMsg);
        }
      }
    }

    // ── Buttons ───────────────────────────────────────────────────────────────
    if (interaction.isButton()) {
      try {
        await handleButtonInteraction(client, interaction);
      } catch (error) {
        logger.error('Erro em botão', { customId: interaction.customId, error });
        if (!interaction.replied) {
          await interaction.reply({ content: '❌ Erro ao processar ação.', ephemeral: true });
        }
      }
    }

    // ── Select Menus ──────────────────────────────────────────────────────────
    if (interaction.isStringSelectMenu()) {
      try {
        await handleSelectInteraction(client, interaction);
      } catch (error) {
        logger.error('Erro em select menu', { customId: interaction.customId, error });
        if (!interaction.replied) {
          await interaction.reply({ content: '❌ Erro ao processar seleção.', ephemeral: true });
        }
      }
    }
  },
};

export default event;
