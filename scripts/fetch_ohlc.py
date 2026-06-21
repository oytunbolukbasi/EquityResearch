"""
One-off OHLC backfill fetch. Downloads ~120 trading days (~6 months) of daily
OHLC for the trade_plans tickers via yfinance and writes them to
scripts/ohlc-data.json, keyed by the DB ticker (no exchange suffix).

BIST tickers need the ".IS" suffix for the Yahoo Finance query, but the DB
stores them without it — TICKERS maps DB ticker -> Yahoo symbol.

Usage: python3 scripts/fetch_ohlc.py
"""
import json
import sys
from pathlib import Path

import yfinance as yf

TICKERS = {
    "FIG": "FIG",
    "DRAM": "DRAM",
    "MA": "MA",
    "ISRG": "ISRG",
    "ENKAI": "ENKAI.IS",
    "THYAO": "THYAO.IS",
}

OUT_PATH = Path(__file__).parent / "ohlc-data.json"


def fetch(db_ticker: str, yahoo_symbol: str):
    hist = yf.Ticker(yahoo_symbol).history(
        period="6mo",
        interval="1d",
        auto_adjust=False,
        back_adjust=False,
    )
    if hist.empty:
        return None

    hist = hist.tail(120)
    rows = []
    for ts, row in hist.iterrows():
        rows.append({
            "t": ts.strftime("%Y-%m-%d"),
            "o": round(float(row["Open"]), 2),
            "h": round(float(row["High"]), 2),
            "l": round(float(row["Low"]), 2),
            "c": round(float(row["Close"]), 2),
        })
    return rows


def main():
    result = {}
    for db_ticker, yahoo_symbol in TICKERS.items():
        rows = fetch(db_ticker, yahoo_symbol)
        if not rows:
            print(f"{db_ticker:6s} ({yahoo_symbol}): VERİ ALINAMADI", file=sys.stderr)
            continue
        result[db_ticker] = {
            "yahooSymbol": yahoo_symbol,
            "currentPrice": rows[-1]["c"],
            "priceHistory": rows,
        }
        print(f"{db_ticker:6s} ({yahoo_symbol}): {len(rows)} gün çekildi, son kapanış {rows[-1]['c']}")

    OUT_PATH.write_text(json.dumps(result, ensure_ascii=False, indent=2))
    print(f"\nYazıldı: {OUT_PATH}")


if __name__ == "__main__":
    main()
