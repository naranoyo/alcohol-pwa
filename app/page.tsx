"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/lib/state";
import { calculateAlcoholSummary } from "@/lib/alcohol";

type PresetDrink = {
  name: string;
  volumeMl: number;
  abv: number;
};

type DrinkCategory = {
  key: string;
  label: string;
  items: PresetDrink[];
};

const DRINK_CATEGORIES: DrinkCategory[] = [
  {
    key: "beer",
    label: "ビール",
    items: [
      { name: "ビール", volumeMl: 350, abv: 5 },
      { name: "ビール", volumeMl: 500, abv: 5 },
      { name: "発泡酒", volumeMl: 350, abv: 5 },
    ],
  },
  {
    key: "sour",
    label: "サワー",
    items: [
      { name: "レモンサワー", volumeMl: 350, abv: 5 },
      { name: "チューハイ", volumeMl: 350, abv: 5 },
      { name: "ストロング缶", volumeMl: 350, abv: 9 },
    ],
  },
  {
    key: "highball",
    label: "ハイボール",
    items: [
      { name: "ハイボール", volumeMl: 350, abv: 7 },
      { name: "濃いめハイボール", volumeMl: 350, abv: 9 },
    ],
  },
  {
    key: "wine",
    label: "ワイン",
    items: [
      { name: "赤ワイン", volumeMl: 120, abv: 12 },
      { name: "白ワイン", volumeMl: 120, abv: 12 },
      { name: "ワイン(ボトル1/2)", volumeMl: 375, abv: 12 },
    ],
  },
  {
    key: "sake",
    label: "日本酒",
    items: [
      { name: "日本酒1合", volumeMl: 180, abv: 15 },
      { name: "日本酒2合", volumeMl: 360, abv: 15 },
    ],
  },
  {
    key: "shochu",
    label: "焼酎",
    items: [
      { name: "焼酎水割り", volumeMl: 200, abv: 12 },
      { name: "焼酎ロック", volumeMl: 100, abv: 25 },
    ],
  },
];

type PresetOption = {
  value: string;
  label: string;
  preset: PresetDrink;
};

const START_TIME_QUICK_OPTIONS = ["18:00", "19:00", "20:00", "21:00"];
const END_TIME_QUICK_OPTIONS = ["21:00", "22:00", "23:00", "00:00"];

function numberValue(value: string) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function intValueFromText(value: string) {
  const onlyDigits = value.replace(/[^\d]/g, "");
  if (!onlyDigits) return 0;
  return Number(onlyDigits);
}

function normalizeDateForInput(value: string) {
  if (!value) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const match = value.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
  if (!match) return "";

  const [, y, m, d] = match;

  return `${y}-${String(Number(m)).padStart(2, "0")}-${String(
    Number(d)
  ).padStart(2, "0")}`;
}

