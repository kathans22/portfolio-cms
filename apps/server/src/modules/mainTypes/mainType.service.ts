import { MainType } from './mainType.model';
import { escapeRegex } from '../../utils/listQuery';
import { SubType } from '../subTypes/subType.model';
import { Resource } from '../resources/resource.model';

/** Soft-delete filter, matching the convention used by the pages module. */
export const LIVE = { deletedAt: null } as const;

/** Only these are offered in dropdowns — Section 2's selectability rule. */
export const SELECTABLE = { deletedAt: null, status: 'ACTIVE' } as const;

export class ReferenceValidationError extends Error {}

/**
 * A duplicate name specifically, which is a conflict rather than a malformed request.
 *
 * Separate from ReferenceValidationError so it maps to 409 — the same status the partial
 * unique index produces when it catches the duplicate first. Without this the response
 * code would depend on which layer noticed, so an identical mistake could return 400 or
 * 409 depending on timing.
 */
export class ReferenceConflictError extends Error {}

/** Raised when a delete would orphan children; carries the counts for the 409 body. */
export class CascadeRequiredError extends Error {
  constructor(
    message: string,
    readonly counts: { subTypes?: number; resources: number }
  ) {
    super(message);
  }
}

/**
 * Case-insensitive uniqueness is enforced here rather than through an index collation.
 * Section 1.1 says to pick one and be consistent: a collation on the index would oblige
 * every query that relies on it to carry the same collation, and one that forgets
 * silently stops using the index. Normalizing at the single write path is easier to keep
 * honest. The partial unique index remains as the backstop against races.
 */
export async function assertNameIsFree(name: string, excludeId?: string): Promise<void> {
  const existing = await MainType.findOne({
    name: new RegExp(`^${name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
    ...LIVE,
  });
  if (existing && String(existing._id) !== excludeId) {
    throw new ReferenceConflictError(`A main type named "${existing.name}" already exists`);
  }
}

/**
 * Section 2 cascade rule. Blocking is the default because a main type can sit above a
 * lot of bookmarks, and silently removing content the admin did not name is the one
 * mistake a soft delete cannot make obvious.
 *
 * With cascade, every affected document is stamped with the *same* deletedAt instant, so
 * the set that went down together is identifiable later — a restore has no other way to
 * tell which children it should be looking at.
 */
export async function softDeleteMainType(id: string, cascade: boolean): Promise<{ subTypes: number; resources: number }> {
  const subTypes = await SubType.countDocuments({ mainTypeId: id, ...LIVE });
  const resources = await Resource.countDocuments({ mainTypeId: id, ...LIVE });

  if (!cascade && (subTypes > 0 || resources > 0)) {
    throw new CascadeRequiredError(
      `${describe(subTypes, 'sub type')} and ${describe(resources, 'resource')} reference this main type`,
      { subTypes, resources }
    );
  }

  const deletedAt = new Date();
  if (cascade) {
    await Promise.all([
      SubType.updateMany({ mainTypeId: id, ...LIVE }, { $set: { deletedAt } }),
      Resource.updateMany({ mainTypeId: id, ...LIVE }, { $set: { deletedAt } }),
    ]);
  }
  await MainType.updateOne({ _id: id, ...LIVE }, { $set: { deletedAt } });

  return { subTypes, resources };
}

function describe(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

/** Sort keys a client may request. Never interpolate an arbitrary string into a sort. */
export const MAIN_TYPE_SORT_FIELDS = ['name', 'status', 'subTypeCount', 'createdAt', 'updatedAt'] as const;

export interface MainTypeListOptions {
  search?: string;
  status?: string;
  includeDeleted: boolean;
  sort: Record<string, 1 | -1>;
  skip: number;
  limit: number;
}

/**
 * Lists main types with the sub type count the table column needs. An aggregation rather
 * than find() + N counts: the count is also a sortable column, which a per-row query
 * could not support.
 */
export async function listMainTypes(options: MainTypeListOptions) {
  const match: Record<string, unknown> = options.includeDeleted ? {} : { ...LIVE };
  if (options.status) match.status = options.status;
  if (options.search) {
    const rx = new RegExp(escapeRegex(options.search), 'i');
    match.$or = [{ name: rx }, { description: rx }];
  }

  const [result] = await MainType.aggregate([
    { $match: match },
    {
      $lookup: {
        from: SubType.collection.name,
        let: { mainTypeId: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$mainTypeId', '$$mainTypeId'] }, deletedAt: null } },
          { $count: 'value' },
        ],
        as: 'subTypeCounts',
      },
    },
    { $addFields: { subTypeCount: { $ifNull: [{ $first: '$subTypeCounts.value' }, 0] } } },
    {
      $facet: {
        items: [
          { $sort: options.sort },
          { $skip: options.skip },
          { $limit: options.limit },
          {
            $project: {
              _id: 0,
              id: { $toString: '$_id' },
              name: 1, description: 1, status: 1, subTypeCount: 1,
              deletedAt: 1, createdAt: 1, updatedAt: 1,
            },
          },
        ],
        meta: [{ $count: 'total' }],
      },
    },
  ]);

  return { items: result?.items ?? [], total: result?.meta?.[0]?.total ?? 0 };
}
