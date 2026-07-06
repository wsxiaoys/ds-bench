package com.pochi.pixmaprenderer;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

/**
 * Parses the procedural pixmap command script.
 *
 * <p>One command per line, whitespace separated tokens, blank lines and lines starting
 * with {@code #} are ignored. The supported opcodes are documented in the project README
 * and the {@link Op} enum.</p>
 */
public final class ScriptParser {

    /** Supported drawing commands. */
    public enum Op {
        SIZE,
        FILL,
        RECT,
        LINE,
        CIRCLE,
        PIXEL
    }

    /** A single parsed command (opcode + integer arguments). */
    public static final class Command {
        public final Op op;
        public final int[] args;
        public final int lineNumber;

        Command(Op op, int[] args, int lineNumber) {
            this.op = op;
            this.args = args;
            this.lineNumber = lineNumber;
        }
    }

    private ScriptParser() {
    }

    /**
     * Reads the file at {@code path}, skipping blank lines and lines starting with {@code #},
     * and returns the ordered list of commands.
     *
     * @throws IOException          if the file cannot be read
     * @throws ScriptParseException if a line is malformed
     */
    public static List<Command> parse(Path path) throws IOException {
        List<String> lines = Files.readAllLines(path, StandardCharsets.UTF_8);
        List<Command> out = new ArrayList<>();
        boolean sizeEncountered = false;

        for (int i = 0; i < lines.size(); i++) {
            String raw = lines.get(i);
            int lineNumber = i + 1;
            String trimmed = raw.trim();

            // Skip blank lines and comments.
            if (trimmed.isEmpty() || trimmed.startsWith("#")) {
                continue;
            }

            String[] tokens = trimmed.split("\\s+");
            Op op;
            try {
                op = Op.valueOf(tokens[0]);
            } catch (IllegalArgumentException ex) {
                throw new ScriptParseException(
                    "Unknown command '" + tokens[0] + "' on line " + lineNumber, lineNumber);
            }

            int expected = expectedArgCount(op);
            if (tokens.length - 1 != expected) {
                throw new ScriptParseException(
                    "Command " + op + " on line " + lineNumber + " expected "
                        + expected + " arguments but got " + (tokens.length - 1),
                    lineNumber);
            }

            int[] args = new int[expected];
            for (int j = 0; j < expected; j++) {
                try {
                    args[j] = Integer.parseInt(tokens[j + 1]);
                } catch (NumberFormatException nfe) {
                    throw new ScriptParseException(
                        "Argument '" + tokens[j + 1] + "' on line " + lineNumber
                            + " for command " + op + " is not a valid integer",
                        lineNumber, nfe);
                }
            }

            // SIZE must come first.
            if (op == Op.SIZE) {
                if (sizeEncountered) {
                    throw new ScriptParseException(
                        "Duplicate SIZE command on line " + lineNumber, lineNumber);
                }
                sizeEncountered = true;
                if (args[0] <= 0 || args[1] <= 0) {
                    throw new ScriptParseException(
                        "SIZE on line " + lineNumber + " requires positive dimensions",
                        lineNumber);
                }
            } else if (!sizeEncountered) {
                throw new ScriptParseException(
                    "Command " + op + " on line " + lineNumber
                        + " appeared before any SIZE directive",
                    lineNumber);
            }

            out.add(new Command(op, args, lineNumber));
        }

        if (!sizeEncountered) {
            throw new ScriptParseException(
                "Script does not contain a SIZE command", -1);
        }

        return out;
    }

    private static int expectedArgCount(Op op) {
        switch (op) {
            case SIZE:   return 2;   // width height
            case FILL:   return 4;   // r g b a
            case RECT:   return 8;   // x y w h r g b a
            case LINE:   return 8;   // x1 y1 x2 y2 r g b a
            case CIRCLE: return 7;   // cx cy radius r g b a
            case PIXEL:  return 6;   // x y r g b a
            default:
                throw new IllegalStateException("unreachable: " + op);
        }
    }

    /** Thrown for any script-level parsing error. Carries the offending source line. */
    public static final class ScriptParseException extends RuntimeException {
        private static final long serialVersionUID = 1L;
        public final int lineNumber;

        public ScriptParseException(String message, int lineNumber) {
            super(message);
            this.lineNumber = lineNumber;
        }

        public ScriptParseException(String message, int lineNumber, Throwable cause) {
            super(message, cause);
            this.lineNumber = lineNumber;
        }
    }
}
