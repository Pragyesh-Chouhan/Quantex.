"""
Comprehensive Test Suite for QuantEX Focused Backend Fix & Strategy Upgrade
Tests:
1. Delta Exchange API: candle resolution mapping, normalization, credential diagnostics.
2. Private User Account APIs: balance, positions, orders, executions routing.
3. Zero-fabrication portfolio aggregation.
4. Order execution: validation, duplicate debouncing, stop-loss/take-profit, position close.
5. All 7 prioritized quantitative models indicator computation & signal evaluation.
6. Strategy detailed chart data endpoint with indicator calculation & signal generation.
7. Add strategy persistence to user database.
8. Verified Mirror Leaders & follow subscription endpoint.
"""
import pytest
import pandas as pd
from unittest.mock import MagicMock, patch, AsyncMock
from fastapi.testclient import TestClient

from app.main import app
from app.database import SessionLocal, init_db, get_db
from app.exchange.client import DeltaExchangeClient
from app.exchange.models import Candle, WalletBalance, ExchangePosition
from app.strategies.registry import strategy_registry
from app.strategies.loader import load_all_strategies
from app.models.account import AccountConnection
from app.models.position import Position
from app.models.strategy_run import StrategyRun


@pytest.fixture(name="db_session")
def fixture_db_session():
    init_db()
    db = SessionLocal()
    try:
        yield db
    finally:
        # Clean up records created during testing
        try:
            db.query(AccountConnection).filter(AccountConnection.user_id == "user_unit_test").delete()
            db.query(Position).filter(Position.instrument == "BTCUSD").delete()
            db.query(StrategyRun).filter(StrategyRun.user_id.in_(["persistence_tester", "mirror_test_user"])).delete()
            db.commit()
        except Exception:
            pass
        db.close()


@pytest.fixture(name="client")
def fixture_client():
    with TestClient(app) as test_client:
        yield test_client


# ==============================================================================
# 1. DELTA EXCHANGE API CANDLE RESOLUTION & NORMALIZATION
# ==============================================================================
@pytest.mark.asyncio
async def test_delta_candle_resolution_mapping():
    """Verify that resolution codes conform to Delta's official specification."""
    client = DeltaExchangeClient(base_url="https://api.india.delta.exchange")
    
    mock_payload = {
        "success": True,
        "result": {
            "t": [1700000000, 1700000300],
            "o": [65000.0, 65100.0],
            "h": [65200.0, 65300.0],
            "l": [64900.0, 65050.0],
            "c": [65100.0, 65250.0],
            "v": [12.5, 14.8],
        }
    }

    with patch.object(client, "_send_request", new_callable=AsyncMock) as mock_send:
        mock_send.return_value = mock_payload
        candles = await client.get_candles(symbol="BTCUSD", resolution="5m", limit=2)
        assert len(candles) == 2
        assert candles[0].open == 65000.0
        assert candles[0].close == 65100.0
        assert candles[0].volume == 12.5
        assert candles[1].high == 65300.0

        # Verify resolution parameter
        call_kwargs = mock_send.call_args[1]
        assert call_kwargs["params"]["resolution"] == "5"


@pytest.mark.asyncio
async def test_delta_credential_validation_diagnostics():
    """Verify clear environment diagnostics and error reporting on auth failure."""
    from app.core.exceptions import AuthenticationError
    client = DeltaExchangeClient(
        api_key="bad_key",
        api_secret="bad_secret",
        base_url="https://api.india.delta.exchange"
    )

    with patch.object(client, "_send_request", side_effect=AuthenticationError("Invalid credentials")):
        is_valid, msg, details = await client.validate_credentials()
        assert is_valid is False
        assert "Authentication failed on Delta" in msg


