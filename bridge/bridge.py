import time
import os
import json
import requests
from dotenv import load_dotenv
from supabase import create_client, Client
from datetime import datetime

# Load environment variables
# Load environment variables
# Try loading from current directory first (for VPS), then parent (for local dev)
env_path = os.path.join(os.path.dirname(__file__), '.env')
if not os.path.exists(env_path):
    env_path = os.path.join(os.path.dirname(__file__), '../.env')
load_dotenv(dotenv_path=env_path)

# Supabase Setup
url: str = os.environ.get("PUBLIC_SUPABASE_URL")
key: str = os.environ.get("PUBLIC_SUPABASE_ANON_KEY")

if not url or not key:
    print("Error: Supabase credentials not found in .env")
    exit(1)

supabase: Client = create_client(url, key)

# Configuration
INTERVAL_SECONDS = 1

# Endpoints
ENDPOINTS = {
    'bitkub': 'https://api.bitkub.com/api/market/depth?sym=THB_USDT&lmt=5',
    'binance_th': 'https://api.binance.th/api/v1/depth?symbol=USDTTHB&limit=5',
    'fx': 'https://open.er-api.com/v6/latest/USD',
    'maxbit': 'https://maxbitapi-prd.unit.co.th/api/otc'
}

# MaxBit Config
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

def fetch_bitkub():
    try:
        response = requests.get(ENDPOINTS['bitkub'], timeout=5)
        data = response.json()
        if data and 'bids' in data and 'asks' in data:
            # Bitkub format: [[price, volume], ...]
            # We already requested limit=5 in the URL
            bids = [[float(p), float(v)] for p, v in data['bids'][:5]]
            asks = [[float(p), float(v)] for p, v in data['asks'][:5]]
            
            best_bid = bids[0][0] if bids else None
            best_ask = asks[0][0] if asks else None
            
            # Use mid-price as the main price for charting
            price = (best_bid + best_ask) / 2 if (best_bid and best_ask) else None
            
            return {
                'source': 'bitkub',
                'symbol': 'THB_USDT',
                'price': price,
                'bid': best_bid,
                'ask': best_ask,
                'order_book': {
                    'bids': bids,
                    'asks': asks
                },
                'raw_data': data
            }
    except Exception as e:
        print(f"Error fetching Bitkub: {e}")
    return None

def fetch_binance_th():
    try:
        response = requests.get(ENDPOINTS['binance_th'], timeout=5)
        data = response.json()
        if 'bids' in data and 'asks' in data:
            # BinanceTH format: [[price, volume], ...]
            # We already requested limit=5 in the URL
            bids = [[float(p), float(v)] for p, v in data['bids'][:5]]
            asks = [[float(p), float(v)] for p, v in data['asks'][:5]]
            
            best_bid = bids[0][0] if bids else None
            best_ask = asks[0][0] if asks else None
            
            # Use mid-price
            price = (best_bid + best_ask) / 2 if (best_bid and best_ask) else None
            
            return {
                'source': 'binance_th',
                'symbol': 'USDTTHB',
                'price': price,
                'bid': best_bid,
                'ask': best_ask,
                'order_book': {
                    'bids': bids,
                    'asks': asks
                },
                'raw_data': data
            }
    except Exception as e:
        print(f"Error fetching BinanceTH: {e}")
    return None

def fetch_maxbit():
    try:
        response = requests.post(
            MAXBIT_CONFIG['url'],
            headers=MAXBIT_CONFIG['headers'],
            json=MAXBIT_CONFIG['body'],
            timeout=5
        )
        data = response.json()
        if data.get('responseCode') == '000' and 'result' in data:
            res = data['result']
            bid = float(res['bid'])
            ask = float(res['ask'])
            price = (bid + ask) / 2
            
            return {
                'source': 'maxbit',
                'symbol': 'USDT',
                'price': price,
                'bid': bid,
                'ask': ask,
                'order_book': None,
                'raw_data': data
            }
    except Exception as e:
        print(f"Error fetching MaxBit: {e}")
    return None

def fetch_fx():
    try:
        response = requests.get(ENDPOINTS['fx'], timeout=5)
        data = response.json()
        if 'rates' in data and 'THB' in data['rates']:
            rate = data['rates']['THB']
            return {
                'source': 'fx',
                'symbol': 'USD_THB',
                'price': rate,
                'bid': None,
                'ask': None,
                'order_book': None,
                'raw_data': data
            }
    except Exception as e:
        print(f"Error fetching FX: {e}")
    return None

def main():
    print("Starting Market Data Bridge...")
    while True:
        start_time = time.time()
        
        # Parallel fetch could be better, but sequential is safer for now
        updates = []
        
        # 1. Bitkub
        bk = fetch_bitkub()
        if bk: updates.append(bk)
        
        # 2. Binance TH
        bn = fetch_binance_th()
        if bn: updates.append(bn)
        
        # 3. MaxBit
        mb = fetch_maxbit()
        if mb: updates.append(mb)
        
        # 4. FX (Maybe not every second? But requirement said collect data every second)
        fx = fetch_fx()
        if fx: updates.append(fx)
        
        if updates:
            try:
                # Batch insert
                # Debug print to see what we are inserting
                for u in updates:
                    print(f"DEBUG: Source={u['source']}, Price={u['price']}")
                
                supabase.table('market_data').insert(updates).execute()
                print(f"[{datetime.now().strftime('%H:%M:%S')}] Inserted {len(updates)} records")
            except Exception as e:
                print(f"Error inserting to Supabase: {e}")
        
        # Sleep to maintain interval
        elapsed = time.time() - start_time
        sleep_time = max(0, INTERVAL_SECONDS - elapsed)
        time.sleep(sleep_time)

if __name__ == "__main__":
    main()
