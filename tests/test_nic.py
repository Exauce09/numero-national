"""Unit tests for structured RDC NIC v3 (14 digits, no country code)."""

from __future__ import annotations

from datetime import date

from apps.api.domains.core_registry.enums import Sex
from apps.api.domains.core_registry.nic_service import (
    ALGORITHM_VERSION,
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


def test_luhn_helpers_still_available():
    assert luhn_check_digit("7992739871") == "3"
    assert verify_luhn("79927398713")


def test_generated_nic_format_v3():
    for _ in range(50):
        nic = generate_candidate_nic(
            province_code="KIN",
            city="Kinshasa",
            commune_code="KIN-Gombe",
            sex=Sex.MALE,
            date_of_birth=date(1990, 5, 17),
        )
        assert len(nic) == NIC_TOTAL_LENGTH == 14
        assert nic.isdigit()
        assert is_valid_nic_format(nic)
        fields = parse_nic_fields(nic)
        assert fields["province"] == encode_province("KIN")
        assert fields["sex"] == "1"
        assert fields["birth_year"] == "1990"
        assert len(fields["sequence"]) == 4
        assert len(fields["territory"]) == 3


def test_prefix_encodes_province_territory_sex_year_no_country():
    prefix = build_semantic_prefix(
        nationality="COD",
        province_code="KIN",
        city="Gombe",
        sex=Sex.FEMALE,
        date_of_birth=date(1985, 1, 1),
    )
    assert len(prefix) == 10
    assert NIC_PAYLOAD_LENGTH == 14
    assert prefix[0:2] == encode_province("KIN")
    assert prefix[5] == encode_sex(Sex.FEMALE)
    assert prefix[6:10] == "1985"
    # Pas de code pays (ex. 18) en tête
    assert not prefix.startswith("18")


def test_same_identity_same_prefix_different_sequence():
    kwargs = dict(
        province_code="NKV",
        city="Goma",
        sex=Sex.MALE,
        date_of_birth=date(2001, 3, 3),
    )
    a = generate_candidate_nic(**kwargs, sequence=1)
    b = generate_candidate_nic(**kwargs, sequence=2)
    assert a[:10] == b[:10]
    assert a != b
    fields = parse_nic_fields(a)
    assert fields["province"] == encode_province("NKV")
    assert fields["sex"] == "1"
    assert fields["birth_year"] == "2001"
    assert fields["sequence"] == "0001"


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
    assert ALGORITHM_VERSION == "v3-rdc-14"


def test_invalid_nic_rejected():
    assert not is_valid_nic_format("123")
    assert not is_valid_nic_format("abcdefghijklmn")
    assert not is_valid_nic_format("1234567890123")  # 13 digits
    assert is_valid_nic_format("01001119900001")


def test_all_provinces_have_numeric_codes():
    from apps.api.domains.geography.seed_data import PROVINCES
    from apps.api.domains.core_registry.nic_service import PROVINCE_NUMERIC

    assert len(PROVINCE_NUMERIC) == len(PROVINCES) == 26
    assert encode_province("KIN") == "01"