# ==============================================================================
# 2. PRIVATE ACCOUNT SUB-ENDPOINTS
# ==============================================================================
def test_account_sub_endpoints(client, db_session):
    """Test /balance, /positions, /orders, /trades on user account connection."""
    from app.core.security import encrypt_secret
    acc = AccountConnection(
        account_id="acc_unit_test",
        user_id="user_unit_test",
        label="Test Unit Account",
        environment="testnet",
        base_url="https://api.india.delta.exchange",
        api_key_masked="bad_key_masked",
        api_key_encrypted=encrypt_secret("test_key"),
        api_secret_encrypted=encrypt_secret("test_secret"),
        is_active=True,
    )
    db_session.add(acc)
    db_session.commit()

    mock_cli = MagicMock()
    mock_cli.get_wallet_balances = AsyncMock(return_value=[
        WalletBalance(asset="USDT", balance=5000.0, available_balance=4500.0)
    ])
    mock_cli.get_positions = AsyncMock(return_value=[
        ExchangePosition(product_symbol="BTCUSD", size=0.5, entry_price=64000.0, mark_price=65000.0, unrealized_pnl=500.0, realized_pnl=100.0)
    ])
    mock_cli.get_open_orders = AsyncMock(return_value=[
        {"order_id": "ord_1", "product_symbol": "BTCUSD", "side": "buy", "size": 0.1, "price": 64500.0, "order_type": "limit", "state": "open"}
    ])
    mock_cli.get_fills = AsyncMock(return_value=[
        {"fill_id": "f_1", "symbol": "BTCUSD", "price": 65000}
    ])

    with patch("app.api.v1.accounts.DeltaExchangeClient.from_account_connection", return_value=mock_cli), \
         patch("app.api.v1.accounts.get_client_for_account", return_value=(mock_cli, acc)):

        # Balance
        res = client.get("/api/v1/accounts/acc_unit_test/balance?user_id=user_unit_test")
        assert res.status_code == 200
        assert res.json()["balances"][0]["asset"] == "USDT"

        # Positions
        res = client.get("/api/v1/accounts/acc_unit_test/positions?user_id=user_unit_test")
        assert res.status_code == 200
        assert isinstance(res.json(), list)

        # Orders
        res = client.get("/api/v1/accounts/acc_unit_test/orders?user_id=user_unit_test")
        assert res.status_code == 200
        assert isinstance(res.json(), list)

        # Trades
        res = client.get("/api/v1/accounts/acc_unit_test/trades?user_id=user_unit_test")
        assert res.status_code == 200
        assert isinstance(res.json(), list)


# ==============================================================================
# 3. ZERO-FABRICATION PORTFOLIO AGGREGATION
# ==============================================================================
def test_zero_fabrication_portfolio_when_no_account_linked(client):
    """Verify that a user without connected accounts gets zero balances and has_active_account=False."""
    res = client.get("/api/v1/portfolio/summary?user_id=unlinked_user_99")
    assert res.status_code == 200
    data = res.json()
    assert data["has_active_account"] is False
    assert data["net_asset_value"] == 0.0
    assert data["total_balance_usd"] == 0.0
    assert data["realized_pnl"] == 0.0


# ==============================================================================
# 4. ORDER SUBMISSION, DEBOUNCING, AND POSITION CLOSING
# ==============================================================================
def test_order_creation_and_duplicate_debounce(client):
    """Verify order validation and 2-second debounce protection against rapid clicks."""
    payload = {
        "instrument": "BTCUSD",
        "side": "buy",
        "order_type": "limit",
        "quantity": 0.1,
        "price": 65000.0,
        "stop_loss": 64000.0,
        "take_profit": 67000.0,
        "user_id": "debounce_tester",
    }

    # First submission succeeds (paper simulation when no live exchange connected)
    res1 = client.post("/api/v1/orders", json=payload)
    assert res1.status_code in [200, 201]
    data1 = res1.json()
    assert data1["status"] in ["FILLED", "PENDING", "ACCEPTED"]

    # Immediate second identical submission within 2 seconds should be debounced (429)
    res2 = client.post("/api/v1/orders", json=payload)
    assert res2.status_code == 429
    assert "Duplicate order detected" in res2.json()["detail"]


