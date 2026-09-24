import { z } from 'zod';
import type { Response } from 'express';
import { prisma } from './auth.js';
import type { AuthRequest } from './auth.js';

const activityTypes = ['CALL','WHATSAPP','EMAIL','NOTE'] as const;
const schema = z.object({
  activityType: z.enum(activityTypes),
  description: z.string().trim().min(1).max(5000),
});

function error(res: Response, status: number, code: string, message: string, fields?: unknown) {
  return res.status(status).json({ success: false, error: { code, message, ...(fields ? { fields } : {}) } });
}

function canAccess(role: string, userId: number, assignedTo: number | null) {
  return role === 'ADMIN' || role === 'MANAGER' || assignedTo === userId;
}

export async function listActivities(req: AuthRequest, res: Response) {
  const leadId = Number(req.params.id);
  if (!Number.isInteger(leadId)) return error(res, 400, 'VALIDATION_ERROR', 'Invalid lead id');
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true, assignedTo: true } });
  if (!lead) return error(res, 404, 'NOT_FOUND', 'Lead not found');
  if (!canAccess(req.user!.role, req.user!.id, lead.assignedTo)) return error(res, 403, 'FORBIDDEN', 'You do not have access to this lead');
  const items = await prisma.activity.findMany({
    where: { leadId }, orderBy: { createdAt: 'desc' },
    include: { creator: { select: { id: true, name: true, role: true } } },
  });
  return res.json({ success: true, data: items });
}

export async function createActivity(req: AuthRequest, res: Response) {
  const leadId = Number(req.params.id);
  const parsed = schema.safeParse(req.body);
  if (!Number.isInteger(leadId) || !parsed.success) return error(res, 400, 'VALIDATION_ERROR', 'Invalid activity data', parsed.success ? undefined : parsed.error.flatten().fieldErrors);
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true, assignedTo: true, status: true } });
  if (!lead) return error(res, 404, 'NOT_FOUND', 'Lead not found');
  if (!canAccess(req.user!.role, req.user!.id, lead.assignedTo)) return error(res, 403, 'FORBIDDEN', 'You do not have access to this lead');
  const now = new Date();
  const activity = await prisma.$transaction(async tx => {
    const created = await tx.activity.create({ data: { leadId, activityType: parsed.data.activityType, description: parsed.data.description, createdBy: req.user!.id }, include: { creator: { select: { id: true, name: true, role: true } } } });
    await tx.lead.update({ where: { id: leadId }, data: { lastContactedAt: now } });
    return created;
  });
  return res.status(201).json({ success: true, data: activity });
}
