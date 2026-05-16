import { Schema, model, Document } from 'mongoose';
import type { IGuildConfig } from '../shared/types';

export interface IGuildConfigDoc extends Omit<IGuildConfig, 'id'>, Document {}

const EmbedThemeSchema = new Schema(
  {
    primaryColor: { type: Number, default: 0x5865f2 },
    successColor: { type: Number, default: 0x57f287 },
    errorColor: { type: Number, default: 0xed4245 },
    warningColor: { type: Number, default: 0xfee75c },
    footerText: { type: String, default: 'Discord Sales Bot' },
    footerIconUrl: String,
    thumbnailUrl: String,
    bannerUrl: String,
  },
  { _id: false },
);

const GuildConfigSchema = new Schema<IGuildConfigDoc>(
  {
    guildId: { type: String, required: true, unique: true, index: true },
    pixKey: { type: String, required: true },
    pixKeyType: {
      type: String,
      enum: ['cpf', 'cnpj', 'email', 'phone', 'random'],
      default: 'random',
    },
    pixMerchantName: { type: String, default: 'Minha Loja' },
    pixCity: { type: String, default: 'SAO PAULO' },
    paymentExpirationMinutes: { type: Number, default: 30 },
    ticketCategoryId: String,
    logChannelId: String,
    supportRoleId: String,
    adminRoleId: String,
    embedTheme: { type: EmbedThemeSchema, default: () => ({}) },
    currencySymbol: { type: String, default: 'R$' },
    welcomeMessage: String,
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const GuildConfigModel = model<IGuildConfigDoc>('GuildConfig', GuildConfigSchema);
