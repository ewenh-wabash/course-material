#!/usr/bin/env python3
"""
syllabus_treemap.py

Turns a Markdown file's header hierarchy (#, ##, ###, ####, ... — any
depth) into a zoomable Plotly treemap titled "MUS 104 Syllabus",
complete with breadcrumb navigation above the chart.

Usage:
    python syllabus_treemap.py [path/to/syllabus.md] [-o output.html]

If no markdown file is given, a sample MUS 104 syllabus is generated
and used automatically.

How the hierarchy works:
    # Big Thing         -> top-level treemap cell
    ## Medium Thing      -> nested inside the nearest preceding "Big Thing"
    ### Small Thing       -> nested inside the nearest preceding "Medium Thing"
    #### Tiny Thing        -> nested inside the nearest preceding "Small Thing"
    (and so on — any number of #'s is supported, each nesting inside the
    nearest preceding header one level shallower)

Any body text under a header contributes to that header's "weight"
(word count), which controls cell size. Parent cells are sized as the
sum of their children, so bigger sections visually dominate.
"""

import argparse
import colorsys
import random
import re
import sys
import textwrap
from pathlib import Path

import plotly.graph_objects as go

TITLE = "MUS 104 Syllabus"

# ----------------------------------------------------------------------
# 1. Sample content (used only if the user doesn't supply a markdown file)
# ----------------------------------------------------------------------

SAMPLE_MARKDOWN = """\
# About Me
## Instructor Background
### Education
Ph.D. in Musicology, twelve years teaching undergraduate music history and theory courses.
### Office Hours
Tuesdays and Thursdays, 2-4pm, Music Building room 214, or by appointment.
### Contact Philosophy
Email is answered within 24 hours on weekdays. Drop-in visits are always welcome during office hours.
## Research Interests
### Twentieth Century Composition
Focus on American minimalism and its influence on film scoring.
### Ethnomusicology
Fieldwork on West African percussion traditions and their diaspora.

# About the Course
## Course Description
This course surveys Western art music from the Baroque period through the present day, with an emphasis on listening skills and historical context.
## Learning Objectives
### Critical Listening
Students will identify stylistic features of major periods by ear.
### Historical Context
Students will connect musical works to their social and political circumstances.
### Written Analysis
Students will produce clear, well-supported analytical writing about musical form.
## Required Materials
### Textbook
A History of Western Music, 10th edition, Grout and Palisca. A History of Western Music, 10th edition, Grout and Palisca. A History of Western Music, 10th edition, Grout and Palisca. A History of Western Music, 10th edition, Grout and Palisca. A History of Western Music, 10th edition, Grout and Palisca. A History of Western Music, 10th edition, Grout and Palisca. A History of Western Music, 10th edition, Grout and Palisca. A History of Western Music, 10th edition, Grout and Palisca. A History of Western Music, 10th edition, Grout and Palisca. A History of Western Music, 10th edition, Grout and Palisca. A History of Western Music, 10th edition, Grout and Palisca. A History of Western Music, 10th edition, Grout and Palisca. A History of Western Music, 10th edition, Grout and Palisca. A History of Western Music, 10th edition, Grout and Palisca. A History of Western Music, 10th edition, Grout and Palisca. A History of Western Music, 10th edition, Grout and Palisca. A History of Western Music, 10th edition, Grout and Palisca. A History of Western Music, 10th edition, Grout and Palisca. A History of Western Music, 10th edition, Grout and Palisca. A History of Western Music, 10th edition, Grout and Palisca.
#### Option1
#### Option2
#### Option3
Cool man
#### Option4
##### Option4a
##### Option4b
##### Option4c
##### Option4d
##### Option4e
##### Option4a
##### Option4a
##### Option4a
##### Option4a
### Listening App
Access to the course Spotify playlist, updated weekly.
# How to Succeed
## Study Strategies
### Active Listening Logs
Keep a weekly journal noting themes, instrumentation, and emotional response to assigned pieces.
### Study Groups
Form groups of three to four to quiz each other before exams using the provided flashcard sets.
## Getting Help
### Office Hours Use
Bring specific questions rather than general confusion; it leads to more productive conversations.
### Tutoring Center
Free peer tutoring is available through the Music Department front desk.
## Common Pitfalls
### Cramming Listening
Listening exams reward familiarity built over weeks, not the night before.
### Skipping Readings
Lecture assumes you have completed the reading; skipping it makes lecture much harder to follow.

# Attendance
## Policy
### Allowed Absences
Two unexcused absences are permitted with no penalty.
### Excused Absences
Documented illness, religious observance, and university-sanctioned travel are always excused.
## Participation
### Discussion Credit
Short in-class discussions are worth a small participation grade each week.
### Listening Quizzes
Unannounced five-minute listening quizzes occur roughly six times per semester and cannot be made up if absent.

# Due Dates
## Major Assignments
### Midterm Essay
Due October 14th, a five page analysis of a piece from the Classical period.
### Final Paper
Due December 9th, a ten page research paper on a topic of the student's choosing.
### Listening Portfolio
Due December 2nd, a compiled journal of all weekly listening logs.
## Exams
### Midterm Exam
October 21st, covering material through the Classical period.
### Final Exam
During finals week, cumulative with an emphasis on the second half of the course.
## Weekly Deadlines
### Reading Responses
Due each Monday at 9am via the course portal.
### Listening Logs
Due each Friday at midnight via the course portal.
"""

