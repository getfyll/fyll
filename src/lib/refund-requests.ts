import type { Order, Refund, RefundRequest } from '@/lib/state/fyll-store';

export const isMoreInfoRequestedRefund = (request: Pick<RefundRequest, 'status' | 'rejectionReason'>) => {
  if (request.status !== 'draft') return false;
  const reason = request.rejectionReason?.trim().toLowerCase() ?? '';
  return reason.startsWith('more info');
};

export const formatRefundRequestStatusLabel = (request: Pick<RefundRequest, 'status' | 'rejectionReason'>) => {
  if (isMoreInfoRequestedRefund(request)) return 'More Info Needed';
  if (request.status === 'submitted') return 'Pending';
  if (request.status === 'approved') return 'Approved';
  if (request.status === 'rejected') return 'Rejected';
  if (request.status === 'paid') return 'Paid';
  if (request.status === 'void') return 'Void';
  return 'Draft';
};

export const inferRefundRequestType = (orderTotal: number, refundAmount: number): 'full' | 'partial' => {
  return refundAmount >= orderTotal ? 'full' : 'partial';
};

export const applyPaidRefundRequestToOrder = (
  order: Order,
  request: RefundRequest
): Pick<Order, 'refund' | 'status'> => {
  const previousAmount = Math.max(0, order.refund?.amount ?? 0);
  const nextAmount = previousAmount + Math.max(0, request.amount);
  const previousReason = order.refund?.reason?.trim() ?? '';
  const nextReason = request.reason.trim();
  const combinedReason = [previousReason, nextReason].filter(Boolean).join(previousReason && nextReason ? '\n\n' : '');

  const refund: Refund = {
    id: order.refund?.id ?? request.id,
    orderId: order.id,
    amount: nextAmount,
    date: request.paidAt ?? request.requestedDate,
    reason: combinedReason,
    proofImageUri: order.refund?.proofImageUri,
    createdAt: order.refund?.createdAt ?? new Date().toISOString(),
  };

  return {
    refund,
    status: nextAmount >= order.totalAmount ? 'Refunded' : 'Partial Refund',
  };
};

export const applyVoidedRefundRequestToOrder = (
  order: Order,
  request: Pick<RefundRequest, 'amount'>
): Pick<Order, 'refund' | 'status'> => {
  const previousAmount = Math.max(0, order.refund?.amount ?? 0);
  const nextAmount = Math.max(0, previousAmount - Math.max(0, request.amount));

  if (nextAmount <= 0) {
    const nextStatus = (order.status === 'Refunded' || order.status === 'Partial Refund')
      ? 'Completed'
      : order.status;
    return { refund: undefined, status: nextStatus };
  }

  const refund: Refund = {
    id: order.refund?.id ?? order.id,
    orderId: order.id,
    amount: nextAmount,
    date: order.refund?.date ?? new Date().toISOString(),
    reason: order.refund?.reason ?? '',
    proofImageUri: order.refund?.proofImageUri,
    createdAt: order.refund?.createdAt ?? new Date().toISOString(),
  };

  return {
    refund,
    status: nextAmount >= order.totalAmount ? 'Refunded' : 'Partial Refund',
  };
};
