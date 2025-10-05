/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface AgentPersona {
  agent: {
    name: string;
    id: string;
    title: string;
    icon: string;
    whenToUse: string;
  };
  persona: {
    role: string;
    style: string;
    identity: string;
    focus: string;
    core_principles: string[];
  };
}

/**
 * Extracts YAML configuration from BMAD agent markdown files.
 */
function extractAgentConfig(markdownPath: string): AgentPersona {
  const content = readFileSync(markdownPath, 'utf-8');

  // Extract YAML block between ```yaml and ```
  const yamlMatch = content.match(/```yaml\n([\s\S]*?)\n```/);

  if (!yamlMatch) {
    throw new Error(`No YAML block found in ${markdownPath}`);
  }

  const yamlContent = yamlMatch[1];
  const config = yaml.load(yamlContent) as any;

  return {
    agent: config.agent,
    persona: config.persona,
  };
}

// Load all agent personas
const PROMPTS_DIR = join(__dirname, 'prompts');

export const ANALYST = extractAgentConfig(join(PROMPTS_DIR, 'analyst.md'));
export const PM = extractAgentConfig(join(PROMPTS_DIR, 'pm.md'));
export const ARCHITECT = extractAgentConfig(join(PROMPTS_DIR, 'architect.md'));
export const PO = extractAgentConfig(join(PROMPTS_DIR, 'po.md'));
export const SM = extractAgentConfig(join(PROMPTS_DIR, 'sm.md'));
export const DEV = extractAgentConfig(join(PROMPTS_DIR, 'dev.md'));
export const QA = extractAgentConfig(join(PROMPTS_DIR, 'qa.md'));

/**
 * Generates a system prompt from an agent persona.
 */
export function createSystemPrompt(persona: AgentPersona): string {
  const { agent, persona: p } = persona;

  return `You are ${agent.name}, a ${agent.title}.

${agent.icon} Role: ${p.role}

Identity: ${p.identity}
Focus: ${p.focus}
Style: ${p.style}

Core Principles:
${p.core_principles.map((principle) => `- ${principle}`).join('\n')}

When to use this agent: ${agent.whenToUse}

Always stay in character as ${agent.name}. Apply your core principles to every interaction and decision.`;
}

/**
 * Get system prompt for a specific agent by ID.
 */
export function getAgentPrompt(
  agentId: 'analyst' | 'pm' | 'architect' | 'po' | 'sm' | 'dev' | 'qa',
  options?: { parallelizationMode?: boolean },
): string {
  const personas = {
    analyst: ANALYST,
    pm: PM,
    architect: ARCHITECT,
    po: PO,
    sm: SM,
    dev: DEV,
    qa: QA,
  };

  const basePrompt = createSystemPrompt(personas[agentId]);

  // For SM in parallelization mode, add swarm-specific enhancement
  if (agentId === 'sm' && options?.parallelizationMode) {
    const { getParallelSMPrompt } = require('./parallelization.js');
    return getParallelSMPrompt(basePrompt);
  }

  return basePrompt;
}
