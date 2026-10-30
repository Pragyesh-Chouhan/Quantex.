"""Delta Exchange Testnet HMAC-SHA256 Authentication Module.

Implements the official Delta Exchange signing protocol:
signature = HMAC-SHA256(secret, METHOD + TIMESTAMP + PATH_WITH_QUERY + COMPACT_BODY)
"""

import hashlib
import hmac
import json
import time
from typing import Dict, Any, Optional, Union


def format_compact_payload(payload_data: Optional[Union[Dict[str, Any], str]]) -> str:
    """Formats payload as compact JSON with no whitespace between separators."""
    if not payload_data:
        return ""
    if isinstance(payload_data, str):
        try:
            parsed = json.loads(payload_data)
            return json.dumps(parsed, separators=(",", ":"))
        except Exception:
            return payload_data
    return json.dumps(payload_data, separators=(",", ":"))


def generate_delta_signature(
    secret: str,
    method: str,
    path: str,
    timestamp: str,
    query_string: str = "",
    payload: Union[str, Dict[str, Any]] = "",
) -> str:
    """Generates an HMAC-SHA256 hex digest signature for Delta Exchange API requests.

    Message signature concatenation format according to official Delta Exchange documentation:
    METHOD (uppercase) + TIMESTAMP (epoch seconds) + PATH (including query string if present) + BODY (compact)
    """
    if query_string:
        if not query_string.startswith("?"):
            query_string = "?" + query_string
    else:
        query_string = ""

    path_to_sign = f"{path}{query_string}"
    body_str = format_compact_payload(payload)

    message = f"{method.upper()}{timestamp}{path_to_sign}{body_str}"
    signature = hmac.new(
        secret.encode("utf-8"),
        message.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()
    return signature


def build_auth_headers(
    api_key: str,
    api_secret: str,
    method: str,
    path: str,
    query_string: str = "",
    payload: Union[str, Dict[str, Any]] = "",
) -> Dict[str, str]:
    """Builds standard authentication headers for Delta Exchange REST API."""
    timestamp = str(int(time.time()))
    compact_body = format_compact_payload(payload)
    signature = generate_delta_signature(
        secret=api_secret,
        method=method,
        path=path,
        timestamp=timestamp,
        query_string=query_string,
        payload=compact_body,
    )
    return {
        "api-key": api_key,
        "timestamp": timestamp,
        "signature": signature,
        "Content-Type": "application/json",
        "User-Agent": "QuantEX/2.0",
    }
