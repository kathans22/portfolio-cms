import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../../.env') });
dotenv.config();

import * as bcrypt from 'bcryptjs';
import { connectDB } from './config/db';
import { logger } from './utils/logger';
import { Admin } from './modules/auth/admin.model';
import { Skill } from './modules/skills/skill.model';
import { Project } from './modules/projects/project.model';
import { Certification } from './modules/certifications/certification.model';

const FORCE_FLAG = process.argv.includes('--force');

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME ?? 'Admin';

  if (!email || !password) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set in the environment to seed the admin account.');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await Admin.findOneAndUpdate(
    { email },
    { email, passwordHash, name },
    { upsert: true, returnDocument: 'after' }
  );
  logger.info({ email: admin.email }, 'Admin ready');
}

async function seedSkills() {
  const skills = [
    { name: 'React', category: 'Frontend', level: 5, order: 1, domains: ['SOFTWARE_DEVELOPMENT'] },
    { name: 'TypeScript', category: 'Frontend', level: 5, order: 2, domains: ['SOFTWARE_DEVELOPMENT'] },
    { name: 'Node.js', category: 'Backend', level: 4, order: 3, domains: ['SOFTWARE_DEVELOPMENT'] },
    { name: 'MongoDB', category: 'Backend', level: 4, order: 4, domains: ['SOFTWARE_DEVELOPMENT', 'DATA_ENGINEERING'] },
    { name: 'Python', category: 'ML/AI', level: 4, order: 5, domains: ['AI_ENGINEERING', 'DATA_ENGINEERING'] },
    { name: 'PyTorch', category: 'ML/AI', level: 3, order: 6, domains: ['AI_ENGINEERING'] },
    { name: 'Docker', category: 'Tools', level: 4, order: 7, domains: ['SOFTWARE_DEVELOPMENT', 'DATA_ENGINEERING'] },
    { name: 'Apache Spark', category: 'Data', level: 3, order: 8, domains: ['DATA_ENGINEERING'] },
  ];

  for (const skill of skills) {
    await Skill.findOneAndUpdate({ name: skill.name }, skill, { upsert: true });
  }
  logger.info({ count: skills.length }, 'Seeded skills');
}

async function seedProjects() {
  const projects = [
    {
      title: 'Aura CMS Platform',
      slug: 'aura-cms-platform',
      summary: 'A headless content management system with real-time editing and asset management.',
      description:
        'Aura CMS is built for developers who need speed and flexibility. It features block-based editing, custom roles, and webhooks for downstream integrations.',
      techStack: ['React', 'TypeScript', 'Node.js', 'MongoDB'],
      domains: ['SOFTWARE_DEVELOPMENT'],
      role: 'Full-stack developer',
      liveUrl: 'https://aura-cms.example.com',
      repoUrl: 'https://github.com/example/aura-cms',
      coverImageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=60',
      featured: true,
      order: 1,
      status: 'PUBLISHED',
    },
    {
      title: 'Apex E-Commerce Engine',
      slug: 'apex-ecommerce-engine',
      summary: 'A high-performance e-commerce platform with sub-100ms response times.',
      description:
        'Apex powers a full storefront with a global cart, offline sync, Stripe payments, and real-time stock counts delivered over WebSockets.',
      techStack: ['Next.js', 'Stripe', 'Node.js', 'Tailwind'],
      domains: ['SOFTWARE_DEVELOPMENT'],
      role: 'Backend engineer',
      liveUrl: 'https://apex-shop.example.com',
      repoUrl: 'https://github.com/example/apex-shop',
      coverImageUrl: 'https://images.unsplash.com/photo-1557821552-17105176677c?w=800&auto=format&fit=crop&q=60',
      featured: true,
      order: 2,
      status: 'PUBLISHED',
    },
    {
      title: 'Churn Prediction Pipeline',
      slug: 'churn-prediction-pipeline',
      summary: 'An end-to-end ML pipeline that scores customer churn risk from warehouse data.',
      description:
        'A scheduled pipeline that extracts events from a warehouse, engineers features in Spark, and serves churn probabilities through a PyTorch model behind a lightweight API.',
      techStack: ['Python', 'PyTorch', 'Apache Spark', 'Docker'],
      domains: ['AI_ENGINEERING', 'DATA_ENGINEERING'],
      role: 'ML engineer',
      repoUrl: 'https://github.com/example/churn-pipeline',
      coverImageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=60',
      featured: false,
      order: 3,
      status: 'PUBLISHED',
    },
  ];

  for (const project of projects) {
    await Project.findOneAndUpdate({ slug: project.slug }, project, { upsert: true });
  }
  logger.info({ count: projects.length }, 'Seeded projects');
}

// Certifications map to Skill documents by id, so this must run after seedSkills()
// and must resolve real ids — a free-text skill name here would map to nothing.
async function seedCertifications() {
  const byName = new Map((await Skill.find()).map((skill) => [skill.name, skill._id]));

  const certifications = [
    {
      name: 'AWS Certified Solutions Architect – Associate',
      issuingOrganization: 'Amazon Web Services',
      issueDate: new Date('2025-03-14'),
      expiryDate: new Date('2028-03-14'),
      neverExpires: false,
      credentialId: 'AWS-SAA-2025-0314',
      credentialUrl: 'https://aws.amazon.com/verification',
      description:
        'Validates designing distributed systems on AWS: compute, storage, networking, and cost-optimized, fault-tolerant architectures.',
      skillIds: [byName.get('Docker'), byName.get('Node.js')].filter(Boolean),
      domains: ['SOFTWARE_DEVELOPMENT'],
      featured: true,
      order: 1,
      status: 'PUBLISHED',
    },
    {
      name: 'TensorFlow Developer Certificate',
      issuingOrganization: 'Google',
      issueDate: new Date('2024-11-02'),
      neverExpires: true,
      credentialUrl: 'https://www.credential.net/verify',
      description:
        'Validates building and training neural networks in TensorFlow, including computer vision, NLP, and time-series models.',
      skillIds: [byName.get('Python'), byName.get('PyTorch')].filter(Boolean),
      domains: ['AI_ENGINEERING'],
      featured: true,
      order: 2,
      status: 'PUBLISHED',
    },
  ];

  for (const certification of certifications) {
    await Certification.findOneAndUpdate({ name: certification.name }, certification, { upsert: true });
  }

  // hideLevel demonstrates the "evidence beats assertion" rule: where a credential
  // backs a skill, the self-rating is suppressed rather than shown alongside it.
  await Skill.updateMany({ name: { $in: ['Python', 'Docker'] } }, { hideLevel: true });

  logger.info({ count: certifications.length }, 'Seeded certifications');
}

async function main() {
  if (process.env.NODE_ENV === 'production' && !FORCE_FLAG) {
    throw new Error('Refusing to seed a production database. Re-run with --force if this is intentional.');
  }

  await connectDB();
  await seedAdmin();
  await seedSkills();
  await seedProjects();
  await seedCertifications();
  logger.info('Database seeding complete');
  process.exit(0);
}

main().catch((err) => {
  logger.error({ err }, 'Seeding failed');
  process.exit(1);
});
