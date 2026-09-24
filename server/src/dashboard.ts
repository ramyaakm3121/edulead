import type { Response } from 'express';
import { prisma } from './auth.js';
import type { AuthRequest } from './auth.js';

const activeStatuses = ['NEW','CONTACT_ATTEMPTED','CONTACTED','QUALIFIED','COUNSELLING_SCHEDULED','COUNSELLING_COMPLETED','APPLICATION_STARTED','APPLICATION_SUBMITTED','OFFER_MADE','NURTURE'] as const;

function scope(req: AuthRequest) { return req.user!.role === 'COUNSELLOR' ? { assignedTo: req.user!.id } : {}; }
function send(res: Response, data: unknown) { return res.json({ success: true, data }); }

export async function summary(req: AuthRequest, res: Response) {
  const now = new Date();
  const where: any = { ...scope(req) };
  const active = { ...where, status: { in: [...activeStatuses] } };
  const [total, newLeads, unassigned, overdue, noNextAction, enrolled, applications, highPriority] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.lead.count({ where: { ...where, status: 'NEW' } }),
    prisma.lead.count({ where: { ...active, assignedTo: null } }),
    prisma.lead.count({ where: { ...active, nextFollowUpAt: { lt: now } } }),
    prisma.lead.count({ where: { ...active, nextAction: null } }),
    prisma.lead.count({ where: { ...where, status: 'ENROLLED' } }),
    prisma.lead.count({ where: { ...where, status: { in: ['APPLICATION_STARTED','APPLICATION_SUBMITTED','OFFER_MADE'] } } }),
    prisma.lead.count({ where: { ...active, priority: 'HIGH' } }),
  ]);
  return send(res, { total, newLeads, unassigned, overdue, noNextAction, enrolled, applications, highPriority });
}

export async function funnel(req: AuthRequest, res: Response) {
  const where: any = scope(req);
  const grouped = await prisma.lead.groupBy({ by: ['status'], where, _count: { _all: true } });
  const order = [...activeStatuses, 'ENROLLED','LOST','DUPLICATE','INVALID'];
  return send(res, order.map(status => ({ status, count: grouped.find(x => x.status === status)?._count._all ?? 0 })));
}

export async function sources(req: AuthRequest, res: Response) {
  const rows = await prisma.lead.groupBy({ by: ['sourceId'], where: scope(req), _count: { _all: true } });
  const sourceIds = rows.map(r => r.sourceId).filter((id): id is number => id !== null);
  const sources = await prisma.leadSource.findMany({ where: { id: { in: sourceIds } }, select: { id: true, name: true } });
  const enrolled = await prisma.lead.groupBy({ by: ['sourceId'], where: { ...scope(req), status: 'ENROLLED' }, _count: { _all: true } });
  return send(res, rows.map(r => ({ sourceId: r.sourceId, source: sources.find(s => s.id === r.sourceId)?.name ?? 'Unknown', leads: r._count._all, enrolled: enrolled.find(e => e.sourceId === r.sourceId)?._count._all ?? 0 })));
}

export async function counsellors(req: AuthRequest, res: Response) {
  if (req.user!.role === 'COUNSELLOR') return send(res, []);
  const users = await prisma.user.findMany({ where: { role: 'COUNSELLOR', isActive: true }, select: { id: true, name: true } });
  const [leads, overdue, enrolled] = await Promise.all([
    prisma.lead.groupBy({ by: ['assignedTo'], _count: { _all: true } }),
    prisma.followUp.groupBy({ by: ['assignedTo'], where: { status: 'PENDING', dueAt: { lt: new Date() } }, _count: { _all: true } }),
    prisma.lead.groupBy({ by: ['assignedTo'], where: { status: 'ENROLLED' }, _count: { _all: true } }),
  ]);
  return send(res, users.map(u => ({ counsellor: u, leads: leads.find(x => x.assignedTo === u.id)?._count._all ?? 0, overdue: overdue.find(x => x.assignedTo === u.id)?._count._all ?? 0, enrolled: enrolled.find(x => x.assignedTo === u.id)?._count._all ?? 0 })));
}

export async function ageing(req: AuthRequest, res: Response) {
  const where: any = { ...scope(req), status: { in: [...activeStatuses] } };
  const leads = await prisma.lead.findMany({ where, select: { id: true, createdAt: true } });
  const now = Date.now();
  const buckets = { '0-2 days': 0, '3-7 days': 0, '8-14 days': 0, '15-30 days': 0, '31+ days': 0 };
  for (const lead of leads) {
    const days = (now - lead.createdAt.getTime()) / 86400000;
    if (days <= 2) buckets['0-2 days']++;
    else if (days <= 7) buckets['3-7 days']++;
    else if (days <= 14) buckets['8-14 days']++;
    else if (days <= 30) buckets['15-30 days']++;
    else buckets['31+ days']++;
  }
  return send(res, Object.entries(buckets).map(([bucket, count]) => ({ bucket, count })));
}
