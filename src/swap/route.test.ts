import { describe, expect, it } from 'vitest'

import type { Token } from '../data/tokens'
import { tokens } from '../data/tokens'
import { resolveAmountOut, resolveRoute } from './route'

const [eth, weth, usdc] = tokens
const wethAddress = weth.address!

describe('resolveRoute', () => {
  it('wraps native ETH into WETH 1:1', () => {
    expect(resolveRoute(eth, weth, wethAddress)).toEqual({
      kind: 'wrap',
      direction: 'eth-to-weth',
      weth: wethAddress,
    })
  })

  it('unwraps WETH into native ETH 1:1', () => {
    expect(resolveRoute(weth, eth, wethAddress)).toEqual({
      kind: 'wrap',
      direction: 'weth-to-eth',
      weth: wethAddress,
    })
  })

  it('treats ETH → USDC as a V3 swap that wraps native and skips Permit2', () => {
    expect(resolveRoute(eth, usdc, wethAddress)).toEqual({
      kind: 'v3-swap',
      tokenIn: wethAddress,
      tokenOut: usdc.address,
      wrapNative: true,
      unwrapNative: false,
      needsPermit2: false,
    })
  })

  it('treats USDC → ETH as a V3 swap that unwraps and needs Permit2', () => {
    expect(resolveRoute(usdc, eth, wethAddress)).toEqual({
      kind: 'v3-swap',
      tokenIn: usdc.address,
      tokenOut: wethAddress,
      wrapNative: false,
      unwrapNative: true,
      needsPermit2: true,
    })
  })

  it('treats WETH ↔ USDC as a plain V3 swap with Permit2', () => {
    expect(resolveRoute(weth, usdc, wethAddress)).toEqual({
      kind: 'v3-swap',
      tokenIn: wethAddress,
      tokenOut: usdc.address,
      wrapNative: false,
      unwrapNative: false,
      needsPermit2: true,
    })

    expect(resolveRoute(usdc, weth, wethAddress)).toEqual({
      kind: 'v3-swap',
      tokenIn: usdc.address,
      tokenOut: wethAddress,
      wrapNative: false,
      unwrapNative: false,
      needsPermit2: true,
    })
  })

  it('rejects the same asset, including checksum-insensitive addresses', () => {
    expect(resolveRoute(eth, eth, wethAddress)).toEqual({
      kind: 'unsupported',
    })
    expect(resolveRoute(usdc, usdc, wethAddress)).toEqual({
      kind: 'unsupported',
    })

    const usdcLower: Token = {
      ...usdc,
      symbol: 'usdc-copy',
      address: usdc.address!.toLowerCase() as `0x${string}`,
    }

    expect(resolveRoute(usdc, usdcLower, wethAddress)).toEqual({
      kind: 'unsupported',
    })
  })

  it('matches WETH by address, not by ticker', () => {
    const wethLower: Token = {
      ...weth,
      symbol: 'WETH-LOWER',
      address: wethAddress.toLowerCase() as `0x${string}`,
    }

    expect(resolveRoute(eth, wethLower, wethAddress)).toMatchObject({
      kind: 'wrap',
      direction: 'eth-to-weth',
    })
  })
})

describe('resolveAmountOut', () => {
  const wrap = resolveRoute(eth, weth, wethAddress)
  const v3 = resolveRoute(weth, usdc, wethAddress)
  const unsupported = resolveRoute(eth, eth, wethAddress)

  it('uses amountIn 1:1 for wrap and ignores a quote', () => {
    expect(resolveAmountOut(wrap, 10n, 99n)).toBe(10n)
    expect(resolveAmountOut(wrap, 0n, 99n)).toBeUndefined()
  })

  it('uses the quoter result for a V3 route', () => {
    expect(resolveAmountOut(v3, 10n, 42n)).toBe(42n)
    expect(resolveAmountOut(v3, 10n)).toBeUndefined()
  })

  it('returns nothing for an unsupported pair', () => {
    expect(resolveAmountOut(unsupported, 10n, 42n)).toBeUndefined()
  })
})
