from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_predict_critical_priority():
    response = client.post(
        "/priority/predict",
        json={"text": "Live electric wire fallen on the street sparking violently, severe life threat"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["priority"] == "Critical"
    assert data["confidence"] > 0.8
    assert data["severity_score"] >= 0.9
    assert "explanation" in data
    assert len(data["contributing_factors"]) > 0
    assert data["model_version"] == "priority-v2.0.0"

def test_predict_high_priority():
    response = client.post(
        "/priority/predict",
        json={"text": "Drinking water supply completely stopped for 4 days in entire neighborhood", "category": "Water"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["priority"] == "High"
    assert data["severity_score"] == 0.75
    assert "explanation" in data

def test_predict_medium_priority():
    response = client.post(
        "/priority/predict",
        json={"text": "Streetlight fused and not turning on in lane 3", "category": "Streetlight"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["priority"] == "Medium"
    assert data["severity_score"] == 0.50

def test_predict_low_priority():
    response = client.post(
        "/priority/predict",
        json={"text": "Request to sweep sidewalk and clear dry fallen leaves", "category": "Sanitation"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["priority"] == "Low"
    assert data["severity_score"] == 0.25

def test_predict_empty_text():
    response = client.post("/priority/predict", json={"text": ""})
    assert response.status_code in [400, 422]

def test_batch_predict_priority():
    response = client.post(
        "/priority/batch-predict",
        json={
            "complaints": [
                {"text": "Underground gas pipeline leaking heavily with gas smell", "category": "Public Safety"},
                {"text": "Raw sewage overflowing into ground floor homes", "category": "Drainage"},
                {"text": "Garbage dump not cleared for 2 days", "category": "Garbage"},
                {"text": "Inquiry regarding municipal park timings", "category": "Civic Services"}
            ]
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 4
    results = data["results"]
    assert results[0]["result"]["priority"] == "Critical"
    assert results[1]["result"]["priority"] == "High"
    assert results[2]["result"]["priority"] == "Medium"
    assert results[3]["result"]["priority"] in ["Medium", "Low"]

def test_analyze_integration():
    response = client.post(
        "/analyze",
        json={"text": "Deep uncovered manhole pit on main road, serious risk of fatal accident"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["priority"] == "Critical"
    assert "priority_explanation" in data
    assert "priority_factors" in data

