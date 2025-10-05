/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import OpenAI from 'openai';
import type {
  GenerateContentParameters,
  CountTokensParameters,
  CountTokensResponse,
  EmbedContentParameters,
  EmbedContentResponse,
  Candidate,
  ContentListUnion,
  PartUnion,
} from '@google/genai';
import { GenerateContentResponse, FinishReason } from '@google/genai';
import type { ContentGenerator } from './contentGenerator.js';

export interface OpenAICompatibleConfig {
  baseURL: string;
  apiKey?: string;
  model: string;
}

/**
 * Converts a single part or content element to text.
 */
function partToText(part: PartUnion): string {
  if (typeof part === 'string') {
    return part;
  }
  if (typeof part === 'object' && 'text' in part && part.text) {
    return part.text;
  }
  return '';
}

/**
 * Converts Gemini Content format to OpenAI ChatCompletion messages format.
 */
function convertGeminiToOpenAI(
  contents: ContentListUnion,
): OpenAI.Chat.ChatCompletionMessageParam[] {
  // ContentListUnion = Content | Content[] | PartUnion | PartUnion[]

  // Handle single PartUnion (string or Part)
  if (
    typeof contents === 'string' ||
    ('text' in contents && !('role' in contents))
  ) {
    return [{ role: 'user', content: partToText(contents as PartUnion) }];
  }

  // Handle array
  if (Array.isArray(contents)) {
    // Check if it's an array of Parts or Content objects
    if (contents.length === 0) {
      return [];
    }

    const first = contents[0];
    if (typeof first === 'string' || ('text' in first && !('role' in first))) {
      // Array of PartUnion
      const text = contents
        .map((p) => partToText(p as PartUnion))
        .filter((t) => t.length > 0)
        .join('\n');
      return [{ role: 'user', content: text }];
    }

    // Array of Content
    return contents.map((content) => {
      const role =
        (content as { role?: string }).role === 'model'
          ? ('assistant' as const)
          : ((content as { role?: string }).role as
              | 'user'
              | 'system'
              | 'assistant');

      const textParts = (content as { parts?: PartUnion[] }).parts
        ?.map(partToText)
        .filter((text: string) => text.length > 0)
        .join('\n');

      return {
        role,
        content: textParts || '',
      };
    });
  }

  // Single Content object
  const content = contents as { role?: string; parts?: PartUnion[] };
  const role =
    content.role === 'model'
      ? ('assistant' as const)
      : (content.role as 'user' | 'system' | 'assistant');

  const textParts = content.parts
    ?.map(partToText)
    .filter((text: string) => text.length > 0)
    .join('\n');

  return [
    {
      role,
      content: textParts || '',
    },
  ];
}

/**
 * Converts OpenAI ChatCompletion response to Gemini GenerateContentResponse format.
 */
function convertOpenAIToGemini(
  response: OpenAI.Chat.ChatCompletion,
): GenerateContentResponse {
  const candidates: Candidate[] = response.choices.map((choice) => ({
    content: {
      role: 'model',
      parts: [
        {
          text: choice.message.content || '',
        },
      ],
    },
    finishReason: convertFinishReason(choice.finish_reason),
    index: choice.index,
  }));

  // Create a Gemini-compatible response
  const geminiResponse = new GenerateContentResponse();
  geminiResponse.candidates = candidates;

  // Add usage metadata if available
  if (response.usage) {
    geminiResponse.usageMetadata = {
      promptTokenCount: response.usage.prompt_tokens,
      candidatesTokenCount: response.usage.completion_tokens,
      totalTokenCount: response.usage.total_tokens,
    };
  }

  return geminiResponse;
}

/**
 * Converts OpenAI ChatCompletion stream chunk to Gemini GenerateContentResponse format.
 */
function convertOpenAIStreamToGemini(
  chunk: OpenAI.Chat.ChatCompletionChunk,
): GenerateContentResponse {
  const candidates: Candidate[] = chunk.choices.map((choice) => ({
    content: {
      role: 'model',
      parts: [
        {
          text: choice.delta.content || '',
        },
      ],
    },
    finishReason: convertFinishReason(choice.finish_reason),
    index: choice.index,
  }));

  const geminiResponse = new GenerateContentResponse();
  geminiResponse.candidates = candidates;

  return geminiResponse;
}

/**
 * Converts OpenAI finish reason to Gemini finish reason.
 */
function convertFinishReason(
  reason: string | null | undefined,
): FinishReason | undefined {
  if (!reason) return undefined;

  const mapping: Record<string, FinishReason> = {
    stop: FinishReason.STOP,
    length: FinishReason.MAX_TOKENS,
    content_filter: FinishReason.SAFETY,
    tool_calls: FinishReason.STOP,
  };

  return mapping[reason] || FinishReason.OTHER;
}

/**
 * OpenAI-compatible ContentGenerator implementation.
 * Supports any OpenAI-compatible API endpoint (llama.cpp, Ollama, LM Studio, etc.)
 */
export class OpenAICompatibleContentGenerator implements ContentGenerator {
  private client: OpenAI;
  private model: string;

  constructor(config: OpenAICompatibleConfig) {
    this.client = new OpenAI({
      baseURL: config.baseURL,
      apiKey: config.apiKey || 'not-needed', // Many local servers don't require API keys
    });
    this.model = config.model;
  }

