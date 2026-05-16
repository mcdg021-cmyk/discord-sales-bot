import {
  Guild,
  ChannelType,
  PermissionFlagsBits,
  TextChannel,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { TicketModel } from '../../models/Ticket.model';
import { GuildConfigModel } from '../../models/GuildConfig.model';
import { TicketStatus } from '../../shared/types';
import { logger } from '../../utils/logger';
import type { BotClient } from '../../client';

export class TicketService {
  static async create(
    client: BotClient,
    guild: Guild,
    userId: string,
    subject: string,
    orderId?: string,
  ): Promise<TextChannel> {
    const config = await GuildConfigModel.findOne({ guildId: guild.id });

    // Verificar se usuário já tem ticket aberto
    const existing = await TicketModel.findOne({
      guildId: guild.id,
      userId,
      status: { $in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS] },
    });
    if (existing) {
      const existingChannel = guild.channels.cache.get(existing.channelId) as TextChannel;
      if (existingChannel) throw new Error(`Você já possui um ticket aberto: ${existingChannel.toString()}`);
    }

    // Criar canal privado
    const ticketCount = await TicketModel.countDocuments({ guildId: guild.id });
    const channelName = `ticket-${String(ticketCount + 1).padStart(4, '0')}`;

    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: config?.ticketCategoryId ?? undefined,
      permissionOverwrites: [
        {
          id: guild.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: userId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        },
        {
          id: client.user!.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        },
        // Dar acesso ao cargo de suporte se configurado
        ...(config?.supportRoleId
          ? [
              {
                id: config.supportRoleId,
                allow: [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.ReadMessageHistory,
                ],
              },
            ]
          : []),
      ],
    });

    // Criar registro no banco
    const ticket = await TicketModel.create({
      guildId: guild.id,
      userId,
      orderId,
      channelId: channel.id,
      subject,
      status: TicketStatus.OPEN,
    });

    // Enviar mensagem inicial no canal
    const theme = config?.embedTheme;
    const embed = new EmbedBuilder()
      .setColor(theme?.primaryColor ?? 0x5865f2)
      .setTitle(`🎫 Ticket #${String(ticketCount + 1).padStart(4, '0')}`)
      .setDescription(
        `Olá <@${userId}>! Seu ticket foi aberto.\n\n**Assunto:** ${subject}\n\nAguarde um atendente. Nossa equipe responderá em breve.`,
      )
      .setFooter({ text: theme?.footerText ?? 'Discord Sales Bot' })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`ticket:close:${ticket.id}`)
        .setLabel('Fechar Ticket')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🔒'),
      new ButtonBuilder()
        .setCustomId(`ticket:claim:${ticket.id}`)
        .setLabel('Assumir Ticket')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('✋'),
    );

    await channel.send({ embeds: [embed], components: [row] });

    logger.info('Ticket criado', { ticketId: ticket.id, guildId: guild.id, userId });
    return channel;
  }

  static async close(
    client: BotClient,
    ticketId: string,
    closedBy: string,
  ): Promise<void> {
    const ticket = await TicketModel.findById(ticketId);
    if (!ticket) throw new Error('Ticket não encontrado.');
    if (ticket.status === TicketStatus.CLOSED) throw new Error('Ticket já está fechado.');

    const guild = client.guilds.cache.get(ticket.guildId);
    if (!guild) return;

    const channel = guild.channels.cache.get(ticket.channelId) as TextChannel;

    // Gerar transcrição simples
    let transcriptText = `# Transcrição do Ticket ${ticket.id}\nFechado por: ${closedBy}\n\n`;
    if (channel) {
      const messages = await channel.messages.fetch({ limit: 100 });
      const sorted = [...messages.values()].reverse();
      for (const msg of sorted) {
        if (msg.author.bot) continue;
        transcriptText += `[${msg.createdAt.toISOString()}] ${msg.author.tag}: ${msg.content}\n`;
      }
    }

    ticket.status = TicketStatus.CLOSED;
    ticket.closedAt = new Date();
    await ticket.save();

    // Enviar embed de fechamento e deletar canal após 10s
    if (channel) {
      const embed = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle('🔒 Ticket Fechado')
        .setDescription(`Ticket fechado por <@${closedBy}>.\nEste canal será deletado em 10 segundos.`)
        .setTimestamp();

      await channel.send({ embeds: [embed] });
      setTimeout(() => channel.delete().catch(() => {}), 10_000);
    }

    // Enviar DM ao usuário com avaliação
    try {
      const user = await client.users.fetch(ticket.userId);
      const ratingRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        ...([1, 2, 3, 4, 5].map((n) =>
          new ButtonBuilder()
            .setCustomId(`ticket:rate:${ticket.id}:${n}`)
            .setLabel(`${'⭐'.repeat(n)}`)
            .setStyle(ButtonStyle.Secondary),
        )),
      );

      const dmEmbed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('Como foi seu atendimento?')
        .setDescription('Avalie seu atendimento de 1 a 5 estrelas:')
        .setTimestamp();

      await user.send({ embeds: [dmEmbed], components: [ratingRow] });
    } catch {
      // DMs desabilitadas — ignorar
    }

    logger.info('Ticket fechado', { ticketId, closedBy });
  }

  static async claim(ticketId: string, staffId: string): Promise<void> {
    await TicketModel.findByIdAndUpdate(ticketId, {
      assignedTo: staffId,
      status: TicketStatus.IN_PROGRESS,
    });
    logger.info('Ticket assumido', { ticketId, staffId });
  }

  static async rate(ticketId: string, rating: number, ratingText?: string): Promise<void> {
    await TicketModel.findByIdAndUpdate(ticketId, { rating, ratingText });
  }
}
