#!/usr/bin/env python3
"""
Push the FULL local working tree to a remote branch via the GitHub REST API.

Why the API and not `git push`:
Freebuff injects its own GitHub App credential at the HTTPS network layer.
That credential has no access to kioka8877-ux/LACRIMAE and it overwrites any
PAT embedded in the remote URL. The REST API is not intercepted, so a PAT
works directly.

This version differs from the earlier one:
  - pushes the whole working tree (tracked + untracked), not just one branch
  - reads the token from the GH_PAT environment variable (never hardcoded)
  - parallel + resumable blob upload (skips blobs already on the remote)
  - updates the branch with PATCH when it already exists

Usage:  GH_PAT=ghp_xxx python3 push_via_api.py [branch]
"""
import base64
import hashlib
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

TOKEN = os.environ.get("GH_PAT") or os.environ.get("GITHUB_TOKEN")
if not TOKEN:
    sys.exit("Set the GH_PAT env var to your personal access token.")

REPO = "kioka8877-ux/LACRIMAE"
BRANCH = sys.argv[1] if len(sys.argv) > 1 else "dev6-D"
API = f"https://api.github.com/repos/{REPO}"

# Local project root = git top-level of the current checkout.
ROOT = subprocess.run(
    ["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True
).stdout.strip() or os.getcwd()

# Deliberate exclusions:
#  - node_modules / .git : regenerable dependency & metadata noise
#  - the 181 MB modal test render: over GitHub's 100 MB blob hard limit
SKIP_COMPONENTS = {"node_modules", ".git"}
SKIP_PATHS = {"F03_AI/.test/f03_ai_modal_test/f03_ai_modal_final.mp4"}


def api(method, path, data=None, timeout=600):
    req = urllib.request.Request(f"{API}{path}", method=method)
    req.add_header("Authorization", f"token {TOKEN}")
    req.add_header("Accept", "application/vnd.github+json")
    body = None
    if data is not None:
        body = json.dumps(data).encode()
        req.add_header("Content-Type", "application/json")
    for attempt in range(6):
        try:
            with urllib.request.urlopen(req, body, timeout=timeout) as resp:
                raw = resp.read()
                return (resp.status, json.loads(raw) if raw else {})
        except urllib.error.HTTPError as e:
            raw = e.read()
            try:
                parsed = json.loads(raw) if raw else {}
            except Exception:
                parsed = {}
            if e.code == 403 and "rate limit" in str(parsed.get("message", "")).lower():
                print("  rate limit hit — waiting 60s before retry...")
                time.sleep(60)
                continue
            if e.code in (404, 409, 422):
                return (e.code, parsed)
            if attempt >= 5:
                raise RuntimeError(f"API {method} {path} failed: {e.code} {parsed}")
            time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"API {method} {path} failed after retries")


def local_blob_sha(data: bytes) -> str:
    h = hashlib.sha1()
    h.update(f"blob {len(data)}\0".encode())
    h.update(data)
    return h.hexdigest()


def collect_files():
    files = []
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in SKIP_COMPONENTS]
        for fn in filenames:
            rel = os.path.relpath(os.path.join(dirpath, fn), ROOT).replace(os.sep, "/")
            if rel in SKIP_PATHS:
                continue
            files.append(rel)
    return sorted(files)


def upload_blob(rel):
    full = os.path.join(ROOT, rel)
    with open(full, "rb") as f:
        data = f.read()
    sha = local_blob_sha(data)
    # Resumable: skip if this blob already exists on the remote.
    status, body = api("GET", f"/git/blobs/{sha}")
    if status == 200 and body.get("sha"):
        return sha
    status, body = api(
        "POST",
        "/git/blobs",
        {"encoding": "base64", "content": base64.b64encode(data).decode()},
        timeout=900,
    )
    if status not in (200, 201) or not body.get("sha"):
        raise RuntimeError(f"blob upload failed for {rel}: {body}")
    return body["sha"]


def main():
    files = collect_files()
    print(f"[1/5] {len(files)} files to push")
    print(f"      repo: {REPO}  branch: {BRANCH}")

    print("[2/5] Uploading blobs (8 parallel workers)...")
    with ThreadPoolExecutor(max_workers=8) as pool:
        blob_map = dict(zip(files, pool.map(upload_blob, files)))
    print(f"      {len(blob_map)} blobs ready")

    # Nested structure: {"files": {name: sha}, "dirs": {name: node}}
    def make_node():
        return {"files": {}, "dirs": {}}

    root_node = make_node()
    for rel, sha in blob_map.items():
        parts = rel.split("/")
        node = root_node
        for p in parts[:-1]:
            node = node["dirs"].setdefault(p, make_node())
        node["files"][parts[-1]] = sha

    print("[3/5] Creating trees bottom-up...")
    tree_count = 0

    def create_tree(node, prefix=""):
        nonlocal tree_count
        entries = []
        for name, sha in sorted(node["files"].items()):
            rel = f"{prefix}/{name}" if prefix else name
            full = os.path.join(ROOT, rel)
            mode = "100755" if os.access(full, os.X_OK) else "100644"
            entries.append({"path": name, "mode": mode, "type": "blob", "sha": sha})
        for name, sub in sorted(node["dirs"].items()):
            sub_sha = create_tree(sub, f"{prefix}/{name}" if prefix else name)
            entries.append({"path": name, "mode": "040000", "type": "tree", "sha": sub_sha})
        if not entries:
            return None
        status, body = api("POST", "/git/trees", {"tree": entries})
        if status not in (200, 201) or not body.get("sha"):
            raise RuntimeError(f"tree creation failed: {body}")
        tree_count += 1
        return body["sha"]

    root_tree_sha = create_tree(root_node)
    print(f"      {tree_count} trees created, root tree: {root_tree_sha[:10]}")

    print("[4/5] Creating commit...")
    status, ref = api("GET", f"/git/refs/heads/{BRANCH}")
    if status != 200 or "object" not in ref:
        sys.exit(f"Branch {BRANCH} not found on remote: {ref}")
    parent = ref["object"]["sha"]
    print(f"      parent: {parent[:10]} ({BRANCH} current head)")

    message = os.environ.get(
        "GH_COMMIT_MESSAGE",
        "feat(dev6-D): sync full working tree — F00→F09 pipeline, assets, videos, docs, presets",
    )
    status, commit = api(
        "POST",
        "/git/commits",
        {"message": message, "tree": root_tree_sha, "parents": [parent]},
    )
    if status not in (200, 201) or not commit.get("sha"):
        sys.exit(f"commit creation failed: {commit}")
    print(f"      commit: {commit['sha'][:10]}")

    print("[5/5] Updating branch ref...")
    status, body = api(
        "PATCH", f"/git/refs/heads/{BRANCH}", {"sha": commit["sha"], "force": False}
    )
    if status != 200 or "object" not in body:
        sys.exit(f"ref update failed: {body}")
    print(f"      ref updated -> {body['object']['sha'][:10]}")

    print(f"\n✅ DONE — https://github.com/{REPO}/tree/{BRANCH}")
    print(f"   commit {commit['sha']}")


if __name__ == "__main__":
    main()