function formatDateToInputValue(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatTimeToInputValue(date: Date) {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function formatDatePlain(value: string) {
  if (!value) return "";
  const normalized = normalizeDateForInput(value);
  if (!normalized) return "";
  const [yyyy, mm, dd] = normalized.split("-");
  return `${Number(yyyy)}/${Number(mm)}/${Number(dd)}`;
}

function presetLabel(item: PresetDrink) {
  return `${item.name} (${item.volumeMl}ml / ${item.abv}%)`;
}

function presetValue(item: PresetDrink) {
  return `${item.name}__${item.volumeMl}__${item.abv}`;
}

function getAllPresetOptions(): PresetOption[] {
  return DRINK_CATEGORIES.flatMap((category) =>
    category.items.map((item) => ({
      value: presetValue(item),
      label: presetLabel(item),
      preset: item,
    }))
  );
}

function findPresetByDrinkValues(name: string, volumeMl: number, abv: number) {
  return (
    DRINK_CATEGORIES.flatMap((category) => category.items).find(
      (item) =>
        item.name === name && item.volumeMl === volumeMl && item.abv === abv
    ) ?? null
  );
}

function formatDateTime(value: string) {
  try {
    return new Date(value).toLocaleString("ja-JP");
  } catch {
    return value;
  }
}

function formatTimeOnly(value: Date | null) {
  if (!value) return "--:--";

  return value.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatClock(value: Date | null) {
  if (!value) return "--:--:--";

  const hh = String(value.getHours()).padStart(2, "0");
  const mm = String(value.getMinutes()).padStart(2, "0");
  const ss = String(value.getSeconds()).padStart(2, "0");

  return `${hh}:${mm}:${ss}`;
}

function formatDateWithWeekday(value: Date | null) {
  if (!value) return "----/--/-- (-)";

  return value.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
}

function formatDateDisplay(value: string) {
  if (!value) return "----/--/--";
  return value.replaceAll("-", "/");
}

function parseTimeToDate(base: Date, time: string) {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(base);
  d.setHours(Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0, 0, 0);
  return d;
}

function getSessionRangeFromNow(startTime: string, endTime: string, now: Date) {
  const startToday = parseTimeToDate(now, startTime);
  const endToday = parseTimeToDate(now, endTime);

  const start = new Date(startToday);
  const end = new Date(endToday);

  if (end.getTime() <= start.getTime()) {
    end.setDate(end.getDate() + 1);
  }

  if (now.getTime() < start.getTime()) {
    start.setDate(start.getDate() - 1);
    end.setDate(end.getDate() - 1);
  }

  return { start, end };
}

function calcElapsedAfterEndByClock(
  startTime: string,
  endTime: string,
  now: Date
) {
  const { end } = getSessionRangeFromNow(startTime, endTime, now);
  const diffHours = (now.getTime() - end.getTime()) / (60 * 60 * 1000);
  return Math.max(0, diffHours);
}

function calcRemainingNowByClock(
  remainingAtEndG: number,
  metabolismGPerHour: number,
  startTime: string,
  endTime: string,
  now: Date
) {
  const elapsed = calcElapsedAfterEndByClock(startTime, endTime, now);
  const remaining = remainingAtEndG - metabolismGPerHour * elapsed;
  return Math.max(0, Number(remaining.toFixed(1)));
}

function calcZeroAtByClock(
  remainingAtEndG: number,
  metabolismGPerHour: number,
  startTime: string,
  endTime: string,
  now: Date
) {
  const currentRemaining = calcRemainingNowByClock(
    remainingAtEndG,
    metabolismGPerHour,
    startTime,
    endTime,
    now
  );

  if (currentRemaining <= 0 || metabolismGPerHour <= 0) {
    return now;
  }

  const hoursToZero = currentRemaining / metabolismGPerHour;
  return new Date(now.getTime() + hoursToZero * 60 * 60 * 1000);
}

function getHistoryToneByRemaining(remainingNowG: number) {
  if (remainingNowG >= 40) {
    return {
      wrap: "border-red-200 bg-red-50",
      badge: "bg-red-100 text-red-700",
      accent: "text-red-700",
      button: "bg-red-600 hover:bg-red-700 text-white",
      label: "高め",
    };
  }

  if (remainingNowG >= 15) {
    return {
      wrap: "border-amber-200 bg-amber-50",
      badge: "bg-amber-100 text-amber-700",
      accent: "text-amber-700",
      button: "bg-amber-600 hover:bg-amber-700 text-white",
      label: "中くらい",
    };
  }

  return {
    wrap: "border-emerald-200 bg-emerald-50",
    badge: "bg-emerald-100 text-emerald-700",
    accent: "text-emerald-700",
    button: "bg-emerald-600 hover:bg-emerald-700 text-white",
    label: "低め",
  };
}

function CalendarIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6 text-slate-700"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

type DateInputWithPicker = HTMLInputElement & {
  showPicker?: () => void;
};

export default function Page() {
  const { state, dispatch } = useApp();

  const [activeCategory, setActiveCategory] = useState<string>(
    DRINK_CATEGORIES[0].key
  );
  const [expandedPresetCategory, setExpandedPresetCategory] = useState<
    string | null
  >(null);
  const [now, setNow] = useState<Date | null>(null);

  const dateInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const tick = () => {
      setNow(new Date());
    };

    tick();
    const id = window.setInterval(tick, 1000);

    return () => window.clearInterval(id);
  }, []);

  const safeNow = useMemo(() => now ?? new Date(), [now]);

  const lockedDrinks = useMemo(
    () => state.drinks.filter((drink) => drink.locked),
    [state.drinks]
  );

  const currentEditingDrink = useMemo(
    () => state.drinks.find((drink) => !drink.locked) ?? null,
    [state.drinks]
  );

  const displayDrinks = useMemo(() => {
    return currentEditingDrink
      ? [...lockedDrinks, currentEditingDrink]
      : lockedDrinks;
  }, [lockedDrinks, currentEditingDrink]);

  const summaryState = useMemo(
    () => ({
      ...state,
      drinks: lockedDrinks,
    }),
    [state, lockedDrinks]
  );

  const summary = useMemo(
    () => calculateAlcoholSummary(summaryState),
    [summaryState]
  );

  const activePresetItems =
    DRINK_CATEGORIES.find((category) => category.key === activeCategory)
      ?.items ?? [];

  const allPresetOptions = useMemo(() => {
    return getAllPresetOptions();
  }, []);

  const isPresetExpanded = expandedPresetCategory === activeCategory;

  const visiblePresetItems = isPresetExpanded
    ? activePresetItems
    : activePresetItems.slice(0, 4);

  const liveElapsedAfterEnd = useMemo(() => {
    return calcElapsedAfterEndByClock(state.startTime, state.endTime, safeNow);
  }, [state.startTime, state.endTime, safeNow]);

  const liveRemainingNowG = useMemo(() => {
    return calcRemainingNowByClock(
      summary.remainingAtEndG,
      summary.metabolismGPerHour,
      state.startTime,
      state.endTime,
      safeNow
    );
  }, [
    summary.remainingAtEndG,
    summary.metabolismGPerHour,
    state.startTime,
    state.endTime,
    safeNow,
  ]);

  const liveEstimatedBac = useMemo(() => {
    const ratio = state.sex === "male" ? 0.7 : 0.6;
    if (state.weightKg <= 0 || ratio <= 0) return 0;
    return Number(
      (liveRemainingNowG / (state.weightKg * ratio * 10)).toFixed(3)
    );
  }, [liveRemainingNowG, state.weightKg, state.sex]);

  const zeroAtLive = useMemo(() => {
    return calcZeroAtByClock(
      summary.remainingAtEndG,
      summary.metabolismGPerHour,
      state.startTime,
      state.endTime,
      safeNow
    );
  }, [
    summary.remainingAtEndG,
    summary.metabolismGPerHour,
    state.startTime,
    state.endTime,
    safeNow,
  ]);

  const liveHoursToZero = useMemo(() => {
    if (summary.metabolismGPerHour <= 0) return 0;
    return Number((liveRemainingNowG / summary.metabolismGPerHour).toFixed(1));
  }, [liveRemainingNowG, summary.metabolismGPerHour]);

  const canSaveHistory = lockedDrinks.length > 0;

  const currentRemainingLabelDate = useMemo(() => {
    return now ? formatDateWithWeekday(now) : "----/--/-- (-)";
  }, [now]);

  const zeroAtLabelDate = useMemo(() => {
    return zeroAtLive ? formatDateWithWeekday(zeroAtLive) : "----/--/-- (-)";
  }, [zeroAtLive]);

  const handleOpenDatePicker = () => {
    const input = dateInputRef.current as DateInputWithPicker | null;
    if (!input) return;

    if (typeof input.showPicker === "function") {
      input.showPicker();
    } else {
      input.focus();
      input.click();
    }
  };

  const handleAddDrink = () => {
    if (currentEditingDrink) return;
    dispatch({ type: "ADD_DRINK" });
  };

  const handleApplyPreset = (item: PresetDrink) => {
    if (!currentEditingDrink) return;

    dispatch({
      type: "UPDATE_DRINK",
      payload: {
        id: currentEditingDrink.id,
        field: "name",
        value: item.name,
      },
    });
    dispatch({
      type: "UPDATE_DRINK",
      payload: {
        id: currentEditingDrink.id,
        field: "volumeMl",
        value: item.volumeMl,
      },
    });
    dispatch({
      type: "UPDATE_DRINK",
      payload: {
        id: currentEditingDrink.id,
        field: "abv",
        value: item.abv,
      },
    });
    dispatch({
      type: "UPDATE_DRINK",
      payload: {
        id: currentEditingDrink.id,
        field: "count",
        value: 1,
      },
    });
  };

  const handleSelectPreset = (drinkId: string, selectedValue: string) => {
    const selected = allPresetOptions.find(
      (option) => option.value === selectedValue
    );
    if (!selected) return;

    dispatch({
      type: "UPDATE_DRINK",
      payload: {
        id: drinkId,
        field: "name",
        value: selected.preset.name,
      },
    });
    dispatch({
      type: "UPDATE_DRINK",
      payload: {
        id: drinkId,
        field: "volumeMl",
        value: selected.preset.volumeMl,
      },
    });
    dispatch({
      type: "UPDATE_DRINK",
      payload: {
        id: drinkId,
        field: "abv",
        value: selected.preset.abv,
      },
    });
  };

  const handleSaveHistory = () => {
    if (!canSaveHistory) return;

    dispatch({
      type: "ADD_HISTORY",
      payload: {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        date: state.date,
        weightKg: state.weightKg,
        sex: state.sex,
        startTime: state.startTime,
        endTime: state.endTime,
        elapsedHoursAfterEnd: state.elapsedHoursAfterEnd,
        drinks: lockedDrinks.map((drink) => ({ ...drink })),
        totalPureAlcoholG: summary.totalPureAlcoholG,
        remainingAtEndG: summary.remainingAtEndG,
        remainingNowG: liveRemainingNowG,
        metabolismGPerHour: summary.metabolismGPerHour,
        hoursToZeroFromNow: liveHoursToZero,
        estimatedBacNow: liveEstimatedBac,
      },
    });
  };

  return (
    <main className="mx-auto min-h-screen max-w-6xl bg-slate-50 px-4 py-6 text-slate-900 sm:px-6">
      <div className="grid gap-6">
        <section className="rounded-3xl bg-blue-600 p-5 shadow-sm ring-1 ring-blue-700">
          <h1 className="text-2xl font-bold text-white">お酒確認アプリ</h1>
          <p className="mt-2 text-sm leading-6 text-blue-50">
            体重・性別・飲酒時間を加味した、かなり大まかな参考計算です。
            運転や危険作業の判断には使わないでください。
          </p>
        </section>

        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-bold">基本情報</h2>

          <div className="mt-5 grid gap-5">
            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">
                体重: {state.weightKg} kg
              </span>
              <input
                type="range"
                min={40}
                max={100}
                step={1}
                value={state.weightKg}
                onChange={(e) =>
                  dispatch({
                    type: "SET_WEIGHT",
                    payload: Number(e.target.value),
                  })
                }
                className="w-full accent-blue-600"
              />
              <div className="flex flex-wrap gap-2">
                {[45, 50, 55, 60, 65, 70, 75, 80].map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => dispatch({ type: "SET_WEIGHT", payload: w })}
                    className={`rounded-full border px-3 py-1.5 text-sm ${
                      state.weightKg === w
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-slate-300 bg-white text-slate-700"
                    }`}
                  >
                    {w}kg
                  </button>
                ))}
              </div>
            </label>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="grid gap-3">
                <span className="text-sm font-medium text-slate-700">性別</span>

                <div className="flex min-h-42 flex-col rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <select
                    value={state.sex}
                    onChange={(e) =>
                      dispatch({
                        type: "SET_SEX",
                        payload: e.target.value as "male" | "female",
                      })
                    }
                    className="h-14 w-full rounded-2xl border border-slate-300 bg-white px-4 text-base outline-none focus:border-slate-500"
                  >
                    <option value="male">男性</option>
                    <option value="female">女性</option>
                  </select>

                  <div className="mt-3 flex-1" />

                  <p className="text-sm text-slate-500">
                    体格差の参考計算に使います
                  </p>
                </div>
              </div>

              <div className="grid gap-3">
                <span className="text-sm font-medium text-slate-700">日付</span>

                <div className="flex min-h-42 flex-col rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="relative">
                    <input
                      ref={dateInputRef}
                      type="date"
                      value={normalizeDateForInput(state.date)}
                      onChange={(e) =>
                        dispatch({
                          type: "SET_DATE",
                          payload: e.target.value,
                        })
                      }
                      className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
                      tabIndex={-1}
                      aria-hidden="true"
                    />

                    <button
                      type="button"
                      onClick={handleOpenDatePicker}
                      aria-label="日付を選択"
                      className="relative z-10 flex h-14 w-full items-center justify-between rounded-2xl border border-slate-300 bg-white px-4 text-left outline-none transition hover:bg-slate-50"
                    >
                      <span className="text-base text-slate-900">
                        {formatDatePlain(state.date)}
                      </span>
                      <CalendarIcon />
                    </button>
                  </div>

                  <div className="mt-3 flex-1" />

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        dispatch({
                          type: "SET_DATE",
                          payload: formatDateToInputValue(new Date()),
                        })
                      }
                      className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      今日
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const yesterday = new Date();
                        yesterday.setDate(yesterday.getDate() - 1);

                        dispatch({
                          type: "SET_DATE",
                          payload: formatDateToInputValue(yesterday),
                        });
                      }}
                      className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      昨日
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="grid gap-3">
                <span className="text-sm font-medium text-slate-700">
                  開始時刻
                </span>

                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <input
                    type="time"
                    value={state.startTime}
                    onChange={(e) =>
                      dispatch({
                        type: "SET_START_TIME",
                        payload: e.target.value,
                      })
                    }
                    className="h-14 w-full rounded-2xl border border-slate-300 bg-white px-4 text-base outline-none focus:border-slate-500"
                  />

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        dispatch({
                          type: "SET_START_TIME",
                          payload: formatTimeToInputValue(new Date()),
                        })
                      }
                      className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      今
                    </button>

                    {START_TIME_QUICK_OPTIONS.map((time) => (
                      <button
                        key={time}
                        type="button"
                        onClick={() =>
                          dispatch({
                            type: "SET_START_TIME",
                            payload: time,
                          })
                        }
                        className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid gap-3">
                <span className="text-sm font-medium text-slate-700">
                  終了時刻
                </span>

                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <input
                    type="time"
                    value={state.endTime}
                    onChange={(e) =>
                      dispatch({
                        type: "SET_END_TIME",
                        payload: e.target.value,
                      })
                    }
                    className="h-14 w-full rounded-2xl border border-slate-300 bg-white px-4 text-base outline-none focus:border-slate-500"
                  />

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        dispatch({
                          type: "SET_END_TIME",
                          payload: formatTimeToInputValue(new Date()),
                        })
                      }
                      className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      今
                    </button>

                    {END_TIME_QUICK_OPTIONS.map((time) => (
                      <button
                        key={time}
                        type="button"
                        onClick={() =>
                          dispatch({
                            type: "SET_END_TIME",
                            payload: time,
                          })
                        }
                        className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold">飲んだお酒</h2>
            <button
              type="button"
              onClick={handleAddDrink}
              disabled={!!currentEditingDrink}
              className={`rounded-2xl px-4 py-2 text-sm font-medium ${
                currentEditingDrink
                  ? "cursor-not-allowed bg-slate-300 text-white"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              追加
            </button>
          </div>

          <div className="mt-5">
            <p className="mb-3 text-sm font-medium text-slate-700">カテゴリ</p>
            <div className="flex flex-wrap gap-2">
              {DRINK_CATEGORIES.map((category) => (
                <button
                  key={category.key}
                  type="button"
                  onClick={() => setActiveCategory(category.key)}
                  className={`rounded-full px-4 py-2 text-sm font-medium ${
                    activeCategory === category.key
                      ? "bg-blue-600 text-white"
                      : "border border-slate-300 bg-white text-slate-700"
                  }`}
                >
                  {category.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <p className="mb-3 text-sm font-medium text-slate-700">
              プリセット
            </p>

            <div className="flex flex-wrap gap-2">
              {visiblePresetItems.map((item) => (
                <button
                  key={`${activeCategory}-${item.name}-${item.volumeMl}-${item.abv}`}
                  type="button"
                  onClick={() => handleApplyPreset(item)}
                  disabled={!currentEditingDrink}
                  className={`rounded-full px-4 py-2 text-sm font-medium ${
                    currentEditingDrink
                      ? "border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                      : "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400"
                  }`}
                >
                  {presetLabel(item)}
                </button>
              ))}

              {activePresetItems.length > 4 ? (
                <button
                  type="button"
                  onClick={() =>
                    setExpandedPresetCategory((prev) =>
                      prev === activeCategory ? null : activeCategory
                    )
                  }
                  className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  {isPresetExpanded
                    ? "閉じる"
                    : `さらに表示 (${activePresetItems.length - 4}件)`}
                </button>
              ) : null}
            </div>

            {currentEditingDrink ? (
              <p className="mt-3 text-sm text-blue-700">
                入力中のお酒は 1 件だけです。固定すると次を追加できます。
              </p>
            ) : (
              <p className="mt-3 text-sm text-amber-700">
                入力するには「追加」を押してください。
              </p>
            )}
          </div>

          <div className="mt-4 grid gap-4">
            {displayDrinks.map((drink, displayIndex) => {
              const lockedIndex = lockedDrinks.findIndex(
                (d) => d.id === drink.id
              );
              const pureAlcoholG =
                drink.locked && lockedIndex >= 0
                  ? (summary.drinks[lockedIndex]?.pureAlcoholG ?? 0)
                  : 0;

              const selectedPreset =
                findPresetByDrinkValues(
                  drink.name,
                  drink.volumeMl,
                  drink.abv
                ) ?? null;

              const selectedPresetValue = selectedPreset
                ? presetValue(selectedPreset)
                : "";

              return (
                <div
                  key={drink.id}
                  className={`rounded-3xl border p-4 ${
                    drink.locked
                      ? "border-amber-200 bg-amber-50/70"
                      : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">#{displayIndex + 1}</h3>
                      {drink.locked ? (
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
                          固定中
                        </span>
                      ) : (
                        <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
                          入力中
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleAddDrink}
                        disabled={!!currentEditingDrink}
                        className={`rounded-2xl px-3 py-1.5 text-sm font-medium ${
                          currentEditingDrink
                            ? "cursor-not-allowed bg-slate-300 text-white"
                            : "bg-blue-600 text-white hover:bg-blue-700"
                        }`}
                      >
                        追加
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          dispatch({
                            type: "TOGGLE_DRINK_LOCK",
                            payload: { id: drink.id },
                          })
                        }
                        className={`rounded-2xl px-3 py-1.5 text-sm ${
                          drink.locked
                            ? "border border-amber-300 bg-white text-amber-700 hover:bg-amber-50"
                            : "border border-blue-300 bg-white text-blue-700 hover:bg-blue-50"
                        }`}
                      >
                        {drink.locked ? "編集する" : "固定する"}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          dispatch({
                            type: "DELETE_DRINK",
                            payload: { id: drink.id },
                          })
                        }
                        className="rounded-2xl border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                      >
                        削除
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.9fr]">
                    <label className="grid gap-2">
                      <span className="text-sm font-medium text-slate-700">
                        飲み物名
                      </span>

                      <select
                        value={selectedPresetValue}
                        disabled={drink.locked}
                        onChange={(e) =>
                          handleSelectPreset(drink.id, e.target.value)
                        }
                        className={`rounded-2xl border px-4 py-3 outline-none ${
                          drink.locked
                            ? "cursor-not-allowed border-amber-200 bg-amber-50 text-slate-500"
                            : "border-slate-300 bg-white focus:border-slate-500"
                        }`}
                      >
                        {allPresetOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="grid gap-2">
                      <span className="text-sm font-medium text-slate-700">
                        量(ml)
                      </span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={10}
                        value={drink.volumeMl}
                        disabled={drink.locked}
                        onChange={(e) =>
                          dispatch({
                            type: "UPDATE_DRINK",
                            payload: {
                              id: drink.id,
                              field: "volumeMl",
                              value:
                                e.target.value === ""
                                  ? 0
                                  : Number(e.target.value),
                            },
                          })
                        }
                        className={`rounded-2xl border px-4 py-3 outline-none ${
                          drink.locked
                            ? "cursor-not-allowed border-amber-200 bg-amber-50 text-slate-500"
                            : "border-slate-300 bg-white focus:border-slate-500"
                        }`}
                      />
                    </label>

                    <label className="grid gap-2">
                      <span className="text-sm font-medium text-slate-700">
                        度数(%)
                      </span>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={drink.abv}
                        disabled={drink.locked}
                        onChange={(e) =>
                          dispatch({
                            type: "UPDATE_DRINK",
                            payload: {
                              id: drink.id,
                              field: "abv",
                              value: numberValue(e.target.value),
                            },
                          })
                        }
                        className={`rounded-2xl border px-4 py-3 outline-none ${
                          drink.locked
                            ? "cursor-not-allowed border-amber-200 bg-amber-50 text-slate-500"
                            : "border-slate-300 bg-white focus:border-slate-500"
                        }`}
                      />
                    </label>

                    <label className="grid gap-2">
                      <span className="text-sm font-medium text-slate-700">
                        本数・杯数
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={drink.locked}
                          onClick={() =>
                            dispatch({
                              type: "UPDATE_DRINK",
                              payload: {
                                id: drink.id,
                                field: "count",
                                value: Math.max(
                                  0,
                                  Number(drink.count || 0) - 1
                                ),
                              },
                            })
                          }
                          className={`h-12 w-10 rounded-2xl border text-xl ${
                            drink.locked
                              ? "cursor-not-allowed border-amber-200 bg-amber-50 text-slate-400"
                              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          −
                        </button>

                        <input
                          type="text"
                          inputMode="numeric"
                          value={drink.count === 0 ? "" : String(drink.count)}
                          disabled={drink.locked}
                          onChange={(e) =>
                            dispatch({
                              type: "UPDATE_DRINK",
                              payload: {
                                id: drink.id,
                                field: "count",
                                value: intValueFromText(e.target.value),
                              },
                            })
                          }
                          className={`min-w-0 flex-1 rounded-2xl border px-3 py-3 outline-none ${
                            drink.locked
                              ? "cursor-not-allowed border-amber-200 bg-amber-50 text-slate-500"
                              : "border-slate-300 bg-white focus:border-slate-500"
                          }`}
                        />

                        <button
                          type="button"
                          disabled={drink.locked}
                          onClick={() =>
                            dispatch({
                              type: "UPDATE_DRINK",
                              payload: {
                                id: drink.id,
                                field: "count",
                                value: Number(drink.count || 0) + 1,
                              },
                            })
                          }
                          className={`h-12 w-10 rounded-2xl border text-xl ${
                            drink.locked
                              ? "cursor-not-allowed border-amber-200 bg-amber-50 text-slate-400"
                              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          ＋
                        </button>
                      </div>
                    </label>
                  </div>

                  <p
                    className={`mt-3 text-sm ${
                      drink.locked ? "text-amber-700" : "text-slate-600"
                    }`}
                  >
                    このお酒の純アルコール量:{" "}
                    <span className="font-semibold text-slate-900">
                      {pureAlcoholG} g
                    </span>
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-bold">計算結果</h2>
          <p className="mt-2 text-sm text-slate-600">
            計算結果には「固定中」のお酒だけを反映しています。
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-3xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">総純アルコール量</p>
              <p className="mt-2 text-2xl font-bold">
                {summary.totalPureAlcoholG} g
              </p>
            </div>

            <div className="rounded-3xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">飲酒中に分解した想定量</p>
              <p className="mt-2 text-2xl font-bold">
                {summary.metabolizedDuringDrinkingG} g
              </p>
            </div>

            <div className="rounded-3xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">推定分解速度</p>
              <p className="mt-2 text-2xl font-bold">
                {summary.metabolismGPerHour} g/h
              </p>
            </div>

            <div className="rounded-3xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">飲酒時間</p>
              <p className="mt-2 text-2xl font-bold">
                {summary.drinkingDurationHours} 時間
              </p>
            </div>

            <div className="rounded-3xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">飲み終わり時点の推定残量</p>
              <p className="mt-2 text-sm text-slate-600">
                {formatDatePlain(state.date)}
              </p>
              <p className="mt-2 text-2xl font-bold">
                {summary.remainingAtEndG} g
              </p>
              <p className="mt-2 text-sm text-slate-600">{state.endTime}時点</p>
            </div>

            <div className="rounded-3xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">現在の推定残量</p>
              <p
                className="mt-2 text-sm text-slate-600"
                suppressHydrationWarning
              >
                {currentRemainingLabelDate}
              </p>
              <p className="mt-2 text-2xl font-bold">{liveRemainingNowG} g</p>
              <p
                className="mt-2 text-sm text-slate-600"
                suppressHydrationWarning
              >
                {now ? `${formatClock(now)} 時点` : "--:--:-- 時点"}
              </p>
            </div>

            <div className="rounded-3xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">現在時刻までの経過時間</p>
              <p className="mt-2 text-2xl font-bold">
                {Number(liveElapsedAfterEnd.toFixed(1))} 時間
              </p>
              <p className="mt-2 text-sm text-slate-600">飲み終わり後</p>
            </div>

            <div className="rounded-3xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">抜けるまでの目安</p>
              <p className="mt-2 text-sm text-slate-600">{zeroAtLabelDate}</p>
              <p className="mt-2 text-2xl font-bold">{liveHoursToZero} 時間</p>
              <p className="mt-2 text-sm text-slate-600">
                {formatTimeOnly(zeroAtLive)}ごろ
              </p>
            </div>

            <div className="rounded-3xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">現在時刻</p>
              <p
                className="mt-2 text-sm font-medium text-slate-600"
                suppressHydrationWarning
              >
                {now ? formatDateWithWeekday(now) : "----/--/-- (-)"}
              </p>
              <p className="mt-2 text-2xl font-bold" suppressHydrationWarning>
                {now ? formatClock(now) : "--:--:--"}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                この時刻で自動計算しています
              </p>
            </div>

            <div className="rounded-3xl bg-amber-50 p-4 sm:col-span-2 xl:col-span-3">
              <p className="text-sm text-amber-700">参考値</p>
              <p className="mt-2 text-lg font-bold text-amber-900">
                推定BAC風の参考値: {liveEstimatedBac}
              </p>
              <p className="mt-2 text-sm leading-6 text-amber-900/80">
                これはかなり大まかな目安です。個人差が大きく、実際の状態とはズレます。
                安全判断や運転可否の判定には使わないでください。
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleSaveHistory}
              disabled={!canSaveHistory}
              className={`rounded-2xl px-4 py-2 text-sm font-medium ${
                canSaveHistory
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "cursor-not-allowed bg-slate-300 text-white"
              }`}
            >
              履歴に保存
            </button>

            <button
              type="button"
              onClick={() => dispatch({ type: "RESET_ALL" })}
              className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              入力だけリセット
            </button>
          </div>

          {!canSaveHistory ? (
            <p className="mt-3 text-sm text-slate-500">
              固定中のお酒があると保存できます。
            </p>
          ) : null}
        </section>

        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-bold">履歴</h2>

          {state.histories.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              まだ履歴はありません。
            </p>
          ) : (
            <div className="mt-4 grid gap-4">
              {state.histories.map((item) => {
                const historyNowRemaining = calcRemainingNowByClock(
                  item.remainingAtEndG,
                  item.metabolismGPerHour,
                  item.startTime,
                  item.endTime,
                  safeNow
                );

                const tone = getHistoryToneByRemaining(historyNowRemaining);
                const zeroAt = calcZeroAtByClock(
                  item.remainingAtEndG,
                  item.metabolismGPerHour,
                  item.startTime,
                  item.endTime,
                  safeNow
                );

                return (
                  <div
                    key={item.id}
                    className={`rounded-3xl border p-4 ${tone.wrap}`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="grid gap-2 text-sm text-slate-700">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-slate-900">
                            保存日時: {formatDateTime(item.createdAt)}
                          </p>
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${tone.badge}`}
                          >
                            {tone.label}
                          </span>
                        </div>

                        <p>
                          体重 {item.weightKg}kg /{" "}
                          {item.sex === "male" ? "男性" : "女性"}
                        </p>
                        <p>
                          飲酒時間 {formatDateDisplay(item.date)}{" "}
                          {item.startTime} 〜 {item.endTime}
                        </p>
                        <p>飲んだ種類数: {item.drinks.length}</p>

                        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          <div className="rounded-2xl bg-white/80 p-3 ring-1 ring-white">
                            <p className="text-xs text-slate-500">
                              総純アルコール量
                            </p>
                            <p className="mt-1 font-bold text-slate-900">
                              {item.totalPureAlcoholG} g
                            </p>
                          </div>

                          <div className="rounded-2xl bg-white/80 p-3 ring-1 ring-white">
                            <p className="text-xs text-slate-500">
                              飲み終わり時点の推定残量
                            </p>
                            <p className="mt-1 text-xs text-slate-600">
                              {formatDatePlain(item.date)}
                            </p>
                            <p className="mt-1 font-bold text-slate-900">
                              {item.remainingAtEndG} g
                            </p>
                            <p className="mt-1 text-xs text-slate-600">
                              {item.endTime}時点
                            </p>
                          </div>

                          <div className="rounded-2xl bg-white/80 p-3 ring-1 ring-white">
                            <p className="text-xs text-slate-500">
                              現在の推定残量
                            </p>
                            <p
                              className="mt-1 text-xs text-slate-600"
                              suppressHydrationWarning
                            >
                              {now
                                ? formatDateWithWeekday(now)
                                : "----/--/-- (-)"}
                            </p>
                            <p className={`mt-1 font-bold ${tone.accent}`}>
                              {historyNowRemaining} g
                            </p>
                            <p
                              className="mt-1 text-xs text-slate-600"
                              suppressHydrationWarning
                            >
                              {now
                                ? `${formatClock(now)} 時点`
                                : "--:--:-- 時点"}
                            </p>
                          </div>

                          <div className="rounded-2xl bg-white/80 p-3 ring-1 ring-white">
                            <p className="text-xs text-slate-500">
                              推定BAC風参考値
                            </p>
                            <p className={`mt-1 font-bold ${tone.accent}`}>
                              {item.estimatedBacNow}
                            </p>
                          </div>

                          <div className="rounded-2xl bg-white/80 p-3 ring-1 ring-white">
                            <p className="text-xs text-slate-500">
                              抜けるまでの目安
                            </p>
                            <p className="mt-1 text-xs text-slate-600">
                              {formatDateWithWeekday(zeroAt)}
                            </p>
                            <p className="mt-1 font-bold text-slate-900">
                              {item.metabolismGPerHour > 0
                                ? Number(
                                    (
                                      historyNowRemaining /
                                      item.metabolismGPerHour
                                    ).toFixed(1)
                                  )
                                : 0}{" "}
                              時間
                            </p>
                            <p className="mt-1 text-xs text-slate-600">
                              {formatTimeOnly(zeroAt)}ごろ
                            </p>
                          </div>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-2">
                          {item.drinks.map((drink) => (
                            <span
                              key={drink.id}
                              className="rounded-full bg-white px-3 py-1 text-xs text-slate-700 ring-1 ring-slate-200"
                            >
                              {drink.name} / {drink.volumeMl}ml / {drink.abv}% /{" "}
                              {drink.count}杯
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            dispatch({
                              type: "LOAD_HISTORY",
                              payload: { id: item.id },
                            })
                          }
                          className={`rounded-2xl px-3 py-2 text-sm font-medium ${tone.button}`}
                        >
                          再読込
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            dispatch({
                              type: "DELETE_HISTORY",
                              payload: { id: item.id },
                            })
                          }
                          className="rounded-2xl border border-red-300 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                        >
                          履歴削除
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
