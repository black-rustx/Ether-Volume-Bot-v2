import { BigNumberish, ethers, JsonRpcProvider, Wallet } from "ethers";
import figlet from "figlet";
import fs from "fs";
import { explorer, PRIV_KEY, RPC_URL, TRADE_INTERVAL, UNISWAP_ABI, UNISWAP_ADDRESS, USDT, WETH, ZYGO, ZYGO_ABI } from "./constants";

// new RPC connection
const provider = new JsonRpcProvider(RPC_URL);
const treasuryWallet = new ethers.Wallet(PRIV_KEY, provider);
const MIN_TRADE_AMOUNT = ethers.parseEther("0.005"); // minimum transaction amount
const MAX_TRADE_AMOUNT = ethers.parseEther("0.02");  // maximum transaction amount

console.log("Starting Volume Bot...");

// Main function
const main = async () => {
    try {
        console.log(
            figlet.textSync("ZYGO Volume Bot", {
                font: "Standard",
                horizontalLayout: "default",
                verticalLayout: "default",
                width: 120,
                whitespaceBreak: false,
            })
        );
        console.log("volume bot is running");

        const numWallets = 3; // Set the number of wallets
        const fundAmount = ethers.parseEther("0.01"); // Amount to fund each wallet

        let wallets: ethers.Wallet[];
        // Load wallets from file or create new ones if none exist
        if (fs.existsSync("./data.json")) {
            wallets = loadWallets();
        } else {
            wallets = await createWallets(numWallets);
            saveWallets(wallets);
        }

        await fundWallets(wallets, fundAmount);
        await wallets.forEach(wallet => tradeLoop(wallet));
        await collectFunds(wallets);
    } catch (error) {
        console.error("volume bot is error", error)
    }

};

// Main trade loop with interval
const tradeLoop = async (wallet: ethers.Wallet) => {
    // Set an initial random buy target
    let buyTarget = Math.floor(Math.random() * 3) + 1; // Randomly choose between 1 and 3 buys before each sell
    let buyCount = 0;

    const performTrade = async () => {
        const balance = await provider.getBalance(wallet);

        if (balance < MIN_TRADE_AMOUNT) {
            console.log(`Wallet ${wallet.address} has insufficient balance to continue trading.`);
            return;
        }

        const ethAmount = getRandomTradeAmount();
        const ethAmountBigInt = ethers.toBigInt(ethAmount); // Convert to bigint

        if (balance >= ethAmountBigInt) {
            if (buyCount < buyTarget) {
                // Perform buy transaction
                await buyTokens(wallet, ethAmount);
                buyCount++; // Increment the buy count
                console.log(`Buy transaction ${buyCount}/${buyTarget} completed.`);
            } else {
                // Perform sell transaction
                const tokenBalance = await getTokenBalance(wallet, ZYGO);
                await sellTokens(wallet, tokenBalance);
                console.log(`Sell transaction completed.`);

                // Reset buy count and set a new random target
                buyCount = 0;
                buyTarget = Math.floor(Math.random() * 3) + 1; // New random target
            }
        } else {
            console.log(`Insufficient ETH for the next trade. Available: ${ethers.formatEther(balance)}`);
        }

        setTimeout(performTrade, TRADE_INTERVAL);
    };

    performTrade();
};

// Buy Tokens Function (no approval needed for ETH to token swaps)
const buyTokens = async (wallet: Wallet, amountIn: BigNumberish, tries = 1) => {
    try {
        // limit to maximum 3 tries
        if (tries > 3) return false;
        console.log(`Try #${tries}...`);
        const path = [WETH, USDT, ZYGO];

        // Swap Tokens without approval
        const result = await swapExactETHForTokens(amountIn, path, wallet);

        if (result) {
            const balance = await provider.getBalance(wallet.address);
            console.log(`Balance: ${ethers.formatEther(balance)} ETH`);

            return { balance: ethers.formatEther(balance), success: true, trade: result };
        } else throw new Error();
    } catch (error) {
        console.log("Attempt Failed!");
        console.error(error);

        // Fail, increment try count and retry
        return await buyTokens(wallet, amountIn, tries + 1);
    }
};

