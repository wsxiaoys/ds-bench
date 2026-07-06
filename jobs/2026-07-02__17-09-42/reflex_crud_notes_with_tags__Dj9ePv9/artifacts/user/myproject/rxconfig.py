"""Reflex application configuration."""

import os

import reflex as rx

# Resolve the project root (the directory that contains this rxconfig.py).
_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
_DB_PATH = os.path.join(_THIS_DIR, "reflex.db")

config = rx.Config(
    app_name="myproject",
    db_url=f"sqlite:///{_DB_PATH}",
    plugins=[
        rx.plugins.SitemapPlugin(),
        rx.plugins.TailwindV4Plugin(),
    ],
)
