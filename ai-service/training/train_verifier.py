import os
import sys
from pathlib import Path
import pandas as pd
import numpy as np
import joblib

from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline, FeatureUnion
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.svm import LinearSVC
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score, f1_score, precision_score, recall_score

# Canonical Categories
CAT_GARBAGE = "Solid Waste / Garbage Disposal"
CAT_ROADS = "Potholes & Road Maintenance"
CAT_WATER = "Water Supply & Leakage"
CAT_DRAINAGE = "Sewage & Drainage Overflow"
CAT_STREETLIGHTS = "Streetlight Malfunction"
CAT_OTHER = "Other Civic Issue"
CAT_SPAM = "Irrelevant / Spam / Non-Civic"

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
BASE_DATA_PATH = DATA_DIR / "complaints.csv"
OUTPUT_MODEL_DIR = Path(__file__).resolve().parents[1] / "models" / "complaint_verifier"
OUTPUT_MODEL_PATH = OUTPUT_MODEL_DIR / "model.joblib"

# Extensive Multilingual & Semantic Disambiguation Dataset
MULTILINGUAL_DATA = [
    # =========================================================================
    # SOLID WASTE / GARBAGE DISPOSAL
    # =========================================================================
    # Marathi (Devanagari)
    ("रस्त्यावर कचऱ्याचा मोठा ढीग साचला आहे आणि दुर्गंधी पसरली आहे", CAT_GARBAGE),
    ("कचरा कुंडी भरून वाहत आहे, कुत्रे आणि गुरे कचरा पसरवत आहेत", CAT_GARBAGE),
    ("आमच्या गल्लीत घंटा गाडी तीन दिवसांपासून आलेली नाही, कचरा साचला आहे", CAT_GARBAGE),
    ("कचरा उचलणारा कर्मचारी आठवडाभर आला नाही, प्रचंड घाण झाली आहे", CAT_GARBAGE),
    ("रस्त्याच्या कडेला प्लास्टिक आणि कुजलेला कचरा टाकला आहे", CAT_GARBAGE),
    ("कचरापेटी तुटली आहे, सर्व कचरा रस्त्यावर पसरला आहे", CAT_GARBAGE),
    ("कचऱ्याची दुर्गंधी घरात येत आहे, कृपया त्वरित कचरा उचलावा", CAT_GARBAGE),
    ("सोसायटीच्या बाहेर कचऱ्याचा डोंगर तयार झाला आहे", CAT_GARBAGE),
    ("भाजी मंडईतील सडलेला कचरा रस्त्यावर फेकून दिला आहे", CAT_GARBAGE),
    ("कचरा पेटवून दिला आहे, धुरामुळे श्वास घेणे कठीण झाले आहे", CAT_GARBAGE),
    ("घंटागाडी वेळेवर येत नाही त्यामुळे लोक रस्त्यावर कचरा टाकत आहेत", CAT_GARBAGE),
    ("ओला आणि सुका कचरा रस्त्यावर एकत्र फेकला आहे", CAT_GARBAGE),
    ("महानगरपालिकेने कचरा गोळा करणे बंद केले आहे", CAT_GARBAGE),
    ("कचऱ्यामुळे डासांची पैदास वाढली असून रोगराई पसरत आहे", CAT_GARBAGE),
    ("उकिरडा झाला आहे येथे, दुर्गंधीने नागरिक हैराण झाले आहेत", CAT_GARBAGE),
    
    # Hindi (Devanagari)
    ("सड़क पर भारी मात्रा में कचरा पड़ा हुआ है और बदबू आ रही है", CAT_GARBAGE),
    ("कूड़ेदान पूरी तरह से ओवरफ्लो हो गया है, कचरा सड़क पर फैला है", CAT_GARBAGE),
    ("कूड़ा उठाने वाली गाड़ी पिछले चार दिनों से नहीं आई है", CAT_GARBAGE),
    ("कूड़े का ढेर लगा हुआ है, आवारा जानवर गंदगी फैला रहे हैं", CAT_GARBAGE),
    ("सड़क किनारे कचरा जलाया जा रहा है जिससे बहुत धुआं हो रहा है", CAT_GARBAGE),
    ("मोहल्ले में सफाई कर्मचारी नहीं आ रहे हैं, चारों तरफ कूड़ा ही कूड़ा है", CAT_GARBAGE),
    ("कचरे की बदबू से सांस लेना मुश्किल हो गया है, तुरंत सफाई करवाएं", CAT_GARBAGE),
    ("डस्टबिन टूट गया है और कूड़ा नाली और सड़क पर गिर रहा है", CAT_GARBAGE),
    ("सब्जी मंडी का सड़ा कचरा सड़क पर बिखरा पड़ा है", CAT_GARBAGE),
    ("कूड़े के कारण बहुत मक्खियां और मच्छर बढ़ गए हैं बीमारी का खतरा है", CAT_GARBAGE),
    ("सोसाइटी के मुख्य गेट पर भारी कूड़ा कचरा जमा है", CAT_GARBAGE),
    ("नगर निगम की कचरा गाड़ी समय पर नहीं आती", CAT_GARBAGE),

    # Hinglish & Transliterated Marathi
    ("Road var khoop kachra ahe please pickup kara", CAT_GARBAGE),
    ("Road var kachra ahe pickup kara", CAT_GARBAGE),
    ("Sadak par bohot kachra jama hai please uthwaye", CAT_GARBAGE),
    ("Road side par kachra feka hua hai", CAT_GARBAGE),
    ("Rastyavar kachra takla ahe lokaani, gandagi zali ahe", CAT_GARBAGE),
    ("Road var kachra kundi overflow zali ahe", CAT_GARBAGE),
    ("Kachra on road and street corners", CAT_GARBAGE),
    ("Kachra kundi overflow zali ahe smelly smell yet ahe", CAT_GARBAGE),
    ("Ghanta gadi hasn't come for 3 days, garbage piling up", CAT_GARBAGE),
    ("Garbage dumped on corner of street, animals spreading waste", CAT_GARBAGE),
    ("Colony me kachra uthane wala nahi aa raha, bohot kachra jama ho gaya", CAT_GARBAGE),
    ("Dustbin tuta hua hai kachra sadak par bikhar gaya", CAT_GARBAGE),
    ("Kachra jala rahe hain log bohot pollution aur smell ho raha", CAT_GARBAGE),
    ("Society chya baher khoop kachra ahe, please clean it fast", CAT_GARBAGE),
    ("Solid waste management truck is not picking garbage from our area", CAT_GARBAGE),
    ("Kachrewala nahi aaya teen din se pura ghar me kachra jama hai", CAT_GARBAGE),
    ("Garbage heap rotting outside school gate, health hazard for children", CAT_GARBAGE),

    # Disambiguation: Garbage on road / near drainage
    ("Huge pile of rotten household garbage dumped in middle of road blocking path", CAT_GARBAGE),
    ("Vegetable waste and plastic garbage clogging roadside, stinking waste", CAT_GARBAGE),
    ("Garbage bin overflowing near road circle, sweepers not cleaning", CAT_GARBAGE),
    ("Waste and trash dumped openly on the road side", CAT_GARBAGE),
    ("Plastic bags and kitchen garbage thrown on street road", CAT_GARBAGE),

    # =========================================================================
    # POTHOLES & ROAD MAINTENANCE
    # =========================================================================
    # Marathi (Devanagari)
    ("रस्त्यावर खूप मोठे खड्डे पडले आहेत, दुचाकींचे अपघात होत आहेत", CAT_ROADS),
    ("पावसामुळे रस्ता पूर्णपणे उखडला असून दगड बाहेर आले आहेत", CAT_ROADS),
    ("रस्त्याची चाळण झाली आहे, वाहने चालवणे अशक्य झाले आहे", CAT_ROADS),
    ("डामरीकरण निकृष्ट दर्जाचे झाल्याने रस्ता पुन्हा तुटला आहे", CAT_ROADS),
    ("रस्त्यात मोठा खड्डा असून त्यात पाणी भरले आहे, रात्री दिसत नाही", CAT_ROADS),
    ("रस्त्याचे काम अर्धवट सोडले असून खडी आणि खड्डे तसेच आहेत", CAT_ROADS),
    ("गतिरोधक (स्पीड ब्रेकर) तुटला असून वाहनांचे नुकसान होत आहे", CAT_ROADS),
    ("पादचाऱ्यांसाठी फुटपाथ तुटलेला असून चालणे धोकादायक आहे", CAT_ROADS),
    ("मुख्य रस्त्यावरील डांबर उडून खोल खड्डे पडले आहेत", CAT_ROADS),
    ("रस्त्यावरील पेव्हर ब्लॉक खचले असून मोठा अपघात होऊ शकतो", CAT_ROADS),
    ("पूल आणि रस्त्याच्या सांध्यावर मोठा खड्डा पडला आहे", CAT_ROADS),
    ("रस्ता दुरुस्ती त्वरित करण्यात यावी, दररोज लोक पडत आहेत", CAT_ROADS),

    # Hindi (Devanagari)
    ("सड़क पर बहुत गहरे गड्ढे हो गए हैं, आए दिन एक्सीडेंट हो रहे हैं", CAT_ROADS),
    ("बारिश के कारण सड़क टूट गई है और बड़े-बड़े गड्ढे बन गए हैं", CAT_ROADS),
    ("सड़क की हालत बहुत खराब है, पूरी सड़क उखड़ चुकी है", CAT_ROADS),
    ("गड्ढे में पानी भरा होने से बाइक सवार गिरकर घायल हो रहे हैं", CAT_ROADS),
    ("सड़क निर्माण का कार्य अधूरा छोड़ दिया गया है गिट्टी बिखरी पड़ी है", CAT_ROADS),
    ("स्पीड ब्रेकर पर कोई पेंट या निशान नहीं है और वह टूटा हुआ है", CAT_ROADS),
    ("फुटपाथ टूटा हुआ है और पैदल चलने वालों के लिए रास्ता नहीं है", CAT_ROADS),
    ("मुख्य सड़क पर डामर उखड़ गया है, सड़क मरम्मत की सख्त जरूरत है", CAT_ROADS),
    ("सड़क धंस गई है जिससे बड़ा हादसा हो सकता है", CAT_ROADS),

    # Hinglish & Transliterated Marathi
    ("Deep pothole on highway caused a motorcycle accident yesterday", CAT_ROADS),
    ("Highway pothole caused bike accident", CAT_ROADS),
    ("Deep potholes on road causing car damage and accidents", CAT_ROADS),
    ("Road var khup mothe khadde padlet, bike rider padat ahet", CAT_ROADS),
    ("Potholes on road are dangerous for bikes", CAT_ROADS),
    ("Sadak par bohot bade bade gaddhe hain gaadi chalana mushkil", CAT_ROADS),
    ("Road is broken completely after rains, craters everywhere", CAT_ROADS),
    ("Rasta repair kara lavkar, khaddi sagli baher aali ahe", CAT_ROADS),
    ("Pothole filled with water cannot see depth at night danger", CAT_ROADS),
    ("Paver blocks sinking on road, heavy vehicles getting stuck", CAT_ROADS),
    ("Speed breaker damaged and sharp stones sticking out", CAT_ROADS),
    ("Road patch work done very poorly, broke within two weeks", CAT_ROADS),
    ("Deep crater on highway near toll booth dangerous for cars", CAT_ROADS),
    ("Sadak kharab hai pura tar ukhad gaya hai gaddha hi gaddha hai", CAT_ROADS),

    # Disambiguation
    ("Severe asphalt erosion and deep potholes on 6th cross street", CAT_ROADS),
    ("Road surface collapsed forming dangerous sinkhole near bus stop", CAT_ROADS),
    ("Potholes and broken asphalt on road leading to school", CAT_ROADS),
    ("Crater on road damaged two wheelers and vehicles", CAT_ROADS),

    # =========================================================================
    # WATER SUPPLY & LEAKAGE (Drinking / Pipeline / Low pressure / No supply)
    # =========================================================================
    # Marathi (Devanagari)
    ("आमच्या भागात गेल्या तीन दिवसांपासून पिण्याचे पाणी आलेले नाही", CAT_WATER),
    ("मुख्य पाण्याच्या पाईपलाईनला मोठी गळती लागली असून हजारो लिटर पाणी वाया जात आहे", CAT_WATER),
    ("नळाला अत्यंत कमी दाबाने पाणी येत असून वरच्या मजल्यावर पाणी चढत नाही", CAT_WATER),
    ("पिण्याचे पाणी गढूळ आणि पिवळसर येत असून पिण्यायोग्य नाही", CAT_WATER),
    ("पाणी पुरवठ्याची वेळ अनियंत्रित असून नागरिक त्रस्त झाले आहेत", CAT_WATER),
    ("जलवाहिनी फुटली असून रस्त्यावर स्वच्छ पाण्याचे तळे साचले आहे", CAT_WATER),
    ("वॉल्व्ह खराब झाल्यामुळे पिण्याचे पाणी पुरवले जात नाही", CAT_WATER),
    ("नळाला घाण वास येत आहे, पिण्याच्या पाण्याच्या पाईपलाईनची तपासणी करा", CAT_WATER),
    ("टँकरने पाणी पुरवठा त्वरित करावा, वस्तीत तीव्र पाणी टंचाई आहे", CAT_WATER),
    ("पाण्याच्या मीटरजवळ पाईप लिकेज होत आहे पाणी वाया जात आहे", CAT_WATER),
    ("महापालिकेचा पाणी पुरवठा बंद आहे कोणतीही पूर्वकल्पना दिली नाही", CAT_WATER),

    # Hindi (Devanagari)
    ("पीने का पानी नहीं आ रहा है दो दिन से पूरी कॉलोनी परेशान है", CAT_WATER),
    ("मुख्य पाइपलाइन फट गई है और साफ पीने का पानी सड़क पर बह रहा है", CAT_WATER),
    ("नल में बहुत कम प्रेशर से पानी आ रहा है मोटर भी नहीं उठा पा रही", CAT_WATER),
    ("सप्लाई का पानी गंदा और मटमैला आ रहा है पीने लायक नहीं है", CAT_WATER),
    ("जल आपूर्ति ठप है कृपया टैंकर भिजवाएं पीने का पानी खत्म हो गया", CAT_WATER),
    ("पानी की पाइप से लीकेज हो रहा है हजारों लीटर पानी बर्बाद हो रहा है", CAT_WATER),
    ("नल से बदबूदार पानी आ रहा है पाइपलाइन में लीकेज हो सकता है", CAT_WATER),
    ("वॉटर सप्लाई का समय सही नहीं है रात को 2 बजे पानी आता है", CAT_WATER),
    ("सरकारी नल खराब हो गया है पानी की भीषण समस्या हो रही है", CAT_WATER),

    # Hinglish & Transliterated Marathi
    ("Drinking water supply band ahe since yesterday, pani nahi yet", CAT_WATER),
    ("Water leakage from main fresh water pipeline near temple", CAT_WATER),
    ("Pani ka pipe burst ho gaya hai clean water is getting wasted", CAT_WATER),
    ("Nal me pani nahi aa raha do din se please supply restore karo", CAT_WATER),
    ("Low water pressure in municipal water line, tank not filling", CAT_WATER),
    ("Panyachi pipe phutli ahe rastyavar pure water flow hot ahe", CAT_WATER),
    ("Tap water is dirty muddy yellow, cannot drink or cook", CAT_WATER),
    ("Drinking water shortage in ward no 5, send water tanker", CAT_WATER),
    ("Pipeline leak wasting fresh tap water on footpath", CAT_WATER),
    ("Paani nahi aala aaz sakali, municipal supply cut without notice", CAT_WATER),

    # Disambiguation (Clean water vs Sewage)
    ("Drinking water distribution pipeline burst, clear water gushing onto pavement", CAT_WATER),
    ("Severe potable water shortage in high rise apartments, supply stopped", CAT_WATER),
    ("Municipal tap line valve broken leaking continuous fresh water stream", CAT_WATER),

    # =========================================================================
    # SEWAGE & DRAINAGE OVERFLOW (Gutter / Manhole / Foul black waste water)
    # =========================================================================
    # Marathi (Devanagari)
    ("गटार तुंबले असून काळे सांडपाणी रस्त्यावर वाहत आहे, प्रचंड दुर्गंधी येत आहे", CAT_DRAINAGE),
    ("उघड्या मॅनहोलमधून गटाराचे घाण पाणी रस्त्यावर आणि घरात शिरत आहे", CAT_DRAINAGE),
    ("ड्रेनेज लाईन चोकअप झाली आहे, सांडपाण्याचा निचरा होत नाही", CAT_DRAINAGE),
    ("गटाराचे झाकण तुटलेले असून दुर्गंधी आणि आजार पसरण्याचा धोका आहे", CAT_DRAINAGE),
    ("सांडपाणी वाहून नेणारी पाईपलाईन फुटल्याने रस्ता घाण झाला आहे", CAT_DRAINAGE),
    ("पावसाळी गटार कचऱ्याने भरल्याने रस्त्यावर सांडपाणी साचले आहे", CAT_DRAINAGE),
    ("नाल्याची सफाई न झाल्याने काळे दुर्गंधीयुक्त पाणी वस्तीत पसरले आहे", CAT_DRAINAGE),
    ("मॅनहोल उघडे आहे, लहान मुले त्यात पडण्याचा गंभीर धोका आहे", CAT_DRAINAGE),
    ("ड्रेनेजचे पाणी उलट मारत असून शौचालयातून पाणी बाहेर येत आहे", CAT_DRAINAGE),
    ("गटारातील घाण पाणी रस्त्यावर साचून डासांची पैदास झाली आहे", CAT_DRAINAGE),

    # Hindi (Devanagari)
    ("गटर का गंदा काला पानी ओवरफ्लो होकर सड़क पर बह रहा है बदबू आ रही है", CAT_DRAINAGE),
    ("नाली जाम हो गई है और सीवर का बदबूदार पानी घरों में घुस रहा है", CAT_DRAINAGE),
    ("खुला मैनहोल बहुत खतरनाक है, सीवरेज का गंदा पानी सड़क पर भर गया है", CAT_DRAINAGE),
    ("ड्रेनेज लाइन चोक हो चुकी है, सीवर की सफाई तुरंत करवाई जाए", CAT_DRAINAGE),
    ("सीवर का ढक्कन टूटा हुआ है और गंदा पानी उबल कर बाहर आ रहा है", CAT_DRAINAGE),
    ("नाली की गाद नहीं निकाली गई जिससे गंदा पानी गलियों में भर गया है", CAT_DRAINAGE),
    ("सीवरेज बैकफ्लो हो रहा है टॉयलेट और बाथरूम में गंदा पानी आ रहा है", CAT_DRAINAGE),
    ("गटर की बदबू से मोहल्ले में रहना मुश्किल हो गया है, बीमारी का डर है", CAT_DRAINAGE),

    # Hinglish & Transliterated Marathi
    ("Gutter overflow hot ahe stinking black sewage water on road", CAT_DRAINAGE),
    ("Open manhole gutter overflowing with stinking black sewage water", CAT_DRAINAGE),
    ("Drainage line chokeup zali ahe sandpani baher yet ahe", CAT_DRAINAGE),
    ("Sewer drain blocked, foul smelling dirty sewage entering street", CAT_DRAINAGE),
    ("Gutter che zakhan tutle ahe open gutter very dangerous at night", CAT_DRAINAGE),
    ("Drainage water overflowing outside building, unbearable smell", CAT_DRAINAGE),
    ("Nali block ho gayi hai sewer ka ganda pani sadak par spread ho gaya", CAT_DRAINAGE),
    ("Manhole cover broken on road, sewage leaking all over", CAT_DRAINAGE),
    ("Stinking sewer backup in residential lane, please send suction truck", CAT_DRAINAGE),
    ("Gatar bharun vaahat ahe, mosquito problem and bad smell", CAT_DRAINAGE),

    # Disambiguation: explicitly contains "water" but is sewage/drainage
    ("Stinking black sewage water flooding into ground floor houses from blocked drain", CAT_DRAINAGE),
    ("Overflowing septic tank and drainage line pouring waste water onto street", CAT_DRAINAGE),
    ("Underground storm drain clogged with sludge causing filthy black water to pool", CAT_DRAINAGE),

    # =========================================================================
    # STREETLIGHT MALFUNCTION
    # =========================================================================
    # Marathi (Devanagari)
    ("गल्लीतील विजेचा खांब बंद आहे, रात्री पूर्ण अंधार पडतो", CAT_STREETLIGHTS),
    ("स्ट्रीट लाईटचा दिवा आठवडाभरापासून बंद आहे, चोऱ्यांची भीती वाटते", CAT_STREETLIGHTS),
    ("रस्त्यावरील विजेच्या खांबाची वायर तुटून लोंबकळत आहे, शॉक लागण्याची भीती", CAT_STREETLIGHTS),
    ("स्ट्रीट लाईट दिवसा सुरू राहते आणि रात्री बंद असते, सेन्सर खराब झाला आहे", CAT_STREETLIGHTS),
    ("विजेचा खांब वाकला असून कधीही खाली पडू शकतो", CAT_STREETLIGHTS),
    ("आमच्या चौकातील हायमास्ट दिवा बंद असून सर्वत्र काळोख पसरला आहे", CAT_STREETLIGHTS),
    ("स्ट्रीट लाईट लुकलुकत (ब्लिंक) करत आहे आणि आवाज येत आहे", CAT_STREETLIGHTS),
    ("पथदिवा दुरुस्त करावा, महिलांना रात्री चालणे असुरक्षित वाटते", CAT_STREETLIGHTS),
    ("विजेच्या खांबाचे झाकण उघडे असून आत उघड्या वायर्स आहेत", CAT_STREETLIGHTS),
    ("नवीन बसवलेला एलईडी पथदिवा जळून गेला आहे", CAT_STREETLIGHTS),

    # Hindi (Devanagari)
    ("स्ट्रीट लाइट बंद है रात को पूरा अंधेरा रहता है चलना मुश्किल है", CAT_STREETLIGHTS),
    ("सड़क की बत्तियां पिछले एक हफ्ते से खराब हैं, सुरक्षा का खतरा है", CAT_STREETLIGHTS),
    ("बिजली के खंभे पर खुला तार लटक रहा है करंट लगने का डर है", CAT_STREETLIGHTS),
    ("चौराहे की हाई मास्ट लाइट बंद पड़ी है चारों तरफ अंधेरा है", CAT_STREETLIGHTS),
    ("स्ट्रीट लाइट दिन में जलती है और रात में बंद हो जाती है", CAT_STREETLIGHTS),
    ("खंभा तिरछा हो गया है आंधी तूफान में कभी भी गिर सकता है", CAT_STREETLIGHTS),
    ("एलईडी लाइट खराब हो गई है रात में महिलाएं सुरक्षित महसूस नहीं करतीं", CAT_STREETLIGHTS),
    ("स्ट्रीट लाइट बार बार टिमटिमा रही है स्पार्किंग हो रही है", CAT_STREETLIGHTS),

    # Hinglish & Transliterated Marathi
    ("Galli madhe light pole band ahe andhar ahe night time", CAT_STREETLIGHTS),
    ("Street light not working since 4 days, pitch dark on street", CAT_STREETLIGHTS),
    ("Electricity pole wire hanging loose, danger of electric shock", CAT_STREETLIGHTS),
    ("Streetlight pole broken and dark at night, women feel unsafe", CAT_STREETLIGHTS),
    ("Sadak ki light kharab hai night me bohot andhera rehta hai", CAT_STREETLIGHTS),
    ("High mast tower light at square is off, replace bulbs", CAT_STREETLIGHTS),
    ("Light pole blinking continuously and making humming spark noise", CAT_STREETLIGHTS),
    ("Vijeecha khamb band ahe, please replace streetlight tube", CAT_STREETLIGHTS),
    ("Exposed wires inside street light pole base dangerous for pedestrians", CAT_STREETLIGHTS),
    ("Street lamp switch damaged, remains on during day and off at night", CAT_STREETLIGHTS),

    # =========================================================================
    # OTHER CIVIC ISSUE (Encroachment, Stray Animals, Noise, Trees, Pollution)
    # =========================================================================
    # Marathi (Devanagari)
    ("रस्त्यावर मेलेला कुत्रा पडला असून प्रचंड दुर्गंधी येत आहे, त्वरित उचलावा", CAT_OTHER),
    ("सार्वजनिक उद्यानात अनधिकृत झाडे तोडण्यात येत आहेत", CAT_OTHER),
    ("फुटपाथवर बेकायदेशीर स्टॉल्स आणि हातगाड्यांनी अतिक्रमण केले आहे", CAT_OTHER),
    ("रात्री उशिरापर्यंत लाऊडस्पीकरचा प्रचंड आवाज असतो, ध्वनी प्रदूषण होत आहे", CAT_OTHER),
    ("मोकाट जनावरे आणि भटक्या कुत्र्यांचा उपद्रव वाढला असून लहान मुलांना चावत आहेत", CAT_OTHER),
    ("जवळच्या कारखान्यातून विषारी धूर आणि रासायनिक वायू सोडला जात आहे", CAT_OTHER),
    ("सार्वजनिक स्वच्छतागृह अत्यंत घाण आणि बंद अवस्थेत आहे", CAT_OTHER),
    ("सार्वजनिक बागेतील लहान मुलांचे खेळणे तुटले असून गंजले आहेत", CAT_OTHER),
    ("अनधिकृत होर्डिंग आणि फलक रस्त्यावर लावले आहेत ज्यामुळे धोका निर्माण झाला आहे", CAT_OTHER),
    ("नदीमध्ये रासायनिक सांडपाणी सोडले जात आहे जलप्रदूषण झाले आहे", CAT_OTHER),

    # Hindi (Devanagari)
    ("सड़क पर मृत लावारिस जानवर पड़ा है बहुत बदबू आ रही है", CAT_OTHER),
    ("फुटपाथ पर अवैध कब्जा हो गया है लोगों को चलने की जगह नहीं है", CAT_OTHER),
    ("देर रात तक तेज आवाज में डीजे और लाउडस्पीकर बजता है ध्वनि प्रदूषण है", CAT_OTHER),
    ("आवारा कुत्तों का आतंक है, कई बच्चों को काट चुके हैं", CAT_OTHER),
    ("फैक्ट्री से जहरीला काला धुआं निकल रहा है सांस लेने में तकलीफ हो रही है", CAT_OTHER),
    ("सार्वजनिक पार्क में पौधे और झूले टूट गए हैं असामाजिक तत्व बैठते हैं", CAT_OTHER),
    ("अवैध बैनर और होर्डिंग से ट्रैफिक देखने में बाधा आ रही है", CAT_OTHER),
    ("सार्वजनिक शौचालय में ताला लगा है या बहुत बदबू आ रही है", CAT_OTHER),

    # Hinglish & Transliterated Marathi
    ("Dead stray dog lying on roadside since two days, remove immediately", CAT_OTHER),
    ("Stray cattle and cows blocking traffic on highway causing jams", CAT_OTHER),
    ("Illegal loudspeakers playing very loud music after 10 pm noise pollution", CAT_OTHER),
    ("Factory chemical smoke causing eye burning and air pollution", CAT_OTHER),
    ("Illegal vegetable hawkers encroachment on pedestrian walkway", CAT_OTHER),
    ("Public park gate broken, anti social elements drinking alcohol in park", CAT_OTHER),
    ("Dead animal carcass stinking near market, municipality vehicle needed", CAT_OTHER),
    ("Bhatke kutre चावले ahet, stray dog menace in residential colony", CAT_OTHER),
    ("Heavy construction noise during quiet hours disturbing students", CAT_OTHER),

    # =========================================================================
    # IRRELEVANT / SPAM / NON-CIVIC
    # =========================================================================
    ("asdkjasdklj 123456 !!!", CAT_SPAM),
    ("asdfghjkl qwertyuiop zxcvbnm", CAT_SPAM),
    ("111111111111111111111111111111", CAT_SPAM),
    ("test test testing 1 2 3 check check", CAT_SPAM),
    ("Hello good morning how are you all doing today", CAT_SPAM),
    ("Hi testing this application to see if it works", CAT_SPAM),
    ("Good evening sir, hope you have a wonderful weekend", CAT_SPAM),
    ("I want to buy a new iPhone 16 Pro Max 256GB at discount", CAT_SPAM),
    ("Selling second hand Maruti Swift car in excellent condition contact me", CAT_SPAM),
    ("Weather is very nice today enjoying hot tea and snacks", CAT_SPAM),
    ("Today Indian cricket team won the world cup match great victory", CAT_SPAM),
    ("Earn money online from home 50000 per month without investment", CAT_SPAM),
    ("Can someone tell me movie ticket price for latest Bollywood movie", CAT_SPAM),
    ("Happy Diwali to all friends and family members enjoy festive sweets", CAT_SPAM),
    ("Namaste kaise ho aap sab sab theek thak", CAT_SPAM),
    ("Majhe nav Rahul ahe mi ek mulga ahe", CAT_SPAM),
    ("My personal mobile phone is lost near bus stand please find it", CAT_SPAM),
    ("I need personal loan urgent 5 lakh rupees low interest", CAT_SPAM),
    ("Crypto bitcoin trading buy low sell high profitable scheme", CAT_SPAM),
    ("Looking for a flat 2bhk for rent in Mumbai with parking", CAT_SPAM),
    ("Please recharge my Airtel sim card with 299 pack", CAT_SPAM),
    ("Random text message sent by mistake ignore this", CAT_SPAM),
    ("zzzzzzzzzzzzz xxxxxxxxxxxxx wwwwwwwwwww", CAT_SPAM),
    ("abcd efgh ijkl mnop qrst uvwx yz", CAT_SPAM),
    ("Please call me back urgent my number is 9876543210", CAT_SPAM),
    ("What is the capital of India and who is prime minister", CAT_SPAM),
    ("Can I get pizza delivery near railway station", CAT_SPAM),
    ("Best gym near me for workout and weight loss", CAT_SPAM),
    ("Nice photo clicked yesterday on mountain trek", CAT_SPAM),
    ("Ha ha ha lol very funny jokes whatsapp status", CAT_SPAM),
]

