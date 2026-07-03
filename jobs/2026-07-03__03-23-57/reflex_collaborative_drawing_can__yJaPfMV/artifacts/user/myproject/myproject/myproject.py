"""Welcome to Reflex! This file outlines the steps to create a basic app."""

import asyncio
from fastapi import FastAPI
from pydantic import BaseModel
import reflex as rx
from sqlmodel import select


# Database Model
class Stroke(rx.Model, table=True):
    x1: float
    y1: float
    x2: float
    y2: float
    color: str
    session_id: str


# App State
class State(rx.State):
    strokes: list[Stroke] = []
    is_polling: bool = False

    @rx.event
    def on_load(self):
        """Triggered when the page loads. Starts the background polling task."""
        if not self.is_polling:
            self.is_polling = True
            return State.poll_strokes

    @rx.event(background=True)
    async def poll_strokes(self):
        """Background task to poll strokes from the database every 250ms."""
        while True:
            async with self:
                if not self.is_polling:
                    return
                
                # Fetch all strokes in insertion order (by id)
                with rx.session() as session:
                    self.strokes = session.exec(
                        select(Stroke).order_by(Stroke.id.asc())
                    ).all()
            
            # Sleep outside the context block to avoid blocking UI interaction
            await asyncio.sleep(0.25)


# Index Page Component
def index() -> rx.Component:
    return rx.center(
        rx.vstack(
            rx.heading("Multi-Client Collaborative Drawing Board", size="8"),
            rx.text(
                "Real-time synchronized strokes from SQLite database using Reflex background tasks.",
                size="4",
                color_scheme="gray",
            ),
            rx.el.svg(
                rx.foreach(
                    State.strokes,
                    lambda stroke: rx.el.svg.line(
                        x1=stroke.x1,
                        y1=stroke.y1,
                        x2=stroke.x2,
                        y2=stroke.y2,
                        stroke=stroke.color,
                        stroke_width="2",
                    ),
                ),
                view_box="0 0 800 600",
                width="800px",
                height="600px",
                border="2px solid #333",
                border_radius="8px",
                background_color="#ffffff",
            ),
            align="center",
            spacing="4",
            padding="4",
        )
    )


# FastAPI Integration (api_transformer)
fastapi_app = FastAPI()


class StrokeCreate(BaseModel):
    x1: float
    y1: float
    x2: float
    y2: float
    color: str
    session_id: str


@fastapi_app.post("/api/strokes", status_code=201)
def create_stroke(stroke_in: StrokeCreate):
    with rx.session() as session:
        db_stroke = Stroke(
            x1=stroke_in.x1,
            y1=stroke_in.y1,
            x2=stroke_in.x2,
            y2=stroke_in.y2,
            color=stroke_in.color,
            session_id=stroke_in.session_id,
        )
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
def list_strokes():
    with rx.session() as session:
        strokes = session.exec(select(Stroke).order_by(Stroke.id.asc())).all()
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


@fastapi_app.get("/ping")
def ping():
    return "pong"


# Create Reflex App
app = rx.App(api_transformer=fastapi_app)
app.add_page(index, on_load=State.on_load)
