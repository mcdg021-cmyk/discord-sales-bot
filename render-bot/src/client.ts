import {
  Client,
  GatewayIntentBits,
  Partials,
  Collection,
  REST,
  Routes,
} from 'discord.js';
import { readdirSync } from 'fs';
import { join } from 'path';
import { logger } from './utils/logger';
import type { SlashCommand, ButtonHandler, SelectHandler } from './types/handlers';

export class BotClient extends Client {
  public commands: Collection<string, SlashCommand> = new Collection();
  public buttons: Collection<string, ButtonHandler> = new Collection();
  public selects: Collection<string, SelectHandler> = new Collection();
  public cooldowns: Collection<string, Collection<string, number>> = new Collection();

  constructor() {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
      ],
      partials: [Partials.Channel, Partials.Message, Partials.GuildMember],
    });
  }

  async initialize(): Promise<void> {
    await this.loadCommands();
    await this.loadEvents();
    await this.login(process.env.DISCORD_TOKEN!);
    logger.info('✅ Bot iniciado e logado com sucesso');
  }

  private async loadCommands(): Promise<void> {
    const commandsPath = join(__dirname, 'commands');
    const categories = readdirSync(commandsPath);

    for (const category of categories) {
      const categoryPath = join(commandsPath, category);
      const files = readdirSync(categoryPath).filter((f) => f.endsWith('.ts') || f.endsWith('.js'));

      for (const file of files) {
        const { default: command } = await import(join(categoryPath, file));
        if (command?.data && command?.execute) {
          this.commands.set(command.data.name, command);
          logger.debug(`Comando carregado: ${command.data.name}`);
        }
      }
    }

    logger.info(`✅ ${this.commands.size} comandos carregados`);
  }

  private async loadEvents(): Promise<void> {
    const eventsPath = join(__dirname, 'events');
    const categories = readdirSync(eventsPath);

    for (const category of categories) {
      const categoryPath = join(eventsPath, category);
      const files = readdirSync(categoryPath).filter((f) => f.endsWith('.ts') || f.endsWith('.js'));

      for (const file of files) {
        const { default: event } = await import(join(categoryPath, file));
        if (event?.name && event?.execute) {
          if (event.once) {
            this.once(event.name, (...args) => event.execute(this, ...args));
          } else {
            this.on(event.name, (...args) => event.execute(this, ...args));
          }
          logger.debug(`Evento carregado: ${event.name}`);
        }
      }
    }

    logger.info(`✅ Eventos carregados`);
  }

  async deployCommands(guildId?: string): Promise<void> {
    const rest = new REST().setToken(process.env.DISCORD_TOKEN!);
    const commandData = this.commands.map((cmd) => cmd.data.toJSON());

    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID!, guildId), {
        body: commandData,
      });
      logger.info(`✅ Comandos registrados na guild ${guildId}`);
    } else {
      await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!), {
        body: commandData,
      });
      logger.info('✅ Comandos registrados globalmente');
    }
  }
}
