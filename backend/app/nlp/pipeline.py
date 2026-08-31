"""Text annotation: language, sentiment, emotion, sarcasm, stance.

Two interchangeable implementations behind one interface:

  RuleAnnotator   lexicon + heuristics. No downloads, milliseconds per post,
                  and it handles romanised code-mix, which is most of why it
                  exists -- a monolingual model scores those as neutral.
  ModelAnnotator  transformers. XLM-R sentiment (multilingual, tuned on
                  social text) and a DistilRoBERTa emotion head.

The model annotator still borrows the rule layer for sarcasm, stance and
language, because those are the parts where an off-the-shelf English model is
worse than a targeted heuristic on this corpus.
"""
from __future__ import annotations

import re
from dataclasses import asdict, dataclass, field
from typing import Literal

Sentiment = Literal["pos", "neu", "neg"]


@dataclass
class Annotation:
    text: str
    lang: str = "English"
    sentiment: Sentiment = "neu"
    surface: Sentiment = "neu"          # sentiment before sarcasm resolution
    confidence: float = 0.5
    sarcasm: int = 0                    # 0-100
    emotion: str = "neutral"
    stance: str = "neutral"
    bot: int = 0                        # anomaly score, 0-100
    backend: str = "rules"

    def dict(self) -> dict:
        return asdict(self)


# --- script detection ------------------------------------------------------
SCRIPTS = [
    ("Hindi", re.compile(r"[ऀ-ॿ]")),
    ("Bengali", re.compile(r"[ঀ-৿]")),
    ("Tamil", re.compile(r"[஀-௿]")),
    ("Telugu", re.compile(r"[ఀ-౿]")),
    ("Kannada", re.compile(r"[ಀ-೿]")),
    ("Malayalam", re.compile(r"[ഀ-ൿ]")),
]

# Romanised markers. Code-mix is the common case in this corpus, so these
# decide between "Hinglish" and "Kannada-English" rather than pure labels.
HINDI_ROMAN = {
    "hai", "nahi", "kya", "yaar", "bhai", "kar", "raha", "rahi", "ghante", "bahut",
    "accha", "achha", "theek", "mila", "koi", "kuch", "abhi", "phir", "wala", "wali",
    "karo", "kab", "aaya", "aayega", "log", "baat", "din", "roz", "gaya", "gayi",
    "shukriya", "badhiya", "waah", "wah", "pehle", "matlab", "sab", "bina", "itni",
}
KANNADA_ROMAN = {
    "agide", "aagide", "ide", "illa", "ilti", "yaaru", "tumba", "jaasti", "jasti",
    "madi", "madbedi", "beda", "bekku", "namma", "nodalla", "heltilla", "bagge",
    "kodalla", "sikkide", "barutte", "hogide", "mugidide", "kelthidivi", "ondu",
    "neeru", "makkalige", "kalitha", "ashte", "kelodu", "dinagalinda", "inda",
}
TAMIL_ROMAN = {"illa", "onnume", "nadakala", "ellame", "pesi", "patthi", "yaarum", "padikkala", "vishayathula"}
TELUGU_ROMAN = {"gurinchi", "emaina", "cheppara", "ela", "unnaru", "cheyyandi"}
MARATHI_ROMAN = {"aahe", "kaay", "baddal", "mahiti", "prashna", "roj", "haach"}
BENGALI_ROMAN = {"kono", "ekhono", "niye", "obostha", "kichu", "hoyeche"}

# Languages written in Latin script with an Indian-language substrate. These
# are the cases a multilingual model under-reads, because the sentiment-bearing
# half is romanised rather than native script.
CODE_MIXED = {"Hinglish", "Kannada-English"}

