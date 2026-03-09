import {
  type JobContext,
  type JobProcess,
  ServerOptions,
  cli,
  defineAgent,
  voice,
} from '@livekit/agents';
import * as openai from '@livekit/agents-plugin-openai';
import * as deepgram from '@livekit/agents-plugin-deepgram';
import * as livekit from '@livekit/agents-plugin-livekit';
import * as silero from '@livekit/agents-plugin-silero';
import { BackgroundVoiceCancellation } from '@livekit/noise-cancellation-node';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { Agent } from './agent';

dotenv.config({ path: '.env.local' });

export default defineAgent({
  prewarm: async (proc: JobProcess) => {
    proc.userData.vad = await silero.VAD.load({
      activationThreshold: 0.7,
      minSpeechDuration: 100,
      minSilenceDuration: 600,
    });
  },
  entry: async (ctx: JobContext) => {
    const vad = ctx.proc.userData.vad! as silero.VAD;

    const session = new voice.AgentSession({
      vad,
      turnDetection: new livekit.turnDetector.MultilingualModel(),
      voiceOptions: { minInterruptionWords: 1 },
      stt: new deepgram.STT({
        model: 'nova-3',
        language: 'en',
      }),
      llm: new openai.LLM({
        model: 'gpt-4o',
      }),
      tts: new deepgram.TTS({
        model: 'aura-2-odysseus-en',
      }),
    });

    await session.start({
      agent: new Agent(),
      room: ctx.room,
      inputOptions: {
        // For telephony applications, use `TelephonyBackgroundVoiceCancellation` for best results
        noiseCancellation: BackgroundVoiceCancellation(),
      },
    });

    // Debug: conversation messages
    session.on(voice.AgentSessionEventTypes.ConversationItemAdded, (event) => {
      const preview =
        (event.item.textContent ?? '').slice(0, 30) +
        ((event.item.textContent?.length ?? 0) > 30 ? '...' : '');
      console.log(`[MSG] ${event.item.role}: ${preview}`);
    });
    session.on(voice.AgentSessionEventTypes.UserInputTranscribed, (event) => {
      if ((event as { isFinal?: boolean }).isFinal)
        console.log(`[TRANSCRIBE] user: ${(event as { transcript?: string }).transcript ?? ''}`);
    });

    await ctx.connect();

    const handle = session.generateReply({
      instructions:
        'Shortly greet the user, introducing yourself as "Cognito", and offer your assistance in a slightly funny yet professional and engaging way, ready to dive into nootropics that can be useful for him.',
    });
    await handle.waitForPlayout();
  },
});

// No agentName = auto dispatch when participant joins
cli.runApp(new ServerOptions({ agent: fileURLToPath(import.meta.url) }));