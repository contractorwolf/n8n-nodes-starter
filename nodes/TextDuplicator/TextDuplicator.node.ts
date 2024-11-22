import {
    IExecuteFunctions,
    INodeExecutionData,
    INodeType,
    INodeTypeDescription,
} from 'n8n-workflow';
import { chromium } from 'playwright';
import { Summarizer } from './services'

export class TextDuplicator implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'Text Duplicator',
        name: 'TextDuplicator',
        icon: 'file:textduplicator.svg',
        group: ['transform'],
        version: 1,
        description: 'Duplicates input text',
        defaults: {
            name: 'Text Duplicator',
        },
        inputs: ['main'],
        outputs: ['main'],
        credentials: [
            {
                name: 'openAiApi', // This must match the 'name' property in your credentials file
                required: true,
            },
        ],
        properties: [
            {
                displayName: 'Input Text',
                name: 'inputText',
                type: 'string',
                default: '',
                placeholder: 'Enter text to duplicate',
                description: 'The text to be duplicated',
                required: true,
            },
        ],
    };

    async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
        const items = this.getInputData();
        const returnData: INodeExecutionData[] = [];
        const PAGE_TIMEOUT = 45000; // 30 seconds

        var browser = await chromium.launch({ 
            headless: true,
            timeout: PAGE_TIMEOUT 
          });

        try {

            // Process each input item
            for (let i = 0; i < items.length; i++) {

                const credentials = await this.getCredentials('openAiApi');
                let hasCredentials = false;

                if (credentials?.apiKey) {
                    hasCredentials = true;
                    this.logger.info('loading credentials:', { key: credentials.apiKey });
                } else {
                    this.logger.info('no key found');
                }
                
                const inputText = this.getNodeParameter('inputText', i) as string;



                const summarizer = new Summarizer(credentials.apiKey);

                try {
                    const result = await summarizer.search(query);
                    console.log(chalk.green("Summary:"));
                    // Wrap text at 80 characters
                    //const wrappedText = result.match(/.{1,80}(?:\s|$)/g)?.join('\n') || result;
                    console.log(chalk.white(result));
                } catch (error) {
                    console.error(chalk.red("Error:"), error.message);
                    // Log the full error in development
                    if (process.env.NODE_ENV === 'development') {
                        console.error(chalk.red(error));
                    }
                }
                
                // Simple duplication logic
                const duplicatedText = inputText + inputText;

                // Prepare the output
                returnData.push({
                    json: {
                        originalText: inputText,
                        duplicatedText: duplicatedText,
                        browser: typeof browser,
                        hasCredentials,
                        workedOn: '11-21-24'
                    },
                });
            }
            return [returnData];

        } catch (error) {
            this.logger.error('Error loading credentials:', error.message);
            throw error;
        }
    }
}