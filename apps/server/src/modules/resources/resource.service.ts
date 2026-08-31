import { Types, PipelineStage } from 'mongoose';
import { MainType } from '../mainTypes/mainType.model';
import { SubType } from '../subTypes/subType.model';
import { Resource } from './resource.model';
import { LIVE, ReferenceValidationError } from '../mainTypes/mainType.service';
import { escapeRegex } from '../../utils/listQuery';

const toId = (value: string) => new Types.ObjectId(value);

/**
 * Module Section 0.1 and the Section 2 integrity table, in one place.
 *
 * `mainTypeId` on a Resource is denormalized from its sub type, so the two can disagree —
 * and a client is free to send any pair it likes. Called by both create and update from
 * this single helper: duplicating the check is how the two paths drift, and an update
 * that skipped it would silently reintroduce exactly the inconsistency create rejects.
 *
 * Returns the ids to store, so callers never write the client's values directly.
 */
export async function assertTypePairIsConsistent(
  mainTypeId: string,
  subTypeId: string
): Promise<{ mainTypeId: Types.ObjectId; subTypeId: Types.ObjectId }> {
  const subType = await SubType.findOne({ _id: subTypeId, ...LIVE });
  if (!subType) {
    throw new ReferenceValidationError('That sub type does not exist');
  }

  const mainType = await MainType.findOne({ _id: mainTypeId, ...LIVE });
  if (!mainType) {
    throw new ReferenceValidationError('That main type does not exist');
  }

  if (String(subType.mainTypeId) !== String(mainType._id)) {
    throw new ReferenceValidationError(
      `Sub type "${subType.name}" does not belong to main type "${mainType.name}"`
    );
  }

  return { mainTypeId: toId(mainTypeId), subTypeId: toId(subTypeId) };
}

/**
 * Section 2: a resource cannot be restored under a deleted parent, for the same reason a
 * sub type cannot — it would be live but unreachable through every filter.
 */
export async function restoreResource(id: string) {
  const resource = await Resource.findById(id);
  if (!resource || !resource.deletedAt) return null;

  const subType = await SubType.findOne({ _id: resource.subTypeId, ...LIVE });
  if (!subType) {
    throw new ReferenceValidationError(
      'Its sub type is still deleted. Restore the sub type first, then this resource.'
    );
  }
  const mainType = await MainType.findOne({ _id: resource.mainTypeId, ...LIVE });
  if (!mainType) {
    throw new ReferenceValidationError(
      'Its main type is still deleted. Restore the main type first, then this resource.'
    );
  }

  resource.deletedAt = null;
  await resource.save();
  return resource;
}

/** Sort keys a client may request. Never interpolate an arbitrary string into a sort. */
export const RESOURCE_SORT_FIELDS = [
  'link', 'mainTypeName', 'subTypeName', 'status', 'createdAt', 'updatedAt',
] as const;

export interface ResourceListOptions {
  search?: string;
  mainTypeId?: string;
  subTypeId?: string;
  status?: string;
  createdRange?: Record<string, Date>;
  updatedRange?: Record<string, Date>;
  includeDeleted: boolean;
  sort: Record<string, 1 | -1>;
  skip: number;
  limit: number;
}

/**
 * Module Section 0.3 / 3.1. Search has to cover the Main Type and Sub Type *names*, and
 * those live in other collections — a plain Resource.find() cannot match on them at all.
 * So the listing is an aggregation from the start: retrofitting one later means rewriting
 * the endpoint, its pagination and its tests together.
 *
 * $facet returns the page and the total from one round trip, over the identical filtered
 * set, so the count can never disagree with what the rows were filtered by.
 */
export async function listResources(options: ResourceListOptions) {
  const match: Record<string, unknown> = options.includeDeleted ? {} : { ...LIVE };
  if (options.mainTypeId) match.mainTypeId = toId(options.mainTypeId);
  if (options.subTypeId) match.subTypeId = toId(options.subTypeId);
  if (options.status) match.status = options.status;
  if (options.createdRange) match.createdAt = options.createdRange;
  if (options.updatedRange) match.updatedAt = options.updatedRange;

  const stages: PipelineStage[] = [
    { $match: match },
    { $lookup: { from: MainType.collection.name, localField: 'mainTypeId', foreignField: '_id', as: 'mainType' } },
    // preserveNull keeps a resource visible even if its parent was hard-deleted out from
    // under it. A bookmark that vanishes from the list is worse than one showing a blank
    // category, because there is no way to notice it is missing.
    { $unwind: { path: '$mainType', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: SubType.collection.name, localField: 'subTypeId', foreignField: '_id', as: 'subType' } },
    { $unwind: { path: '$subType', preserveNullAndEmptyArrays: true } },
  ];

  const search = options.search?.trim();
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    stages.push({
      $match: {
        $or: [
          { link: rx },
          { description: rx },
          { 'mainType.name': rx },
          { 'subType.name': rx },
        ],
      },
    });
  }

  stages.push(
    { $addFields: { mainTypeName: '$mainType.name', subTypeName: '$subType.name' } },
    { $project: { mainType: 0, subType: 0 } },
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
              mainTypeId: { $toString: '$mainTypeId' },
              subTypeId: { $toString: '$subTypeId' },
              link: 1, description: 1, status: 1, mainTypeName: 1, subTypeName: 1,
              deletedAt: 1, createdAt: 1, updatedAt: 1,
            },
          },
        ],
        meta: [{ $count: 'total' }],
      },
    }
  );

  const [result] = await Resource.aggregate(stages);
  return { items: result?.items ?? [], total: result?.meta?.[0]?.total ?? 0 };
}
