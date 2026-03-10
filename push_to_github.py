#!/usr/bin/env python3
"""
Push current Replit code to GitHub — diff-only, much faster.
Usage: python3 push_to_github.py "your commit message"
"""
import subprocess, requests, base64, os, sys, time, hashlib, json, re

TOKEN = os.environ.get("GITHUB_PERSONAL_ACCESS_TOKEN", "")
OWNER = "thefinks-dotcom"
REPO  = "Quadley-080326-Node.js"
BASE  = f"https://api.github.com/repos/{OWNER}/{REPO}"
HEADS = {"Authorization": f"token {TOKEN}", "Content-Type": "application/json"}

if not TOKEN:
    print("Error: GITHUB_PERSONAL_ACCESS_TOKEN secret not set.")
    sys.exit(1)

MESSAGE = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else "Update from Replit"
BRANCH  = "messages"

SKIP_PREFIXES = (
    "frontend-next/.next/",
    "frontend/build/",
    "node_modules/",
    "mobile/node_modules/",
    "frontend-next/node_modules/",
    "frontend/node_modules/",
)
SKIP_EXTENSIONS = (".pack.gz", ".pack", ".pyc")

def api(method, path, data=None, retries=3):
    url = BASE + path
    for attempt in range(retries):
        r = requests.request(method, url, headers=HEADS, json=data, timeout=60)
        if r.status_code == 403 and "rate limit" in r.text.lower():
            wait = 20 * (attempt + 1)
            print(f"  Rate limited, waiting {wait}s...")
            time.sleep(wait)
            continue
        if r.status_code == 204:
            return {}
        if r.status_code >= 400:
            print(f"  API error {r.status_code} {path}: {r.text[:200]}", file=sys.stderr)
            return None
        return r.json()
    return None

def git_blob_sha(content_bytes):
    """Compute the git blob SHA1 — same algorithm GitHub uses."""
    header = f"blob {len(content_bytes)}\0".encode()
    return hashlib.sha1(header + content_bytes).hexdigest()

def get_github_tree(tree_sha, acc=None, prefix=""):
    """Recursively fetch the full GitHub tree as {path: blob_sha}."""
    if acc is None:
        acc = {}
    data = api("GET", f"/git/trees/{tree_sha}?recursive=1")
    if not data:
        return acc
    for item in data.get("tree", []):
        if item["type"] == "blob":
            acc[item["path"]] = item["sha"]
    return acc

# --- Step 1: Get main HEAD ---
print("Getting current GitHub HEAD on main...")
main_ref = api("GET", "/git/refs/heads/main")
if not main_ref:
    print("Could not find main branch."); sys.exit(1)
main_sha = main_ref["object"]["sha"]
print(f"  main HEAD: {main_sha[:8]}")

# --- Step 2: Get commit tree SHA ---
main_commit = api("GET", f"/git/commits/{main_sha}")
if not main_commit:
    print("Could not fetch main commit."); sys.exit(1)
main_tree_sha = main_commit["tree"]["sha"]

# --- Step 3: Fetch full GitHub tree (path → blob sha) ---
print("Fetching GitHub tree to diff against...")
github_tree = get_github_tree(main_tree_sha)
print(f"  GitHub has {len(github_tree)} files")

# --- Step 4: Enumerate local files ---
try:
    tracked = subprocess.check_output(["git", "ls-files"], timeout=15).decode().strip().split("\n")
except Exception:
    tracked = []
try:
    untracked = subprocess.check_output(
        ["git", "ls-files", "--others", "--exclude-standard"], timeout=15
    ).decode().strip().split("\n")
except Exception:
    untracked = []

files = list(set(tracked + untracked))
files = [
    f for f in files
    if f
    and os.path.exists(f)
    and os.path.isfile(f)
    and not any(f.startswith(p) for p in SKIP_PREFIXES)
    and not any(f.endswith(e) for e in SKIP_EXTENSIONS)
]

# --- Step 4b: Auto-increment iOS build number in app.config.js ---
APP_CONFIG = "mobile/app.config.js"
try:
    with open(APP_CONFIG, "r") as fh:
        cfg = fh.read()
    m = re.search(r"(const iosBuildNumber = ')(\d+)(';)", cfg)
    if m:
        old_build = int(m.group(2))
        new_build = old_build + 1
        cfg = cfg[:m.start()] + f"{m.group(1)}{new_build}{m.group(3)}" + cfg[m.end():]
        with open(APP_CONFIG, "w") as fh:
            fh.write(cfg)
        print(f"  iOS build number bumped: {old_build} → {new_build}")
except Exception as e:
    print(f"  Warning: could not bump iOS build number: {e}")

# --- Step 5: Diff — find only files that changed ---
print(f"Diffing {len(files)} local files against GitHub...")
changed_text = []
changed_binary = []

for path in files:
    try:
        with open(path, "rb") as fh:
            content = fh.read()
    except Exception:
        continue
    local_sha = git_blob_sha(content)
    if github_tree.get(path) == local_sha:
        continue  # unchanged
    try:
        text = content.decode("utf-8")
        changed_text.append((path, text))
    except UnicodeDecodeError:
        changed_binary.append((path, content))

print(f"  {len(changed_text)} text files changed, {len(changed_binary)} binary files changed")

if not changed_text and not changed_binary:
    print("Nothing changed — no push needed.")
    sys.exit(0)

# --- Step 6: Build minimal tree items ---
tree_items = [{"path": p, "mode": "100644", "type": "blob", "content": t} for p, t in changed_text]

for path, content in changed_binary:
    print(f"  Uploading binary: {path}")
    blob = api("POST", "/git/blobs", {"encoding": "base64", "content": base64.b64encode(content).decode()})
    if blob:
        tree_items.append({"path": path, "mode": "100644", "type": "blob", "sha": blob["sha"]})
    time.sleep(0.5)

# --- Step 7: Create tree (based on existing main tree) ---
print(f"Creating tree with {len(tree_items)} changed file(s)...")
tree = api("POST", "/git/trees", {"base_tree": main_tree_sha, "tree": tree_items})
if not tree:
    print("Failed to create tree."); sys.exit(1)

# --- Step 8: Create commit ---
print(f"Creating commit: \"{MESSAGE}\"")
commit = api("POST", "/git/commits", {"message": MESSAGE, "tree": tree["sha"], "parents": [main_sha]})
if not commit:
    print("Failed to create commit."); sys.exit(1)
print(f"  Commit SHA: {commit['sha'][:8]}")

# --- Step 9: Update/create messages branch ---
existing = api("GET", f"/git/refs/heads/{BRANCH}")
if existing and existing.get("object"):
    api("PATCH", f"/git/refs/heads/{BRANCH}", {"sha": commit["sha"], "force": True})
else:
    api("POST", "/git/refs", {"ref": f"refs/heads/{BRANCH}", "sha": commit["sha"]})
print(f"  '{BRANCH}' branch updated.")

# --- Step 10: Merge into main ---
print(f"\nMerging '{BRANCH}' into main...")
merge = api("POST", "/merges", {
    "base": "main",
    "head": BRANCH,
    "commit_message": f"Merge '{BRANCH}' into main: {MESSAGE}",
})
if merge is None:
    print("Merge failed or conflict — check GitHub."); sys.exit(1)
if merge.get("sha"):
    print(f"  Merged! Commit: {merge['sha'][:8]}")
elif merge.get("message") == "Already up to date.":
    print("  Already up to date.")

print(f"\nDone! https://github.com/{OWNER}/{REPO}")
print(f"Branch '{BRANCH}' pushed and merged into main.")
