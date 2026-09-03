import pytest

from app.services.validation import InvalidCompanyNameError, validate_company_name


def test_valid_name_is_trimmed():
    assert validate_company_name("  Microsoft  ") == "Microsoft"


def test_valid_short_name_with_letters_and_digits():
    assert validate_company_name("3M") == "3M"


def test_empty_string_rejected():
    with pytest.raises(InvalidCompanyNameError):
        validate_company_name("")


def test_whitespace_only_rejected():
    with pytest.raises(InvalidCompanyNameError):
        validate_company_name("     ")


def test_none_rejected():
    with pytest.raises(InvalidCompanyNameError):
        validate_company_name(None)


def test_gibberish_symbols_only_rejected():
    with pytest.raises(InvalidCompanyNameError):
        validate_company_name("!!!###")


def test_digits_only_rejected():
    with pytest.raises(InvalidCompanyNameError):
        validate_company_name("12345")


def test_too_long_rejected():
    with pytest.raises(InvalidCompanyNameError):
        validate_company_name("A" * 300)


def test_internal_whitespace_collapsed():
    assert validate_company_name("Micro   soft") == "Micro soft"
