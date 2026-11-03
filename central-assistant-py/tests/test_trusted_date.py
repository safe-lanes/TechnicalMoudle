"""3-Nov-2026: the trusted as-of date given to the model (agent.trusted_date_block)."""
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

import pytest

from app import agent
from app.config import settings


@pytest.fixture(autouse=True)
def _clean(monkeypatch):
    monkeypatch.setenv("ASSISTANT_AS_OF", "")
    monkeypatch.setenv("ASSISTANT_TIMEZONE", "UTC")
    settings.cache_clear()
    yield
    settings.cache_clear()


def _block(iso, instance=None):
    return agent.trusted_date_block(instance, now=datetime.fromisoformat(iso).replace(tzinfo=timezone.utc))


def test_current_and_previous_month():
    b = _block("2026-11-03T05:00:00")
    assert "today is 2026-11-03 (UTC)" in b
    assert "Current month = 2026-11 (2026-11-01 to 2026-11-30)" in b
    assert "Last month / previous month = 2026-10 (2026-10-01 to 2026-10-31)" in b


def test_january_crosses_the_year():
    b = _block("2027-01-15T12:00:00")
    assert "Current month = 2027-01 (2027-01-01 to 2027-01-31)" in b
    assert "Last month / previous month = 2026-12 (2026-12-01 to 2026-12-31)" in b
    assert "Current year = 2027; last year = 2026" in b


def test_month_lengths_and_leap_year():
    assert "2028-02 (2028-02-01 to 2028-02-29)" in _block("2028-03-31T00:00:00")   # previous month of 31 March, leap February
    assert "2028-02-01 to 2028-02-29" in _block("2028-02-10T00:00:00")             # current leap February
    assert "2027-02 (2027-02-01 to 2027-02-28)" in _block("2027-03-01T00:00:00")   # first of the month


def test_registration_time_zone_decides_the_day():
    # 31 Dec 20:00 UTC is already 1 Jan in Singapore: 'last month' is December there, November in UTC
    assert "Last month / previous month = 2026-11" in _block("2026-12-31T20:00:00")
    try:
        ZoneInfo("Asia/Singapore")
    except Exception:
        pytest.skip("no zone database on this host (the assistant image is checked separately)")
    sg = _block("2026-12-31T20:00:00", {"timezone": "Asia/Singapore"})
    assert "today is 2027-01-01 (Asia/Singapore)" in sg and "Last month / previous month = 2026-12" in sg


def test_unknown_zone_falls_back_to_utc():
    assert "(UTC)" in _block("2026-11-03T05:00:00", {"timezone": "Not/AZone"})


def test_pin_is_honoured(monkeypatch):
    monkeypatch.setenv("ASSISTANT_AS_OF", "2027-01-15")
    settings.cache_clear()
    assert "today is 2027-01-15" in _block("2026-11-03T05:00:00")


def test_static_prompt_text_is_unchanged_by_the_date():
    # the block is appended per run only; the hashed static prompts carry no date
    for mod in ("technical", "crewing", "audit", "safety", "incident"):
        assert "RULE — dates" not in agent.tool_loop_instructions(mod)


def test_rolling_parameter_warning_names_the_traps():
    b = _block("2026-11-03T05:00:00")
    assert "lastMonths: 1 is the CURRENT month" in b
    assert "dateRange week/month/quarter/year is a range counted from today, NOT a calendar period" in b
    assert "give no count for that period" in b
