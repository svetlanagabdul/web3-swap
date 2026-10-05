# Token Swap

Demo: https://svetlanagabdul.github.io/web3-swap/

Swap ETH, WETH, and USDC on Sepolia.

The wallet connects through MetaMask. Quotes come from the Uniswap Quoter V2 contract. Swaps are sent to the Uniswap Universal Router: native ETH is wrapped and unwrapped through WETH, and ERC-20 tokens need a Permit2 approval. Slippage is 0.5%. The transaction is simulated before it is sent.

## Stack

React, TypeScript, Vite, Tailwind CSS, wagmi, viem, TanStack Query, react-hook-form, Vitest.

## Run

```bash
npm install
npm run dev
npm test
```