HEADER_RE = re.compile(r"^(#{1,})\s+(.*\S)\s*$")

# ----------------------------------------------------------------------
# 2. Markdown -> hierarchy
# ----------------------------------------------------------------------


class Node:
    __slots__ = ("id", "label", "parent_id", "level", "words", "children",
                 "body_lines")

    def __init__(self, node_id, label, parent_id, level):
        self.id = node_id
        self.label = label
        self.parent_id = parent_id
        self.level = level
        self.words = 0  # body word count directly under this header
        self.children = []
        self.body_lines = [
        ]  # raw text lines that sit directly under this header


def parse_markdown(text):
    """Parse #, ##, ###, ####, ... headers (any depth) into a Node hierarchy."""
    nodes = {}
    order = []  # preserves insertion order for stable output
    stack = []  # currently open (level, node_id) chain
    counters = {}  # de-duplicate repeated header labels

    def make_id(label):
        counters[label] = counters.get(label, 0) + 1
        return f"{label}__{counters[label]}" if counters[label] > 1 else label

    current = None  # node currently receiving body text

    for raw_line in text.splitlines():
        line = raw_line.rstrip()
        match = HEADER_RE.match(line)
        if match:
            hashes, label = match.groups()
            level = len(hashes)

            # Pop the stack back to the correct parent depth
            while stack and stack[-1][0] >= level:
                stack.pop()
            parent_id = stack[-1][1] if stack else None

            node_id = make_id(label)
            node = Node(node_id, label, parent_id, level)
            nodes[node_id] = node
            order.append(node_id)
            if parent_id is not None:
                nodes[parent_id].children.append(node_id)

            stack.append((level, node_id))
            current = node
        else:
            stripped = line.strip()
            if stripped and current is not None:
                current.words += len(stripped.split())
                current.body_lines.append(stripped)

    return nodes, order


# ----------------------------------------------------------------------
# 3. Sizing: leaves get their own word count (min 1), parents sum children.
#
# A header's own body text (e.g. intro prose directly under "### Textbook"
# before its "#### Option" subheaders) does NOT add to that header's size
# once it has children. Plotly's treemap can't overlay text on top of a
# box that's fully tiled by child cells — a cell's interior is either a
# single leaf showing its own text, or fully covered by children showing
# theirs, never both. So a header's own body text becomes an invisible
# "blend-in" leaf (see build_figure): same color as its parent, no title
# of its own, styled so it doesn't read as a separate box, but a real
# leaf under the hood so its text actually has somewhere to render.
# ----------------------------------------------------------------------


def compute_values(nodes, order):
    values = {}

    def value_of(node_id):
        if node_id in values:
            return values[node_id]
        node = nodes[node_id]
        if not node.children:
            v = max(node.words, 1)
        else:
            v = sum(value_of(c) for c in node.children) + node.words
        values[node_id] = v
        return v

    for node_id in order:
        value_of(node_id)
    return values


# ----------------------------------------------------------------------
# 4. Colors: random hue per node, fixed saturation & brightness (value)
# ----------------------------------------------------------------------


def random_hue_colors(node_ids, saturation=0.55, brightness=0.92, seed=None):
    rng = random.Random(seed)
    colors = {}
    for node_id in node_ids:
        hue = rng.random()  # 0.0 - 1.0
        r, g, b = colorsys.hsv_to_rgb(hue, saturation, brightness)
        colors[node_id] = f"rgb({int(r*255)},{int(g*255)},{int(b*255)})"
    return colors


# ----------------------------------------------------------------------
# 5. Build the Plotly treemap
# ----------------------------------------------------------------------


def wrap_body(body, width=42):
    """Wrap body text to a fixed character width, using <br> for Plotly."""
    if not body:
        return ""
    return "<br>".join(textwrap.wrap(body, width=width))


