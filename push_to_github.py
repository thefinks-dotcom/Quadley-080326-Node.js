#!/usr/bin/env python3
"""
Push current Replit code to GitHub.
Usage: python3 push_to_github.py "your commit message" [branch]
"""
import subprocess, requests, base64, os, sys, time

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

def api(method, path, data=None, retries=3):
    url = BASE + path
    for attempt in range(retries):
        r = requests.request(method, url, headers=HEADS, json=data, timeout=60)
        if r.status_code == 403 and "rate limit" in r.text.lower():
            wait = 20 * (attempt + 1)
            print(f"  Rate limited, waiting {wait}s...")
            time.sleep(wait)
            continue
        if r.status_code >= 400:
            print(f"  API error {r.status_code} {path}: {r.text[:200]}", file=sys.stderr)
            return None
        return r.json()
    return None

# --- Step 1: Get main HEAD SHA (used as parent for our commit) ---
print(f"Getting current GitHub HEAD on main...")
main_ref = api("GET", "/git/refs/heads/main")
if not main_ref:
    print("Could not find main branch."); sys.exit(1)
main_sha = main_ref["object"]["sha"]
print(f"  main HEAD: {main_sha[:8]}")

# --- Step 2: Build tree from all git-tracked files ---
SKIP_PREFIXES = (
    "frontend-next/.next/",
    "frontend/build/",
    "node_modules/",
    "mobile/node_modules/",
    "frontend-next/node_modules/",
    "frontend/node_modules/",
)
SKIP_EXTENSIONS = (".pack.gz", ".pack", ".pyc")

tracked = subprocess.check_output(["git", "ls-files"]).decode().strip().split("\n")
untracked = subprocess.check_output(["git", "ls-files", "--others", "--exclude-standard"]).decode().strip().split("\n")
files = list(set(tracked + untracked))
files = [
    f for f in files
    if f
    and not any(f.startswith(p) for p in SKIP_PREFIXES)
    and not any(f.endswith(e) for e in SKIP_EXTENSIONS)
]
print(f"Building tree for {len(files)} files...")

tree_items = []
binary_files = []

for path in files:
    if not os.path.exists(path):
        continue
    with open(path, "rb") as f:
        content = f.read()
    try:
        text = content.decode("utf-8")
        tree_items.append({"path": path, "mode": "100644", "type": "blob", "content": text})
    except UnicodeDecodeError:
        binary_files.append((path, content))

print(f"  {len(tree_items)} text files, {len(binary_files)} binary files")

# Create blobs for binary files
for path, content in binary_files:
    print(f"  Binary: {path}")
    blob = api("POST", "/git/blobs", {"encoding": "base64", "content": base64.b64encode(content).decode()})
    if blob:
        tree_items.append({"path": path, "mode": "100644", "type": "blob", "sha": blob["sha"]})
    time.sleep(1)

# --- Step 3: Create tree ---
print("Creating tree...")
tree = api("POST", "/git/trees", {"base_tree": main_sha, "tree": tree_items})
if not tree:
    print("Failed to create tree."); sys.exit(1)

# --- Step 4: Create commit ---
print(f"Creating commit: \"{MESSAGE}\"")
commit_data = {"message": MESSAGE, "tree": tree["sha"], "parents": [main_sha]}
commit = api("POST", "/git/commits", commit_data)
if not commit:
    print("Failed to create commit."); sys.exit(1)
print(f"  Commit SHA: {commit['sha'][:8]}")

# --- Step 5: Create or update messages branch ---
print(f"Checking if '{BRANCH}' branch exists...")
existing = api("GET", f"/git/refs/heads/{BRANCH}")

if existing:
    print(f"  Updating existing '{BRANCH}' branch...")
    ref = api("PATCH", f"/git/refs/heads/{BRANCH}", {"sha": commit["sha"], "force": True})
else:
    print(f"  Creating new '{BRANCH}' branch...")
    ref = api("POST", "/git/refs", {"ref": f"refs/heads/{BRANCH}", "sha": commit["sha"]})

if not ref:
    print(f"Failed to update/create '{BRANCH}' branch."); sys.exit(1)
print(f"  '{BRANCH}' branch updated.")

# --- Step 6: Merge messages into main ---
print(f"\nMerging '{BRANCH}' into main...")
merge = api("POST", "/merges", {
    "base": "main",
    "head": BRANCH,
    "commit_message": f"Merge '{BRANCH}' into main: {MESSAGE}"
})

if merge is None:
    print("Merge failed or conflict detected — check GitHub for details.")
    sys.exit(1)

if merge.get("sha"):
    print(f"  Merged! Commit: {merge['sha'][:8]}")
elif merge.get("message") == "Already up to date.":
    print("  Already up to date.")

print(f"\nDone! https://github.com/{OWNER}/{REPO}")
print(f"Branch '{BRANCH}' pushed and merged into main.")
