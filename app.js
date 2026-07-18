(function () {
  "use strict";

  const STORAGE_KEYS = {
    questions: "cq_questions",
    questionsVersion: "cq_questions_version",
    progress: "cq_progress",
    timer: "cq_timer",
  };

  const INITIAL_SECONDS = 40 * 60; // 최초 제한 시간: 40분

  /* ---------- localStorage 유틸 (file:// 등에서 접근이 막혀도 앱이 죽지 않도록 안전하게 감쌈) ---------- */

  const memoryFallback = {};
  const storage = {
    getItem(key) {
      try {
        return localStorage.getItem(key);
      } catch (e) {
        return Object.prototype.hasOwnProperty.call(memoryFallback, key) ? memoryFallback[key] : null;
      }
    },
    setItem(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch (e) {
        memoryFallback[key] = value;
      }
    },
    removeItem(key) {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        delete memoryFallback[key];
      }
    },
  };

  function seedQuestions() {
    storage.setItem(STORAGE_KEYS.questions, JSON.stringify(QUESTION_BANK));
    storage.setItem(STORAGE_KEYS.questionsVersion, String(QUESTION_BANK_VERSION));
    return QUESTION_BANK;
  }

  function loadQuestions() {
    const storedVersion = storage.getItem(STORAGE_KEYS.questionsVersion);
    if (storedVersion !== String(QUESTION_BANK_VERSION)) {
      // 문제은행이 갱신된 경우(문항 수/구성 변경 등) 최신 문제은행으로 다시 저장한다.
      storage.removeItem(STORAGE_KEYS.progress);
      storage.removeItem(STORAGE_KEYS.timer);
      return seedQuestions();
    }
    const raw = storage.getItem(STORAGE_KEYS.questions);
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch (e) {
      /* fall through to reseed */
    }
    return seedQuestions();
  }

  function shuffledOrder(n) {
    const arr = Array.from({ length: n }, (_, i) => i);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function defaultProgress(total) {
    return {
      order: shuffledOrder(total),
      pos: 0,
      correct: 0,
      wrong: 0,
      finished: false,
      selected: null,
      answered: false,
    };
  }

  function loadProgress(total) {
    const raw = storage.getItem(STORAGE_KEYS.progress);
    if (raw) {
      try {
        const p = JSON.parse(raw);
        if (p && Array.isArray(p.order) && p.order.length === total) return p;
      } catch (e) {
        /* fall through */
      }
    }
    return null;
  }

  function saveProgress(p) {
    storage.setItem(STORAGE_KEYS.progress, JSON.stringify(p));
  }

  function clearProgressAndTimer() {
    storage.removeItem(STORAGE_KEYS.progress);
    storage.removeItem(STORAGE_KEYS.timer);
  }

  function loadTimer() {
    const raw = storage.getItem(STORAGE_KEYS.timer);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch (e) {
        /* fall through */
      }
    }
    return null;
  }

  function saveTimer(t) {
    storage.setItem(STORAGE_KEYS.timer, JSON.stringify(t));
  }

  /* ---------- 상태 ---------- */

  const questions = loadQuestions();
  let progress = null;
  let timer = null; // { remaining, updatedAt, running }
  let tickHandle = null;

  /* ---------- DOM ---------- */

  const el = {
    timer: document.getElementById("timer"),
    screens: {
      home: document.getElementById("screen-home"),
      quiz: document.getElementById("screen-quiz"),
      done: document.getElementById("screen-done"),
      timeup: document.getElementById("screen-timeup"),
    },
    homeTotal: document.getElementById("home-total"),
    homeProgress: document.getElementById("home-progress"),
    btnStart: document.getElementById("btn-start"),
    btnContinue: document.getElementById("btn-continue"),
    btnReset: document.getElementById("btn-reset"),

    qIndex: document.getElementById("q-index"),
    qTotal: document.getElementById("q-total"),
    qSubject: document.getElementById("q-subject"),
    qCorrect: document.getElementById("q-correct"),
    qWrong: document.getElementById("q-wrong"),
    qText: document.getElementById("q-text"),
    qOptions: document.getElementById("q-options"),

    feedback: document.getElementById("q-feedback"),
    feedbackText: document.getElementById("feedback-text"),
    feedbackExplain: document.getElementById("feedback-explain"),

    btnCheck: document.getElementById("btn-check"),
    btnNext: document.getElementById("btn-next"),
    btnRetry: document.getElementById("btn-retry"),

    doneSummary: document.getElementById("done-summary"),
    btnRestart: document.getElementById("btn-restart"),

    timeupSummary: document.getElementById("timeup-summary"),
    btnTimeupRestart: document.getElementById("btn-timeup-restart"),
  };

  function showScreen(name) {
    Object.entries(el.screens).forEach(([key, node]) => {
      node.hidden = key !== name;
    });
  }

  function formatTime(sec) {
    const s = Math.max(0, Math.round(sec));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return String(m).padStart(2, "0") + ":" + String(r).padStart(2, "0");
  }

  function renderTimer() {
    el.timer.textContent = formatTime(timer.remaining);
    el.timer.classList.toggle("warning", timer.remaining <= 60);
  }

  /* ---------- 타이머 ---------- */

  function startTicking() {
    stopTicking();
    tickHandle = setInterval(() => {
      if (!timer.running) return;
      const now = Date.now();
      const elapsed = (now - timer.updatedAt) / 1000;
      timer.remaining -= elapsed;
      timer.updatedAt = now;
      if (timer.remaining <= 0) {
        timer.remaining = 0;
        timer.running = false;
        renderTimer();
        saveTimer(timer);
        stopTicking();
        onTimeUp();
        return;
      }
      renderTimer();
      saveTimer(timer);
    }, 1000);
  }

  function stopTicking() {
    if (tickHandle) {
      clearInterval(tickHandle);
      tickHandle = null;
    }
  }

  function onTimeUp() {
    el.timeupSummary.textContent =
      `현재까지 정답 ${progress.correct}개, 오답 ${progress.wrong}개 (진행 ${progress.pos}/${questions.length}문항)`;
    showScreen("timeup");
  }

  /* ---------- 홈 화면 ---------- */

  function renderHome() {
    el.homeTotal.textContent = questions.length;
    const saved = loadProgress(questions.length);
    if (saved && !saved.finished && saved.pos > 0) {
      el.btnContinue.hidden = false;
      el.homeProgress.textContent =
        `진행 중: ${saved.pos}/${questions.length}문항 · 정답 ${saved.correct} · 오답 ${saved.wrong}`;
    } else if (saved && saved.finished) {
      el.btnContinue.hidden = true;
      el.homeProgress.textContent = `마지막 학습 완료: 정답 ${saved.correct} · 오답 ${saved.wrong}`;
    } else {
      el.btnContinue.hidden = true;
      el.homeProgress.textContent = "";
    }
    showScreen("home");
  }

  function beginFresh() {
    progress = defaultProgress(questions.length);
    saveProgress(progress);
    timer = { remaining: INITIAL_SECONDS, updatedAt: Date.now(), running: true };
    saveTimer(timer);
    renderTimer();
    startTicking();
    renderQuestion();
    showScreen("quiz");
  }

  function continueSaved() {
    progress = loadProgress(questions.length);
    const savedTimer = loadTimer();
    if (savedTimer) {
      timer = savedTimer;
      if (timer.running) {
        const elapsed = (Date.now() - timer.updatedAt) / 1000;
        timer.remaining = Math.max(0, timer.remaining - elapsed);
        timer.updatedAt = Date.now();
      }
    } else {
      timer = { remaining: INITIAL_SECONDS, updatedAt: Date.now(), running: true };
    }
    renderTimer();
    if (timer.remaining <= 0) {
      timer.running = false;
      saveTimer(timer);
      onTimeUp();
      return;
    }
    timer.running = true;
    saveTimer(timer);
    startTicking();
    renderQuestion();
    showScreen("quiz");
  }

  /* ---------- 퀴즈 화면 ---------- */

  function currentQuestion() {
    const qIdx = progress.order[progress.pos];
    return questions[qIdx];
  }

  function renderQuestion() {
    const q = currentQuestion();
    el.qIndex.textContent = progress.pos + 1;
    el.qTotal.textContent = questions.length;
    el.qSubject.textContent = q.subject || "";
    el.qCorrect.textContent = progress.correct;
    el.qWrong.textContent = progress.wrong;
    el.qText.textContent = q.question;

    el.qOptions.innerHTML = "";
    q.options.forEach((opt, i) => {
      const li = document.createElement("li");
      li.className = "option";
      li.dataset.index = String(i);
      li.innerHTML = `<span class="num">${i + 1}</span><span class="label"></span>`;
      li.querySelector(".label").textContent = opt;
      li.addEventListener("click", () => onSelectOption(i));
      el.qOptions.appendChild(li);
    });

    el.feedback.hidden = true;
    el.feedback.classList.remove("is-correct", "is-wrong");
    el.btnCheck.hidden = false;
    el.btnNext.hidden = true;
    el.btnRetry.hidden = true;

    if (progress.answered && progress.selected !== null) {
      applyOptionStates(progress.selected, progress.answered);
    }
  }

  function onSelectOption(i) {
    if (progress.answered) return;
    progress.selected = i;
    saveProgress(progress);
    Array.from(el.qOptions.children).forEach((li, idx) => {
      li.classList.toggle("selected", idx === i);
    });
  }

  function applyOptionStates(selectedIdx, answered) {
    const q = currentQuestion();
    Array.from(el.qOptions.children).forEach((li, idx) => {
      li.classList.add("disabled");
      li.classList.remove("selected", "correct", "wrong");
      if (answered) {
        if (idx === q.answer) li.classList.add("correct");
        else if (idx === selectedIdx) li.classList.add("wrong");
      } else if (idx === selectedIdx) {
        li.classList.add("selected");
      }
    });
  }

  function onCheck() {
    if (progress.selected === null) {
      el.feedback.hidden = false;
      el.feedback.classList.remove("is-correct", "is-wrong");
      el.feedbackText.textContent = "먼저 보기를 하나 선택해 주세요.";
      el.feedbackExplain.textContent = "";
      return;
    }
    const q = currentQuestion();
    const isCorrect = progress.selected === q.answer;
    progress.answered = true;
    saveProgress(progress);

    applyOptionStates(progress.selected, true);

    el.feedback.hidden = false;
    el.feedback.classList.toggle("is-correct", isCorrect);
    el.feedback.classList.toggle("is-wrong", !isCorrect);
    el.feedbackText.textContent = isCorrect ? "정답입니다!" : "오답입니다.";
    el.feedbackExplain.textContent = q.explanation || "";

    el.btnCheck.hidden = true;

    if (isCorrect) {
      progress.correct += 1;
      saveProgress(progress);
      el.qCorrect.textContent = progress.correct;
      el.btnNext.hidden = false;
      el.btnRetry.hidden = true;
    } else {
      progress.wrong += 1;
      saveProgress(progress);
      el.qWrong.textContent = progress.wrong;
      el.btnNext.hidden = true;
      el.btnRetry.hidden = false;
    }
  }

  function onRetry() {
    progress.selected = null;
    progress.answered = false;
    saveProgress(progress);
    renderQuestion();
  }

  function onNext() {
    progress.selected = null;
    progress.answered = false;
    progress.pos += 1;

    if (progress.pos >= questions.length) {
      progress.finished = true;
      saveProgress(progress);
      timer.running = false;
      saveTimer(timer);
      stopTicking();
      el.doneSummary.textContent =
        `총 ${questions.length}문항 · 정답 ${progress.correct} · 오답 ${progress.wrong} · 남은 시간 ${formatTime(timer.remaining)}`;
      showScreen("done");
      return;
    }

    saveProgress(progress);
    renderQuestion();
  }

  /* ---------- 시간 종료 후 재시작 ---------- */

  function onTimeupRestart() {
    timer = { remaining: INITIAL_SECONDS, updatedAt: Date.now(), running: true };
    saveTimer(timer);
    renderTimer();
    progress.selected = null;
    progress.answered = false;
    saveProgress(progress);
    startTicking();
    renderQuestion();
    showScreen("quiz");
  }

  /* ---------- 초기화 ---------- */

  function onResetAll() {
    if (!confirm("모든 학습 기록(진행 상황, 타이머)을 초기화할까요?")) return;
    clearProgressAndTimer();
    stopTicking();
    renderHome();
  }

  function onRestartFromDone() {
    beginFresh();
  }

  /* ---------- 이벤트 바인딩 ---------- */

  el.btnStart.addEventListener("click", beginFresh);
  el.btnContinue.addEventListener("click", continueSaved);
  el.btnReset.addEventListener("click", onResetAll);
  el.btnCheck.addEventListener("click", onCheck);
  el.btnNext.addEventListener("click", onNext);
  el.btnRetry.addEventListener("click", onRetry);
  el.btnRestart.addEventListener("click", onRestartFromDone);
  el.btnTimeupRestart.addEventListener("click", onTimeupRestart);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && timer && timer.running) {
      const elapsed = (Date.now() - timer.updatedAt) / 1000;
      timer.remaining = Math.max(0, timer.remaining - elapsed);
      timer.updatedAt = Date.now();
      renderTimer();
      saveTimer(timer);
      if (timer.remaining <= 0) {
        timer.running = false;
        saveTimer(timer);
        stopTicking();
        onTimeUp();
      }
    }
  });

  /* ---------- 서비스 워커 등록 ---------- */

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {
        /* 오프라인 캐시는 선택 사항이므로 등록 실패는 무시 */
      });
    });
  }

  /* ---------- 시작 ---------- */

  timer = { remaining: INITIAL_SECONDS, updatedAt: Date.now(), running: false };
  renderTimer();
  renderHome();
})();
