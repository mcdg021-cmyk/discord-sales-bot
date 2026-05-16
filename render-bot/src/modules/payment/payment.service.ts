import QRCode from 'qrcode';
import { createHash } from 'crypto';
import { OrderModel } from '../../models/Order.model';
import { PaymentModel } from '../../models/Payment.model';
import { GuildConfigModel } from '../../models/GuildConfig.model';
import { CartService } from '../cart/cart.service';
import { CouponModel } from '../../models/Coupon.model';
import { OrderStatus } from '../../shared/types';
import type { ICart, IPayment } from '../../shared/types';
import { logger } from '../../utils/logger';

// ── Geração de payload EMV Pix (padrão BACEN) ────────────────────────────────

function pixField(id: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return `${id}${len}${value}`;
}

function pixCRC16(payload: string): string {
  let crc = 0xffff;
  for (const char of payload) {
    crc ^= char.charCodeAt(0) << 8;
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
    }
  }
  return (crc & 0xffff).toString(16).toUpperCase().padStart(4, '0');
}

function generatePixPayload(params: {
  pixKey: string;
  pixKeyType: string;
  merchantName: string;
  merchantCity: string;
  amount: number;
  txId?: string;
}): string {
  const { pixKey, merchantName, merchantCity, amount, txId = '***' } = params;

  const merchantAccount = pixField('00', 'BR.GOV.BCB.PIX') + pixField('01', pixKey);

  const payload = [
    pixField('00', '01'),                           // Payload Format Indicator
    pixField('26', merchantAccount),               // Merchant Account Information
    pixField('52', '0000'),                         // MCC (não especificado)
    pixField('53', '986'),                          // Transaction Currency (BRL)
    pixField('54', amount.toFixed(2)),              // Transaction Amount
    pixField('58', 'BR'),                           // Country Code
    pixField('59', merchantName.substring(0, 25)), // Merchant Name
    pixField('60', merchantCity.substring(0, 15)), // Merchant City
    pixField('62', pixField('05', txId)),           // Additional Data Field (TxID)
    '6304',                                         // CRC placeholder
  ].join('');

  return payload + pixCRC16(payload);
}

// ── PaymentService ────────────────────────────────────────────────────────────

export class PaymentService {
  static async createFromCart(cart: ICart): Promise<{ order: any; payment: IPaymentDoc; qrCodeImage: string }> {
    if (cart.items.length === 0) throw new Error('Carrinho vazio.');

    const config = await GuildConfigModel.findOne({ guildId: cart.guildId });
    if (!config) throw new Error('Configuração do servidor não encontrada. Use /setup primeiro.');

    // Criar pedido
    const order = await OrderModel.create({
      guildId: cart.guildId,
      userId: cart.userId,
      items: cart.items,
      couponCode: cart.couponCode,
      discount: cart.discount,
      subtotal: cart.subtotal,
      total: cart.total,
      status: OrderStatus.AWAITING_PAYMENT,
    });

    // Expiração do pagamento
    const expiresAt = new Date(
      Date.now() + (config.paymentExpirationMinutes ?? 30) * 60 * 1000,
    );

    // Gerar TxID único (até 25 chars, alphanumerico)
    const txId = `ORD${order.id.toString().slice(-10).toUpperCase()}`;

    // Payload EMV/Pix
    const pixPayload = generatePixPayload({
      pixKey: config.pixKey,
      pixKeyType: config.pixKeyType,
      merchantName: config.pixMerchantName,
      merchantCity: config.pixCity,
      amount: cart.total,
      txId,
    });

    // QR Code em Base64
    const qrCodeBase64 = await QRCode.toDataURL(pixPayload, { errorCorrectionLevel: 'M', width: 300 });

    const payment = await PaymentModel.create({
      orderId: order._id,
      guildId: cart.guildId,
      userId: cart.userId,
      amount: cart.total,
      pixKey: config.pixKey,
      pixKeyType: config.pixKeyType,
      qrCode: pixPayload,
      qrCodeBase64,
      expiresAt,
    });

    order.paymentId = payment._id;
    await order.save();

    // Marcar cupom como usado
    if (cart.couponCode) {
      await CouponModel.updateOne(
        { guildId: cart.guildId, code: cart.couponCode },
        { $inc: { usedCount: 1 }, $addToSet: { usedBy: cart.userId } },
      );
    }

    // Limpar carrinho
    await CartService.clear(cart.guildId, cart.userId);

    logger.info('Pagamento Pix criado', { orderId: order.id, amount: cart.total });

    return { order, payment, qrCodeImage: qrCodeBase64 };
  }

  static async confirmPayment(paymentId: string): Promise<void> {
    const payment = await PaymentModel.findById(paymentId);
    if (!payment) throw new Error('Pagamento não encontrado.');

    payment.status = 'confirmed';
    payment.confirmedAt = new Date();
    await payment.save();

    await OrderModel.findByIdAndUpdate(payment.orderId, {
      status: OrderStatus.PAYMENT_RECEIVED,
    });

    logger.info('Pagamento confirmado', { paymentId, orderId: payment.orderId });
  }

  static async expireOldPayments(): Promise<number> {
    const result = await PaymentModel.updateMany(
      { status: 'pending', expiresAt: { $lte: new Date() } },
      { status: 'expired' },
    );

    if (result.modifiedCount > 0) {
      const expiredPayments = await PaymentModel.find({ status: 'expired', confirmedAt: null });
      const orderIds = expiredPayments.map((p) => p.orderId);
      await OrderModel.updateMany({ _id: { $in: orderIds } }, { status: OrderStatus.CANCELLED });
      logger.info(`${result.modifiedCount} pagamentos expirados processados`);
    }

    return result.modifiedCount;
  }
}

type IPaymentDoc = Awaited<ReturnType<typeof PaymentModel.prototype.save>>;