# --- lexicons --------------------------------------------------------------
NEG_WORDS = {
    "jam", "stuck", "delay", "delayed", "worst", "terrible", "awful", "broken", "fail",
    "failed", "failure", "angry", "anger", "furious", "useless", "pathetic", "ignored",
    "nobody", "nothing", "never", "cut", "outage", "shortage", "crisis", "problem",
    "issue", "complaint", "protest", "unacceptable", "disgusting", "shame", "corrupt",
    "leak", "leaked", "fake", "false", "rumour", "rumor", "danger", "dangerous", "risk",
    "flood", "alert", "warning", "shut", "closed", "cancel", "cancelled", "slow",
    "waiting", "wait", "hours", "unsustainable", "accountable", "excuse",
    "nahi", "nathing", "illa", "ilti", "nodalla", "heltilla", "kodalla", "jasti", "jaasti",
    "fanse", "nadakala", "padikkala",
}
POS_WORDS = {
    "great", "good", "best", "excellent", "welcome", "approved", "approval", "finally",
    "thanks", "thank", "credit", "quick", "timely", "clear", "helpful", "safe", "restored",
    "resolved", "improve", "improved", "better", "genuinely", "amazing", "wonderful",
    "perfect", "love", "accha", "achha", "badhiya", "theek", "sikkide", "waah", "wah",
}
SARCASM_CUES = [
    (re.compile(r"\b(amazing|wonderful|perfect|excellent|great|lovely|brilliant)\b.{0,60}\b(again|another|third|fifth|jam|delay|cut|outage|traffic|late)\b", re.I), 55),
    (re.compile(r"\b(love|loving)\s+(this|it)\b.{0,40}\b(city|place|country|system)\b", re.I), 45),
    (re.compile(r"\b(waah|wah|bahut badhiya|kya baat hai|shukriya|record hi ban gaya)\b", re.I), 50),
    (re.compile(r"\b(truly|really)\s+(world class|first class|impressive)\b", re.I), 50),
    (re.compile(r"\b(perfect timing|as expected|obviously|of course)\b", re.I), 30),
    (re.compile(r"\b(thanks a lot|great job|well done)\b.{0,40}\b(nothing|again|still|no)\b", re.I), 40),
]
EMOTION_WORDS = {
    "anger": {"angry", "furious", "outrage", "unacceptable", "shame", "corrupt", "accountable", "excuse", "ignored", "nobody"},
    "fear": {"afraid", "scared", "worried", "danger", "dangerous", "risk", "alert", "warning", "panic", "unsafe", "flood", "dengue", "shortage"},
    "joy": {"happy", "great", "excellent", "finally", "welcome", "celebrate", "best", "love"},
    "sadness": {"sad", "unfortunate", "disappointed", "tired", "exhausted", "hopeless", "sustainable"},
    "surprise": {"breaking", "suddenly", "unexpected", "shocking", "leaked", "revealed"},
    "disgust": {"disgusting", "pathetic", "useless", "filthy", "garbage", "nonsense"},
    "trust": {"official", "confirmed", "verified", "clarified", "statement", "log", "data", "source"},
    "anticipation": {"waiting", "expect", "expected", "soon", "upcoming", "when", "kab", "update"},
}
STANCE_SUPPORT = {"support", "welcome", "agree", "good step", "in favour", "backing", "approve"}
STANCE_OPPOSE = {"oppose", "against", "reject", "withdraw", "protest", "resign", "stop", "unacceptable"}

BOT_CUES = [
    (re.compile(r"forward (to everyone|karo|fast)", re.I), 45),
    (re.compile(r"\bshare (fast|now|immediately)\b", re.I), 40),
    (re.compile(r"^BREAKING[: ]", re.I), 25),
    (re.compile(r"!{3,}"), 20),
    (re.compile(r"\b(viral|must watch|shocking truth)\b", re.I), 25),
]


def _tokens(text: str) -> list[str]:
    return re.findall(r"[a-zA-Zऀ-෿]+", text.lower())


def detect_language(text: str) -> str:
    for name, pattern in SCRIPTS:
        if pattern.search(text):
            return name

    toks = set(_tokens(text))
    latin = bool(re.search(r"[a-zA-Z]", text))
    hi = len(toks & HINDI_ROMAN)
    kn = len(toks & KANNADA_ROMAN)
    ta = len(toks & TAMIL_ROMAN)
    te = len(toks & TELUGU_ROMAN)
    mr = len(toks & MARATHI_ROMAN)
    bn = len(toks & BENGALI_ROMAN)

    best = max(hi, kn, ta, te, mr, bn)
    if best == 0:
        return "English"
    # romanised Indian language mixed with Latin script is code-mix by definition
    if kn == best:
        return "Kannada-English" if latin else "Kannada"
    if hi == best:
        return "Hinglish"
    if ta == best:
        return "Tamil"
    if te == best:
        return "Telugu"
    if mr == best:
        return "Marathi"
    return "Bengali"


