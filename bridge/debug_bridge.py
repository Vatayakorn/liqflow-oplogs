import requests
import os

ENDPOINTS = {
    'bitkub': 'https://api.bitkub.com/api/market/depth?sym=THB_USDT&lmt=5',
    'binance_th': 'https://api.binance.th/api/v1/depth?symbol=USDTTHB&limit=5',
    'maxbit': 'https://maxbitapi-prd.unit.co.th/api/otc'
}

MAXBIT_CONFIG = {
    'url': 'https://maxbitapi-prd.unit.co.th/api/otc',
    'headers': {
        'Content-Type': 'application/json',
        'secret-api': 'MAXBITOTC',
        'secret-key': '2e104ac5-2cea-41b9-bb02-15ff1580917b',
    },
    'body': {
        'groupid': 'C38a571cc9b25c98313b2b4e9de20854f',
        'symbol': 'usdt',
    }
}

def check_bitkub():
    try:
        r = requests.get(ENDPOINTS['bitkub'], timeout=5)
        d = r.json()
        bids = [[float(p), float(v)] for p, v in d['bids'][:5]]
        asks = [[float(p), float(v)] for p, v in d['asks'][:5]]
        best_bid = bids[0][0] if bids else None
        best_ask = asks[0][0] if asks else None
        price = (best_bid + best_ask) / 2 if (best_bid and best_ask) else None
        print(f"Bitkub: Bid={best_bid}, Ask={best_ask}, Price={price} (Type: {type(price)})")
    except Exception as e:
        print(f"Bitkub Error: {e}")

def check_binance():
    try:
        r = requests.get(ENDPOINTS['binance_th'], timeout=5)
        d = r.json()
        bids = [[float(p), float(v)] for p, v in d['bids'][:5]]
        asks = [[float(p), float(v)] for p, v in d['asks'][:5]]
        best_bid = bids[0][0] if bids else None
        best_ask = asks[0][0] if asks else None
        price = (best_bid + best_ask) / 2 if (best_bid and best_ask) else None
        print(f"BinanceTH: Bid={best_bid}, Ask={best_ask}, Price={price} (Type: {type(price)})")
    except Exception as e:
        print(f"BinanceTH Error: {e}")

def check_maxbit():
    try:
        r = requests.post(MAXBIT_CONFIG['url'], headers=MAXBIT_CONFIG['headers'], json=MAXBIT_CONFIG['body'], timeout=5)
        d = r.json()
        if d.get('responseCode') == '000':
            res = d['result']
            bid = float(res['bid'])
            ask = float(res['ask'])
            price = (bid + ask) / 2
            print(f"MaxBit: Bid={bid}, Ask={ask}, Price={price} (Type: {type(price)})")
        else:
            print(f"MaxBit Error Response: {d}")
    except Exception as e:
        print(f"MaxBit Error: {e}")

if __name__ == "__main__":
    check_bitkub()
    check_binance()
    check_maxbit()
