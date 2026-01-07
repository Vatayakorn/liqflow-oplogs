
async function verifyDoge() {
    try {
        console.log("--- Fetching Current Data ---");

        // 1. Bitkub DOGE_THB
        const bkRes = await fetch('https://api.bitkub.com/api/market/ticker');
        const bkData = await bkRes.json();
        const bkDoge = bkData['THB_DOGE'];
        console.log("Bitkub DOGE_THB:", bkDoge);

        // 2. Bybit DOGEUSDT
        const bbRes = await fetch('https://api.bybit.com/v5/market/tickers?category=spot&symbol=DOGEUSDT');
        const bbData = await bbRes.json();
        const bbDoge = bbData.result.list[0];
        console.log("Bybit DOGEUSDT:", bbDoge);

        // 3. BinanceTH FX (USDTTHB)
        const bnRes = await fetch('https://api.binance.th/api/v1/depth?symbol=USDTTHB&limit=1');
        const bnData = await bnRes.json();
        const fxBid = parseFloat(bnData.bids[0][0]);
        const fxAsk = parseFloat(bnData.asks[0][0]);
        const fxMid = (fxBid + fxAsk) / 2;
        console.log("BinanceTH FX (USDTTHB):", { bid: fxBid, ask: fxAsk, mid: fxMid });

        console.log("\n--- Comparison with User Data ---");
        console.log("User Local Ask (Bitkub): 3.9866");
        console.log("User Global Bid (Bybit): 0.15044");
        console.log("User FX Rate: 31.2450");

    } catch (e) {
        console.error(e);
    }
}
verifyDoge();
