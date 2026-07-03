import reflex as rx
from sqlmodel import Field, Relationship, SQLModel
from typing import List, Optional


class NoteTagLink(rx.Model, table=True):
    """Link table for the many-to-many relationship between Note and Tag."""
    note_id: int = Field(foreign_key="note.id", primary_key=True)
    tag_id: int = Field(foreign_key="tag.id", primary_key=True)


class Tag(rx.Model, table=True):
    """Tag model."""
    name: str = Field(unique=True, index=True)
    notes: List["Note"] = Relationship(
        back_populates="tags",
        link_model=NoteTagLink,
    )


class Note(rx.Model, table=True):
    """Note model."""
    content: str
    tags: List["Tag"] = Relationship(
        back_populates="notes",
        link_model=NoteTagLink,
    )
