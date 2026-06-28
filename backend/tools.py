import ast
import re
from typing import Optional, Literal
from pydantic import BaseModel
import github


# ---------- Pydantic schema for the final review ----------

class ReviewItem(BaseModel):
    title: str
    description: str
    file: Optional[str] = None
    line: Optional[str] = None
    severity: Literal["low", "medium", "high", "critical"]


class Suggestion(BaseModel):
    title: str
    description: str
    file: Optional[str] = None


class ReviewOutput(BaseModel):
    bugs: list[ReviewItem]
    security_issues: list[ReviewItem]
    suggestions: list[Suggestion]
    summary: str


# ---------- Pydantic schema for conflict analysis ----------

class ConflictResolution(BaseModel):
    file: str
    conflict_summary: str
    our_side: str        # what the PR branch is doing
    their_side: str      # what the base branch is doing
    recommendation: str  # how to resolve it


class ConflictReport(BaseModel):
    mergeable: bool
    mergeable_state: str
    conflicts: list[ConflictResolution]
    overall_strategy: str  # high-level advice for resolving all conflicts


# ---------- Tool schemas for context-gathering (no finish_review) ----------

def _fn(name, description, properties, required):
    return {
        "type": "function",
        "function": {
            "name": name,
            "description": description,
            "parameters": {
                "type": "object",
                "properties": properties,
                "required": required,
            },
        },
    }


TOOL_SCHEMAS = [
    _fn(
        "get_file_content",
        "Fetch the contents of a file from the repository. Truncated to 4 KB.",
        {
            "path": {"type": "string", "description": "File path relative to repo root"},
            "ref": {"type": "string", "description": "Git ref (branch, tag, or commit SHA). Defaults to PR head."},
        },
        ["path"],
    ),
    _fn(
        "search_repo",
        "Search the repository for files matching a query string.",
        {
            "query": {"type": "string", "description": "Search query (keywords, symbol names, etc.)"},
        },
        ["query"],
    ),
    _fn(
        "get_function_definition",
        "Extract a specific function or method definition from a file.",
        {
            "path": {"type": "string", "description": "File path relative to repo root"},
            "function_name": {"type": "string", "description": "Name of the function or method to extract"},
        },
        ["path", "function_name"],
    ),
]


# ---------- Tool dispatcher ----------

def dispatch(tool_name: str, tool_input: dict, owner: str, repo: str, head_ref: str) -> str:
    if tool_name == "get_file_content":
        ref = tool_input.get("ref", head_ref)
        try:
            return github.get_file_content(owner, repo, tool_input["path"], ref)
        except Exception as e:
            return f"Error fetching file: {e}"

    elif tool_name == "search_repo":
        try:
            results = github.search_repo(owner, repo, tool_input["query"])
            if not results:
                return "No results found."
            return "\n".join(f"- {r['path']}" for r in results)
        except Exception as e:
            return f"Error searching repo: {e}"

    elif tool_name == "get_function_definition":
        path = tool_input["path"]
        fn_name = tool_input["function_name"]
        ref = tool_input.get("ref", head_ref)
        try:
            source = github.get_file_content(owner, repo, path, ref)
        except Exception as e:
            return f"Error fetching file: {e}"

        if path.endswith(".py"):
            result = _extract_python_function(source, fn_name)
        else:
            result = _extract_function_grep(source, fn_name)

        return result or f"Function '{fn_name}' not found in {path}."

    return f"Unknown tool: {tool_name}"


def _extract_python_function(source: str, function_name: str) -> str | None:
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return None
    lines = source.splitlines()
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == function_name:
            return "\n".join(lines[node.lineno - 1 : node.end_lineno])
    return None


def _extract_function_grep(source: str, function_name: str) -> str | None:
    lines = source.splitlines()
    pattern = re.compile(
        rf"^\s*(def|function|func|public|private|protected|static|async).*\b{re.escape(function_name)}\b"
    )
    for i, line in enumerate(lines):
        if pattern.search(line):
            return "\n".join(lines[i : i + 50])
    return None
