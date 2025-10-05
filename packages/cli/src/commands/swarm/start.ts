/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommandModule } from 'yargs';
import { createSwarmGraph, type SwarmState } from 'devhive-workflows';
import { createContentGenerator, AuthType } from '@google/gemini-cli-core';

async function runSwarmWorkflow(options: { maxAgents?: number }) {
  console.log('🐝 Starting DevHive development swarm...\n');

  // Create cloud API content generator for coding
  const cloudGenerator = await createContentGenerator(
    {
      authType: AuthType.LOGIN_WITH_GOOGLE,
    },
    {} as any, // TODO: Pass actual config
  );

  const abortController = new AbortController();

  // Create and run swarm graph
  const graph = createSwarmGraph(cloudGenerator, abortController.signal);

  // TODO: Load stories from docs/stories/
  const stories: any[] = [];

  const maxAgents = options.maxAgents || 3;

  const initialState: SwarmState = {
    storyQueue: stories,
    activeStories: [],
    completedStories: [],
    agents: Array.from({ length: maxAgents }, (_, i) => ({
      id: `dev-${i + 1}`,
      name: `Dev Agent ${i + 1}`,
      status: 'idle' as const,
    })),
    maxAgents,
    codeChanges: [],
    testResults: [],
    phase: 'assign',
    blockedStories: [],
  };

  console.log(`📊 Swarm configuration:`);
  console.log(`   Max agents: ${maxAgents}`);
  console.log(`   Stories in queue: ${stories.length}\n`);

  console.log('🔄 Running swarm workflow...');
  console.log('   SM → Assign → Dev Swarm → QA → Integrate\n');

  try {
    const result = await graph.invoke(initialState);

    console.log('\n✅ Swarm execution complete!\n');
    console.log(`Stories completed: ${result.completedStories?.length || 0}`);
    console.log(`Code changes: ${result.codeChanges?.length || 0}\n`);

    if (result.completedStories && result.completedStories.length > 0) {
      console.log('Completed stories:');
      result.completedStories.forEach((story) => {
        console.log(`  ✓ ${story.id}: ${story.title}`);
      });
    }

    console.log('\n📁 Next steps:');
    console.log('  1. Review generated code changes');
    console.log('  2. Run tests and verify implementation');
    console.log('  3. Commit changes to repository');
  } catch (error) {
    console.error('\n❌ Swarm execution failed:', error);
    process.exit(1);
  }
}

export const startCommand: CommandModule = {
  command: 'start',
  describe: 'Start parallel development swarm (uses cloud API)',
  builder: (yargs) =>
    yargs.option('max-agents', {
      alias: 'm',
      describe: 'Maximum number of parallel dev agents',
      type: 'number',
      default: 3,
    }),
  handler: async (argv: any) => {
    await runSwarmWorkflow({ maxAgents: argv.maxAgents });
  },
};
