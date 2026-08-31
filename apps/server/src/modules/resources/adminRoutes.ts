import { Router, Response } from 'express';
import { isValidObjectId } from 'mongoose';
import { requireAdmin, AuthenticatedRequest } from '../../middleware/requireAdmin';
import { validateRequest } from '../../middleware/validateRequest';
import {
  resourceSchema,
  resourcePatchSchema,
  resourceStatusSchema,
  ResourceInput,
  ResourcePatchInput,
  ResourceStatusInput,
} from '@portfolio/shared';
import { errorBody } from '../../utils/apiError';
import { logger } from '../../utils/logger';
import { parseListParams, listEnvelope, dateRange } from '../../utils/listQuery';
import { Resource } from './resource.model';
import { LIVE } from '../mainTypes/mainType.service';
import { handleReferenceError } from '../mainTypes/adminRoutes';
import {
  assertTypePairIsConsistent,
  listResources,
  restoreResource,
  RESOURCE_SORT_FIELDS,
} from './resource.service';

/** ADMIN-ONLY. Mounted at /api/v1/admin/resources behind requireAdmin. */
const router = Router();
router.use(requireAdmin);

const notFound = (res: Response) => res.status(404).json(errorBody('NOT_FOUND', 'Resource not found'));
const idParam = (req: AuthenticatedRequest, key: string) =>
  req.query[key] && isValidObjectId(String(req.query[key])) ? String(req.query[key]) : undefined;

// Admin: GET /api/v1/admin/resources
// ?search=&mainTypeId=&subTypeId=&status=&createdFrom=&createdTo=&updatedFrom=&updatedTo=
// &includeDeleted=&page=&limit=&sortBy=&sortDir=
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const params = parseListParams(req, RESOURCE_SORT_FIELDS, 'createdAt');
    const { items, total } = await listResources({
      search: params.search,
      mainTypeId: idParam(req, 'mainTypeId'),
      subTypeId: idParam(req, 'subTypeId'),
      status: params.status,
      createdRange: dateRange(req.query.createdFrom, req.query.createdTo),
      updatedRange: dateRange(req.query.updatedFrom, req.query.updatedTo),
      includeDeleted: params.includeDeleted,
      sort: params.sort,
      skip: params.skip,
      limit: params.limit,
    });
    res.json(listEnvelope(items, total, params));
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch resources');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to fetch resources'));
  }
});

// Admin: GET /api/v1/admin/resources/:id
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!isValidObjectId(req.params.id)) return notFound(res);
    const resource = await Resource.findById(req.params.id);
    if (!resource) return notFound(res);
    res.json(resource);
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch resource');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to fetch resource'));
  }
});

router.post('/', validateRequest(resourceSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const body = req.body as ResourceInput;
    const ids = await assertTypePairIsConsistent(body.mainTypeId, body.subTypeId);
    res.status(201).json(await Resource.create({ ...body, ...ids }));
  } catch (error) {
    handleReferenceError(error, res, 'resource');
  }
});

router.patch('/:id', validateRequest(resourcePatchSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!isValidObjectId(req.params.id)) return notFound(res);
    const existing = await Resource.findOne({ _id: req.params.id, ...LIVE });
    if (!existing) return notFound(res);

    const body = req.body as ResourcePatchInput;
    // A patch may move either side of the pair, or neither. Resolve both against what is
    // already stored and re-verify, so a partial update can't leave an inconsistent pair.
    const ids = await assertTypePairIsConsistent(
      body.mainTypeId ?? String(existing.mainTypeId),
      body.subTypeId ?? String(existing.subTypeId)
    );

    Object.assign(existing, body, ids);
    await existing.save();
    res.json(existing);
  } catch (error) {
    handleReferenceError(error, res, 'resource');
  }
});

// Admin: PATCH /api/v1/admin/resources/:id/status — toggle ACTIVE/INACTIVE.
//
// A dedicated endpoint rather than a general PATCH, so a row-level toggle cannot
// accidentally submit a stale copy of every other field alongside it.
router.patch('/:id/status', validateRequest(resourceStatusSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!isValidObjectId(req.params.id)) return notFound(res);
    const updated = await Resource.findOneAndUpdate(
      { _id: req.params.id, ...LIVE },
      { $set: { status: (req.body as ResourceStatusInput).status } },
      { new: true }
    );
    if (!updated) return notFound(res);
    res.json(updated);
  } catch (error) {
    handleReferenceError(error, res, 'resource');
  }
});

// A resource is a leaf, so its delete has nothing to cascade to.
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!isValidObjectId(req.params.id)) return notFound(res);
    const deleted = await Resource.findOneAndUpdate(
      { _id: req.params.id, ...LIVE },
      { $set: { deletedAt: new Date() } },
      { new: true }
    );
    if (!deleted) return notFound(res);
    res.status(204).end();
  } catch (error) {
    logger.error({ err: error }, 'Failed to delete resource');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to delete resource'));
  }
});

router.post('/:id/restore', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!isValidObjectId(req.params.id)) return notFound(res);
    const restored = await restoreResource(req.params.id);
    if (!restored) return notFound(res);
    res.json(restored);
  } catch (error) {
    handleReferenceError(error, res, 'resource');
  }
});

export default router;
