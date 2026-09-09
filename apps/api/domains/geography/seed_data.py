"""Référentiel géographique RDC — communes urbaines (CENI / découpage officiel) + quartiers / voies."""

from __future__ import annotations

# provinces: (code, name, chef_lieu)
PROVINCES: list[tuple[str, str, str]] = [
    ("KIN", "Kinshasa", "Kinshasa"),
    ("BC", "Kongo Central", "Matadi"),
    ("KWG", "Kwango", "Kenge"),
    ("KWL", "Kwilu", "Bandundu"),
    ("MND", "Mai-Ndombe", "Inongo"),
    ("EQT", "Équateur", "Mbandaka"),
    ("MNG", "Mongala", "Lisala"),
    ("NUB", "Nord-Ubangi", "Gbadolite"),
    ("SUB", "Sud-Ubangi", "Gemena"),
    ("TSH", "Tshuapa", "Boende"),
    ("TSHO", "Tshopo", "Kisangani"),
    ("BUE", "Bas-Uélé", "Buta"),
    ("HUE", "Haut-Uélé", "Isiro"),
    ("ITU", "Ituri", "Bunia"),
    ("NKV", "Nord-Kivu", "Goma"),
    ("SKV", "Sud-Kivu", "Bukavu"),
    ("MNM", "Maniema", "Kindu"),
    ("HKT", "Haut-Katanga", "Lubumbashi"),
    ("LLB", "Lualaba", "Kolwezi"),
    ("HLM", "Haut-Lomami", "Kamina"),
    ("TGY", "Tanganyika", "Kalemie"),
    ("KAS", "Kasaï", "Tshikapa"),
    ("KAC", "Kasaï Central", "Kananga"),
    ("KAO", "Kasaï Oriental", "Mbuji-Mayi"),
    ("LOM", "Lomami", "Kabinda"),
    ("SNK", "Sankuru", "Lusambo"),
]

# Kinshasa — 4 districts / 24 communes
KIN_DISTRICTS: dict[str, list[str]] = {
    "Lukunga": ["Gombe", "Kinshasa", "Barumbu", "Kintambo", "Lingwala", "Ngaliema"],
    "Funa": ["Kasa-Vubu", "Kalamu", "Ngiri-Ngiri", "Bandalungwa", "Bumbu", "Makala", "Selembao"],
    "Mont-Amba": ["Lemba", "Mont-Ngafula", "Kisenso", "Limete", "Matete", "Ngaba"],
    "Tshangu": ["Ndjili", "Kimbanseke", "Masina", "Nsele", "Maluku"],
}

# Quartiers officiels Kinshasa (liste fournie — commune → quartiers).
# Avenues : OpenStreetMap par commune (kinshasa_avenues_data.py) ; sinon génériques.
KINSHASA_QUARTIERS: dict[str, list[str]] = {
    "Barumbu": [
        "Bitshaku-Tshaku",
        "Funa I",
        "Funa II",
        "Kapinga Bapu",
        "Kasai",
        "Libulu",
        "Mozindo",
        "N'dolo",
        "Tshimanga",
    ],
    "Kinshasa": [
        "Madimba",
        "Ngabaka",
        "Mongala",
        "Aketi",
        "Djalo",
        "Pende",
        "Boyoma",
    ],
    "Bumbu": [
        "Mongala",
        "Ubangi",
        "Lokoro",
        "Maindombe",
        "Kwango",
        "Lukenie",
        "Kasai",
        "Mfimi",
        "Lieutenant Mbaki",
        "Dipiya",
        "Ntomba",
        "Mbandaka",
        "Matadi",
    ],
    "Kalamu": [
        "Matonge I",
        "Matonge II",
        "Matonge III",
        "Immo Congo",
        "Kauka I",
        "Kauka II",
        "Kauka III",
        "Yolo Nord I",
        "Yolo Nord II",
        "Yolo Nord III",
        "Yolo Sud I",
        "Yolo Sud II",
        "Yolo Sud III",
        "Yolo Sud IV",
        "Pinzi",
        "Kimbangu I",
        "Kimbangu II",
        "Kimbangu III",
    ],
    "Makala": [
        "Bagata",
        "Behumbu",
        "Bolima",
        "Kabila",
        "Kisantu",
        "Kwango",
        "Lemba village",
        "Mabulu I",
        "Mabulu II",
        "Malala",
        "Mawanga",
        "Mfidi",
        "Mikasi",
        "Salongo",
        "Selo",
        "Tampa",
        "Uele",
        "Wamba",
    ],
    "Ngiri-Ngiri": [
        "Assossa",
        "Diagenda",
        "Diomi",
        "Elengasa",
        "Khartoum",
        "Petit-Petit",
        "24 Novembre",
        "Saio I",
        "Saio II",
    ],
    "Lemba": [
        "Camp Mobutu (ex-Kabila)",
        "Camp Osso (Bumba Moaso)",
        "Commercial",
        "Echangeur",
        "Ecole",
        "Foire",
        "Gombele",
        "Kemi",
        "Kimpwanza",
        "Livulu",
        "Mandrandele",
        "Masano",
        "Mbanza-Lemba",
        "Molo",
        "Salongo",
    ],
    "Limete": [
        "Agricole",
        "Industriel",
        "Kingabwa",
        "Masiala (Général Masiala)",
        "Mateba",
        "Mayulu",
        "Mbamu",
        "Mfumu-Mvula",
        "Mombele",
        "Mososo",
        "Ndaru",
        "Nzadi",
        "Residentiel",
        "Salongo",
    ],
    "Ngaba": [
        "Baobab",
        "Bulambemba",
        "Luyi",
        "Mateba",
        "Mpila",
        "Mukulwa",
    ],
}

