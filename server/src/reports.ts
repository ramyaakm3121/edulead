import type { Response } from 'express';
import { prisma } from './auth.js';
import type { AuthRequest } from './auth.js';

function scope(req: AuthRequest) { return req.user!.role === 'COUNSELLOR' ? { assignedTo: req.user!.id } : {}; }
function send(res: Response, data: unknown) { return res.json({ success: true, data }); }

export async function sourcePerformance(req: AuthRequest, res: Response) {
  const where = scope(req);
  const [total, converted, bySource] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.lead.count({ where: { ...where, status: 'ENROLLED' } }),
    prisma.lead.groupBy({ by: ['sourceId'], where, _count: { _all: true } }),
  ]);
  const ids = bySource.map(x => x.sourceId).filter((x): x is number => x !== null);
  const names = await prisma.leadSource.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
  const convertedBySource = await prisma.lead.groupBy({ by: ['sourceId'], where: { ...where, status: 'ENROLLED' }, _count: { _all: true } });
  return send(res, { total, converted, overallConversionRate: total ? Number(((converted / total) * 100).toFixed(1)) : 0, rows: bySource.map(x => { const c = convertedBySource.find(y => y.sourceId === x.sourceId)?._count._all ?? 0; return { source: names.find(n => n.id === x.sourceId)?.name ?? 'Unknown', leads: x._count._all, enrolled: c, conversionRate: x._count._all ? Number(((c / x._count._all) * 100).toFixed(1)) : 0 }; }) });
}

export async function counsellorPerformance(req: AuthRequest, res: Response) {
  if (req.user!.role === 'COUNSELLOR') return send(res, []);
  const users = await prisma.user.findMany({ where: { role: 'COUNSELLOR', isActive: true }, select: { id: true, name: true } });
  const leads = await prisma.lead.groupBy({ by: ['assignedTo'], _count: { _all: true } });
  const converted = await prisma.lead.groupBy({ by: ['assignedTo'], where: { status: 'ENROLLED' }, _count: { _all: true } });
  const overdue = await prisma.followUp.groupBy({ by: ['assignedTo'], where: { status: 'PENDING', dueAt: { lt: new Date() } }, _count: { _all: true } });
  return send(res, users.map(u => { const l = leads.find(x => x.assignedTo === u.id)?._count._all ?? 0; const c = converted.find(x => x.assignedTo === u.id)?._count._all ?? 0; return { counsellor: u.name, leads: l, enrolled: c, conversionRate: l ? Number(((c / l) * 100).toFixed(1)) : 0, overdueFollowUps: overdue.find(x => x.assignedTo === u.id)?._count._all ?? 0 }; }));
}

export async function funnelReport(req: AuthRequest, res: Response) {
  const where = scope(req);
  const rows = await prisma.lead.groupBy({ by: ['status'], where, _count: { _all: true } });
  const total = rows.reduce((sum, r) => sum + r._count._all, 0);
  return send(res, { total, stages: rows.map(r => ({ status: r.status, count: r._count._all, percentage: total ? Number(((r._count._all / total) * 100).toFixed(1)) : 0 })) });
}

export async function ageingReport(req: AuthRequest, res: Response) {
  const active = ['NEW','CONTACT_ATTEMPTED','CONTACTED','QUALIFIED','COUNSELLING_SCHEDULED','COUNSELLING_COMPLETED','APPLICATION_STARTED','APPLICATION_SUBMITTED','OFFER_MADE','NURTURE'];
  const leads = await prisma.lead.findMany({ where: { ...scope(req), status: { in: active as any } }, select: { id: true, leadNumber: true, fullName: true, status: true, priority: true, createdAt: true, nextFollowUpAt: true, assignedTo: true }, orderBy: { createdAt: 'asc' } });
  const users = await prisma.user.findMany({ where: { id: { in: leads.map(l => l.assignedTo).filter((x): x is number => x !== null) } }, select: { id: true, name: true } });
  return send(res, leads.map(l => ({ ...l, ageDays: Math.floor((Date.now() - l.createdAt.getTime()) / 86400000), assignee: users.find(u => u.id === l.assignedTo)?.name ?? 'Unassigned', overdue: !!l.nextFollowUpAt && l.nextFollowUpAt < new Date() })));
}
