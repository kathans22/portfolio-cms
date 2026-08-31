import { Router, Response } from 'express';
import { isValidObjectId } from 'mongoose';
import { requireAdmin, AuthenticatedRequest } from '../../middleware/requireAdmin';
import { validateRequest } from '../../middleware/validateRequest';
import { mainTypeSchema, mainTypePatchSchema, MainTypeInput, MainTypePatchInput } from '@portfolio/shared';
import { errorBody, isDuplicateKeyError } from '../../utils/apiError';
import { logger } from '../../utils/logger';
import { parseListParams, listEnvelope } from '../../utils/listQuery';
import { MainType } from './mainType.model';
import {
  LIVE,
  SELECTABLE,
  assertNameIsFree,
  softDeleteMainType,
  CascadeRequiredError,
  ReferenceValidationError,
  ReferenceConflictError,
  MAIN_TYPE_SORT_FIELDS,
  listMainTypes,
} from './mainType.service';

/**
 * ADMIN-ONLY. Mounted at /api/v1/admin/main-types behind requireAdmin. There is
 * intentionally no public counterpart — see the module's admin-only requirement and the
 * guard tests in src/tests/resourceModuleAdminOnly.test.ts.
 */
const router = Router();
router.use(requireAdmin);

export function handleReferenceError(error: unknown, res: Response, what: string) {
  if (error instanceof CascadeRequiredError) {
    return res.status(409).json(
      errorBody('CASCADE_REQUIRED', error.message, { ...error.counts, hint: 'Retry with ?cascade=true to remove them together.' })
    );
  }
  if (error instanceof ReferenceConflictError) {
    return res.status(409).json(errorBody('CONFLICT', error.message));
  }
  if (error instanceof ReferenceValidationError) {
    return res.status(400).json(errorBody('VALIDATION_ERROR', error.message));
  }
  if (isDuplicateKeyError(error)) {
    return res.status(409).json(errorBody('CONFLICT', `That ${what} already exists`));
  }
  logger.error({ err: error }, `Failed to save ${what}`);
  return res.status(500).json(errorBody('INTERNAL_ERROR', `Failed to save ${what}`));
}

const notFound = (res: Response) => res.status(404).json(errorBody('NOT_FOUND', 'Main type not found'));

// Admin: GET /api/v1/admin/main-types ?search=&status=&includeDeleted=&page=&limit=&sortBy=&sortDir=
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const params = parseListParams(req, MAIN_TYPE_SORT_FIELDS, 'name');
    const { items, total } = await listMainTypes({
      search: params.search,
      status: params.status,
      includeDeleted: params.includeDeleted,
      sort: params.sort,
      skip: params.skip,
      limit: params.limit,
    });
    res.json(listEnvelope(items, total, params));
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch main types');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to fetch main types'));
  }
});

// Admin: GET /api/v1/admin/main-types/options — for the form dropdown.
//
// Section 2: soft-deleted and INACTIVE main types are not selectable. A separate endpoint
// rather than a query flag, so a caller cannot accidentally populate a picker from the
// unfiltered list. Declared before /:id so it isn't captured as an id.
router.get('/options', async (req: AuthenticatedRequest, res: Response) => {
  try {
    res.json(await MainType.find(SELECTABLE).select('name').sort({ name: 1 }));
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch main type options');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to fetch main type options'));
  }
});

// Admin: GET /api/v1/admin/main-types/:id — declared after the literal routes.
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!isValidObjectId(req.params.id)) return notFound(res);
    const mainType = await MainType.findById(req.params.id);
    if (!mainType) return notFound(res);
    res.json(mainType);
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch main type');
    res.status(500).json(errorBody('INTERNAL_ERROR', 'Failed to fetch main type'));
  }
});

router.post('/', validateRequest(mainTypeSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const body = req.body as MainTypeInput;
    await assertNameIsFree(body.name);
    res.status(201).json(await MainType.create(body));
  } catch (error) {
    handleReferenceError(error, res, 'main type');
  }
});

router.patch('/:id', validateRequest(mainTypePatchSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!isValidObjectId(req.params.id)) return notFound(res);
    const body = req.body as MainTypePatchInput;
    if (body.name) await assertNameIsFree(body.name, req.params.id);

    const updated = await MainType.findOneAndUpdate(
      { _id: req.params.id, ...LIVE },
      { $set: body },
      { new: true, runValidators: true }
    );
    if (!updated) return notFound(res);
    res.json(updated);
  } catch (error) {
    handleReferenceError(error, res, 'main type');
  }
});

// Admin: DELETE /api/v1/admin/main-types/:id[?cascade=true]
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!isValidObjectId(req.params.id)) return notFound(res);
    const exists = await MainType.findOne({ _id: req.params.id, ...LIVE });
    if (!exists) return notFound(res);

    const counts = await softDeleteMainType(req.params.id, req.query.cascade === 'true');
    res.json({ deleted: req.params.id, cascaded: counts });
  } catch (error) {
    handleReferenceError(error, res, 'main type');
  }
});

// Admin: POST /api/v1/admin/main-types/:id/restore
router.post('/:id/restore', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!isValidObjectId(req.params.id)) return notFound(res);
    const mainType = await MainType.findById(req.params.id);
    if (!mainType || !mainType.deletedAt) return notFound(res);

    // A restore re-enters the live namespace, so the uniqueness rule applies again —
    // something else may have taken the name while this was deleted.
    await assertNameIsFree(mainType.name, req.params.id);

    mainType.deletedAt = null;
    await mainType.save();
    // Cascade restore is deliberately out of scope: restore children individually.
    res.json(mainType);
  } catch (error) {
    handleReferenceError(error, res, 'main type');
  }
});

export default router;
