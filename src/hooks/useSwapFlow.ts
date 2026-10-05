import { useEffect, useRef, useState } from 'react'
import { zeroAddress } from 'viem'
import {
  useChainId,
  useChains,
  useConfig,
  useConnection,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi'
import { simulateContract } from 'wagmi/actions'
import { sepolia } from 'wagmi/chains'

import { erc20Abi } from '../config/erc20'
import { PERMIT2_ADDRESS, permit2Abi } from '../config/permit2'
import {
  UNISWAP_UNIVERSAL_ROUTER,
  UNISWAP_V3_QUOTER_V2,
  quoterV2Abi,
} from '../config/uniswap'
import { tokens, type Token } from '../data/tokens'
import {
  formatAmount,
  formatRate,
  guaranteedAmountOut,
  parseAmount,
  SLIPPAGE_PERCENT_LABEL,
} from '../swap/amount'
import { buildRouterCall, buildWrapCall, V3_POOL_FEE } from '../swap/calldata'
import { resolveAmountOut, resolveRoute } from '../swap/route'
import { useTokenBalance } from './useTokenBalance'

type PendingKind = 'approve' | 'permit2' | 'swap'

type PreparedTx = {
  address: `0x${string}`
  abi: readonly unknown[]
  functionName: string
  args?: readonly unknown[]
  value?: bigint
  chainId: typeof sepolia.id
}

type Params = {
  payToken: Token
  receiveToken: Token
  amount: string
  isAmountValid: boolean
  onCompleted: () => void
}

function isUserRejection(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false
  }

  const candidate = error as {
    name?: string
    code?: number
    message?: string
    shortMessage?: string
  }

  if (candidate.name === 'UserRejectedRequestError') {
    return true
  }

  if (candidate.code === 4001) {
    return true
  }

  const text = `${candidate.shortMessage ?? ''} ${candidate.message ?? ''}`.toLowerCase()
  return text.includes('user rejected') || text.includes('user denied')
}

