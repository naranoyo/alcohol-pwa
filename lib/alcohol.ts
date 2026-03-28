// lib/alcohol.ts

import type { AppState, DrinkInput, Sex } from "./state";

export type DrinkResult = DrinkInput & {
  pureAlcoholG: number;
};

export type AlcoholSummary = {
  drinks: DrinkResult[];
  totalPureAlcoholG: number;
  drinkingDurationHours: number;
  metabolismGPerHour: number;
  metabolizedDuringDrinkingG: number;
  remainingAtEndG: number;
  metabolizedAfterEndG: number;
  remainingNowG: number;
  hoursToZeroFromNow: number;
  widmarkR: number;
  estimatedBacNow: number;
};

function round(value: number, digits = 1) {
  const base = 10 ** digits;
  return Math.round(value * base) / base;
}

export function calcPureAlcoholG(volumeMl: number, abv: number, count = 1) {
  const safeVolume = Math.max(0, volumeMl);
  const safeAbv = Math.max(0, abv);
  const safeCount = Math.max(0, count);

  return safeVolume * (safeAbv / 100) * 0.8 * safeCount;
}

export function parseTimeToMinutes(value: string) {
  if (!value || !value.includes(":")) return 0;

  const [h, m] = value.split(":").map(Number);

  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;

  return h * 60 + m;
}

export function calcDurationHours(startTime: string, endTime: string) {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);

  let diff = end - start;

  if (diff < 0) {
    diff += 24 * 60;
  }

  return diff / 60;
}

/**
 * かなり大ざっぱな個人差調整
 * - 男性: やや高め
 * - 女性: やや低め
 * - 体重で少し補正
 *
 * 安全用途ではなく、あくまで参考値
 */
export function calcMetabolismGPerHour(weightKg: number, sex: Sex) {
  const safeWeight = Math.max(30, Math.min(200, weightKg));

  const factor = sex === "male" ? 0.105 : 0.09;
  const raw = safeWeight * factor;

  return round(Math.max(3.5, Math.min(12, raw)), 1);
}

/**
 * Widmark係数の簡易版
 * 男性 0.7 / 女性 0.6
 */
export function getWidmarkR(sex: Sex) {
  return sex === "male" ? 0.7 : 0.6;
}

/**
 * 血中アルコール濃度っぽい参考値
 * 厳密値ではないので表示は参考扱い
 */
export function estimateBac(remainingG: number, weightKg: number, sex: Sex) {
  const r = getWidmarkR(sex);
  const safeWeight = Math.max(30, weightKg);

  // Widmark近似の超簡易版
  // g / (kg * r) を % 参考値として扱う
  const bac = remainingG / (safeWeight * r) / 10;

  return Math.max(0, bac);
}

export function calculateAlcoholSummary(state: AppState): AlcoholSummary {
  const drinks = state.drinks.map((drink) => ({
    ...drink,
    pureAlcoholG: round(
      calcPureAlcoholG(drink.volumeMl, drink.abv, drink.count),
      1
    ),
  }));

  const totalPureAlcoholG = round(
    drinks.reduce((sum, drink) => sum + drink.pureAlcoholG, 0),
    1
  );

  const drinkingDurationHours = round(
    calcDurationHours(state.startTime, state.endTime),
    2
  );

  const metabolismGPerHour = calcMetabolismGPerHour(state.weightKg, state.sex);

  const metabolizedDuringDrinkingG = round(
    Math.min(
      totalPureAlcoholG,
      metabolismGPerHour * drinkingDurationHours * 0.5
    ),
    1
  );
  /**
   * 飲酒中は一気に全部分解されるわけではないため、
   * 飲酒時間に対して 50% だけ効かせる簡易補正
   */

  const remainingAtEndG = round(
    Math.max(0, totalPureAlcoholG - metabolizedDuringDrinkingG),
    1
  );

  const metabolizedAfterEndG = round(
    Math.min(remainingAtEndG, metabolismGPerHour * state.elapsedHoursAfterEnd),
    1
  );

  const remainingNowG = round(
    Math.max(0, remainingAtEndG - metabolizedAfterEndG),
    1
  );

  const hoursToZeroFromNow = round(
    metabolismGPerHour > 0 ? remainingNowG / metabolismGPerHour : 0,
    1
  );

  const widmarkR = getWidmarkR(state.sex);

  const estimatedBacNow = round(
    estimateBac(remainingNowG, state.weightKg, state.sex),
    3
  );

  return {
    drinks,
    totalPureAlcoholG,
    drinkingDurationHours,
    metabolismGPerHour,
    metabolizedDuringDrinkingG,
    remainingAtEndG,
    metabolizedAfterEndG,
    remainingNowG,
    hoursToZeroFromNow,
    widmarkR,
    estimatedBacNow,
  };
}
