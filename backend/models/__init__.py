from backend.database import Base
from backend.models.patient import Patient, Vitals, Symptom, TriageScore
from backend.models.queue import Doctor, OPDQueue
from backend.models.bed import Ward, Bed, DischargeOrder, Admission

# EXPOSE FOR MIGRATIONS
__all__ = [
    "Base", "Patient", "Vitals", "Symptom", "TriageScore", 
    "Doctor", "OPDQueue", "Ward", "Bed", "DischargeOrder", "Admission"
]
