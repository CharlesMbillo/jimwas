import {
  saveApprovalRequest,
  updateApprovalRequest,
  saveVoidRequest,
  updateVoidRequest,
  getVoidRequestByTransaction,
  getAllVoidRequests,
  getAllApprovalRequests,
  voidTransactionRecord,
  restoreStockForTransaction,
  insertAuditLog,
} from './db';
import type { Transaction, VoidRequest, ApprovalRequest, PosUser } from './types';

export async function requestVoidSale(
  transaction: Transaction,
  reason: string,
  requester: PosUser
): Promise<{ voidRequest: VoidRequest; approvalRequest: ApprovalRequest }> {
  const existing = await getVoidRequestByTransaction(transaction.id);
  if (existing && existing.status === 'pending') {
    throw new Error('A pending void request already exists for this transaction.');
  }
  if (transaction.status === 'voided') {
    throw new Error('This transaction has already been voided.');
  }

  const approval = await saveApprovalRequest({
    type: 'void',
    status: 'pending',
    requester_id: requester.id,
    requester_name: requester.name,
    requester_role: requester.role,
    approver_id: null,
    approver_name: null,
    notes: reason,
    rejection_reason: null,
    approved_at: null,
  });

  const voidReq = await saveVoidRequest({
    transaction_id: transaction.id,
    approval_request_id: approval.id,
    requester_id: requester.id,
    requester_name: requester.name,
    requester_role: requester.role,
    approver_id: null,
    approver_name: null,
    reason,
    status: 'pending',
    transaction_total: transaction.total_amount,
    transaction_payment_method: transaction.payment_method,
    approved_at: null,
    rejection_reason: null,
  });

  await insertAuditLog({
    action: 'void_requested',
    entity_type: 'transaction',
    entity_id: transaction.id,
    actor_id: requester.id,
    actor_name: requester.name,
    details: { reason, void_request_id: voidReq.id },
  });

  return { voidRequest: voidReq, approvalRequest: approval };
}

export async function approveRequest(
  approvalRequestId: string,
  approver: PosUser,
  notes?: string
): Promise<void> {
  const approvals = await getAllApprovalRequests();
  const approval = approvals.find((a) => a.id === approvalRequestId);
  if (!approval) throw new Error('Approval request not found');
  if (approval.status !== 'pending') throw new Error('Approval request is not pending');

  await updateApprovalRequest(approvalRequestId, {
    status: 'approved',
    approver_id: approver.id,
    approver_name: approver.name,
    approved_at: new Date().toISOString(),
    notes: notes ?? approval.notes,
  });

  if (approval.type === 'void') {
    await executeVoid(approvalRequestId, approver);
  }
}

export async function rejectRequest(
  approvalRequestId: string,
  approver: PosUser,
  rejectionReason: string
): Promise<void> {
  const approvals = await getAllApprovalRequests();
  const approval = approvals.find((a) => a.id === approvalRequestId);
  if (!approval) throw new Error('Approval request not found');
  if (approval.status !== 'pending') throw new Error('Approval request is not pending');

  await updateApprovalRequest(approvalRequestId, {
    status: 'rejected',
    approver_id: approver.id,
    approver_name: approver.name,
    rejection_reason: rejectionReason,
  });

  if (approval.type === 'void') {
    const voidRequests = await getAllVoidRequests();
    const vr = voidRequests.find((v) => v.approval_request_id === approvalRequestId);
    if (vr) {
      await updateVoidRequest(vr.id, {
        status: 'rejected',
        approver_id: approver.id,
        approver_name: approver.name,
        rejection_reason: rejectionReason,
      });
    }
  }

  await insertAuditLog({
    action: `${approval.type}_rejected`,
    entity_type: 'approval_request',
    entity_id: approvalRequestId,
    actor_id: approver.id,
    actor_name: approver.name,
    details: { rejection_reason: rejectionReason },
  });
}

async function executeVoid(approvalRequestId: string, approver: PosUser): Promise<void> {
  const voidRequests = await getAllVoidRequests();
  const vr = voidRequests.find((v) => v.approval_request_id === approvalRequestId);
  if (!vr) throw new Error('Void request not found for this approval');

  await voidTransactionRecord(vr.transaction_id);
  await restoreStockForTransaction(vr.transaction_id);
  await updateVoidRequest(vr.id, {
    status: 'completed',
    approver_id: approver.id,
    approver_name: approver.name,
    approved_at: new Date().toISOString(),
  });

  await insertAuditLog({
    action: 'void_executed',
    entity_type: 'transaction',
    entity_id: vr.transaction_id,
    actor_id: approver.id,
    actor_name: approver.name,
    details: { void_request_id: vr.id, reason: vr.reason },
  });
}
