import { ButtonInteraction } from 'discord.js';
import type { BotClient } from '../client';
import { CartService } from '../modules/cart/cart.service';
import { PaymentService } from '../modules/payment/payment.service';
import { TicketService } from '../modules/ticket/ticket.service';
import { EmbedService } from '../modules/embed/embed.service';
import { DeliveryService } from '../modules/delivery/delivery.service';
import { OCRService } from '../modules/ocr/ocr.service';
import { PaymentModel } from '../models/Payment.model';
import { logger } from '../utils/logger';
import axios from 'axios';

export async function handleButtonInteraction(client: BotClient, interaction: ButtonInteraction): Promise<void> {
  const [namespace, action, ...params] = interaction.customId.split(':');

  // ── Shop / Cart ───────────────────────────────────────────────────────────
  if (namespace === 'shop') {
    if (action === 'view_cart') {
      await interaction.deferReply({ ephemeral: true });
      const cart = await CartService.getOrCreate(interaction.guildId!, interaction.user.id);
      const embed = await EmbedService.cartEmbed(interaction.guildId!, cart);
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (action === 'checkout') {
      await interaction.deferReply({ ephemeral: true });
      const cart = await CartService.getOrCreate(interaction.guildId!, interaction.user.id);
      if (cart.items.length === 0) {
        await interaction.editReply({ content: '❌ Carrinho vazio.' });
        return;
      }

      const { order, payment } = await PaymentService.createFromCart(cart);
      const theme = await EmbedService.getTheme(interaction.guildId!);
      const embed = await EmbedService.paymentEmbed(
        interaction.guildId!,
        order,
        payment.qrCodeBase64 ?? '',
        payment.qrCode,
        payment.expiresAt,
      );

      await interaction.editReply({
        content: `📋 Pedido criado! Envie o comprovante neste canal após pagar.`,
        embeds: [embed],
      });
      return;
    }

    if (action === 'remove_item') {
      const [productId] = params;
      await interaction.deferUpdate();
      const cart = await CartService.removeItem(interaction.guildId!, interaction.user.id, productId);
      const embed = await EmbedService.cartEmbed(interaction.guildId!, cart);
      await interaction.editReply({ embeds: [embed] });
      return;
    }
  }

  // ── Ticket ────────────────────────────────────────────────────────────────
  if (namespace === 'ticket') {
    if (action === 'close') {
      const [ticketId] = params;
      await interaction.deferReply({ ephemeral: true });
      await TicketService.close(client, ticketId, interaction.user.id);
      await interaction.editReply({ content: '✅ Ticket fechado com sucesso.' });
      return;
    }

    if (action === 'claim') {
      const [ticketId] = params;
      await TicketService.claim(ticketId, interaction.user.id);
      await interaction.reply({ content: `✋ <@${interaction.user.id}> assumiu este ticket.` });
      return;
    }

    if (action === 'rate') {
      const [ticketId, ratingStr] = params;
      const rating = parseInt(ratingStr, 10);
      await TicketService.rate(ticketId, rating);
      await interaction.update({
        content: `${'⭐'.repeat(rating)} Obrigado pela avaliação!`,
        components: [],
      });
      return;
    }
  }

  logger.warn('Botão não tratado', { customId: interaction.customId });
}