// Swaps Function (assumes 18 decimals on input amountIn)
const swapExactETHForTokens = async (amountIn: BigNumberish, path: string[], wallet: Wallet) => {
    try {
        const uniswapRouter = new ethers.Contract(UNISWAP_ADDRESS, UNISWAP_ABI, wallet);
        // Calculate expected amount out and apply slippage tolerance
        const amountInFormatted = ethers.formatEther(amountIn);
        console.log({ amountInFormatted }, { path });
        const result = await uniswapRouter.getAmountsOut(amountIn, path);

        const expectedAmt = result[result.length - 1];
        const deadline = Math.floor(Date.now() / 1000) + 60 * 8; // 8-minute deadline
        const amountOutMin = expectedAmt - expectedAmt / BigInt(10); // 10% slippage
        const overrideOptions = { value: amountIn };

        // Execute swap transaction
        const swapTx = await uniswapRouter.swapExactETHForTokens(
            amountOutMin,
            path,
            wallet.address,
            deadline,
            overrideOptions
        );

        const receipt = await swapTx.wait();
        if (receipt) {
            console.log("TOKEN SWAP SUCCESSFUL");
            const transactionHash = receipt.transactionHash;
            const transactionUrl = `${explorer}${transactionHash}`;

            return {
                type: "BUY",
                amountIn: amountInFormatted,
                amountOutMin: ethers.formatEther(amountOutMin),
                path: path,
                wallet: wallet.address,
                transaction_url: transactionUrl,
            };
        }
    } catch (error) {
        console.error("Error during token swap:", error);
    }
    return false;
};

// Approve function for selling tokens
const approveToken = async (wallet: Wallet, tokenAddress: string, amountIn: BigNumberish) => {
    try {
        const tokenContract = new ethers.Contract(tokenAddress, ZYGO_ABI, wallet);
        const allowance = await tokenContract.allowance(wallet.address, UNISWAP_ADDRESS);

        if (allowance.lt(amountIn)) {
            console.log("Approving token for swap...");
            const approveTx = await tokenContract.approve(UNISWAP_ADDRESS, amountIn);
            await approveTx.wait();
            console.log("Approval successful.");
            return true;
        } else {
            console.log("Token already approved for the required amount.");
            return true;
        }
    } catch (error) {
        console.error("Approval failed:", error);
        return false;
    }
};

// Sell Tokens Function with approval check
const sellTokens = async (wallet: Wallet, amountIn: BigNumberish, tries = 1) => {
    try {
        if (tries > 3) return false;
        console.log(`Try #${tries} for selling tokens...`);

        // Approve token before selling
        const approvalSuccess = await approveToken(wallet, ZYGO, amountIn);
        if (!approvalSuccess) {
            console.log("Approval for sell failed. Exiting sell process.");
            return false;
        }

        // Path for selling tokens to ETH
        const path = [ZYGO, USDT, WETH];

        // Execute the swap
        const result = await swapExactTokensForETH(amountIn, path, wallet);

        if (result) {
            console.log(`Sell transaction successful! ETH received: ${result.amountIn}`);
            return result;
        } else throw new Error("Sell transaction failed.");
    } catch (error) {
        console.error("Sell attempt failed. Retrying...", error);

        return await sellTokens(wallet, amountIn, tries + 1);
    }
};

