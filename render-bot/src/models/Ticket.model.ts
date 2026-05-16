import { Schema, model, Document } from 'mongoose';
import { TicketStatus } from '../shared/types';
import type { ITicket } from '../shared/types';

export interface ITicketDoc extends Omit<ITicket, 'id'>, Document {}

const TicketSchema = new Schema<ITicketDoc>(
  {
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order' },
    channelId: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: Object.values(TicketStatus),
      default: TicketStatus.OPEN,
      index: true,
    },
    subject: { type: String, required: true },
    assignedTo: String,
    transcriptUrl: String,
    rating: { type: Number, min: 1, max: 5 },
    ratingText: String,
    closedAt: Date,
  },
  { timestamps: true },
);

TicketSchema.index({ guildId: 1, status: 1 });

export const TicketModel = model<ITicketDoc>('Ticket', TicketSchema);
