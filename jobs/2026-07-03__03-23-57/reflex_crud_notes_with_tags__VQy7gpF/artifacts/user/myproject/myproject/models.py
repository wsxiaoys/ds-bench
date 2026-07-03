from typing import List, Optional
import reflex as rx
import sqlmodel

class NoteTagLink(rx.Model, table=True):
    id: Optional[int] = sqlmodel.Field(default=None, primary_key=False, nullable=True)
    note_id: Optional[int] = sqlmodel.Field(
        default=None, foreign_key="note.id", primary_key=True
    )
    tag_id: Optional[int] = sqlmodel.Field(
        default=None, foreign_key="tag.id", primary_key=True
    )

class Tag(rx.Model, table=True):
    id: Optional[int] = sqlmodel.Field(default=None, primary_key=True)
    name: str = sqlmodel.Field(unique=True, index=True)
    notes: List["Note"] = sqlmodel.Relationship(
        back_populates="tags",
        link_model=NoteTagLink,
    )

class Note(rx.Model, table=True):
    id: Optional[int] = sqlmodel.Field(default=None, primary_key=True)
    content: str
    tags: List[Tag] = sqlmodel.Relationship(
        back_populates="notes",
        link_model=NoteTagLink,
    )
