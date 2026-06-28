import os
import re
import time
import github
import tools
from tools import ReviewOutput, ConflictReport

from langchain_core.messages import SystemMessage, HumanMessage, AIMessage, ToolMessage
from langchain_core.tools import tool as lc_tool

# ---------- Tool definitions for LangChain ----------

@lc_tool
def get_file_content(path: str, ref: str = "") -> str:
    """Fetch the contents of a file from the repository (truncated to 4 KB)."""
    return ""  # placeholder — real dispatch happens in the loop


@lc_tool
def search_repo(query: str) -> str:
    """Search the repository for files matching a query string."""
    return ""


@lc_tool
def get_function_definition(path: str, function_name: str) -> str:
    """Extract a specific function or method definition from a file."""
    return ""


LC_TOOLS = [get_file_content, search_repo, get_function_definition]

SYSTEM_PROMPT = """You are a senior software engineer doing a thorough code review of a GitHub pull request.

You have tools to fetch file contents, look up function definitions, and search the repo. Use them to read the actual source before forming opinions.

How to approach this:
1. Read every file touched by the diff with get_file_content.
2. For any new or changed function, fetch its full definition with get_function_definition.
3. If you see something suspicious, search for related code with search_repo.
4. Once you have read the key files and functions, stop calling tools — a final review call will follow automatically.
"""

REVIEW_PROMPT = """You have now read the relevant source files. Write a thorough code review as a JSON object.

The JSON must match this schema exactly:
- bugs: array of {{ title, description, file, line, severity (low|medium|high|critical) }}
- security_issues: array of {{ title, description, file, line, severity (low|medium|high|critical) }}
- suggestions: array of {{ title, description, file }}
- summary: string

Rules:
- bugs: logic errors, broken edge cases, missing error handling, incorrect assumptions.
- security_issues: unvalidated input, missing auth, injections, secrets in code, insecure defaults.
- suggestions: missing tests, unclear naming, documentation gaps, code quality.
- Include file path and line number wherever you know them.
- If a section has no findings, use an empty array [].
- Return ONLY the JSON object. No markdown fences, no explanation.
"""


# ---------- Model factory ----------

def _get_llm():
    provider = os.getenv("MODEL_PROVIDER", "gemini").lower()

    if provider == "gemini":
        from langchain_google_genai import ChatGoogleGenerativeAI
        return ChatGoogleGenerativeAI(
            model="gemini-2.0-flash",
            google_api_key=os.environ["GOOGLE_API_KEY"],
            temperature=0,
        )
    elif provider == "groq":
        from langchain_groq import ChatGroq
        return ChatGroq(
            model="llama-3.3-70b-versatile",
            groq_api_key=os.environ["GROQ_API_KEY"],
            temperature=0,
        )
    elif provider == "ollama":
        from langchain_ollama import ChatOllama
        return ChatOllama(
            model=os.getenv("OLLAMA_MODEL", "llama3.2"),
            temperature=0,
        )
    elif provider == "openrouter":
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model=os.getenv("OPENROUTER_MODEL", "meta-llama/llama-3.3-70b-instruct:free"),
            openai_api_key=os.environ["OPENROUTER_API_KEY"],
            openai_api_base="https://openrouter.ai/api/v1",
            temperature=0,
        )
    elif provider == "cerebras":
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model=os.getenv("CEREBRAS_MODEL", "llama3.3-70b"),
            openai_api_key=os.environ["CEREBRAS_API_KEY"],
            openai_api_base="https://api.cerebras.ai/v1",
            temperature=0,
        )
    else:
        raise ValueError(f"Unknown MODEL_PROVIDER: {provider!r}. Choose cerebras, gemini, groq, openrouter, or ollama.")


# ---------- Core agent loop ----------

def _log(msg: str, log_cb=None):
    print(msg)
    if log_cb:
        log_cb(msg)

