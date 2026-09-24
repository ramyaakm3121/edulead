import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { prisma, requireAuth, requireRoles, signToken, verifyPassword, type AuthRequest } from './auth.js';
import { listLeads, getLead, createLead, updateLead, assignLead, changeStatus } from './leads.js';
import { listActivities, createActivity } from './activities.js';
import { listMyFollowUps, listOverdueFollowUps, listLeadFollowUps, createFollowUp, updateFollowUp } from './followups.js';
import { summary, funnel, sources, counsellors, ageing } from './dashboard.js';
import { funnelReport, sourcePerformance, counsellorPerformance, ageingReport } from './reports.js';

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(cors({ origin: process.env.CLIENT_URL ?? 'http://localhost:5173' }));
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ success: true, data: { service: 'edulead-api', status: 'ok' } }));

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Email and password are required' } });
  const user = await prisma.user.findUnique({ where: { email: String(email).toLowerCase() } });
  if (!user || !user.isActive || !(await verifyPassword(String(password), user.passwordHash))) return res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
  const token = signToken(user);
  return res.json({ success: true, data: { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } } });
});

app.get('/api/auth/me', requireAuth, async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { id: true, name: true, email: true, role: true, isActive: true } });
  if (!user?.isActive) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'User is inactive' } });
  return res.json({ success: true, data: user });
});

app.get('/api/leads', requireAuth, listLeads);
app.post('/api/leads', requireAuth, createLead);
app.get('/api/leads/:id', requireAuth, getLead);
app.patch('/api/leads/:id', requireAuth, updateLead);
app.patch('/api/leads/:id/assign', requireAuth, assignLead);
app.patch('/api/leads/:id/status', requireAuth, changeStatus);

app.get('/api/leads/:id/activities', requireAuth, listActivities);
app.post('/api/leads/:id/activities', requireAuth, createActivity);

app.get('/api/followups/my', requireAuth, listMyFollowUps);
app.get('/api/followups/overdue', requireAuth, listOverdueFollowUps);
app.get('/api/leads/:id/followups', requireAuth, listLeadFollowUps);
app.post('/api/leads/:id/followups', requireAuth, createFollowUp);
app.patch('/api/followups/:id', requireAuth, updateFollowUp);

app.get('/api/dashboard/summary', requireAuth, summary);
app.get('/api/dashboard/funnel', requireAuth, funnel);
app.get('/api/dashboard/sources', requireAuth, sources);
app.get('/api/dashboard/counsellors', requireAuth, counsellors);
app.get('/api/dashboard/ageing', requireAuth, ageing);

app.get('/api/reports/funnel', requireAuth, funnelReport);
app.get('/api/reports/source-performance', requireAuth, sourcePerformance);
app.get('/api/reports/counsellor-performance', requireAuth, counsellorPerformance);
app.get('/api/reports/ageing', requireAuth, ageingReport);

app.get('/api/courses', requireAuth, async (_req, res) => { const courses = await prisma.course.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }); return res.json({ success: true, data: courses }); });
app.get('/api/sources', requireAuth, async (_req, res) => { const sources = await prisma.leadSource.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }); return res.json({ success: true, data: sources }); });

app.get('/api/users', requireAuth, requireRoles('ADMIN', 'MANAGER'), async (_req, res) => {
  const users = await prisma.user.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true } });
  return res.json({ success: true, data: users });
});

app.use((_req, res) => res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } }));

app.listen(port, () => console.log(`EduLead API running on http://localhost:${port}`));
