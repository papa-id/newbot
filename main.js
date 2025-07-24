console.clear();
console.log(`
                      LONTE                        
`);

require('dotenv').config();
const { ethers } = require('ethers');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const HttpsProxyAgent = require('https-proxy-agent');
// Fix: Import SocksProxyAgent correctly
const { SocksProxyAgent } = require('socks-proxy-agent');

// Hard-coded values as specified
const RPC_URL = 'https://evmrpc-testnet.0g.ai';
const zer0dexAddress = '0x44f24b66b3baa3a784dbeee9bfe602f15a2cc5d9';
const routerAddress = '0xb95B5953FF8ee5D5d9818CdbEfE363ff2191318c';

const TOKENS = [
  { symbol: 'USDT', address: '0x3ec8a8705be1d5ca90066b37ba62c4183b024ebf' },
  { symbol: 'BTC', address: '0x36f6414ff1df609214ddaba71c84f18bcf00f67d' },
  { symbol: 'ETH', address: '0x0fe9b43625fa7edd663adcec0728dd635e4abf7c' },
  { symbol: 'GIMO', address: '0xba2aE6c8cddd628a087D7e43C1Ba9844c5Bf9638' },
  { symbol: 'STOG', address: '0x14d2F76020c1ECb29BcD673B51d8026C6836a66A' }
];

const FEE = 100; // 0.01%

const routerAbi = [
  "function exactInputSingle(tuple(address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountIn,uint256 amountOutMinimum,uint256 deadline,uint160 sqrtPriceLimitX96)) external payable returns (uint256)"
];

const zer0dexAbi = [
  {
    "inputs": [
      {
        "components": [
          { "internalType": "address", "name": "token0", "type": "address" },
          { "internalType": "address", "name": "token1", "type": "address" },
          { "internalType": "uint24", "name": "fee", "type": "uint24" },
          { "internalType": "int24", "name": "tickLower", "type": "int24" },
          { "internalType": "int24", "name": "tickUpper", "type": "int24" },
          { "internalType": "uint256", "name": "amount0Desired", "type": "uint256" },
          { "internalType": "uint256", "name": "amount1Desired", "type": "uint256" },
          { "internalType": "uint256", "name": "amount0Min", "type": "uint256" },
          { "internalType": "uint256", "name": "amount1Min", "type": "uint256" },
          { "internalType": "address", "name": "recipient", "type": "address" },
          { "internalType": "uint256", "name": "deadline", "type": "uint256" }
        ],
        "internalType": "struct MintParams",
        "name": "params",
        "type": "tuple"
      }
    ],
    "name": "mint",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

const erc20Abi = [
  "function balanceOf(address) view returns (uint)",
  "function approve(address spender, uint amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function decimals() view returns (uint8)"
];

const pairs = [
  ["ETH", "BTC"],
  ["ETH", "USDT"],
  ["BTC", "USDT"],
  ["GIMO", "USDT"],
  ["GIMO", "ETH"],
  ["GIMO", "BTC"],
  ["STOG", "USDT"],
  ["STOG", "ETH"],
  ["STOG", "BTC"],
  ["GIMO", "STOG"]
];

// Create readline interface for CLI
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

// Proxy handling
let proxies = [];
function loadProxies() {
  try {
    const proxyFile = path.resolve(process.cwd(), 'proxies.txt');
    if (fs.existsSync(proxyFile)) {
      const data = fs.readFileSync(proxyFile, 'utf8');
      proxies = data.split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));
      
      console.log(`📋 Loaded ${proxies.length} proxies from proxies.txt`);
    } else {
      console.log(`⚠️ proxies.txt not found, running without proxies`);
    }
  } catch (err) {
    console.error(`❌ Error loading proxies: ${err.message}`);
  }
}

function getRandomProxy() {
  if (proxies.length === 0) return null;
  return proxies[Math.floor(Math.random() * proxies.length)];
}

