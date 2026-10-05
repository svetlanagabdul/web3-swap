import { ConnectWallet } from './components/ConnectWallet'
import { SwapForm } from './components/SwapForm'

function App() {
  return (
    <div className="min-h-screen bg-black text-slate-100">
      <header className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
            Token Swap
          </h1>
          <p className="mt-0.5 text-sm text-slate-400">
            Swap ERC-20 tokens on Ethereum
          </p>
        </div>
        <ConnectWallet />
      </header>

      <main className="mx-auto flex w-full max-w-5xl justify-center px-4 pb-12 pt-4 sm:px-6 sm:pt-8">
        <SwapForm />
      </main>
    </div>
  )
}

export default App
