"""Sanitized logging module for TokenIQ.

Ensures that API keys, secrets, authorization headers, and sensitive signature
payloads are never leaked into console output, log files, or exception dumps.
"""

import logging
import re
import sys
from typing import Any, Dict


class SensitiveDataFilter(logging.Filter):
    """Filters or masks sensitive patterns in log messages and records."""

    PATTERNS = [
        (re.compile(r"(?i)(api[_-]?key[\"']?\s*[:=]\s*[\"']?)([a-zA-Z0-9_\-\.]{8,})([\"']?)"), r"\1***REDACTED***\3"),
        (re.compile(r"(?i)(api[_-]?secret[\"']?\s*[:=]\s*[\"']?)([a-zA-Z0-9_\-\.]{8,})([\"']?)"), r"\1***REDACTED***\3"),
        (re.compile(r"(?i)(api-key[\"']?\s*[:=]\s*[\"']?)([a-zA-Z0-9_\-\.]{8,})([\"']?)"), r"\1***REDACTED***\3"),
        (re.compile(r"(?i)(signature[\"']?\s*[:=]\s*[\"']?)([a-zA-Z0-9_\-\.]{12,})([\"']?)"), r"\1***REDACTED***\3"),
        (re.compile(r"(?i)(authorization[\"']?\s*[:=]\s*[\"']?Bearer\s+)([a-zA-Z0-9_\-\.]{10,})([\"']?)"), r"\1***REDACTED***\3"),
    ]

    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, str):
            for pattern, repl in self.PATTERNS:
                record.msg = pattern.sub(repl, record.msg)
        if record.args:
            if isinstance(record.args, dict):
                sanitized_dict = {}
                for k, v in record.args.items():
                    val_str = str(v)
                    for pattern, repl in self.PATTERNS:
                        val_str = pattern.sub(repl, val_str)
                    sanitized_dict[k] = val_str
                record.args = sanitized_dict
            elif isinstance(record.args, (list, tuple)):
                sanitized_list = []
                for v in record.args:
                    val_str = str(v)
                    for pattern, repl in self.PATTERNS:
                        val_str = pattern.sub(repl, val_str)
                    sanitized_list.append(val_str)
                record.args = tuple(sanitized_list)
        return True


def setup_logger(name: str = "QuantEX", level: str = "INFO") -> logging.Logger:
    """Configures and returns a sanitized, structured logger."""
    logger = logging.getLogger(name)
    logger.setLevel(getattr(logging, level.upper(), logging.INFO))

    # Avoid duplicate handlers on re-initialization
    if not logger.handlers:
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(getattr(logging, level.upper(), logging.INFO))
        console_handler.addFilter(SensitiveDataFilter())

        formatter = logging.Formatter(
            fmt="[%(asctime)s] [%(levelname)s] [%(name)s] [%(filename)s:%(lineno)d] %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        console_handler.setFormatter(formatter)
        logger.addHandler(console_handler)

    return logger


logger = setup_logger()
