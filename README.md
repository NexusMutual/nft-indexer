# NFT indexer

Simple NFT indexer that exposes a simplified Alchemy compatible endpoint `/getNFTsForOwner`.

### We use this in dev env! Not for suitable for production!

## How to run

Add the `PORT` and `PROVIDER_URL` to `.env` and run `node src/index.js`.

Pass the URL of this service to the config object of the Alchemy SDK. The Alchemy API key is
redundant, you can pass a dummy one.

Example:

```javascript
import { Alchemy, Network } from 'alchemy-sdk';

const alchemy = new Alchemy({
    apiKey: 'ALCHEMY_API_KEY',
    network: Network.ETH_MAINNET,
    url: 'http://localhost:3000',
});

const vitalik = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
const NFT_CONTRACT_ADDRESS = '<some-nft-contract-address>';

const nftsIterable = alchemy.nft.getNftsForOwnerIterator(vitalik, {
  contractAddresses: [NFT_CONTRACT_ADDRESS],
  omitMetadata: true,
});

const ownedNfts = [];

for await (const nft of nftsIterable) {
  ownedNfts.push(nft.tokenId);
}
```
