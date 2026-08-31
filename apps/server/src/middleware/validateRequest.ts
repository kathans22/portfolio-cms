import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { errorBody } from '../utils/apiError';

export function validateRequest(schema: ZodSchema) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json(
          errorBody(
            'VALIDATION_ERROR',
            'Validation failed',
            error.errors.map((err) => ({ field: err.path.join('.'), message: err.message }))
          )
        );
      }
      return res.status(500).json(errorBody('INTERNAL_ERROR', 'Internal server error during validation'));
    }
  };
}
