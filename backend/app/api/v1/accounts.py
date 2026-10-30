"""Delta Exchange Account Connection & Multi-User Management Router."""

from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.account import AccountConnection
from app.models.event import SystemEvent
from app.schemas.account import (
    AccountConnectRequest,
    AccountValidateRequest,
    AccountResponse,
    AccountStatusResponse,
)
from app.core.security import encrypt_secret, mask_key
from app.core.logger import logger
from app.exchange.client import DeltaExchangeClient
from app.exchange.manager import activate_account, get_active_account, get_client_for_account

router = APIRouter(prefix="/api/v1/accounts", tags=["Account Connections"])


@router.post("/validate")
async def validate_connection_credentials(req: AccountValidateRequest):
    """Tests connection and private authentication against Delta Exchange Testnet without persisting keys."""
    client = DeltaExchangeClient(
        api_key=req.api_key.strip(),
        api_secret=req.api_secret.strip(),
        base_url=req.base_url.strip(),
        use_live=True,
    )
    is_valid, msg, details = await client.validate_credentials()
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": msg, "error": "Authentication failed against Delta Exchange Testnet"}
        )

    return {
        "success": True,
        "message": msg,
        "environment": "testnet",
        "details": details,
    }


@router.post("/connect", response_model=AccountResponse, status_code=status.HTTP_201_CREATED)
async def connect_account(
    req: AccountConnectRequest,
    db: Session = Depends(get_db),
):
    """Securely connects a user's Delta Exchange Testnet account.

    Validates credentials with official exchange, encrypts secrets at rest,
    masks the API key, and persists the connection with strict account isolation.
    """
    env = req.environment.lower().strip()
    if env != "testnet":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only Testnet environment ('testnet') is supported for this hackathon edition. Mainnet trading is strictly prohibited."
        )

    base_url = req.base_url.strip() if req.base_url else (
        settings.DELTA_INDIA_BASE_URL if env in ["production", "mainnet"] else settings.DELTA_TESTNET_BASE_URL
    )

    api_key_clean = req.api_key.strip()
    api_secret_clean = req.api_secret.strip()

    # 1. Validate credentials with Delta Exchange
    validator_client = DeltaExchangeClient(
        api_key=api_key_clean,
        api_secret=api_secret_clean,
        base_url=req.base_url.strip(),
        use_live=True,
    )
    is_valid, validation_msg, _ = await validator_client.validate_credentials()

    # 2. Check if user already has accounts to determine if this one should be active
    existing_count = db.query(AccountConnection).filter(AccountConnection.user_id == req.user_id).count()
    make_active = (existing_count == 0)

    # 3. Encrypt secrets and create record
    now = datetime.now(timezone.utc)
    account = AccountConnection(
        user_id=req.user_id,
        label=req.label.strip(),
        environment="testnet",
        base_url=req.base_url.strip(),
        api_key_masked=mask_key(api_key_clean),
        api_key_encrypted=encrypt_secret(api_key_clean),
        api_secret_encrypted=encrypt_secret(api_secret_clean),
        ip_whitelist_note=req.ip_whitelist_note or "Whitelisted on Delta Exchange portal",
        is_active=make_active,
        is_validated=is_valid,
        last_validated_at=now if is_valid else None,
        created_at=now,
    )
    db.add(account)

    event = SystemEvent(
        category="CONNECTIVITY",
        severity="INFO" if is_valid else "WARNING",
        message=f"Delta Exchange account connected: {account.label} (Masked: {account.api_key_masked}, Validated: {is_valid})",
    )
    db.add(event)
    db.commit()
    db.refresh(account)

    logger.info(f"Connected Delta Exchange account {account.account_id} for user {req.user_id}")
    return account


@router.get("", response_model=List[AccountResponse])
def list_connected_accounts(
    user_id: str = Query(default="default_user"),
    db: Session = Depends(get_db),
):
    """Lists all connected accounts for the user (with masked keys and without exposing secrets)."""
    accounts = db.query(AccountConnection).filter(AccountConnection.user_id == user_id).order_by(AccountConnection.id.desc()).all()
    return accounts


@router.post("/{account_id}/activate", response_model=AccountResponse)
def select_active_account(
    account_id: str,
    user_id: str = Query(default="default_user"),
    db: Session = Depends(get_db),
):
    """Sets the designated account as active for trading and reconciliation."""
    account = activate_account(db, account_id=account_id, user_id=user_id)
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account connection not found")
    return account


@router.delete("/{account_id}", status_code=status.HTTP_200_OK)
def disconnect_account(
    account_id: str,
    user_id: str = Query(default="default_user"),
    db: Session = Depends(get_db),
):
    """Disconnects and permanently removes the stored credentials."""
    account = db.query(AccountConnection).filter(
        AccountConnection.account_id == account_id,
        AccountConnection.user_id == user_id
    ).first()

    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account connection not found")

    label = account.label
    masked = account.api_key_masked
    db.delete(account)

    event = SystemEvent(
        category="CONNECTIVITY",
        severity="INFO",
        message=f"Disconnected and removed account: {label} ({masked})",
    )
    db.add(event)
    db.commit()

    logger.info(f"Disconnected account {account_id} for user {user_id}")
    return {"success": True, "message": f"Account '{label}' disconnected successfully."}


