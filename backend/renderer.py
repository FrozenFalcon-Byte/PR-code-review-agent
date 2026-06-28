import json
from rich.console import Console
from rich.panel import Panel
from rich.text import Text
from rich import box

console = Console()

SEVERITY_COLORS = {
    "critical": "bold red",
    "high": "red",
    "medium": "yellow",
    "low": "cyan",
}


def _severity_badge(severity: str) -> str:
    color = SEVERITY_COLORS.get(severity, "white")
    return f"[{color}][{severity.upper()}][/{color}]"


def _render_items(items: list[dict], show_file: bool = True) -> Text:
    text = Text()
    for i, item in enumerate(items, 1):
        severity = item.get("severity", "")
        badge = _severity_badge(severity) if severity else ""
        text.append(f"{i}. ", style="bold")
        if badge:
            text.append_text(Text.from_markup(f"{badge} "))
        text.append(item["title"], style="bold white")
        text.append("\n")
        text.append(f"   {item['description']}\n", style="dim")
        location = ""
        if item.get("file"):
            location = item["file"]
            if item.get("line"):
                location += f":{item['line']}"
        if location:
            text.append(f"   📍 {location}\n", style="italic dim")
        text.append("\n")
    return text


def render(review: dict, as_json: bool = False) -> None:
    if as_json:
        print(json.dumps(review, indent=2))
        return

    console.print()
    console.rule("[bold blue]Code Review Report[/bold blue]")
    console.print()

    # Summary
    console.print(Panel(
        review.get("summary", ""),
        title="[bold]Summary[/bold]",
        border_style="blue",
        box=box.ROUNDED,
    ))
    console.print()

    # Bugs
    bugs = review.get("bugs", [])
    bugs_text = _render_items(bugs) if bugs else Text("No bugs found.", style="green")
    console.print(Panel(
        bugs_text,
        title=f"[bold red]Bugs[/bold red] ({len(bugs)})",
        border_style="red",
        box=box.ROUNDED,
    ))
    console.print()

    # Security Issues
    sec = review.get("security_issues", [])
    sec_text = _render_items(sec) if sec else Text("No security issues found.", style="green")
    console.print(Panel(
        sec_text,
        title=f"[bold yellow]Security Issues[/bold yellow] ({len(sec)})",
        border_style="yellow",
        box=box.ROUNDED,
    ))
    console.print()

    # Suggestions
    suggestions = review.get("suggestions", [])
    sug_text = _render_items(suggestions, show_file=True) if suggestions else Text("No suggestions.", style="dim")
    console.print(Panel(
        sug_text,
        title=f"[bold cyan]Suggestions[/bold cyan] ({len(suggestions)})",
        border_style="cyan",
        box=box.ROUNDED,
    ))
    console.print()
