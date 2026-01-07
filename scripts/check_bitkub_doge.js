
async function checkBitkubDoge() {
    try {
        console.log("Fetching Bitkub Ticker...");
        const response = await fetch('https://api.bitkub.com/api/market/ticker');
        const data = await response.json();
        const doge = data['THB_DOGE'];

        console.log("Current Time:", new Date().toISOString());
        console.log("DOGE Ticker Data:");
        console.log(JSON.stringify(doge, null, 2));

        console.log("\nFetching Bitkub Order Book (Depth) for DOGE...");
        const depthRes = await fetch('https://api.bitkub.com/api/market/depth?sym=THB_DOGE&lmt=5');
        const depthData = await depthRes.json();
        console.log("DOGE Depth Data (Asks):", JSON.stringify(depthData.asks, null, 2));
        console.log("DOGE Depth Data (Bids):", JSON.stringify(depthData.bids, null, 2));

    } catch (e) {
        console.error(e);
    }
}
checkBitkubDoge();
