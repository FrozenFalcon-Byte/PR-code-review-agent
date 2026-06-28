import os
import re
import requests

GITHUB_API = "https://api.github.com"


def _headers():
    token = os.getenv("GITHUB_TOKEN")
    h = {"Accept": "application/vnd.github+json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h


def parse_pr_url(url: str) -> tuple[str, str, int]:
    m = re.match(r"https://github\.com/([^/]+)/([^/]+)/pull/(\d+)", url.strip())
    if not m:
        raise ValueError(f"Not a valid GitHub PR URL: {url}")
    return m.group(1), m.group(2), int(m.group(3))


def get_pr_diff(owner: str, repo: str, pr_number: int) -> str:
    url = f"{GITHUB_API}/repos/{owner}/{repo}/pulls/{pr_number}"
    resp = requests.get(url, headers={**_headers(), "Accept": "application/vnd.github.diff"})
    resp.raise_for_status()
    return resp.text


def get_pr_metadata(owner: str, repo: str, pr_number: int) -> dict:
    url = f"{GITHUB_API}/repos/{owner}/{repo}/pulls/{pr_number}"
    resp = requests.get(url, headers=_headers())
    resp.raise_for_status()
    data = resp.json()
    return {
        "title": data["title"],
        "description": data.get("body") or "",
        "base_ref": data["base"]["sha"],
        "head_ref": data["head"]["sha"],
        "base_branch": data["base"]["ref"],
        "head_branch": data["head"]["ref"],
        "author": data["user"]["login"],
        "mergeable": data.get("mergeable"),          # True/False/None (null = not yet computed)
        "mergeable_state": data.get("mergeable_state", "unknown"),  # clean/dirty/blocked/behind/unknown
    }


def get_pr_files(owner: str, repo: str, pr_number: int) -> list[dict]:
    """Return list of files changed in a PR with their status and patch."""
    url = f"{GITHUB_API}/repos/{owner}/{repo}/pulls/{pr_number}/files"
    resp = requests.get(url, headers=_headers(), params={"per_page": 100})
    resp.raise_for_status()
    return [
        {
            "filename": f["filename"],
            "status": f["status"],  # added/modified/removed/renamed
            "additions": f["additions"],
            "deletions": f["deletions"],
            "patch": f.get("patch", ""),  # unified diff for this file
        }
        for f in resp.json()
    ]


def get_file_content(owner: str, repo: str, path: str, ref: str = None) -> str:
    url = f"{GITHUB_API}/repos/{owner}/{repo}/contents/{path}"
    params = {"ref": ref} if ref else {}
    resp = requests.get(url, headers=_headers(), params=params)
    resp.raise_for_status()
    data = resp.json()
    if data.get("encoding") == "base64":
        import base64
        content = base64.b64decode(data["content"]).decode("utf-8", errors="replace")
    else:
        content = data.get("content", "")
    # truncate to 8 KB
    if len(content) > 4096:
        content = content[:4096] + "\n... [truncated at 4 KB]"
    return content


def search_repo(owner: str, repo: str, query: str) -> list[dict]:
    url = f"{GITHUB_API}/search/code"
    params = {"q": f"{query} repo:{owner}/{repo}", "per_page": 10}
    resp = requests.get(url, headers=_headers(), params=params)
    resp.raise_for_status()
    items = resp.json().get("items", [])
    results = []
    for item in items:
        results.append({
            "path": item["path"],
            "url": item["html_url"],
        })
    return results
