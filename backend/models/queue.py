from datetime import datetime
import enum
from sqlalchemy import ForeignKey, String, Integer, DateTime, Boolean, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.database import Base
from typing import Optional

class QueueStatus(str, enum.Enum):
    WAITING = "waiting"
    IN_CONSULTATION = "in_consultation"
    COMPLETED = "completed"

class Doctor(Base):
    __tablename__ = "doctors"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    specialization: Mapped[str] = mapped_column(String(100))
    is_available: Mapped[bool] = mapped_column(Boolean, default=True)

    # Relationships
    queue_entries: Mapped["OPDQueue"] = relationship(back_populates="doctor")

class OPDQueue(Base):
    __tablename__ = "opd_queue"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"))
    doctor_id: Mapped[int] = mapped_column(ForeignKey("doctors.id"))
    queue_position: Mapped[int] = mapped_column(Integer)
    status: Mapped[QueueStatus] = mapped_column(Enum(QueueStatus), default=QueueStatus.WAITING)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    doctor: Mapped["Doctor"] = relationship(back_populates="queue_entries")
    patient: Mapped["Patient"] = relationship("Patient") # Single direction or back_populates if added to Patient
