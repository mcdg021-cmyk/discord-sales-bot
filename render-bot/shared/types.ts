// ─────────────────────────────────────────────────────────────────────────────
// SHARED TYPES — usados por bot, api e dashboard
// ─────────────────────────────────────────────────────────────────────────────

export type ID = string;

// ── Enums ────────────────────────────────────────────────────────────────────

export enum OrderStatus {
  PENDING = 'pending',
  AWAITING_PAYMENT = 'awaiting_payment',
  PAYMENT_RECEIVED = 'payment_received',
  PROCESSING = 'processing',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
  FRAUD = 'fraud',
}

export enum PaymentMethod {
  PIX = 'pix',
}

export enum ProductType {
  DIGITAL = 'digital',       // key/código/texto entregue no DM
  ACCOUNT = 'account',       // conta entregue no DM
  FILE = 'file',             // arquivo enviado no DM
  LINK = 'link',             // link enviado no DM
  MANUAL = 'manual',         // entrega manual pelo staff
}

export enum TicketStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  WAITING_CUSTOMER = 'waiting_customer',
  CLOSED = 'closed',
}

export enum CouponType {
  PERCENTAGE = 'percentage',
  FIXED = 'fixed',
}

export enum UserRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MOD = 'mod',
  SUPPORT = 'support',
  CUSTOMER = 'customer',
}

export enum LogType {
  PURCHASE = 'purchase',
  PAYMENT = 'payment',
  DELIVERY = 'delivery',
  TICKET = 'ticket',
  FRAUD = 'fraud',
  ADMIN = 'admin',
  ERROR = 'error',
}

// ── Interfaces de Negócio ─────────────────────────────────────────────────────

export interface IGuildConfig {
  guildId: string;
  pixKey: string;
  pixKeyType: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';
  pixMerchantName: string;
  pixCity: string;
  paymentExpirationMinutes: number;
  ticketCategoryId?: string;
  logChannelId?: string;
  supportRoleId?: string;
  adminRoleId?: string;
  embedTheme: EmbedTheme;
  currencySymbol: string;
  welcomeMessage?: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IProduct {
  id: ID;
  guildId: string;
  name: string;
  description: string;
  price: number;
  type: ProductType;
  stock: IStock;
  imageUrl?: string;
  thumbnailUrl?: string;
  active: boolean;
  featured: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface IStock {
  infinite: boolean;
  quantity: number;
  lowStockAlert: number;
  items: string[];   // conteúdo a entregar
}

export interface ICartItem {
  productId: ID;
  name: string;
  price: number;
  quantity: number;
}

export interface ICart {
  id: ID;
  guildId: string;
  userId: string;
  items: ICartItem[];
  couponCode?: string;
  discount: number;
  subtotal: number;
  total: number;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IOrder {
  id: ID;
  guildId: string;
  userId: string;
  items: ICartItem[];
  couponCode?: string;
  discount: number;
  subtotal: number;
  total: number;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentId?: ID;
  ticketId?: ID;
  deliveredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPayment {
  id: ID;
  orderId: ID;
  guildId: string;
  userId: string;
  amount: number;
  pixKey: string;
  pixKeyType: string;
  qrCode: string;
  qrCodeBase64?: string;
  status: 'pending' | 'confirmed' | 'expired' | 'fraud';
  proofImageHash?: string;
  proofImageUrl?: string;
  ocrData?: IOCRResult;
  expiresAt: Date;
  confirmedAt?: Date;
  createdAt: Date;
}

export interface IOCRResult {
  text: string;
  amount?: number;
  date?: string;
  time?: string;
  recipientName?: string;
  pixKey?: string;
  bank?: string;
  confidence: number;
  passed: boolean;
  failReasons: string[];
}

export interface ITicket {
  id: ID;
  guildId: string;
  userId: string;
  orderId?: ID;
  channelId: string;
  status: TicketStatus;
  subject: string;
  assignedTo?: string;
  transcriptUrl?: string;
  rating?: number;
  ratingText?: string;
  closedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICoupon {
  id: ID;
  guildId: string;
  code: string;
  type: CouponType;
  value: number;
  minOrderValue?: number;
  maxUses: number;
  usedCount: number;
  usedBy: string[];
  validFrom: Date;
  validUntil?: Date;
  active: boolean;
  createdAt: Date;
}

export interface IUser {
  id: ID;
  discordId: string;
  username: string;
  avatar?: string;
  email?: string;
  guilds: Array<{ guildId: string; role: UserRole }>;
  blacklisted: boolean;
  blacklistReason?: string;
  totalSpent: number;
  orderCount: number;
  cashback: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmbedTheme {
  primaryColor: number;   // hex int e.g. 0x5865F2
  successColor: number;
  errorColor: number;
  warningColor: number;
  footerText: string;
  footerIconUrl?: string;
  thumbnailUrl?: string;
  bannerUrl?: string;
}

// ── Analytics ─────────────────────────────────────────────────────────────────

export interface IAnalyticsSummary {
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
  conversionRate: number;
  topProducts: Array<{ productId: ID; name: string; quantity: number; revenue: number }>;
  revenueByDay: Array<{ date: string; revenue: number; orders: number }>;
  peakHours: Array<{ hour: number; count: number }>;
}

// ── Pagination ────────────────────────────────────────────────────────────────

export interface IPaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface IPaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ── API Response wrapper ──────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  pagination?: Omit<IPaginatedResult<unknown>, 'data'>;
}
