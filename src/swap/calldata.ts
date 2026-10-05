import {
  encodeAbiParameters,
  encodePacked,
  type Address,
  type Hex,
} from 'viem'

import {
  UNISWAP_UNIVERSAL_ROUTER,
  universalRouterAbi,
} from '../config/uniswap'
import { wethAbi } from '../config/weth'
import type { V3SwapRoute } from './route'

export const V3_POOL_FEE = 3000

const DEADLINE_SECONDS = 60 * 10
const ROUTER_AS_RECIPIENT =
  '0x0000000000000000000000000000000000000002' as const

// Universal Router command bytes:
// 0x00 V3_SWAP_EXACT_IN, 0x0b WRAP_ETH, 0x0c UNWRAP_WETH
const COMMANDS_WRAP_THEN_SWAP = '0x0b00' as const
const COMMANDS_SWAP_THEN_UNWRAP = '0x000c' as const
const COMMANDS_SWAP = '0x00' as const

function encodeWrapOrUnwrap(recipient: Address, amount: bigint) {
  return encodeAbiParameters(
    [{ type: 'address' }, { type: 'uint256' }],
    [recipient, amount],
  )
}

function encodeV3SwapExactIn(
  recipient: Address,
  amountIn: bigint,
  amountOutMinimum: bigint,
  path: Hex,
  payerIsUser: boolean,
) {
  return encodeAbiParameters(
    [
      { type: 'address' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'bytes' },
      { type: 'bool' },
    ],
    [recipient, amountIn, amountOutMinimum, path, payerIsUser],
  )
}

export function buildWrapCall({
  direction,
  weth,
  amountIn,
}: {
  direction: 'eth-to-weth' | 'weth-to-eth'
  weth: Address
  amountIn: bigint
}) {
  if (direction === 'eth-to-weth') {
    return {
      address: weth,
      abi: wethAbi,
      functionName: 'deposit' as const,
      value: amountIn,
    }
  }

  return {
    address: weth,
    abi: wethAbi,
    functionName: 'withdraw' as const,
    args: [amountIn] as const,
  }
}

export function buildRouterCall({
  route,
  amountIn,
  amountOutMinimum,
  recipient,
  now,
}: {
  route: V3SwapRoute
  amountIn: bigint
  amountOutMinimum: bigint
  recipient: Address
  now: number
}) {
  const path = encodePacked(
    ['address', 'uint24', 'address'],
    [route.tokenIn, V3_POOL_FEE, route.tokenOut],
  )
  const deadline = BigInt(now + DEADLINE_SECONDS)

  if (route.wrapNative) {
    return {
      address: UNISWAP_UNIVERSAL_ROUTER,
      abi: universalRouterAbi,
      functionName: 'execute' as const,
      args: [
        COMMANDS_WRAP_THEN_SWAP,
        [
          encodeWrapOrUnwrap(ROUTER_AS_RECIPIENT, amountIn),
          encodeV3SwapExactIn(
            recipient,
            amountIn,
            amountOutMinimum,
            path,
            false,
          ),
        ],
        deadline,
      ] as const,
      value: amountIn,
    }
  }

  if (route.unwrapNative) {
    return {
      address: UNISWAP_UNIVERSAL_ROUTER,
      abi: universalRouterAbi,
      functionName: 'execute' as const,
      args: [
        COMMANDS_SWAP_THEN_UNWRAP,
        [
          encodeV3SwapExactIn(
            ROUTER_AS_RECIPIENT,
            amountIn,
            amountOutMinimum,
            path,
            true,
          ),
          encodeWrapOrUnwrap(recipient, amountOutMinimum),
        ],
        deadline,
      ] as const,
    }
  }

  return {
    address: UNISWAP_UNIVERSAL_ROUTER,
    abi: universalRouterAbi,
    functionName: 'execute' as const,
    args: [
      COMMANDS_SWAP,
      [
        encodeV3SwapExactIn(
          recipient,
          amountIn,
          amountOutMinimum,
          path,
          true,
        ),
      ],
      deadline,
    ] as const,
  }
}
