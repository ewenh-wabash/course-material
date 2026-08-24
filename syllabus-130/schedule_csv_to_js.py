#!/usr/bin/env python3
"""
csv_to_js.py

Reads a schedule CSV and writes out a JS file that declares a single
variable (SCHEDULE_DATA) containing an array of week objects, ready to be
loaded with a <script src="schedule-data.js"></script> tag and consumed by
your HTML page.

Column mapping (0-indexed):
    A (0) -> 4th Hour?   TRUE/FALSE -> controls "week-card-accent" class
    B (1) -> Date
    C (2) -> Title
    D (3) -> Description
    E (4) -> To do before class   (split on commas)
    F (5) -> To do during class   (split on commas)
    G (6) -> To do                (split on commas, only used when 4th hour)

Rows with no date are treated as blank/unused rows and skipped.

>>> HARD-CODED PATH — change this to point at a different schedule file <<<
"""

import csv
import json
import re

CSV_PATH = "schedule.csv"  # <-- change this to your CSV's location
JS_OUTPUT_PATH = "schedule.js"  # <-- change this to where you want the JS file written
JS_VARIABLE_NAME = "SCHEDULE_DATA"

# Matches a URL starting with http:// or https://, stopping at whitespace
# or a closing paren/bracket (so "(see this: https://x.com)" doesn't eat
# the trailing ")").
URL_RE = re.compile(r"https?://[^\s()\[\]]+")


def is_truthy(value: str) -> bool:
    return value.strip().upper() == "TRUE"


def extract_link(text: str):
    """
    Look for a URL anywhere in `text`. If found, strip it out and return
    (clean_text, url). If no URL is found, return (text, None).

    If the URL sits inside a parenthetical — "(https://x.com)" or
    "(see https://x.com)" — the whole parenthetical is dropped rather than
    just the URL, so filler words like "see"/"on" don't get left behind
    wrapped in now-empty parens.
    """
    text = text.strip()

    paren_match = re.search(r"\(([^()]*)\)", text)
    paren_url_match = URL_RE.search(
        paren_match.group(1)) if paren_match else None

    if paren_match and paren_url_match:
        url = paren_url_match.group(0).rstrip(".,;:!?")
        remainder = text[:paren_match.start()] + text[paren_match.end():]
    else:
        match = URL_RE.search(text)
        if not match:
            return text, None
        url = match.group(0).rstrip(
            ".,;:!?")  # drop trailing punctuation, not part of the URL
        remainder = text[:match.start()] + text[match.start() + len(url):]

    remainder = re.sub(r"\[\s*\]", "",
                       remainder)  # drop now-empty [] wrapping, if any
    remainder = re.sub(r"\s{2,}", " ", remainder)
    remainder = remainder.strip(" \t-:|")

    return remainder, url


def split_list(value: str):
    """
    Split a cell on commas into a clean list of items. Each item is a dict
    of the form {"text": ..., "url": ... or None}: if the item contained a
    link, the link is pulled out of the text and stored separately so it
    can be rendered as a proper <a> tag instead of inline text.
    """
    if not value or not value.strip():
        return []

    items = []
    for part in value.split(","):
        part = part.strip()
        if not part:
            continue
        text, url = extract_link(part)
        if not text:
            # The whole item was just a bare URL — fall back to the URL
            # itself as the link text so we don't end up with an empty label.
            text = url
        items.append({"text": text, "url": url})
    return items


def parse_csv(csv_path):
    weeks = []

    with open(csv_path, newline="", encoding="utf-8-sig") as f:
        reader = csv.reader(f)
        header = next(reader, None)  # skip header row

        for row in reader:
            # Pad short rows so index access never blows up
            row = row + [""] * (7 - len(row)) if len(row) < 7 else row

            fourth_hour_raw = row[0]
            date = row[1].strip()
            title = row[2].strip()
            description = row[3].strip()
            todo_before = row[4]
            todo_during = row[5]
            todo_general = row[6]

            # Skip rows that don't represent a real week entry
            if not date:
                continue

            fourth_hour = is_truthy(fourth_hour_raw)

            week = {
                "fourthHour": fourth_hour,
                "date": date,
                "title": title,
                "description": description,
                "todoBeforeClass": split_list(todo_before),
                "todoDuringClass": split_list(todo_during),
                # "todo" is only meaningful for 4th-hour rows, but we still
                # populate it whenever column G has content.
                "todo": split_list(todo_general),
                "cardClass":
                "week-card-accent" if fourth_hour else "week-card",
            }
            if week['title'].lower().startswith("no class"):
                week['cardClass'] = "week-card-no-class"

            weeks.append(week)

    return weeks


def write_js(weeks, js_output_path, variable_name):
    json_data = json.dumps(weeks, indent=2, ensure_ascii=False)

    js_content = (f"// Auto-generated from {CSV_PATH} — do not edit by hand.\n"
                  f"// Regenerate with csv_to_js.py after updating the CSV.\n"
                  f"const {variable_name} = {json_data};\n")

    with open(js_output_path, "w", encoding="utf-8") as f:
        f.write(js_content)


def main():
    weeks = parse_csv(CSV_PATH)
    write_js(weeks, JS_OUTPUT_PATH, JS_VARIABLE_NAME)
    print(f"Wrote {len(weeks)} week entries to {JS_OUTPUT_PATH}")


if __name__ == "__main__":
    main()