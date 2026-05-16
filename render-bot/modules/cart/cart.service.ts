import { getRedis } from '../../config/redis';
import { ProductModel } from '../../models/Product.model';
import { CouponModel } from '../../models/Coupon.model';
import { CouponType } from '../../shared/types';
import type { ICart, ICartItem } from '../../shared/types';
import { logger } from '../../utils/logger';

const CART_TTL_SECONDS = 60 * 60; // 1 hora
const CART_KEY = (guildId: string, userId: string) => `cart:${guildId}:${userId}`;

export class CartService {
  private static async getCart(guildId: string, userId: string): Promise<ICart | null> {
    const redis = getRedis();
    const data = await redis.get(CART_KEY(guildId, userId));
    return data ? (JSON.parse(data) as ICart) : null;
  }

  private static async saveCart(cart: ICart): Promise<void> {
    const redis = getRedis();
    await redis.setex(CART_KEY(cart.guildId, cart.userId), CART_TTL_SECONDS, JSON.stringify(cart));
  }

  static async getOrCreate(guildId: string, userId: string): Promise<ICart> {
    let cart = await this.getCart(guildId, userId);
    if (!cart) {
      cart = {
        id: `${guildId}:${userId}:${Date.now()}`,
        guildId,
        userId,
        items: [],
        discount: 0,
        subtotal: 0,
        total: 0,
        expiresAt: new Date(Date.now() + CART_TTL_SECONDS * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await this.saveCart(cart);
    }
    return cart;
  }

  static async addItem(guildId: string, userId: string, productId: string, quantity = 1): Promise<ICart> {
    const product = await ProductModel.findOne({ _id: productId, guildId, active: true });
    if (!product) throw new Error('Produto não encontrado ou inativo.');

    if (!product.stock.infinite && product.stock.quantity < quantity) {
      throw new Error(`Estoque insuficiente. Disponível: ${product.stock.quantity}`);
    }

    const cart = await this.getOrCreate(guildId, userId);
    const existingIndex = cart.items.findIndex((i) => i.productId === productId);

    if (existingIndex >= 0) {
      cart.items[existingIndex].quantity += quantity;
    } else {
      const item: ICartItem = {
        productId,
        name: product.name,
        price: product.price,
        quantity,
      };
      cart.items.push(item);
    }

    return this.recalculate(cart);
  }

  static async removeItem(guildId: string, userId: string, productId: string): Promise<ICart> {
    const cart = await this.getOrCreate(guildId, userId);
    cart.items = cart.items.filter((i) => i.productId !== productId);
    return this.recalculate(cart);
  }

  static async updateQuantity(guildId: string, userId: string, productId: string, quantity: number): Promise<ICart> {
    if (quantity <= 0) return this.removeItem(guildId, userId, productId);

    const cart = await this.getOrCreate(guildId, userId);
    const item = cart.items.find((i) => i.productId === productId);
    if (!item) throw new Error('Item não encontrado no carrinho.');

    item.quantity = quantity;
    return this.recalculate(cart);
  }

  static async applyCoupon(guildId: string, userId: string, code: string): Promise<ICart> {
    const cart = await this.getOrCreate(guildId, userId);
    if (cart.items.length === 0) throw new Error('Carrinho vazio.');

    const coupon = await CouponModel.findOne({ guildId, code: code.toUpperCase(), active: true });
    if (!coupon) throw new Error('Cupom inválido ou expirado.');
    if (coupon.usedBy.includes(userId)) throw new Error('Você já utilizou este cupom.');
    if (coupon.usedCount >= coupon.maxUses) throw new Error('Cupom esgotado.');
    if (coupon.validUntil && coupon.validUntil < new Date()) throw new Error('Cupom expirado.');
    if (coupon.minOrderValue && cart.subtotal < coupon.minOrderValue) {
      throw new Error(`Pedido mínimo de R$ ${coupon.minOrderValue.toFixed(2)} para este cupom.`);
    }

    cart.couponCode = code.toUpperCase();
    return this.recalculate(cart, coupon);
  }

  static async clear(guildId: string, userId: string): Promise<void> {
    const redis = getRedis();
    await redis.del(CART_KEY(guildId, userId));
  }

  private static async recalculate(cart: ICart, coupon?: any): Promise<ICart> {
    cart.subtotal = cart.items.reduce((sum, i) => sum + i.price * i.quantity, 0);

    if (cart.couponCode) {
      if (!coupon) {
        coupon = await CouponModel.findOne({ guildId: cart.guildId, code: cart.couponCode, active: true });
      }
      if (coupon) {
        cart.discount =
          coupon.type === CouponType.PERCENTAGE
            ? (cart.subtotal * coupon.value) / 100
            : Math.min(coupon.value, cart.subtotal);
      }
    } else {
      cart.discount = 0;
    }

    cart.total = Math.max(0, cart.subtotal - cart.discount);
    cart.updatedAt = new Date();
    await this.saveCart(cart);
    return cart;
  }
}
