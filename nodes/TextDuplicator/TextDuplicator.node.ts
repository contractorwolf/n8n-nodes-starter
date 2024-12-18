import {
    IExecuteFunctions,
    INodeExecutionData,
    INodeType,
    INodeTypeDescription,
} from 'n8n-workflow';

import { Summarizer } from './services/Summarizer'
// import chalk from 'chalk';

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

        try {

            // Process each input item
            for (let i = 0; i < items.length; i++) {

                const credentials = await this.getCredentials('openAiApi');

								let apiKey = '';


                let hasCredentials = false;

                if (credentials?.apiKey) {
                    hasCredentials = true;
										apiKey = credentials?.apiKey.toString();
                    this.logger.info('loading credentials:', { key: apiKey });

                } else {
                    this.logger.info('no key found');
                }

                const inputText = this.getNodeParameter('inputText', i) as string;

                const summarizer = new Summarizer(apiKey);

                try {
                    const result = await summarizer.search(inputText);
                    console.log("Summary:");

                    console.log(result);


										// Prepare the output
										returnData.push({
												json: {
													inputText,
														content: result,
														hasCredentials,
														workedOn: '11-26-24'
												},
										});

                } catch (error) {
                    console.error(error.message);
                    // Log the full error in development
                }


            }
            return [returnData];

        } catch (error) {
            this.logger.error('Error loading credentials:', error.message);
            throw error;
        }
    }
}
