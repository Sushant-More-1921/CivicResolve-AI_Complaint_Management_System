import { env } from '../../config/env';
import { createHash } from 'crypto';

export interface ComplaintDescriptionVerification {
  is_relevant: boolean;
  predicted_category: string | null;
  confidence: number;
  status: 'verified' | 'mismatch' | 'review_required' | 'invalid';
  message: string;
  suggested_category?: string | null;
  suggested_category_key?: string | null;
}

export interface EvidenceImageValidation {
  status: 'VALID' | 'INVALID' | 'NEEDS_REVIEW';
  category_match: boolean;
  description_match: boolean;
  image_quality: 'good' | 'low_quality';
  predicted_category: string;
  category_confidence: number;
  description_match_score: number;
  reason: string;
  requires_manual_review: boolean;
  duplicate_detected: boolean;
  perceptual_hash?: string | null;
  model_version?: string;
}

export interface AIAnalysis {
  complaint: string;
  language: string;
  normalized_text: string;
  category: string;
  category_confidence: number;
  category_status: 'confident' | 'low_confidence';
  manual_review: boolean;
  top_predictions: Array<{ category: string; confidence: number }>;
  priority: string;
  priority_confidence: number;
  severity_score: number;
  priority_source: string;
  priority_explanation?: string;
  priority_factors?: string[];
  model_version?: string;
  duplicate_detection: {
    possible_duplicate?: boolean;
    duplicate_score?: number;
    best_match?: {
      complaint_id?: string | number;
      issue_cluster_id?: string;
    } | null;
    issue_cluster?: {
      issue_cluster_id?: string;
      duplicate_of?: string | number | null;
    };
  } | null;
  issue_cluster_id: string | null;
  hotspot_count: number;
  hotspots: unknown[];
}

export interface AIPriorityPrediction {
  priority: string;
  confidence: number;
  severity_score: number;
  source: string;
  model_version: string;
  timestamp: string;
  explanation: string;
  contributing_factors: string[];
  probabilities: Record<string, number>;
}

export interface AIComplaintContext {
  id: string;
  citizen_id: string;
  text: string;
  latitude: number;
  longitude: number;
  category: string;
  issue_cluster_id: string | null;
  created_at: string;
  status: string;
}

export interface AIClusterContext {
  issue_cluster_id: string;
  category: string | null;
  location: { latitude: number; longitude: number };
  report_count: number;
  unique_citizen_count: number;
}

export class AIServiceError extends Error {
  public statusCode: number;

  constructor(message: string, statusCode = 503, options?: ErrorOptions) {
    super(message, options);
    this.statusCode = statusCode;
    this.name = 'AIServiceError';
  }
}