def run(pr_url: str, max_iterations: int = 10, log_cb=None) -> dict:
    owner, repo, pr_number = github.parse_pr_url(pr_url)
    _log(f"Fetching PR #{pr_number} from {owner}/{repo}...", log_cb)

    diff = github.get_pr_diff(owner, repo, pr_number)
    metadata = github.get_pr_metadata(owner, repo, pr_number)
    head_ref = metadata["head_ref"]

    user_message = f"""## Pull Request: {metadata['title']}
**Author:** {metadata['author']}  |  **Base branch:** {metadata['base_branch']}

### Description
{metadata['description'] or '(no description provided)'}

### Diff
```diff
{diff[:6000]}
{"... [diff truncated — use get_file_content to see full files]" if len(diff) > 6000 else ""}
```
"""

    llm = _get_llm()
    llm_with_tools = llm.bind_tools(LC_TOOLS)

    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=user_message),
    ]

    # --- Context-gathering loop ---
    for iteration in range(1, max_iterations + 1):
        if iteration > 1:
            time.sleep(2)
        _log(f"\n[Iteration {iteration}/{max_iterations}] Calling model...", log_cb)

        response = _invoke(llm_with_tools, messages)
        messages.append(response)

        tool_calls = response.tool_calls or []
        if not tool_calls:
            _log("  [No tool calls — stopping context loop]", log_cb)
            break

        for tc in tool_calls:
            fn_name = tc["name"]
            fn_args = tc["args"]
            _log(f"  -> {fn_name}({_summarize(fn_args)})", log_cb)

            result = tools.dispatch(fn_name, fn_args, owner, repo, head_ref)
            if len(result) > 2000:
                result = result[:2000] + "\n...[truncated]"

            messages.append(ToolMessage(content=result, tool_call_id=tc["id"]))

        if iteration >= 4:
            _log("  [Enough context gathered — moving to review]", log_cb)
            break

    # --- Final structured review (with_structured_output) ---
    _log("\n[Producing structured review...]", log_cb)
    time.sleep(2)

    messages.append(HumanMessage(content=REVIEW_PROMPT))
    structured_llm = llm.with_structured_output(ReviewOutput)
    result = _invoke(structured_llm, messages)
    return result.model_dump()


# ---------- Conflict analyzer ----------

CONFLICT_SYSTEM_PROMPT = """You are a senior engineer helping a developer resolve merge conflicts in a pull request.

For each conflicted file you are given:
- The unified diff showing what the PR branch changed
- The current content of that file on the base branch
- The current content of that file on the PR head branch

Your job:
1. Explain clearly what each side (PR branch vs base branch) is trying to do.
2. Identify the exact lines that conflict and why.
3. Give a concrete recommendation for how to merge them correctly.

Do NOT write resolved code snippets — the developer will generate those separately using an AI assistant.
Be practical and specific — the developer needs to understand this quickly so they can merge the PR.
"""


def analyze_conflicts(pr_url: str, log_cb=None) -> dict:
    owner, repo, pr_number = github.parse_pr_url(pr_url)
    _log(f"Fetching PR #{pr_number} conflict info from {owner}/{repo}...", log_cb)

    metadata = github.get_pr_metadata(owner, repo, pr_number)
    head_ref = metadata["head_ref"]
    base_ref = metadata["base_ref"]
    base_branch = metadata["base_branch"]
    head_branch = metadata.get("head_branch", head_ref)
    mergeable = metadata.get("mergeable")
    mergeable_state = metadata.get("mergeable_state", "unknown")

    # GitHub sometimes returns mergeable=None while still computing — treat as unknown
    if mergeable is None:
        _log("  [mergeable=null — GitHub still computing, proceeding with file analysis]", log_cb)

    pr_files = github.get_pr_files(owner, repo, pr_number)

    # Build per-file context: patch + both sides of each file
    file_contexts = []
    for f in pr_files[:10]:  # cap at 10 files to avoid token overflow
        fname = f["filename"]
        patch = f.get("patch", "") or ""
        if len(patch) > 3000:
            patch = patch[:3000] + "\n...[patch truncated]"

        try:
            head_content = github.get_file_content(owner, repo, fname, head_ref)
        except Exception:
            head_content = "(file not accessible on PR head)"

        try:
            base_content = github.get_file_content(owner, repo, fname, base_ref)
        except Exception:
            base_content = "(file not accessible on base branch)"

        file_contexts.append(
            f"### File: `{fname}` (status: {f['status']})\n"
            f"**Unified diff (PR changes):**\n```diff\n{patch}\n```\n"
            f"**Base branch (`{base_branch}`) content:**\n```\n{base_content}\n```\n"
            f"**PR head content:**\n```\n{head_content}\n```\n"
        )
        time.sleep(1)  # avoid GitHub rate limit

    files_block = "\n---\n".join(file_contexts) if file_contexts else "(no files found)"

    user_message = f"""## PR: {metadata['title']}
**Author:** {metadata['author']} | **Base:** {metadata['base_branch']} | **Mergeable state:** {mergeable_state}

{files_block}

Analyze the conflicts in the files above and produce a structured conflict resolution report.
For each file that has or is likely to have a merge conflict, explain both sides, why they conflict, and how to resolve it.
Also give an overall_strategy for resolving all conflicts together.
"""

    llm = _get_llm()
    structured_llm = llm.with_structured_output(ConflictReport)

    _log("\n[Analyzing conflicts with LLM...]", log_cb)
    time.sleep(2)
    result = _invoke(structured_llm, [
        SystemMessage(content=CONFLICT_SYSTEM_PROMPT),
        HumanMessage(content=user_message),
    ])

    # Override mergeable fields with real GitHub data
    result_dict = result.model_dump()
    result_dict["mergeable"] = bool(mergeable) if mergeable is not None else False
    result_dict["mergeable_state"] = mergeable_state
    return result_dict


