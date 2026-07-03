"""Multi-client collaborative drawing board (Reflex)."""

import asyncio
from typing import List

import reflex as rx
from fastapi import FastAPI
from pydantic import BaseModel

from myproject.models import Stroke

from rxconfig import config


class StrokePayload(BaseModel):
    """JSON payload accepted by the ``POST /api/strokes`` endpoint."""

    x1: float
    y1: float
    x2: float
    y2: float
    color: str
    session_id: str


class State(rx.State):
    """The app state.

    Exposes a reactive ``strokes`` list that mirrors every row currently
    persisted in the ``stroke`` table. A background event refreshes the list
    roughly every 250 ms so connected clients stay in sync with the database.
    """

    strokes: List[Stroke] = []

    @rx.event(background=True)
    async def refresh_strokes(self):
        """Poll the database for the latest strokes and push them to clients.

        Running this as a background event keeps the polling loop on the
        server while still letting the state mutate the reactive ``strokes``
        list every iteration. Using ``async with self:`` enters the app's
        state lock so we can mutate ``self.strokes`` without triggering
        ``ImmutableStateError``.
        """

        while True:
            await asyncio.sleep(0.25)
            async with self:
                with rx.session() as session:
                    self.strokes = session.query(Stroke).all()


def index() -> rx.Component:
    """Render every persisted stroke as a ``<line>`` inside an ``<svg>``."""

    return rx.el.svg(
        rx.foreach(
            State.strokes,
            lambda stroke: rx.el.line(
                x1=stroke.x1.to_string(),
                y1=stroke.y1.to_string(),
                x2=stroke.x2.to_string(),
                y2=stroke.y2.to_string(),
                stroke=stroke.color,
                stroke_width="2",
            ),
        ),
        width="100%",
        height="600",
        viewBox="0 0 800 600",
        xmlns="http://www.w3.org/2000/svg",
        on_load=State.refresh_strokes,
    )


# ---------------------------------------------------------------------------
# FastAPI REST surface (mounted via ``api_transformer``).
# ---------------------------------------------------------------------------

fastapi_app = FastAPI()


@fastapi_app.post("/api/strokes", status_code=201)
def create_stroke(payload: StrokePayload) -> dict:
    """Persist a new stroke segment and return it as JSON."""

    with rx.session() as session:
        stroke = Stroke(
            x1=payload.x1,
            y1=payload.y1,
            x2=payload.x2,
            y2=payload.y2,
            color=payload.color,
            session_id=payload.session_id,
        )
        session.add(stroke)
        session.commit()
        session.refresh(stroke)
        result = {
            "id": stroke.id,
            "x1": stroke.x1,
            "y1": stroke.y1,
            "x2": stroke.x2,
            "y2": stroke.y2,
            "color": stroke.color,
            "session_id": stroke.session_id,
        }
    return result


@fastapi_app.get("/api/strokes")
def list_strokes() -> list[dict]:
    """Return every stroke row in insertion order."""

    with rx.session() as session:
        strokes = session.query(Stroke).all()
        return [
            {
                "id": s.id,
                "x1": s.x1,
                "y1": s.y1,
                "x2": s.x2,
                "y2": s.y2,
                "color": s.color,
                "session_id": s.session_id,
            }
            for s in strokes
        ]


app = rx.App(api_transformer=fastapi_app)
app.add_page(index, route="/")