def build_figure(nodes, order, seed=None, maxdepth=2):
    values = compute_values(nodes, order)
    colors = random_hue_colors(order, seed=seed)
    root_color = "rgb(235,235,235)"

    # Build the treemap's flat arrays. A header that has BOTH subheaders
    # and its own body text needs a "blend-in" leaf for that text: a real
    # leaf cell (so the text has somewhere to render) with no label, the
    # same fill color as its parent, and a border that matches the fill
    # so it doesn't read as its own box — it just looks like body copy
    # sitting inside the parent's cell, alongside its other children.
    ids = ["root"]
    labels = [TITLE]
    parents = [""]
    vals = [sum(values[n] for n in order if nodes[n].parent_id is None)]
    marker_colors = [root_color]
    line_colors = ["white"]
    bodies = [""]

    for node_id in order:
        node = nodes[node_id]
        own_body = " ".join(node.body_lines).strip()
        has_own_text_and_children = bool(node.children) and node.words > 0

        ids.append(node_id)
        labels.append(node.label)
        parents.append(node.parent_id or "root")
        marker_colors.append(colors[node_id])
        line_colors.append("white")
        vals.append(values[node_id])
        bodies.append("" if has_own_text_and_children else own_body)

        if has_own_text_and_children:
            ids.append(f"{node_id}::text")
            labels.append("")  # no title — just reads as body copy
            parents.append(node_id)
            marker_colors.append(colors[node_id])  # same fill as parent
            line_colors.append(
                colors[node_id])  # border matches fill: invisible
            vals.append(node.words)
            bodies.append(own_body)

    display_text = [wrap_body(b) for b in bodies]
    # Cell text: bold label, then the body text (smaller) on the following
    # line(s), so the label stays the dominant visual element in each box.
    cell_text = [
        f'<br><span style="font-size:12px">{t}</span>' if t else ""
        for t in display_text
    ]
    # Hover text: label, full (unwrapped) body text, then the sizing weight.
    hover_text = [
        label + (f"<br>{body}" if body else "") + f"<br><i>Weight: {value}</i>"
        for label, body, value in zip(labels, bodies, vals)
    ]

    fig = go.Figure(
        go.Treemap(
            ids=ids,
            labels=labels,
            parents=parents,
            values=vals,
            branchvalues="total",
            maxdepth=maxdepth,
            marker=dict(colors=marker_colors,
                        line=dict(width=1, color=line_colors)),
            text=cell_text,
            texttemplate="<b>%{label}</b>%{text}",
            textposition="middle center",
            textfont=dict(size=20),
            insidetextfont=dict(size=20),
            root_color=root_color,
            # Breadcrumb navigation above the treemap:
            pathbar=dict(visible=True,
                         thickness=26,
                         side="top",
                         edgeshape=">",
                         textfont=dict(size=13)),
            tiling=dict(pad=3),
            hoverinfo="skip",
        ))

    fig.update_layout(
        title=dict(text=TITLE, x=0.5, xanchor="center", font=dict(size=26)),
        margin=dict(t=70, l=10, r=10, b=10),
        font=dict(family="Helvetica, Arial, sans-serif"),
    )
    return fig


# ----------------------------------------------------------------------
# 6. CLI entry point
# ----------------------------------------------------------------------


def main():
    parser = argparse.ArgumentParser(
        description="Render a markdown syllabus as a zoomable treemap.")
    parser.add_argument(
        "markdown_file",
        nargs="?",
        default=None,
        help="Path to a markdown file using #, ##, ### headers. "
        "Defaults to a built-in sample MUS 104 syllabus.")
    parser.add_argument("-o",
                        "--output",
                        default="mus104_treemap.html",
                        help="Output HTML file (default: mus104_treemap.html)")
    parser.add_argument("--seed",
                        type=int,
                        default=None,
                        help="Random seed for reproducible hue assignment.")
    parser.add_argument(
        "--maxdepth",
        type=int,
        default=2,
        help="Number of hierarchy levels visible at once before you need "
        "to click into a cell to see deeper levels (default: 3). "
        "Use -1 to show every level at once, though very deep "
        "syllabi can get crowded.")
    args = parser.parse_args()

    if args.markdown_file:
        path = Path(args.markdown_file)
        if not path.exists():
            sys.exit(f"File not found: {path}")
        text = path.read_text(encoding="utf-8")
    else:
        print(
            "No markdown file given — using the built-in sample MUS 104 syllabus."
        )
        text = SAMPLE_MARKDOWN

    nodes, order = parse_markdown(text)
    if not order:
        sys.exit("No markdown headers (#, ##, ###, ...) found in the file.")

    fig = build_figure(nodes, order, seed=args.seed, maxdepth=args.maxdepth)
    fig.write_html(args.output, include_plotlyjs="cdn")
    print(f"Treemap written to {args.output}")

    # Uncomment to open interactively when running locally:
    # fig.show()


if __name__ == "__main__":
    main()