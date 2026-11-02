from sqlalchemy import Column, DateTime, Float, Integer, JSON, String, create_engine, func
from sqlalchemy.orm import declarative_base, sessionmaker

from .config import DB_PATH

engine = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class AnalysisRecord(Base):
    __tablename__ = "analysis_records"

    id = Column(Integer, primary_key=True, index=True)
    candidate_name = Column(String, nullable=True)
    job_title = Column(String, nullable=True)
    company_name = Column(String, nullable=True)
    match_score = Column(Float, nullable=True)
    gap_score = Column(Float, nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    data = Column(JSON, nullable=False, default={})


Base.metadata.create_all(bind=engine)
