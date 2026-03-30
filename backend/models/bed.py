from datetime import datetime
import enum
from sqlalchemy import ForeignKey, String, Integer, DateTime, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.database import Base
from typing import List, Optional

class BedStatus(str, enum.Enum):
    AVAILABLE = "available"
    OCCUPIED = "occupied"
    RESERVED = "reserved"
    MAINTENANCE = "maintenance"

class Ward(Base):
    __tablename__ = "wards"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    total_beds: Mapped[int] = mapped_column(Integer)
    floor: Mapped[int] = mapped_column(Integer)

    # Relationships
    beds: Mapped[List["Bed"]] = relationship(back_populates="ward", cascade="all, delete-orphan")

class Bed(Base):
    __tablename__ = "beds"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    ward_id: Mapped[int] = mapped_column(ForeignKey("wards.id"))
    bed_number: Mapped[str] = mapped_column(String(50))
    status: Mapped[BedStatus] = mapped_column(Enum(BedStatus), default=BedStatus.AVAILABLE)
    assigned_patient_id: Mapped[Optional[int]] = mapped_column(ForeignKey("patients.id"), nullable=True)
    last_updated: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    ward: Mapped["Ward"] = relationship(back_populates="beds")
    patient: Mapped[Optional["Patient"]] = relationship("Patient")

class DischargeOrder(Base):
    __tablename__ = "discharge_orders"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"))
    bed_id: Mapped[int] = mapped_column(ForeignKey("beds.id"))
    doctor_id: Mapped[int] = mapped_column(ForeignKey("doctors.id"))
    expected_discharge_at: Mapped[datetime] = mapped_column(DateTime)
    confirmed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

class Admission(Base):
    __tablename__ = "admissions"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"))
    bed_id: Mapped[int] = mapped_column(ForeignKey("beds.id"))
    doctor_id: Mapped[int] = mapped_column(ForeignKey("doctors.id"))
    admitted_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    discharged_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