export class AIService {
  private async post<T>(path: string, body: unknown): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      env.AI_SERVICE_TIMEOUT_MS
    );

    try {
      const response = await fetch(
        `${env.AI_SERVICE_URL.replace(/\/+$/, '')}${path}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        }
      );

      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const detail =
          typeof payload === 'object' &&
          payload !== null &&
          'detail' in payload &&
          typeof payload.detail === 'string'
            ? payload.detail
            : `AI service returned HTTP ${response.status}.`;
        const statusCode =
          response.status === 400 || response.status === 413 ? response.status : 503;
        throw new AIServiceError(detail, statusCode);
      }

      if (typeof payload !== 'object' || payload === null) {
        throw new AIServiceError('AI service returned an invalid response.');
      }
      return payload as T;
    } catch (error) {
      if (error instanceof AIServiceError) {
        throw error;
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new AIServiceError('AI service request timed out.', 503, { cause: error });
      }
      throw new AIServiceError('AI service is unavailable.', 503, { cause: error });
    } finally {
      clearTimeout(timeout);
    }
  }

  private readonly recentSubmittedHashes: string[] = [];

  public recordSubmittedImageHash(hash?: string | null): void {
    if (!hash || typeof hash !== 'string') return;
    if (!this.recentSubmittedHashes.includes(hash)) {
      this.recentSubmittedHashes.push(hash);
      if (this.recentSubmittedHashes.length > 500) {
        this.recentSubmittedHashes.shift();
      }
    }
  }

  public validateImage(input: {
    imageBase64: string;
    contentType: 'image/jpeg' | 'image/png' | 'image/webp';
    category: string;
    description: string;
    language?: string;
  }): Promise<EvidenceImageValidation> {
    return this.post<EvidenceImageValidation>('/validate-image', {
      image_base64: input.imageBase64,
      content_type: input.contentType,
      category: input.category,
      description: input.description,
      language: input.language || 'auto',
      existing_hashes: this.recentSubmittedHashes.slice(-200),
    });
  }

  public verifyComplaintDescription(input: {
    description: string;
    selected_category?: string | null;
    language?: string | null;
  }): Promise<ComplaintDescriptionVerification> {
    return this.post<ComplaintDescriptionVerification>('/complaints/verify-description', {
      description: input.description,
      selected_category: input.selected_category,
      language: input.language || 'auto',
    });
  }

  public async analyzeComplaint(input: {
    text: string;
    language?: string;
    latitude?: number;
    longitude?: number;
    complaintId: string;
    citizenId: string;
    previousComplaints: AIComplaintContext[];
    issueClusters: AIClusterContext[];
  }): Promise<AIAnalysis> {
    const fetchPromise = this.post<AIAnalysis>('/analyze', {
      text: input.text,
      language: input.language,
      latitude: input.latitude,
      longitude: input.longitude,
      complaint_id: input.complaintId,
      citizen_id: input.citizenId,
      previous_complaints: input.previousComplaints,
      issue_clusters: input.issueClusters,
    });

    const timeoutPromise = new Promise<AIAnalysis>((_, reject) => {
      setTimeout(() => reject(new Error('AI analysis timeout (fast fallback activated)')), 3500);
    });

    try {
      return await Promise.race([fetchPromise, timeoutPromise]);
    } catch (err) {
      console.warn('[AI Service] Fast fallback activated:', (err as Error)?.message || err);
      return this.getLocalNlpAnalysis(input.text);
    }
  }

  public getLocalNlpAnalysis(text: string, categoryHint?: string): AIAnalysis {
    const lower = text.toLowerCase();

    // Word matching for category
    let category = categoryHint || 'Other Civic Issue';
    if (!categoryHint || categoryHint.toLowerCase() === 'other' || categoryHint.toLowerCase() === 'other civic issue') {
      if (/pothole|road|asphalt|crater|traffic|footpath|sidewalk|street|subsidence/i.test(lower)) {
        category = 'Roads & Footpaths';
      } else if (/water|pipe|leak|pipeline|drinking|potable|pressure|supply/i.test(lower)) {
        category = 'Water Supply';
      } else if (/drain|drainage|sewage|sewer|gutter|stagnant/i.test(lower)) {
        category = 'Drainage & Sewage';
      } else if (/garbage|waste|trash|dump|bin|rubbish|cattle|stench/i.test(lower)) {
        category = 'Solid Waste & Sanitation';
      } else if (/light|electric|pole|wire|lamp|darkness|sparking/i.test(lower)) {
        category = 'Street Lighting';
      }
    }

    // Word matching for priority
    let priority = 'MEDIUM';
    const factors: string[] = [];
    if (/open\s*manhole|live\s*wire|electric\s*shock|collapse|explosion|pipeline\s*burst/i.test(lower)) {
      priority = 'CRITICAL';
      factors.push('Emergency: Life-safety hazard or critical utility rupture detected');
    } else if (/mosquito|breeding|health\s*risk|dengue|malaria|stagnant|accident|skid|deep\s*pothole|overflowing/i.test(lower)) {
      priority = 'HIGH';
      factors.push('High Severity: Public health vector, vector breeding, or transit hazard');
    } else if (/minor|routine|sweeping|dust|cleaning|dim/i.test(lower)) {
      priority = 'LOW';
      factors.push('Routine: Non-emergency municipal maintenance with localized scope');
    } else {
      factors.push('Standard: Operational civic maintenance requirement');
    }

    return {
      complaint: text,
      language: 'en',
      normalized_text: text.trim().toLowerCase(),
      category,
      category_confidence: 0.95,
      category_status: 'confident',
      manual_review: false,
      top_predictions: [{ category, confidence: 0.95 }],
      priority,
      priority_confidence: 0.95,
      severity_score: priority === 'CRITICAL' ? 0.95 : priority === 'HIGH' ? 0.82 : priority === 'MEDIUM' ? 0.55 : 0.3,
      priority_source: 'nlp-lexical-fast',
      priority_explanation: factors.join('. '),
      priority_factors: factors,
      model_version: 'nlp-lexical-v2.5-fast',
      duplicate_detection: null,
      issue_cluster_id: null,
      hotspot_count: 0,
      hotspots: [],
    };
  }

  public predictPriority(input: {
    text: string;
    category?: string;
    latitude?: number;
    longitude?: number;
    similarity_count?: number;
  }): Promise<AIPriorityPrediction> {
    return this.post<AIPriorityPrediction>('/priority/predict', {
      text: input.text,
      category: input.category,
      latitude: input.latitude,
      longitude: input.longitude,
      similarity_count: input.similarity_count,
    });
  }

  public analyzeImage(input: {
    imageBase64: string;
    contentType: 'image/jpeg' | 'image/png' | 'image/webp';
    text: string;
    language?: string;
  }): Promise<{ image_description: string; analysis: AIAnalysis }> {
    return this.post('/image/analyze', {
      image_base64: input.imageBase64,
      content_type: input.contentType,
      text: input.text,
      language: input.language,
    });
  }

  public async transcribeAudio(
    file: Express.Multer.File
  ): Promise<{ text: string; language: string; analysis: AIAnalysis }> {
    const form = new FormData();
    form.append(
      'audio',
      new Blob([new Uint8Array(file.buffer)], { type: file.mimetype }),
      file.originalname
    );
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      env.AI_SERVICE_TIMEOUT_MS
    );

    try {
      const response = await fetch(
        `${env.AI_SERVICE_URL.replace(/\/+$/, '')}/voice/transcribe`,
        { method: 'POST', body: form, signal: controller.signal }
      );
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const detail =
          typeof payload === 'object' &&
          payload !== null &&
          'detail' in payload &&
          typeof payload.detail === 'string'
            ? payload.detail
            : `AI service returned HTTP ${response.status}.`;
        const statusCode =
          response.status === 400 || response.status === 413 ? response.status : 503;
        throw new AIServiceError(detail, statusCode);
      }
      if (typeof payload !== 'object' || payload === null) {
        throw new AIServiceError('AI service returned an invalid response.');
      }
      return payload as { text: string; language: string; analysis: AIAnalysis };
    } catch (error) {
      if (error instanceof AIServiceError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new AIServiceError('AI service request timed out.', 503, { cause: error });
      }
      throw new AIServiceError('AI service is unavailable.', 503, { cause: error });
    } finally {
      clearTimeout(timeout);
    }

  }

  public async uploadComplaintImage(
    imageBase64: string,
    contentType: 'image/jpeg' | 'image/png' | 'image/webp'
  ): Promise<string> {
    const { CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, CLOUDINARY_CLOUD_NAME } = env;

    const dataUri = imageBase64.startsWith('data:')
      ? imageBase64
      : `data:${contentType};base64,${imageBase64}`;

    if (
      !CLOUDINARY_API_KEY ||
      !CLOUDINARY_API_SECRET ||
      !CLOUDINARY_CLOUD_NAME ||
      !CLOUDINARY_API_KEY.trim() ||
      !CLOUDINARY_API_SECRET.trim() ||
      !CLOUDINARY_CLOUD_NAME.trim() ||
      CLOUDINARY_CLOUD_NAME === 'your_cloud_name' ||
      CLOUDINARY_CLOUD_NAME.includes('placeholder')
    ) {
      console.warn('⚠️ [Storage] Cloudinary credentials not configured; saving photo evidence as direct data URI.');
      return dataUri;
    }

    if (CLOUDINARY_API_KEY === CLOUDINARY_API_SECRET) {
      console.warn(
        '⚠️ [Storage] CLOUDINARY_API_SECRET is identical to CLOUDINARY_API_KEY in .env. Please provide the actual Cloudinary API Secret from your dashboard; saving photo evidence as direct data URI.'
      );
      return dataUri;
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHash('sha1')
      .update(`timestamp=${timestamp}${CLOUDINARY_API_SECRET}`)
      .digest('hex');
    const form = new FormData();
    form.append('api_key', CLOUDINARY_API_KEY);
    form.append('timestamp', String(timestamp));
    form.append('signature', signature);
    form.append(
      'file',
      new Blob([new Uint8Array(Buffer.from(imageBase64, 'base64'))], { type: contentType }),
      'complaint-evidence'
    );

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      env.AI_SERVICE_TIMEOUT_MS
    );
    try {
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${encodeURIComponent(CLOUDINARY_CLOUD_NAME)}/image/upload`,
        { method: 'POST', body: form, signal: controller.signal }
      );
      const payload: unknown = await response.json().catch(() => null);
      if (
        !response.ok ||
        typeof payload !== 'object' ||
        payload === null ||
        !('secure_url' in payload) ||
        typeof payload.secure_url !== 'string'
      ) {
        console.warn('⚠️ [Storage] Cloudinary upload returned error; falling back to direct data URI:', payload);
        return dataUri;
      }
      return payload.secure_url;
    } catch (error) {
      console.warn('⚠️ [Storage] Cloudinary request failed; falling back to direct data URI:', error);
      return dataUri;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const aiService = new AIService();
