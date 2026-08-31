import { Router, Response } from 'express';
import { isValidObjectId } from 'mongoose';
import { requireAdmin, AuthenticatedRequest } from '../../middleware/requireAdmin';
import { validateRequest } from '../../middleware/validateRequest';
import { subTypeSchema, subTypePatchSchema, SubTypeInput, SubTypePatchInput } from '@portfolio/shared';
import { errorBody } from '../../utils/apiError';
import { logger } from '../../utils/logger';
import { parseListParams, listEnvelope } from '../../utils/listQuery';
import { SubType } from './subType.model';
import { Resource } from '../resources/resource.model';
import { LIVE, SELECTABLE } from '../mainTypes/mainType.service';
import { handleReferenceError } from '../mainTypes/adminRoutes';
import {
  assertMainTypeExists,
  assertNameIsFreeInParent,
  softDeleteSubType,
  restoreSubType,
  SUB_TYPE_SORT_FIELDS,
  listSubTypes,
} from './subType.service';

/** ADMIN-ONLY. Mounted at /api/v1/admin/sub-types behind requireAdmin. */
const router = Router();
router.use(requireAdmin);

const notFound = (res: Response) => res.status(404).json(errorBody('NOT_FOUND', 'Sub type not found'));

// Admin: GET /api/v1/admin/sub-types ?mainTypeId=&search=&status=&includeDeleted=&page=&limit=&sortBy=&sortDir=
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const params = parseListParams(req, SUB_TYPE_SORT_FIELDS, 'name');
    const { items, total } = await listSubTypes({
      mainTypeId: req.query.mainTypeId && isValidObjectId(String(req.query.mainTypeId))
        ? String(req.query.mainTypeId)
        : undefined,
      search: params.search,
      status: params.status,
      includeDeleted: params.includeDeleted,
      sort: params.sort,
      skip: params.skip,
      limit: params.limit,
    });
    res.json(listEnvelope(items, total, params));
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch sub types');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to fetch sub types'));
  }
});

// Admin: GET /api/v1/admin/sub-types/options?mainTypeId=
//
// Section 2: only non-deleted, ACTIVE sub types are selectable. mainTypeId is required —
// a dependent dropdown with no parent chosen should show nothing, not everything.
router.get('/options', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const mainTypeId = String(req.query.mainTypeId ?? '');
    if (!isValidObjectId(mainTypeId)) {
      return res.status(400).json(errorBody('VALIDATION_ERROR', 'A mainTypeId is required'));
    }
    res.json(await SubType.find({ mainTypeId, ...SELECTABLE }).select('name mainTypeId').sort({ name: 1 }));
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch sub type options');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to fetch sub type options'));
  }
});

// Admin: GET /api/v1/admin/sub-types/:id — declared after the literal routes.
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!isValidObjectId(req.params.id)) return notFound(res);
    const subType = await SubType.findById(req.params.id);
    if (!subType) return notFound(res);
    res.json(subType);
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch sub type');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to fetch sub type'));
  }
});

router.post('/', validateRequest(subTypeSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const body = req.body as SubTypeInput;
    await assertMainTypeExists(body.mainTypeId);
    await assertNameIsFreeInParent(body.mainTypeId, body.name);
    res.status(201).json(await SubType.create(body));
  } catch (error) {
    handleReferenceError(error, res, 'sub type');
  }
});

router.patch('/:id', validateRequest(subTypePatchSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!isValidObjectId(req.params.id)) return notFound(res);
    const existing = await SubType.findOne({ _id: req.params.id, ...LIVE });
    if (!existing) return notFound(res);

    const body = req.body as SubTypePatchInput;
    const nextMainTypeId = body.mainTypeId ?? String(existing.mainTypeId);
    if (body.mainTypeId) await assertMainTypeExists(body.mainTypeId);
    if (body.name || body.mainTypeId) {
      await assertNameIsFreeInParent(nextMainTypeId, body.name ?? existing.name, req.params.id);
    }

    Object.assign(existing, body);
    await existing.save();

    // Moving a sub type to a different main type would leave every resource under it
    // pointing at the old one — exactly the drift Section 0.1 exists to prevent — so the
    // denormalized copies are realigned in the same request.
    if (body.mainTypeId) {
      await Resource.updateMany({ subTypeId: existing._id, ...LIVE }, { $set: { mainTypeId: existing.mainTypeId } });
    }

    res.json(existing);
  } catch (error) {
    handleReferenceError(error, res, 'sub type');
  }
});

// Admin: DELETE /api/v1/admin/sub-types/:id[?cascade=true]
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!isValidObjectId(req.params.id)) return notFound(res);
    const exists = await SubType.findOne({ _id: req.params.id, ...LIVE });
    if (!exists) return notFound(res);

    const counts = await softDeleteSubType(req.params.id, req.query.cascade === 'true');
    res.json({ deleted: req.params.id, cascaded: counts });
  } catch (error) {
    handleReferenceError(error, res, 'sub type');
  }
});

// Admin: POST /api/v1/admin/sub-types/:id/restore
router.post('/:id/restore', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!isValidObjectId(req.params.id)) return notFound(res);
    const restored = await restoreSubType(req.params.id);
    if (!restored) return notFound(res);
    res.json(restored);
  } catch (error) {
    handleReferenceError(error, res, 'sub type');
  }
});

export default router;
