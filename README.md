# 🚀 Ethereum Volume Bot V2 🪙

This is an Ethereum-based volume trading bot designed to execute buy and sell transactions on decentralized exchanges (DEX) like Uniswap. The bot uses random logic to determine the number of buys before a sell and operates with multiple wallets for distributing trades.

## ✨ Features
- **Automated Trading 🤖**: The bot continuously trades Ethereum-based tokens with the specified interval and randomization of buy and sell actions.
- **Multiple Wallet Support 💼**: The bot can operate with multiple wallets, funded automatically.
- **Uniswap Integration 🔄**: It interacts with Uniswap's router to perform token swaps.
- **Configurable Parameters ⚙️**: Users can adjust settings like trade amount limits, number of wallets, and trading interval.
- **Wallet Management 🔐**: Wallets can be generated, saved, and loaded from a file.
- **Automatic Fund Collection 💰**: After performing trades, the bot collects funds back to a treasury wallet.

## 📋 Requirements
- Node.js >= 16.x
- TypeScript
- Ethers.js
- Uniswap Router contract ABI
- An Ethereum RPC URL (e.g., Infura, Alchemy)
- Ethereum private key with funds (for treasury wallet)

## 🛠️ Installation

### Step 1: Clone the repository
```bash
git clone https://github.com/yourusername/ethereum-volume-bot-v2.git
cd ethereum-volume-bot-v2
```

### Step 2: Install dependencies
```bash
npm install
```

### Step 3: Configure the bot
Create a `constants.ts` file (if not already present) and provide the following information:

```typescript
export const RPC_URL = 'YOUR_INFURA_OR_ALCHEMY_URL';
export const PRIV_KEY = 'YOUR_TREASURY_WALLET_PRIVATE_KEY';
export const UNISWAP_ADDRESS = 'UNISWAP_ROUTER_ADDRESS';
export const UNISWAP_ABI = require('./abis/uniswapRouter.json'); // Adjust the ABI file path
export const ZYGO = 'ZYGO_TOKEN_ADDRESS';
export const USDT = 'USDT_TOKEN_ADDRESS';
export const WETH = 'WETH_ADDRESS';
export const TRADE_INTERVAL = 10000; // Interval in ms (10 seconds)
export const explorer = 'https://etherscan.io/tx/';
```

### Step 4: Run the bot
```bash
npm run start
```

## ⚙️ How It Works

1. **Wallet Management 💼**:
   - The bot loads wallets from a `data.json` file or generates new wallets.
   - Each wallet is funded with a specified amount of ETH.

2. **Trading Loop 🔄**:
   - The bot picks a random number of buys (between 1 and 3).
   - For each wallet, the bot checks if there’s enough ETH to perform a trade.
   - It first buys tokens using ETH and then sells them for ETH after completing the set number of buys.

3. **Token Swap 🔁**:
   - The bot uses Uniswap's router to swap ETH for tokens and tokens for ETH. It ensures slippage tolerance and sets an 8-minute deadline for each transaction.

4. **Transaction Handling 💳**:
   - The bot retries transactions up to 3 times in case of failure (either for buying or selling tokens).
   - After a successful trade, the funds are sent back to the treasury wallet.

5. **Logging and Monitoring 📊**:
   - The bot logs all transactions, including successful buys/sells, wallet balances, and error handling.

## ⚙️ Customization

You can modify the following parameters:
- `TRADE_INTERVAL`: Set the time (in milliseconds) between each trade.
- `MIN_TRADE_AMOUNT` and `MAX_TRADE_AMOUNT`: Control the range of trade amounts.
- `numWallets`: Number of wallets to manage in parallel.
- `fundAmount`: ETH amount to fund each wallet.

## 📁 File Structure

```
.
├── abis/
│   └── uniswapRouter.json        # Uniswap ABI
├── data.json                    # Wallets' data
├── src/
│   ├── constants.ts             # Configuration constants
│   ├── index.ts                 # Main bot script
└── package.json                 # Project dependencies and scripts
```

## ⚠️ Notes
- Ensure your RPC URL and private key are securely managed 🔐.
- You need to ensure that your treasury wallet has sufficient ETH for funding the wallets 💸.
- Be cautious of transaction fees and slippage, as large trades may incur higher costs 💡.
- This bot is designed for educational and testing purposes 📚. Please thoroughly test in a controlled environment before deploying it with real funds 💰.

## 📞 Author

Telegram: [@g0drlc](https://t.me/g0drlc)
