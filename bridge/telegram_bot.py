import os
import re
import asyncio
from dotenv import load_dotenv
from supabase import create_client, Client
from datetime import datetime
from telegram import Update
from telegram.ext import ApplicationBuilder, ContextTypes, MessageHandler, filters

# Load environment variables
env_path = os.path.join(os.path.dirname(__file__), '.env')
if not os.path.exists(env_path):
    env_path = os.path.join(os.path.dirname(__file__), '../.env')
load_dotenv(dotenv_path=env_path)

# Supabase Setup
url: str = os.environ.get("PUBLIC_SUPABASE_URL")
key: str = os.environ.get("PUBLIC_SUPABASE_ANON_KEY")
supabase: Client = create_client(url, key)

# Telegram Setup
BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN")
# Optional: restrict to specific group (if not set, listens to all groups)
GROUP_ID = os.environ.get("TELEGRAM_GROUP_ID")
if GROUP_ID:
    GROUP_ID = int(GROUP_ID)

def parse_prices(text):
    """
    Parses USDT and USDC prices from the message format:
    📌USDT
    • อัตราเรทในการขาย USDT>THB (Bid) คือ 31.188
    • อัตราเรทในการซื้อ THB>USDT (Ask) คือ 31.245
    """
    results = []
    
    # Regex patterns
    patterns = {
        'USDT': {
            'bid': r'USDT>THB \(Bid\) คือ ([0-9.]+)',
            'ask': r'THB>USDT \(Ask\) คือ ([0-9.]+)'
        },
        'USDC': {
            'bid': r'USDC>THB \(Bid\) คือ ([0-9.]+)',
            'ask': r'THB>USDC \(Ask\) คือ ([0-9.]+)'
        }
    }
    
    for symbol, p in patterns.items():
        bid_match = re.search(p['bid'], text)
        ask_match = re.search(p['ask'], text)
        
        if bid_match and ask_match:
            bid = float(bid_match.group(1))
            ask = float(ask_match.group(1))
            price = (bid + ask) / 2
            
            results.append({
                'source': 'bitazza',
                'symbol': symbol,
                'price': price,
                'bid': bid,
                'ask': ask,
                'order_book': None,
                'raw_data': {'full_text': text}
            })
            
    return results

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not update.message or not update.message.text:
        return

    chat_id = update.message.chat_id
    chat_title = update.message.chat.title or "Private"
    
    # Filter by GROUP_ID if set
    if GROUP_ID and chat_id != GROUP_ID:
        return
    
    text = update.message.text
    
    # Check if message contains price info
    if "📌USDT" in text or "📌USDC" in text:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Received price update from '{chat_title}' (ID: {chat_id})")
        
        updates = parse_prices(text)
        
        if updates:
            try:
                supabase.table('market_data').insert(updates).execute()
                for u in updates:
                    print(f"  - Saved {u['symbol']}: Bid={u['bid']}, Ask={u['ask']}")
            except Exception as e:
                print(f"Error inserting to Supabase: {e}")

def main():
    if not BOT_TOKEN:
        print("Error: TELEGRAM_BOT_TOKEN not found in .env")
        return

    print("Starting Telegram Price Bot...")
    if GROUP_ID:
        print(f"Listening to Group ID: {GROUP_ID}")
    else:
        print("Listening to ALL groups (set TELEGRAM_GROUP_ID to restrict)")
    
    application = ApplicationBuilder().token(BOT_TOKEN).build()
    
    # Handle all text messages
    message_handler = MessageHandler(filters.TEXT & (~filters.COMMAND), handle_message)
    application.add_handler(message_handler)
    
    # Use run_polling directly (handles event loop internally)
    application.run_polling()

if __name__ == '__main__':
    main()
