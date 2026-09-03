"""
Validation for user-supplied company names.

This is intentionally lightweight: we're not trying to verify that a
company actually exists (that's what the research step is for). We just
want to reject obviously-empty or obviously-unusable input before we spend
a search + LLM call on it.
"""

import re

MIN_LENGTH = 2
MAX_LENGTH = 200

# Must contain at least two letters somewhere, so "3M" passes but "12345"
# or "!!!" do not.
_HAS_LETTERS = re.compile(r"[a-zA-Z]{2,}")


class InvalidCompanyNameError(ValueError):
    """Raised when the supplied company name fails validation."""


def validate_company_name(raw: str) -> str:
    """
    Validate and normalize a company name.

    Returns the trimmed, normalized name on success.
    Raises InvalidCompanyNameError with a human-readable message on failure.
    """
    if raw is None:
        raise InvalidCompanyNameError("Please enter a valid company name.")

    name = raw.strip()

    if not name:
        raise InvalidCompanyNameError("Please enter a valid company name.")

    if len(name) < MIN_LENGTH:
        raise InvalidCompanyNameError("Please enter a valid company name.")

    if len(name) > MAX_LENGTH:
        raise InvalidCompanyNameError("Company name is too long.")

    if not _HAS_LETTERS.search(name):
        raise InvalidCompanyNameError("Please enter a valid company name.")

    # Collapse internal whitespace ("  Micro   soft ") -> "Micro soft"
    name = re.sub(r"\s+", " ", name)

    return name
