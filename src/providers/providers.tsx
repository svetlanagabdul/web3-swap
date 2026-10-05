import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { WagmiProvider } from 'wagmi'

import { wagmiConfig } from '../config/wagmi'

const queryClient = new QueryClient()

type Props = {
  children: ReactNode
}

export function Providers({ children }: Props) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  )
}