# province → ville → communes urbaines (sources CENI / découpage officiel)
CITY_COMMUNES: dict[str, dict[str, list[str]]] = {
    "Kinshasa": {
        "Kinshasa": [
            "Gombe",
            "Kinshasa",
            "Barumbu",
            "Kintambo",
            "Lingwala",
            "Ngaliema",
            "Kasa-Vubu",
            "Kalamu",
            "Ngiri-Ngiri",
            "Bandalungwa",
            "Bumbu",
            "Makala",
            "Selembao",
            "Lemba",
            "Mont-Ngafula",
            "Kisenso",
            "Limete",
            "Matete",
            "Ngaba",
            "Ndjili",
            "Kimbanseke",
            "Masina",
            "Nsele",
            "Maluku",
        ],
    },
    "Kongo Central": {
        "Matadi": ["Matadi", "Mvuzi", "Nzanza"],
        "Boma": ["Kabondo", "Kalamu", "Nzadi"],
        "Muanda": ["Muanda", "Kitona", "Banana"],
        "Mbanza-Ngungu": ["Mbanza-Ngungu", "Noki", "Madimba"],
        "Kisantu": ["Inkisi", "Ngeba", "Kintanu"],
    },
    "Kwango": {
        "Kenge": ["Masikita", "Mavula", "Cinq Mai", "Manonga", "Laurent Désiré Kabila"],
    },
    "Kwilu": {
        "Bandundu": ["Mayoyo", "Disasi", "Basoko"],
        "Kikwit": ["Kazamba", "Lukemi", "Nzinda", "Lukolela"],
    },
    "Mai-Ndombe": {
        "Inongo": ["Mpolo", "Mpongonzoli", "Bonse"],
    },
    "Équateur": {
        "Mbandaka": ["Mbandaka", "Wangata"],
    },
    "Mongala": {
        "Lisala": ["Bolikango", "Mongala"],
        "Bumba": ["Bumba", "Ebonda", "Loeka"],
    },
    "Nord-Ubangi": {
        "Gbadolite": ["Molegbe", "Gbadolite", "Nganza"],
    },
    "Sud-Ubangi": {
        "Gemena": ["Gbazubu", "Mont Gila", "Lac-Ntumba", "Labo"],
        "Zongo": ["Wango", "Nzulu"],
    },
    "Tshuapa": {
        "Boende": ["Boende", "Tshuapa"],
    },
    "Tshopo": {
        "Kisangani": ["Makiso", "Tshopo", "Kabondo", "Mangobo", "Lubunga", "Kisangani"],
        "Yangambi": ["Yangambi", "Isangi"],
    },
    "Bas-Uélé": {
        "Buta": ["Tepatondele", "Finant", "Dobea", "Babade"],
    },
    "Haut-Uélé": {
        "Isiro": ["Mambaya", "Mendambo", "Kupa"],
    },
    "Ituri": {
        "Bunia": ["Shari", "Nyakasanza", "Mbunya"],
    },
    "Nord-Kivu": {
        "Goma": ["Goma", "Karisimbi"],
        "Butembo": ["Kimemi", "Bulengera", "Mususa", "Vulamba"],
        "Beni": ["Mulekera", "Ruwenzori", "Bungulu", "Beu"],
    },
    "Sud-Kivu": {
        "Bukavu": ["Ibanda", "Kadutu", "Bagira", "Kasha"],
        "Uvira": ["Kalundu", "Kimanga", "Rombe"],
        "Baraka": ["Baraka Centre", "Kalundja", "Katanga"],
    },
    "Maniema": {
        "Kindu": ["Kasuku", "Alunguli", "Mikelenge"],
        "Kasongo": ["Kasongo", "Kabambare"],
    },
    "Haut-Katanga": {
        "Lubumbashi": ["Annexe", "Kamalondo", "Kampemba", "Katuba", "Kenya", "Lubumbashi", "Ruashi"],
        "Likasi": ["Kikula", "Likasi", "Panda", "Shituru"],
        "Kipushi": ["Kipushi", "Kamatanda"],
    },
    "Lualaba": {
        "Kolwezi": ["Dilala", "Manika"],
        "Fungurume": ["Fungurume", "Tenke"],
    },
    "Haut-Lomami": {
        "Kamina": ["Kamina", "Sobongo", "Dimayi"],
    },
    "Tanganyika": {
        "Kalemie": ["Kalemie", "Lac", "Lukuga"],
        "Kongolo": ["Kongolo", "Sola"],
    },
    "Kasaï": {
        "Tshikapa": ["Dibumba I", "Dibumba II", "Kanzala", "Mabondo", "Mbumba"],
        "Ilebo": ["Ilebo", "Mapangu"],
    },
    "Kasaï Central": {
        "Kananga": ["Kananga", "Katoka", "Lukonga", "Ndesha", "Nganza"],
    },
    "Kasaï Oriental": {
        "Mbuji-Mayi": ["Bipemba", "Dibindi", "Diulu", "Muya", "Kanshi"],
        "Miabi": ["Miabi", "Tshilenge"],
    },
    "Lomami": {
        "Kabinda": ["Kabondo", "Kabuelabuela", "Kajiba", "Mudingayi"],
        "Mwene-Ditu": ["Bondoyi", "Musadi", "Mwene-Ditu"],
    },
    "Sankuru": {
        "Lusambo": ["Kabondo", "Lupembe", "Tusuanganyi", "Lusambo"],
        "Lodja": ["Lodja", "Sankuru"],
        "Lumumba": ["Ewango", "Mibangu"],
    },
}

