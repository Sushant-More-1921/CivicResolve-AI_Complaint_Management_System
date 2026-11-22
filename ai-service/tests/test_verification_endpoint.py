import sys
from pathlib import Path
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.main import app

client = TestClient(app)

def test_verification_suite():
    print("=" * 80)
    print("RUNNING END-TO-END VERIFICATION TEST SUITE")
    print("=" * 80)

    test_scenarios = [
        # 1. Matching English complaints across all categories
        {
            "name": "English Solid Waste Match",
            "req": {"description": "There is a large heap of rotten garbage dumped on the street corner.", "selected_category": "Solid Waste / Garbage Disposal"},
            "expect_status": "verified",
            "expect_cat": "Solid Waste / Garbage Disposal",
            "expect_rel": True
        },
        {
            "name": "English Potholes Match",
            "req": {"description": "Massive deep pothole on main road causing severe traffic accidents.", "selected_category": "roads"},
            "expect_status": "verified",
            "expect_cat": "Potholes & Road Maintenance",
            "expect_rel": True
        },
        {
            "name": "English Clean Water Supply Match",
            "req": {"description": "Municipal drinking water pipeline burst, gallons of fresh water wasting.", "selected_category": "water"},
            "expect_status": "verified",
            "expect_cat": "Water Supply & Leakage",
            "expect_rel": True
        },
        {
            "name": "English Sewage & Drainage Match",
            "req": {"description": "Open manhole gutter overflowing with stinking black sewage waste water.", "selected_category": "drainage"},
            "expect_status": "verified",
            "expect_cat": "Sewage & Drainage Overflow",
            "expect_rel": True
        },
        {
            "name": "English Streetlight Match",
            "req": {"description": "Streetlight pole broken and pitch dark at night, women feel unsafe.", "selected_category": "streetlights"},
            "expect_status": "verified",
            "expect_cat": "Streetlight Malfunction",
            "expect_rel": True
        },
        {
            "name": "English Other Civic Issue Match",
            "req": {"description": "Dead stray animal rotting on roadside, terrible smell.", "selected_category": "other"},
            "expect_status": "verified",
            "expect_cat": "Other Civic Issue",
            "expect_rel": True
        },

        # 2. Multilingual: Hindi (Devanagari)
        {
            "name": "Hindi Garbage Match",
            "req": {"description": "गली में कचरा जमा है और बहुत बदबू आ रही है सफाई नहीं हुई", "selected_category": "waste"},
            "expect_status": "verified",
            "expect_cat": "Solid Waste / Garbage Disposal",
            "expect_rel": True
        },
        {
            "name": "Hindi Water Leakage Match",
            "req": {"description": "पीने के पानी की पाइपलाइन टूट गई है साफ पानी बह रहा है", "selected_category": "water"},
            "expect_status": "verified",
            "expect_cat": "Water Supply & Leakage",
            "expect_rel": True
        },

        # 3. Multilingual: Marathi (Devanagari)
        {
            "name": "Marathi Pothole Match",
            "req": {"description": "रस्त्यावर खूप मोठा खड्डा पडला आहे दुचाकींचे अपघात होत आहेत", "selected_category": "roads"},
            "expect_status": "verified",
            "expect_cat": "Potholes & Road Maintenance",
            "expect_rel": True
        },
        {
            "name": "Marathi Streetlight Match",
            "req": {"description": "गल्लीतील विजेचा खांब बंद आहे रात्री पूर्ण अंधार पडतो", "selected_category": "streetlights"},
            "expect_status": "verified",
            "expect_cat": "Streetlight Malfunction",
            "expect_rel": True
        },
        {
            "name": "Marathi Sewage Gutter Match",
            "req": {"description": "गटार तुंबले असून सांडपाणी रस्त्यावर येत आहे दुर्गंधी पसरली आहे", "selected_category": "drainage"},
            "expect_status": "verified",
            "expect_cat": "Sewage & Drainage Overflow",
            "expect_rel": True
        },

        # 4. Multilingual: Hinglish / Transliteration
        {
            "name": "Hinglish Garbage Match",
            "req": {"description": "Road var khoop kachra ahe please pickup kara", "selected_category": "waste"},
            "expect_status": "verified",
            "expect_cat": "Solid Waste / Garbage Disposal",
            "expect_rel": True
        },
        {
            "name": "Hinglish Gutter Sewage Match",
            "req": {"description": "Gutter overflow hot ahe stinking smell ahe", "selected_category": "drainage"},
            "expect_status": "verified",
            "expect_cat": "Sewage & Drainage Overflow",
            "expect_rel": True
        },

        # 5. Category Mismatches (Should identify mismatch and suggest correct category)
        {
            "name": "Confirmed Mismatch: User selected Water but description is Garbage",
            "req": {"description": "Garbage has not been collected for three days dustbin overflowing.", "selected_category": "water"},
            "expect_status": "mismatch",
            "expect_cat": "Solid Waste / Garbage Disposal",
            "expect_rel": True
        },
        {
            "name": "Confirmed Mismatch: User selected Streetlight but description is Pothole",
            "req": {"description": "There is a very deep crater pothole on the road damaging tires.", "selected_category": "streetlights"},
            "expect_status": "mismatch",
            "expect_cat": "Potholes & Road Maintenance",
            "expect_rel": True
        },

        # 6. Distinguishing Water Leakage vs Sewage Overflow
        {
            "name": "Disambiguation: Sewage overflow with 'water' in text",
            "req": {"description": "Open sewer drain spilling foul black waste water into residential street.", "selected_category": "drainage"},
            "expect_status": "verified",
            "expect_cat": "Sewage & Drainage Overflow",
            "expect_rel": True
        },

        # 7. Irrelevant / Test / Personal / Gibberish / Empty (Status: invalid, is_relevant: False)
        {
            "name": "Personal Introduction: 'my name is sushant'",
            "req": {"description": "my name is sushant", "selected_category": "roads"},
            "expect_status": "invalid",
            "expect_cat": None,
            "expect_rel": False
        },
        {
            "name": "Test Entry: 'random test'",
            "req": {"description": "random test", "selected_category": "roads"},
            "expect_status": "invalid",
            "expect_cat": None,
            "expect_rel": False
        },
        {
            "name": "Test Entry: 'testing purpose'",
            "req": {"description": "testing purpose", "selected_category": "roads"},
            "expect_status": "invalid",
            "expect_cat": None,
            "expect_rel": False
        },
        {
            "name": "Empty Description",
            "req": {"description": "", "selected_category": "roads"},
            "expect_status": "invalid",
            "expect_cat": None,
            "expect_rel": False
        },
        {
            "name": "Gibberish / Keystrokes",
            "req": {"description": "asdkjasdklj 123456 !!!", "selected_category": "roads"},
            "expect_status": "invalid",
            "expect_cat": None,
            "expect_rel": False
        },
        {
            "name": "Irrelevant / Non-Civic Commercial Text",
            "req": {"description": "I want to buy a new iPhone 16 Pro Max 256GB at discount", "selected_category": "roads"},
            "expect_status": "invalid",
            "expect_cat": None,
            "expect_rel": False
        },
        {
            "name": "Greeting / Chit-chat",
            "req": {"description": "Hello good morning how are you sir having a great day", "selected_category": "roads"},
            "expect_status": "invalid",
            "expect_cat": None,
            "expect_rel": False
        }
    ]

    passed = 0
    total = len(test_scenarios)

    for case in test_scenarios:
        res = client.post("/complaints/verify-description", json=case["req"])
        assert res.status_code == 200, f"Expected 200 got {res.status_code}"
        data = res.json()

        stat_ok = data["status"] == case["expect_status"]
        rel_ok = data["is_relevant"] == case["expect_rel"]
        cat_ok = True
        if case["expect_cat"] is not None:
            cat_ok = data["predicted_category"] == case["expect_cat"]

        all_ok = stat_ok and rel_ok and cat_ok
        if all_ok:
            passed += 1
            print(f" [PASS] {case['name']}")
            print(f"        status={data['status']} | predicted='{data['predicted_category']}' (conf={data['confidence']*100:.1f}%) | is_relevant={data['is_relevant']}")
        else:
            print(f" [FAIL] {case['name']}")
            print(f"        Expected: status={case['expect_status']}, cat={case['expect_cat']}, rel={case['expect_rel']}")
            print(f"        Got:      status={data['status']}, cat={data['predicted_category']}, rel={data['is_relevant']}")

    print("=" * 80)
    print(f"Result: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
    print("=" * 80)
    assert passed == total, f"{total - passed} tests failed"

if __name__ == "__main__":
    test_verification_suite()

