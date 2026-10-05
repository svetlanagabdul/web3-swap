export type Token = {
	symbol: string
	decimals: number
	address?: `0x${string}`
}

export const tokens: Token[] = [
	{
		symbol: 'ETH',
		decimals: 18,
	},
	{
		symbol: 'WETH',
		decimals: 18,
		address: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
	},
	{
		symbol: 'USDC',
		decimals: 6,
		address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
	},
]
