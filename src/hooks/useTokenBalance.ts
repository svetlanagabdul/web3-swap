import { zeroAddress } from 'viem'
import { useBalance, useConnection, useReadContract } from 'wagmi'

import { erc20Abi } from '../config/erc20'
import type { Token } from '../data/tokens'

export function useTokenBalance(token: Token) {
  const { address, isConnected } = useConnection()

  const isNativeToken = token.symbol === 'ETH'

  const {
    data: nativeBalance,
    refetch: refetchNativeBalance,
  } = useBalance({
    address,
    query: {
      enabled:
        isConnected &&
        !!address &&
        isNativeToken,
    },
  })

  const {
    data: tokenBalance,
    refetch: refetchTokenBalance,
  } = useReadContract({
    address: token.address ?? zeroAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled:
        isConnected &&
        !!address &&
        !isNativeToken &&
        !!token.address,
    },
  })

  const balance =
    isNativeToken
      ? nativeBalance?.value
      : tokenBalance

  async function refetch() {
    if (isNativeToken) {
      await refetchNativeBalance()
      return
    }

    await refetchTokenBalance()
  }

  return {
    balance,
    refetch,
  }
}