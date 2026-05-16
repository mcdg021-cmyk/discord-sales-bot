import { Schema, model, Document } from 'mongoose';
import { OrderStatus, PaymentMethod } from '../shared/types';
import type { IOrder } from '../shared/types';

export interface IOrderDoc extends Omit<IOrder, 'id'>, Document {}

const CartItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const OrderSchema = new Schema<IOrderDoc>(
  {
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    items: [CartItemSchema],
    couponCode: String,
    discount: { type: Number, default: 0 },
    subtotal: { type: Number, required: true },
    total: { type: Number, required: true },
    status: {
      type: String,
      enum: Object.values(OrderStatus),
      default: OrderStatus.PENDING,
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: Object.values(PaymentMethod),
      default: PaymentMethod.PIX,
    },
    paymentId: { type: Schema.Types.ObjectId, ref: 'Payment' },
    ticketId: { type: Schema.Types.ObjectId, ref: 'Ticket' },
    deliveredAt: Date,
  },
  { timestamps: true },
);

OrderSchema.index({ guildId: 1, userId: 1, createdAt: -1 });

export const OrderModel = model<IOrderDoc>('Order', OrderSchema);
