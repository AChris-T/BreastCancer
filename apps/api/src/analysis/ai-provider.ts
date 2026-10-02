import { GoogleGenAI } from '@google/genai';
import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { classify, modelResultSchema, type ModelResult, type ScanType } from '@breastscan/shared';
import { AppConfig } from '../config/config.module.js';
import { buildRepairPrompt, buildUserPrompt, type PromptContext, SYSTEM_PROMPT } from './prompts/v2.js';

export interface AnalyzeInput {
  file: Buffer;
  mimeType: string;
  context: PromptContext;
}

export interface ModelReply {
  text: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
}

/** Errors that will not get better on retry (bad request, blocked content). */
export class PermanentAiError extends Error {}

export abstract class AiProvider {
  abstract readonly model: string;
  abstract analyze(input: AnalyzeInput): Promise<ModelReply>;
  abstract repair(input: AnalyzeInput, previous: string, problems: string): Promise<ModelReply>;
}

function responseJsonSchema() {
  const schema = z.toJSONSchema(modelResultSchema) as Record<string, unknown>;
  delete schema.$schema;
  return schema;
}

@Injectable()
export class GeminiProvider extends AiProvider {
  private readonly client: GoogleGenAI;
  readonly model: string;
  private readonly schema = responseJsonSchema();

  private readonly fallbackModel: string | undefined;
  private readonly logger = new Logger(GeminiProvider.name);

  constructor(config: AppConfig) {
    super();
    this.client = new GoogleGenAI({ apiKey: config.get('GEMINI_API_KEY') });
    this.model = config.get('GEMINI_MODEL');
    this.fallbackModel = config.get('GEMINI_FALLBACK_MODEL') || undefined;
  }

  analyze(input: AnalyzeInput) {
    return this.generate(input, [{ text: buildUserPrompt(input.context) }]);
  }

  repair(input: AnalyzeInput, previous: string, problems: string) {
    return this.generate(input, [{ text: buildUserPrompt(input.context) }], [{ text: buildRepairPrompt(previous, problems) }]);
  }

  private async generate(input: AnalyzeInput, parts: { text: string }[], followUp?: { text: string }[]): Promise<ModelReply> {
    const contents = [
      {
        role: 'user',
        parts: [{ inlineData: { mimeType: input.mimeType, data: input.file.toString('base64') } }, ...parts],
      },
      ...(followUp ? [{ role: 'user', parts: followUp }] : []),
    ];
    const call = (model: string) =>
      this.client.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          temperature: 0.1,
          responseMimeType: 'application/json',
          responseJsonSchema: this.schema,
        },
      });
    let response;
    try {
      response = await call(this.model);
    } catch (error) {
      const status = (error as { status?: number }).status;
      // 4xx other than rate limiting means the request itself is wrong.
      if (status && status >= 400 && status < 500 && status !== 408 && status !== 429) {
        throw new PermanentAiError(`Gemini rejected the request (${status})`);
      }
      // Server errors and rate limits: try the fallback model once before the job is retried.
      if (!this.fallbackModel) throw error;
      this.logger.warn({ status, model: this.model, fallback: this.fallbackModel }, 'Gemini call failed; trying fallback model');
      response = await call(this.fallbackModel);
    }
    const text = response.text;
    if (!text) {
      const reason = response.promptFeedback?.blockReason ?? response.candidates?.[0]?.finishReason ?? 'empty response';
      throw new PermanentAiError(`Gemini returned no content (${reason})`);
    }
    return {
      text,
      model: response.modelVersion ?? this.model,
      inputTokens: response.usageMetadata?.promptTokenCount ?? null,
      outputTokens: response.usageMetadata?.candidatesTokenCount ?? null,
    };
  }
}

/**
 * Development stand-in used when no GEMINI_API_KEY is configured. Clearly
 * labelled so a mock result can never be mistaken for a real one. It echoes
 * the rule-based class so the result screen can be exercised end to end.
 */
@Injectable()
export class MockAiProvider extends AiProvider {
  private readonly logger = new Logger(MockAiProvider.name);
  readonly model = 'mock-ai';

  constructor() {
    super();
    this.logger.warn('Using the MOCK AI provider: results are placeholders, not real analysis');
  }

  async analyze(input: AnalyzeInput): Promise<ModelReply> {
    const declared: ScanType = input.context.declaredType;
    const clinical = input.context.clinical;
    const result: ModelResult = {
      upload_type: declared === 'UNKNOWN' ? 'PATHOLOGY' : declared,
      image_quality: input.mimeType === 'application/pdf' ? 'NOT_APPLICABLE' : 'ADEQUATE',
      suggested_subtype: clinical ? classify(clinical).subtype : 'UNDETERMINED',
      subtype_reasoning: '[MOCK] Copied from the rule-based classification; the file was not read.',
      conflict_with_entered_details: false,
      morphology: null,
      key_findings: [
        { finding: '[MOCK] Placeholder finding; no image analysis was performed.', location: null, significance: 'ROUTINE' },
      ],
      detailed_analysis: '[MOCK] Development-mode output. Configure GEMINI_API_KEY to run a real analysis.',
      summary: '[MOCK] Test output from development mode. No real analysis of the file was done.',
      recommendations: ['Confirm the subtype against the formal pathology report.', 'This mock result must not be used clinically.'],
      limitations: '[MOCK] No AI model was called.',
    };
    return { text: JSON.stringify(result), model: this.model, inputTokens: 0, outputTokens: 0 };
  }

  repair(input: AnalyzeInput): Promise<ModelReply> {
    return this.analyze(input);
  }
}
