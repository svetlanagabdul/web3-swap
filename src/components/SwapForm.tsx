import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'

import type { Token } from '../data/tokens'
import { tokens } from '../data/tokens'
import { useSwapFlow } from '../hooks/useSwapFlow'
import { useTokenBalance } from '../hooks/useTokenBalance'
import {
  formatAmount,
  formatDisplayAmount,
  maxSpendable,
  validateAmount,
} from '../swap/amount'

type SwapFormValues = {
  amount: string
}

export function SwapForm() {
  const {
    register,
    watch,
    setValue,
    resetField,
    trigger,
    formState: { errors },
  } = useForm<SwapFormValues>({
    mode: 'onChange',
    defaultValues: {
      amount: '',
    },
  })

  const amount = watch('amount')

  const [payToken, setPayToken] = useState<Token>(tokens[0])
  const [receiveToken, setReceiveToken] = useState<Token>(tokens[1])

  const { balance: payTokenBalance } = useTokenBalance(payToken)

  const {
    formattedAmountOut,
    formattedMinReceived,
    slippageLabel,
    rate,
    isQuotePending,
    quoteEnabled,
    quoteError,
    chainId,
    currentChainName,
    isSepolia,
    buttonLabel,
    buttonDisabled,
    submit,
    error,
    success,
    explorerUrl,
    clearStatus,
  } = useSwapFlow({
    payToken,
    receiveToken,
    amount,
    isAmountValid: !errors.amount,
    onCompleted: () => {
      resetField('amount')
    },
  })

  useEffect(() => {
    if (!amount) {
      return
    }

    void trigger('amount')
  }, [payToken, payTokenBalance, amount, trigger])

  function handleMax() {
    if (payTokenBalance === undefined) {
      return
    }

    setValue(
      'amount',
      formatAmount(
        maxSpendable(payTokenBalance, payToken),
        payToken.decimals,
      ),
      {
        shouldValidate: true,
        shouldDirty: true,
      },
    )
    clearStatus()
  }

  function selectPayToken(symbol: string) {
    const token = tokens.find((item) => item.symbol === symbol)

    if (!token) {
      return
    }

    if (token.symbol === receiveToken.symbol) {
      setReceiveToken(payToken)
    }

    setPayToken(token)
    clearStatus()
  }

  function selectReceiveToken(symbol: string) {
    const token = tokens.find((item) => item.symbol === symbol)

    if (!token) {
      return
    }

    if (token.symbol === payToken.symbol) {
      setPayToken(receiveToken)
    }

    setReceiveToken(token)
    clearStatus()
  }

  return (
    <section className="w-full max-w-md rounded-3xl border border-slate-600/60 bg-slate-800 p-5 shadow-2xl shadow-black/70 sm:p-6">
      <h2 className="mb-5 text-lg font-semibold text-white sm:text-xl">
        Swap tokens
      </h2>

      <div className="rounded-2xl border border-slate-600/80 bg-slate-900/80 p-4 transition focus-within:border-violet-500/70 focus-within:ring-2 focus-within:ring-violet-500/40">
        <div className="mb-2 flex items-center justify-between gap-3">
          <label
            htmlFor="pay-amount"
            className="block text-sm font-medium text-slate-400"
          >
            You pay
          </label>

          <button
            type="button"
            onClick={handleMax}
            disabled={payTokenBalance === undefined}
            className="text-xs text-slate-400 transition hover:text-violet-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Balance:{' '}
            {payTokenBalance !== undefined
              ? formatDisplayAmount(
                  payTokenBalance,
                  payToken.decimals,
                  4,
                )
              : '0'}{' '}
            {payToken.symbol}
          </button>
        </div>

        <div className="flex items-center gap-3">
          <input
            id="pay-amount"
            type="text"
            inputMode="decimal"
            placeholder="0.0"
            {...register('amount', {
              required: 'Enter an amount',
              validate: (value) =>
                validateAmount(
                  value,
                  payToken.decimals,
                  payTokenBalance,
                  payToken.symbol,
                ),
              onChange: () => {
                clearStatus()
              },
            })}
            className="min-w-0 flex-1 cursor-text bg-transparent text-2xl font-semibold text-white outline-none placeholder:text-slate-500"
          />

          <button
            type="button"
            onClick={handleMax}
            disabled={payTokenBalance === undefined}
            className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-violet-300 transition hover:text-violet-200 disabled:cursor-not-allowed disabled:text-slate-500"
          >
            MAX
          </button>

          <TokenSelect
            value={payToken.symbol}
            onChange={selectPayToken}
          />
        </div>
      </div>

      {errors.amount && (
        <p className="mt-2 text-sm text-red-400">
          {errors.amount.message}
        </p>
      )}

      <div className="relative z-10 -my-3 flex justify-center">
        <button
          type="button"
          aria-label="Поменять токены местами"
          onClick={() => {
            setPayToken(receiveToken)
            setReceiveToken(payToken)
            clearStatus()
          }}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-500 bg-slate-700 text-lg text-violet-300 shadow-md transition hover:border-violet-500/70 hover:bg-slate-600 hover:text-violet-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800"
        >
          ⇅
        </button>
      </div>

      <div className="rounded-2xl border border-slate-600/80 bg-slate-900/50 p-4">
        <label
          htmlFor="receive-amount"
          className="mb-2 block text-sm font-medium text-slate-400"
        >
          You receive
        </label>

        <div className="flex items-center gap-3">
          <input
            id="receive-amount"
            type="text"
            placeholder="0.0"
            readOnly
            value={formattedAmountOut}
            className="min-w-0 flex-1 cursor-default bg-transparent text-2xl font-semibold text-slate-400 outline-none placeholder:text-slate-500"
          />

          <TokenSelect
            value={receiveToken.symbol}
            onChange={selectReceiveToken}
          />
        </div>
      </div>

      <dl className="mt-4 space-y-2 rounded-2xl border border-slate-600/50 bg-slate-900/40 px-4 py-3 text-sm text-slate-400">
        <div className="flex items-center justify-between gap-3">
          <dt>Rate</dt>
          <dd className="text-right text-slate-300">
            {isQuotePending && quoteEnabled
              ? 'Loading...'
              : rate
                ? `1 ${payToken.symbol} ≈ ${rate} ${receiveToken.symbol}`
                : '—'}
          </dd>
        </div>

        <div className="flex items-center justify-between gap-3">
          <dt>Max slippage</dt>
          <dd className="text-right text-slate-300">
            {slippageLabel ?? 'None · 1:1 wrap'}
          </dd>
        </div>

        <div className="flex items-center justify-between gap-3">
          <dt>Minimum received</dt>
          <dd className="text-right text-slate-300">
            {isQuotePending && quoteEnabled
              ? 'Loading...'
              : formattedMinReceived
                ? `${formattedMinReceived} ${receiveToken.symbol}`
                : '—'}
          </dd>
        </div>

        <div className="flex items-center justify-between gap-3">
          <dt>Network</dt>
          <dd className="text-right text-slate-300">
            {currentChainName ?? `Chain ID: ${chainId}`}
          </dd>
        </div>
      </dl>

      {!isSepolia && (
        <p className="mt-4 text-sm text-amber-400">
          Switch to Sepolia before swapping.
        </p>
      )}

      <button
        type="button"
        onClick={() => {
          void submit()
        }}
        disabled={buttonDisabled}
        className="mt-5 w-full rounded-2xl bg-violet-500 px-4 py-3.5 text-base font-semibold text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
      >
        {buttonLabel}
      </button>

      {success && (
        <p className="mt-3 text-sm font-medium text-emerald-400">
          Swap successful
          {explorerUrl && (
            <>
              {' · '}
              <a
                href={explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="underline decoration-emerald-400/60 underline-offset-2 transition hover:text-emerald-300"
              >
                View on Etherscan
              </a>
            </>
          )}
        </p>
      )}

      {error && (
        <p className="mt-3 text-sm text-red-400">{error}</p>
      )}

      {quoteError && (
        <p className="mt-3 text-sm text-red-400">{quoteError}</p>
      )}
    </section>
  )
}

function TokenSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (symbol: string) => void
}) {
  return (
    <div className="relative shrink-0">
      <select
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
        }}
        className="appearance-none rounded-full border border-slate-500 bg-slate-700 py-2 pl-4 pr-10 text-sm font-semibold text-white outline-none transition hover:border-violet-500/60 hover:bg-slate-600 focus-visible:ring-2 focus-visible:ring-violet-500"
      >
        {tokens.map((token) => (
          <option key={token.symbol} value={token.symbol}>
            {token.symbol}
          </option>
        ))}
      </select>

      <svg
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white"
      >
        <path
          d="M6 8l4 4 4-4"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}
