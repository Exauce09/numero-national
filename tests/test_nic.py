"""Unit tests for NIC generation — format, Luhn, uniqueness, no PII encoding."""

from __future__ import annotations

from collections import Counter
from datetime import date

from apps.api.domains.core_registry.nic_service import (
    ALGORITHM_VERSION,
    NIC_PAYLOAD_LENGTH,
    NIC_TOTAL_LENGTH,
    generate_candidate_nic,
    is_valid_nic_format,
    luhn_check_digit,
    verify_luhn,
)


def test_luhn_check_digit_known_vector():
    """Classic Luhn test vector: 7992739871 → check digit 3."""
    assert luhn_check_digit("7992739871") == "3"
    assert verify_luhn("79927398713")


def test_generated_nic_format_and_check_digit():
    for _ in range(50):
        nic = generate_candidate_nic()
        assert len(nic) == NIC_TOTAL_LENGTH
        assert nic.isdigit()
        assert len(nic[:-1]) == NIC_PAYLOAD_LENGTH
        assert nic[-1] == luhn_check_digit(nic[:-1])
        assert is_valid_nic_format(nic)
        assert verify_luhn(nic)


def test_generated_nics_are_unique_across_batch():
    batch = {generate_candidate_nic() for _ in range(500)}
    assert len(batch) == 500


def test_nic_does_not_encode_dob_or_sex():
    """
    Two citizens with the same DOB (and sex) must not receive related NICs.

    Relatedness checks:
    - NICs must differ
    - Shared prefix of meaningful length must be rare (no DOB embedding like YYMMDD)
    - Digit distribution should not collapse to DOB digits
    """
    dob = date(1990, 5, 17)
    dob_compact = dob.strftime("%Y%m%d")  # 19900517
    dob_yy = dob.strftime("%y%m%d")  # 900517

    nics = [generate_candidate_nic() for _ in range(40)]
    assert len(set(nics)) == len(nics)

    # No NIC should contain the full DOB compact forms as a contiguous substring.
    for nic in nics:
        assert dob_compact not in nic
        assert dob_yy not in nic

    # Prefix correlation: first 6 digits should not be identical across the batch
    # (would indicate provincial/DOB encoding).
    prefixes = [n[:6] for n in nics]
    most_common_count = Counter(prefixes).most_common(1)[0][1]
    assert most_common_count <= 2, "Unexpected shared NIC prefixes suggest structured encoding"

    # Sex markers (often 1/2 in structured NICs) must not dominate a fixed position.
    for pos in range(NIC_TOTAL_LENGTH - 1):
        digit_counts = Counter(n[pos] for n in nics)
        # No single digit should appear in >70% of samples at a fixed position.
        assert digit_counts.most_common(1)[0][1] / len(nics) < 0.70


def test_algorithm_version_constant():
    assert ALGORITHM_VERSION.startswith("v1")


def test_invalid_nic_rejected():
    assert not is_valid_nic_format("123")
    assert not is_valid_nic_format("abcdefghijklm")
    payload = "123456789012"
    wrong_check = str((int(luhn_check_digit(payload)) + 1) % 10)
    wrong = payload + wrong_check
    assert not verify_luhn(wrong)
    assert not is_valid_nic_format(wrong)
