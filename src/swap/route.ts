import { zeroAddress, type Address } from 'viem'

import type { Token } from '../data/tokens'

export type WrapRoute = {
  kind: 'wrap'
  direction: 'eth-to-weth' | 'weth-to-eth'
  weth: Address
}

export type V3SwapRoute = {
  kind: 'v3-swap'
  tokenIn: Address
  tokenOut: Address
  wrapNative: boolean
  unwrapNative: boolean
  needsPermit2: boolean
}

export type UnsupportedRoute = {
  kind: 'unsupported'
}

export type SwapRoute =
  | WrapRoute
  | V3SwapRoute
  | UnsupportedRoute

function isNativeToken(token: Token) {
  return token.address === undefined
}

function isWethToken(token: Token, wethAddress: Address) {
  return (
    token.address !== undefined &&
    token.address.toLowerCase() === wethAddress.toLowerCase()
  )
}

function isSameToken(pay: Token, receive: Token) {
  if (isNativeToken(pay) && isNativeToken(receive)) {
    return true
  }

  if (pay.address && receive.address) {
    return pay.address.toLowerCase() === receive.address.toLowerCase()
  }

  return false
}

function quoteAddress(
  token: Token,
  wethAddress: Address,
): Address {
  if (isNativeToken(token)) {
    return wethAddress
  }

  return token.address ?? zeroAddress
}

export function resolveRoute(
  pay: Token,
  receive: Token,
  wethAddress: Address,
): SwapRoute {
  if (isSameToken(pay, receive)) {
    return { kind: 'unsupported' }
  }

  if (isNativeToken(pay) && isWethToken(receive, wethAddress)) {
    return {
      kind: 'wrap',
      direction: 'eth-to-weth',
      weth: wethAddress,
    }
  }

  if (isWethToken(pay, wethAddress) && isNativeToken(receive)) {
    return {
      kind: 'wrap',
      direction: 'weth-to-eth',
      weth: wethAddress,
    }
  }

  return {
    kind: 'v3-swap',
    tokenIn: quoteAddress(pay, wethAddress),
    tokenOut: quoteAddress(receive, wethAddress),
    wrapNative: isNativeToken(pay),
    unwrapNative: isNativeToken(receive),
    needsPermit2: !isNativeToken(pay),
  }
}

export function resolveAmountOut(
  route: SwapRoute,
  amountIn: bigint,
  quoteAmount?: bigint,
): bigint | undefined {
  if (route.kind === 'wrap') {
    return amountIn > 0n ? amountIn : undefined
  }

  if (route.kind === 'v3-swap') {
    return quoteAmount
  }

  return undefined
}
