import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import {
    TransactionBuilderSendAndConfirmOptions,
    createGenericFile,
    createGenericFileFromJson,
    createSignerFromKeypair,
    generateSigner,
    keypairIdentity,
} from '@metaplex-foundation/umi';
import {
    metadata,
    mint,
    niftyAsset,
    fetchAsset,
    Metadata,
    royalties,
    creators,
    Royalties,
    Creators,
} from '@nifty-oss/asset';
import { readFile } from "fs/promises";
import { uploadToIpfs } from './upload';
import fs from 'fs';
const CLUSTERS = {
    'mainnet': 'https://mainnetbeta-rpc.eclipse.xyz',
    'testnet': 'https://testnet.dev2.eclipsenetwork.xyz',
};

const OPTIONS: TransactionBuilderSendAndConfirmOptions = {
    confirm: { commitment: 'processed' }
};

const NFT_DETAILS = {
    name: "NAME",
    symbol: "SYMBOL",
    royalties: 500,
    description: 'INFO, Guide by ZunXBT',
    imgType: 'image/jpg',
    attributes: [
        { trait_type: 'Accuracy', value: 'Very High' },
    ]
};

const PINATA_API_KEY = 'ZUNXBT1'; // 👈 Replace with your Pinata API key
const PINATA_SECRET_KEY = 'ZUNXBT2'; // 👈 Replace this with your IPFS API endpoint
const umi = createUmi(CLUSTERS.ZUNXBT3, OPTIONS.confirm).use(niftyAsset()); // 👈 Replace this with your cluster
const wallet = './eclipse-wallet.json'; // 👈 Replace this with your wallet path 

const secretKey = JSON.parse(fs.readFileSync(wallet, 'utf-8'));
const keypair = umi.eddsa.createKeypairFromSecretKey(new Uint8Array(secretKey));
umi.use(keypairIdentity(keypair));
const creator = createSignerFromKeypair(umi, keypair);
const owner = creator; // Mint to the creator
const asset = generateSigner(umi);
async function uploadImage(path: string, contentType = 'image/png'): Promise<string> {
    try {
        const image = await readFile(path);
        const fileName = path.split('/').pop() ?? 'unknown.png';
        const genericImage = createGenericFile(image, fileName, { contentType });
        const cid = await uploadToIpfs(genericImage, PINATA_API_KEY, PINATA_SECRET_KEY);
        console.log(`1. ✅ - Uploaded image to IPFS`);
        return cid;
    } catch (error) {
        console.error('1. ❌ - Error uploading image:', error);
        throw error;
    }
}

async function uploadMetadata(imageUri: string): Promise<string> {
    try {
        const gatewayUrl = 'https://gateway.pinata.cloud/ipfs'; // Add IPFS gateway URL
        const fullImageUri = `${gatewayUrl}${imageUri}`; // Full URI for the image

        const metadata = {
            name: NFT_DETAILS.name,
            description: NFT_DETAILS.description,
            image: fullImageUri, // Use full image URI
            attributes: NFT_DETAILS.attributes,
            properties: {
                files: [
                    {
                        type: NFT_DETAILS.imgType,
                        uri: fullImageUri, // Use full image URI
                    },
                ]
            }
        };

        const file = createGenericFileFromJson(metadata, 'metadata.json');
        const cid = await uploadToIpfs(file, PINATA_API_KEY, PINATA_SECRET_KEY);
        console.log(`2. ✅ - Uploaded metadata to IPFS`);
        return cid;
    } catch (error) {
        console.error('2. ❌ - Error uploading metadata:', error);
        throw error;
    }
}
async function mintAsset(metadataUri: string): Promise<void> {
    try {
        await mint(umi, {
            asset,
            owner: owner.publicKey,
            authority: creator.publicKey,
            payer: umi.identity,
            mutable: false,
            standard: 0,
            name: NFT_DETAILS.name,
            extensions: [
                metadata({
                    uri: metadataUri,
                    symbol: NFT_DETAILS.symbol,
                    description: NFT_DETAILS.description,
                }),
                royalties(NFT_DETAILS.royalties),
                creators([{ address: creator.publicKey, share: 100 }]),
            ]
        }).sendAndConfirm(umi, OPTIONS);
        const nftAddress = asset.publicKey.toString();
        console.log(`3. ✅ - Minted a new Asset: ${nftAddress}`);
    } catch (error) {
        console.error('3. ❌ - Error minting a new NFT.', error);
    }
}
async function verifyOnChainData(metadataUri: string): Promise<void> {
    try {
        const assetData = await fetchAsset(umi, asset.publicKey, OPTIONS.confirm);

        const onChainCreators = assetData.extensions.find(ext => ext.type === 3) as Creators;
        const onChainMetadata = assetData.extensions.find(ext => ext.type === 5) as Metadata;
        const onChainRoyalties = assetData.extensions.find(ext => ext.type === 7) as Royalties;

        const checks = [
            // Asset Checks
            { condition: assetData.owner.toString() === owner.publicKey.toString(), message: 'Owner matches' },
            { condition: assetData.publicKey.toString() === asset.publicKey.toString(), message: 'Public key matches' },
            { condition: assetData.name === NFT_DETAILS.name, message: 'Asset name matches' },

            // Creator Extension Checks
            { condition: !!onChainCreators, message: 'Creators extension not found' },
            { condition: onChainCreators.values.length === 1, message: 'Creators length matches' },
            { condition: onChainCreators.values[0].address.toString() === creator.publicKey.toString(), message: 'Creator address matches' },
            { condition: onChainCreators.values[0].share === 100, message: 'Creator share matches' },
            { condition: onChainCreators.values[0].verified === true, message: 'Creator not verified' },

            // Metadata Extension Checks
            { condition: !!onChainMetadata, message: 'Metadata extension not found' },
            { condition: onChainMetadata.symbol === NFT_DETAILS.symbol, message: 'Symbol matches' },
            { condition: onChainMetadata.description === NFT_DETAILS.description, message: 'Description matches' },
            { condition: onChainMetadata.uri === metadataUri, message: 'Metadata URI matches' },

            // Royalties Extension Checks
            { condition: !!onChainRoyalties, message: 'Royalties extension not found' },
            { condition: onChainRoyalties.basisPoints.toString() === NFT_DETAILS.royalties.toString(), message: 'Royalties basis points match' },
        ];

        checks.forEach(({ condition, message }) => {
            if (!condition) throw new Error(`Verification failed: ${message}`);
        });

        console.log(`4. ✅ - Verified Asset Data`);
    } catch (error) {
        console.error('4. ❌ - Error verifying Asset Data:', error);
    }
}
async function main() {
    const imageCid = await uploadImage('./image.jpg'); 
    console.log('Image CID:', imageCid); // Log the image CID
    const metadataCid = await uploadMetadata(imageCid); 
    console.log('Metadata CID:', metadataCid); // Log the metadata CID
    await mintAsset(metadataCid);
    await verifyOnChainData(metadataCid);
}

main();
