import mongoose, { Schema, model, HydratedDocument } from 'mongoose';
import { withJsonId } from '../../config/mongooseSchemaOptions';
import { invalidatesResolveCache } from '../resolve/resolveCache';

const PROJECT_DOMAINS = ['SOFTWARE_DEVELOPMENT', 'AI_ENGINEERING', 'DATA_ENGINEERING'] as const;
type ProjectDomain = (typeof PROJECT_DOMAINS)[number];

export interface SkillAttrs {
  name: string;
  category: string;
  domains: ProjectDomain[];
  level: number;
  hideLevel: boolean;
  order: number;
}

// Deliberately no `certificationIds` here. The skill-to-certification relation is
// stored only on Certification and derived on read (see the skills route) — mirroring
// it on both sides guarantees drift the first time a certification is deleted.
const SkillSchema = new Schema<SkillAttrs>(
  {
    name: { type: String, required: true, unique: true },
    category: { type: String, required: true },
    domains: { type: [String], enum: PROJECT_DOMAINS, default: [] },
    level: { type: Number, default: 3, min: 1, max: 5 },
    hideLevel: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
  },
  withJsonId()
);

// Deleting a skill must clear it out of every certification that referenced it, or
// those certifications end up pointing at a ghost id. Resolved via mongoose.model()
// at call time rather than an import, to avoid a circular dependency between the two
// model files. findByIdAndDelete routes through findOneAndDelete, so this covers it.
// Async hooks rather than the callback form: Mongoose treats the returned promise as
// the completion signal, so the cascade is guaranteed to finish before the delete.
//
// Registered on all three query-level delete methods. Only findOneAndDelete is used
// today, but a later `Skill.deleteMany(...)` that skipped this would silently leave
// certifications pointing at ids that no longer exist.
async function pullSkillFromCertifications(skillIds: unknown[]) {
  if (skillIds.length === 0) return;
  await mongoose.model('Certification').updateMany(
    { skillIds: { $in: skillIds } },
    { $pull: { skillIds: { $in: skillIds } } }
  );
}

SkillSchema.pre('findOneAndDelete', async function () {
  const skill = await this.model.findOne(this.getFilter());
  if (skill) await pullSkillFromCertifications([skill._id]);
});

SkillSchema.pre('deleteOne', { document: false, query: true }, async function () {
  const skill = await this.model.findOne(this.getFilter());
  if (skill) await pullSkillFromCertifications([skill._id]);
});

SkillSchema.pre('deleteMany', async function () {
  const skills = await this.model.find(this.getFilter()).select('_id');
  await pullSkillFromCertifications(skills.map((skill) => skill._id));
});

// A write here can change what a cached CMS page renders, so the resolve cache is
// busted at the schema level rather than from each admin route — a route added later
// inherits invalidation instead of silently serving stale content.
invalidatesResolveCache(SkillSchema, 'Skill');

export const Skill = model<SkillAttrs>('Skill', SkillSchema);
export type SkillDoc = HydratedDocument<SkillAttrs>;
