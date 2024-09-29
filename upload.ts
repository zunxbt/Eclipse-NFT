// upload.ts

import {
    GenericFile,
    request,
    HttpInterface,
    HttpRequest,
    HttpResponse,
} from '@metaplex-foundation/umi';

interface PinataUploadResponse {
    IpfsHash: string;
    PinSize: number;
    Timestamp: string;
}

const createPinataFetch = (): HttpInterface => ({
    send: async <ResponseData, RequestData = unknown>(request: HttpRequest<RequestData>): Promise<HttpResponse<ResponseData>> => {
        let headers = new Headers(
            Object.entries(request.headers).map(([name, value]) => [name, value] as [string, string])
        );

        if (!headers.has('pinata_api_key') || !headers.has('pinata_secret_api_key')) {
            throw new Error('Missing Pinata API headers');
        }

        const isJsonRequest = headers.get('content-type')?.includes('application/json') ?? false;
        const body = isJsonRequest && request.data ? JSON.stringify(request.data) : request.data as string | undefined;

        try {
            const response = await fetch(request.url, {
                method: request.method,
                headers,
                body,
                redirect: 'follow',
                signal: request.signal as AbortSignal,
            });

            const bodyText = await response.text();
            const isJsonResponse = response.headers.get('content-type')?.includes('application/json');
            const data = isJsonResponse ? JSON.parse(bodyText) : bodyText;

            return {
                data,
                body: bodyText,
                ok: response.ok,
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries()),
            };
        } catch (error) {
            console.error('Fetch request failed:', error);
            throw error;
        }
    },
});

const uploadToIpfs = async <T>(
    file: GenericFile,
    apiKey: string,
    secretKey: string
): Promise<string> => {
    const http = createPinataFetch();
    const endpoint = 'https://api.pinata.cloud/pinning/pinFileToIPFS';
    const formData = new FormData();

    // Handle null values for contentType
    const fileBlob = new Blob([file.buffer], { type: file.contentType || undefined });

    formData.append('file', fileBlob, file.fileName);

    const pinataRequest = request()
        .withEndpoint('POST', endpoint)
        .withHeader('pinata_api_key', apiKey)
        .withHeader('pinata_secret_api_key', secretKey)
        .withData(formData);

    try {
        const response = await http.send<PinataUploadResponse, FormData>(pinataRequest);
        if (!response.ok) throw new Error(`${response.status} - Failed to send request: ${response.statusText}`);
        return response.data.IpfsHash; // Get the IPFS hash from the response
    } catch (error) {
        console.error('Failed to send request:', error);
        throw error;
    }
};


export { uploadToIpfs };
