import asyncio
from typing import List

import reflex as rx
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import select


class Stroke(rx.Model, table=True):
    """A single stroke segment on the drawing board."""

    x1: float
    y1: float
    x2: float
    y2: float
    color: str
    session_id: str


class DrawingState(rx.State):
    """The app state for the collaborative drawing board."""

    strokes: List[Stroke] = []

    @rx.event(background=True)
    async def refresh_strokes(self):
        """Poll the database for strokes and update state every 250ms."""
        while True:
            await asyncio.sleep(0.25)
            async with self:
                with rx.session() as session:
                    rows = session.exec(select(Stroke)).all()
                    self.strokes = list(rows)


class StrokeIn(BaseModel):
    x1: float
    y1: float
    x2: float
    y2: float
    color: str
    session_id: str


def _stroke_line(s: Stroke) -> rx.Component:
    return rx.el.line(
        x1=str(s.x1),
        y1=str(s.y1),
        x2=str(s.x2),
        y2=str(s.y2),
        stroke=s.color,
        **{"stroke-width": 2},
    )


def index() -> rx.Component:
    return rx.container(
        rx.el.svg(
            rx.foreach(
                DrawingState.strokes,
                _stroke_line,
            ),
            view_box="0 0 1000 800",
            width="100%",
            height="600px",
        ),
    )


fastapi_app = FastAPI()


@fastapi_app.post("/api/strokes", status_code=status.HTTP_201_CREATED)
async def create_stroke(stroke: StrokeIn):
    with rx.session() as session:
        db_stroke = Stroke(**stroke.model_dump())
        session.add(db_stroke)
        session.commit()
        session.refresh(db_stroke)
        return {
            "id": db_stroke.id,
            "x1": db_stroke.x1,
            "y1": db_stroke.y1,
            "x2": db_stroke.x2,
            "y2": db_stroke.y2,
            "color": db_stroke.color,
            "session_id": db_stroke.session_id,
        }


@fastapi_app.get("/api/strokes")
async def list_strokes():
    with rx.session() as session:
        rows = session.exec(select(Stroke)).all()
        return [
            {
                "id": r.id,
                "x1": r.x1,
                "y1": r.y1,
                "x2": r.x2,
                "y2": r.y2,
                "color": r.color,
                "session_id": r.session_id,
            }
            for r in rows
        ]


app = rx.App(api_transformer=fastapi_app)
app.add_page(index)
