import { ethers } from 'ethers';
import memoize from 'fast-memoize';
import { LOCAL_STORAGE_KEYS } from 'lib/constants';
import { getRPCUrl, logError } from 'lib/helpers';

const {
  MAINNET_RPC_URL,
  KOVAN_RPC_URL,
  BSC_RPC_URL,
  SOKOL_RPC_URL,
  XDAI_RPC_URL,
} = LOCAL_STORAGE_KEYS;

const RPC_URL = {
  1: MAINNET_RPC_URL,
  42: KOVAN_RPC_URL,
  56: BSC_RPC_URL,
  77: SOKOL_RPC_URL,
  100: XDAI_RPC_URL,
};

const memoized = memoize(
  url => new ethers.providers.StaticJsonRpcProvider(url),
);

const promiseWithTimeout = async (timeoutMs, promise, failureMessage) => {
  let timeoutHandle;
  const timeoutPromise = new Promise((_resolve, reject) => {
    timeoutHandle = setTimeout(
      () => reject(new Error(failureMessage)),
      timeoutMs,
    );
  });

  return Promise.race([promise, timeoutPromise]).then(result => {
    clearTimeout(timeoutHandle);
    return result;
  });
};

export const getEthersProvider = async chainId => {
  const localRPCUrl = window.localStorage.getItem(RPC_URL[chainId]);
  const rpcURLs = localRPCUrl
    ? [localRPCUrl].concat(getRPCUrl(chainId, true))
    : getRPCUrl(chainId, true);
  const provider = (
    await Promise.any(
      rpcURLs.map(async url => {
        const tempProvider = memoized(url);
        if (!tempProvider) return tempProvider;
        try {
          // eslint-disable-next-line no-underscore-dangle
          await promiseWithTimeout(
            10000,
            tempProvider._networkPromise,
            `RPC Timeout: ${url} did not respond in time`,
          );
          return tempProvider;
        } catch (err) {
          logError({ providerSetError: err.message });
          return null;
        }
      }),
    )
  );
  return provider || null;
};

export const isEIP1193 = ethersProvider =>
  ethersProvider &&
  ethersProvider.connection &&
  ethersProvider.connection.url &&
  ethersProvider.connection.url.includes('eip-1193');
