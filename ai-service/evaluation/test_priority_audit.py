import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.priority import priority_predictor

samples = [
    "Major gas leak near school, strong smell, fire hazard",
    "Open manhole without cover on busy road during night, severe accident hazard",
    "Sewage overflowing into houses on main road since yesterday",
    "Streetlight blinking occasionally on lane 4",
    "Garbage bin not cleared for 2 days near vegetable market",
    "Pothole on ring road near bus stop",
    "Water supply completely stopped for 3 days in entire ward",
    "Tree branch fallen on high voltage power line sparking",
    "Dengue cases spreading, open drain clogged with mosquitoes and dirty water",
    "Public park bench is broken"
]

print("="*60)
print("AUDIT: Current Priority Predictor Results")
print("="*60)
for s in samples:
    res = priority_predictor.predict(s)
    print(f"Complaint: {s}")
    print(f"-> Priority: {res['priority']} | Confidence: {res['confidence']} | Source: {res['source']}\n")

