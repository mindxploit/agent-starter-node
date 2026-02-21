import {
  type JobContext,
  ServerOptions,
  cli,
  defineAgent,
  voice,
} from '@livekit/agents';
import * as openai from '@livekit/agents-plugin-openai';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { Agent } from './agent';

dotenv.config({ path: '.env.local' });

export default defineAgent({
  entry: async (ctx: JobContext) => {
    const session = new voice.AgentSession({
      llm: new openai.realtime.RealtimeModel({
        voice: 'echo',
        // Server VAD: higher threshold filters out silence as false "speech"
        turnDetection: {
          type: 'server_vad',
          threshold: 0.65,
          prefix_padding_ms: 300,
          silence_duration_ms: 600,
          create_response: true,
          interrupt_response: true,
        },
      }),
    });

    await session.start({
      agent: new Agent(),
      room: ctx.room,
    });

    // Debug: conversation messages (user, agent, RAG-injected)
    session.on(voice.AgentSessionEventTypes.ConversationItemAdded, (event) => {
      const preview =
        (event.item.textContent ?? '').slice(0, 30
        ) +
        ((event.item.textContent?.length ?? 0) > 30 ? '...' : '');
      console.log(`[MSG] ${event.item.role}: ${preview}`);
    });
    // Debug: user transcriptions (Realtime API)
    session.on(voice.AgentSessionEventTypes.UserInputTranscribed, (event) => {
      if (event.isFinal)
        console.log(`[TRANSCRIBE] user (Realtime): ${(event as { transcript?: string }).transcript ?? ''}`);
    });

    await ctx.connect();

    // first message to the user
    const handle = session.generateReply({
      instructions: 'Shortly greet the user, introducing yourself as "Cognito", and offer your assistance in a slightly funny yet professional and engaging way, ready to dive into nootropics that can be useful for him.',
    });
    await handle.waitForPlayout();
  },
});

// No agentName = auto dispatch when participant joins
cli.runApp(new ServerOptions({ agent: fileURLToPath(import.meta.url) }));