// Swaps Function for token to ETH swap (sell)
const swapExactTokensForETH = async (amountIn: BigNumberish, path: string[], wallet: Wallet) => {
    try {
        const uniswapRouter = new ethers.Contract(UNISWAP_ADDRESS, UNISWAP_ABI, wallet);
        const result = await uniswapRouter.getAmountsOut(amountIn, path);

        const expectedAmt = result[result.length - 1];
        const deadline = Math.floor(Date.now() / 1000) + 60 * 8;
        const amountOutMin = expectedAmt - expectedAmt / BigInt(10);

        const swapTx = await uniswapRouter.swapExactTokensForETH(
            amountIn,
            amountOutMin,
            path,
            wallet.address,
            deadline
        );

        const receipt = await swapTx.wait();
        if (receipt) {
            const transactionHash = receipt.transactionHash;
            const transactionUrl = `${explorer}${transactionHash}`;

            return {
                type: "SELL",
                amountIn: ethers.formatEther(amountIn),
                amountOutMin: ethers.formatEther(amountOutMin),
                path: path,
                wallet: wallet.address,
                transaction_url: transactionUrl,
            };
        }
    } catch (error) {
        console.error("Error during token sell:", error);
    }
    return false;
};

// Function to get token balance
const getTokenBalance = async (wallet: ethers.Wallet, tokenAddress: string): Promise<bigint> => {
    const tokenContract = new ethers.Contract(tokenAddress, ["function balanceOf(address owner) view returns (uint256)"], wallet);
    return await tokenContract.balanceOf(wallet.address);
};

// Helper function for random trade amount
const getRandomTradeAmount = (): ethers.BigNumberish => {
    const randomFactor = Math.random(); // Generates a number between 0 and 1
    const range = ethers.toBigInt(MAX_TRADE_AMOUNT) - ethers.toBigInt(MIN_TRADE_AMOUNT);
    return ethers.toBigInt(MIN_TRADE_AMOUNT) + (range * BigInt(Math.floor(randomFactor * 100)) / BigInt(100));
};

// Helper function for creating sub-wallets
const createWallets = async (numWallets: number): Promise<ethers.Wallet[]> => {
    const wallets = Array.from({ length: numWallets }).map(() => {
        const hdWallet = ethers.HDNodeWallet.createRandom();
        return new ethers.Wallet(hdWallet.privateKey, provider);
    });
    return wallets;
};

// Save wallet details to data.json
const saveWallets = (wallets: ethers.Wallet[]) => {
    const walletData = wallets.map(wallet => ({
        address: wallet.address,
        privateKey: wallet.privateKey,
    }));
    fs.writeFileSync("./data.json", JSON.stringify(walletData, null, 2));
    console.log("Wallets saved to data.json");
};

// Load wallet details from data.json
const loadWallets = (): ethers.Wallet[] => {
    const walletData = JSON.parse(fs.readFileSync("./data.json", "utf-8"));
    return walletData.map((data: { address: string; privateKey: string }) =>
        new ethers.Wallet(data.privateKey, provider)
    );
};

// Fund each wallet from the treasury wallet
const fundWallets = async (wallets: ethers.Wallet[], amount: ethers.BigNumberish) => {
    for (const wallet of wallets) {
        const tx = await treasuryWallet.sendTransaction({
            to: wallet.address,
            value: amount,
        });
        await tx.wait();
        console.log(`Funded wallet ${wallet.address} with ${ethers.formatEther(amount)} ETH`);
    }
};

// Collect ETH from sub-wallets back to treasury
const collectFunds = async (wallets: ethers.Wallet[]) => {
    try {
        for (const wallet of wallets) {
            const balance = await provider.getBalance(wallet.address);
            const minTransferAmount = ethers.parseEther("0.001");
            const transactionFeeBuffer = ethers.parseEther("0.002");

            if (balance > minTransferAmount) {
                const tx = await wallet.sendTransaction({
                    to: treasuryWallet.address,
                    value: balance - transactionFeeBuffer,
                });
                await tx.wait();
                console.log(`Transferred ${ethers.formatEther(balance - transactionFeeBuffer)} ETH from ${wallet.address} to treasury`);
            }
        }
    } catch (error) {
        console.error("collectFunds encountered an error", error);
    }
};


main();