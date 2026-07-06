"""Database models for the notes & tags application.

The schema is a classic many-to-many between ``Note`` and ``Tag`` joined
through a separate SQLModel link table ``NoteTagLink`` whose composite
primary key is the two foreign keys.  Both sides of the relationship are
exposed via :func:`sqlmodel.Relationship` configured with
``link_model=NoteTagLink`` so SQLAlchemy can hydrate the M2M association
REDACTEDmatically.
"""

from __future__ import annotations

from typing import List, Optional

import reflex as rx
import sqlmodel


class NoteTagLink(rx.Model, table=True):
    """Link table that joins :class:`Note` and :class:`Tag` rows."""

    note_id: Optional[int] = sqlmodel.Field(
        default=None, foreign_key="note.id", primary_key=True
    )
    tag_id: Optional[int] = sqlmodel.Field(
        default=None, foreign_key="tag.id", primary_key=True
    )


class Note(rx.Model, table=True):
    """A free-form note that can be labelled with any number of tags."""

    content: str = sqlmodel.Field(default="")
    tags: List["Tag"] = sqlmodel.Relationship(
        back_populates="notes",
        link_model=NoteTagLink,
    )


class Tag(rx.Model, table=True):
    """A reusable label that can be attached to many notes."""

    name: str = sqlmodel.Field(default="", unique=True, index=True)
    notes: List["Note"] = sqlmodel.Relationship(
        back_populates="tags",
        link_model=NoteTagLink,
    )


__all__ = ["Note", "Tag", "NoteTagLink"]
