import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder } from 'discord.js';

const commands = [
  new SlashCommandBuilder()
    .setName('loja')
    .setDescription('Veja os produtos disponíveis na loja'),
  new SlashCommandBuilder()
    .setName('carrinho')
    .setDescription('Veja seu carrinho de compras'),
  new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Abra um ticket de suporte'),
  new SlashCommandBuilder()
    .setName('pedidos')
    .setDescription('Veja seu histórico de pedidos'),
].map((cmd) => cmd.toJSON());

const rest = new REST().setToken(process.env.DISCORD_TOKEN!);

(async () => {
  try {
    console.log('🔄 Registrando comandos slash...');

    const guildId = process.env.DISCORD_GUILD_ID;

    if (guildId) {
      await rest.put(
        Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID!, guildId),
        { body: commands },
      );
      console.log(`✅ Comandos registrados na guild ${guildId}`);
    } else {
      await rest.put(
        Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!),
        { body: commands },
      );
      console.log('✅ Comandos registrados globalmente');
    }
  } catch (error) {
    console.error('❌ Erro ao registrar comandos:', error);
    process.exit(1);
  }
})();
