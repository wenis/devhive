/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import OpenAI from 'openai';
import type {
  Content,
  GenerateContentResponse,
  GenerateContentParameters,
  CountTokensParameters,
  CountTokensResponse,
  EmbedContentParameters,
  EmbedContentResponse,
  Part,
  Candidate,
} from '@google/genai';
import type { ContentGenerator } from './contentGenerator.js';

export interface OpenAICompatibleConfig {
  baseURL: string;
  apiKey?: string;
  model: string;
}

/**
 * Converts Gemini Content format to OpenAI ChatCompletion messages format.
 */
function convertGeminiToOpenAI(
  contents: Content | Content[],
): OpenAI.Chat.ChatCompletionMessageParam[] {
  const contentArray = Array.isArray(contents) ? contents : [contents];

  return contentArray.map((content) => {
    const role =
      content.role === 'model'
        ? ('assistant' as const)
        : (content.role as 'user' | 'system' | 'assistant');

    // Combine all text parts into a single message
    const textParts = content.parts
      ?.map((part: Part) => {
        if ('text' in part && part.text) {
          return part.text;
        }
        // Handle other part types if needed
        return '';
      })
      .filter((text) => text.length > 0)
      .join('\n');

    return {
      role,
      content: textParts || '',
    };
  });
}

/**
 * Converts OpenAI ChatCompletion response to Gemini GenerateContentResponse format.
 */
function convertOpenAIToGemini(
  response: OpenAI.Chat.ChatCompletion,
): GenerateContentResponse {
  const choice = response.choices[0];
  const message = choice?.message;

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
  const delta = chunk.choices[0]?.delta;

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
): string | undefined {
  if (!reason) return undefined;

  const mapping: Record<string, string> = {
    stop: 'STOP',
    length: 'MAX_TOKENS',
    content_filter: 'SAFETY',
    tool_calls: 'STOP',
  };

  return mapping[reason] || 'OTHER';
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
    userPromptId: string,
  ): Promise<GenerateContentResponse> {
    const messages = convertGeminiToOpenAI(request.contents);

    const systemInstruction = request.config?.systemInstruction;
    if (systemInstruction) {
      let systemMessage = '';
      if (typeof systemInstruction === 'string') {
        systemMessage = systemInstruction;
      } else if ('text' in systemInstruction) {
        systemMessage = systemInstruction.text || '';
      } else if (Array.isArray(systemInstruction)) {
        systemMessage = systemInstruction
          .map((part) => ('text' in part ? part.text : ''))
          .join('\n');
      } else if ('parts' in systemInstruction) {
        systemMessage =
          systemInstruction.parts
            ?.map((part) => ('text' in part ? part.text : ''))
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

  async *generateContentStream(
    request: GenerateContentParameters,
    userPromptId: string,
  ): AsyncGenerator<GenerateContentResponse> {
    const messages = convertGeminiToOpenAI(request.contents);

    const systemInstruction = request.config?.systemInstruction;
    if (systemInstruction) {
      let systemMessage = '';
      if (typeof systemInstruction === 'string') {
        systemMessage = systemInstruction;
      } else if ('text' in systemInstruction) {
        systemMessage = systemInstruction.text || '';
      } else if (Array.isArray(systemInstruction)) {
        systemMessage = systemInstruction
          .map((part) => ('text' in part ? part.text : ''))
          .join('\n');
      } else if ('parts' in systemInstruction) {
        systemMessage =
          systemInstruction.parts
            ?.map((part) => ('text' in part ? part.text : ''))
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
      const stream = await this.client.chat.completions.create({
        model: this.model,
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
  }

  async countTokens(
    request: CountTokensParameters,
  ): Promise<CountTokensResponse> {
    // Most OpenAI-compatible endpoints don't have a token counting endpoint
    // We'll use a simple heuristic: ~4 characters per token
    const contents = Array.isArray(request.contents)
      ? request.contents
      : [request.contents];

    const totalChars = contents.reduce((sum, content) => {
      const textLength =
        content.parts
          ?.map((part: Part) => ('text' in part ? part.text?.length || 0 : 0))
          .reduce((a, b) => a + b, 0) || 0;
      return sum + textLength;
    }, 0);

    const estimatedTokens = Math.ceil(totalChars / 4);

    return {
      totalTokens: estimatedTokens,
    };
  }

  async embedContent(
    request: EmbedContentParameters,
  ): Promise<EmbedContentResponse> {
    // Embeddings are typically not used for planning tasks
    // If needed, this could be implemented using OpenAI's embeddings endpoint
    throw new Error(
      'Embeddings not supported by OpenAICompatibleContentGenerator',
    );
  }

  userTier = undefined;
}
