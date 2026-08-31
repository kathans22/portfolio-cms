import { Types, PipelineStage } from 'mongoose';
import { SubType } from './subType.model';
import { escapeRegex } from '../../utils/listQuery';
import { MainType } from '../mainTypes/mainType.model';
import { Resource } from '../resources/resource.model';
import { LIVE, ReferenceValidationError, ReferenceConflictError, CascadeRequiredError } from '../mainTypes/mainType.service';

/**
 * Section 2: a sub type's mainTypeId must reference an existing, non-deleted main type.
 * MongoDB has no foreign keys, so this is the only thing standing between the taxonomy
 * and a child pointing at nothing.
 */
export async function assertMainTypeExists(mainTypeId: string): Promise<void> {
  const parent = await MainType.findOne({ _id: mainTypeId, ...LIVE });
  if (!parent) {
    throw new ReferenceValidationError('That main type does not exist');
  }
}

/** Case-insensitive uniqueness *within one main type* — see mainType.service.ts. */
export async function assertNameIsFreeInParent(
  mainTypeId: string,
  name: string,
  excludeId?: string
): Promise<void> {
  const existing = await SubType.findOne({
    mainTypeId,
    name: new RegExp(`^${name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
    ...LIVE,
  });
  if (existing && String(existing._id) !== excludeId) {
    throw new ReferenceConflictError(`A sub type named "${existing.name}" already exists under this main type`);
  }
}

/** Section 2 cascade rule, same shape as the main type's — block first, cascade on ask. */
export async function softDeleteSubType(id: string, cascade: boolean): Promise<{ resources: number }> {
  const resources = await Resource.countDocuments({ subTypeId: id, ...LIVE });

  if (!cascade && resources > 0) {
    throw new CascadeRequiredError(
      `${resources} resource${resources === 1 ? '' : 's'} reference this sub type`,
      { resources }
    );
  }

  const deletedAt = new Date();
  if (cascade) {
    await Resource.updateMany({ subTypeId: id, ...LIVE }, { $set: { deletedAt } });
  }
  await SubType.updateOne({ _id: id, ...LIVE }, { $set: { deletedAt } });

  return { resources };
}

/**
 * Section 2: a child cannot be active under a deleted parent. Restoring a sub type whose
 * main type is still soft-deleted would produce a row that is live but unreachable —
 * every dropdown filters by its parent, so it would simply never appear, which reads as
 * the restore having silently failed.
 *
 * Cascade restore is deliberately out of scope: restore the parent first, then children.
 */
export async function restoreSubType(id: string) {
  const subType = await SubType.findById(id);
  if (!subType || !subType.deletedAt) return null;

  const parent = await MainType.findOne({ _id: subType.mainTypeId, ...LIVE });
  if (!parent) {
    throw new ReferenceValidationError(
      'Its main type is still deleted. Restore the main type first, then this sub type.'
    );
  }

  subType.deletedAt = null;
  await subType.save();
  return subType;
}

/** Sort keys a client may request. Never interpolate an arbitrary string into a sort. */
export const SUB_TYPE_SORT_FIELDS = ['name', 'mainTypeName', 'status', 'resourceCount', 'createdAt', 'updatedAt'] as const;

export interface SubTypeListOptions {
  mainTypeId?: string;
  search?: string;
  status?: string;
  includeDeleted: boolean;
  sort: Record<string, 1 | -1>;
  skip: number;
  limit: number;
}

/**
 * Lists sub types with their main type's name and their live resource count, both of
 * which are table columns and both of which are sortable — so they have to exist in the
 * pipeline before $sort, not be stitched on afterwards.
 */
export async function listSubTypes(options: SubTypeListOptions) {
  const match: Record<string, unknown> = options.includeDeleted ? {} : { ...LIVE };
  if (options.status) match.status = options.status;
  if (options.mainTypeId) match.mainTypeId = new Types.ObjectId(options.mainTypeId);

  const stages: PipelineStage[] = [
    { $match: match },
    { $lookup: { from: MainType.collection.name, localField: 'mainTypeId', foreignField: '_id', as: 'mainType' } },
    // Defensive: a sub type whose parent was hard-deleted still appears rather than
    // vanishing silently from the list.
    { $unwind: { path: '$mainType', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: Resource.collection.name,
        let: { subTypeId: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$subTypeId', '$$subTypeId'] }, deletedAt: null } },
          { $count: 'value' },
        ],
        as: 'resourceCounts',
      },
    },
    {
      $addFields: {
        mainTypeName: '$mainType.name',
        resourceCount: { $ifNull: [{ $first: '$resourceCounts.value' }, 0] },
      },
    },
  ];

  if (options.search) {
    const rx = new RegExp(escapeRegex(options.search), 'i');
    // Searching the parent's name too, for the same reason the resource listing does:
    // the name the admin remembers may live in the other collection.
    stages.push({ $match: { $or: [{ name: rx }, { description: rx }, { mainTypeName: rx }] } });
  }

  stages.push({
    $facet: {
      items: [
        { $sort: options.sort },
        { $skip: options.skip },
        { $limit: options.limit },
        {
          $project: {
            _id: 0,
            id: { $toString: '$_id' },
            mainTypeId: { $toString: '$mainTypeId' },
            name: 1, description: 1, status: 1, mainTypeName: 1, resourceCount: 1,
            deletedAt: 1, createdAt: 1, updatedAt: 1,
          },
        },
      ],
      meta: [{ $count: 'total' }],
    },
  });

  const [result] = await SubType.aggregate(stages);
  return { items: result?.items ?? [], total: result?.meta?.[0]?.total ?? 0 };
}
