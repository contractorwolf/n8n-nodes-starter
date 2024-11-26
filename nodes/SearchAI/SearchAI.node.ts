import {
    IExecuteFunctions,
    INodeExecutionData,
    INodeType,
    INodeTypeDescription,
} from 'n8n-workflow';

import { Summarizer } from './services/Summarizer'
// import chalk from 'chalk';

export class SearchAI implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'Search AI',
        name: 'SearchAI',
        icon: 'file:searchai.svg',
        group: ['transform'],
        version: 1,
        description: 'Deeply Google searches a topic and uses AI to write a summary description',
        defaults: {
            name: 'Search AI',
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
                displayName: 'Search Query',
                name: 'searchQuery',
                type: 'string',
                default: '',
                placeholder: 'Enter topic to be searched',
                description: 'Your query to be searched',
                required: true,
            },
        ],
    };

    async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
        const items = this.getInputData();
        const returnData: INodeExecutionData[] = [];

        try {

						const credentials = await this.getCredentials('openAiApi');

						const apiKey = credentials?.apiKey.toString();

						const summarizer = new Summarizer(apiKey);

            // Process each input item
            for (let i = 0; i < items.length; i++) {
                const searchQuery = this.getNodeParameter('searchQuery', i) as string;

                try {
                    const result = await summarizer.search(searchQuery);

                    console.log("Summary:");
                    console.log(result);

										// Prepare the output
										returnData.push({
												json: {
														searchQuery,
														content: result,
												},
										});

                } catch (error) {
                    console.error(error.message);
                }
            }
            return [returnData];

        } catch (error) {
            this.logger.error('Error loading credentials:', error.message);
            throw error;
        }
    }
}
