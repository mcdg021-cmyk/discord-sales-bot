import { EmbedBuilder, APIEmbedField } from 'discord.js';
import { GuildConfigModel } from '../../models/GuildConfig.model';
import type { EmbedTheme, ICart, IOrder, IProduct } from '../../shared/types';

const DEFAULT_THEME: EmbedTheme = {
  primaryColor: 0x5865f2,
  successColor: 0x57f287,
  errorColor: 0xed4245,
  warningColor: 0xfee75c,
  footerText: 'Discord Sales Bot',
};

export class EmbedService {
  static async getTheme(guildId: string): Promise<EmbedTheme> {
    const config = await GuildConfigModel.findOne({ guildId });
    return config?.embedTheme ?? DEFAULT_THEME;
  }

  static base(theme: EmbedTheme, color: 'primary' | 'success' | 'error' | 'warning' = 'primary'): EmbedBuilder {
    const colorMap = {
      primary: theme.primaryColor,
      success: theme.successColor,
      error: theme.errorColor,
      warning: theme.warningColor,
    };

    return new EmbedBuilder()
      .setColor(colorMap[color])
      .setFooter({
        text: theme.footerText,
        iconURL: theme.footerIconUrl,
      })
      .setTimestamp();
  }

  static async shopEmbed(guildId: string, products: IProduct[]): Promise<EmbedBuilder> {
    const theme = await this.getTheme(guildId);
    const embed = this.base(theme);

    embed.setTitle('🛒 Loja');

    if (products.length === 0) {
      embed.setDescription('Nenhum produto disponível no momento.');
      return embed;
    }

    const fields: APIEmbedField[] = products.slice(0, 25).map((p) => ({
      name: `${p.featured ? '⭐ ' : ''}${p.name}`,
      value: [
        p.description.substring(0, 80),
        `💰 **R$ ${p.price.toFixed(2)}**`,
        p.stock.infinite ? '📦 Em estoque' : `📦 ${p.stock.quantity} disponíveis`,
      ].join('\n'),
      inline: true,
    }));

    embed.addFields(fields);
    if (theme.thumbnailUrl) embed.setThumbnail(theme.thumbnailUrl);
    if (theme.bannerUrl) embed.setImage(theme.bannerUrl);

    return embed;
  }

  static async cartEmbed(guildId: string, cart: ICart): Promise<EmbedBuilder> {
    const theme = await this.getTheme(guildId);
    const embed = this.base(theme);

    embed.setTitle('🛒 Seu Carrinho');

    if (cart.items.length === 0) {
      embed.setDescription('Carrinho vazio. Use `/comprar` para adicionar produtos.');
      return embed;
    }

    const itemLines = cart.items.map(
      (i) => `• **${i.name}** x${i.quantity} — R$ ${(i.price * i.quantity).toFixed(2)}`,
    );

    embed.setDescription(itemLines.join('\n'));
    embed.addFields(
      { name: 'Subtotal', value: `R$ ${cart.subtotal.toFixed(2)}`, inline: true },
      { name: 'Desconto', value: `R$ ${cart.discount.toFixed(2)}`, inline: true },
      { name: '**Total**', value: `**R$ ${cart.total.toFixed(2)}**`, inline: true },
    );

    if (cart.couponCode) {
      embed.addFields({ name: '🏷️ Cupom', value: `\`${cart.couponCode}\``, inline: true });
    }

    return embed;
  }

  static async paymentEmbed(
    guildId: string,
    order: IOrder,
    qrCodeBase64: string,
    pixPayload: string,
    expiresAt: Date,
  ): Promise<EmbedBuilder> {
    const theme = await this.getTheme(guildId);
    const embed = this.base(theme, 'warning');

    const expiresIn = Math.round((expiresAt.getTime() - Date.now()) / 60000);

    embed
      .setTitle('💳 Pagamento via Pix')
      .setDescription(
        [
          `**Valor:** R$ ${order.total.toFixed(2)}`,
          `**Expira em:** ${expiresIn} minutos`,
          '',
          '**Código Pix (copia e cola):**',
          `\`\`\`${pixPayload.substring(0, 200)}...\`\`\``,
          '',
          '📸 Após pagar, envie o **comprovante** neste canal para confirmar automaticamente.',
        ].join('\n'),
      )
      .setImage(qrCodeBase64);

    return embed;
  }

  static success(theme: EmbedTheme, title: string, description: string): EmbedBuilder {
    return this.base(theme, 'success').setTitle(`✅ ${title}`).setDescription(description);
  }

  static error(theme: EmbedTheme, title: string, description: string): EmbedBuilder {
    return this.base(theme, 'error').setTitle(`❌ ${title}`).setDescription(description);
  }

  static warning(theme: EmbedTheme, title: string, description: string): EmbedBuilder {
    return this.base(theme, 'warning').setTitle(`⚠️ ${title}`).setDescription(description);
  }
}
