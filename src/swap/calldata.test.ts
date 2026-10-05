import {
  decodeAbiParameters,
  getAddress,
  type Hex,
} from 'viem'
import { describe, expect, it } from 'vitest'

import { UNISWAP_UNIVERSAL_ROUTER } from '../config/uniswap'
import { tokens } from '../data/tokens'
import { buildRouterCall, buildWrapCall, V3_POOL_FEE } from './calldata'
import { resolveRoute, type V3SwapRoute } from './route'

const [eth, weth, usdc] = tokens
const wethAddress = weth.address!
const recipient =
  '0x1111111111111111111111111111111111111111' as const
const routerAsRecipient =
  '0x0000000000000000000000000000000000000002' as const
const now = 1_700_000_000
const amountIn = 2n
const amountOutMinimum = 1n

const swapExactInAbi = [
  { type: 'address' },
  { type: 'uint256' },
  { type: 'uint256' },
  { type: 'bytes' },
  { type: 'bool' },
] as const

const wrapOrUnwrapAbi = [
  { type: 'address' },
  { type: 'uint256' },
] as const

function v3Route(pay: (typeof tokens)[number], receive: (typeof tokens)[number]) {
  const route = resolveRoute(pay, receive, wethAddress)

  if (route.kind !== 'v3-swap') {
    throw new Error(`expected v3-swap, got ${route.kind}`)
  }

  return route
}

function decodeSwap(input: Hex) {
  const [swapRecipient, swapAmountIn, minOut, path, payerIsUser] =
    decodeAbiParameters(swapExactInAbi, input)

  const packed = path.slice(2)
  const tokenIn = getAddress(`0x${packed.slice(0, 40)}`)
  const fee = Number.parseInt(packed.slice(40, 46), 16)
  const tokenOut = getAddress(`0x${packed.slice(46, 86)}`)

  return {
    swapRecipient,
    swapAmountIn,
    minOut,
    payerIsUser,
    tokenIn,
    fee,
    tokenOut,
  }
}

function decodeWrapOrUnwrap(input: Hex) {
  const [to, amount] = decodeAbiParameters(wrapOrUnwrapAbi, input)
  return { to, amount }
}

function build(route: V3SwapRoute) {
  return buildRouterCall({
    route,
    amountIn,
    amountOutMinimum,
    recipient,
    now,
  })
}

describe('buildWrapCall', () => {
  it('deposits native ETH into WETH', () => {
    const call = buildWrapCall({
      direction: 'eth-to-weth',
      weth: wethAddress,
      amountIn,
    })

    expect(call).toMatchObject({
      address: wethAddress,
      functionName: 'deposit',
      value: amountIn,
    })
    expect(call).not.toHaveProperty('args')
  })

  it('withdraws WETH back to native ETH', () => {
    expect(
      buildWrapCall({
        direction: 'weth-to-eth',
        weth: wethAddress,
        amountIn,
      }),
    ).toMatchObject({
      address: wethAddress,
      functionName: 'withdraw',
      args: [amountIn],
    })
  })
})

describe('buildRouterCall', () => {
  it('ETH → USDC: WRAP_ETH then V3_SWAP_EXACT_IN, pays in ETH', () => {
    const call = build(v3Route(eth, usdc))
    const [commands, inputs, deadline] = call.args

    expect(call.address).toBe(UNISWAP_UNIVERSAL_ROUTER)
    expect(call.functionName).toBe('execute')
    expect(call.value).toBe(amountIn)
    expect(commands).toBe('0x0b00')
    expect(inputs).toHaveLength(2)
    expect(deadline).toBe(BigInt(now + 600))

    expect(decodeWrapOrUnwrap(inputs[0])).toEqual({
      to: routerAsRecipient,
      amount: amountIn,
    })

    expect(decodeSwap(inputs[1])).toEqual({
      swapRecipient: recipient,
      swapAmountIn: amountIn,
      minOut: amountOutMinimum,
      payerIsUser: false,
      tokenIn: wethAddress,
      fee: V3_POOL_FEE,
      tokenOut: usdc.address,
    })
  })

  it('USDC → ETH: V3_SWAP_EXACT_IN then UNWRAP_WETH, no msg.value', () => {
    const call = build(v3Route(usdc, eth))
    const [commands, inputs] = call.args

    expect(call).not.toHaveProperty('value')
    expect(commands).toBe('0x000c')
    expect(inputs).toHaveLength(2)

    expect(decodeSwap(inputs[0])).toEqual({
      swapRecipient: routerAsRecipient,
      swapAmountIn: amountIn,
      minOut: amountOutMinimum,
      payerIsUser: true,
      tokenIn: usdc.address,
      fee: V3_POOL_FEE,
      tokenOut: wethAddress,
    })

    expect(decodeWrapOrUnwrap(inputs[1])).toEqual({
      to: recipient,
      amount: amountOutMinimum,
    })
  })

  it('WETH → USDC: single V3_SWAP_EXACT_IN paid by the user', () => {
    const call = build(v3Route(weth, usdc))
    const [commands, inputs] = call.args

    expect(call).not.toHaveProperty('value')
    expect(commands).toBe('0x00')
    expect(inputs).toHaveLength(1)

    expect(decodeSwap(inputs[0])).toEqual({
      swapRecipient: recipient,
      swapAmountIn: amountIn,
      minOut: amountOutMinimum,
      payerIsUser: true,
      tokenIn: wethAddress,
      fee: V3_POOL_FEE,
      tokenOut: usdc.address,
    })
  })

  it('USDC → WETH uses the same single-swap command as WETH → USDC', () => {
    const call = build(v3Route(usdc, weth))
    const [, inputs] = call.args

    expect(call.args[0]).toBe('0x00')
    expect(decodeSwap(inputs[0])).toMatchObject({
      tokenIn: usdc.address,
      tokenOut: wethAddress,
      payerIsUser: true,
      swapRecipient: recipient,
    })
  })
})
