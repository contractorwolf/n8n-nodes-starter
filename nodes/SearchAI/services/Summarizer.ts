// nodes/TextDuplicator/services/Summarizer.ts

import OpenAI from 'openai';
import { PageManager } from './PageManager';

interface SearchResult {
  id: number;
  score: number;
}

interface TimeMetrics {
  startTime: number;
  fetchTime?: number;
  chunkTime?: number;
  embedTime?: number;
  searchTime?: number;
  summaryTime?: number;
	chunkProcessingTime?: number;
}

export class Summarizer {
  private openai: OpenAI;
  private vectors: number[][];
  private items: number[];

  static readonly EMBEDDING_DIMENSION = 1536;
  static readonly MAX_VECTORS = 1000;
  static readonly GPT_MODEL = "gpt-4o";

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
    this.vectors = [];
    this.items = [];
  }

  private splitText(text: string, chunkSize: number = 1000, overlap: number = 100): string[] {
    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      chunks.push(text.slice(start, start + chunkSize));
      start += chunkSize - overlap;
    }
    return chunks;
  }

  private async getEmbeddings(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: "text-embedding-ada-002",
        input: text,
      });

      const embedding = response.data[0].embedding;
      if (embedding.length !== Summarizer.EMBEDDING_DIMENSION) {
        throw new Error(`Unexpected embedding dimension: ${embedding.length}`);
      }

      return embedding;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Embedding generation failed: ${error.message}`);
      }
      throw new Error('Unknown error during embedding generation');
    }
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== Summarizer.EMBEDDING_DIMENSION ||
        vecB.length !== Summarizer.EMBEDDING_DIMENSION) {
      throw new Error(`Invalid vector dimensions: ${vecA.length}, ${vecB.length}`);
    }

    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));

    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0;
    }

    return dotProduct / (magnitudeA * magnitudeB);
  }

  // private getTimeElapsed(start: number): string {
  //   return `${Date.now() - start}ms`;
  // }

	public async search(query: string, resultsRequested: number = 5): Promise<{
		summary: string;
		metrics: TimeMetrics;
	}> {
		// Initialize metrics to track performance
		const metrics: TimeMetrics = {
			startTime: Date.now(),
			fetchTime: 0,
			chunkProcessingTime: 0,
			embedTime: 0,
			searchTime: 0,
			summaryTime: 0
		};

		try {
			// Validate the input query
			if (!query) {
				throw new Error('Query cannot be empty');
			}

			console.log('Starting search process...');

			// Fetch relevant content using getSearchContent
			console.log('Fetching web content for query:', query);
			const fetchStart = Date.now();
			const content = await PageManager.getSearchContent(query);
			metrics.fetchTime = Date.now() - fetchStart; // Calculate fetch duration
			console.log(`Retrieved ${content.length} characters of content in ${metrics.fetchTime}ms`);

			// Add the fetched content using addContent (encapsulated logic)
			console.log('Adding content to vectors...');
			const chunkStart = Date.now();
			await this.addContent(content);
			metrics.chunkProcessingTime = Date.now() - chunkStart; // Calculate chunk processing duration

			// Generate an embedding for the query
			console.log('Generating query embedding...');
			const embedStart = Date.now();
			const queryEmbedding = await this.getEmbeddings(query);
			metrics.embedTime = Date.now() - embedStart; // Calculate embedding generation duration

			// Compute similarities between the query embedding and stored embeddings
			console.log('Finding similarities...');
			const searchStart = Date.now();
			const similarities: SearchResult[] = this.vectors.map((vec, index) => ({
				id: this.items[index], // Retrieve the chunk ID
				score: this.cosineSimilarity(queryEmbedding, vec) // Compute similarity score
			}));

			// Sort results by similarity score in descending order
			const searchResults = similarities
				.sort((a, b) => b.score - a.score)
				.slice(0, Math.min(resultsRequested, similarities.length)); // Limit to requested results
			metrics.searchTime = Date.now() - searchStart; // Calculate similarity search duration

			// Generate a summary of the results
			console.log('Requesting summary from OpenAI...');
			const summaryStart = Date.now();
			const completion = await this.openai.chat.completions.create({
				model: Summarizer.GPT_MODEL,
				messages: [
					{
						role: "system",
						content: "Act as a professional investigative journalist and provide a detailed explanation based on the provided context."
					},
					{
						role: "user",
						content: `Question: ${query}\n\nContext: ${searchResults.map(r =>
							`Result ${r.id}: Similarity ${r.score.toFixed(4)}`
						).join('\n')}`
					}
				]
			});
			metrics.summaryTime = Date.now() - summaryStart; // Calculate summary generation duration

			// Ensure the summary content exists and return it
			console.log('Summary generated successfully...');
			if (!completion.choices[0]?.message?.content) {
				throw new Error('No response generated from OpenAI');
			}

			return {
				summary: completion.choices[0].message.content,
				metrics
			};

		} catch (error) {
			// Handle and re-throw any errors encountered during the search process
			console.error('Error during search operation:', error);
			throw new Error(`Search operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}


  public async addContent(content: string): Promise<void> {
    if (!content) {
      throw new Error('Content cannot be empty');
    }

    try {
      const chunks = this.splitText(content);
      const embeddings = await Promise.all(
        chunks.map(chunk => this.getEmbeddings(chunk))
      );

      embeddings.forEach((embedding, index) => {
        if (this.vectors.length >= Summarizer.MAX_VECTORS) {
          this.vectors.shift();
          this.items.shift();
        }
        this.vectors.push(embedding);
        this.items.push(index);
      });
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Content addition failed: ${error.message}`);
      }
      throw new Error('Unknown error during content addition');
    }
  }
}
