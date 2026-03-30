from datetime import datetime
from sqlalchemy import ForeignKey, String, Integer, Float, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.database import Base
from typing import List, Optional

class Patient(Base):
    __tablename__ = "patients"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    age: Mapped[int] = mapped_column(Integer)
    gender: Mapped[str] = mapped_column(String(50))
    contact: Mapped[str] = mapped_column(String(100))
    registered_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    vitals: Mapped[List["Vitals"]] = relationship(back_populates="patient", cascade="all, delete-orphan")
    symptoms: Mapped[List["Symptom"]] = relationship(back_populates="patient", cascade="all, delete-orphan")
    triage_scores: Mapped[List["TriageScore"]] = relationship(back_populates="patient", cascade="all, delete-orphan")

class Vitals(Base):
    __tablename__ = "vitals"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"))
    bp_systolic: Mapped[int] = mapped_column(Integer)
    bp_diastolic: Mapped[int] = mapped_column(Integer)
    spo2: Mapped[int] = mapped_column(Integer)
    temperature: Mapped[float] = mapped_column(Float)
    heart_rate: Mapped[int] = mapped_column(Integer)
    recorded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    patient: Mapped["Patient"] = relationship(back_populates="vitals")

class Symptom(Base):
    __tablename__ = "symptoms"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"))
    symptom_text: Mapped[str] = mapped_column(String)
    severity_code: Mapped[int] = mapped_column(Integer) # 1-4

    # Relationships
    patient: Mapped["Patient"] = relationship(back_populates="symptoms")

class TriageScore(Base):
    __tablename__ = "triage_scores"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"))
    score: Mapped[float] = mapped_column(Float)
    priority_level: Mapped[str] = mapped_column(String(50))
    queue_position: Mapped[int] = mapped_column(Integer)
    computed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    patient: Mapped["Patient"] = relationship(back_populates="triage_scores")
