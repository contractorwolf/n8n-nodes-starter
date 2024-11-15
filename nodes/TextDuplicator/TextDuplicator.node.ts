import {
    IExecuteFunctions,
    INodeExecutionData,
    INodeType,
    INodeTypeDescription,
} from 'n8n-workflow';

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
                let hasCredentials = false;

                if (credentials?.apiKey) {
                    hasCredentials = true;
                    this.logger.info('loading credentials:', { key: credentials.apiKey });
                } else {
                    this.logger.info('no key found');
                }
                
                const inputText = this.getNodeParameter('inputText', i) as string;
                
                // Simple duplication logic
                const duplicatedText = inputText + inputText;

                // Prepare the output
                returnData.push({
                    json: {
                        originalText: inputText,
                        duplicatedText: duplicatedText,
                        hasCredentials
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