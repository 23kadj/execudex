export interface SubscriptionProduct {
  productId: string;
  price: string;
  currency: string;
  title: string;
  description: string;
  type: 'subs' | 'inapp';
}

export interface PurchaseResult {
  productId: string;
  transactionId: string;
  transactionDate: number;
  transactionReceipt: string;
  purchaseToken?: string;
}

export interface PurchaseError {
  code: string;
  message: string;
  userCancelled?: boolean;
}

export interface SubscriptionUpdateData {
  plan: 'basic' | 'plus';
  cycle: 'monthly' | 'quarterly';
  transactionId?: string;
  purchaseDate?: string;
}

export const SUBSCRIPTION_PRODUCTS = {
  PLUS_MONTHLY: 'execudex.plus.monthly',
  PLUS_QUARTERLY: 'execudex.plus.quarterly',
} as const;

export type SubscriptionProductId = typeof SUBSCRIPTION_PRODUCTS[keyof typeof SUBSCRIPTION_PRODUCTS];