def load_and_prepare_dataset():
    print("Loading base complaints dataset...")
    df_base = pd.read_csv(BASE_DATA_PATH)
    
    # Map old categories to canonical
    cat_map = {
        "Garbage": CAT_GARBAGE,
        "Road/Pothole": CAT_ROADS,
        "Water": CAT_WATER,
        "Drainage": CAT_DRAINAGE,
        "Streetlight": CAT_STREETLIGHTS,
        "Pollution": CAT_OTHER,
    }
    df_base["category"] = df_base["category"].map(cat_map)
    df_base = df_base.dropna(subset=["text", "category"])
    
    # Create DataFrame for multilingual and negative samples
    df_multi = pd.DataFrame(MULTILINGUAL_DATA, columns=["text", "category"])
    
    # Oversample the multilingual / edge-case data moderately so the model gets strong signals for Hindi/Marathi/Hinglish/Spam
    multi_expanded = pd.concat([df_multi] * 12, ignore_index=True)
    
    combined_df = pd.concat([df_base, multi_expanded], ignore_index=True)
    combined_df["text"] = combined_df["text"].astype(str).str.strip()
    combined_df["category"] = combined_df["category"].astype(str).str.strip()
    combined_df = combined_df[combined_df["text"].str.len() > 3]
    combined_df = combined_df.drop_duplicates(subset=["text", "category"])
    
    print(f"Total dataset size after merging: {len(combined_df)}")
    print("\nClass distribution:")
    print(combined_df["category"].value_counts())
    
    return combined_df

