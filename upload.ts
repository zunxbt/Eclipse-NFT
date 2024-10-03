
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

// Utility to validate Pinata API headers
const validatePinataHeaders = (headers: Headers) => {
    ['pinata_api_key', 'pinata_secret_api_key'].forEach((key) => {
        if (!headers.has(key)) {
            throw new Error(`Missing required Pinata API header: ${key}`);
        }
    });
};

// Creates a custom fetch for Pinata requests
const createPinataFetch = (): HttpInterface => ({
    send: async <ResponseData, RequestData = unknown>(
        req: HttpRequest<RequestData>
    ): Promise<HttpResponse<ResponseData>> => {
        const headers = new Headers(req.headers as Record<string, string>);
        validatePinataHeaders(headers);

        const body = headers.get('content-type')?.includes('application/json') && req.data
            ? JSON.stringify(req.data)
            : req.data as string | undefined;

        try {
            const response = await fetch(req.url, {
                method: req.method,
                headers,
                body,
                redirect: 'follow',
                signal: req.signal as AbortSignal,
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
            throw new Error('Request to Pinata failed');
        }
    },
});

// Utility to check if the HTTP response was successful
const checkResponse = (response: HttpResponse<any>) => {
    if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
};

// Function to upload a file to IPFS via Pinata
const uploadToIpfs = async (
    file: GenericFile,
    apiKey: string,
    secretKey: string
): Promise<string> => {
    const http = createPinataFetch();
    const endpoint = 'https://api.pinata.cloud/pinning/pinFileToIPFS';
    const formData = new FormData();

    // Create a Blob for the file, handling content type if provided
    const fileBlob = new Blob([file.buffer], { type: file.contentType ?? '' });
    formData.append('file', fileBlob, file.fileName);

    const pinataRequest = request()
        .withEndpoint('POST', endpoint)
        .withHeader('pinata_api_key', apiKey)
        .withHeader('pinata_secret_api_key', secretKey)
        .withData(formData);

    try {
        const response = await http.send<PinataUploadResponse, FormData>(pinataRequest);
        checkResponse(response);
        return response.data.IpfsHash; // Return the IPFS hash from the response
    } catch (error) {
        console.error('Failed to upload to IPFS:', error);
        throw error;
    }
};

export { uploadToIpfs };
