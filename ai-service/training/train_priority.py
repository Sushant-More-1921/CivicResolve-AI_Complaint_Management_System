import os
from pathlib import Path
import random
import re
import pandas as pd

random.seed(42)

BASE_DIR = Path(__file__).resolve().parent.parent
BASE_DATA_PATH = BASE_DIR / "data" / "complaints.csv"
OUTPUT_PATH = BASE_DIR / "data" / "priority_complaints.csv"

# ==========================================
# Domain-Specific Civic Issue Templates
# ==========================================

CRITICAL_TEMPLATES = [
    # Electrical & Fire
    "Live electric wire hanging dangerously near {location}, risk of fatal electrocution",
    "Sparking electric cable snapped and lying on wet street at {location}, severe shock hazard",
    "Transformer explosion and active fire at {location}, flames spreading to nearby structures",
    "High voltage electrical pole sparking violently with sparks falling on pedestrians at {location}",
    "Short circuit caused fire in electrical distribution box near {location}, smoke and sparks",
    "Exposed live wire touching metal fence outside {location}, someone already got shocked",
    # Gas & Hazardous Materials
    "Major gas leak from underground pipeline near {location}, strong pungent odor and fire hazard",
    "LPG commercial cylinder leakage and hissing sound near {location}, immediate blast danger",
    "Toxic chemical leak from overturned tanker near {location}, residents experiencing choking and burning eyes",
    "Poisonous fumes spreading rapidly from chemical dumping near {location}, emergency evacuation needed",
    # Structural & Collapse
    "Open manhole with missing cover on busy roadway at {location}, fatal accident trap in dark",
    "Deep uncovered drainage pit on main road near {location}, vehicles and two-wheelers falling in",
    "Dilapidated building wall collapsed onto public sidewalk at {location}, people trapped under rubble",
    "Bridge pillar showing structural concrete cracks and foundation sinking near {location}, collapse imminent",
    "Massive road sinkhole cave-in swallowed pavement and vehicle at {location}, fatal hazard",
    "Balcony slab collapsed on busy pedestrian lane at {location}, emergency clearance needed",
    # Disasters & Entrapment
    "Severe flash flood water rapidly rising into houses with elderly residents trapped at {location}",
    "Fatal road collision between truck and auto at {location}, fuel leaking with fire risk",
    "Construction crane tilting dangerously toward residential homes at {location}, imminent collapse risk",
    "Old heavy tree collapsed onto high voltage power line sparking fire over houses at {location}",
]

HIGH_TEMPLATES = [
    # Water Outage & Contamination
    "Drinking water supply completely stopped for 4 consecutive days across entire ward near {location}",
    "Drinking water tap delivering muddy brown sewage contaminated water with foul smell at {location}",
    "Water contamination causing sudden outbreak of cholera and vomiting among children at {location}",
    "Main municipal water transmission pipeline burst flooding the road with gallons wasted near {location}",
    "Zero municipal water tanker delivery for 5 days, severe acute drinking water crisis at {location}",
    # Drainage & Public Health
    "Raw sewage overflowing into ground floor residential homes and shops at {location}",
    "Severely blocked main sewer spewing human waste and filthy water onto entrance of {location}",
    "Severe dengue and malaria outbreak with multiple hospitalized patients due to stagnant water near {location}",
    "Open drain completely choked with toxic black sludge and massive mosquito swarm breeding at {location}",
    "Dead animal carcass decaying for days on street near {location}, unbearable foul stench and health hazard",
    # Roads & Infrastructure Hazards
    "Huge deep crater pothole on highway near {location} causing vehicles to lose control and skid",
    "Fallen banyan tree completely blocking arterial road and blocking ambulance access near {location}",
    "Electric pole tilted at 45 degree angle leaning directly over moving traffic at {location}",
    "Main road caved in by 2 feet after heavy rain near {location}, serious transit hazard",
    "Major traffic signal failure at busy four-way junction near {location} causing gridlock and near-misses",
    # Sanitation & Safety
    "Hospital entrance road completely blocked with rotting biomedical garbage dump at {location}",
    "Entire street is pitch dark with all streetlights failed near {location}, security risk for women and commuters",
    "Industrial unit illegally releasing untreated black toxic wastewater into storm drain near {location}",
    "Garbage dump on fire producing dense toxic choking smoke entering homes and school at {location}",
]