def score_sarcasm(text: str, surface: Sentiment, has_negative_context: bool) -> int:
    score = 0
    for pattern, weight in SARCASM_CUES:
        if pattern.search(text):
            score += weight
    # positive words wrapped around a complaint is the classic pattern
    if surface == "pos" and has_negative_context:
        score += 30
    if score and text.strip().endswith("."):
        score += 5
    return min(99, score)


def detect_emotion(text: str, sentiment: Sentiment, sarcasm: int = 0) -> str:
    toks = set(_tokens(text))
    scores = {emo: len(toks & words) for emo, words in EMOTION_WORDS.items()}
    # Under sarcasm the positive vocabulary is the joke, not the feeling --
    # "Love this city" in a complaint is disgust, not joy.
    if sarcasm >= 50:
        scores["joy"] = 0
        scores["trust"] = 0
    best = max(scores, key=lambda k: scores[k])
    if scores[best] == 0:
        if sarcasm >= 50:
            return "disgust"
        return {"neg": "anger", "pos": "joy", "neu": "anticipation"}[sentiment]
    return best


def detect_stance(text: str, sentiment: Sentiment) -> str:
    low = text.lower()
    if any(w in low for w in STANCE_OPPOSE):
        return "oppose"
    if any(w in low for w in STANCE_SUPPORT):
        return "support"
    if "?" in text:
        return "unclear"
    return {"neg": "oppose", "pos": "support", "neu": "neutral"}[sentiment]


def score_bot(text: str) -> int:
    score = sum(w for pattern, w in BOT_CUES if pattern.search(text))
    caps = sum(1 for c in text if c.isupper())
    if len(text) > 20 and caps / max(len(text), 1) > 0.35:
        score += 20
    return min(99, score)


class RuleAnnotator:
    """Lexicon and heuristics. The default, and the fallback for the model path."""

    name = "rules"

    def annotate(self, text: str) -> Annotation:
        toks = _tokens(text)
        tokset = set(toks)
        neg_hits = len(tokset & NEG_WORDS)
        pos_hits = len(tokset & POS_WORDS)

        if pos_hits > neg_hits:
            surface: Sentiment = "pos"
        elif neg_hits > pos_hits:
            surface = "neg"
        else:
            surface = "neu"

        sarcasm = score_sarcasm(text, surface, has_negative_context=neg_hits > 0)
        # sarcasm inverts a positive surface reading
        sentiment = "neg" if (sarcasm >= 50 and surface == "pos") else surface

        total = max(neg_hits + pos_hits, 1)
        confidence = min(0.95, 0.45 + abs(neg_hits - pos_hits) / total * 0.5)

        return Annotation(
            text=text,
            lang=detect_language(text),
            sentiment=sentiment,
            surface=surface,
            confidence=round(confidence, 2),
            sarcasm=sarcasm,
            emotion=detect_emotion(text, sentiment, sarcasm),
            stance=detect_stance(text, sentiment),
            bot=score_bot(text),
            backend=self.name,
        )


