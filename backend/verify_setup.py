import sys
import os

# Add the project root to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

try:
    from backend.database import engine, Base
    print("Database import: OK")
    
    from backend.models.patient import Patient, Vitals, Symptom, TriageScore
    print("Patient models import: OK")
    
    from backend.models.queue import Doctor, OPDQueue
    print("Queue models import: OK")
    
    from backend.models.bed import Ward, Bed, DischargeOrder, Admission
    print("Bed models import: OK")
    
    from backend.main import app
    print("FastAPI app import: OK")
    
    print("\nVerification successful!")
except Exception as e:
    print(f"\nVerification failed: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
