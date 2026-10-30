"""Strategy registry — single source of truth for all available strategies."""
from typing import Dict, Type, Optional, List, Any
from app.strategies.base import BaseStrategy
import logging

logger = logging.getLogger("QuantEX")


class StrategyRegistry:
    _strategies: Dict[str, Type[BaseStrategy]] = {}
    _instances: Dict[str, BaseStrategy] = {}

    @classmethod
    def register(cls, strategy_cls: Type[BaseStrategy]) -> Type[BaseStrategy]:
        """Decorator: registers a strategy class by its STRATEGY_ID."""
        sid = strategy_cls.STRATEGY_ID
        if not sid:
            raise ValueError(f"Strategy class {strategy_cls.__name__} must define STRATEGY_ID")
        cls._strategies[sid] = strategy_cls
        return strategy_cls

    @classmethod
    def get_instance(cls, strategy_id: str, config: Optional[Dict[str, Any]] = None) -> BaseStrategy:
        """Returns (or creates) a configured strategy instance."""
        if strategy_id not in cls._strategies:
            raise KeyError(f"Strategy '{strategy_id}' is not registered")
        if strategy_id not in cls._instances or config is not None:
            cls._instances[strategy_id] = cls._strategies[strategy_id](config=config)
        return cls._instances[strategy_id]

    @classmethod
    def list_strategies(cls) -> List[Dict[str, Any]]:
        """Returns metadata for all registered strategies."""
        result = []
        for sid, scls in cls._strategies.items():
            try:
                inst = cls.get_instance(sid)
                result.append(inst.get_metadata())
            except Exception as e:
                result.append({"strategy_id": sid, "error": str(e)})
        return result

    @classmethod
    def enable_strategy(cls, strategy_id: str) -> bool:
        inst = cls.get_instance(strategy_id)
        inst.enable()
        return True

    @classmethod
    def disable_strategy(cls, strategy_id: str) -> bool:
        if strategy_id in cls._instances:
            cls._instances[strategy_id].disable()
        return True


strategy_registry = StrategyRegistry()
