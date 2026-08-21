#!/usr/bin/env python3
"""
Pull assignments, quizzes, and due dates from a Canvas LMS course.
Prints the result as JSON.

Setup: pip install requests
Then fill in the three values below.
"""

import json
import requests

# ---- Fill these in ----------------------------------------------------
CANVAS_URL = "https://wabash.instructure.com"
API_TOKEN = "1~Q2TDxTncaTPzKvtPeBcR37GmrzfCKJNFfaH2ERkvHTTu6AwFufhEzm9ULPWLwWK8"
COURSE_ID = "8208566"

# -------------------------------------------------------------------


def get_paginated(session, url):
    results = []
    params = {"per_page": 100}
    while url:
        resp = session.get(url, params=params)
        resp.raise_for_status()
        results.extend(resp.json())
        params = None  # 'next' url already includes params
        url = resp.links.get("next", {}).get("url")
    return results


def main():
    session = requests.Session()
    session.headers.update({"Authorization": f"Bearer {API_TOKEN}"})
    base = CANVAS_URL.rstrip("/")

    course_name = session.get(f"{base}/api/v1/courses/{COURSE_ID}").json().get(
        "name")

    assignments = get_paginated(
        session, f"{base}/api/v1/courses/{COURSE_ID}/assignments")
    quizzes = get_paginated(session,
                            f"{base}/api/v1/courses/{COURSE_ID}/quizzes")

    items = []
    for a in assignments:
        print(a)
        items.append({
            "type": "quiz" if a.get("is_quiz_assignment") else "assignment",
            "name": a.get("name"),
            "due_at": a.get("due_at"),
            "points_possible": a.get("points_possible"),
            "html_url": a.get("html_url"),
        })
    for q in quizzes:
        items.append({
            "type": "quiz",
            "name": q.get("title"),
            "due_at": q.get("due_at"),
            "points_possible": q.get("points_possible"),
            "html_url": q.get("html_url"),
        })

    # dedupe quizzes that show up in both endpoints
    seen = set()
    deduped = []
    for item in items:
        key = (item["name"], item["due_at"])
        if key not in seen:
            seen.add(key)
            deduped.append(item)

    deduped.sort(key=lambda x: (x["due_at"] is None, x["due_at"] or ""))

    print(json.dumps({"course": course_name, "items": deduped}, indent=2))


if __name__ == "__main__":
    main()