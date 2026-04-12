"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import { loadFromStorage, saveToStorage } from "./storage";

export type Sex = "male" | "female";

export type DrinkInput = {
  id: string;
  name: string;
  volumeMl: number;
  abv: number;
  count: number;
  locked?: boolean;
};

export type HistoryItem = {
  id: string;
  createdAt: string;
  date: string;
  weightKg: number;
  sex: Sex;
  startTime: string;
  endTime: string;
  elapsedHoursAfterEnd: number;
  drinks: DrinkInput[];
  totalPureAlcoholG: number;
  remainingAtEndG: number;
  remainingNowG: number;
  metabolismGPerHour: number;
  hoursToZeroFromNow: number;
  estimatedBacNow: number;
};

export type AppState = {
  date: string;
  weightKg: number;
  sex: Sex;
  startTime: string;
  endTime: string;
  elapsedHoursAfterEnd: number;
  drinks: DrinkInput[];
  histories: HistoryItem[];
};

type Action =
  | { type: "INIT"; payload: AppState }
  | { type: "SET_DATE"; payload: string }
  | { type: "SET_WEIGHT"; payload: number }
  | { type: "SET_SEX"; payload: Sex }
  | { type: "SET_START_TIME"; payload: string }
  | { type: "SET_END_TIME"; payload: string }
  | { type: "SET_ELAPSED_AFTER_END"; payload: number }
  | { type: "ADD_DRINK" }
  | {
      type: "UPDATE_DRINK";
      payload: {
        id: string;
        field: keyof DrinkInput;
        value: string | number | boolean;
      };
    }
  | { type: "DELETE_DRINK"; payload: { id: string } }
  | { type: "TOGGLE_DRINK_LOCK"; payload: { id: string } }
  | { type: "ADD_HISTORY"; payload: HistoryItem }
  | { type: "DELETE_HISTORY"; payload: { id: string } }
  | { type: "LOAD_HISTORY"; payload: { id: string } }
  | { type: "RESET_ALL" };

