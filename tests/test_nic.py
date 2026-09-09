"""Unit tests for structured RDC NIC (14 digits)."""

from __future__ import annotations

from datetime import date

from apps.api.domains.core_registry.enums import Sex
from apps.api.domains.core_registry.nic_service import (
    ALGORITHM_VERSION,
    COUNTRY_CODE_RDC,
    NIC_PAYLOAD_LENGTH,
    NIC_TOTAL_LENGTH,
    build_semantic_prefix,
    encode_province,
    encode_sex,
    generate_candidate_nic,
    is_valid_nic_format,
    luhn_check_digit,
    parse_nic_fields,
    verify_luhn,
)


def test_luhn_check_digit_known_vector():
    assert luhn_check_digit("7992739871") == "3"
    assert verify_luhn("79927398713")


def test_generated_nic_format_and_check_digit():
    for _ in range(50):
        nic = generate_candidate_nic(
            province_code="KIN",
            city="Kinshasa",
            commune_code="KIN-Gombe",
            sex=Sex.MALE,
            date_of_birth=date(1990, 5, 17),
        )
        assert len(nic) == NIC_TOTAL_LENGTH
        assert nic.isdigit()
        assert len(nic[:-1]) == NIC_PAYLOAD_LENGTH
        assert nic[-1] == luhn_check_digit(nic[:-1])
        assert is_valid_nic_format(nic)


def test_prefix_encodes_country_province_sex_year():
    prefix = build_semantic_prefix(
        nationality="COD",
        province_code="KIN",
        city="Gombe",
        sex=Sex.FEMALE,
        date_of_birth=date(1985, 1, 1),
    )
    assert len(prefix) == 9
    assert prefix.startswith(COUNTRY_CODE_RDC)
    assert prefix[2:4] == encode_province("KIN")
    assert prefix[6] == encode_sex(Sex.FEMALE)
    assert prefix[7:9] == "85"


def test_same_identity_same_prefix_different_sequence():
    kwargs = dict(
        province_code="NKV",
        city="Goma",
        sex=Sex.MALE,
        date_of_birth=date(2001, 3, 3),
    )
    a = generate_candidate_nic(**kwargs, sequence=1)
    b = generate_candidate_nic(**kwargs, sequence=2)
    assert a[:9] == b[:9]
    assert a != b
    fields = parse_nic_fields(a)
    assert fields["country"] == "18"
    assert fields["province"] == encode_province("NKV")
    assert fields["sex"] == "1"
    assert fields["birth_year"] == "01"


def test_generated_nics_are_unique_across_batch():
    batch = {
        generate_candidate_nic(
            province_code="KIN",
            sex=Sex.MALE,
            date_of_birth=date(1990, 1, 1),
            sequence=i,
        )
        for i in range(500)
    }
    assert len(batch) == 500


def test_algorithm_version_constant():
    assert ALGORITHM_VERSION == "v2-rdc-14"


def test_invalid_nic_rejected():
    assert not is_valid_nic_format("123")
    assert not is_valid_nic_format("abcdefghijklmn")
    payload = "1801011900001"
    wrong_check = str((int(luhn_check_digit(payload)) + 1) % 10)
    wrong = payload + wrong_check
    assert not verify_luhn(wrong)
    assert not is_valid_nic_format(wrong)


def test_all_provinces_have_numeric_codes():
    from apps.api.domains.geography.seed_data import PROVINCES
    from apps.api.domains.core_registry.nic_service import PROVINCE_NUMERIC

    assert len(PROVINCE_NUMERIC) == len(PROVINCES) == 26
    assert encode_province("KIN") == "01"
