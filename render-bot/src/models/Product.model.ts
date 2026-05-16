import { Schema, model, Document } from 'mongoose';
import { ProductType } from '../shared/types';
import type { IProduct } from '../shared/types';

export interface IProductDoc extends Omit<IProduct, 'id'>, Document {}

const StockSchema = new Schema(
  {
    infinite: { type: Boolean, default: false },
    quantity: { type: Number, default: 0 },
    lowStockAlert: { type: Number, default: 5 },
    items: [{ type: String }],
  },
  { _id: false },
);

const ProductSchema = new Schema<IProductDoc>(
  {
    guildId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    type: { type: String, enum: Object.values(ProductType), default: ProductType.DIGITAL },
    stock: { type: StockSchema, default: () => ({}) },
    imageUrl: String,
    thumbnailUrl: String,
    active: { type: Boolean, default: true, index: true },
    featured: { type: Boolean, default: false },
    metadata: { type: Map, of: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

ProductSchema.index({ guildId: 1, active: 1 });

export const ProductModel = model<IProductDoc>('Product', ProductSchema);
