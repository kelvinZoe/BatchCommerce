export type BatchWorkflowTransition =
  | 'orders_to_buying'
  | 'buying_to_arrivals'
  | 'arrivals_to_shipping'
  | 'shipping_to_deliveries';

export interface BatchWorkflowSnapshot {
  id: number;
  name: string;
  status: 'open' | 'closed';
  orderStatus: 'pending' | 'confirmed' | 'processing' | 'ready' | 'delivered' | 'cancelled';
  buyingStatus: 'pending' | 'ordered' | 'shipped' | 'arrived';
  deliveryStatus: 'not_sent' | 'pending' | 'in_progress' | 'completed';
  // Retained as a persisted stage marker for batch list visibility and legacy compatibility.
  arrivalsSent: boolean;
}

export interface BatchWorkflowTransitionRule {
  key: BatchWorkflowTransition;
  from: string;
  to: string;
  description: string;
}

export const CANONICAL_BATCH_WORKFLOW: BatchWorkflowTransitionRule[] = [
  {
    key: 'orders_to_buying',
    from: 'Orders',
    to: 'Buying List',
    description: 'Close an open order batch and aggregate its order items into purchasing rows.'
  },
  {
    key: 'buying_to_arrivals',
    from: 'Buying List',
    to: 'Arrivals',
    description: 'Move purchased buying-list rows into the receiving workflow.'
  },
  {
    key: 'arrivals_to_shipping',
    from: 'Arrivals',
    to: 'Shipping Queue',
    description: 'Move confirmed arrivals into shipping-fee rows and tracking records.'
  },
  {
    key: 'shipping_to_deliveries',
    from: 'Shipping Ledger',
    to: 'Deliveries',
    description: 'Create or reuse delivery rows once shipping fees are ready to move.'
  }
];

export function canRunBatchWorkflowTransition(
  batch: BatchWorkflowSnapshot,
  transition: BatchWorkflowTransition
): boolean {
  switch (transition) {
    case 'orders_to_buying':
      return batch.status === 'open';
    case 'buying_to_arrivals':
      return batch.status === 'closed';
    case 'arrivals_to_shipping':
      return batch.status === 'closed' && batch.arrivalsSent;
    case 'shipping_to_deliveries':
      return batch.status === 'closed';
    default:
      return false;
  }
}
