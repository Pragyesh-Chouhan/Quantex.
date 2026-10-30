"""Automated tests for QuantEX upgrades:
- Delta Exchange India market data & products
- Multi-exchange API hub & Server Egress IP detection
- Risk Command Center (limits, kill switch, order cancellation)
- Strategy Scorecard & Battle Arena benchmarks
- Explainable AI Copilot grounded analytics
- System Health Diagnostics
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.config import settings

client = TestClient(app)


def test_quantex_app_info():
    """Validates that application name is rebranded to QuantEX."""
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["app_name"] == "QuantEX"
    assert "version" in data


def test_market_exchanges_list():
    """Validates supported exchanges list including Delta Exchange India and Binance."""
    res = client.get("/api/v1/market/exchanges")
    assert res.status_code == 200
    exchanges = res.json()
    assert len(exchanges) >= 2
    ids = [e["id"] for e in exchanges]
    assert "delta_india" in ids
    assert "binance_spot" in ids


def test_market_products():
    """Validates retrieval of crypto products from Delta Exchange India."""
    res = client.get("/api/v1/market/products")
    assert res.status_code == 200
    products = res.json()
    assert isinstance(products, list)
    assert len(products) > 0
    symbols = [p["symbol"] for p in products]
    assert "BTCUSD" in symbols


def test_market_ticker():
    """Validates real-time ticker endpoint."""
    res = client.get("/api/v1/market/ticker?symbol=BTCUSD")
    assert res.status_code == 200
    data = res.json()
    assert data["symbol"] == "BTCUSD"
    assert "price" in data
    assert "mark_price" in data
    assert "high" in data
    assert "low" in data


def test_market_candles():
    """Validates real-time OHLCV candles retrieval."""
    res = client.get("/api/v1/market/candles?symbol=BTCUSD&timeframe=5m&limit=25")
    assert res.status_code == 200
    data = res.json()
    assert data["symbol"] == "BTCUSD"
    assert data["timeframe"] == "5m"
    assert "candles" in data


def test_server_egress_ip():
    """Validates server outbound IP detection endpoint for exchange whitelisting."""
    res = client.get("/api/v1/accounts/egress-ip")
    assert res.status_code == 200
    data = res.json()
    assert "egress_ip" in data
    assert "instructions" in data
    assert len(data["instructions"]) >= 3


def test_risk_status_and_limits():
    """Validates risk parameters query and dynamic limits update."""
    res = client.get("/api/v1/risk/status")
    assert res.status_code == 200
    status_data = res.json()
    assert "limits" in status_data
    assert "live_metrics" in status_data

    # Update limit
    update_res = client.post("/api/v1/risk/limits", json={"daily_loss_limit": 750.0, "max_position_exposure": 0.25})
    assert update_res.status_code == 200
    updated_data = update_res.json()
    assert updated_data["limits"]["daily_loss_limit"] == 750.0
    assert updated_data["limits"]["max_position_exposure"] == 0.25

    # Restore default limits so subsequent tests have pristine state
    client.post("/api/v1/risk/limits", json={"daily_loss_limit": 500.0, "max_position_exposure": 0.20})


def test_risk_kill_switch_cycle():
    """Validates emergency kill switch activation and safe reset."""
    # 1. Trigger Kill Switch
    ks_res = client.post("/api/v1/risk/kill-switch", json={"reason": "Test Kill Switch Activation", "cancel_orders": True})
    assert ks_res.status_code == 200
    ks_data = ks_res.json()
    assert ks_data["emergency_stop"] is True

    # Check status reflects halt
    status_res = client.get("/api/v1/risk/status")
    assert status_res.json()["emergency_stop"] is True

    # 2. Reset Kill Switch
    reset_res = client.post("/api/v1/risk/reset")
    assert reset_res.status_code == 200
    assert reset_res.json()["emergency_stop"] is False


def test_strategy_scorecard():
    """Validates Strategy Battle Arena & Scorecard across all models."""
    res = client.get("/api/v1/strategies/arena/scorecard")
    assert res.status_code == 200
    data = res.json()
    assert data["count"] >= 18
    assert "scorecard" in data
    first_strat = data["scorecard"][0]
    assert "strategy_id" in first_strat
    assert "win_rate_pct" in first_strat
    assert "profit_factor" in first_strat
    assert "sharpe_ratio" in first_strat


def test_copilot_analysis():
    """Validates Explainable AI Copilot grounded quantitative reasoning."""
    req = {
        "query": "Why did the EMA strategy generate a signal on BTCUSD?",
        "strategy_id": "ema_crossover",
        "symbol": "BTCUSD",
        "timeframe": "5m"
    }
    res = client.post("/api/v1/copilot/analyze", json=req)
    assert res.status_code == 200
    data = res.json()
    assert "factual_metrics" in data
    assert "ai_interpretation" in data
    assert "indicator_breakdown" in data
    assert "disclaimer" in data


def test_system_health_audit():
    """Validates comprehensive system health monitoring with real latencies."""
    res = client.get("/api/v1/system/health")
    assert res.status_code == 200
    data = res.json()
    assert data["app_name"] == "QuantEX"
    assert "services" in data
    assert len(data["services"]) >= 4
