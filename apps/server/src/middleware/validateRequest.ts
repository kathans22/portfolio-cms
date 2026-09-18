import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { errorBody } from '../utils/apiError';

export function validateRequest(schema: ZodSchema) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await schema.safeParseAsync(req.body);
      if (!result.success) {
        return res.status(400).json(
          errorBody(
            'VALIDATION_ERROR',
            'Validation failed',
            result.error.errors.map((err) => ({ field: err.path.join('.'), message: err.message }))
          )
        );
      }
      req.body = result.data;
      next();
    } catch {
      return res.status(500).json(errorBody('INTERNAL_ERROR', 'Internal server error during validation'));
    }
  };
}
