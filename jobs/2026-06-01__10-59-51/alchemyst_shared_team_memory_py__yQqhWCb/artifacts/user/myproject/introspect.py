import inspect
from alchemyst_ai import AlchemystAI

client = AlchemystAI(api_key="fake")
print("MEMORY ADD:", inspect.signature(client.v1.context.memory.add))
print("CONTEXT SEARCH:", inspect.signature(client.v1.context.search))
