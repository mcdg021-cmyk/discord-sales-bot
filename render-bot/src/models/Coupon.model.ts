import { Schema, model, Document } from 'mongoose';
import { CouponType, UserRole } from '../shared/types';
import type { ICoupon, IUser } from '../shared/types';

// ── Coupon ────────────────────────────────────────────────────────────────────

export interface ICouponDoc extends Omit<ICoupon, 'id'>, Document {}

const CouponSchema = new Schema<ICouponDoc>(
  {
    guildId: { type: String, required: true, index: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    type: { type: String, enum: Object.values(CouponType), required: true },
    value: { type: Number, required: true, min: 0 },
    minOrderValue: { type: Number, min: 0 },
    maxUses: { type: Number, default: Infinity },
    usedCount: { type: Number, default: 0 },
    usedBy: [{ type: String }],
    validFrom: { type: Date, default: Date.now },
    validUntil: Date,
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

CouponSchema.index({ guildId: 1, code: 1 }, { unique: true });

export const CouponModel = model<ICouponDoc>('Coupon', CouponSchema);

// ── User ──────────────────────────────────────────────────────────────────────

export interface IUserDoc extends Omit<IUser, 'id'>, Document {}

const UserGuildRoleSchema = new Schema(
  {
    guildId: { type: String, required: true },
    role: { type: String, enum: Object.values(UserRole), default: UserRole.CUSTOMER },
  },
  { _id: false },
);

const UserSchema = new Schema<IUserDoc>(
  {
    discordId: { type: String, required: true, unique: true, index: true },
    username: { type: String, required: true },
    avatar: String,
    email: String,
    guilds: [UserGuildRoleSchema],
    blacklisted: { type: Boolean, default: false, index: true },
    blacklistReason: String,
    totalSpent: { type: Number, default: 0 },
    orderCount: { type: Number, default: 0 },
    cashback: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const UserModel = model<IUserDoc>('User', UserSchema);
