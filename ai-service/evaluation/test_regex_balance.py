import pandas as pd
import re

DATA_PATH = "ai-service/data/complaints.csv"

def assign_priority(text, category=""):
    text_lower = f"{category} {str(text)}".lower()

    # ==========================================
    # 1. CRITICAL PRIORITY (Immediate Threat to Life / Safety / Severe Disaster)
    # ==========================================
    critical_patterns = [
        r"\b(electrocution|electrocuted|electric shock)\b",
        r"\b(live wire|hanging wire|sparking wire|wire sparking|transformer fire|transformer spark|high voltage)\b",
        r"\b(gas leak|lpg leak|gas cylinder|pipeline explosion|explosion|gas smell)\b",
        r"\b(fire|burning|blaze|flames)\b",
        r"\b(building collaps|wall collaps|bridge collaps|structure collaps|roof collaps|flyover crack|cave-in|sinkhole)\b",
        r"\b(open manhole|missing manhole|uncovered manhole|manhole cover missing|uncovered pit|open drain hole)\b",
        r"\b(dead|death|fatal|fatality|people trapped|person trapped|life threatening|risk to life|danger to life)\b",
        r"\b(toxic leak|poisonous|chemical spill|biohazard|hazardous waste)\b",
        r"\b(major accident|fatal accident|severe accident)\b",
    ]
    for pat in critical_patterns:
        if re.search(pat, text_lower):
            return "Critical"

    # ==========================================
    # 2. HIGH PRIORITY (Urgent Civic Hazard / Health Emergency / Severe Outage)
    # ==========================================
    high_patterns = [
        r"\b(contaminated water|dirty water drinking|poisonous water|water contamination|smelly water drinking|yellow water)\b",
        r"\b(water supply stopped|no water supply|water cut|no water for|water stopped for|pipeline burst|pipe burst|main pipeline)\b",
        r"\b(sewage overflow|sewage inside house|sewage into homes|sewage flooding|raw sewage|drain water entering)\b",
        r"\b(dengue|malaria|cholera|jaundice|epidemic|mosquito outbreak|disease spreading|fever outbreak)\b",
        r"\b(huge pothole|deep pothole|major crater|road collapsed|road cave|caved in|arterial road blocked)\b",
        r"\b(tree fallen on road|fallen tree blocking|pole leaning|broken electric pole|fallen pole|pole fallen)\b",
        r"\b(pitch dark|completely dark|school|hospital|bus stand|railway station)\b",
        r"\b(dead animal|animal carcass|toxic smoke|garbage burning|burning plastic)\b",
        r"\b(flood|flooded road|waterlogging waist|water logged knee)\b",
        r"\b(severity|emergency|urgent attention|hazardous|dangerous)\b",
    ]
    for pat in high_patterns:
        if re.search(pat, text_lower):
            return "High"

    # ==========================================
    # 3. MEDIUM PRIORITY (Standard Operational & Maintenance Disruptions)
    # ==========================================
    medium_patterns = [
        r"\b(garbage overflow|overflowing bin|garbage not collected|uncollected garbage|trash accumulating|dump not cleared)\b",
        r"\b(streetlight not working|street light off|light not working|fused bulb|dark street|dark lane|blinking streetlight)\b",
        r"\b(blocked drain|drain blockage|clogged gutter|drainage choked|gutter blocked|water logging|water accumulation)\b",
        r"\b(pothole|broken road|damaged road|bad road|uneven road|paver block|speed breaker broken)\b",
        r"\b(low water pressure|water pressure low|leaking pipe|pipe leak|water leakage|valve leak|pipeline leak)\b",
        r"\b(bad smell|foul smell|stench|mosquitoes|insects|flies)\b",
        r"\b(noise pollution|loud music|construction noise|air pollution|dust pollution)\b",
        r"\b(damaged|broken|stopped working|needs repair|repair required|not functioning)\b",
    ]
    for pat in medium_patterns:
        if re.search(pat, text_lower):
            return "Medium"

    # ==========================================
    # 4. LOW PRIORITY (Routine Services / Cosmetic / Inquiries)
    # ==========================================
    # Default to Low
    return "Low"

df = pd.read_csv(DATA_PATH)
df['priority'] = [assign_priority(row['text'], row.get('category', '')) for _, row in df.iterrows()]
print("Priority distribution with enhanced regex:")
print(df['priority'].value_counts())
print("\nPercentage:")
print((df['priority'].value_counts(normalize=True)*100).round(2))

