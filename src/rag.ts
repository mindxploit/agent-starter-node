import { QdrantClient } from '@qdrant/js-client-rest';
import OpenAI from 'openai';

const COLLECTION_NAME = 'nootropicsjet';

let qdrant: QdrantClient | null = null;
let openai: OpenAI | null = null;

interface ProductPayload {
  id: number;
  handle: string;
  url: string;
  name: string;
  description: string;
  tags: string[];
  product_type: string;
  image?: string;
  type?: string;
  indexed_at: string;
  embedded_text: string;
  [key: string]: unknown;
}

function getQdrant(): QdrantClient {
  if (!qdrant) {
    const config: { url: string; apiKey?: string; checkCompatibility: boolean } = {
      url: process.env.QDRANT_URL || 'http://localhost:6333',
      checkCompatibility: false,
    };
    if (process.env.QDRANT_API_KEY) {
      config.apiKey = process.env.QDRANT_API_KEY;
    }
    qdrant = new QdrantClient(config);
  }
  return qdrant;
}

function getOpenAI(): OpenAI {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set');
    }
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openai;
}

/** RAG lookup: embed query, search Qdrant, return contextual knowledge string for injection. */
export async function ragLookup(query: string): Promise<string> {
  const text = query?.trim();
  if (!text) return '';

  const embedding = await getOpenAI().embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });

  let results: { payload?: unknown }[] = [];
  try {
    const searchResult = await getQdrant().search(COLLECTION_NAME, {
      vector: embedding.data[0]!.embedding,
      limit: 6,
      with_payload: true,
    });
    results = searchResult as { payload?: unknown }[];
    const preview = text.length > 60 ? `${text.slice(0, 60)}...` : text;
    console.log(`[RAG] query="${preview}" → ${results.length} hits`);
  } catch (e: unknown) {
    if ((e as { status?: number })?.status === 404 || (e as Error)?.message?.includes('Not Found')) {
      return '';
    }
    throw e;
  }

  return results
    .map((r) => {
      const p = (r.payload ?? null) as ProductPayload | null;
      if (!p) return '';
      if (p.embedded_text) return p.embedded_text;
      return `
Product: ${p.name ?? 'Unknown'}
Description: ${p.description ?? ''}
${p.product_type ? `Type: ${p.product_type}\n` : ''}
URL: ${p.url ?? ''}
`.trim();
    })
    .filter(Boolean)
    .join('\n---\n');
}

// Tags: ${Array.isArray(p.tags) ? p.tags.join(', ') : ''}
// Image: ${p.image ?? ''}