function todayString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function normalizeDateString(value: string) {
  if (!value || typeof value !== "string") {
    return todayString();
  }

  const trimmed = value.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const slashOrMixed = trimmed.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
  if (slashOrMixed) {
    const [, y, m, d] = slashOrMixed;
    return `${y}-${String(Number(m)).padStart(2, "0")}-${String(
      Number(d)
    ).padStart(2, "0")}`;
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const d = String(parsed.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  return todayString();
}

function createDefaultDrink(): DrinkInput {
  return {
    id: crypto.randomUUID(),
    name: "ビール",
    volumeMl: 350,
    abv: 5,
    count: 1,
    locked: false,
  };
}

function cloneDrink(drink: DrinkInput): DrinkInput {
  return {
    ...drink,
    id: crypto.randomUUID(),
    locked: true,
  };
}

function sanitizeDrink(drink: DrinkInput): DrinkInput {
  return {
    ...drink,
    name: typeof drink.name === "string" ? drink.name : "ビール",
    volumeMl:
      typeof drink.volumeMl === "number" && Number.isFinite(drink.volumeMl)
        ? Math.max(0, Math.round(drink.volumeMl))
        : 0,
    abv:
      typeof drink.abv === "number" && Number.isFinite(drink.abv)
        ? Math.max(0, Number(drink.abv))
        : 0,
    count:
      typeof drink.count === "number" && Number.isFinite(drink.count)
        ? Math.max(0, Math.round(drink.count))
        : 0,
    locked: Boolean(drink.locked),
  };
}

function ensureSingleUnlocked(drinks: DrinkInput[]): DrinkInput[] {
  if (!Array.isArray(drinks) || drinks.length === 0) {
    return [createDefaultDrink()];
  }

  const normalized = drinks.map(sanitizeDrink);
  const unlocked = normalized.filter((drink) => !drink.locked);

  if (unlocked.length <= 1) {
    return normalized;
  }

  const keepUnlockedId = unlocked[unlocked.length - 1]?.id;

  return normalized.map((drink) =>
    drink.id === keepUnlockedId
      ? { ...drink, locked: false }
      : { ...drink, locked: true }
  );
}

function ensureAtLeastOneDrink(drinks: DrinkInput[]): DrinkInput[] {
  return drinks.length > 0 ? drinks : [createDefaultDrink()];
}

function normalizeDrinks(drinks: DrinkInput[]): DrinkInput[] {
  return ensureAtLeastOneDrink(ensureSingleUnlocked(drinks));
}

const initialState: AppState = {
  date: todayString(),
  weightKg: 60,
  sex: "male",
  startTime: "19:00",
  endTime: "21:00",
  elapsedHoursAfterEnd: 0,
  drinks: [createDefaultDrink()],
  histories: [],
};

function normalizeHistoryItem(item: HistoryItem): HistoryItem {
  return {
    ...item,
    date: normalizeDateString(item.date),
    drinks: Array.isArray(item.drinks)
      ? item.drinks.map((drink) => ({ ...sanitizeDrink(drink), locked: true }))
      : [],
    remainingAtEndG:
      typeof item.remainingAtEndG === "number" &&
      Number.isFinite(item.remainingAtEndG)
        ? item.remainingAtEndG
        : item.remainingNowG,
    metabolismGPerHour:
      typeof item.metabolismGPerHour === "number" &&
      Number.isFinite(item.metabolismGPerHour)
        ? item.metabolismGPerHour
        : 0,
  };
}

function normalizeState(state: AppState): AppState {
  return {
    ...state,
    date: normalizeDateString(state.date),
    weightKg:
      typeof state.weightKg === "number" && Number.isFinite(state.weightKg)
        ? Math.max(30, Math.min(120, state.weightKg))
        : initialState.weightKg,
    sex: state.sex === "female" ? "female" : "male",
    startTime:
      typeof state.startTime === "string" && state.startTime
        ? state.startTime
        : initialState.startTime,
    endTime:
      typeof state.endTime === "string" && state.endTime
        ? state.endTime
        : initialState.endTime,
    elapsedHoursAfterEnd:
      typeof state.elapsedHoursAfterEnd === "number" &&
      Number.isFinite(state.elapsedHoursAfterEnd)
        ? Math.max(0, Math.min(48, state.elapsedHoursAfterEnd))
        : 0,
    drinks: normalizeDrinks(Array.isArray(state.drinks) ? state.drinks : []),
    histories: Array.isArray(state.histories)
      ? state.histories.map(normalizeHistoryItem)
      : [],
  };
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "INIT":
      return normalizeState(action.payload);

    case "SET_DATE":
      return {
        ...state,
        date: normalizeDateString(action.payload),
      };

    case "SET_WEIGHT":
      return {
        ...state,
        weightKg: Number.isFinite(action.payload)
          ? Math.max(30, Math.min(120, action.payload))
          : state.weightKg,
      };

    case "SET_SEX":
      return {
        ...state,
        sex: action.payload,
      };

    case "SET_START_TIME":
      return {
        ...state,
        startTime: action.payload,
      };

    case "SET_END_TIME":
      return {
        ...state,
        endTime: action.payload,
      };

    case "SET_ELAPSED_AFTER_END":
      return {
        ...state,
        elapsedHoursAfterEnd: Number.isFinite(action.payload)
          ? Math.max(0, Math.min(48, action.payload))
          : state.elapsedHoursAfterEnd,
      };

    case "ADD_DRINK": {
      const hasUnlocked = state.drinks.some((drink) => !drink.locked);
      if (hasUnlocked) {
        return {
          ...state,
          drinks: normalizeDrinks(state.drinks),
        };
      }

      return {
        ...state,
        drinks: normalizeDrinks([...state.drinks, createDefaultDrink()]),
      };
    }

    case "UPDATE_DRINK": {
      const next = state.drinks.map((drink) =>
        drink.id === action.payload.id
          ? ({
              ...drink,
              [action.payload.field]: action.payload.value,
            } as DrinkInput)
          : drink
      );

      return {
        ...state,
        drinks: normalizeDrinks(next),
      };
    }

    case "DELETE_DRINK": {
      const next = state.drinks.filter(
        (drink) => drink.id !== action.payload.id
      );

      return {
        ...state,
        drinks: normalizeDrinks(next),
      };
    }

    case "TOGGLE_DRINK_LOCK": {
      const target = state.drinks.find(
        (drink) => drink.id === action.payload.id
      );
      if (!target) return state;

      if (target.locked) {
        const unlockedExists = state.drinks.some((drink) => !drink.locked);
        if (unlockedExists) {
          return {
            ...state,
            drinks: normalizeDrinks(
              state.drinks.map((drink) =>
                drink.id === action.payload.id
                  ? { ...drink, locked: true }
                  : drink
              )
            ),
          };
        }

        return {
          ...state,
          drinks: normalizeDrinks(
            state.drinks.map((drink) =>
              drink.id === action.payload.id
                ? { ...drink, locked: false }
                : drink
            )
          ),
        };
      }

      return {
        ...state,
        drinks: normalizeDrinks(
          state.drinks.map((drink) =>
            drink.id === action.payload.id ? { ...drink, locked: true } : drink
          )
        ),
      };
    }

    case "ADD_HISTORY":
      return {
        ...state,
        histories: [normalizeHistoryItem(action.payload), ...state.histories],
      };

    case "DELETE_HISTORY":
      return {
        ...state,
        histories: state.histories.filter(
          (item) => item.id !== action.payload.id
        ),
      };

    case "LOAD_HISTORY": {
      const target = state.histories.find(
        (item) => item.id === action.payload.id
      );
      if (!target) return state;

      return {
        ...state,
        date: normalizeDateString(target.date),
        weightKg: target.weightKg,
        sex: target.sex,
        startTime: target.startTime,
        endTime: target.endTime,
        elapsedHoursAfterEnd: target.elapsedHoursAfterEnd,
        drinks:
          target.drinks.length > 0
            ? target.drinks.map(cloneDrink)
            : [createDefaultDrink()],
      };
    }

    case "RESET_ALL":
      return {
        ...initialState,
        histories: state.histories,
        drinks: [createDefaultDrink()],
      };

    default:
      return state;
  }
}

type AppContextValue = {
  state: AppState;
  dispatch: React.Dispatch<Action>;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    const saved = loadFromStorage();
    if (saved) {
      dispatch({ type: "INIT", payload: saved });
    }
  }, []);

  useEffect(() => {
    saveToStorage(state);
  }, [state]);

  const value = useMemo(() => ({ state, dispatch }), [state]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error("useApp must be used within AppProvider");
  }

  return context;
}
