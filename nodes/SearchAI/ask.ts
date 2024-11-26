// $ ts-node ask 'What is the GPS position of Barcelona?'

// import chalk from 'chalk';
import { Summarizer } from './services/Summarizer';


interface TimeMetrics {
  startTime: number;
  fetchTime?: number;
  chunkTime?: number;
  embedTime?: number;
  searchTime?: number;
  summaryTime?: number;
}


// Ensure we have an API key
const apiKey: string = '';

// Main function
async function run(userQuestion: string): Promise<void> {
    const summarizer = new Summarizer(apiKey);

    // Use command line argument if provided, otherwise use default question
    const query: string = process.argv[2] || userQuestion;
    console.log(`Searching for: ${query}`);

    try {
        const result: {summary: string; metrics: TimeMetrics} = await summarizer.search(query);
        console.log("Summary:");
        console.log(result.summary);
    } catch (error: any) {
        console.error(error.message);
        // Log the full error in development
        if (process.env.NODE_ENV === 'development') {
            console.error(error);
        }
    }
}

// Default test question if no command line argument is provided
const defaultQuestion: string = "What is the GPS position of Barcelona?";

// Execute the test
run(defaultQuestion).catch(error => {
    console.error(error);
    process.exit(1);
});
