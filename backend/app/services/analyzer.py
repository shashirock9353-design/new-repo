import json
import re
from io import BytesIO
from pathlib import Path
from typing import Any, Dict, List

from docx import Document
from pypdf import PdfReader
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from ..config import DATA_DIR

with open(DATA_DIR / "skill_aliases.json", "r", encoding="utf-8") as handle:
    SKILL_ALIASES = json.load(handle)

with open(DATA_DIR / "course_catalog.json", "r", encoding="utf-8") as handle:
    COURSE_CATALOG = json.load(handle)

DEFAULT_JOB_SKILLS = [
    "Python",
    "SQL",
    "Machine Learning",
    "Communication",
    "Statistics",
    "Problem Solving",
    "Data Visualization",
    "Project Management",
]


def normalize_skill_name(skill: str) -> str:
    if not skill:
        return ""
    cleaned = skill.strip().lower()
    cleaned = re.sub(r"[^a-z0-9\s+\-]", "", cleaned)
    if cleaned in SKILL_ALIASES:
        return SKILL_ALIASES[cleaned]
    for alias, canonical in SKILL_ALIASES.items():
        if alias in cleaned or cleaned in alias:
            return canonical
    return cleaned.title()


def clean_text(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def extract_document_text(file_path: str) -> str:
    path = Path(file_path)
    if path.suffix.lower() == ".pdf":
        reader = PdfReader(str(path))
        pages = []
        for page in reader.pages:
            pages.append(page.extract_text() or "")
        return "\n".join(pages)
    if path.suffix.lower() == ".docx":
        doc = Document(str(path))
        return "\n".join(paragraph.text for paragraph in doc.paragraphs if paragraph.text.strip())
    return ""


def extract_name(text: str) -> str:
    match = re.search(r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)", text or "")
    return match.group(1) if match else "Candidate"


def extract_email(text: str) -> str:
    match = re.search(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", text or "")
    return match.group(0) if match else ""


def extract_education(text: str) -> List[str]:
    patterns = [
        r"B\.?Sc(?:\.)?|Bachelor(?:'s)?|B\.Tech|BE|Master(?:'s)?|M\.?Sc(?:\.)?|M\.Tech|MBA|PhD",
        r"Computer Science|Information Technology|Engineering|Statistics|Data Science",
    ]
    findings = []
    for pattern in patterns:
        for match in re.finditer(pattern, text or "", flags=re.IGNORECASE):
            value = match.group(0).strip()
            if value and value not in findings:
                findings.append(value)
    return findings


def extract_experience(text: str) -> str:
    matches = re.findall(r"(\d+(?:\.\d+)?)\s*(?:years?|yrs?)\s*(?:of\s*)?(?:experience)?", text or "", flags=re.IGNORECASE)
    if matches:
        return f"{max(float(m[0]) for m in matches):.0f} years"
    return "Not specified"


def extract_skills_from_text(text: str) -> List[str]:
    normalized = (text or "").lower()
    found = []
    for key, value in SKILL_ALIASES.items():
        if key in normalized and value not in found:
            found.append(value)

    if not found:
        tokens = re.findall(r"[A-Za-z][A-Za-z0-9+\./\- ]{2,}", text or "")
        for token in tokens:
            candidate = token.strip()
            if len(candidate) > 3 and candidate.lower() not in {"with", "from", "using", "skills"}:
                found.append(candidate.title())
    return found


def find_skill_matches(candidate_skills: List[str], required_skills: List[str]) -> List[Dict[str, Any]]:
    candidate_items = [str(item).strip() for item in candidate_skills if item and str(item).strip()]
    required_items = [str(item).strip() for item in required_skills if item and str(item).strip()]
    if not candidate_items:
        candidate_items = ["Python"]
    if not required_items:
        required_items = DEFAULT_JOB_SKILLS

    texts = candidate_items + required_items
    vectorizer = TfidfVectorizer(stop_words=None)
    matrix = vectorizer.fit_transform(texts)
    candidate_matrix = matrix[: len(candidate_items)]
    required_matrix = matrix[len(candidate_items) :]
    similarities = cosine_similarity(required_matrix, candidate_matrix)

    results = []
    for idx, required in enumerate(required_items):
        best_candidate = ""
        best_score = 0.0
        for candidate_idx, candidate in enumerate(candidate_items):
            score = float(similarities[idx, candidate_idx])
            if score > best_score:
                best_score = score
                best_candidate = candidate

        if best_score >= 0.8:
            status = "Matched"
        elif best_score >= 0.5:
            status = "Partial"
        else:
            status = "Missing"

        explanation = (
            f"{required} aligns best with {best_candidate} at {best_score * 100:.0f}% similarity."
            if best_candidate
            else f"No matching skill found for {required}."
        )
        results.append(
            {
                "skill": required,
                "candidate_skill": best_candidate,
                "score": round(best_score, 2),
                "status": status,
                "explanation": explanation,
            }
        )
    return results


def recommend_courses(skills: List[str]) -> List[Dict[str, Any]]:
    recommendations = []
    requested = [str(skill).strip() for skill in skills if skill and str(skill).strip()]
    for skill in requested:
        for course in COURSE_CATALOG:
            if skill.lower() in course["skill"].lower() or course["skill"].lower() in skill.lower():
                recommendations.append(
                    {
                        "skill": skill,
                        "title": course["title"],
                        "provider": course["provider"],
                        "difficulty": course["difficulty"],
                        "duration": course["duration"],
                        "url": course["url"],
                    }
                )
    return recommendations[:10]


def build_learning_roadmap(skills: List[str]) -> List[Dict[str, Any]]:
    roadmap = []
    skills_list = [skill for skill in skills if skill][:4]
    for index, skill in enumerate(skills_list, start=1):
        roadmap.append(
            {
                "week": f"Week {index}",
                "tasks": [
                    f"Learn the fundamentals of {skill}.",
                    f"Practice a real-world {skill} project.",
                    f"Review key metrics and validate your understanding of {skill}.",
                ],
            }
        )

    if not roadmap:
        roadmap.append(
            {
                "week": "Week 1",
                "tasks": [
                    "Review your current skill profile and set measurable learning goals.",
                    "Prioritize the highest-value gap areas for the next sprint.",
                    "Start with one practical project aligned to your target role.",
                ],
            }
        )
    return roadmap


def generate_pdf_report(report: Dict[str, Any]) -> bytes:
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    styles = getSampleStyleSheet()
    story = []
    story.append(Paragraph("AI Skill-to-Job Gap Analyzer Report", styles["Title"]))
    story.append(Spacer(1, 12))
    story.append(Paragraph(f"Candidate: {report.get('candidate_name', 'N/A')}", styles["BodyText"]))
    story.append(Paragraph(f"Job title: {report.get('job_title', 'N/A')}", styles["BodyText"]))
    story.append(Paragraph(f"Company: {report.get('company_name', 'N/A')}", styles["BodyText"]))
    story.append(Paragraph(f"Match percentage: {report.get('match_percentage', 0):.1f}%", styles["BodyText"]))
    story.append(Paragraph(f"Gap percentage: {report.get('gap_percentage', 0):.1f}%", styles["BodyText"]))
    story.append(Spacer(1, 10))

    rows = [["Skill", "Status", "Similarity"]]
    for item in report.get("skill_matches", []):
        rows.append([item.get("skill", "-"), item.get("status", "-"), f"{(item.get('score', 0) * 100):.0f}%"])

    table = Table(rows)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("GRID", (0, 0), (-1, -1), 1, colors.grey),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.whitesmoke, colors.white]),
            ]
        )
    )
    story.append(table)
    doc.build(story)
    return buffer.getvalue()
