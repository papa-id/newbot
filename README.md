
# ðŸ¤– newbot - 0g.ai Testnet Trading Bot

An automated bot for performing **token swaps** and **liquidity additions** on the [0g.ai Testnet](https://evmrpc-testnet.0g.ai), built with `ethers.js`. This script supports **multiple wallets**, **proxy rotation**, and randomized behaviors for testing purposes.

---

## ðŸš€ Features

- âœ… Interactive CLI menu
- âœ… Multi-wallet support via `.env` file
- âœ… Proxy support (`HTTP`, `SOCKS4`, `SOCKS5`) via `proxies.txt`
- âœ… Random token pairs for swap/liquidity
- âœ… Random delay between actions (50â€“120 seconds)
- âœ… Safe for use on testnets only

---

## ðŸ“¦ Installation

### 1. Clone the repository

```bash
git clone https://github.com/papa-id/newbot.git
cd newbot
```

### 2. Install dependencies

```bash
npm install
```

---

## âš™ï¸ Configuration

### 1. `.env` File

Create a `.env` file in the project root with your private keys:

```
PRIVATE_KEY1=0xabc123...
PRIVATE_KEY2=0xdef456...
```

> âš ï¸ Use **testnet wallets only**. Never use mainnet/private wallets here.

### 2. `proxies.txt` (Optional)

Create a `proxies.txt` file in the root folder to enable proxy support. Example formats:

```
http://127.0.0.1:8080
socks5://username:password@127.0.0.1:1080
127.0.0.1:8888
```

If no proxies are provided, the bot will work without them.

---

## â–¶ï¸ How to Run

```bash
node main.js
```

Then follow the interactive CLI:

1. Choose action mode: **Swap**, **Liquidity**, or **Both**
2. Enter number of transactions per wallet
3. Choose whether to use proxies
4. The bot will execute actions automatically

---

## ðŸ§ª Example Output

```
âœ¨ Welcome to LONTE DEX Script âœ¨
1. Swap
2. Liquidity
3. Both
Enter your choice: 3
Enter number of transactions: 5
Use proxy? (y/n): y
...
```

---

## ðŸ› ï¸ Dependencies

As defined in `package.json`:

- `ethers`
- `dotenv`
- `readline`
- `https-proxy-agent`
- `socks-proxy-agent`

Installed automatically via `npm install`.

---

## ðŸ’¡ Tips

- Use faucet services to fund your testnet wallet
- Check `0g.ai` documentation for supported tokens and endpoints
- Use randomized wallets/proxies for stress-testing

---

## ðŸ§‘â€ðŸ’» Author

Built by [papa-id](https://github.com/papa-id)

---

## ðŸ“„ License

This project is open-sourced under the MIT License â€” free to use for learning, development, and testnet experimentation.