MEDIUM_TEMPLATES = [
    # Sanitation & Waste
    "Municipal garbage bin overflowing with trash scattered across pavement near {location}",
    "Door-to-door garbage collection vehicle has not visited for 3 days at {location}",
    "Garbage dump not cleared for 2 days near {location}, bad smell and flies",
    "Garbage bin not emptied or cleared for several days at {location}",
    "Trash accumulation and garbage not cleared for days near {location}",
    "Vegetable and fruit market waste dumped in open area near {location}, bad odor",
    "Dry leaves and general refuse piled up on roadside corner near {location} needing pickup",
    "Public dustbin damaged and lid broken causing waste spillage near {location}",
    # Lighting & Electricity
    "Streetlight not working on lane 3 near {location}, area is dark at night",
    "Streetlight bulb flickering continuously and turning off intermittently near {location}",
    "Streetlight bracket bent and light pointing away from road near {location}",
    "Two streetlights out of service along residential street near {location}",
    # Drainage & Roads
    "Roadside gutter clogged with silt causing rainwater to drain very slowly near {location}",
    "Water logging up to 4 inches on residential street after rain near {location}",
    "Multiple moderate potholes on colony internal road near {location} making riding bumpy",
    "Broken speed breaker with exposed asphalt and sharp stones near {location}",
    "Footpath paver blocks broken and uneven causing pedestrians to stumble near {location}",
    # Water & Plumbing
    "Municipal pipeline valve leaking clean water steadily onto roadside near {location}",
    "Very low water pressure in morning supply, barely filling ground tank at {location}",
    "Water meter connector leaking continuously outside residential compound at {location}",
    # Environment & Noise
    "Unauthorized construction activity operating heavy machinery late at night creating noise near {location}",
    "Open construction site generating heavy dust pollution without mandatory green safety nets near {location}",
]

LOW_TEMPLATES = [
    # Routine Cleaning & Maintenance
    "Street sweeping required along sidewalk near {location}, accumulated dust and dry leaves",
    "Request for regular road cleaning and sweeping on residential road near {location}",
    "Footpath curb stones need repainting and general cleaning near {location}",
    "Public park walking track needs routine cleaning and leaf removal near {location}",
    "Public garden lawn grass overgrown, routine mowing required at {location}",
    # Tree Maintenance & Horticulture
    "Overgrown tree branches touching compound wall need routine trimming near {location}",
    "Request to prune roadside shrubs obstructing pedestrian visibility of signboard at {location}",
    "Bougainvillea bushes overgrown onto pavement near {location}, routine pruning requested",
    # Cosmetic & Minor Repairs
    "Public park wooden bench has loose plank needing minor repair at {location}",
    "Children's playground swing chain needs oiling and minor adjustment near {location}",
    "Zebra crossing paint on road faded and needs repainting during next scheduled work near {location}",
    "Street name indicator board rusted and slightly bent near {location}, request replacement",
    "Request for installation of an additional small litter bin near bus shelter at {location}",
    # General Inquiries & Stray Animals
    "Stray dogs roaming in residential colony, request municipal animal birth control team visit {location}",
    "Inquiry regarding schedule of tree trimming and pre-monsoon gutter desilting in ward near {location}",
    "Request information about designated electronic waste collection center near {location}",
    "Citizen feedback appreciating recent park renovation near {location}",
]

LOCATIONS = [
    "Rajwada Chowk", "Station Road", "Civil Hospital Gate", "Model Colony", "Market Yard",
    "Shastri Nagar", "Bus Stand Lane", "Girls High School", "Ring Road Junction", "Gandhi Maidan",
    "Tarabai Park", "Laxmipuri Corner", "Rajarampuri 5th Lane", "Industrial Estate Ward 4",
    "Shahupuri 2nd Lane", "Subhash Road", "Shivaji University Road", "Kasba Bawada Main Road",
    "Nagala Park", "Bapat Camp", "Phulewadi Ring Road", "Kadamwadi Chowk", "Mangalwar Peth",
    "Somwar Peth", "Budhwar Peth", "Rankala Lake Promenade", "Dabholkar Corner", "Kawala Naka",
    "Mahadwar Road", "Bhavani Mandap", "Vasantrao Naik Nagar", "Sambhaji Nagar"
]

CATEGORY_MAP = {
    "Live electric": "Electricity",
    "Sparking electric": "Electricity",
    "Transformer": "Electricity",
    "electrical pole": "Electricity",
    "live wire": "Electricity",
    "gas leak": "Public Safety",
    "LPG": "Public Safety",
    "chemical": "Public Safety",
    "manhole": "Drainage",
    "drainage pit": "Drainage",
    "wall collapsed": "Infrastructure",
    "Bridge pillar": "Infrastructure",
    "sinkhole": "Road/Pothole",
    "Balcony": "Infrastructure",
    "flood": "Disaster Management",
    "accident": "Public Safety",
    "crane": "Public Safety",
    "tree": "Public Safety",
    "Drinking water": "Water",
    "sewage": "Drainage",
    "sewer": "Drainage",
    "dengue": "Public Health",
    "drain": "Drainage",
    "carcass": "Sanitation",
    "crater": "Road/Pothole",
    "pothole": "Road/Pothole",
    "pole tilted": "Electricity",
    "traffic signal": "Traffic",
    "biomedical": "Sanitation",
    "pitch dark": "Streetlight",
    "Streetlight": "Streetlight",
    "streetlights": "Streetlight",
    "garbage": "Garbage",
    "trash": "Garbage",
    "dustbin": "Garbage",
    "sweeping": "Sanitation",
    "gutter": "Drainage",
    "paver": "Road/Pothole",
    "speed breaker": "Road/Pothole",
    "water pressure": "Water",
    "water meter": "Water",
    "pipeline valve": "Water",
    "noise": "Pollution",
    "dust": "Pollution",
    "bench": "Public Amenities",
    "swing": "Public Amenities",
    "zebra crossing": "Road/Pothole",
    "signboard": "Road/Pothole",
    "stray": "Animal Control",
}