@router.get("/status", response_model=AccountStatusResponse)
async def get_active_account_status(
    user_id: str = Query(default="default_user"),
    db: Session = Depends(get_db),
):
    """Reports detailed connectivity and authentication health for the active account."""
    client, active_account = get_client_for_account(db, user_id)
    public_ok = await client.ping_public_connectivity()

    if not active_account:
        return AccountStatusResponse(
            connected=public_ok,
            account_id=None,
            label="Default Environment / Sandbox",
            environment="testnet",
            is_active=False,
            is_validated=False,
            api_key_masked=None,
            public_api_healthy=public_ok,
            private_auth_healthy=False,
            has_active_account=False,
            message="No user-specific account connected. Operating in default testnet/simulation mode.",
        )

    # Validate active private auth
    is_valid, auth_msg, _ = await client.validate_credentials()
    if is_valid and not active_account.is_validated:
        active_account.is_validated = True
        active_account.last_validated_at = datetime.now(timezone.utc)
        db.commit()

    return AccountStatusResponse(
        connected=(public_ok and is_valid),
        account_id=active_account.account_id,
        label=active_account.label,
        environment=active_account.environment,
        is_active=active_account.is_active,
        is_validated=is_valid,
        api_key_masked=active_account.api_key_masked,
        public_api_healthy=public_ok,
        private_auth_healthy=is_valid,
        has_active_account=True,
        message=auth_msg if not is_valid else f"Connected and authenticated on Delta Exchange ({active_account.environment})",
    )


@router.get("/egress-ip")
async def get_server_egress_ip():
    """Detects backend server outbound public egress IP and returns IP whitelisting guidance."""
    import httpx
    detected_ip = "127.0.0.1"
    is_public = False
    provider_source = "localhost"

    for service_url in ["https://api.ipify.org?format=json", "https://ifconfig.me/all.json"]:
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                res = await client.get(service_url)
                if res.status_code == 200:
                    data = res.json()
                    ip = data.get("ip") or data.get("ip_addr")
                    if ip and not ip.startswith(("127.", "192.168.", "10.")):
                        detected_ip = ip
                        is_public = True
                        provider_source = service_url
                        break
        except Exception:
            continue

    return {
        "egress_ip": detected_ip,
        "is_public_ip": is_public,
        "detection_source": provider_source,
        "is_whitelisted_hint": "Configure this IP address in your Delta Exchange Developer API settings under 'IP Whitelist' restriction.",
        "deployment_mode": "Production/VPS Static IP" if is_public else "Localhost Development",
        "instructions": [
            "1. Log in to Delta Exchange India (https://india.delta.exchange) or Delta Testnet.",
            "2. Navigate to Profile > API Keys > Create New API Key.",
            "3. Select permissions: 'Read & Trade' (DO NOT enable 'Withdrawal').",
            f"4. Enter the Outbound Egress IP '{detected_ip}' in the Allowed IPs field.",
            "5. Save the generated API Key and Secret in QuantEX Exchange API Hub.",
        ],
    }


@router.get("/{account_id}/balance")
async def get_account_balance(
    account_id: str,
    user_id: str = Query(default="default_user"),
    db: Session = Depends(get_db),
):
    """Retrieves live wallet balances for the specific authenticated account."""
    account = db.query(AccountConnection).filter(
        AccountConnection.account_id == account_id,
        AccountConnection.user_id == user_id,
    ).first()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found or not owned by user")

    try:
        client = DeltaExchangeClient.from_account_connection(account)
        balances = await client.get_wallet_balances()
        total = sum(b.balance for b in balances)
        available = sum(b.available_balance for b in balances)
        return {
            "account_id": account.account_id,
            "label": account.label,
            "environment": account.environment,
            "total_balance_usd": round(total, 2),
            "available_balance_usd": round(available, 2),
            "balances": [b.model_dump() for b in balances],
            "synced_at": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        logger.error(f"Failed to fetch balance for account {account_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Exchange balance query failed: {str(e)}"
        )


@router.get("/{account_id}/positions")
async def get_account_positions(
    account_id: str,
    user_id: str = Query(default="default_user"),
    db: Session = Depends(get_db),
):
    """Retrieves open positions for the specific authenticated account."""
    account = db.query(AccountConnection).filter(
        AccountConnection.account_id == account_id,
        AccountConnection.user_id == user_id,
    ).first()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found or not owned by user")

    try:
        client = DeltaExchangeClient.from_account_connection(account)
        positions = await client.get_positions()
        return [p.model_dump() for p in positions]
    except Exception as e:
        logger.error(f"Failed to fetch positions for account {account_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Exchange positions query failed: {str(e)}"
        )


@router.get("/{account_id}/orders")
async def get_account_orders(
    account_id: str,
    user_id: str = Query(default="default_user"),
    db: Session = Depends(get_db),
):
    """Retrieves active open orders for the specific authenticated account."""
    account = db.query(AccountConnection).filter(
        AccountConnection.account_id == account_id,
        AccountConnection.user_id == user_id,
    ).first()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found or not owned by user")

    try:
        client = DeltaExchangeClient.from_account_connection(account)
        orders = await client.get_open_orders()
        return orders
    except Exception as e:
        logger.error(f"Failed to fetch open orders for account {account_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Exchange orders query failed: {str(e)}"
        )


@router.get("/{account_id}/trades")
async def get_account_trades(
    account_id: str,
    limit: int = Query(default=50, ge=1, le=100),
    user_id: str = Query(default="default_user"),
    db: Session = Depends(get_db),
):
    """Retrieves trade execution history (fills) for the specific authenticated account."""
    account = db.query(AccountConnection).filter(
        AccountConnection.account_id == account_id,
        AccountConnection.user_id == user_id,
    ).first()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found or not owned by user")

    try:
        client = DeltaExchangeClient.from_account_connection(account)
        fills = await client.get_fills(limit=limit)
        return fills
    except Exception as e:
        logger.error(f"Failed to fetch trade fills for account {account_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Exchange trade history query failed: {str(e)}"
        )