class ModelAnnotator:
    """transformers-backed. Loads lazily so import never blocks startup."""

    name = "models"

    def __init__(self, sentiment_model: str, emotion_model: str, device: str = "cpu", max_chars: int = 512):
        self.sentiment_model = sentiment_model
        self.emotion_model = emotion_model
        self.device = device
        self.max_chars = max_chars
        self._sentiment = None
        self._emotion = None
        self._rules = RuleAnnotator()
        self.load_error: str | None = None
        self.warming = False

    def warm(self) -> bool:
        """Load the pipelines. Blocking -- call it from a thread, never from
        the event loop. Returns False and records why if it cannot."""
        if self._sentiment is not None:
            return True
        self.warming = True
        try:
            from transformers import pipeline  # noqa: PLC0415

            self._sentiment = pipeline(
                "sentiment-analysis", model=self.sentiment_model, device=self.device, truncation=True
            )
            self._emotion = pipeline(
                "text-classification", model=self.emotion_model, device=self.device, truncation=True
            )
            return True
        except Exception as exc:  # model missing, no network, no torch
            self.load_error = f"{type(exc).__name__}: {exc}"
            return False
        finally:
            self.warming = False

    @staticmethod
    def _map_sentiment(label: str) -> Sentiment:
        low = label.lower()
        if low in {"positive", "label_2", "pos"}:
            return "pos"
        if low in {"negative", "label_0", "neg"}:
            return "neg"
        return "neu"

    def annotate(self, text: str) -> Annotation:
        base = self._rules.annotate(text)
        if self._sentiment is None:
            # not loaded yet (or failed): answer now from rules rather than
            # stalling the caller behind a multi-second model load
            base.backend = "rules (warming)" if self.warming else "rules (models unavailable)"
            return base

        clipped = text[: self.max_chars]
        try:
            s = self._sentiment(clipped)[0]
            e = self._emotion(clipped)[0]
        except Exception as exc:
            base.backend = f"rules (inference failed: {type(exc).__name__})"
            return base

        surface = self._map_sentiment(s["label"])
        confidence = round(float(s["score"]), 3)
        backend = self.name

        # Romanised code-mix is where the model is measurably worse than the
        # lexicon: XLM-R reads "Traffic full jam agide bro" as neutral because
        # the complaint carries in the Kannada half. Defer to rules when the
        # model returns neutral on code-mixed text.
        if base.lang in CODE_MIXED and surface == "neu" and base.surface != "neu":
            surface = base.surface
            confidence = base.confidence
            backend = f"{self.name} + rules (code-mix)"

        # sarcasm still comes from the rule layer, and still overrides the model
        sentiment = "neg" if (base.sarcasm >= 50 and surface == "pos") else surface

        # The emotion head is English-only. On anything else it produces
        # confident nonsense, so the lexicon takes over.
        if base.lang == "English" and base.sarcasm < 50:
            emotion = e["label"].lower()
        else:
            emotion = detect_emotion(text, sentiment, base.sarcasm)
            if backend == self.name:
                backend = f"{self.name} + rules (emotion)"

        return Annotation(
            text=text,
            lang=base.lang,
            sentiment=sentiment,
            surface=surface,
            confidence=confidence,
            sarcasm=base.sarcasm,
            emotion=emotion,
            stance=detect_stance(text, sentiment),
            bot=base.bot,
            backend=backend,
        )


_annotator: RuleAnnotator | ModelAnnotator | None = None


def get_annotator():
    """Pick an annotator once, according to settings.nlp_backend."""
    global _annotator
    if _annotator is not None:
        return _annotator

    from ..config import get_settings  # noqa: PLC0415

    settings = get_settings()
    mode = settings.nlp_backend.lower()

    if mode == "rules":
        _annotator = RuleAnnotator()
        return _annotator

    candidate = ModelAnnotator(
        settings.nlp_sentiment_model, settings.nlp_emotion_model, settings.nlp_device, settings.nlp_max_chars
    )
    if mode == "models":
        _annotator = candidate  # warm lazily; surface the error on /api/health
        return _annotator

    # auto: use models only if transformers imports cleanly
    try:
        import transformers  # noqa: F401,PLC0415

        _annotator = candidate
    except Exception:
        _annotator = RuleAnnotator()
    return _annotator


def annotator_status() -> dict:
    ann = get_annotator()
    status = {"requested": get_settings_backend(), "active": ann.name}
    if isinstance(ann, ModelAnnotator):
        status["sentiment_model"] = ann.sentiment_model
        status["emotion_model"] = ann.emotion_model
        status["loaded"] = ann._sentiment is not None
        status["load_error"] = ann.load_error
    return status


def get_settings_backend() -> str:
    from ..config import get_settings  # noqa: PLC0415

    return get_settings().nlp_backend
