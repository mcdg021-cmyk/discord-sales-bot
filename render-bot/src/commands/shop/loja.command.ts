import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} from 'discord.js';
import type { SlashCommand } from '../../types/handlers';
import type { BotClient } from '../../client';
import { CartService } from '../../modules/cart/cart.service';
import { EmbedService } from '../../modules/embed/embed.service';
import { ProductModel } from '../../models/Product.model';
import { GuildConfigModel } from '../../models/GuildConfig.model';

const shopCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('loja')
    .setDescription('Visualize os produtos disponíveis'),

  async execute(client: BotClient, interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const products = await ProductModel.find({
      guildId: interaction.guildId!,
      active: true,
    }).sort({ featured: -1, createdAt: -1 });

    const embed = await EmbedService.shopEmbed(interaction.guildId!, products);

    if (products.length === 0) {
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('shop:select_product')
      .setPlaceholder('Selecione um produto para adicionar ao carrinho')
      .addOptions(
        products.slice(0, 25).map((p) => ({
          label: p.name,
          description: `R$ ${p.price.toFixed(2)} | ${p.stock.infinite ? 'Em estoque' : `${p.stock.quantity} disponíveis`}`,
          value: p.id,
          emoji: p.featured ? '⭐' : '🛍️',
        })),
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    const cartRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('shop:view_cart')
        .setLabel('Ver Carrinho')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🛒'),
      new ButtonBuilder()
        .setCustomId('shop:checkout')
        .setLabel('Finalizar Compra')
        .setStyle(ButtonStyle.Success)
        .setEmoji('💳'),
    );

    await interaction.editReply({ embeds: [embed], components: [row, cartRow] });
  },
};

export default shopCommand;