function errorMessage(error: unknown) {
  if (isUserRejection(error)) {
    return 'Request cancelled'
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  if (
    error &&
    typeof error === 'object' &&
    'shortMessage' in error &&
    typeof error.shortMessage === 'string'
  ) {
    return error.shortMessage
  }

  return 'Transaction failed'
}

export function useSwapFlow({
  payToken,
  receiveToken,
  amount,
  isAmountValid,
  onCompleted,
}: Params) {
  const config = useConfig()
  const chainId = useChainId()
  const chains = useChains()
  const { address } = useConnection()
  const {
    switchChainAsync,
    isPending: isSwitching,
  } = useSwitchChain()
  const { refetch: refetchPayTokenBalance } = useTokenBalance(payToken)

  const onCompletedRef = useRef(onCompleted)
  onCompletedRef.current = onCompleted

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [successHash, setSuccessHash] = useState<`0x${string}` | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const [pendingKind, setPendingKind] = useState<PendingKind | null>(null)
  const handledHash = useRef<string | undefined>(undefined)

  const wethAddress =
    tokens.find((token) => token.symbol === 'WETH')?.address ??
    zeroAddress

  const currentChain = chains.find((chain) => chain.id === chainId)
  const isSepolia = chainId === sepolia.id

  const route = resolveRoute(payToken, receiveToken, wethAddress)
  const parsedAmount = parseAmount(amount, payToken.decimals)
  const amountIn =
    amount && isAmountValid ? parsedAmount ?? 0n : 0n

  const isSupportedPair = route.kind !== 'unsupported'
  const needsPermit2 =
    route.kind === 'v3-swap' && route.needsPermit2

  const quoteTokenInAddress =
    route.kind === 'v3-swap' ? route.tokenIn : zeroAddress
  const quoteTokenOutAddress =
    route.kind === 'v3-swap' ? route.tokenOut : zeroAddress

  const quoteEnabled =
    isSepolia &&
    route.kind === 'v3-swap' &&
    amountIn > 0n &&
    quoteTokenInAddress !== zeroAddress &&
    quoteTokenOutAddress !== zeroAddress

  const {
    data: quoteData,
    isPending: isQuotePending,
    isError: isQuoteError,
    error: quoteError,
  } = useReadContract({
    address: UNISWAP_V3_QUOTER_V2,
    abi: quoterV2Abi,
    functionName: 'quoteExactInputSingle',
    args: [
      {
        tokenIn: quoteTokenInAddress,
        tokenOut: quoteTokenOutAddress,
        amountIn,
        fee: V3_POOL_FEE,
        sqrtPriceLimitX96: 0n,
      },
    ],
    query: {
      enabled: quoteEnabled,
    },
  })

  const amountOut = resolveAmountOut(route, amountIn, quoteData?.[0])
  const applySlippage = route.kind === 'v3-swap'
  const amountOutMinimum =
    amountOut !== undefined
      ? guaranteedAmountOut(amountOut, applySlippage)
      : 0n
  const formattedAmountOut =
    amountOut !== undefined
      ? formatAmount(amountOut, receiveToken.decimals)
      : ''
  const formattedMinReceived =
    amountOut !== undefined
      ? formatAmount(amountOutMinimum, receiveToken.decimals)
      : ''
  const rate =
    amountOut !== undefined
      ? formatRate(
          amountIn,
          amountOut,
          payToken.decimals,
          receiveToken.decimals,
        )
      : null

  const {
    data: tokenAllowance,
    refetch: refetchTokenAllowance,
  } = useReadContract({
    address: payToken.address ?? zeroAddress,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address ? [address, PERMIT2_ADDRESS] : undefined,
    query: {
      enabled:
        !!address &&
        !!payToken.address &&
        isSepolia &&
        needsPermit2,
    },
  })

  const {
    data: permit2Allowance,
    refetch: refetchPermit2Allowance,
  } = useReadContract({
    address: PERMIT2_ADDRESS,
    abi: permit2Abi,
    functionName: 'allowance',
    args:
      address && payToken.address
        ? [address, payToken.address, UNISWAP_UNIVERSAL_ROUTER]
        : undefined,
    query: {
      enabled:
        !!address &&
        !!payToken.address &&
        isSepolia &&
        needsPermit2,
    },
  })

  const hasTokenAllowance =
    !needsPermit2 ||
    (tokenAllowance !== undefined && tokenAllowance >= amountIn)

  const permit2Amount = permit2Allowance?.[0] ?? 0n
  const permit2Expiration = Number(permit2Allowance?.[1] ?? 0)
  const hasPermit2Allowance =
    !needsPermit2 ||
    (permit2Amount >= amountIn &&
      permit2Expiration > Math.floor(Date.now() / 1000))

  const canSwap =
    isSepolia &&
    isSupportedPair &&
    amountIn > 0n &&
    amountOut !== undefined &&
    hasTokenAllowance &&
    hasPermit2Allowance

  const {
    writeContractAsync,
    data: hash,
    isPending: isWaitingForWallet,
    reset: resetWrite,
  } = useWriteContract()

  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
  } = useWaitForTransactionReceipt({
    hash,
  })

  useEffect(() => {
    if (!isConfirmed || !hash || handledHash.current === hash) {
      return
    }

    handledHash.current = hash

    if (pendingKind === 'approve') {
      void refetchTokenAllowance()
    }

    if (pendingKind === 'permit2') {
      void refetchPermit2Allowance()
    }

    if (pendingKind === 'swap') {
      setSuccess(true)
      setSuccessHash(hash)
      void refetchPayTokenBalance()
      void refetchTokenAllowance()
      void refetchPermit2Allowance()
      onCompletedRef.current()
    }

    setPendingKind(null)
  }, [
    hash,
    isConfirmed,
    pendingKind,
    refetchPayTokenBalance,
    refetchPermit2Allowance,
    refetchTokenAllowance,
  ])

  async function sendCheckedTx(
    kind: PendingKind,
    request: PreparedTx,
  ) {
    setPendingKind(kind)
    setIsChecking(true)

    try {
      await simulateContract(config, {
        address: request.address,
        abi: request.abi,
        functionName: request.functionName,
        args: request.args,
        value: request.value,
        chainId: request.chainId,
        account: address,
        // wagmi overloads collapse `value` when the request is untyped
      } as never)
      await writeContractAsync(request as never)
    } catch (caught) {
      setPendingKind(null)
      setError(errorMessage(caught))
      resetWrite()
    } finally {
      setIsChecking(false)
    }
  }

  const isBusy =
    isSwitching || isChecking || isWaitingForWallet || isConfirming

  async function submit() {
    if (!address || isBusy) {
      return
    }

    setError(null)
    setSuccess(false)
    setSuccessHash(null)

    if (!isSepolia) {
      try {
        await switchChainAsync({ chainId: sepolia.id })
      } catch (caught) {
        setError(errorMessage(caught))
      }
      return
    }

    if (
      !amount ||
      !isAmountValid ||
      amountIn <= 0n ||
      amountOut === undefined ||
      !isSupportedPair
    ) {
      return
    }

    if (route.kind === 'wrap') {
      if (route.weth === zeroAddress) {
        return
      }

      await sendCheckedTx('swap', {
        ...buildWrapCall({
          direction: route.direction,
          weth: route.weth,
          amountIn,
        }),
        chainId: sepolia.id,
      })
      return
    }

    if (needsPermit2 && !hasTokenAllowance && payToken.address) {
      await sendCheckedTx('approve', {
        address: payToken.address,
        abi: erc20Abi,
        functionName: 'approve',
        args: [PERMIT2_ADDRESS, amountIn],
        chainId: sepolia.id,
      })
      return
    }

    if (needsPermit2 && !hasPermit2Allowance && payToken.address) {
      await sendCheckedTx('permit2', {
        address: PERMIT2_ADDRESS,
        abi: permit2Abi,
        functionName: 'approve',
        args: [
          payToken.address,
          UNISWAP_UNIVERSAL_ROUTER,
          amountIn,
          Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
        ],
        chainId: sepolia.id,
      })
      return
    }

    if (route.kind !== 'v3-swap' || !canSwap) {
      return
    }

    await sendCheckedTx('swap', {
      ...buildRouterCall({
        route,
        amountIn,
        amountOutMinimum,
        recipient: address,
        now: Math.floor(Date.now() / 1000),
      }),
      chainId: sepolia.id,
    })
  }

  const buttonDisabled = address
    ? isSepolia
      ? !amount ||
        !isAmountValid ||
        amountIn <= 0n ||
        !isSupportedPair ||
        amountOut === undefined ||
        isBusy
      : isBusy
    : true

  const buttonLabel = !address
    ? 'Connect wallet'
    : isSwitching
      ? 'Switching...'
      : !isSepolia
        ? 'Switch to Sepolia'
        : !amount
          ? 'Enter amount'
          : !isAmountValid
            ? 'Enter valid amount'
            : !isSupportedPair
              ? 'Select another token'
              : isQuotePending && quoteEnabled
                ? 'Getting quote...'
                : isChecking
                  ? 'Checking transaction...'
                  : isWaitingForWallet
                    ? 'Confirm in wallet...'
                    : isConfirming
                      ? 'Confirming...'
                      : needsPermit2 && !hasTokenAllowance
                        ? `Approve ${payToken.symbol}`
                        : needsPermit2 && !hasPermit2Allowance
                          ? `Approve ${payToken.symbol} for swap`
                          : `Swap ${payToken.symbol} → ${receiveToken.symbol}`

  return {
    formattedAmountOut,
    formattedMinReceived,
    slippageLabel: applySlippage ? SLIPPAGE_PERCENT_LABEL : null,
    rate,
    isQuotePending,
    quoteEnabled,
    quoteError:
      isQuoteError && quoteEnabled
        ? quoteError instanceof Error
          ? quoteError.message
          : 'Quote unavailable'
        : null,
    chainId,
    currentChainName: currentChain?.name,
    isSepolia,
    buttonLabel,
    buttonDisabled,
    submit,
    error,
    success,
    successHash,
    explorerUrl: successHash
      ? `https://sepolia.etherscan.io/tx/${successHash}`
      : null,
    clearStatus() {
      setError(null)
      setSuccess(false)
      setSuccessHash(null)
    },
  }
}
