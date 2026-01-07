
async function checkBinanceTH() {
    try {
        const bnRes = await fetch('https://api.binance.th/api/v1/exchangeInfo');
        const bnData = await bnRes.json();
        const quotes = [...new Set(bnData.symbols.map(s => s.quoteAsset))];
        console.log("BinanceTH Quotes:", quotes);

        const usdtPairs = bnData.symbols.filter(s => s.quoteAsset === 'USDT').map(s => s.baseAsset);
        console.log("BinanceTH USDT Pairs Count:", usdtPairs.length);
        console.log("BinanceTH USDT Pairs (first 10):", usdtPairs.slice(0, 10));

        const thbPairs = bnData.symbols.filter(s => s.quoteAsset === 'THB').map(s => s.baseAsset);
        console.log("BinanceTH THB Pairs:", thbPairs);
    } catch (e) {
        console.error(e);
    }
}
checkBinanceTH();
