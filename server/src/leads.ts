import { z } from 'zod';
import type { LeadStatus, Priority, Prisma } from '@prisma/client';
import { prisma } from './auth.js';
import type { AuthRequest } from './auth.js';
import type { Response } from 'express';

const statuses = ['NEW','CONTACT_ATTEMPTED','CONTACTED','QUALIFIED','COUNSELLING_SCHEDULED','COUNSELLING_COMPLETED','APPLICATION_STARTED','APPLICATION_SUBMITTED','OFFER_MADE','ENROLLED','NURTURE','LOST','DUPLICATE','INVALID'] as const;
const priorities = ['LOW','MEDIUM','HIGH'] as const;

const createSchema = z.object({
  fullName: z.string().trim().min(2).max(150),
  phone: z.string().trim().min(7).max(20),
  email: z.string().trim().email().max(255).optional().or(z.literal('')),
  city: z.string().trim().max(100).optional(),
  courseId: z.number().int().positive().nullable().optional(),
  preferredIntake: z.string().trim().max(50).optional(),
  campus: z.string().trim().max(100).optional(),
  qualification: z.string().trim().max(100).optional(),
  sourceId: z.number().int().positive().nullable().optional(),
  campaignName: z.string().trim().max(150).optional(),
  assignedTo: z.number().int().positive().nullable().optional(),
  status: z.enum(statuses).optional(),
  priority: z.enum(priorities).optional(),
  nextFollowUpAt: z.coerce.date().nullable().optional(),
  nextAction: z.string().trim().max(150).nullable().optional(),
});

const updateSchema = createSchema.partial().extend({
  lostReason: z.string().trim().max(255).nullable().optional(),
});

const listSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  status: z.enum(statuses).optional(),
  priority: z.enum(priorities).optional(),
  assignedTo: z.coerce.number().int().positive().optional(),
  courseId: z.coerce.number().int().positive().optional(),
  sourceId: z.coerce.number().int().positive().optional(),
  unassigned: z.enum(['true','false']).optional(),
  overdue: z.enum(['true','false']).optional(),
});

const publicLeadInclude = {
  course: { select: { id: true, name: true, code: true } },
  source: { select: { id: true, name: true } },
  assignee: { select: { id: true, name: true, email: true, role: true } },
} as const;

function error(res: Response, status: number, code: string, message: string, fields?: unknown) {
  return res.status(status).json({ success: false, error: { code, message, ...(fields ? { fields } : {}) } });
}

function canAccessLead(user: AuthRequest['user'], assignedTo: number | null) {
  return user?.role === 'ADMIN' || user?.role === 'MANAGER' || assignedTo === user?.id;
}

async function validateReferences(data: { courseId?: number | null; sourceId?: number | null; assignedTo?: number | null }) {
  if (data.courseId) {
    const course = await prisma.course.findUnique({ where: { id: data.courseId } });
    if (!course || !course.isActive) return 'INVALID_COURSE';
  }
  if (data.sourceId) {
    const source = await prisma.leadSource.findUnique({ where: { id: data.sourceId } });
    if (!source || !source.isActive) return 'INVALID_SOURCE';
  }
  if (data.assignedTo) {
    const user = await prisma.user.findUnique({ where: { id: data.assignedTo } });
    if (!user || !user.isActive || user.role === 'ADMIN') return 'INVALID_ASSIGNEE';
  }
  return null;
}

async function nextLeadNumber(tx: Prisma.TransactionClient) {
  const count = await tx.lead.count();
  return `LD-${String(count + 1).padStart(5, '0')}`;
}

