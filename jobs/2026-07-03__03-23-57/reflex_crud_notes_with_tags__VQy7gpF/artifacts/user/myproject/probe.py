import argparse
import json
import sys
import os

# Add the project root to sys.path so we can import myproject.models
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from sqlmodel import create_engine, Session, select, func
from myproject.models import Note, Tag, NoteTagLink

DATABASE_URL = "sqlite:////home/user/myproject/reflex.db"
engine = create_engine(DATABASE_URL)

def cmd_counts(args):
    with Session(engine) as session:
        notes_count = session.exec(select(func.count()).select_from(Note)).one()
        tags_count = session.exec(select(func.count()).select_from(Tag)).one()
        links_count = session.exec(select(func.count()).select_from(NoteTagLink)).one()
        print(json.dumps({"notes": notes_count, "tags": tags_count, "links": links_count}))

def cmd_ensure_tag(args):
    name = args.name
    with Session(engine) as session:
        statement = select(Tag).where(Tag.name == name)
        tag = session.exec(statement).first()
        created = False
        if not tag:
            tag = Tag(name=name)
            session.add(tag)
            session.commit()
            session.refresh(tag)
            created = True
        print(json.dumps({"id": tag.id, "name": tag.name, "created": created}))

def cmd_create(args):
    content = args.content
    tag_names = []
    if args.tags:
        tag_names = [t.strip() for t in args.tags.split(",") if t.strip()]
    
    with Session(engine) as session:
        tags_to_attach = []
        for name in tag_names:
            statement = select(Tag).where(Tag.name == name)
            tag = session.exec(statement).first()
            if not tag:
                tag = Tag(name=name)
                session.add(tag)
                session.commit()
                session.refresh(tag)
            tags_to_attach.append(tag)
        
        note = Note(content=content)
        note.tags = tags_to_attach
        session.add(note)
        session.commit()
        session.refresh(note)
        
        sorted_tag_names = sorted([t.name for t in note.tags])
        print(json.dumps({"id": note.id, "content": note.content, "tags": sorted_tag_names}))

def cmd_list(args):
    filter_tags = []
    if args.filter:
        filter_tags = [t.strip() for t in args.filter.split(",") if t.strip()]
        
    with Session(engine) as session:
        if filter_tags:
            statement = (
                select(Note)
                .join(NoteTagLink, Note.id == NoteTagLink.note_id)
                .join(Tag, Tag.id == NoteTagLink.tag_id)
                .where(Tag.name.in_(filter_tags))
                .group_by(Note.id)
                .order_by(Note.id.asc())
            )
            notes = session.exec(statement).all()
        else:
            statement = select(Note).order_by(Note.id.asc())
            notes = session.exec(statement).all()
            
        result = []
        for note in notes:
            sorted_tag_names = sorted([t.name for t in note.tags])
            result.append({
                "id": note.id,
                "content": note.content,
                "tags": sorted_tag_names
            })
        print(json.dumps({"notes": result}))

def cmd_set_tags(args):
    note_id = args.id
    tag_names = []
    if args.tags is not None:
        tag_names = [t.strip() for t in args.tags.split(",") if t.strip()]
        
    with Session(engine) as session:
        note = session.get(Note, note_id)
        if not note:
            print(f"Note with id {note_id} not found", file=sys.stderr)
            sys.exit(1)
            
        new_tags = []
        for name in tag_names:
            statement = select(Tag).where(Tag.name == name)
            tag = session.exec(statement).first()
            if not tag:
                tag = Tag(name=name)
                session.add(tag)
                session.commit()
                session.refresh(tag)
            new_tags.append(tag)
            
        note.tags = new_tags
        session.add(note)
        session.commit()
        session.refresh(note)
        
        sorted_tag_names = sorted([t.name for t in note.tags])
        print(json.dumps({"id": note.id, "tags": sorted_tag_names}))

def cmd_update(args):
    note_id = args.id
    content = args.content
    with Session(engine) as session:
        note = session.get(Note, note_id)
        if not note:
            print(f"Note with id {note_id} not found", file=sys.stderr)
            sys.exit(1)
        note.content = content
        session.add(note)
        session.commit()
        session.refresh(note)
        print(json.dumps({"id": note.id, "content": note.content}))

def cmd_delete(args):
    note_id = args.id
    with Session(engine) as session:
        note = session.get(Note, note_id)
        if not note:
            print(f"Note with id {note_id} not found", file=sys.stderr)
            sys.exit(1)
            
        session.delete(note)
        session.commit()
        
        print(json.dumps({"id": note_id, "deleted": True}))

def cmd_all_tags(args):
    with Session(engine) as session:
        statement = (
            select(Tag.name)
            .join(NoteTagLink, Tag.id == NoteTagLink.tag_id)
            .distinct()
        )
        tag_names = session.exec(statement).all()
        sorted_tag_names = sorted(list(tag_names))
        print(json.dumps({"all_tags": sorted_tag_names}))

def main():
    parser = argparse.ArgumentParser(description="Probe CLI helper for Notes & Tags CRUD")
    subparsers = parser.add_subparsers(dest="subcommand", required=True)
    
    subparsers.add_parser("counts")
    
    parser_ensure = subparsers.add_parser("ensure-tag")
    parser_ensure.add_argument("--name", required=True, help="Tag name")
    
    parser_create = subparsers.add_parser("create")
    parser_create.add_argument("--content", required=True, help="Note content")
    parser_create.add_argument("--tags", default="", help="Comma-separated tag names")
    
    parser_list = subparsers.add_parser("list")
    parser_list.add_argument("--filter", default="", help="Comma-separated tag names to filter")
    
    parser_set_tags = subparsers.add_parser("set-tags")
    parser_set_tags.add_argument("--id", type=int, required=True, help="Note ID")
    parser_set_tags.add_argument("--tags", default="", help="Comma-separated tag names")
    
    parser_update = subparsers.add_parser("update")
    parser_update.add_argument("--id", type=int, required=True, help="Note ID")
    parser_update.add_argument("--content", required=True, help="Note content")
    
    parser_delete = subparsers.add_parser("delete")
    parser_delete.add_argument("--id", type=int, required=True, help="Note ID")
    
    subparsers.add_parser("all-tags")
    
    args = parser.parse_args()
    
    if args.subcommand == "counts":
        cmd_counts(args)
    elif args.subcommand == "ensure-tag":
        cmd_ensure_tag(args)
    elif args.subcommand == "create":
        cmd_create(args)
    elif args.subcommand == "list":
        cmd_list(args)
    elif args.subcommand == "set-tags":
        cmd_set_tags(args)
    elif args.subcommand == "update":
        cmd_update(args)
    elif args.subcommand == "delete":
        cmd_delete(args)
    elif args.subcommand == "all-tags":
        cmd_all_tags(args)

if __name__ == "__main__":
    main()
