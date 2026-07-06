import asyncio
import random

# Seed deterministically
random.seed(42)

class TickerEngine:
    def __init__(self):
        self.running = False
        self.update_count = 0
        self.seeds = {
            "AAPL": 150.00,
            "GOOG": 2800.00,
            "MSFT": 300.00,
            "AMZN": 3300.00,
            "TSLA": 700.00,
        }
        self.prices = self.seeds.copy()
        self.percent_changes = {symbol: 0.0 for symbol in self.seeds}
        self._task = None
        self.driven_by_reflex = False

    def start(self) -> bool:
        if self.running:
            return False
        self.running = True
        self.update_count = 0  # Reset tick count on start
        self.prices = self.seeds.copy()  # Reset prices to seeds
        self.percent_changes = {symbol: 0.0 for symbol in self.seeds}
        
        if not self.driven_by_reflex:
            self._task = asyncio.create_task(self._loop())
        return True

    def stop(self):
        self.running = False
        if self._task:
            self._task.cancel()
            self._task = None

    async def _loop(self):
        try:
            while self.running:
                await asyncio.sleep(0.5)
                if not self.driven_by_reflex:
                    self.tick_once()
        except asyncio.CancelledError:
            pass

    def tick_once(self):
        for symbol in self.prices:
            current_price = self.prices[symbol]
            change = current_price * random.uniform(-0.005, 0.005)
            self.prices[symbol] = max(0.01, current_price + change)
            seed_price = self.seeds[symbol]
            self.percent_changes[symbol] = round((self.prices[symbol] - seed_price) / seed_price * 100.0, 4)
        self.update_count += 1

    def snapshot(self) -> dict:
        return {
            "running": self.running,
            "update_count": self.update_count,
            "seeds": self.seeds.copy(),
            "prices": self.prices.copy(),
            "percent_changes": self.percent_changes.copy(),
        }

engine = TickerEngine()