export async function listLeads(req: AuthRequest, res: Response) {
  const parsed = listSchema.safeParse(req.query);
  if (!parsed.success) return error(res, 400, 'VALIDATION_ERROR', 'Invalid lead filters', parsed.error.flatten().fieldErrors);
  const q = parsed.data;
  const where: any = {};
  if (req.user?.role === 'COUNSELLOR') where.assignedTo = req.user.id;
  if (q.status) where.status = q.status;
  if (q.priority) where.priority = q.priority;
  if (q.assignedTo && req.user?.role !== 'COUNSELLOR') where.assignedTo = q.assignedTo;
  if (q.courseId) where.courseId = q.courseId;
  if (q.sourceId) where.sourceId = q.sourceId;
  if (q.unassigned === 'true') where.assignedTo = null;
  if (q.overdue === 'true') {
    where.nextFollowUpAt = { lt: new Date() };
    where.status = { notIn: ['ENROLLED','LOST','DUPLICATE','INVALID'] };
  }
  if (q.search) {
    where.OR = [
      { fullName: { contains: q.search } },
      { phone: { contains: q.search } },
      { email: { contains: q.search } },
      { leadNumber: { contains: q.search } },
    ];
  }
  const skip = (q.page - 1) * q.pageSize;
  const [items, total] = await Promise.all([
    prisma.lead.findMany({ where, include: publicLeadInclude, orderBy: { updatedAt: 'desc' }, skip, take: q.pageSize }),
    prisma.lead.count({ where }),
  ]);
  return res.json({ success: true, data: { items, pagination: { page: q.page, pageSize: q.pageSize, total, totalPages: Math.ceil(total / q.pageSize) } } });
}

export async function getLead(req: AuthRequest, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return error(res, 400, 'VALIDATION_ERROR', 'Invalid lead id');
  const lead = await prisma.lead.findUnique({ where: { id }, include: { ...publicLeadInclude, activities: { orderBy: { createdAt: 'desc' }, include: { creator: { select: { id: true, name: true, role: true } } } }, followUps: { orderBy: { dueAt: 'asc' }, include: { assignee: { select: { id: true, name: true } } } } } });
  if (!lead) return error(res, 404, 'NOT_FOUND', 'Lead not found');
  if (!canAccessLead(req.user, lead.assignedTo)) return error(res, 403, 'FORBIDDEN', 'You do not have access to this lead');
  return res.json({ success: true, data: lead });
}

export async function createLead(req: AuthRequest, res: Response) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return error(res, 400, 'VALIDATION_ERROR', 'Invalid lead data', parsed.error.flatten().fieldErrors);
  const data = parsed.data;
  const refError = await validateReferences(data);
  if (refError) return error(res, 400, refError, 'One or more referenced records are invalid or inactive');

  const duplicateWhere: any[] = [{ phone: data.phone }];
  if (data.email) duplicateWhere.push({ email: data.email });
  const duplicates = await prisma.lead.findMany({ where: { OR: duplicateWhere }, take: 5, select: { id: true, leadNumber: true, fullName: true, phone: true, email: true, status: true } });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const leadNumber = await nextLeadNumber(tx);
      const lead = await tx.lead.create({ data: { ...data, email: data.email || null, status: (data.status ?? 'NEW') as LeadStatus, priority: (data.priority ?? 'MEDIUM') as Priority, leadNumber }, include: publicLeadInclude });
      await tx.activity.create({ data: { leadId: lead.id, activityType: 'LEAD_CREATED', description: duplicates.length ? `Lead created with ${duplicates.length} possible duplicate(s) flagged.` : 'Lead created', createdBy: req.user!.id } });
      if (lead.assignedTo) await tx.activity.create({ data: { leadId: lead.id, activityType: 'ASSIGNED', description: 'Lead assigned during creation', createdBy: req.user!.id } });
      return lead;
    });
    return res.status(201).json({ success: true, data: { lead: result, possibleDuplicates: duplicates } });
  } catch (e) {
    console.error(e);
    return error(res, 500, 'INTERNAL_ERROR', 'Unable to create lead');
  }
}

