"""Champs fiche FGP RDC (décret 22/07 art. 8) sur CitizenCreate."""

from datetime import date

from apps.api.domains.core_registry.schemas import CitizenCreate


def test_citizen_create_accepts_rdc_identity_fields():
    body = CitizenCreate(
        family_name="Kabila",
        post_name="Kabange",
        given_names="Joseph",
        other_names="JK",
        sex="MALE",
        date_of_birth=date(1971, 6, 4),
        place_of_birth="Kinshasa",
        birth_certificate_number="ACT-1971-001",
        nationality="COD",
        marital_status="MARRIED",
        occupation="Fonctionnaire",
        height_cm=175,
        eye_color="Brun",
        phone="+243810000000",
        email="demo@example.cd",
        origin_province="Haut-Katanga",
        origin_territory="Lubumbashi",
        father_full_name="Père Test",
        father_nationality="COD",
        mother_full_name="Mère Test",
        mother_nationality="COD",
    )
    assert body.post_name == "Kabange"
    assert body.marital_status == "MARRIED"
    assert body.height_cm == 175
    assert body.father_full_name == "Père Test"


def test_empty_optional_strings_become_none():
    body = CitizenCreate(
        family_name="X",
        given_names="Y",
        date_of_birth=date(2000, 1, 1),
        post_name="   ",
        phone="",
    )
    assert body.post_name is None
    assert body.phone is None
