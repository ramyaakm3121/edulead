import { z } from 'zod';
import type { Response } from 'express';
import { prisma } from './auth.js';
import type { AuthRequest } from './auth.js';

const actions = ['CALL','WHATSAPP','EMAIL','COUNSELLING','CAMPUS_VISIT','DOCUMENT_FOLLOW_UP','APPLICATION_FOLLOW_UP','PAYMENT_FOLLOW_UP','OTHER'] as const;
const statuses = ['PENDING','COMPLETED','CANCELLED'] as const;
const createSchema = z.object({ actionType: z.enum(actions), dueAt: z.coerce.date(), notes: z.string().trim().max(5000).nullable().optional(), assignedTo: z.number().int().positive().optional() });
const updateSchema = z.object({ status: z.enum(statuses).optional(), outcome: z.string().trim().max(255).nullable().optional(), notes: z.string().trim().max(5000).nullable().optional(), dueAt: z.coerce.date().optional() });

function error(res: Response, status: number, code: string, message: string, fields?: unknown) { return res.status(status).json({ success: false, error: { code, message, ...(fields ? { fields } : {}) } }); }
function canAccess(role: string, userId: number, assignedTo: number | null) { return role === 'ADMIN' || role === 'MANAGER' || assignedTo === userId; }

async function validateAssignee(id: number) {
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, isActive: true, role: true } });
  return user && user.isActive && user.role !== 'ADMIN';
}

export async function listMyFollowUps(req: AuthRequest, res: Response) {
  const items = await prisma.followUp.findMany({ where: { assignedTo: req.user!.id, status: 'PENDING' }, orderBy: { dueAt: 'asc' }, include: { lead: { select: { id: true, leadNumber: true, fullName: true, phone: true, status: true, priority: true, nextAction: true } } } });
  return res.json({ success: true, data: items });
}

export async function listOverdueFollowUps(req: AuthRequest, res: Response) {
  const where: any = { status: 'PENDING', dueAt: { lt: new Date() } };
  if (req.user!.role === 'COUNSELLOR') where.assignedTo = req.user!.id;
  const items = await prisma.followUp.findMany({ where, orderBy: { dueAt: 'asc' }, include: { lead: { select: { id: true, leadNumber: true, fullName: true, phone: true, status: true, priority: true, assignedTo: true, nextAction: true } }, assignee: { select: { id: true, name: true } } } });
  return res.json({ success: true, data: items });
}

export async function listLeadFollowUps(req: AuthRequest, res: Response) {
  const leadId = Number(req.params.id);
  if (!Number.isInteger(leadId)) return error(res, 400, 'VALIDATION_ERROR', 'Invalid lead id');
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { assignedTo: true } });
  if (!lead) return error(res, 404, 'NOT_FOUND', 'Lead not found');
  if (!canAccess(req.user!.role, req.user!.id, lead.assignedTo)) return error(res, 403, 'FORBIDDEN', 'You do not have access to this lead');
  const items = await prisma.followUp.findMany({ where: { leadId }, orderBy: { dueAt: 'asc' }, include: { assignee: { select: { id: true, name: true, email: true } }, creator: { select: { id: true, name: true } } } });
  return res.json({ success: true, data: items });
}

export async function createFollowUp(req: AuthRequest, res: Response) {
  const leadId = Number(req.params.id);
  const parsed = createSchema.safeParse(req.body);
  if (!Number.isInteger(leadId) || !parsed.success) return error(res, 400, 'VALIDATION_ERROR', 'Invalid follow-up data', parsed.success ? undefined : parsed.error.flatten().fieldErrors);
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true, assignedTo: true, status: true } });
  if (!lead) return error(res, 404, 'NOT_FOUND', 'Lead not found');
  if (!canAccess(req.user!.role, req.user!.id, lead.assignedTo)) return error(res, 403, 'FORBIDDEN', 'You do not have access to this lead');
  const assignedTo = parsed.data.assignedTo ?? lead.assignedTo ?? req.user!.id;
  if (!(await validateAssignee(assignedTo))) return error(res, 400, 'INVALID_ASSIGNEE', 'Follow-up assignee is invalid or inactive');
  if (['ENROLLED','LOST','DUPLICATE','INVALID'].includes(lead.status)) return error(res, 422, 'CLOSED_LEAD', 'Closed leads cannot receive new follow-ups');
  const result = await prisma.$transaction(async tx => {
    const followUp = await tx.followUp.create({ data: { leadId, actionType: parsed.data.actionType, dueAt: parsed.data.dueAt, notes: parsed.data.notes ?? null, assignedTo, createdBy: req.user!.id }, include: { assignee: { select: { id: true, name: true, email: true } } } });
    await tx.lead.update({ where: { id: leadId }, data: { nextFollowUpAt: parsed.data.dueAt, nextAction: parsed.data.actionType } });
    await tx.activity.create({ data: { leadId, activityType: 'FOLLOW_UP_CREATED', description: `Follow-up created: ${parsed.data.actionType} due ${parsed.data.dueAt.toISOString()}`, createdBy: req.user!.id } });
    return followUp;
  });
  return res.status(201).json({ success: true, data: result });
}

export async function updateFollowUp(req: AuthRequest, res: Response) {
  const id = Number(req.params.id);
  const parsed = updateSchema.safeParse(req.body);
  if (!Number.isInteger(id) || !parsed.success) return error(res, 400, 'VALIDATION_ERROR', 'Invalid follow-up update', parsed.success ? undefined : parsed.error.flatten().fieldErrors);
  const existing = await prisma.followUp.findUnique({ where: { id }, include: { lead: { select: { id: true, assignedTo: true, status: true } } } });
  if (!existing) return error(res, 404, 'NOT_FOUND', 'Follow-up not found');
  if (!canAccess(req.user!.role, req.user!.id, existing.assignedTo) && !canAccess(req.user!.role, req.user!.id, existing.lead.assignedTo)) return error(res, 403, 'FORBIDDEN', 'You do not have access to this follow-up');
  const nextStatus = parsed.data.status ?? existing.status;
  const completing = existing.status === 'PENDING' && nextStatus === 'COMPLETED';
  const result = await prisma.$transaction(async tx => {
    const followUp = await tx.followUp.update({ where: { id }, data: { ...parsed.data, completedAt: completing ? new Date() : parsed.data.status === 'PENDING' ? null : existing.completedAt }, include: { assignee: { select: { id: true, name: true } } } });
    if (completing) {
      const pendingNext = await tx.followUp.findFirst({ where: { leadId: existing.leadId, status: 'PENDING', id: { not: id } }, orderBy: { dueAt: 'asc' } });
      await tx.lead.update({ where: { id: existing.leadId }, data: { lastContactedAt: new Date(), nextFollowUpAt: pendingNext?.dueAt ?? null, nextAction: pendingNext ? pendingNext.actionType : null } });
      await tx.activity.create({ data: { leadId: existing.leadId, activityType: 'FOLLOW_UP_COMPLETED', description: `Follow-up completed: ${existing.actionType}${parsed.data.outcome ? ` — ${parsed.data.outcome}` : ''}`, createdBy: req.user!.id } });
    }
    return followUp;
  });
  return res.json({ success: true, data: result });
}
