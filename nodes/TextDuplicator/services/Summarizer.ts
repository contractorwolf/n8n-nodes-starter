// nodes/TextDuplicator/services/Summarizer.ts

import OpenAI from 'openai';

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

  private getTimeElapsed(start: number): string {
    return `${Date.now() - start}ms`;
  }

  public async search(query: string, resultsRequested: number = 5): Promise<{ 
    summary: string;
    metrics: TimeMetrics;
  }> {
    const metrics: TimeMetrics = {
      startTime: Date.now()
    };

    try {
      if (!query) {
        throw new Error('Query cannot be empty');
      }

      if (resultsRequested < 1) {
        throw new Error('Results requested must be greater than 0');
      }

      // Process chunks
      const chunks = this.splitText(query);
      metrics.chunkTime = Date.now();
      
      // Generate embeddings
      const embeddings = await Promise.all(
        chunks.map(chunk => this.getEmbeddings(chunk))
      );
      metrics.embedTime = Date.now();

      // Store embeddings
      embeddings.forEach((embedding, i) => {
        if (this.vectors.length >= Summarizer.MAX_VECTORS) {
          this.vectors.shift();
          this.items.shift();
        }
        this.vectors.push(embedding);
        this.items.push(i);
      });

      // Generate query embedding and find similarities
      const queryEmbedding = await this.getEmbeddings(query);
      const similarities: SearchResult[] = this.vectors.map((vec, index) => ({
        id: this.items[index],
        score: this.cosineSimilarity(queryEmbedding, vec)
      }));

      const searchResults = similarities
        .sort((a, b) => b.score - a.score)
        .slice(0, Math.min(resultsRequested, similarities.length));

      metrics.searchTime = Date.now();

      // Generate summary
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

      metrics.summaryTime = Date.now();

      if (!completion.choices[0]?.message?.content) {
        throw new Error('No response generated from OpenAI');
      }

      return {
        summary: completion.choices[0].message.content,
        metrics
      };

    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Search operation failed: ${error.message}`);
      }
      throw new Error('Unknown error during search operation');
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