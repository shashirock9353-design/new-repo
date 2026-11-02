from __future__ import annotations

import os
import uuid
from pathlib import Path
from typing import Annotated, Any, Dict, List, Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from .config import BASE_DIR
from .database import AnalysisRecord, SessionLocal
from .services.analyzer import (
    DEFAULT_JOB_SKILLS,
    build_learning_roadmap,
    extract_document_text,
    extract_email,
    extract_education,
    extract_experience,
    extract_name,
    extract_skills_from_text,
    find_skill_matches,
    generate_pdf_report,
    recommend_courses,
)

app = FastAPI(title="AI Skill-to-Job Gap Analyzer")
allowed_origins = [
    origin.strip()
    for origin in os.environ.get("CORS_ORIGINS", "*").split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def healthcheck() -> Dict[str, str]:
    return {"status": "ok", "service": "skill-gap-analyzer"}


@app.get("/api/history")
def get_history() -> List[Dict[str, Any]]:
    db = SessionLocal()
    records = db.query(AnalysisRecord).order_by(AnalysisRecord.created_at.desc()).all()
    history = []
    for record in records:
        history.append(
            {
                "id": record.id,
                "candidate_name": record.candidate_name,
                "job_title": record.job_title,
                "company_name": record.company_name,
                "match_score": record.match_score,
                "gap_score": record.gap_score,
                "created_at": record.created_at.isoformat(),
            }
        )
    db.close()
    return history


@app.post("/api/analyze")
async def analyze_resume(
    job_title: Annotated[str, Form()] = "",
    company_name: Annotated[str, Form()] = "",
    job_description: Annotated[str, Form()] = "",
    manual_skills: Annotated[str, Form()] = "",
    resume_file: Annotated[Optional[UploadFile], File()] = None,
    job_file: Annotated[Optional[UploadFile], File()] = None,
):
    if not resume_file:
        raise HTTPException(status_code=400, detail="Upload a resume PDF or DOCX before analyzing.")
    if not job_description.strip() and not job_file:
        raise HTTPException(status_code=400, detail="Upload a job description or paste its text before analyzing.")

    for uploaded_file, label in ((resume_file, "Resume"), (job_file, "Job description")):
        if uploaded_file and Path(uploaded_file.filename or "").suffix.lower() not in {".pdf", ".docx"}:
            raise HTTPException(status_code=400, detail=f"{label} must be a PDF or DOCX file.")

    temp_files: List[str] = []
    resume_text = ""
    if resume_file:
        file_name = f"resume_{uuid.uuid4()}{Path(resume_file.filename or '').suffix.lower()}"
        upload_path = BASE_DIR / "temp" / file_name
        upload_path.parent.mkdir(exist_ok=True, parents=True)
        with upload_path.open("wb") as handle:
            handle.write(await resume_file.read())
        temp_files.append(str(upload_path))
        try:
            resume_text = extract_document_text(str(upload_path))
        except Exception as error:
            for temp_file in temp_files:
                try:
                    os.remove(temp_file)
                except FileNotFoundError:
                    pass
            raise HTTPException(status_code=400, detail="The resume file could not be read. Please check that it is a valid PDF or DOCX.") from error
        if not resume_text.strip():
            for temp_file in temp_files:
                try:
                    os.remove(temp_file)
                except FileNotFoundError:
                    pass
            raise HTTPException(status_code=400, detail="No readable text was found in the resume. Scanned/image-only PDFs are not supported; try a text-based PDF or DOCX.")

    job_text = job_description
    if job_file:
        file_name = f"job_{uuid.uuid4()}{Path(job_file.filename or '').suffix.lower()}"
        upload_path = BASE_DIR / "temp" / file_name
        upload_path.parent.mkdir(exist_ok=True, parents=True)
        with upload_path.open("wb") as handle:
            handle.write(await job_file.read())
        temp_files.append(str(upload_path))
        try:
            job_text = extract_document_text(str(upload_path))
        except Exception as error:
            for temp_file in temp_files:
                try:
                    os.remove(temp_file)
                except FileNotFoundError:
                    pass
            raise HTTPException(status_code=400, detail="The job description file could not be read. Please check that it is a valid PDF or DOCX.") from error
        if not job_text.strip():
            for temp_file in temp_files:
                try:
                    os.remove(temp_file)
                except FileNotFoundError:
                    pass
            raise HTTPException(status_code=400, detail="No readable text was found in the job description. Scanned/image-only PDFs are not supported; try a text-based PDF or DOCX.")

    if job_text:
        job_text = job_text
    else:
        job_text = " ".join(DEFAULT_JOB_SKILLS)

    extracted_name = extract_name(resume_text)
    email = extract_email(resume_text)
    education = extract_education(resume_text)
    experience = extract_experience(resume_text)
    candidate_skills = extract_skills_from_text(resume_text)
    manual_list = [skill.strip() for skill in manual_skills.split(",") if skill.strip()]
    candidate_skills.extend(skill for skill in manual_list if skill not in candidate_skills)

    required_skills = extract_skills_from_text(job_text or " ".join(DEFAULT_JOB_SKILLS))
    if not required_skills:
        required_skills = DEFAULT_JOB_SKILLS

    matches = find_skill_matches(candidate_skills or ["Python"], required_skills)
    matched = [item for item in matches if item["status"] == "Matched"]
    partial = [item for item in matches if item["status"] == "Partial"]
    missing = [item for item in matches if item["status"] == "Missing"]
    gap_score = ((len(missing) + 0.5 * len(partial)) / max(len(required_skills), 1)) * 100
    match_score = max(0, 100 - gap_score)
    recommendations = []
    for skill in [item["skill"] for item in missing + partial]:
        recommendations.extend(recommend_courses([skill]))
    roadmap = build_learning_roadmap([item["skill"] for item in missing + partial])

    analysis = {
        "id": None,
        "candidate_name": extracted_name,
        "email": email,
        "education": education,
        "experience": experience,
        "job_title": job_title or "AI Engineer",
        "company_name": company_name or "Target Company",
        "match_percentage": round(match_score, 2),
        "gap_percentage": round(gap_score, 2),
        "skills": {
            "candidate": candidate_skills,
            "required": required_skills,
        },
        "skill_matches": matches,
        "matched": matched,
        "partial": partial,
        "missing": missing,
        "recommendations": recommendations,
        "roadmap": roadmap,
    }

    db = SessionLocal()
    record = AnalysisRecord(
        candidate_name=analysis["candidate_name"],
        job_title=analysis["job_title"],
        company_name=analysis["company_name"],
        match_score=analysis["match_percentage"],
        gap_score=analysis["gap_percentage"],
        data=analysis,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    analysis["id"] = record.id
    db.close()

    for temp_file in temp_files:
        try:
            os.remove(temp_file)
        except FileNotFoundError:
            pass

    return {"analysis": analysis}


@app.get("/api/report/{record_id}")
def download_report(record_id: int):
    db = SessionLocal()
    record = db.query(AnalysisRecord).filter(AnalysisRecord.id == record_id).first()
    db.close()
    if not record:
        raise HTTPException(status_code=404, detail="Analysis not found")
    pdf_bytes = generate_pdf_report(record.data)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=skill_gap_report_{record_id}.pdf"},
    )


@app.delete("/api/history/{record_id}")
def delete_analysis(record_id: int):
    db = SessionLocal()
    record = db.query(AnalysisRecord).filter(AnalysisRecord.id == record_id).first()
    if not record:
        db.close()
        raise HTTPException(status_code=404, detail="Analysis not found")
    db.delete(record)
    db.commit()
    db.close()
    return {"status": "deleted"}