function createProxyAgent(proxyUrl) {
  if (!proxyUrl) return null;
  
  let proxyString = proxyUrl.trim();
  
  try {
    // Format detection and agent creation
    if (proxyString.startsWith('socks5://')) {
      return new SocksProxyAgent(proxyString);
    } else if (proxyString.startsWith('socks4://')) {
      return new SocksProxyAgent(proxyString);
    } else if (proxyString.startsWith('http://') || proxyString.startsWith('https://')) {
      return new HttpsProxyAgent(proxyString);
    } else if (proxyString.includes('@')) {
      // Handle username:password@ip:port format
      if (proxyString.includes('socks5')) {
        return new SocksProxyAgent(`socks5://${proxyString}`);
      } else if (proxyString.includes('socks4')) {
        return new SocksProxyAgent(`socks4://${proxyString}`);
      } else {
        return new HttpsProxyAgent(`http://${proxyString}`);
      }
    } else if (proxyString.includes(':')) {
      // Simple IP:Port format, assume HTTP
      return new HttpsProxyAgent(`http://${proxyString}`);
    }
    
    console.log(`⚠️ Unrecognized proxy format: ${proxyString}, skipping`);
    return null;
  } catch (err) {
    console.error(`❌ Error creating proxy agent for ${proxyString}: ${err.message}`);
    return null;
  }
}

// Modified provider creation with proxy support and rate limiting
function createProvider(proxy = null) {
  const options = {
    throttleLimit: 1, // Limit to 1 concurrent request
    throttleSlotInterval: 100 // 100ms between requests
  };
  
  if (proxy) {
    try {
      const agent = createProxyAgent(proxy);
      if (agent) {
        options.fetchOptions = {
          agent: agent
        };
      }
    } catch (err) {
      console.error(`❌ Error setting up proxy: ${err.message}`);
      console.log(`⚠️ Continuing without proxy...`);
    }
  }
  
  return new ethers.JsonRpcProvider(RPC_URL, undefined, options);
}

