from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Preformatted
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.pagesizes import A4
import json
import sys

data = json.loads(sys.stdin.read())

doc = SimpleDocTemplate("report.pdf", pagesize=A4)
styles = getSampleStyleSheet()
story = []

def title(text):
    story.append(Paragraph(f"<b>{text}</b>", styles["Heading2"]))
    story.append(Spacer(1, 12))

def normal(text):
    story.append(Paragraph(text, styles["Normal"]))
    story.append(Spacer(1, 8))

def code(text):
    story.append(Preformatted(text, styles["Code"]))
    story.append(Spacer(1, 10))

title("BUG HUNT – USER REPORT")

u = data["user"]
normal(f"Name: {u['name']}")
normal(f"Email: {u['email']}")
normal(f"College: {u['college']}")
normal(f"Language: {u['language']}")
normal(f"Score: {data['score']}")
normal(f"Time Taken: {data['timeTaken']} seconds")

if data["isDisqualified"]:
    normal(f"<b>Status:</b> DISQUALIFIED – {data['reason']}")

story.append(Spacer(1, 20))

for q in data["questions"]:
    title(f"Question {q['questionCode']}")
    normal(q["problemStatement"])

    title("Buggy Code")
    code(q["buggyCode"])

    title("Attempts")
    for a in q["attempts"]:
        normal(f"Attempt {a['attemptNo']} – {a['verdict']}")
        code(a["code"])

doc.build(story)
