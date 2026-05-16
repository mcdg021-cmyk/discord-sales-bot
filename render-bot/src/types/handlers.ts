import type {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ButtonInteraction,
  StringSelectMenuInteraction,
  PermissionResolvable,
} from 'discord.js';
import type { BotClient } from '../client';

export interface SlashCommand {
  data: SlashCommandBuilder | Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>;
  cooldown?: number;
  permissions?: PermissionResolvable[];
  adminOnly?: boolean;
  execute(client: BotClient, interaction: ChatInputCommandInteraction): Promise<void>;
}

export interface ButtonHandler {
  customId: string | RegExp;
  execute(client: BotClient, interaction: ButtonInteraction): Promise<void>;
}

export interface SelectHandler {
  customId: string | RegExp;
  execute(client: BotClient, interaction: StringSelectMenuInteraction): Promise<void>;
}

export interface BotEvent {
  name: string;
  once?: boolean;
  execute(client: BotClient, ...args: unknown[]): Promise<void>;
}
