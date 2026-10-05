import { formatUnits, parseUnits } from 'viem'

import type { Token } from '../data/tokens'

const ETH_GAS_RESERVE = '0.005'
const SLIPPAGE_NUMERATOR = 995n
const SLIPPAGE_DENOMINATOR = 1000n

export const SLIPPAGE_PERCENT_LABEL = '0.5%'

export function parseAmount(
  value: string,
  decimals: number,
): bigint | null {
  if (!value) {
    return null
  }

  try {
    return parseUnits(value, decimals)
  } catch {
    return null
  }
}

export function formatAmount(
  value: bigint,
  decimals: number,
): string {
  return formatUnits(value, decimals)
}

export function formatDisplayAmount(
  value: bigint,
  decimals: number,
  maxFractionDigits: number,
): string {
  const [whole, fraction = ''] = formatAmount(value, decimals).split('.')

  if (maxFractionDigits <= 0) {
    return whole
  }

  if (fraction.length <= maxFractionDigits) {
    return fraction ? `${whole}.${fraction}` : whole
  }

  return `${whole}.${fraction.slice(0, maxFractionDigits)}`
}

export function formatRate(
  amountIn: bigint,
  amountOut: bigint,
  payDecimals: number,
  receiveDecimals: number,
): string | null {
  if (amountIn <= 0n) {
    return null
  }

  const outPerOnePay =
    (amountOut * 10n ** BigInt(payDecimals)) / amountIn

  return formatDisplayAmount(outPerOnePay, receiveDecimals, 6)
}

export function maxSpendable(
  balance: bigint,
  token: Token,
): bigint {
  if (token.address !== undefined) {
    return balance
  }

  const gasReserve = parseUnits(
    ETH_GAS_RESERVE,
    token.decimals,
  )

  return balance > gasReserve
    ? balance - gasReserve
    : 0n
}

export function minAmountOut(amountOut: bigint): bigint {
  return (amountOut * SLIPPAGE_NUMERATOR) / SLIPPAGE_DENOMINATOR
}

export function guaranteedAmountOut(
  amountOut: bigint,
  applySlippage: boolean,
): bigint {
  return applySlippage ? minAmountOut(amountOut) : amountOut
}

export function validateAmount(
  value: string,
  decimals: number,
  balance?: bigint,
  symbol?: string,
) {
  if (!value) {
    return 'Enter an amount'
  }

  if (!/^\d+(\.\d+)?$/.test(value)) {
    return 'Enter a valid number'
  }

  const decimalPart = value.split('.')[1]

  if (
    decimalPart &&
    decimalPart.length > decimals
  ) {
    return `Maximum ${decimals} decimal places`
  }

  const amount = parseAmount(value, decimals)

  if (amount === null) {
    return 'Enter a valid amount'
  }

  if (amount <= 0n) {
    return 'Amount must be greater than 0'
  }

  if (
    balance !== undefined &&
    amount > balance
  ) {
    return symbol
      ? `Insufficient ${symbol} balance`
      : 'Insufficient balance'
  }

  return true
}