export async function updateLead(req: AuthRequest, res: Response) {
  const id = Number(req.params.id);
  const parsed = updateSchema.safeParse(req.body);
  if (!Number.isInteger(id)) return error(res, 400, 'VALIDATION_ERROR', 'Invalid lead id');
  if (!parsed.success) return error(res, 400, 'VALIDATION_ERROR', 'Invalid lead data', parsed.error.flatten().fieldErrors);
  const existing = await prisma.lead.findUnique({ where: { id } });
  if (!existing) return error(res, 404, 'NOT_FOUND', 'Lead not found');
  if (!canAccessLead(req.user, existing.assignedTo)) return error(res, 403, 'FORBIDDEN', 'You do not have access to this lead');
  const data = parsed.data;
  if (req.user?.role === 'COUNSELLOR' && data.assignedTo !== undefined && data.assignedTo !== existing.assignedTo) return error(res, 403, 'FORBIDDEN', 'Counsellors cannot reassign leads');
  const refError = await validateReferences(data);
  if (refError) return error(res, 400, refError, 'One or more referenced records are invalid or inactive');
  if (data.status === 'LOST' && !(data.lostReason ?? existing.lostReason)?.trim()) return error(res, 400, 'LOST_REASON_REQUIRED', 'Lost reason is required when status is LOST');
  if (data.status === 'ENROLLED' && !existing.convertedAt) {
    (data as any).convertedAt = new Date();
  }

  const statusChanged = data.status && data.status !== existing.status;
  const assignmentChanged = data.assignedTo !== undefined && data.assignedTo !== existing.assignedTo;
  const result = await prisma.$transaction(async (tx) => {
    const lead = await tx.lead.update({ where: { id }, data: data as any, include: publicLeadInclude });
    if (assignmentChanged) await tx.activity.create({ data: { leadId: id, activityType: existing.assignedTo ? 'REASSIGNED' : 'ASSIGNED', description: `Assigned to user ${data.assignedTo ?? 'unassigned'}`, createdBy: req.user!.id } });
    if (statusChanged) await tx.activity.create({ data: { leadId: id, activityType: data.status === 'ENROLLED' ? 'CONVERTED' : data.status === 'LOST' ? 'LOST' : 'STATUS_CHANGED', oldStatus: existing.status, newStatus: data.status, description: `Status changed from ${existing.status} to ${data.status}`, createdBy: req.user!.id } });
    return lead;
  });
  return res.json({ success: true, data: result });
}

export async function assignLead(req: AuthRequest, res: Response) {
  const id = Number(req.params.id);
  const parsed = z.object({ assignedTo: z.number().int().positive().nullable() }).safeParse(req.body);
  if (!Number.isInteger(id) || !parsed.success) return error(res, 400, 'VALIDATION_ERROR', 'Invalid assignment data');
  if (!['ADMIN','MANAGER'].includes(req.user!.role)) return error(res, 403, 'FORBIDDEN', 'Only managers and admins can assign leads');
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) return error(res, 404, 'NOT_FOUND', 'Lead not found');
  const refError = await validateReferences({ assignedTo: parsed.data.assignedTo });
  if (refError) return error(res, 400, refError, 'Invalid assignee');
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.lead.update({ where: { id }, data: { assignedTo: parsed.data.assignedTo }, include: publicLeadInclude });
    await tx.activity.create({ data: { leadId: id, activityType: lead.assignedTo ? 'REASSIGNED' : 'ASSIGNED', description: parsed.data.assignedTo ? `Lead assigned to user ${parsed.data.assignedTo}` : 'Lead unassigned', createdBy: req.user!.id } });
    return result;
  });
  return res.json({ success: true, data: updated });
}

export async function changeStatus(req: AuthRequest, res: Response) {
  const id = Number(req.params.id);
  const parsed = z.object({ status: z.enum(statuses), lostReason: z.string().trim().max(255).optional(), nextAction: z.string().trim().max(150).nullable().optional(), nextFollowUpAt: z.coerce.date().nullable().optional() }).safeParse(req.body);
  if (!Number.isInteger(id) || !parsed.success) return error(res, 400, 'VALIDATION_ERROR', 'Invalid status data', parsed.success ? undefined : parsed.error.flatten().fieldErrors);
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) return error(res, 404, 'NOT_FOUND', 'Lead not found');
  if (!canAccessLead(req.user, lead.assignedTo)) return error(res, 403, 'FORBIDDEN', 'You do not have access to this lead');
  if (parsed.data.status === 'LOST' && !parsed.data.lostReason?.trim()) return error(res, 400, 'LOST_REASON_REQUIRED', 'Lost reason is required when marking a lead lost');
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.lead.update({ where: { id }, data: { status: parsed.data.status, lostReason: parsed.data.status === 'LOST' ? parsed.data.lostReason : null, nextAction: parsed.data.nextAction, nextFollowUpAt: parsed.data.nextFollowUpAt, convertedAt: parsed.data.status === 'ENROLLED' ? (lead.convertedAt ?? new Date()) : null }, include: publicLeadInclude });
    await tx.activity.create({ data: { leadId: id, activityType: parsed.data.status === 'ENROLLED' ? 'CONVERTED' : parsed.data.status === 'LOST' ? 'LOST' : 'STATUS_CHANGED', oldStatus: lead.status, newStatus: parsed.data.status, description: `Status changed from ${lead.status} to ${parsed.data.status}`, createdBy: req.user!.id } });
    return result;
  });
  return res.json({ success: true, data: updated });
}
