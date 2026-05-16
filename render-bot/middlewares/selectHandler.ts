import { StringSelectMenuInteraction } from 'discord.js';
import type { BotClient } from '../client';
import { CartService } from '../modules/cart/cart.service';
import { EmbedService } from '../modules/embed/embed.service';
import { logger } from '../utils/logger';

export async function handleSelectInteraction(
  client: BotClient,
  interaction: StringSelectMenuInteraction,
): Promise<void> {
  const [namespace, action] = interaction.customId.split(':');

  if (namespace === 'shop') {
    if (action === 'select_product') {
      await interaction.deferReply({ ephemeral: true });
      const productId = interaction.values[0];

      try {
        const cart = await CartService.addItem(interaction.guildId!, interaction.user.id, productId, 1);
        const embed = await EmbedService.cartEmbed(interaction.guildId!, cart);
        embed.setTitle('✅ Produto adicionado ao carrinho!');
        await interaction.editReply({ embeds: [embed] });
      } catch (err: any) {
        await interaction.editReply({ content: `❌ ${err.message}` });
      }
      return;
    }
  }

  logger.warn('Select menu não tratado', { customId: interaction.customId });
}
