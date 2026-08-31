import { Skill } from '../skills/skill.model';

// The Zod schema only proves each skillId is a well-formed ObjectId. That is not the
// same as it existing — a syntactically valid id for a deleted or never-created skill
// would persist as a dangling reference and quietly render no badge. Check existence
// on write and reject loudly instead.
export async function findMissingSkillIds(skillIds: string[]): Promise<string[]> {
  if (skillIds.length === 0) return [];

  const found = await Skill.find({ _id: { $in: skillIds } }).select('_id');
  const foundIds = new Set(found.map((skill) => skill.id as string));
  return skillIds.filter((id) => !foundIds.has(id));
}
