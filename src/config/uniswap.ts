import { parseAbi } from 'viem'

export const UNISWAP_V3_QUOTER_V2 =
  '0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3' as const

export const UNISWAP_UNIVERSAL_ROUTER =
  '0x3A9D48AB9751398BbFa63ad67599Bb04e4BdF98b' as const

export const quoterV2Abi = parseAbi([
  'function quoteExactInputSingle((address tokenIn,address tokenOut,uint256 amountIn,uint24 fee,uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut,uint160 sqrtPriceX96After,uint32 initializedTicksCrossed,uint256 gasEstimate)',
])

export const universalRouterAbi = parseAbi([
  'function execute(bytes commands, bytes[] inputs, uint256 deadline) payable',
])