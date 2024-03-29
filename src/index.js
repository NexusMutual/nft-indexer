require('dotenv').config();

const express = require('express');
const ethers = require('ethers');

const COVER_NFT = '0xcafeaca76be547f14d0220482667b42d8e7bc3eb';
const STAKING_NFT = '0xcafea508a477d94c502c253a58239fb8f948e97f';

const ERC721 = [
  'function totalSupply() external view returns (uint256)',
  'function ownerOf(uint256 tokenId) external view returns (address)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed id)',
];

const { PORT = 3000, PROVIDER_URL } = process.env;

const provider = new ethers.providers.JsonRpcProvider(PROVIDER_URL);

const chunk = (arr, size) => {
  const chunked = [];
  const clone = [...arr];
  while (clone.length) {
    chunked.push(clone.splice(0, size));
  }
  return chunked;
};

const fetchOwners = async nftContract => {
  const supply = await nftContract.totalSupply();
  const nftsByOwner = {};

  const ids = Array.from({ length: supply }, (_, i) => i + 1);
  const chunks = chunk(ids, 50);
  const owners = [];

  for (const chunk of chunks) {
    const promises = chunk.map(async id => ({ id, owner: await nftContract.ownerOf(id) }));
    const results = await Promise.all(promises);
    owners.push(...results);
  }

  owners.forEach(({ id, owner }) => {
    nftsByOwner[owner] = nftsByOwner[owner] ? [...nftsByOwner[owner], id] : [id];
  });

  return nftsByOwner;
};

const indexer = async address => {
  let lastBlock = await provider.getBlockNumber();
  const contract = new ethers.Contract(address, ERC721, provider);
  const nfts = await fetchOwners(contract);

  const scanForTransfers = async () => {
    const newestBlock = await provider.getBlockNumber();

    if (newestBlock === lastBlock) {
      return;
    }

    const events = await contract.queryFilter('Transfer', lastBlock + 1, 'latest');
    lastBlock = newestBlock;

    events.forEach(event => {
      const { from, to, id } = event.args;
      console.log(`Transfer event: ${from} -> ${to} (id: ${id})`);

      if (from === ethers.constants.AddressZero) {
        nfts[to] = nfts[to] ? [...nfts[to], id] : [id];
      } else {
        nfts[from] = nfts[from].filter(nftId => nftId !== id);
        nfts[to] = nfts[to] ? [...nfts[to], id] : [id];
      }
    });
  };

  const onTimeout = () => {
    scanForTransfers()
      .catch(console.error)
      .then(() => setTimeout(onTimeout, 5000));
  };

  onTimeout();

  return owner => nfts[owner] || [];
};

const nftObject = (address, id) => ({
  contractAddress: address,
  tokenId: id.toString(),
  balance: '1',
});

const route = indexers => (req, res) => {
  const { contractAddresses, owner, withMetadata } = req.query;
  console.log({ contractAddresses, owner, withMetadata });

  if (!owner) {
    console.log('Missing owner');
    return res.status(400).send({ error: 'Missing owner' });
  }

  if (withMetadata !== 'false') {
    console.log('Metadata retrieval is not supported');
    return res.status(400).send({ error: 'Metadata retrieval is not supported' });
  }

  if (!contractAddresses || !Array.isArray(contractAddresses)) {
    console.log('Invalid contractAddresses');
    return res.status(400).send({ error: 'Invalid contractAddresses' });
  }

  const ownedNfts = contractAddresses
    .map(address => address.toLowerCase())
    .flatMap(address => {
      const ids = indexers[address](owner);
      return ids.map(id => nftObject(address, id));
    });

  const pageKey = null;
  const totalCount = ownedNfts.length;
  const validAt = {
    blockNumber: '0',
    blockHash: '0x',
    blockTimestamp: '0',
  };

  res.json({ ownedNfts, totalCount, validAt, pageKey });
};

const main = async () => {
  console.log('Starting NFT indexer');

  const indexers = {
    [COVER_NFT]: await indexer(COVER_NFT),
    [STAKING_NFT]: await indexer(STAKING_NFT),
  };

  console.log('Initial indexing finished');

  const app = express();
  app.get('/getNFTsForOwner', route(indexers));

  app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
};

main().catch(error => {
  console.error(error);
  process.exit(1);
});
