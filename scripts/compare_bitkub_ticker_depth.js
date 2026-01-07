
async function compareBitkubTickerDepth() {
    const coins = ['BTC', 'ETH', 'DOGE', 'XRP', 'SOL'];

    try {
        console.log("Fetching Ticker...");
        const tickRes = await fetch('https://api.bitkub.com/api/market/ticker');
        const tickData = await tickRes.json();

        for (const coin of coins) {
            const symbol = `THB_${coin}`;
            const ticker = tickData[symbol];

            console.log(`\n--- ${coin} ---`);
            if (!ticker) {
                console.log("Ticker not found");
                continue;
            }

            console.log(`Ticker Best Ask: ${ticker.lowestAsk}`);

            const depthRes = await fetch(`https://api.bitkub.com/api/market/depth?sym=${symbol}&lmt=1`);
            const depthData = await depthRes.json();

            if (depthData.asks && depthData.asks.length > 0) {
                console.log(`Depth  Best Ask: ${depthData.asks[0][0]}`);
                const diff = ticker.lowestAsk - depthData.asks[0][0];
                if (diff !== 0) {
                    console.log(`DIFFERENCE: ${diff}`);
                } else {
                    console.log("MATCH");
                }
            } else {
                console.log("Depth not found");
            }
        }
    } catch (e) {
        console.error(e);
    }
}

compareBitkubTickerDepth();
