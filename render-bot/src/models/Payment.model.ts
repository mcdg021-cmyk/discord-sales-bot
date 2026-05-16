import { Schema, model, Document } from 'mongoose';
import type { IPayment } from '../shared/types';

export interface IPaymentDoc extends Omit<IPayment, 'id'>, Document {}

const OCRResultSchema = new Schema(
  {
    text: String,
    amount: Number,
    date: String,
    time: String,
    recipientName: String,
    pixKey: String,
    bank: String,
    confidence: Number,
    passed: Boolean,
    failReasons: [String],
  },
  { _id: false },
);

const PaymentSchema = new Schema<IPaymentDoc>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    amount: { type: Number, required: true },
    pixKey: { type: String, required: true },
    pixKeyType: { type: String, required: true },
    qrCode: { type: String, required: true },
    qrCodeBase64: String,
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'expired', 'fraud'],
      default: 'pending',
      index: true,
    },
    proofImageHash: { type: String, index: true },
    proofImageUrl: String,
    ocrData: OCRResultSchema,
    expiresAt: { type: Date, required: true, index: true },
    confirmedAt: Date,
  },
  { timestamps: true },
);

export const PaymentModel = model<IPaymentDoc>('Payment', PaymentSchema);
