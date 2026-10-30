from __future__ import annotations

import copy
import json
from pathlib import Path

import pytest

from cue.agent.runtime import AgentRuntime

PACK = json.loads((Path(__file__).resolve().parents[1] / "cue" / "data" / "show.json").read_text(encoding="utf-8"))

QUESTIONS = [
    "Why is the front truss over?",
    "How much power does AERIAL 12 draw?",
    "What is the house supply?",
    "Does the drop blind the front row?",
    "What does the front row see?",
    "Why is the six-beam look safer?",
    "What does the drop cost?",
    "Are we over the approved budget?",
    "Which clip is missing?",
    "When is SIGNAL BARS due?",
    "Which rights expire before Paris?",
    "Can we use MONOLITH in London?",
    "What is the next show?",
    "What is the load-in at the next venue?",
    "What is the curfew in Copenhagen?",
    "Why is the venue profile stale?",
    "Who signs the cue sheet?",
    "Who approves the show version?",
    "What is the risk with the truss?",
    "What changed since the last look?",
]


@pytest.mark.parametrize("question", QUESTIONS)
def test_answers_are_cited_and_read_only(question: str) -> None:
    before = copy.deepcopy(PACK)
    answer = AgentRuntime(PACK).ask(question, active_look_id="look-aerial-12")
    assert answer["title"]
    assert answer["body"]
    assert answer["citations"], question
    assert PACK == before
