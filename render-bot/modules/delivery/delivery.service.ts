import { Client, EmbedBuilder } from 'discord.js';
import { ProductModel } from '../../models/Product.model';
import { OrderModel } from '../../models/Order.model';
import { OrderStatus, ProductType } from '../../shared/types';
import { logger } from '../../utils/logger';

export class DeliveryService {
  static async deliverOrder(client: Client, orderId: string): Promise<void> {
    const order = await OrderModel.findById(orderId).populate('items.productId');
    if (!order) throw new Error('Pedido não encontrado.');
    if (order.status !== OrderStatus.PAYMENT_RECEIVED) {
      throw new Error('Pedido não está com pagamento confirmado.');
    }

    const deliveryLines: string[] = [];
    let hasManual = false;

    for (const item of order.items) {
      const product = await ProductModel.findById(item.productId);
      if (!product) continue;

      if (product.type === ProductType.MANUAL) {
        hasManual = true;
        continue;
      }

      if (product.stock.infinite) {
        // Produto infinito — entrega o mesmo conteúdo sempre
        const content = product.metadata.get?.('content') as string | undefined;
        if (content) deliveryLines.push(`**${product.name}** (x${item.quantity}):\n\`\`\`\n${content}\n\`\`\``);
      } else {
        // Retirar itens do estoque
        const toDeliver = product.stock.items.splice(0, item.quantity);
        if (toDeliver.length < item.quantity) {
          logger.warn('Estoque insuficiente na entrega', { productId: product.id, needed: item.quantity });
        }
        await product.save();

        for (let i = 0; i < toDeliver.length; i++) {
          deliveryLines.push(`**${product.name}** #${i + 1}:\n\`\`\`\n${toDeliver[i]}\n\`\`\``);
        }
      }
    }

    // Enviar DM ao comprador
    try {
      const user = await client.users.fetch(order.userId);

      if (deliveryLines.length > 0) {
        const embed = new EmbedBuilder()
          .setColor(0x57f287)
          .setTitle('✅ Entrega Automática')
          .setDescription(
            `Seu pedido **#${order.id.toString().slice(-8).toUpperCase()}** foi entregue!\n\n` +
              deliveryLines.join('\n\n'),
          )
          .setFooter({ text: 'Guarde esta mensagem em local seguro.' })
          .setTimestamp();

        await user.send({ embeds: [embed] });
      }

      if (hasManual) {
        const embed = new EmbedBuilder()
          .setColor(0xfee75c)
          .setTitle('⏳ Entrega em Andamento')
          .setDescription('Um ou mais itens do seu pedido requerem entrega manual. Nossa equipe entrará em contato em breve.')
          .setTimestamp();
        await user.send({ embeds: [embed] });
      }
    } catch (err) {
      logger.warn('Não foi possível enviar DM de entrega', { userId: order.userId, err });
    }

    order.status = OrderStatus.DELIVERED;
    order.deliveredAt = new Date();
    await order.save();

    logger.info('Pedido entregue', { orderId, userId: order.userId });
  }

  static async addStock(productId: string, items: string[]): Promise<number> {
    const product = await ProductModel.findById(productId);
    if (!product) throw new Error('Produto não encontrado.');

    product.stock.items.push(...items);
    product.stock.quantity = product.stock.items.length;
    await product.save();

    logger.info('Estoque adicionado', { productId, added: items.length, total: product.stock.quantity });
    return product.stock.quantity;
  }

  static async checkLowStock(): Promise<void> {
    const products = await ProductModel.find({
      active: true,
      'stock.infinite': false,
      $expr: { $lte: ['$stock.quantity', '$stock.lowStockAlert'] },
    });

    for (const product of products) {
      logger.warn('Estoque baixo', {
        productId: product.id,
        name: product.name,
        quantity: product.stock.quantity,
        alert: product.stock.lowStockAlert,
      });
      // Aqui você pode adicionar notificação via Discord para o canal de logs
    }
  }
}
