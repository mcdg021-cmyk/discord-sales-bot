import { Events, Message, EmbedBuilder } from 'discord.js';
import type { BotEvent } from '../../types/handlers';
import type { BotClient } from '../../client';
import { OCRService } from '../../modules/ocr/ocr.service';
import { PaymentService } from '../../modules/payment/payment.service';
import { DeliveryService } from '../../modules/delivery/delivery.service';
import { TicketService } from '../../modules/ticket/ticket.service';
import { PaymentModel } from '../../models/Payment.model';
import { TicketModel } from '../../models/Ticket.model';
import { EmbedService } from '../../modules/embed/embed.service';
import { TicketStatus } from '../../shared/types';
import { logger } from '../../utils/logger';
import axios from 'axios';

const MAX_OCR_ATTEMPTS = Number(process.env.MAX_OCR_ATTEMPTS ?? 3);

const event: BotEvent = {
  name: Events.MessageCreate,
  once: false,

  async execute(client: BotClient, message: Message) {
    if (message.author.bot || !message.guild) return;

    // ── Verificar se é um canal de ticket ────────────────────────────────────
    const ticket = await TicketModel.findOne({
      guildId: message.guild.id,
      channelId: message.channel.id,
      status: { $in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS] },
    });
    if (!ticket) return;

    // ── Verificar se há imagem anexada (comprovante de pagamento) ────────────
    const imageAttachment = message.attachments.find((att) =>
      att.contentType?.startsWith('image/'),
    );
    if (!imageAttachment) return;

    // Buscar pagamento pendente para este usuário
    const payment = await PaymentModel.findOne({
      guildId: message.guild.id,
      userId: message.author.id,
      status: 'pending',
    }).sort({ createdAt: -1 });

    if (!payment) return;

    // Verificar tentativas de OCR
    const attemptKey = `ocr:attempts:${payment.id}`;
    // (em produção: usar Redis para contar tentativas)

    await message.react('⏳');

    try {
      // Baixar imagem
      const response = await axios.get<ArrayBuffer>(imageAttachment.url, {
        responseType: 'arraybuffer',
        timeout: 15_000,
      });
      const buffer = Buffer.from(response.data);

      // Verificar comprovante via OCR
      const result = await OCRService.verifyProof(
        buffer,
        payment.amount,
        payment.pixKey,
        payment.id,
      );

      const theme = await EmbedService.getTheme(message.guild.id);

      if (result.passed) {
        // ── Comprovante aprovado ─────────────────────────────────────────────
        await PaymentService.confirmPayment(payment.id);

        const successEmbed = EmbedService.success(
          theme,
          'Pagamento Confirmado!',
          [
            `✅ Comprovante aprovado com sucesso!`,
            `💰 Valor: **R$ ${payment.amount.toFixed(2)}**`,
            ``,
            `Seu pedido está sendo processado e será entregue em breve.`,
          ].join('\n'),
        );

        await message.reply({ embeds: [successEmbed] });
        await message.reactions.cache.get('⏳')?.remove();
        await message.react('✅');

        // Entrega automática
        try {
          await DeliveryService.deliverOrder(client, payment.orderId.toString());
        } catch (deliveryErr) {
          logger.error('Erro na entrega automática', { orderId: payment.orderId, deliveryErr });
        }

        // Fechar ticket automaticamente após entrega
        setTimeout(async () => {
          try {
            await TicketService.close(client, ticket.id, client.user!.id);
          } catch {}
        }, 5_000);

      } else {
        // ── Comprovante reprovado ────────────────────────────────────────────
        const reasons = result.failReasons.map((r) => `• ${r}`).join('\n');
        const errorEmbed = EmbedService.error(
          theme,
          'Comprovante não aprovado',
          [
            'Seu comprovante não passou na verificação:',
            '',
            reasons,
            '',
            'Por favor, envie um comprovante válido ou entre em contato com o suporte.',
          ].join('\n'),
        );

        await message.reply({ embeds: [errorEmbed] });
        await message.reactions.cache.get('⏳')?.remove();
        await message.react('❌');

        logger.warn('Comprovante reprovado', {
          paymentId: payment.id,
          userId: message.author.id,
          reasons: result.failReasons,
        });
      }
    } catch (err) {
      logger.error('Erro ao processar comprovante', { err });
      const theme = await EmbedService.getTheme(message.guild.id);
      const errorEmbed = EmbedService.error(
        theme,
        'Erro ao processar imagem',
        'Não foi possível analisar o comprovante. Tente novamente ou contate o suporte.',
      );
      await message.reply({ embeds: [errorEmbed] });
      await message.reactions.cache.get('⏳')?.remove();
    }
  },
};

export default event;
