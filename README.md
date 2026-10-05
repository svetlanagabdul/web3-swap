# Token Swap

Демо: https://svetlanagabdul.github.io/web3-swap/

Обмен ETH, WETH и USDC в сети Sepolia.

Кошелёк подключается через MetaMask. Котировку читает контракт Uniswap Quoter V2. Своп уходит в Uniswap Universal Router: нативный ETH оборачивается и разворачивается через WETH, для ERC-20 нужен approve в Permit2. Проскальзывание 0.5%. Перед отправкой транзакция симулируется.

## Стек

React, TypeScript, Vite, Tailwind CSS, wagmi, viem, TanStack Query, react-hook-form, Vitest.

## Запуск

```bash
npm install
npm run dev
npm test
```