// Retry function for RPC calls
async function retryWithDelay(fn, maxRetries = 3, delay = 2000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.code === 'UNKNOWN_ERROR' && error.error?.code === -32005) {
        console.log(`⚠️ Rate limit hit, retrying in ${delay}ms... (attempt ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      } else {
        throw error;
      }
    }
  }
  throw new Error(`Max retries (${maxRetries}) exceeded`);
}

// Add delay between RPC calls
async function safeRpcCall(fn, description = "RPC call") {
  await new Promise(resolve => setTimeout(resolve, 200)); // 200ms delay before each call
  return await retryWithDelay(fn, 3, 1000);
}

function getRandomTokenPair() {
  let i = Math.floor(Math.random() * TOKENS.length);
  let j;
  do {
    j = Math.floor(Math.random() * TOKENS.length);
  } while (j === i);
  return [TOKENS[i], TOKENS[j]];
}

function getRandomPercentage(min = 0.01, max = 0.05) {
  return Math.random() * (max - min) + min;
}

function getRandomPercent(min = 1, max = 5) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomDelay() {
  // Random delay between 50-120 seconds
  const seconds = Math.floor(Math.random() * (120 - 50 + 1)) + 50;
  console.log(`\n⏱️ Delay selama ${seconds} detik...\n`);
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

async function performSwap(wallet, count) {
  const walletAddress = await safeRpcCall(() => wallet.getAddress(), "get wallet address");
  const router = new ethers.Contract(routerAddress, routerAbi, wallet);

  console.log(`\n🔄 Mulai ${count} aksi swap`);
  
  // Display initial balances for all tokens
  console.log("\n💰 Balance Token Awal:");
  for (const token of TOKENS) {
    try {
      const tokenContract = new ethers.Contract(token.address, erc20Abi, wallet);
      const decimals = await safeRpcCall(() => tokenContract.decimals(), `get ${token.symbol} decimals`);
      const balance = await safeRpcCall(() => tokenContract.balanceOf(walletAddress), `get ${token.symbol} balance`);
      console.log(`→ ${token.symbol}: ${ethers.formatUnits(balance, decimals)}`);
    } catch (err) {
      console.log(`→ ${token.symbol}: Error getting balance - ${err.message}`);
    }
  }

  for (let i = 0; i < count; i++) {
    try {
      const [fromToken, toToken] = getRandomTokenPair();
      const token = new ethers.Contract(fromToken.address, erc20Abi, wallet);

      const decimals = await safeRpcCall(() => token.decimals(), `get ${fromToken.symbol} decimals`);
      const balance = await safeRpcCall(() => token.balanceOf(walletAddress), `get ${fromToken.symbol} balance`);
      
      if (balance === 0n) {
        console.log(`Saldo ${fromToken.symbol} kosong. Skip.`);
        continue;
      }

      const percentage = getRandomPercentage();
      const amountIn = BigInt(Math.floor(Number(balance) * percentage));
      const amountOutMin = amountIn / 2n;

      const allowance = await safeRpcCall(() => token.allowance(walletAddress, routerAddress), `get ${fromToken.symbol} allowance`);
      
      if (allowance < amountIn) {
        console.log(`Approving ${fromToken.symbol}...`);
        const approveTx = await safeRpcCall(() => token.approve(routerAddress, amountIn), `approve ${fromToken.symbol}`);
        await safeRpcCall(() => approveTx.wait(), `wait for approve tx`);
      }

      const deadline = Math.floor(Date.now() / 1000) + 600;

      const params = {
        tokenIn: fromToken.address,
        tokenOut: toToken.address,
        fee: FEE,
        recipient: walletAddress,
        amountIn,
        amountOutMinimum: amountOutMin,
        sqrtPriceLimitX96: 0,
        deadline: BigInt(deadline)
      };

      console.log(`\u{1F501} [${i+1}/${count}] Swap ${fromToken.symbol} → ${toToken.symbol} | Amount: ${ethers.formatUnits(amountIn, decimals)}`);

      const tx = await safeRpcCall(() => router.exactInputSingle(params, { gasLimit: 300000n }), "execute swap");
      const receipt = await safeRpcCall(() => tx.wait(), "wait for swap tx");
      console.log(`✅ Swap Success! Tx Hash: ${receipt.hash}`);
      
      // Display updated balances for the tokens involved in the swap
      try {
        const fromTokenContract = new ethers.Contract(fromToken.address, erc20Abi, wallet);
        const toTokenContract = new ethers.Contract(toToken.address, erc20Abi, wallet);
        
        const fromDecimal = await safeRpcCall(() => fromTokenContract.decimals(), `get ${fromToken.symbol} decimals`);
        const toDecimal = await safeRpcCall(() => toTokenContract.decimals(), `get ${toToken.symbol} decimals`);
        
        const newFromBalance = await safeRpcCall(() => fromTokenContract.balanceOf(walletAddress), `get updated ${fromToken.symbol} balance`);
        const newToBalance = await safeRpcCall(() => toTokenContract.balanceOf(walletAddress), `get updated ${toToken.symbol} balance`);
        
        console.log(`\n💰 Balance Token Update:`);
        console.log(`→ ${fromToken.symbol}: ${ethers.formatUnits(newFromBalance, fromDecimal)}`);
        console.log(`→ ${toToken.symbol}: ${ethers.formatUnits(newToBalance, toDecimal)}`);
      } catch (err) {
        console.log(`⚠️ Error getting updated balances: ${err.message}`);
      }
      
    } catch (err) {
      console.error(`❌ Gagal swap:`, err?.shortMessage || err.message || err);
    }

    if (i < count - 1) {
      await getRandomDelay();
    }
  }
  
  // Display final balances after all swaps
  console.log("\n💰 Balance Token Setelah Semua Swap:");
  for (const token of TOKENS) {
    try {
      const tokenContract = new ethers.Contract(token.address, erc20Abi, wallet);
      const decimals = await safeRpcCall(() => tokenContract.decimals(), `get ${token.symbol} decimals`);
      const balance = await safeRpcCall(() => tokenContract.balanceOf(walletAddress), `get final ${token.symbol} balance`);
      console.log(`→ ${token.symbol}: ${ethers.formatUnits(balance, decimals)}`);
    } catch (err) {
      console.log(`→ ${token.symbol}: Error getting final balance - ${err.message}`);
    }
  }
}

async function performLiquidity(wallet, count) {
  const walletAddress = await safeRpcCall(() => wallet.getAddress(), "get wallet address");
  const dex = new ethers.Contract(zer0dexAddress, zer0dexAbi, wallet);

  console.log(`\n🔁 Mulai ${count} aksi add liquidity`);
  
  // Display initial balances for all tokens before liquidity operations
  console.log("\n💰 Balance Token Sebelum Add Liquidity:");
  for (const token of TOKENS) {
    try {
      const tokenContract = new ethers.Contract(token.address, erc20Abi, wallet);
      const decimals = await safeRpcCall(() => tokenContract.decimals(), `get ${token.symbol} decimals`);
      const balance = await safeRpcCall(() => tokenContract.balanceOf(walletAddress), `get ${token.symbol} balance`);
      console.log(`→ ${token.symbol}: ${ethers.formatUnits(balance, decimals)}`);
    } catch (err) {
      console.log(`→ ${token.symbol}: Error getting balance - ${err.message}`);
    }
  }

  for (let r = 1; r <= count; r++) {
    try {
      const [name0, name1] = pairs[Math.floor(Math.random() * pairs.length)];
      
      // Get token addresses from our TOKENS array
      const token0Data = TOKENS.find(t => t.symbol === name0);
      const token1Data = TOKENS.find(t => t.symbol === name1);
      
      if (!token0Data || !token1Data) {
        console.log(`[${r}/${count}] ❌ Token pair not found: ${name0}/${name1}. Skip.`);
        continue;
      }
      
      const addr0 = token0Data.address;
      const addr1 = token1Data.address;

      const token0 = new ethers.Contract(addr0, erc20Abi, wallet);
      const token1 = new ethers.Contract(addr1, erc20Abi, wallet);

      const bal0 = await safeRpcCall(() => token0.balanceOf(walletAddress), `get ${name0} balance`);
      const bal1 = await safeRpcCall(() => token1.balanceOf(walletAddress), `get ${name1} balance`);

      if (bal0 === 0n || bal1 === 0n) {
        console.log(`[${r}/${count}] ❌ Saldo ${name0}/${name1} kosong. Skip.`);
        continue;
      }

      const dec0 = await safeRpcCall(() => token0.decimals(), `get ${name0} decimals`);
      const dec1 = await safeRpcCall(() => token1.decimals(), `get ${name1} decimals`);

      const pct0 = getRandomPercent();
      const pct1 = getRandomPercent();
      const amt0 = bal0 * BigInt(pct0) / 100n;
      const amt1 = bal1 * BigInt(pct1) / 100n;

      console.log(`\n[${r}/${count}] ✅ Add liquidity ${name0}/${name1}`);
      console.log(`→ ${pct0}% ${name0}: ${ethers.formatUnits(amt0, dec0)}`);
      console.log(`→ ${pct1}% ${name1}: ${ethers.formatUnits(amt1, dec1)}`);

      await safeRpcCall(() => token0.approve(zer0dexAddress, amt0), `approve ${name0}`);
      await safeRpcCall(() => token1.approve(zer0dexAddress, amt1), `approve ${name1}`);

      const deadline = Math.floor(Date.now() / 1000) + 300;

      const mintParams = [
        addr0,
        addr1,
        3000,
        -887220,
        887220,
        amt0,
        amt1,
        0,
        0,
        walletAddress,
        deadline
      ];

      const tx = await safeRpcCall(() => dex.mint(mintParams, { gasLimit: 600000 }), "execute mint");
      console.log(`[${r}/${count}] 🚀 TX terkirim: ${tx.hash}`);
      await safeRpcCall(() => tx.wait(), "wait for mint tx");
      console.log(`[${r}/${count}] 🎉 Sukses!`);
      
      // Display updated token balances after liquidity addition
      try {
        const newBal0 = await safeRpcCall(() => token0.balanceOf(walletAddress), `get updated ${name0} balance`);
        const newBal1 = await safeRpcCall(() => token1.balanceOf(walletAddress), `get updated ${name1} balance`);
        
        console.log(`\n💰 Balance Token Update:`);
        console.log(`→ ${name0}: ${ethers.formatUnits(newBal0, dec0)}`);
        console.log(`→ ${name1}: ${ethers.formatUnits(newBal1, dec1)}`);
      } catch (err) {
        console.log(`⚠️ Error getting updated balances: ${err.message}`);
      }
      
    } catch (err) {
      console.error(`[${r}/${count}] ❌ Gagal mint:`, err?.shortMessage || err.message || err);
    }

    if (r < count) {
      await getRandomDelay();
    }
  }
  
  // Display final balances after all liquidity operations
  console.log("\n💰 Balance Token Setelah Semua Add Liquidity:");
  for (const token of TOKENS) {
    try {
      const tokenContract = new ethers.Contract(token.address, erc20Abi, wallet);
      const decimals = await safeRpcCall(() => tokenContract.decimals(), `get ${token.symbol} decimals`);
      const balance = await safeRpcCall(() => tokenContract.balanceOf(walletAddress), `get final ${token.symbol} balance`);
      console.log(`→ ${token.symbol}: ${ethers.formatUnits(balance, decimals)}`);
    } catch (err) {
      console.log(`→ ${token.symbol}: Error getting final balance - ${err.message}`);
    }
  }
}

async function main() {
  try {
    console.log("\n✨ Welcome to LONTE DEX Script ✨");
    console.log("=================================");
    
    // Load proxies from file
    loadProxies();
    
    // Step 1: Choose action type
    console.log("\nSilahkan pilih angka ini untuk melanjutkan:");
    console.log("   1. Swap");
    console.log("   2. Liquidity");
    console.log("   3. Both");
    
    const actionChoice = await askQuestion("Pilihan Anda (1-3): ");
    const action = parseInt(actionChoice);
    
    if (isNaN(action) || action < 1 || action > 3) {
      console.log("❌ Pilihan tidak valid. Silakan coba lagi.");
      rl.close();
      return;
    }
    
    // Step 2: Get transaction count
    const txCountStr = await askQuestion("Masukan Jumlah transaksi: ");
    const txCount = parseInt(txCountStr);
    
    if (isNaN(txCount) || txCount < 1) {
      console.log("❌ Jumlah transaksi tidak valid. Silakan coba lagi.");
      rl.close();
      return;
    }
    
    // Step 3: Ask about using proxies
    let useProxyChoice = "n";
    if (proxies.length > 0) {
      useProxyChoice = await askQuestion("Gunakan proxy? (y/n): ");
    }
    const useProxy = useProxyChoice.toLowerCase() === "y";
    
    console.log("\n📝 Konfigurasi:");
    console.log(`→ Mode: ${action === 1 ? 'Swap' : action === 2 ? 'Liquidity' : 'Both'}`);
    console.log(`→ Jumlah transaksi: ${txCount}`);
    console.log(`→ Delay: 50-120 detik per transaksi`);
    console.log(`→ Menggunakan Proxy: ${useProxy ? 'Ya' : 'Tidak'}`);
    
    // Get wallets from .env
    const wallets = Object.entries(process.env)
      .filter(([k, v]) => k.startsWith("PRIVATE_KEY") && v.startsWith("0x") && v.length === 66)
      .map(([_, v]) => v);
    
    if (wallets.length === 0) {
      console.log("❌ Tidak ada private key yang ditemukan di file .env");
      console.log("Pastikan file .env memiliki format PRIVATE_KEY1=0x..., PRIVATE_KEY2=0x..., dst.");
      rl.close();
      return;
    }
    
    console.log(`🔑 Ditemukan ${wallets.length} wallet.\n`);
    
    // Process each wallet
    for (let w = 0; w < wallets.length; w++) {
      // Choose a random proxy for this wallet if enabled
      let proxy = null;
      if (useProxy) {
        proxy = getRandomProxy();
        if (proxy) {
          console.log(`🔄 Menggunakan proxy: ${proxy.includes('@') ? '[redacted-auth]' : proxy}`);
        }
      }
      
      // Create provider with or without proxy
      let provider;
      try {
        provider = createProvider(proxy);
      } catch (err) {
        console.error(`❌ Error creating provider: ${err.message}`);
        console.log(`⚠️ Skipping wallet #${w + 1} due to provider error`);
        continue;
      }
      
      const wallet = new ethers.Wallet(wallets[w], provider);
      const walletAddress = ethers.getAddress(await wallet.getAddress());
      
      console.log(`\n\u{1F4BC} Wallet #${w + 1}: ${walletAddress}`);
      
      // Execute transactions based on selected action
      if (action === 1) {
        // Swap only
        await performSwap(wallet, txCount);
      } else if (action === 2) {
        // Liquidity only
        await performLiquidity(wallet, txCount);
      } else if (action === 3) {
        // Both - do both swap and liquidity with the specified count for each
        await performSwap(wallet, txCount);
        
        // Add a transition delay between swap and liquidity operations
        const transitionDelay = Math.floor(Math.random() * (120 - 50 + 1)) + 50;
        console.log(`\n⏱️ Transisi dari Swap ke Liquidity... Delay selama ${transitionDelay} detik...\n`);
        await new Promise((resolve) => setTimeout(resolve, transitionDelay * 1000));
        
        await performLiquidity(wallet, txCount);
      }
      
      console.log(`\n✅ Semua aksi selesai untuk wallet ${walletAddress}`);
    }
    
    console.log("\n🎉 Script selesai dijalankan!");
    rl.close();
  } catch (err) {
    console.error('Fatal error:', err);
    rl.close();
    process.exit(1);
  }
}

main();
