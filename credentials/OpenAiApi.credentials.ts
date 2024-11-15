import {
    IAuthenticateGeneric,
    ICredentialTestRequest,
    ICredentialType,
    INodeProperties,
} from 'n8n-workflow';

export class OpenAiApi implements ICredentialType {
    name = 'openAiApi'; // This is the internal name that will be referenced
    displayName = 'OpenAI API'; // This is what users will see
    documentationUrl = 'https://platform.openai.com/docs/api-reference';
    properties: INodeProperties[] = [
        {
            displayName: 'API Key',
            name: 'apiKey',
            type: 'string',
            typeOptions: { password: true },
            required: true,
            default: '',
        }
    ];

    authenticate: IAuthenticateGeneric = {
        type: 'generic',
        properties: {
            headers: {
                Authorization: '=Bearer {{$credentials.apiKey}}'
            },
        },
    };

    test: ICredentialTestRequest = {
        request: {
            baseURL: 'https://api.openai.com',
            url: '/v1/models',
        },
    };
}