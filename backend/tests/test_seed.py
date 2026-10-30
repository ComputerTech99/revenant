"""Verify the seeded demo deck, multi-tier path health, and timewarp reset."""

from app import main
from app.seed import load_seed


def test_seed_is_idempotent_and_populates_all_health_tiers():
    load_seed()
    deck_id = load_seed()

    decks = main.list_decks()
    assert len(decks) == 1
    assert decks[0]["deck_id"] == deck_id
    assert decks[0]["due_count"] == 3
    assert decks[0]["mastery_pct"] == 25.0
    assert decks[0]["card_count"] == 8

    path = main.deck_path(deck_id)
    statuses = [c["status"] for c in path]
    assert statuses == ["mastered", "learning", "shaky", "new"]
    assert all(c["card_count"] == 2 for c in path)

    due = main.due_cards(deck_id=deck_id)
    assert [c["type"] for c in due] == ["mcq", "explain", "cloze"]

    stats_before = main.get_stats()
    assert stats_before["streak"] == 4
    assert stats_before["freezes"] == 1
    assert stats_before["reviews_today"] == 2
    assert stats_before["goal_met"] is False

    # Timewarp 7 days consumes freeze and resets streak; reset restores it
    main.timewarp(main.TimewarpBody(days=7))
    warped_stats = main.get_stats()
    assert warped_stats["streak"] == 0

    main.reset()
    restored_stats = main.get_stats()
    assert restored_stats["streak"] == 4
    assert restored_stats["freezes"] == 1
