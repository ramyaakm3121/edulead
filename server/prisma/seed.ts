import { PrismaClient, Role, LeadStatus, Priority, ActivityType, FollowUpActionType, FollowUpStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('Password@123', 10);

  const users = [
    { name: 'System Admin', email: 'admin@edulead.local', role: Role.ADMIN },
    { name: 'Admissions Manager', email: 'manager@edulead.local', role: Role.MANAGER },
    { name: 'Ananya Sharma', email: 'ananya@edulead.local', role: Role.COUNSELLOR },
    { name: 'Rahul Verma', email: 'rahul@edulead.local', role: Role.COUNSELLOR },
    { name: 'Priya Nair', email: 'priya@edulead.local', role: Role.COUNSELLOR },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: { name: user.name, role: user.role, passwordHash, isActive: true },
      create: { ...user, passwordHash },
    });
  }

  const courses = [
    ['Bachelor of Business Administration', 'BBA'],
    ['Bachelor of Computer Applications', 'BCA'],
    ['Master of Computer Applications', 'MCA'],
    ['Master of Business Administration', 'MBA'],
  ];

  for (const [name, code] of courses) {
    await prisma.course.upsert({ where: { code }, update: { name, isActive: true }, create: { name, code } });
  }

  const sourceNames = ['Website', 'Walk-in', 'Phone', 'WhatsApp', 'Education Fair', 'Referral', 'Instagram', 'Facebook', 'Google', 'Other'];
  for (const name of sourceNames) {
    await prisma.leadSource.upsert({ where: { name }, update: { isActive: true }, create: { name } });
  }

  const counsellors = await prisma.user.findMany({ where: { role: Role.COUNSELLOR } });
  const courseRows = await prisma.course.findMany();
  const sourceRows = await prisma.leadSource.findMany();

  const sampleLeads = [
    ['Aarav Mehta', '9876543210', 'aarav@example.com', LeadStatus.NEW, Priority.HIGH],
    ['Diya Kapoor', '9876543211', 'diya@example.com', LeadStatus.CONTACTED, Priority.MEDIUM],
    ['Rohan Iyer', '9876543212', 'rohan@example.com', LeadStatus.QUALIFIED, Priority.HIGH],
    ['Sneha Rao', '9876543213', 'sneha@example.com', LeadStatus.COUNSELLING_SCHEDULED, Priority.HIGH],
    ['Karan Shah', '9876543214', 'karan@example.com', LeadStatus.APPLICATION_STARTED, Priority.HIGH],
    ['Meera Joshi', '9876543215', 'meera@example.com', LeadStatus.ENROLLED, Priority.MEDIUM],
    ['Vikram Singh', '9876543216', 'vikram@example.com', LeadStatus.LOST, Priority.LOW],
    ['Ishita Das', '9876543217', 'ishita@example.com', LeadStatus.NURTURE, Priority.MEDIUM],
    ['Nikhil Menon', '9876543218', 'nikhil@example.com', LeadStatus.NEW, Priority.MEDIUM],
    ['Pooja Bhat', '9876543219', 'pooja@example.com', LeadStatus.CONTACT_ATTEMPTED, Priority.HIGH],
  ] as const;

  for (let i = 0; i < sampleLeads.length; i++) {
    const [name, phone, email, status, priority] = sampleLeads[i];
    const leadNumber = `LD-${String(i + 1).padStart(5, '0')}`;
    const assigned = i === 0 ? null : counsellors[i % counsellors.length]?.id ?? null;
    const course = courseRows[i % courseRows.length];
    const source = sourceRows[i % sourceRows.length];
    const createdAt = new Date(Date.now() - (i + 1) * 24 * 60 * 60 * 1000);

    const lead = await prisma.lead.upsert({
      where: { leadNumber },
      update: { fullName: name, phone, email, status, priority, assignedTo: assigned, courseId: course.id, sourceId: source.id },
      create: {
        leadNumber, fullName: name, phone, email, city: ['Bengaluru', 'Mysuru', 'Chennai'][i % 3],
        courseId: course.id, preferredIntake: '2027', campus: 'Main Campus', qualification: 'Undergraduate',
        sourceId: source.id, campaignName: i % 2 === 0 ? 'Admissions 2027' : null,
        assignedTo: assigned, status, priority,
        nextAction: status === LeadStatus.ENROLLED || status === LeadStatus.LOST ? null : 'Follow up with student',
        nextFollowUpAt: status === LeadStatus.ENROLLED || status === LeadStatus.LOST ? null : new Date(Date.now() + (i - 2) * 60 * 60 * 1000),
        convertedAt: status === LeadStatus.ENROLLED ? new Date() : null,
        lostReason: status === LeadStatus.LOST ? 'Chose another institution' : null,
        createdAt,
      },
    });

    const existingActivity = await prisma.activity.findFirst({ where: { leadId: lead.id, activityType: ActivityType.LEAD_CREATED } });
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@edulead.local' } });
    if (!existingActivity) {
      await prisma.activity.create({
        data: { leadId: lead.id, activityType: ActivityType.LEAD_CREATED, description: `Lead ${lead.leadNumber} created from ${source.name}.`, createdBy: admin.id, createdAt },
      });
    }

    if (assigned) {
      const assignedActivity = await prisma.activity.findFirst({ where: { leadId: lead.id, activityType: ActivityType.ASSIGNED } });
      if (!assignedActivity) {
        await prisma.activity.create({ data: { leadId: lead.id, activityType: ActivityType.ASSIGNED, description: `Assigned to counsellor ${counsellors[i % counsellors.length].name}.`, createdBy: admin.id } });
      }
    }

    if (status !== LeadStatus.ENROLLED && status !== LeadStatus.LOST) {
      const followUp = await prisma.followUp.findFirst({ where: { leadId: lead.id } });
      if (!followUp && assigned) {
        await prisma.followUp.create({
          data: { leadId: lead.id, actionType: FollowUpActionType.CALL, dueAt: new Date(Date.now() + (i - 2) * 60 * 60 * 1000), notes: 'Initial admission follow-up', status: FollowUpStatus.PENDING, assignedTo: assigned, createdBy: admin.id },
        });
      }
    }
  }

  console.log('Seed completed. Demo password: Password@123');
}

main().catch((error) => { console.error(error); process.exit(1); }).finally(() => prisma.$disconnect());
