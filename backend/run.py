"""Convenience runner script to start the QuantEX Trading System server."""

import argparse
import sys
from pathlib import Path
import uvicorn

# Ensure backend directory is in path
CURRENT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(CURRENT_DIR))


def main():
    parser = argparse.ArgumentParser(description="Start QuantEX Algorithmic Trading Server")
    parser.add_argument("--host", default="0.0.0.0", help="Binding host address (default: 0.0.0.0)")
    parser.add_argument("--port", type=int, default=8000, help="Binding port (default: 8000)")
    parser.add_argument("--reload", action="store_true", help="Enable automatic file reload for development")
    args = parser.parse_args()

    print("=" * 70)
    print("  QuantEX -- Algorithmic Trading & Quantitative Research Platform")
    print(f"  Server URL:    http://localhost:{args.port}")
    print(f"  Dashboard UI:  http://localhost:{args.port}/")
    print(f"  Swagger Docs:  http://localhost:{args.port}/docs")
    print(f"  Health Check:  http://localhost:{args.port}/health")
    print("=" * 70)

    uvicorn.run(
        "app.main:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
        log_level="info",
    )


if __name__ == "__main__":
    main()
