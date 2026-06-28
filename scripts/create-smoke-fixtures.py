import json
import os
import time
import zipfile

OUTPUT_DIR = os.environ.get("FIXTURE_DIR", "smoke-fixtures")
os.makedirs(OUTPUT_DIR, exist_ok=True)
NOW = int(time.time())
BASE = "connections/followers_and_following/"


def following(name: str) -> dict:
    return {
        "title": name,
        "string_list_data": [
            {
                "href": f"https://www.instagram.com/{name}/",
                "value": name,
                "timestamp": NOW,
            }
        ],
    }


def follower(name: str) -> dict:
    return {
        "title": "",
        "media_list_data": [],
        "string_list_data": [
            {
                "href": f"https://www.instagram.com/{name}/",
                "value": name,
                "timestamp": NOW,
            }
        ],
    }


def write_zip(filename: str, following_names: list[str], follower_names: list[str]) -> None:
    filepath = os.path.join(OUTPUT_DIR, filename)
    with zipfile.ZipFile(filepath, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr(
            BASE + "following.json",
            json.dumps(
                {"relationships_following": [following(name) for name in following_names]},
                ensure_ascii=False,
            ),
        )
        archive.writestr(
            BASE + "followers_1.json",
            json.dumps([follower(name) for name in follower_names], ensure_ascii=False),
        )


write_zip("basic.zip", ["alpha", "delta"], ["alpha"])
write_zip("account-a.zip", ["shared_target", "account_a_only"], [])
write_zip("account-b.zip", ["shared_target", "account_b_only"], [])

# v13 snapshot comparison fixture:
# new following=erin, stopped following=bob, new followers=carol+frank,
# lost followers=bob+dave, newly mutual=carol, mutual ended=bob.
write_zip("compare-previous.zip", ["alice", "bob", "carol"], ["alice", "bob", "dave"])
write_zip("compare-current.zip", ["alice", "carol", "erin"], ["alice", "carol", "frank"])

# Generic Instagram filenames intentionally contain no account identifier. The
# relationship sets overlap enough for the privacy-preserving v13 sketch to
# recognize them as two snapshots of the same account.
write_zip("data-2026-06-01.zip", ["stable_one", "stable_two", "old_only"], ["stable_one", "stable_two", "follower_old"])
write_zip("data-2026-06-28.zip", ["stable_one", "stable_two", "new_only"], ["stable_one", "stable_two", "follower_new"])

progress = {
    "version": 12,
    "sourceName": "basic.zip",
    "progress": {
        "delta": {
            "username": "delta",
            "status": "done",
            "updatedAt": "2026-06-28T00:00:00.000Z",
        }
    },
    "settings": {
        "activeTab": "nonMutual",
        "sort": "recent",
        "status": "all",
        "hideDone": False,
        "dailyGoal": 50,
    },
}
with open(os.path.join(OUTPUT_DIR, "renamed-progress.txt"), "w", encoding="utf-8") as file:
    json.dump(progress, file, ensure_ascii=False)

# Playwright does not accept an in-memory upload buffer above 50MB. A sparse
# file exercises the browser-side 80MB preflight without writing 80MB of data.
oversized_path = os.path.join(OUTPUT_DIR, "oversized.zip")
with open(oversized_path, "wb") as file:
    file.truncate(80 * 1024 * 1024 + 1)

print(f"Created smoke fixtures in {OUTPUT_DIR}")
