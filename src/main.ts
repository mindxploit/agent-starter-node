import {
  type JobContext,
  type JobProcess,
  ServerOptions,
  cli,
  defineAgent,
  voice,
} from '@livekit/agents';
import * as openai from '@livekit/agents-plugin-openai';
import * as cartesia from '@livekit/agents-plugin-cartesia';
import * as deepgram from '@livekit/agents-plugin-deepgram';
import * as livekit from '@livekit/agents-plugin-livekit';
import * as silero from '@livekit/agents-plugin-silero';
import { BackgroundVoiceCancellation } from '@livekit/noise-cancellation-node';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { Agent } from './agent';

dotenv.config({ path: '.env.local' });

export default defineAgent({
  entry: async (ctx: JobContext) => {
    const session = new voice.AgentSession({
      turnDetection: new livekit.turnDetector.MultilingualModel(),
      voiceOptions: { minInterruptionWords: 1, useTtsAlignedTranscript: false },
      stt: new deepgram.STT({
        model: 'nova-3',
        language: 'en',
      }),
      llm: new openai.LLM({
        model: 'gpt-4o',
      }),
      tts: new cartesia.TTS({
        model: 'sonic-3',
        voice: 'a167e0f3-df7e-4d52-a9c3-f949145efdab', // Blake
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