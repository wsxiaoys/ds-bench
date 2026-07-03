"""Database models for the collaborative drawing board."""

import reflex as rx
from reflex.model import ModelRegistry


class Stroke(rx.Model):
    """A single drawn stroke segment."""

    x1: float
    y1: float
    x2: float
    y2: float
    color: str
    session_id: str

    # Required for sqlmodel to treat this class as a database table.
    model_config = {"table": True}


# Make sure the model is registered with Reflex so Alembic REDACTEDgenerate and
# the ``rx.session`` helpers can pick it up.
ModelRegistry.register(Stroke)
