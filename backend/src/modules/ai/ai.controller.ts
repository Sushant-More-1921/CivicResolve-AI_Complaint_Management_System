import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { aiService } from './ai.service';

const imageSchema = z.object({
  imageBase64: z.string().min(1).max(12_000_000),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  text: z.string().max(20_000).default(''),
  language: z.enum(['en', 'hi', 'mr']).optional(),
});

const validateImageSchema = z.object({
  imageBase64: z.string().min(1).max(12_000_000),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  category: z.string().max(120).default(''),
  description: z.string().max(20_000).default(''),
  language: z.enum(['en', 'hi', 'mr', 'auto']).optional().default('auto'),
});

export class AIController {
  public validateEvidenceImage = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const input = validateImageSchema.parse(req.body);
      const result = await aiService.validateImage({
        imageBase64: input.imageBase64,
        contentType: input.contentType,
        category: input.category,
        description: input.description,
        language: input.language,
      });
      res.status(200).json({ success: true, data: result, ...result });
    } catch (error) {
      next(error);
    }
  };

  public verifyComplaintDescription = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const schema = z.object({
        description: z.string().max(10_000).default(''),
        selected_category: z.string().optional().nullable(),
        category: z.string().optional().nullable(),
        language: z.string().optional().default('auto'),
      });
      const input = schema.parse(req.body);
      const result = await aiService.verifyComplaintDescription({
        description: input.description,
        selected_category: input.selected_category || input.category || null,
        language: input.language,
      });
      res.status(200).json({ success: true, data: result, ...result });
    } catch (error) {
      next(error);
    }
  };

  public predictPriority = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const schema = z.object({
        text: z.string().min(1).max(20_000),
        category: z.string().optional(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
        similarity_count: z.number().optional(),
      });
      const input = schema.parse(req.body);
      const result = await aiService.predictPriority(input);
      res.status(200).json({ success: true, data: result, ...result });
    } catch (error) {
      next(error);
    }
  };

  public analyzeImage = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const input = imageSchema.parse(req.body);
      const result = await aiService.analyzeImage(input);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  public transcribeAudio = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, message: 'Audio file is required.' });
        return;
      }
      const result = await aiService.transcribeAudio(req.file);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };
}