# (quartier, [(voie_type, nom), ...]) — clés: "Ville|Commune"
QUARTIERS_VOIES: dict[str, list[tuple[str, list[tuple[str, str]]]]] = {
    # ——— Kinshasa ———
    "Kinshasa|Gombe": [
        (
            "Centre-ville",
            [
                ("AVENUE", "du Port"),
                ("AVENUE", "de la Justice"),
                ("AVENUE", "du Commerce"),
                ("AVENUE", "des Aviateurs"),
                ("RUE", "Bureau"),
                ("RUE", "de la Poste"),
            ],
        ),
        (
            "Batetela",
            [
                ("AVENUE", "Batetela"),
                ("AVENUE", "Wagenia"),
                ("AVENUE", "Colonel Lukusa"),
                ("RUE", "Cliniques"),
                ("RUE", "des Cliniques"),
            ],
        ),
        (
            "Golf",
            [
                ("AVENUE", "du Golf"),
                ("AVENUE", "Roi Baudouin"),
                ("AVENUE", "de la Nation"),
                ("RUE", "Royale"),
            ],
        ),
        (
            "Révolution",
            [
                ("AVENUE", "de la Liberation"),
                ("AVENUE", "Flambeau"),
                ("RUE", "Trois Z"),
            ],
        ),
    ],
    "Kinshasa|Ngaliema": [
        (
            "Ma Campagne",
            [
                ("AVENUE", "de la Liberation"),
                ("AVENUE", "Mont Ngaliema"),
                ("RUE", "Pere Boka"),
                ("RUE", "Croisement"),
            ],
        ),
        (
            "Binza Delvaux",
            [
                ("AVENUE", "du 24 Novembre"),
                ("AVENUE", "By Pass"),
                ("RUE", "Delvaux"),
            ],
        ),
        (
            "Binza Ozone",
            [
                ("AVENUE", "de l'Universite"),
                ("AVENUE", "Kasa-Vubu"),
                ("RUE", "Ozone"),
            ],
        ),
        (
            "Binza Poids Lourds",
            [
                ("AVENUE", "Kasa-Vubu"),
                ("AVENUE", "Poids Lourds"),
                ("RUE", "Mukoso"),
            ],
        ),
        (
            "Djelo Binza",
            [
                ("AVENUE", "By Pass"),
                ("AVENUE", "du Plateau"),
                ("RUE", "Djelo"),
            ],
        ),
        (
            "Joli Parc",
            [
                ("AVENUE", "du Parc"),
                ("RUE", "des Orchidees"),
                ("RUE", "des Acacias"),
            ],
        ),
    ],
    "Kinshasa|Limete": [
        (
            "Residentiel",
            [
                ("AVENUE", "de la Science"),
                ("AVENUE", "Sendwe"),
                ("AVENUE", "de l'Universite"),
                ("RUE", "Mombele"),
            ],
        ),
        (
            "Industriel",
            [
                ("AVENUE", "des Usines"),
                ("AVENUE", "des Huileries"),
                ("RUE", "Trou du Loup"),
            ],
        ),
        (
            "Kingabwa",
            [
                ("AVENUE", "Kingabwa"),
                ("AVENUE", "Lumumba"),
                ("RUE", "Salongo"),
            ],
        ),
        (
            "Masano",
            [
                ("AVENUE", "Masano"),
                ("RUE", "Nzadi"),
                ("RUE", "Funa"),
            ],
        ),
    ],
    "Kinshasa|Kalamu": [
        (
            "Matonge",
            [
                ("AVENUE", "de la Victoire"),
                ("AVENUE", "Kasa-Vubu"),
                ("RUE", "Forescom"),
                ("RUE", "Kwango"),
            ],
        ),
        (
            "Yolo Nord",
            [
                ("AVENUE", "Kasa-Vubu"),
                ("AVENUE", "Yolo"),
                ("RUE", "Bumbu"),
            ],
        ),
        (
            "Yolo Sud",
            [
                ("AVENUE", "Kabasele"),
                ("RUE", "Yolo Sud"),
                ("RUE", "Commerce"),
            ],
        ),
        (
            "Fonction Publique",
            [
                ("AVENUE", "de la Liberte"),
                ("RUE", "Administrateurs"),
            ],
        ),
    ],
    "Kinshasa|Masina": [
        (
            "Sans Fil",
            [
                ("AVENUE", "de la Liberation"),
                ("AVENUE", "Bangala"),
                ("RUE", "Mpasa"),
            ],
        ),
        (
            "Marche",
            [
                ("AVENUE", "Bangala"),
                ("RUE", "Lokole"),
                ("RUE", "du Marche"),
            ],
        ),
        (
            "Pelende",
            [
                ("AVENUE", "Pelende"),
                ("RUE", "Mfumu Nkento"),
            ],
        ),
        (
            "Tshuenge",
            [
                ("AVENUE", "Tshuenge"),
                ("RUE", "Sans Fil"),
            ],
        ),
    ],
    "Kinshasa|Ndjili": [
        (
            "Quartier 1",
            [("AVENUE", "Sapeur"), ("AVENUE", "Kimbangu"), ("RUE", "Salongo")],
        ),
        (
            "Quartier 3",
            [("AVENUE", "Mbenseke"), ("RUE", "Ndjili"), ("RUE", "Eglise")],
        ),
        (
            "Quartier 5",
            [("AVENUE", "Lumumba"), ("RUE", "Quartier 5"), ("RUE", "Ecole")],
        ),
        (
            "Quartier 7",
            [("AVENUE", "Kimbangu"), ("RUE", "Mbenseke"), ("RUE", "Poste")],
        ),
        (
            "Quartier 10",
            [("AVENUE", "de l'Aeroport"), ("RUE", "Terminus"), ("RUE", "Taxi")],
        ),
    ],
    "Kinshasa|Kimbanseke": [
        (
            "Kingasani",
            [("AVENUE", "Kimbanseke"), ("AVENUE", "Kingasani"), ("RUE", "Mokali")],
        ),
        (
            "Bahumbu",
            [("AVENUE", "Bahumbu"), ("RUE", "Biyela"), ("RUE", "Ngombe")],
        ),
        (
            "Mokali",
            [("AVENUE", "Mokali"), ("RUE", "Salongo"), ("RUE", "Marche")],
        ),
        (
            "Camp Luka",
            [("AVENUE", "Camp Luka"), ("RUE", "des Combattants")],
        ),
    ],
    "Kinshasa|Lemba": [
        (
            "Righini",
            [("AVENUE", "de l'Universite"), ("AVENUE", "Righini"), ("RUE", "Campus")],
        ),
        (
            "Livulu",
            [("AVENUE", "Livulu"), ("RUE", "Salongo"), ("RUE", "Eglise")],
        ),
        (
            "Echangeur",
            [("AVENUE", "de l'Universite"), ("AVENUE", "By Pass"), ("RUE", "Echangeur")],
        ),
    ],
    "Kinshasa|Matete": [
        (
            "Sans Fil",
            [("AVENUE", "Matete"), ("RUE", "Salongo"), ("RUE", "Marche")],
        ),
        (
            "Debonhomme",
            [("AVENUE", "Debonhomme"), ("RUE", "Ecole"), ("RUE", "Eglise")],
        ),
        (
            "Batende",
            [("AVENUE", "Batende"), ("RUE", "Commerce")],
        ),
    ],
    "Kinshasa|Bandalungwa": [
        (
            "Makelele",
            [("AVENUE", "Kasa-Vubu"), ("AVENUE", "Makelele"), ("RUE", "Bandal")],
        ),
        (
            "Salongo",
            [("AVENUE", "Salongo"), ("RUE", "du Marche"), ("RUE", "Ecole")],
        ),
        (
            "Kasavubu",
            [("AVENUE", "Kasa-Vubu"), ("RUE", "Liberté")],
        ),
    ],
    "Kinshasa|Kasa-Vubu": [
        (
            "Ancienne Cite",
            [("AVENUE", "Kasa-Vubu"), ("AVENUE", "Victoire"), ("RUE", "Commerce")],
        ),
        (
            "Onatra",
            [("AVENUE", "Onatra"), ("RUE", "Gare"), ("RUE", "Port")],
        ),
    ],
    "Kinshasa|Barumbu": [
        (
            "Bitabe",
            [("AVENUE", "des Huileries"), ("AVENUE", "Lokole"), ("RUE", "Barumbu")],
        ),
        (
            "Aketi",
            [("AVENUE", "Aketi"), ("RUE", "Salongo"), ("RUE", "Marche")],
        ),
    ],
    "Kinshasa|Lingwala": [
        (
            "Lokole",
            [("AVENUE", "Lokole"), ("AVENUE", "de la Justice"), ("RUE", "Lingwala")],
        ),
        (
            "Cite Verte",
            [("AVENUE", "Cite Verte"), ("RUE", "Ecole")],
        ),
    ],
    "Kinshasa|Kintambo": [
        (
            "Magasin",
            [("AVENUE", "Kintambo"), ("AVENUE", "du Commerce"), ("RUE", "Magasin")],
        ),
        (
            "Salongo",
            [("AVENUE", "Salongo"), ("RUE", "Poste"), ("RUE", "Eglise")],
        ),
    ],
    "Kinshasa|Kinshasa": [
        (
            "Bumbu-Dibwe",
            [("AVENUE", "Kinshasa"), ("RUE", "Lokole"), ("RUE", "Marche")],
        ),
        (
            "3Z",
            [("AVENUE", "3Z"), ("RUE", "Commerce")],
        ),
    ],
    "Kinshasa|Bumbu": [
        ("Mitendi", [("AVENUE", "Bumbu"), ("AVENUE", "Kasavubu"), ("RUE", "Mitendi"), ("RUE", "Salongo")]),
        ("Riango", [("AVENUE", "Riango"), ("AVENUE", "du Marche"), ("RUE", "Marche"), ("RUE", "Ecole")]),
        ("Mbudi", [("AVENUE", "Mbudi"), ("AVENUE", "Bumbu"), ("RUE", "Ngafani"), ("RUE", "Lokole")]),
        ("Matadi-Kibala", [("AVENUE", "Matadi-Kibala"), ("AVENUE", "By Pass"), ("RUE", "Kibala")]),
        ("Camp Kokolo", [("AVENUE", "Camp Kokolo"), ("AVENUE", "Kasavubu"), ("RUE", "Militaire")]),
        ("Ngafani", [("AVENUE", "Ngafani"), ("AVENUE", "Salongo"), ("RUE", "Cite")]),
    ],
    "Kinshasa|Makala": [
        ("Mabulu", [("AVENUE", "Makala"), ("AVENUE", "Kasavubu"), ("RUE", "Mabulu"), ("RUE", "Ecole")]),
        ("Kabila", [("AVENUE", "Kabila"), ("AVENUE", "Salongo"), ("RUE", "Marche")]),
        ("Triomphe", [("AVENUE", "du Triomphe"), ("AVENUE", "Makala"), ("RUE", "Eglise")]),
        ("Pumbu", [("AVENUE", "Pumbu"), ("AVENUE", "By Pass"), ("RUE", "Lokole")]),
        ("Camp Luka", [("AVENUE", "Camp Luka"), ("RUE", "Militaire"), ("RUE", "Salongo")]),
    ],
    "Kinshasa|Selembao": [
        ("Ngansele", [("AVENUE", "Selembao"), ("AVENUE", "Kasavubu"), ("RUE", "Ngansele"), ("RUE", "Marche")]),
        ("Salongo", [("AVENUE", "Salongo"), ("AVENUE", "de la Paix"), ("RUE", "Eglise")]),
        ("Congo", [("AVENUE", "Congo"), ("AVENUE", "Selembao"), ("RUE", "Ecole")]),
        ("Herady", [("AVENUE", "Herady"), ("RUE", "Cite"), ("RUE", "Lokole")]),
        ("Ndjili Brasserie", [("AVENUE", "Ndjili Brasserie"), ("AVENUE", "By Pass"), ("RUE", "Brasserie")]),
    ],
    "Kinshasa|Ngiri-Ngiri": [
        (
            "Assossa",
            [("AVENUE", "Assossa"), ("AVENUE", "Kasa-Vubu"), ("RUE", "Ngiri"), ("RUE", "Marche")],
        ),
        (
            "Salongo",
            [("AVENUE", "Salongo"), ("RUE", "Marche")],
        ),
    ],
    "Kinshasa|Mont-Ngafula": [
        (
            "Kimwenza",
            [("AVENUE", "Kimwenza"), ("AVENUE", "Universite"), ("RUE", "Cathedrale")],
        ),
        (
            "Plateau",
            [("AVENUE", "du Plateau"), ("RUE", "Eglise"), ("RUE", "Ecole")],
        ),
        (
            "Matadi Kibala",
            [("AVENUE", "Matadi Kibala"), ("RUE", "Salongo")],
        ),
    ],
    "Kinshasa|Kisenso": [
        (
            "Mbuku",
            [("AVENUE", "Kisenso"), ("RUE", "Mbuku"), ("RUE", "Marche")],
        ),
        (
            "Salongo",
            [("AVENUE", "Salongo"), ("RUE", "Ecole")],
        ),
    ],
    "Kinshasa|Ngaba": [
        (
            "Mukulwa",
            [("AVENUE", "Ngaba"), ("RUE", "Mukulwa"), ("RUE", "Salongo")],
        ),
        (
            "Terminus",
            [("AVENUE", "Terminus"), ("RUE", "Marche")],
        ),
    ],
    "Kinshasa|Nsele": [
        (
            "Cite Mama Mobutu",
            [("AVENUE", "Nsele"), ("AVENUE", "de l'Aeroport"), ("RUE", "Cite")],
        ),
        (
            "Dumi",
            [("AVENUE", "Dumi"), ("RUE", "Village"), ("RUE", "Eglise")],
        ),
        (
            "Menkao",
            [("AVENUE", "Menkao"), ("RUE", "Salongo")],
        ),
    ],
    "Kinshasa|Maluku": [
        (
            "Kingabwa Maluku",
            [("AVENUE", "Maluku"), ("RUE", "Fleuve"), ("RUE", "Peche")],
        ),
        (
            "Minkambe",
            [("AVENUE", "Minkambe"), ("RUE", "Village")],
        ),
        (
            "Menkao Rural",
            [("AVENUE", "Principale"), ("RUE", "Marche"), ("RUE", "Ecole")],
        ),
    ],
    # ——— Lubumbashi ———
    "Lubumbashi|Lubumbashi": [
        (
            "Centre-ville",
            [
                ("AVENUE", "Kasa-Vubu"),
                ("AVENUE", "Moulaert"),
                ("AVENUE", "Sendwe"),
                ("RUE", "Kapenda"),
                ("RUE", "de la Poste"),
            ],
        ),
        (
            "Golf",
            [("AVENUE", "du Golf"), ("AVENUE", "Tabora"), ("RUE", "Royale")],
        ),
        (
            "Kenya Extension",
            [("AVENUE", "Likasi"), ("RUE", "Commerce")],
        ),
    ],
    "Lubumbashi|Katuba": [
        (
            "Katuba 1",
            [("AVENUE", "Katuba"), ("AVENUE", "Kasenga"), ("RUE", "Salongo")],
        ),
        (
            "Katuba 2",
            [("AVENUE", "Lumumba"), ("RUE", "Marche"), ("RUE", "Ecole")],
        ),
        (
            "Gecamines",
            [("AVENUE", "Gecamines"), ("RUE", "Mine"), ("RUE", "Cités")],
        ),
    ],
    "Lubumbashi|Kampemba": [
        (
            "Bel-Air",
            [("AVENUE", "Bel-Air"), ("AVENUE", "Kasenga"), ("RUE", "Eglise")],
        ),
        (
            "Hewa Bora",
            [("AVENUE", "Hewa Bora"), ("RUE", "Salongo"), ("RUE", "Marche")],
        ),
        (
            "Kalebuka",
            [("AVENUE", "Kalebuka"), ("RUE", "Commerce")],
        ),
    ],
    "Lubumbashi|Kenya": [
        (
            "Kenya 1",
            [("AVENUE", "Kenya"), ("AVENUE", "Kapenda"), ("RUE", "Marche")],
        ),
        (
            "Kenya 2",
            [("AVENUE", "Sendwe"), ("RUE", "Ecole"), ("RUE", "Eglise")],
        ),
    ],
    "Lubumbashi|Kamalondo": [
        (
            "Centre",
            [("AVENUE", "Kamalondo"), ("AVENUE", "Kapenda"), ("RUE", "Commerce")],
        ),
        (
            "Cite",
            [("AVENUE", "des Cités"), ("RUE", "Salongo")],
        ),
    ],
    "Lubumbashi|Ruashi": [
        (
            "Ruashi 1",
            [("AVENUE", "Ruashi"), ("AVENUE", "de l'Aeroport"), ("RUE", "Mine")],
        ),
        (
            "Ruashi 2",
            [("AVENUE", "Kasenga"), ("RUE", "Marche"), ("RUE", "Ecole")],
        ),
    ],
    "Lubumbashi|Annexe": [
        (
            "Kisanga",
            [("AVENUE", "Kisanga"), ("AVENUE", "Kasenga"), ("RUE", "Village")],
        ),
        (
            "Kawama",
            [("AVENUE", "Kawama"), ("RUE", "Mine"), ("RUE", "Eglise")],
        ),
        (
            "Karzepa",
            [("AVENUE", "Karzepa"), ("RUE", "Salongo")],
        ),
    ],
    # ——— Goma ———
    "Goma|Goma": [
        (
            "Les Volcans",
            [("AVENUE", "des Volcans"), ("AVENUE", "du Lac"), ("RUE", "Mikeno")],
        ),
        (
            "Himbi",
            [("AVENUE", "Himbi"), ("AVENUE", "du Commerce"), ("RUE", "Poste")],
        ),
        (
            "Keshero",
            [("AVENUE", "Keshero"), ("RUE", "Eglise"), ("RUE", "Ecole")],
        ),
        (
            "Mapendo",
            [("AVENUE", "Mapendo"), ("RUE", "Salongo")],
        ),
    ],
    "Goma|Karisimbi": [
        (
            "Mugunga",
            [("AVENUE", "Sake"), ("AVENUE", "Mugunga"), ("RUE", "Camp")],
        ),
        (
            "Mabanga Nord",
            [("AVENUE", "Mabanga"), ("RUE", "Nord"), ("RUE", "Marche")],
        ),
        (
            "Mabanga Sud",
            [("AVENUE", "Mabanga"), ("RUE", "Sud"), ("RUE", "Ecole")],
        ),
        (
            "Virunga",
            [("AVENUE", "Virunga"), ("RUE", "Parc"), ("RUE", "Tourisme")],
        ),
        (
            "Ndosho",
            [("AVENUE", "Ndosho"), ("RUE", "Salongo")],
        ),
        (
            "Majengo",
            [("AVENUE", "Majengo"), ("RUE", "Commerce")],
        ),
        (
            "Murara",
            [("AVENUE", "Murara"), ("RUE", "Eglise")],
        ),
        (
            "Kasika",
            [("AVENUE", "Kasika"), ("RUE", "Kahembe")],
        ),
    ],
    # ——— Bukavu ———
    "Bukavu|Ibanda": [
        (
            "Ndendere",
            [("AVENUE", "Patrice Lumumba"), ("AVENUE", "du Lac"), ("RUE", "Poste")],
        ),
        (
            "Panzi",
            [("AVENUE", "Panzi"), ("RUE", "Hopital"), ("RUE", "Eglise")],
        ),
        (
            "Cimpunda",
            [("AVENUE", "Cimpunda"), ("RUE", "Salongo")],
        ),
    ],
    "Bukavu|Kadutu": [
        (
            "Nyamugo",
            [("AVENUE", "Kadutu"), ("AVENUE", "Nyamugo"), ("RUE", "Marche")],
        ),
        (
            "Cahi",
            [("AVENUE", "Cahi"), ("RUE", "Commerce"), ("RUE", "Ecole")],
        ),
    ],
    "Bukavu|Bagira": [
        (
            "Nyantende",
            [("AVENUE", "Bagira"), ("RUE", "Nyantende"), ("RUE", "Eglise")],
        ),
        (
            "Lumina",
            [("AVENUE", "Lumina"), ("RUE", "Salongo")],
        ),
    ],
    "Bukavu|Kasha": [
        (
            "Kasha Centre",
            [("AVENUE", "Kasha"), ("RUE", "Marche"), ("RUE", "Ecole")],
        ),
    ],
    # ——— Kisangani ———
    "Kisangani|Makiso": [
        (
            "Centre-ville",
            [
                ("AVENUE", "du Commerce"),
                ("AVENUE", "des Aviculteurs"),
                ("AVENUE", "Lumumba"),
                ("RUE", "Poste"),
            ],
        ),
        (
            "Plateau Medical",
            [("AVENUE", "des Cliniques"), ("RUE", "Hopital"), ("RUE", "Universite")],
        ),
    ],
    "Kisangani|Tshopo": [
        (
            "Tshopo",
            [("AVENUE", "Tshopo"), ("AVENUE", "du Fleuve"), ("RUE", "Port")],
        ),
        (
            "Neema",
            [("AVENUE", "Neema"), ("RUE", "Salongo")],
        ),
    ],
    "Kisangani|Kabondo": [
        (
            "Kabondo",
            [("AVENUE", "Kabondo"), ("RUE", "Marche"), ("RUE", "Ecole")],
        ),
    ],
    "Kisangani|Mangobo": [
        (
            "Mangobo",
            [("AVENUE", "Mangobo"), ("RUE", "Salongo"), ("RUE", "Eglise")],
        ),
    ],
    "Kisangani|Lubunga": [
        (
            "Lubunga",
            [("AVENUE", "Lubunga"), ("AVENUE", "du Fleuve"), ("RUE", "Peche")],
        ),
    ],
    "Kisangani|Kisangani": [
        (
            "Cite",
            [("AVENUE", "Principale"), ("RUE", "Commerce"), ("RUE", "Marche")],
        ),
    ],
    # ——— Mbuji-Mayi ———
    "Mbuji-Mayi|Bipemba": [
        (
            "Bipemba Centre",
            [("AVENUE", "Bipemba"), ("AVENUE", "Lumumba"), ("RUE", "Diamant")],
        ),
        (
            "Cite",
            [("AVENUE", "des Cités"), ("RUE", "Marche"), ("RUE", "Ecole")],
        ),
    ],
    "Mbuji-Mayi|Dibindi": [
        (
            "Dibindi",
            [("AVENUE", "Dibindi"), ("AVENUE", "du Commerce"), ("RUE", "Poste")],
        ),
    ],
    "Mbuji-Mayi|Diulu": [
        (
            "Diulu",
            [("AVENUE", "Diulu"), ("RUE", "Salongo"), ("RUE", "Eglise")],
        ),
    ],
    "Mbuji-Mayi|Muya": [
        (
            "Muya",
            [("AVENUE", "Muya"), ("RUE", "Marche"), ("RUE", "Ecole")],
        ),
    ],
    "Mbuji-Mayi|Kanshi": [
        (
            "Kanshi",
            [("AVENUE", "Kanshi"), ("AVENUE", "Aeroport"), ("RUE", "Commerce")],
        ),
    ],
    # ——— Kananga ———
    "Kananga|Kananga": [
        (
            "Centre-ville",
            [("AVENUE", "Mobutu"), ("AVENUE", "du Commerce"), ("RUE", "Poste")],
        ),
        (
            "Plateau",
            [("AVENUE", "du Plateau"), ("RUE", "Administrateurs")],
        ),
    ],
    "Kananga|Ndesha": [
        (
            "Ndesha",
            [("AVENUE", "Ndesha"), ("RUE", "Marche"), ("RUE", "Ecole")],
        ),
    ],
    "Kananga|Katoka": [
        (
            "Katoka",
            [("AVENUE", "Katoka"), ("RUE", "Salongo"), ("RUE", "Eglise")],
        ),
    ],
    "Kananga|Lukonga": [
        (
            "Lukonga",
            [("AVENUE", "Lukonga"), ("RUE", "Commerce")],
        ),
    ],
    "Kananga|Nganza": [
        (
            "Nganza",
            [("AVENUE", "Nganza"), ("RUE", "Marche")],
        ),
    ],
    # ——— Matadi ———
    "Matadi|Matadi": [
        (
            "Ville Haute",
            [("AVENUE", "du Commerce"), ("AVENUE", "Metro"), ("RUE", "Poste")],
        ),
        (
            "Ville Basse",
            [("AVENUE", "du Port"), ("AVENUE", "du Fleuve"), ("RUE", "ONATRA")],
        ),
        (
            "Kinkanda",
            [("AVENUE", "Kinkanda"), ("RUE", "Hopital")],
        ),
    ],
    "Matadi|Mvuzi": [
        (
            "Mvuzi",
            [("AVENUE", "Mvuzi"), ("RUE", "Salongo"), ("RUE", "Ecole")],
        ),
    ],
    "Matadi|Nzanza": [
        (
            "Nzanza",
            [("AVENUE", "Nzanza"), ("RUE", "Marche"), ("RUE", "Eglise")],
        ),
    ],
    # ——— Kolwezi ———
    "Kolwezi|Dilala": [
        (
            "Dilala Centre",
            [("AVENUE", "Dilala"), ("AVENUE", "Gecamines"), ("RUE", "Mine")],
        ),
        (
            "Cite Gecamines",
            [("AVENUE", "des Cités"), ("RUE", "Salongo"), ("RUE", "Ecole")],
        ),
    ],
    "Kolwezi|Manika": [
        (
            "Manika",
            [("AVENUE", "Manika"), ("AVENUE", "du Commerce"), ("RUE", "Poste")],
        ),
    ],
    # ——— Kikwit ———
    "Kikwit|Nzinda": [
        (
            "Nzinda Centre",
            [("AVENUE", "Lumumba"), ("AVENUE", "du Commerce"), ("RUE", "Poste")],
        ),
    ],
    "Kikwit|Kazamba": [
        (
            "Kazamba",
            [("AVENUE", "Kazamba"), ("RUE", "Marche"), ("RUE", "Ecole")],
        ),
    ],
    "Kikwit|Lukemi": [
        (
            "Lukemi",
            [("AVENUE", "Lukemi"), ("RUE", "Salongo")],
        ),
    ],
    "Kikwit|Lukolela": [
        (
            "Lukolela",
            [("AVENUE", "Lukolela"), ("RUE", "Eglise")],
        ),
    ],
    # ——— Kindu ———
    "Kindu|Kasuku": [
        (
            "Kasuku Centre",
            [("AVENUE", "du Commerce"), ("AVENUE", "du Fleuve"), ("RUE", "Poste")],
        ),
    ],
    "Kindu|Alunguli": [
        (
            "Alunguli",
            [("AVENUE", "Alunguli"), ("RUE", "Marche"), ("RUE", "Ecole")],
        ),
    ],
    "Kindu|Mikelenge": [
        (
            "Mikelenge",
            [("AVENUE", "Mikelenge"), ("RUE", "Salongo")],
        ),
    ],
    # ——— Tshikapa ———
    "Tshikapa|Dibumba I": [
        (
            "Dibumba I",
            [("AVENUE", "Dibumba"), ("AVENUE", "du Commerce"), ("RUE", "Diamant")],
        ),
    ],
    "Tshikapa|Dibumba II": [
        (
            "Dibumba II",
            [("AVENUE", "Lumumba"), ("RUE", "Marche"), ("RUE", "Ecole")],
        ),
    ],
    "Tshikapa|Kanzala": [
        (
            "Kanzala",
            [("AVENUE", "Kanzala"), ("RUE", "Salongo")],
        ),
    ],
    # ——— Kalemie ———
    "Kalemie|Kalemie": [
        (
            "Centre",
            [("AVENUE", "du Lac"), ("AVENUE", "du Commerce"), ("RUE", "Port")],
        ),
    ],
    "Kalemie|Lac": [
        (
            "Lac",
            [("AVENUE", "Tanganyika"), ("RUE", "Peche"), ("RUE", "Marche")],
        ),
    ],
    "Kalemie|Lukuga": [
        (
            "Lukuga",
            [("AVENUE", "Lukuga"), ("RUE", "Salongo")],
        ),
    ],
    # ——— Bunia ———
    "Bunia|Shari": [
        (
            "Shari Centre",
            [("AVENUE", "Shari"), ("AVENUE", "du Commerce"), ("RUE", "Poste")],
        ),
    ],
    "Bunia|Nyakasanza": [
        (
            "Nyakasanza",
            [("AVENUE", "Nyakasanza"), ("RUE", "Marche"), ("RUE", "Ecole")],
        ),
    ],
    "Bunia|Mbunya": [
        (
            "Mbunya",
            [("AVENUE", "Mbunya"), ("RUE", "Salongo")],
        ),
    ],
    # ——— Mbandaka ———
    "Mbandaka|Mbandaka": [
        (
            "Centre-ville",
            [("AVENUE", "Equateur"), ("AVENUE", "du Fleuve"), ("RUE", "Poste")],
        ),
        (
            "Wangata Extension",
            [("AVENUE", "Wangata"), ("RUE", "Marche")],
        ),
    ],
    "Mbandaka|Wangata": [
        (
            "Wangata",
            [("AVENUE", "Wangata"), ("RUE", "Salongo"), ("RUE", "Eglise")],
        ),
    ],
}

