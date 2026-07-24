import OpenAI from 'openai';
import type { Book } from '@/types';

let openaiInstance: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiInstance) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set');
    }
    openaiInstance = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiInstance;
}

/**
 * Generate embedding for text using OpenAI
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const openai = getOpenAI();
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
    dimensions: 384,
  });

  return response.data[0].embedding;
}

/**
 * Generate embedding for a book
 */
export async function generateBookEmbedding(book: Book): Promise<number[]> {
  const text = `${book.title} ${book.description || ''} ${book.genre}`.trim();
  return generateEmbedding(text);
}
