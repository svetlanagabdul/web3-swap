import { parseUnits } from 'viem'
import { describe, expect, it } from 'vitest'

import { tokens } from '../data/tokens'
import {
  formatAmount,
  formatDisplayAmount,
  formatRate,
  guaranteedAmountOut,
  maxSpendable,
  minAmountOut,
  parseAmount,
  validateAmount,
} from './amount'

const [eth, weth, usdc] = tokens

describe('parseAmount', () => {
  it('parses ETH and USDC decimals to bigint', () => {
    expect(parseAmount('1.5', 18)).toBe(parseUnits('1.5', 18))
    expect(parseAmount('1.5', 6)).toBe(1_500_000n)
  })

  it('returns null for empty or invalid values', () => {
    expect(parseAmount('', 18)).toBeNull()
    expect(parseAmount('not-a-number', 18)).toBeNull()
  })
})

describe('formatAmount', () => {
  it('round-trips parseUnits without Number()', () => {
    expect(formatAmount(parseUnits('1.25', 18), 18)).toBe('1.25')
    expect(formatAmount(1_500_000n, 6)).toBe('1.5')
  })
})

describe('formatDisplayAmount', () => {
  it('truncates extra fraction digits without Number()', () => {
    expect(formatDisplayAmount(parseUnits('1.23456789', 18), 18, 4)).toBe(
      '1.2345',
    )
    expect(formatDisplayAmount(1_500_000n, 6, 4)).toBe('1.5')
  })
})

describe('formatRate', () => {
  it('computes receive tokens per 1 pay token in bigint math', () => {
    expect(
      formatRate(parseUnits('1', 18), parseUnits('2000', 6), 18, 6),
    ).toBe('2000')
    expect(
      formatRate(parseUnits('1', 6), parseUnits('0.0005', 18), 6, 18),
    ).toBe('0.0005')
  })

  it('returns null when amount in is zero', () => {
    expect(formatRate(0n, 1000n, 18, 6)).toBeNull()
  })
})

describe('maxSpendable', () => {
  it('keeps the full ERC-20 balance', () => {
    expect(maxSpendable(1_000_000n, usdc)).toBe(1_000_000n)
    expect(maxSpendable(parseUnits('2', 18), weth)).toBe(parseUnits('2', 18))
  })

  it('reserves 0.005 ETH for gas', () => {
    expect(maxSpendable(parseUnits('1', 18), eth)).toBe(parseUnits('0.995', 18))
  })

  it('returns 0 when native balance is below the gas reserve', () => {
    expect(maxSpendable(parseUnits('0.001', 18), eth)).toBe(0n)
    expect(maxSpendable(parseUnits('0.005', 18), eth)).toBe(0n)
  })
})

describe('minAmountOut', () => {
  it('applies 0.5% slippage in integer math', () => {
    expect(minAmountOut(1000n)).toBe(995n)
    expect(minAmountOut(1n)).toBe(0n)
  })
})

describe('guaranteedAmountOut', () => {
  it('keeps the full amount for 1:1 wrap and applies slippage for a pool swap', () => {
    expect(guaranteedAmountOut(1000n, false)).toBe(1000n)
    expect(guaranteedAmountOut(1000n, true)).toBe(995n)
  })
})

describe('validateAmount', () => {
  it('rejects empty, non-numeric, and over-precise values', () => {
    expect(validateAmount('', 18)).toBe('Enter an amount')
    expect(validateAmount('1.2.3', 18)).toBe('Enter a valid number')
    expect(validateAmount('1.1234567', 6)).toBe('Maximum 6 decimal places')
    expect(validateAmount('0', 18)).toBe('Amount must be greater than 0')
  })

  it('rejects amounts above balance', () => {
    expect(validateAmount('2', 18, parseUnits('1', 18), 'ETH')).toBe(
      'Insufficient ETH balance',
    )
    expect(validateAmount('2', 18, parseUnits('1', 18))).toBe(
      'Insufficient balance',
    )
  })

  it('accepts a valid amount within balance', () => {
    expect(validateAmount('1', 18, parseUnits('2', 18), 'ETH')).toBe(true)
  })
})