# Modèle par défaut si commune sans détail spécifique (toujours ≥6 quartiers, ≥4 avenues)
DEFAULT_QUARTIERS: list[tuple[str, list[tuple[str, str]]]] = [
    (
        "Centre",
        [
            ("AVENUE", "Principale"),
            ("AVENUE", "du Commerce"),
            ("AVENUE", "de l'Independance"),
            ("AVENUE", "de la Liberte"),
            ("RUE", "du Marche"),
            ("RUE", "de la Poste"),
        ],
    ),
    (
        "Cite",
        [
            ("AVENUE", "des Cités"),
            ("AVENUE", "de la Paix"),
            ("AVENUE", "Lumumba"),
            ("RUE", "Ecole"),
            ("RUE", "Eglise"),
        ],
    ),
    (
        "Salongo",
        [
            ("AVENUE", "Salongo"),
            ("AVENUE", "des Combattants"),
            ("RUE", "Lokole"),
            ("RUE", "Kapela"),
        ],
    ),
    (
        "Mbudi",
        [
            ("AVENUE", "Mbudi"),
            ("AVENUE", "Kasavubu"),
            ("RUE", "Mabulu"),
            ("RUE", "Ngafani"),
        ],
    ),
    (
        "Masina",
        [
            ("AVENUE", "de la Liberte"),
            ("AVENUE", "Ngwaka"),
            ("RUE", "Salongo"),
            ("RUE", "Marche"),
        ],
    ),
    (
        "Mukulungu",
        [
            ("AVENUE", "Mukulungu"),
            ("AVENUE", "du 30 Juin"),
            ("RUE", "Ecole"),
            ("RUE", "Hopital"),
        ],
    ),
]
