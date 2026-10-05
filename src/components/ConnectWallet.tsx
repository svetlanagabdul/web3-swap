import { useAccount, useConnect, useDisconnect } from 'wagmi'

export function ConnectWallet() {
  const { address, isConnected } = useAccount()
  const { connectors, connect, error, isPending } = useConnect()
  const { disconnect } = useDisconnect()

  const connector =
    connectors.find((item) => item.name.toLowerCase().includes('metamask')) ??
    connectors[0]

  if (isConnected) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-full border border-slate-700 bg-slate-900/80 py-1.5 pl-3 pr-1.5">
        <p className="font-mono text-sm text-slate-300">
          {address?.slice(0, 6)}...{address?.slice(-4)}
        </p>

        <button
          type="button"
          onClick={() => disconnect()}
          className="rounded-full border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        >
          Disconnect
        </button>
      </div>
    )
  }

  if (!connector) {
    return null
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={() => connect({ connector })}
        className="rounded-full bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-950/40 transition hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 disabled:shadow-none disabled:hover:bg-slate-700"
      >
        {isPending ? 'Connecting...' : 'Connect MetaMask'}
      </button>

      {error && (
        <p className="max-w-xs text-right text-sm text-rose-400" role="alert">
          {error.message}
        </p>
      )}
    </div>
  )
}