  async generateContent(
    request: GenerateContentParameters,
    _userPromptId: string,
  ): Promise<GenerateContentResponse> {
    const messages = convertGeminiToOpenAI(request.contents);

    const systemInstruction = request.config?.systemInstruction;
    if (systemInstruction) {
      let systemMessage = '';
      if (typeof systemInstruction === 'string') {
        systemMessage = systemInstruction;
      } else if (
        typeof systemInstruction === 'object' &&
        'text' in systemInstruction
      ) {
        systemMessage = (systemInstruction as { text?: string }).text || '';
      } else if (Array.isArray(systemInstruction)) {
        systemMessage = systemInstruction
          .map((part) => {
            if (typeof part === 'string') return part;
            if (typeof part === 'object' && 'text' in part)
              return (part as { text?: string }).text || '';
            return '';
          })
          .join('\n');
      } else if (
        typeof systemInstruction === 'object' &&
        'parts' in systemInstruction
      ) {
        systemMessage =
          (systemInstruction as { parts?: PartUnion[] }).parts
            ?.map((part) => {
              if (typeof part === 'string') return part;
              if (typeof part === 'object' && 'text' in part)
                return (part as { text?: string }).text || '';
              return '';
            })
            .join('\n') || '';
      }

      if (systemMessage) {
        messages.unshift({
          role: 'system',
          content: systemMessage,
        });
      }
    }

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages,
        temperature: request.config?.temperature,
        max_tokens: request.config?.maxOutputTokens,
        top_p: request.config?.topP,
        stop: request.config?.stopSequences,
        // Note: Some OpenAI-compatible endpoints may not support all parameters
      });

      return convertOpenAIToGemini(response);
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw error;
    }
  }

  async generateContentStream(
    request: GenerateContentParameters,
    _userPromptId: string,
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    const client = this.client;
    const model = this.model;

    return (async function* () {
      const messages = convertGeminiToOpenAI(request.contents);

      const systemInstruction = request.config?.systemInstruction;
      if (systemInstruction) {
        let systemMessage = '';
        if (typeof systemInstruction === 'string') {
          systemMessage = systemInstruction;
        } else if (
          typeof systemInstruction === 'object' &&
          'text' in systemInstruction
        ) {
          systemMessage = (systemInstruction as { text?: string }).text || '';
        } else if (Array.isArray(systemInstruction)) {
          systemMessage = systemInstruction
            .map((part) => {
              if (typeof part === 'string') return part;
              if (typeof part === 'object' && 'text' in part)
                return (part as { text?: string }).text || '';
              return '';
            })
            .join('\n');
        } else if (
          typeof systemInstruction === 'object' &&
          'parts' in systemInstruction
        ) {
          systemMessage =
            (systemInstruction as { parts?: PartUnion[] }).parts
              ?.map((part) => {
                if (typeof part === 'string') return part;
                if (typeof part === 'object' && 'text' in part)
                  return (part as { text?: string }).text || '';
                return '';
              })
              .join('\n') || '';
        }

        if (systemMessage) {
          messages.unshift({
            role: 'system',
            content: systemMessage,
          });
        }
      }

      try {
        const stream = await client.chat.completions.create({
          model,
          messages,
          temperature: request.config?.temperature,
          max_tokens: request.config?.maxOutputTokens,
          top_p: request.config?.topP,
          stop: request.config?.stopSequences,
          stream: true,
        });

        for await (const chunk of stream) {
          yield convertOpenAIStreamToGemini(chunk);
        }
      } catch (error) {
        console.error('OpenAI streaming error:', error);
        throw error;
      }
    })();
  }

  async countTokens(
    request: CountTokensParameters,
  ): Promise<CountTokensResponse> {
    // Most OpenAI-compatible endpoints don't have a token counting endpoint
    // We'll use a simple heuristic: ~4 characters per token

    let totalChars = 0;

    // ContentListUnion = Content | Content[] | PartUnion | PartUnion[]
    const contents = request.contents;

    if (typeof contents === 'string') {
      totalChars = contents.length;
    } else if (Array.isArray(contents)) {
      totalChars = contents.reduce((sum, item) => {
        if (typeof item === 'string') {
          return sum + item.length;
        }

        // Check if it's a Part or Content
        if ('text' in item && !('role' in item)) {
          // It's a Part
          return sum + partToText(item as PartUnion).length;
        }

        // It's a Content
        const content = item as { parts?: PartUnion[] };
        const textLength =
          content.parts
            ?.map((part: PartUnion) => partToText(part).length)
            .reduce((a: number, b: number) => a + b, 0) || 0;
        return sum + textLength;
      }, 0);
    } else {
      // Single Content or PartUnion
      if ('text' in contents && !('role' in contents)) {
        // Single Part
        totalChars = partToText(contents as PartUnion).length;
      } else {
        // Single Content
        const content = contents as { parts?: PartUnion[] };
        totalChars =
          content.parts
            ?.map((part: PartUnion) => partToText(part).length)
            .reduce((a: number, b: number) => a + b, 0) || 0;
      }
    }

    const estimatedTokens = Math.ceil(totalChars / 4);

    return {
      totalTokens: estimatedTokens,
    };
  }

  async embedContent(
    _request: EmbedContentParameters,
  ): Promise<EmbedContentResponse> {
    // Embeddings are typically not used for planning tasks
    // If needed, this could be implemented using OpenAI's embeddings endpoint
    throw new Error(
      'Embeddings not supported by OpenAICompatibleContentGenerator',
    );
  }

  userTier = undefined;
}