def guess_category(text: str) -> str:
    for kw, cat in CATEGORY_MAP.items():
        if kw.lower() in text.lower():
            return cat
    return "Civic Services"

def generate_augmented_priority_dataset():
    generated_rows = []

    # Target: 3000 Critical, 3000 High, 3000 Medium, 3000 Low
    # Generate variations using templates x locations x phrasing variants
    prefixes = [
        "", "Urgent attention required: ", "Immediate hazard reported: ", "Complaint regarding: ",
        "Reported by resident: ", "Serious issue: ", "Frequent complaint: ", "Kindly inspect: "
    ]
    suffixes = [
        "", " Please resolve as soon as possible.", " Kindly take immediate action.",
        " Action requested immediately.", " Posing severe issues.", " Multiple residents complaining.",
        " Reported multiple times by local residents.", " Requesting prompt municipal intervention."
    ]

    tier_configs = [
        ("Critical", CRITICAL_TEMPLATES, 3200),
        ("High", HIGH_TEMPLATES, 3200),
        ("Medium", MEDIUM_TEMPLATES, 3200),
        ("Low", LOW_TEMPLATES, 3200),
    ]

    for priority, templates, target_count in tier_configs:
        count = 0
        while count < target_count:
            tmpl = random.choice(templates)
            loc = random.choice(LOCATIONS)
            pref = random.choice(prefixes) if random.random() > 0.4 else ""
            suff = random.choice(suffixes) if random.random() > 0.4 else ""
            text = f"{pref}{tmpl.format(location=loc)}{suff}".strip()
            cat = guess_category(text)
            generated_rows.append({"text": text, "category": cat, "priority": priority})
            count += 1

    df_generated = pd.DataFrame(generated_rows)
    print(f"Generated {len(df_generated)} synthetic balanced records across 4 classes:")
    print(df_generated["priority"].value_counts())

    # Now also process base complaints.csv if it exists
    if os.path.isfile(BASE_DATA_PATH):
        df_base = pd.read_csv(BASE_DATA_PATH).dropna(subset=["text"])
        base_rows = []
        for _, row in df_base.iterrows():
            text = str(row["text"]).strip()
            cat = str(row.get("category", "")).strip()
            text_lower = f"{cat} {text}".lower()

            # Classify base complaint with refined civic criteria
            if any(re.search(pat, text_lower) for pat in [
                r"\b(electrocution|live wire|hanging wire|sparking|transformer fire|short circuit|explosion|gas leak|fire|collapse|open manhole|fatal|dead|death|trapped)\b"
            ]):
                pri = "Critical"
            elif any(re.search(pat, text_lower) for pat in [
                r"\b(dengue|malaria|cholera|contaminated|pipeline burst|water supply stopped|no water|sewage overflow|raw sewage|huge pothole|deep crater|road collapse|fallen tree|pitch dark|dead animal|toxic)\b"
            ]):
                pri = "High"
            elif any(re.search(pat, text_lower) for pat in [
                r"\b(garbage overflow|bin overflow|uncollected|not cleared|not collected|garbage dump|dumpster|dark street|streetlight|fused bulb|blocked drain|drainage|gutter|pothole|leaking pipe|water pressure|bad smell|foul smell|noise|pollution|broken|damaged)\b"
            ]):
                pri = "Medium"
            else:
                pri = "Low"

            base_rows.append({"text": text, "category": cat if cat else "Civic Services", "priority": pri})

        df_base_labeled = pd.DataFrame(base_rows)
        # Sample proportionally to balance: cap each base class to at most 1500 to prevent class dominance
        df_base_balanced = df_base_labeled.groupby("priority", group_keys=False).apply(
            lambda g: g.sample(min(len(g), 1500), random_state=42)
        ).reset_index(drop=True)

        combined_df = pd.concat([df_generated, df_base_balanced], ignore_index=True)
    else:
        combined_df = df_generated

    # Shuffle
    combined_df = combined_df.sample(frac=1.0, random_state=42).reset_index(drop=True)

    print("\nFinal Combined Priority Dataset Summary:")
    print("Total rows:", len(combined_df))
    print(combined_df["priority"].value_counts())
    print("\nPercentages:")
    print((combined_df["priority"].value_counts(normalize=True) * 100).round(2))

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    combined_df.to_csv(OUTPUT_PATH, index=False)
    print(f"\nSuccessfully wrote priority dataset to {OUTPUT_PATH}")

if __name__ == "__main__":
    generate_augmented_priority_dataset()