# ---------- Prompt generator ----------

def generate_prompt(pr_url: str, review: dict, log_cb=None) -> str:
    """Build a self-contained prompt the user can paste into any AI assistant to get code fixes."""
    owner, repo, pr_number = github.parse_pr_url(pr_url)
    diff = github.get_pr_diff(owner, repo, pr_number)
    metadata = github.get_pr_metadata(owner, repo, pr_number)

    _log("\n[Generating AI agent prompt...]", log_cb)

    def fmt_items(items, include_severity=True):
        if not items:
            return "  None found.\n"
        out = ""
        for item in items:
            loc = f" [{item.get('file', '')}:{item.get('line', '')}]" if item.get("file") else ""
            sev = f" [{item.get('severity', '').upper()}]" if include_severity and item.get("severity") else ""
            out += f"- {item['title']}{sev}{loc}\n  {item['description']}\n\n"
        return out

    bugs_block = fmt_items(review.get('bugs', []))
    sec_block  = fmt_items(review.get('security_issues', []))
    sug_block  = fmt_items(review.get('suggestions', []), include_severity=False)
    summary    = review.get('summary', '')

    diff_snippet = diff[:6000] + ("\n...[diff truncated]" if len(diff) > 6000 else "")

    prompt = f"""You are a senior software engineer. I need you to fix the issues found in the following pull request.

## Pull Request
**Title:** {metadata['title']}
**Author:** {metadata['author']} | **Base branch:** {metadata['base_branch']}
**PR URL:** {pr_url}
{f"**Description:** {metadata['description']}" if metadata.get('description') else ''}

## Summary of Review Findings
{summary}

## Bugs Found
{bugs_block}
## Security Issues
{sec_block}
## Suggestions
{sug_block}
## Full Diff
```diff
{diff_snippet}
```

## Task
For each bug and security issue listed above, write the exact code fix as a unified diff (`--- a/file` / `+++ b/file` / `@@ ... @@` format).
- Keep changes minimal and surgical — do not refactor unrelated code.
- If a file path and line number are given, target those exactly.
- After the diffs, write a one-paragraph summary of the overall approach you took.
"""
    return prompt


def generate_code_stream(prompt: str):
    """
    Generator that streams code-fix chunks from the LLM.
    Yields plain text chunks as they arrive.
    """
    llm = _get_llm()
    messages = [
        SystemMessage(content=(
            "You are a senior software engineer. "
            "The user will give you a PR review prompt. "
            "Respond with exact code fixes in unified diff format. "
            "Group fixes by file. Be surgical — only change what's needed."
        )),
        HumanMessage(content=prompt),
    ]
    for chunk in llm.stream(messages):
        text = chunk.content if hasattr(chunk, "content") else str(chunk)
        if text:
            yield text


# ---------- Helpers ----------

def _invoke(llm, messages: list, retries: int = 5):
    """Invoke any LangChain LLM/chain with automatic retry on rate limit errors."""
    for attempt in range(retries):
        try:
            return llm.invoke(messages)
        except Exception as e:
            msg = str(e)
            if "429" in msg or "rate" in msg.lower() or "quota" in msg.lower():
                # Try to read retry_after from the error message
                wait = 60
                m = re.search(r"retry_after_seconds['\"]:\s*([\d.]+)", msg)
                if m:
                    wait = int(float(m.group(1))) + 2
                if attempt == retries - 1:
                    raise
                print(f"  [Rate limited] Waiting {wait}s before retry {attempt + 2}/{retries}...")
                time.sleep(wait)
            else:
                raise


def _summarize(d: dict) -> str:
    return ", ".join(f"{k}={repr(v)[:60]}" for k, v in d.items())