def test_close_position_endpoint(client, db_session):
    """Verify POST /api/v1/positions/close endpoint executes cleanly when position exists."""
    pos = db_session.query(Position).filter(Position.instrument == "BTCUSD").first()
    if not pos:
        pos = Position(
            instrument="BTCUSD",
            size=0.5,
            entry_price=64000.0,
            mark_price=65000.0,
            unrealized_pnl=500.0,
            realized_pnl=0.0,
        )
        db_session.add(pos)
    else:
        pos.size = 0.5
        pos.entry_price = 64000.0
        pos.mark_price = 65000.0
    db_session.commit()

    res = client.post(
        "/api/v1/positions/close",
        json={"instrument": "BTCUSD", "user_id": "default_user"}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "closed" in data["message"].lower() or "flattened" in data["message"].lower()


# ==============================================================================
# 5. ALL 7 PRIORITIZED QUANTITATIVE MODELS
# ==============================================================================
@pytest.mark.parametrize("strategy_id", [
    "sma_200_trend",
    "supertrend_strategy",
    "sma_200_supertrend",
    "ema_trend_following",
    "rsi_trend_confirmation",
    "atr_trend_following",
    "long_term_momentum",
])
def test_prioritized_quant_strategies_registered_and_executable(strategy_id):
    """Verify all 7 prioritized quantitative models compute indicators and evaluate signals."""
    load_all_strategies()
    strategy = strategy_registry.get_instance(strategy_id)
    assert strategy is not None, f"Strategy {strategy_id} must be registered in loader"

    # Synthetic 250-bar historical candle series
    synthetic_candles = []
    base_price = 60000.0
    for i in range(250):
        price = base_price + (i * 20)
        synthetic_candles.append({
            "time": 1700000000 + i * 3600,
            "timestamp": 1700000000 + i * 3600,
            "open": price - 10,
            "high": price + 50,
            "low": price - 20,
            "close": price,
            "volume": 100.0 + i,
        })

    df = pd.DataFrame(synthetic_candles)
    df_ind = strategy.compute_indicators(df)
    assert len(df_ind) == 250
    assert "close" in df_ind.columns

    signal = strategy.generate_signal(df_ind, "BTCUSD", "1h")
    # Signal can be None (HOLD) or StrategySignalResult
    if signal is not None:
        assert signal.signal_type in ["BUY", "SELL", "HOLD", "OPEN_LONG", "CLOSE_LONG"]


# ==============================================================================
# 6. STRATEGY DETAILED CHART-DATA ENDPOINT
# ==============================================================================
def test_strategy_chart_data_endpoint(client):
    """Verify GET /api/v1/strategies/{strategy_id}/chart-data computes indicators & historical signals."""
    mock_candles = []
    for i in range(100):
        p = 65000.0 + (i * 15)
        mock_candles.append(
            Candle(
                time=1700000000 + i * 300,
                open=p - 5,
                high=p + 25,
                low=p - 10,
                close=p,
                volume=50.0,
            )
        )

    with patch("app.exchange.client.exchange_client.get_candles", new_callable=AsyncMock) as mock_get_candles:
        mock_get_candles.return_value = mock_candles
        res = client.get("/api/v1/strategies/sma_200_supertrend/chart-data?symbol=BTCUSD&timeframe=5m&limit=100")
        assert res.status_code == 200
        data = res.json()
        assert data["strategy_id"] == "sma_200_supertrend"
        assert len(data["candles"]) > 0
        assert "indicators" in data
        assert "signals" in data
        assert "metrics" in data
        assert "win_rate_pct" in data["metrics"]


# ==============================================================================
# 7. ADD STRATEGY PERSISTENCE
# ==============================================================================
def test_user_strategy_add_and_persistence(client, db_session):
    """Verify adding strategy to personal list, fetching it, and removing it."""
    # 1. Add strategy
    add_payload = {
        "strategy_id": "sma_200_trend",
        "instrument": "BTCUSD",
        "timeframe": "1h",
        "allocation_usd": 1500.0,
        "stop_loss_pct": 0.03,
        "take_profit_pct": 0.06,
        "user_id": "persistence_tester",
    }
    res = client.post("/api/v1/strategies/user/add", json=add_payload)
    assert res.status_code == 200
    run_id = res.json()["run_id"]

    # 2. Retrieve user strategies
    list_res = client.get("/api/v1/strategies/user/my-strategies?user_id=persistence_tester")
    assert list_res.status_code == 200
    user_strategies = list_res.json()
    assert any(s["run_id"] == run_id for s in user_strategies)

    # 3. Remove strategy
    del_res = client.delete(f"/api/v1/strategies/user/{run_id}?user_id=persistence_tester")
    assert del_res.status_code == 200
    assert del_res.json()["success"] is True


# ==============================================================================
# 8. MIRROR LEADERS & FOLLOW SUBSCRIPTION
# ==============================================================================
def test_mirror_leaders_and_follow(client):
    """Verify retrieval of verified quantitative leaders and mirror subscription."""
    # 1. Get leaders
    leaders_res = client.get("/api/v1/strategies/mirror/leaders")
    assert leaders_res.status_code == 200
    leaders = leaders_res.json()
    assert len(leaders) >= 3
    alpha_lead = leaders[0]
    assert alpha_lead["is_platform_template"] is True
    assert "win_rate_pct" in alpha_lead
    assert "profit_factor" in alpha_lead

    # 2. Follow leader
    follow_res = client.post(
        f"/api/v1/strategies/mirror/{alpha_lead['leader_id']}/follow",
        json={
            "leader_id": alpha_lead["leader_id"],
            "user_id": "mirror_test_user",
            "allocation_usd": 2000.0,
            "max_slippage_pct": 0.002,
        }
    )
    assert follow_res.status_code == 200
    assert follow_res.json()["success"] is True
    assert "run_id" in follow_res.json()
