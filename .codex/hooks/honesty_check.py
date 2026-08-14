# -*- coding: utf-8 -*-
"""
Honesty check Stop hook for Claude Code.

Purpose: Block Claude from finishing a response when it claims something
"works" / "is fixed" / "should work" without having actually run a
verification command in that response.

Why this exists: Jayme is non-technical. She cannot read code to catch
Claude making false-confidence claims. This hook does the catching for her.

If Claude says "it works" but the response contains no test/build/curl/
browser/SQL command, the Stop hook blocks and tells Claude to either
actually run a test or rewrite the claim honestly.

Disable: comment out the Stop hook entry in .claude/settings.json,
or run /hooks in Claude Code to manage interactively.
"""
import json
import re
import sys

# Phrases that suggest Claude is asserting something works / is done / is fixed.
# Patterns are case-insensitive. Kept narrow to avoid false positives on
# normal description ("the function is now stored in the rules table" - safe).
CLAIM_PATTERNS = [
    r"\bit works\b",
    r"\bworks now\b",
    r"\bnow works\b",
    r"\bthis works\b",
    r"\bworking now\b",
    r"\bi(?:'ve| have)? tested\b",
    r"\bi(?:'ve| have)? verified\b",
    r"\bi(?:'ve| have)? confirmed\b",
    r"\b(?:is|been|now) fixed\b",
    r"\bshould work\b",
    r"\bthis should\b",
    r"\bready to (?:deploy|ship|push|commit|merge)\b",
    r"\bgood to go\b",
    r"\ball set\b",
    r"\ball done\b",
    r"\bsuccessfully (?:built|tested|deployed|ran|fixed)\b",
    r"\bthe hook is live\b",
    r"\bthe hook (?:works|is working)\b",
]

# Bash / PowerShell commands that count as actual verification.
BASH_VERIFY_PATTERNS = [
    r"\bnpm\s+(?:test|run\s+(?:test|build|lint|check|typecheck))",
    r"\bnpx\s+(?:jest|vitest|playwright|cypress|tsc|eslint|react-scripts\s+(?:test|build))",
    r"\bpnpm\s+(?:test|build|lint)",
    r"\byarn\s+(?:test|build|lint)",
    r"\bbun\s+(?:test|run\s+(?:test|build))",
    r"\bdeno\s+(?:test|check)",
    r"\bpytest\b",
    r"\bpython\d?\s+\S+\.py\b",
    r"\bnode\s+\S+\.(?:js|mjs|cjs|ts)\b",
    r"\bcurl\b",
    r"\bgh\s+(?:api|pr|run|workflow|issue)",
    r"\bgit\s+(?:log|diff|show|status)",
    r"\bjq\s+",
]

# MCP / web tools that count as verification.
VERIFY_TOOL_PATTERNS = [
    r"^mcp__playwright__",
    r"^mcp__Claude_Preview__",
    r"^mcp__Claude_in_Chrome__",
    r"^mcp__.*__execute_sql$",
    r"^mcp__.*__get_logs$",
    r"^mcp__.*__list_tables$",
    r"^WebFetch$",
]


def text_from_content(content):
    """Pull plain text out of a content field that may be a string or a list of blocks."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, dict) and block.get("type") == "text":
                parts.append(block.get("text", ""))
        return "\n".join(parts)
    return ""


def tool_uses_from_content(content):
    """Pull tool_use blocks out of a content list."""
    if isinstance(content, list):
        return [b for b in content if isinstance(b, dict) and b.get("type") == "tool_use"]
    return []


def is_verifying_tool_call(tool_use):
    name = tool_use.get("name", "")
    if name in ("Bash", "PowerShell"):
        cmd = tool_use.get("input", {}).get("command", "") or ""
        for pat in BASH_VERIFY_PATTERNS:
            if re.search(pat, cmd, re.IGNORECASE):
                return True
        return False
    for pat in VERIFY_TOOL_PATTERNS:
        if re.search(pat, name):
            return True
    return False


def get_content(msg):
    """Handle both flat {content: ...} and nested {message: {content: ...}} shapes."""
    if "message" in msg and isinstance(msg["message"], dict):
        return msg["message"].get("content")
    return msg.get("content")


def get_role(msg):
    if "message" in msg and isinstance(msg["message"], dict):
        role = msg["message"].get("role")
        if role:
            return role
    return msg.get("type") or msg.get("role")


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        sys.exit(0)

    # Avoid infinite loops if Stop hook re-fires.
    if data.get("stop_hook_active"):
        sys.exit(0)

    transcript_path = data.get("transcript_path")
    if not transcript_path:
        sys.exit(0)

    try:
        with open(transcript_path, "r", encoding="utf-8") as f:
            lines = f.readlines()
    except Exception:
        sys.exit(0)

    messages = []
    for line in lines:
        line = line.strip()
        if not line:
            continue
        try:
            messages.append(json.loads(line))
        except Exception:
            continue

    # Find the last real user message (not a tool_result wrapper).
    last_user_idx = -1
    for i in range(len(messages) - 1, -1, -1):
        msg = messages[i]
        if get_role(msg) != "user":
            continue
        content = get_content(msg)
        if isinstance(content, list):
            non_tr = [b for b in content if not (isinstance(b, dict) and b.get("type") == "tool_result")]
            if not non_tr:
                continue
        last_user_idx = i
        break

    # Collect assistant text + tool calls since the last user turn.
    assistant_text_parts = []
    tool_calls = []
    for msg in messages[last_user_idx + 1:]:
        if get_role(msg) != "assistant":
            continue
        content = get_content(msg)
        assistant_text_parts.append(text_from_content(content))
        tool_calls.extend(tool_uses_from_content(content))

    full_text = "\n".join(assistant_text_parts)

    triggered = []
    for pat in CLAIM_PATTERNS:
        m = re.search(pat, full_text, re.IGNORECASE)
        if m:
            triggered.append(m.group(0))

    if not triggered:
        sys.exit(0)

    if any(is_verifying_tool_call(tc) for tc in tool_calls):
        sys.exit(0)

    # BLOCK
    output = {
        "decision": "block",
        "reason": (
            "HONESTY CHECK FAILED. You said: "
            + ", ".join(f'\"{p}\"' for p in triggered[:3])
            + ". But you did NOT run a verification command in this response (no npm test, "
            "npm run build, python script, curl, gh, browser tool, or SQL query). "
            "Either: (1) actually run a test command and confirm it passes before claiming, "
            "OR (2) rewrite to be honest -- 'I haven't tested this', 'I edited the file but didn't run it', "
            "'this should work in theory but I didn't verify'. "
            "Jayme is non-technical and cannot read code to catch you. Do not claim things work that you have not tested."
        ),
    }
    print(json.dumps(output))
    sys.exit(0)


if __name__ == "__main__":
    main()