def train_and_evaluate():
    df = load_and_prepare_dataset()
    
    X = df["text"]
    y = df["category"]
    
    # Stratified split: 80% train, 20% test
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )
    
    print(f"\nTraining set size: {len(X_train)}")
    print(f"Testing set size:  {len(X_test)}")
    
    # Multilingual Feature Union: Word N-grams + Character Subword N-grams
    features = FeatureUnion([
        (
            "word_tfidf",
            TfidfVectorizer(
                analyzer="word",
                ngram_range=(1, 3),
                lowercase=True,
                strip_accents="unicode",
                min_df=2,
                max_df=0.95,
                sublinear_tf=True,
                max_features=50000,
            ),
        ),
        (
            "char_tfidf",
            TfidfVectorizer(
                analyzer="char_wb",
                ngram_range=(3, 5),
                lowercase=True,
                strip_accents="unicode",
                min_df=2,
                max_df=0.95,
                sublinear_tf=True,
                max_features=60000,
            ),
        ),
    ])
    
    base_clf = LinearSVC(
        C=1.5,
        class_weight="balanced",
        random_state=42,
        max_iter=3000,
    )
    
    # Calibrated probabilities via sigmoid cross-validation
    calibrated_clf = CalibratedClassifierCV(
        estimator=base_clf,
        method="sigmoid",
        cv=3,
    )
    
    model = Pipeline([
        ("features", features),
        ("classifier", calibrated_clf),
    ])
    
    print("\nTraining Calibrated Multilingual Complaint Verifier Pipeline...")
    model.fit(X_train, y_train)
    
    print("Evaluating on held-out test split...")
    y_pred = model.predict(X_test)
    y_proba = model.predict_proba(X_test)
    
    acc = accuracy_score(y_test, y_pred)
    prec_macro = precision_score(y_test, y_pred, average="macro", zero_division=0)
    rec_macro = recall_score(y_test, y_pred, average="macro", zero_division=0)
    f1_macro = f1_score(y_test, y_pred, average="macro", zero_division=0)
    
    prec_weighted = precision_score(y_test, y_pred, average="weighted", zero_division=0)
    rec_weighted = recall_score(y_test, y_pred, average="weighted", zero_division=0)
    f1_weighted = f1_score(y_test, y_pred, average="weighted", zero_division=0)
    
    classes = list(model.classes_)
    cm = confusion_matrix(y_test, y_pred, labels=classes)
    report = classification_report(y_test, y_pred, labels=classes, zero_division=0)
    
    print("=" * 80)
    print("TEST SET EVALUATION METRICS:")
    print("=" * 80)
    print(f"Accuracy:           {acc * 100:.2f}%")
    print(f"Macro Precision:    {prec_macro * 100:.2f}%")
    print(f"Macro Recall:       {rec_macro * 100:.2f}%")
    print(f"Macro F1-Score:     {f1_macro * 100:.2f}%")
    print(f"Weighted Precision: {prec_weighted * 100:.2f}%")
    print(f"Weighted Recall:    {rec_weighted * 100:.2f}%")
    print(f"Weighted F1-Score:  {f1_weighted * 100:.2f}%")
    print("\nClassification Report:\n", report)
    
    print("\nConfusion Matrix (Labels order):")
    for idx, c in enumerate(classes):
        print(f"  [{idx}] {c}")
    print(cm)
    
    # Save model artifact
    OUTPUT_MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, OUTPUT_MODEL_PATH)
    print(f"\nModel successfully saved to {OUTPUT_MODEL_PATH} ({os.path.getsize(OUTPUT_MODEL_PATH) / 1024 / 1024:.2f} MB)")
    
    return model

if __name__ == "__main__":
    train_and_evaluate()
