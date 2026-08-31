import type { PipelineStage } from 'mongoose';
import { Skill } from './skill.model';
import { publicCertificationFilter } from '../certifications/certification.model';

interface AggregatedSkill {
  _id: unknown;
  certifications: {
    _id: unknown;
    expiryDate?: Date | null;
    neverExpires?: boolean;
    [key: string]: unknown;
  }[];
  [key: string]: unknown;
}

/**
 * Derives each skill's certifications in one aggregation rather than a query per skill.
 * The relation is stored only on Certification, so this is a reverse lookup: match
 * certifications whose skillIds contain this skill's _id.
 *
 * Shared between GET /skills?withCertifications=true and CMS SKILL_LIST sections, so a
 * certified badge renders identically whichever route produced the skill.
 */
export async function fetchSkillsWithCertifications(
  filter: Record<string, unknown>,
  options: { skip?: number; limit?: number; sort?: Record<string, 1 | -1> } = {}
) {
  const stages: PipelineStage[] = [{ $match: filter }, { $sort: options.sort ?? { order: 1 } }];

  if (options.skip) stages.push({ $skip: options.skip });
  if (options.limit) stages.push({ $limit: options.limit });

  // Aggregation bypasses Mongoose's schema defaults as well as its virtuals, so a
  // document written before a field existed comes back without it. Restate the
  // defaults here or the response quietly breaks its own type contract.
  stages.push({
    $addFields: {
      hideLevel: { $ifNull: ['$hideLevel', false] },
      level: { $ifNull: ['$level', 3] },
      order: { $ifNull: ['$order', 0] },
      domains: { $ifNull: ['$domains', []] },
    },
  });

  stages.push({
    $lookup: {
      from: 'certifications',
      let: { skillId: '$_id' },
      pipeline: [
        // Same visibility rule as the public certifications list, applied in the
        // database — an expired credential must not silently back a "Certified"
        // badge after it has dropped off the certifications page.
        { $match: { $expr: { $in: ['$$skillId', '$skillIds'] }, ...publicCertificationFilter() } },
        {
          $project: {
            name: 1, issuingOrganization: 1, issuerLogoUrl: 1,
            issueDate: 1, expiryDate: 1, neverExpires: 1, credentialUrl: 1,
          },
        },
        { $sort: { issueDate: -1 } },
      ],
      as: 'certifications',
    },
  });

  const results = (await Skill.aggregate(stages)) as AggregatedSkill[];
  return results.map(normalizeAggregatedSkill);
}

// Aggregation output bypasses Mongoose's toJSON transform and its virtuals, so the
// _id -> id mapping and isExpired both have to be applied by hand here. Doing it
// explicitly beats letting raw _id and a missing virtual leak to the client.
function normalizeAggregatedSkill(skill: AggregatedSkill) {
  const { _id, __v: _ignored, certifications, ...rest } = skill;
  void _ignored;
  return {
    ...rest,
    id: String(_id),
    certifications: (certifications ?? []).map((cert) => {
      const { _id: certId, ...certRest } = cert;
      const expiryDate = cert.expiryDate ?? null;
      return {
        ...certRest,
        id: String(certId),
        expiryDate,
        neverExpires: cert.neverExpires ?? false,
        isExpired: !cert.neverExpires && !!expiryDate && new Date(expiryDate).getTime() < Date.now(),
      };
    }),
  };
}
